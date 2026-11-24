-- Fictional data only. Run in the local database.
begin;
\ir finance_fixture.sql
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000001', true);
do $$
declare
 church uuid:='20000000-0000-4000-8000-000000000001';
 unit uuid:='30000000-0000-4000-8000-000000000002';
 method uuid; dept uuid; box uuid; cat uuid; state jsonb; rev text; preview jsonb; batch jsonb; csv text;
 chart jsonb:='[{"code":"1","classification":"3","name":"Grupo"},{"code":"001","classification":"3.01","name":"Recebimento"},{"code":"002","classification":"4.01","name":"Pagamento"}]';
 links jsonb; command jsonb; filters jsonb;
begin
 execute 'set local role authenticated';
 cat:=(public.save_finance_catalog(church,jsonb_build_object('entity','CATEGORY','congregationId',unit,'name','Repasse','direction','BOTH'))->>'id')::uuid;
 links:=jsonb_build_array(jsonb_build_object('category',cat,'direction','INCOME','code','001'),jsonb_build_object('category',cat,'direction','EXPENSE','code','002'));
 state:=public.finance_accounting_plan(church); rev:=state->>'revision';
 assert jsonb_array_length(state->'accounts')=0;
 begin
  perform public.apply_finance_accounting_plan(church,rev,chart,links||jsonb_build_array(jsonb_build_object('name','Inválida','direction','INCOME','code','1')));
  raise exception 'group accepted';
 exception when raise_exception then if sqlerrm<>'INVALID_INPUT' then raise; end if; end;
 assert public.finance_accounting_plan(church)=state,'partial write';
 state:=public.apply_finance_accounting_plan(church,rev,chart,links);
 assert state#>>'{categories,0,income}'='001' and state#>>'{categories,0,expense}'='002';
 assert (select accounting_code is null from public.financial_categories where church_id=church and id=cat),'code leaked into ordinary category';
 begin
  perform public.apply_finance_accounting_plan(church,state->>'revision','[{"code":"003","classification":"3.01.1","name":"Subconta"}]','[]');
  raise exception 'linked posting account became a group';
 exception when raise_exception then if sqlerrm<>'ACCOUNTING_PLAN_GROUP' then raise; end if; end;
 assert state=public.apply_finance_accounting_plan(church,state->>'revision',chart,links);
 begin perform public.apply_finance_accounting_plan(church,rev,'[]',links); raise exception 'stale';
 exception when raise_exception then if sqlerrm<>'CONFLICT' then raise; end if; end;
 begin perform public.set_finance_accounting_code(church,'CATEGORY',cat,'002',null); raise exception 'ambiguous edit';
 exception when raise_exception then if sqlerrm<>'CONFIGURATION_REQUIRED' then raise; end if; end;
 state:=public.apply_finance_accounting_plan(church,state->>'revision','[]','[{"name":"Outra","direction":"INCOME","code":"001"}]');
 assert jsonb_array_length(state->'categories')=2;
 method:=(public.save_finance_catalog(church,jsonb_build_object('entity','PAYMENT_METHOD','congregationId',unit,'name','Dinheiro','kind','CASH'))->>'id')::uuid;
 dept:=(public.save_finance_catalog(church,jsonb_build_object('entity','DEPARTMENT','congregationId',unit,'name','Geral','effectiveMonth','2026-10','reason','Fictício local','participatesInBase',false))->>'id')::uuid;
 box:=(public.save_finance_catalog(church,jsonb_build_object('entity','CASHBOX','kind','CASH','congregationId',unit,'name','Caixa','openingDate','2026-10-01','openingCents',5000,'paymentMethodIds',jsonb_build_array(method)))->>'id')::uuid;
 perform public.set_finance_accounting_code(church,'CASHBOX',box,'88',null);
 command:=jsonb_build_object('kind','RECORD','congregationId',unit,'mode','SINGLE','date','2026-10-15','cashboxId',box,'paymentMethodId',method,'contributor',jsonb_build_object('kind','COLLECTIVE'),'items',jsonb_build_array(jsonb_build_object('categoryId',cat,'departmentId',dept,'amountCents',1000)));
 perform public.execute_finance_command(church,command||jsonb_build_object('direction','INCOME','operationKey',gen_random_uuid()));
 perform public.execute_finance_command(church,command||jsonb_build_object('direction','EXPENSE','operationKey',gen_random_uuid()));
 filters:=jsonb_build_object('unit',unit,'box',box,'direction','ALL','start','2026-10-01','end','2026-10-31');
 preview:=public.preview_finance_accounting(church,filters,1);
 assert preview->>'missing'='0' and preview->>'total'='2';
 batch:=public.generate_finance_accounting(church,filters,preview->>'fingerprint',false);
 csv:=convert_from(decode(batch->>'file','base64'),'WIN1252');
 assert position(';88;001;' in csv)>0 and position(';002;88;' in csv)>0,'incorrect debit or credit';
 begin perform public.finance_accounting_plan('20000000-0000-4000-8000-000000000002'); raise exception 'cross church';
 exception when insufficient_privilege then null; end;
 perform set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000002',true);
 begin perform public.finance_accounting_plan(church); raise exception 'treasurer saw codes'; exception when insufficient_privilege then null; end;
 begin perform public.apply_finance_accounting_plan(church,state->>'revision',chart,links); raise exception 'treasurer wrote codes'; exception when insufficient_privilege then null; end;
 assert not has_function_privilege('anon','public.finance_accounting_plan(uuid)','execute');
 assert not has_table_privilege('authenticated','private.accounting_category_links','select');
end $$;
rollback;
