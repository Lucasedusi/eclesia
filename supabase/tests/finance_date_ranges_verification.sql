-- Local-only fixtures; all writes are rolled back.
begin;
\ir finance_fixture.sql
create function pg_temp.assert_true(value boolean, message text) returns void language plpgsql as $$
begin if value is distinct from true then raise exception '%', message; end if; end; $$;
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000001',true);
do $$
declare
 c uuid := '20000000-0000-4000-8000-000000000001';
 u uuid := '30000000-0000-4000-8000-000000000001';
 method uuid; dept uuid; category uuid; box uuid; command jsonb;
begin
 method := (public.save_finance_catalog(c,jsonb_build_object('entity','PAYMENT_METHOD','congregationId',u,'name','Dinheiro','kind','CASH'))->>'id')::uuid;
 dept := (public.save_finance_catalog(c,jsonb_build_object('entity','DEPARTMENT','congregationId',u,'name','Tesouraria','effectiveMonth','2026-09','participatesInBase',true,'reason','Configuração fictícia para testar intervalos'))->>'id')::uuid;
 category := (public.save_finance_catalog(c,jsonb_build_object('entity','CATEGORY','congregationId',u,'name','Oferta','direction','INCOME'))->>'id')::uuid;
 box := (public.save_finance_catalog(c,jsonb_build_object('entity','CASHBOX','congregationId',u,'name','Caixa','kind','CASH','openingDate','2026-09-01','openingCents',0,'paymentMethodIds',jsonb_build_array(method)))->>'id')::uuid;
 command := jsonb_build_object('kind','RECORD','congregationId',u,'mode','SINGLE','direction','INCOME','cashboxId',box,'paymentMethodId',method,'contributor',jsonb_build_object('kind','COLLECTIVE'),'items',jsonb_build_array(jsonb_build_object('categoryId',category,'departmentId',dept,'amountCents',100)));
 for i in 1..21 loop
  perform public.execute_finance_command(c,command||jsonb_build_object('operationKey',gen_random_uuid(),'date',case when i=1 then '2026-09-29' else '2026-10-05' end));
 end loop;
 perform public.execute_finance_command(c,command||jsonb_build_object('operationKey',gen_random_uuid(),'date','2026-09-28'));
 perform public.execute_finance_command(c,command||jsonb_build_object('operationKey',gen_random_uuid(),'date','2026-10-06'));
end; $$;
set local role authenticated;
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000002',true);
do $$
declare c uuid:='20000000-0000-4000-8000-000000000001'; u uuid:='30000000-0000-4000-8000-000000000001';
 filters jsonb := '{"month":"2026-10","dateFrom":"2026-09-29","dateTo":"2026-10-05"}'; result jsonb; bad jsonb;
begin
 result:=public.list_finance_transactions(c,u,filters);
 perform pg_temp.assert_true((result->>'totalCount')::int=21 and (result->>'filteredIncomeCents')::numeric=2100 and (result->>'pageCount')::int=2,'cross-month count/totals include both endpoints and exclude outside days');
 perform pg_temp.assert_true(jsonb_array_length(result->'items')=20,'range pagination remains 20');
 result:=public.list_finance_transactions(c,u,filters||'{"page":2}');
 perform pg_temp.assert_true(jsonb_array_length(result->'items')=1 and result->'items'->0->>'date'='2026-09-29','second page retains cross-month range');
 result:=public.list_finance_transactions(c,u,'{"month":"2026-10"}');
 perform pg_temp.assert_true((result->>'totalCount')::int=21,'monthly default remains unchanged');
 result:=public.list_finance_transactions(c,u,filters||'{"dateFrom":"2026-09-29","dateTo":"2026-09-29"}');
 perform pg_temp.assert_true((result->>'totalCount')::int=1,'single day range includes that date');
 for bad in select value from jsonb_array_elements('[{"dateFrom":"2026-09-29"},{"dateTo":"2026-10-05"},{"dateFrom":"2026-10-06","dateTo":"2026-10-05"},{"dateFrom":"2026-02-30","dateTo":"2026-03-01"},{"dateFrom":null,"dateTo":null},{"dateFrom":"1999-12-31","dateTo":"2026-01-01"}]') loop
  begin
   perform public.list_finance_transactions(c,u,jsonb_build_object('month','2026-10')||bad);
   raise exception 'invalid date range accepted';
  exception when sqlstate '22023' or sqlstate '22008' or sqlstate '22007' then null; end;
 end loop;
 begin perform public.list_finance_transactions(c,'30000000-0000-4000-8000-000000000002',filters);raise exception 'wrong scope allowed';
 exception when raise_exception then if sqlerrm<>'FORBIDDEN' then raise;end if;end;
 begin perform public.list_finance_transactions('20000000-0000-4000-8000-000000000002','30000000-0000-4000-8000-000000000003',filters);raise exception 'cross tenant allowed';
 exception when raise_exception then if sqlerrm<>'FORBIDDEN' then raise;end if;end;
end; $$;
reset role;
select pg_temp.assert_true(not has_function_privilege('anon','public.list_finance_transactions(uuid,uuid,jsonb)','execute'),'anonymous grant revoked');
select pg_temp.assert_true(not prosecdef and proconfig @> array['search_path=""'], 'invoker and empty search path') from pg_proc where oid='public.list_finance_transactions(uuid,uuid,jsonb)'::regprocedure;
set local role anon;
do $$ begin
 begin perform public.list_finance_transactions('20000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000001','{"month":"2026-10"}');raise exception 'anonymous call allowed';
 exception when insufficient_privilege then null;end;
end; $$;
reset role;
rollback;
