-- Local-only acceptance test. All fictional data is rolled back.
begin;
\ir finance_fixture.sql
insert into public.user_permission_overrides(access_id,permission_id,effect)
select '40000000-0000-4000-8000-000000000004',id,'ALLOW' from public.permissions where key='finance.accounting.export' and deleted_at is null;
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000001',true);
do $$
declare
 church uuid := '20000000-0000-4000-8000-000000000001';
 hq uuid := '30000000-0000-4000-8000-000000000002';
 other_unit uuid := '30000000-0000-4000-8000-000000000001';
 other_box uuid; cash uuid; bank uuid; method uuid; cat uuid; expense uuid; dept uuid; tx_id uuid;
 cmd jsonb; result jsonb; f jsonb; first_preview jsonb; batch jsonb; csv_text text;
begin
  method := (public.save_finance_catalog(church,jsonb_build_object('entity','PAYMENT_METHOD','congregationId',hq,'name','Dinheiro','kind','CASH'))->>'id')::uuid;
  dept := (public.save_finance_catalog(church,jsonb_build_object('entity','DEPARTMENT','congregationId',hq,'name','Missões','effectiveMonth','2026-10','reason','Configuração de teste','participatesInBase',false))->>'id')::uuid;
  cat := (public.save_finance_catalog(church,jsonb_build_object('entity','CATEGORY','congregationId',hq,'name','Repasse','direction','INCOME'))->>'id')::uuid;
  expense := (public.save_finance_catalog(church,jsonb_build_object('entity','CATEGORY','congregationId',hq,'name','Compra','direction','EXPENSE'))->>'id')::uuid;
  cmd := jsonb_build_object('entity','CASHBOX','kind','CASH','congregationId',hq,'name','Físico','openingDate','2026-10-01','openingCents',200000,'paymentMethodIds',jsonb_build_array(method));
  cash := (public.save_finance_catalog(church,cmd)->>'id')::uuid;
  bank := (public.save_finance_catalog(church,cmd || '{"name":"Reserva","openingDate":"2026-10-02","openingCents":500}')->>'id')::uuid;
  other_box := (public.save_finance_catalog(church,cmd || jsonb_build_object('congregationId',other_unit))->>'id')::uuid;
  cmd := jsonb_build_object('kind','RECORD','congregationId',hq,'operationKey',gen_random_uuid(),'mode','SINGLE','direction','INCOME','date','2026-10-02','cashboxId',cash,'paymentMethodId',method,'contributor',jsonb_build_object('kind','COLLECTIVE'),'items',jsonb_build_array(jsonb_build_object('categoryId',cat,'departmentId',dept,'amountCents',10000,'description','Repasse; missão "A"')));
  result := public.execute_finance_command(church,cmd);
  tx_id := (result->'transactionIds'->>0)::uuid;
  perform public.execute_finance_command(church,cmd || jsonb_build_object('operationKey',gen_random_uuid(),'direction','EXPENSE','items',jsonb_build_array(jsonb_build_object('categoryId',expense,'departmentId',dept,'amountCents',2500))));
 execute 'set local role authenticated';
 f:=jsonb_build_object('unit',hq,'box',cash,'start','2026-10-01','end','2026-10-31','direction','ALL');
 first_preview:=public.preview_finance_accounting(church,f,1);
 assert (first_preview->>'opening')::numeric=0, 'opening on first day belongs to that day';
 result:=public.preview_finance_accounting(church,f||'{"start":"2026-10-02"}',1);
 assert (result->>'opening')::numeric=200000 and (result->>'income')::numeric-(result->>'expense')::numeric=7500;
 assert first_preview->>'missing'='2' and first_preview->>'total'='2', 'missing mappings retained';
 begin
  perform public.generate_finance_accounting(church,f,first_preview->>'fingerprint',false);
  raise exception 'unmapped records exported';
 exception when raise_exception then if sqlerrm<>'CONFIGURATION_REQUIRED' then raise; end if; end;
 perform public.set_finance_accounting_code(church,'CASHBOX',cash,'45',null);
 perform public.set_finance_accounting_code(church,'CATEGORY',cat,'3580',null);
 perform public.set_finance_accounting_code(church,'CATEGORY',expense,'009',null);
 begin
  perform public.generate_finance_accounting(church,f,first_preview->>'fingerprint',false);
  raise exception 'stale preview exported';
 exception when raise_exception then if sqlerrm<>'CONFLICT' then raise; end if; end;
 result:=public.preview_finance_accounting(church,f,1);
 assert result->>'income'='10000' and result->>'expense'='2500' and result->>'missing'='0';
 batch:=public.generate_finance_accounting(church,f,result->>'fingerprint',false);
 csv_text:=convert_from(decode(batch->>'file','base64'),'WIN1252');
 assert strpos(csv_text,';45;3580;2026-10-02;100,00;;"Repasse; missão ""A""";;;')>0, 'income, encoding and quoting';
 assert strpos(csv_text,';009;45;2026-10-02;25,00;')>0, 'expense and leading zeros';
 assert array_length(string_to_array(split_part(csv_text,chr(10),1),';'),1)=10;
 begin
  perform public.generate_finance_accounting(church,f,result->>'fingerprint',false);
  raise exception 'repeat export not acknowledged';
 exception when raise_exception then if sqlerrm<>'ACCOUNTING_REPEAT' then raise; end if; end;
 assert public.generate_finance_accounting(church,f,result->>'fingerprint',true)=batch, 'retry must reproduce same batch';
 perform public.confirm_finance_accounting_import(church,(batch->>'id')::uuid);
 perform public.execute_finance_command(church,jsonb_build_object('kind','CANCEL_TRANSACTION','operationKey',gen_random_uuid(),'congregationId',hq,'id',tx_id,'expectedRevision',1,'reason','Cancelar lançamento fictício'));
 result:=public.finance_accounting_history(church,hq,cash,1);
 assert result->>'total'='1' and result#>>'{items,0,confirmed}' is not null and result#>>'{items,0,changed}'='1';
 perform public.execute_finance_command(church,jsonb_build_object('kind','TRANSFER','operationKey',gen_random_uuid(),'congregationId',hq,'sourceCashboxId',cash,'targetCashboxId',bank,'date','2026-10-02','amountCents',500));
 perform public.execute_finance_command(church,jsonb_build_object('kind','ADJUST_BALANCE','operationKey',gen_random_uuid(),'congregationId',hq,'cashboxId',cash,'date','2026-10-02','amountCents',-200,'reason','Conferência fictícia'));
 result:=public.preview_finance_accounting(church,f||'{"start":"2026-10-03"}',1);
 assert (result->>'opening')::numeric=196800 and result->>'total'='0', 'opening includes reversal, transfer and adjustment in an empty period';
 result:=public.preview_finance_accounting(church,f||'{"start":"2026-10-03","box":null,"unit":null}',1);
 assert (result->>'opening')::numeric=397800, 'authorized consolidated balance includes both units and offsets internal transfer';
 result:=public.preview_finance_accounting(church,f,1);
 assert jsonb_array_length(result->'special')=2 and result->>'total'='1';
 begin
  perform public.generate_finance_accounting(church,f,result->>'fingerprint',true);
  raise exception 'special movements silently skipped';
 exception when raise_exception then if sqlerrm<>'CONFIGURATION_REQUIRED' then raise; end if; end;
 -- Reproduce the counts and aggregate of the Cathedral example using synthetic transactions.
 for n in 1..14 loop
  perform public.execute_finance_command(church,cmd||jsonb_build_object('date','2026-11-05','operationKey',gen_random_uuid(),
    'contributor',jsonb_build_object('kind','CONGREGATION','congregationId',other_unit),
    'items',jsonb_build_array(jsonb_build_object('categoryId',cat,'departmentId',dept,'amountCents',case when n=14 then 825643 else 300000 end,'description','Repasse fictício'))));
 end loop;
 f:=f||'{"start":"2026-11-01","end":"2026-11-30"}';
 result:=public.preview_finance_accounting(church,f,1);
 assert (result->>'income')::bigint=4725643 and result->>'total'='14' and result#>>'{rows,0,payer}'='Unit A';
 csv_text:=convert_from(decode(public.generate_finance_accounting(church,f,result->>'fingerprint',false)->>'file','base64'),'WIN1252');
 assert (select count(*) from regexp_split_to_table(csv_text,chr(10)) line where line like ';45;3580;%')=14;
 f:=f||'{"start":"2026-10-01","end":"2026-10-31"}';
 perform set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000004',true);
 assert jsonb_array_length(public.finance_accounting_catalog(church)->'units')=1;
 assert public.preview_finance_accounting(church,f||'{"unit":null,"box":null}',1)->>'total'='0';
 assert (public.preview_finance_accounting(church,f||'{"unit":null,"box":null,"start":"2026-10-03"}',1)->>'opening')::numeric=200000, 'aggregate limited to authorized unit';
 assert public.finance_accounting_history(church,null,null,1)->>'total'='0';
 begin perform public.preview_finance_accounting(church,f,1); raise exception 'wrong unit'; exception when insufficient_privilege then null; end;
 begin perform public.confirm_finance_accounting_import(church,(batch->>'id')::uuid); raise exception 'cross-scope mutation'; exception when insufficient_privilege then null; end;
 begin perform public.set_finance_accounting_code(church,'CASHBOX',other_box,'991',null); raise exception 'accountant can edit'; exception when insufficient_privilege then null; end;
 assert jsonb_array_length(public.finance_accounting_catalog('20000000-0000-4000-8000-000000000002')->'units')=0;
 perform set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000003',true);
 assert jsonb_array_length(public.finance_accounting_catalog(church)->'units')=0, 'finance.view alone is insufficient';
 assert not has_function_privilege('anon','public.generate_finance_accounting(uuid,jsonb,text,boolean)','execute');
 assert not has_table_privilege('authenticated','private.finance_accounting_batches','insert');
end $$;
rollback;
