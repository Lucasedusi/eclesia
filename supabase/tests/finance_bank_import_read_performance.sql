-- Local only: fictional 15-unit church, rolled back. Run as postgres for tracking.
begin;
set local statement_timeout='30s';
set local track_functions='all';
\ir finance_fixture.sql
insert into public.congregations(church_id,name,region_id)
select '20000000-0000-4000-8000-000000000001','Import performance unit '||n,'25000000-0000-4000-8000-000000000001'
from generate_series(1,13) n;
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000001',true);
set local role authenticated;
do $$
declare
 c uuid:='20000000-0000-4000-8000-000000000001'; u uuid:='30000000-0000-4000-8000-000000000001';
 method uuid; box uuid; batch uuid; dep uuid; cat uuid; item uuid; rows jsonb; result jsonb; before_calls bigint; after_calls bigint; started timestamptz;
begin
 method:=(public.save_finance_catalog(c,jsonb_build_object('entity','PAYMENT_METHOD','congregationId',u,'name','Performance Pix','kind','PIX'))->>'id')::uuid;
 box:=(public.save_finance_catalog(c,jsonb_build_object('entity','CASHBOX','congregationId',u,'name','Performance bank','kind','BANK_ACCOUNT','openingDate','2026-01-01','openingCents',0,'paymentMethodIds',jsonb_build_array(method)))->>'id')::uuid;
 select jsonb_agg(jsonb_build_object('rowNumber',n+2,'date','2026-10-21','document','TESTE','history','PIX RECEBIDO','complement','Fictitious movement '||n,'amountCents',100)) into rows from generate_series(1,50) n;
 batch:=(public.prepare_finance_bank_import(c,u,box,repeat('9',64),'performance.xlsx',jsonb_build_object('parserVersion','SICOOB_XLSX_V1','reconciliation','UNAVAILABLE','balances','[]'::jsonb,'rows',rows))->>'id')::uuid;
 select coalesce(sum(calls),0) into before_calls from pg_stat_xact_user_functions where schemaname='private' and funcname='bank_import_units';
 started:=clock_timestamp();
 result:=public.get_finance_bank_import(c,u,batch,'{}');
 select coalesce(sum(calls),0) into after_calls from pg_stat_xact_user_functions where schemaname='private' and funcname='bank_import_units';
 raise notice '50 pending rows, 15 units: % ms; % scope-set evaluations',round(extract(epoch from clock_timestamp()-started)*1000),after_calls-before_calls;
 if jsonb_array_length(result->'items')<>50 or (result#>>'{counts,pending}')::int<>50 then raise exception 'Missing pending items'; end if;
 -- A bounded number of scope queries, independent of the 50 displayed rows.
 if after_calls-before_calls>25 then raise exception 'Per-row scope evaluation regression: % calls (budget 25)',after_calls-before_calls; end if;
 dep:=(public.save_finance_catalog(c,jsonb_build_object('entity','DEPARTMENT','congregationId',u,'name','Performance department','effectiveMonth','2026-01','participatesInBase',false,'reason','Fictional configuration'))->>'id')::uuid;
 cat:=(public.save_finance_catalog(c,jsonb_build_object('entity','CATEGORY','congregationId',u,'name','Performance offering','direction','INCOME','departmentId',dep))->>'id')::uuid;
 for item in select id from public.finance_bank_import_items where church_id=c and batch_id=batch loop
  perform public.finance_bank_import_item(c,u,item,1,gen_random_uuid(),'POST',jsonb_build_object('command',jsonb_build_object(
   'kind','RECORD','mode','SINGLE','direction','INCOME','date','2026-10-21','congregationId',u,'cashboxId',box,'paymentMethodId',method,
   'contributor',jsonb_build_object('kind','COLLECTIVE'),'items',jsonb_build_array(jsonb_build_object('categoryId',cat,'departmentId',dep,'amountCents',100)))));
 end loop;
 select coalesce(sum(calls),0) into before_calls from pg_stat_xact_user_functions where schemaname='private' and funcname='bank_import_units';
 started:=clock_timestamp();
 result:=public.get_finance_bank_import(c,u,batch,'{"status":"COMPLETED"}');
 select coalesce(sum(calls),0) into after_calls from pg_stat_xact_user_functions where schemaname='private' and funcname='bank_import_units';
 raise notice '50 completed rows, 15 units: % ms; % scope-set evaluations',round(extract(epoch from clock_timestamp()-started)*1000),after_calls-before_calls;
 if jsonb_array_length(result->'items')<>50 or (result#>>'{counts,completed}')::int<>50 or (result#>>'{counts,pending}')::int<>0 then raise exception 'Incorrect completed count'; end if;
 if after_calls-before_calls>25 then raise exception 'Completed rows repeat scope evaluation: % calls',after_calls-before_calls; end if;
end $$;
rollback;
