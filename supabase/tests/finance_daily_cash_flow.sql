-- Local acceptance check. Run with psql from any directory.
begin;
\ir finance_fixture.sql
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000001',true);

do $$
declare
  church uuid := '20000000-0000-4000-8000-000000000001';
  hq uuid := '30000000-0000-4000-8000-000000000002';
  other_unit uuid := '30000000-0000-4000-8000-000000000001';
  day jsonb := '{"date":"2026-10-02"}';
  other_box uuid; cash uuid; bank uuid; method uuid; cat uuid; expense uuid; dept uuid;
  cmd jsonb; result jsonb; transfer_id uuid; tx_id uuid;
begin
  method := (public.save_finance_catalog(church,jsonb_build_object('entity','PAYMENT_METHOD','congregationId',hq,'name','Dinheiro','kind','CASH'))->>'id')::uuid;
  dept := (public.save_finance_catalog(church,jsonb_build_object('entity','DEPARTMENT','congregationId',hq,'name','Missões','effectiveMonth','2026-10','reason','Configuração de teste','participatesInBase',false))->>'id')::uuid;
  cat := (public.save_finance_catalog(church,jsonb_build_object('entity','CATEGORY','congregationId',hq,'name','Oferta','direction','INCOME'))->>'id')::uuid;
  expense := (public.save_finance_catalog(church,jsonb_build_object('entity','CATEGORY','congregationId',hq,'name','Compra','direction','EXPENSE'))->>'id')::uuid;
  cmd := jsonb_build_object('entity','CASHBOX','kind','CASH','congregationId',hq,'name','Físico','openingDate','2026-10-01','openingCents',200000,'paymentMethodIds',jsonb_build_array(method));
  cash := (public.save_finance_catalog(church,cmd)->>'id')::uuid;
  bank := (public.save_finance_catalog(church,cmd || '{"name":"Reserva","openingDate":"2026-10-02","openingCents":500}')->>'id')::uuid;
  other_box := (public.save_finance_catalog(church,cmd || jsonb_build_object('congregationId',other_unit))->>'id')::uuid;
  cmd := jsonb_build_object('kind','RECORD','congregationId',hq,'operationKey',gen_random_uuid(),'mode','SINGLE','direction','INCOME','date','2026-10-02','cashboxId',cash,'paymentMethodId',method,'contributor',jsonb_build_object('kind','COLLECTIVE'),'items',jsonb_build_array(jsonb_build_object('categoryId',cat,'departmentId',dept,'amountCents',10000,'description','Culto de domingo')));
  result := public.execute_finance_command(church,cmd);
  tx_id := (result->'transactionIds'->>0)::uuid;
  perform public.execute_finance_command(church,cmd || jsonb_build_object('operationKey',gen_random_uuid(),'direction','EXPENSE','items',jsonb_build_array(jsonb_build_object('categoryId',expense,'departmentId',dept,'amountCents',2500))));
  perform public.execute_finance_command(church,cmd || jsonb_build_object('operationKey',gen_random_uuid(),'date','2026-10-04'));
  result := public.execute_finance_command(church,jsonb_build_object('kind','TRANSFER','operationKey',gen_random_uuid(),'congregationId',hq,'sourceCashboxId',cash,'targetCashboxId',bank,'date','2026-10-02','amountCents',50000));
  transfer_id := (result->>'transferId')::uuid;
  perform public.execute_finance_command(church,jsonb_build_object('kind','ADJUST_BALANCE','operationKey',gen_random_uuid(),'congregationId',hq,'cashboxId',cash,'date','2026-10-02','amountCents',-200,'reason','Conferência fictícia'));
  execute 'set local role authenticated';
  result := public.get_finance_daily_cash_flow(church,day);
  assert result->'summary' = '{"opening":200000,"income":10000,"expense":2500,"closing":207800}'::jsonb, 'consolidated totals';
  assert jsonb_array_length(result->'items')=5 and jsonb_array_length(result->'cashboxes')=2, 'only cathedral, one transfer';
  assert (select r->>'sign'='NEUTRAL' from jsonb_array_elements(result->'items') r where r->>'kind'='TRANSFER'), 'neutral consolidated transfer';
  result := public.get_finance_daily_cash_flow(church,day || jsonb_build_object('box',cash,'search','domingo','direction','INCOME','category',cat,'method',method,'department',dept));
  assert result->'summary'='{"opening":200000,"income":10000,"expense":2500,"closing":157300}'::jsonb and jsonb_array_length(result->'items')=1, 'list filters preserve cards';
  assert (public.get_finance_daily_cash_flow(church,day || jsonb_build_object('box',bank))#>>'{summary,closing}')::numeric=50500, 'destination transfer and opening';
  result := public.get_finance_daily_cash_flow(church,'{"date":"2026-10-03"}');
  assert result->'summary'='{"opening":207800,"income":0,"expense":0,"closing":207800}'::jsonb and result->'items'='[]'::jsonb, 'empty day retains balance';
  perform public.execute_finance_command(church,jsonb_build_object('kind','CANCEL_TRANSFER','operationKey',gen_random_uuid(),'congregationId',hq,'id',transfer_id,'expectedRevision',1,'reason','Cancelar transferência fictícia'));
  perform public.execute_finance_command(church,jsonb_build_object('kind','CANCEL_TRANSACTION','operationKey',gen_random_uuid(),'congregationId',hq,'id',tx_id,'expectedRevision',1,'reason','Cancelar lançamento fictício'));
  result := public.get_finance_daily_cash_flow(church,day || jsonb_build_object('box',cash));
  assert (result#>>'{summary,closing}')::numeric=197300 and (result#>>'{summary,income}')::numeric=0 and jsonb_array_length(result->'items')=2, 'canceled movements reconciled';
  for i in 1..23 loop
    perform public.execute_finance_command(church,cmd || jsonb_build_object('operationKey',gen_random_uuid(),'date','2026-10-06'));
  end loop;
  result := public.get_finance_daily_cash_flow(church,'{"date":"2026-10-06","page":40}');
  assert (result->>'total')::int=23 and (result->>'page')::int=2 and jsonb_array_length(result->'items')=3, 'out-of-range page clamps to the last page';
  assert (result#>>'{summary,income}')::numeric=230000, 'totals cover all pages';
  assert not exists(
    select a->>'id' from jsonb_array_elements(result->'items') a intersect
    select b->>'id' from jsonb_array_elements(public.get_finance_daily_cash_flow(church,'{"date":"2026-10-06"}')->'items') b
  ), 'pages do not overlap';
  begin
    perform public.get_finance_daily_cash_flow(church,day || jsonb_build_object('box',other_box));
    raise exception 'accepted another unit';
  exception when insufficient_privilege then null; end;
  begin
    perform public.get_finance_daily_cash_flow('20000000-0000-4000-8000-000000000002',day);
    raise exception 'accepted another church';
  exception when insufficient_privilege then null; end;
  perform set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000003',true);
  begin
    perform public.get_finance_daily_cash_flow(church,day);
    raise exception 'accepted non-admin with cathedral finance.view';
  exception when insufficient_privilege then null; end;
  assert not has_function_privilege('anon','public.get_finance_daily_cash_flow(uuid,jsonb)','execute'), 'anonymous grant';
end $$;
rollback;
