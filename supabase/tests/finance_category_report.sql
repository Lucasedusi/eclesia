begin;
create function pg_temp.assert_true(value boolean,message text) returns void language plpgsql as $$ begin if value is distinct from true then raise exception '%',message; end if; end; $$;
-- Local-only fictional data, intended to run inside the caller's transaction.
-- All IDs are reserved for this suite and nothing is committed.
insert into auth.users(id,email) values
 ('10000000-0000-4000-8000-000000000001','finance-admin@example.invalid'),
 ('10000000-0000-4000-8000-000000000002','finance-treasurer@example.invalid'),
 ('10000000-0000-4000-8000-000000000003','finance-secretary@example.invalid'),
 ('10000000-0000-4000-8000-000000000004','finance-observer@example.invalid');
insert into public.profiles(id,full_name,status) select id,'Finance fixture','ACTIVE' from auth.users where id in ('10000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000002','10000000-0000-4000-8000-000000000003','10000000-0000-4000-8000-000000000004') on conflict(id) do update set status='ACTIVE';
insert into public.churches(id,name) values
 ('20000000-0000-4000-8000-000000000001','Finance Field A'),('20000000-0000-4000-8000-000000000002','Finance Field B');
insert into public.regions(id,church_id,name) values
 ('25000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001','Region A');
insert into public.congregations(id,church_id,name,is_headquarters,region_id) values
 ('30000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001','Unit A',false,'25000000-0000-4000-8000-000000000001'),
 ('30000000-0000-4000-8000-000000000002','20000000-0000-4000-8000-000000000001','Headquarters',true,null),
 ('30000000-0000-4000-8000-000000000003','20000000-0000-4000-8000-000000000002','Unit other field',true,null);
insert into public.user_church_access(id,profile_id,church_id,role,access_scope,congregation_id,status) values
 ('40000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001','ADMIN','CHURCH',null,'ACTIVE'),
 ('40000000-0000-4000-8000-000000000002','10000000-0000-4000-8000-000000000002','20000000-0000-4000-8000-000000000001','TREASURER','CONGREGATION','30000000-0000-4000-8000-000000000001','ACTIVE'),
 ('40000000-0000-4000-8000-000000000003','10000000-0000-4000-8000-000000000003','20000000-0000-4000-8000-000000000001','SECRETARY','CONGREGATION','30000000-0000-4000-8000-000000000002','ACTIVE');
insert into public.user_church_access(id,profile_id,church_id,role,access_scope,region_id,status) values
 ('40000000-0000-4000-8000-000000000004','10000000-0000-4000-8000-000000000004','20000000-0000-4000-8000-000000000001','VIEWER','REGION','25000000-0000-4000-8000-000000000001','ACTIVE');
insert into public.user_permission_overrides(access_id,permission_id,effect)
select a.id,p.id,'ALLOW' from public.user_church_access a cross join public.permissions p
where a.id in ('40000000-0000-4000-8000-000000000002','40000000-0000-4000-8000-000000000003','40000000-0000-4000-8000-000000000004')
and p.key in ('finance.view','finance.transactions.create') and p.deleted_at is null;

insert into public.financial_categories(id,church_id,name,category_type) values('50000000-0000-4000-8000-000000000099','20000000-0000-4000-8000-000000000002','Categoria externa','EXPENSE');
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000001',true);
do $$ declare
 c uuid:='20000000-0000-4000-8000-000000000001';u uuid:='30000000-0000-4000-8000-000000000001';hq uuid:='30000000-0000-4000-8000-000000000002';
 method uuid;dep uuid;cat uuid;other_cat uuid;income_cat uuid;box uuid;box2 uuid;hqbox uuid;command jsonb;options jsonb;report jsonb;entry jsonb;bad jsonb;
begin
 method:=(public.save_finance_catalog(c,jsonb_build_object('entity','PAYMENT_METHOD','congregationId',u,'name','Dinheiro','kind','CASH'))->>'id')::uuid;
 dep:=(public.save_finance_catalog(c,jsonb_build_object('entity','DEPARTMENT','congregationId',u,'name','Tesouraria','effectiveMonth','2026-01','participatesInBase',true,'reason','Preparação histórica de teste'))->>'id')::uuid;
 cat:=(public.save_finance_catalog(c,jsonb_build_object('entity','CATEGORY','congregationId',u,'name','Combustível','direction','EXPENSE','departmentId',dep))->>'id')::uuid;
 other_cat:=(public.save_finance_catalog(c,jsonb_build_object('entity','CATEGORY','congregationId',u,'name','Manutenção','direction','BOTH','departmentId',dep))->>'id')::uuid;
 income_cat:=(public.save_finance_catalog(c,jsonb_build_object('entity','CATEGORY','congregationId',u,'name','Oferta','direction','INCOME','departmentId',dep))->>'id')::uuid;
 box:=(public.save_finance_catalog(c,jsonb_build_object('entity','CASHBOX','congregationId',u,'name','Caixa','kind','CASH','openingDate','2025-01-01','openingCents',1000000,'paymentMethodIds',jsonb_build_array(method)))->>'id')::uuid;
 box2:=(public.save_finance_catalog(c,jsonb_build_object('entity','CASHBOX','congregationId',u,'name','Caixa 2','kind','CASH','openingDate','2025-01-01','openingCents',1000000,'paymentMethodIds',jsonb_build_array(method)))->>'id')::uuid;
 hqbox:=(public.save_finance_catalog(c,jsonb_build_object('entity','CASHBOX','congregationId',hq,'name','Caixa sede','kind','CASH','openingDate','2025-01-01','openingCents',1000000,'paymentMethodIds',jsonb_build_array(method)))->>'id')::uuid;
 command:=jsonb_build_object('kind','RECORD','operationKey',gen_random_uuid(),'congregationId',u,'mode','SINGLE','direction','EXPENSE','date','2026-01-01','cashboxId',box,'paymentMethodId',method,'contributor',jsonb_build_object('kind','COLLECTIVE'),'beneficiaryName','Posto Exemplo','items',jsonb_build_array(jsonb_build_object('categoryId',cat,'departmentId',dep,'amountCents',12345,'description','Abastecimento')));
 perform public.execute_finance_command(c,command);
 perform public.execute_finance_command(c,command||jsonb_build_object('operationKey',gen_random_uuid(),'date','2026-12-31','cashboxId',box2));
 perform public.execute_finance_command(c,command||jsonb_build_object('operationKey',gen_random_uuid(),'date','2025-12-31'));
 perform public.execute_finance_command(c,command||jsonb_build_object('operationKey',gen_random_uuid(),'date','2027-01-01'));
 perform public.execute_finance_command(c,command||jsonb_build_object('operationKey',gen_random_uuid(),'congregationId',hq,'cashboxId',hqbox));
 perform public.execute_finance_command(c,command||jsonb_build_object('operationKey',gen_random_uuid(),'items',jsonb_build_array(jsonb_build_object('categoryId',other_cat,'departmentId',dep,'amountCents',5000))));
 perform public.execute_finance_command(c,command||jsonb_build_object('operationKey',gen_random_uuid(),'direction','INCOME','items',jsonb_build_array(jsonb_build_object('categoryId',income_cat,'departmentId',dep,'amountCents',100000))));
 entry:=public.execute_finance_command(c,command||jsonb_build_object('operationKey',gen_random_uuid()));
 perform public.execute_finance_command(c,jsonb_build_object('kind','CANCEL_TRANSACTION','operationKey',gen_random_uuid(),'congregationId',u,'id',entry#>>'{transactionIds,0}','expectedRevision',1,'reason','Cancelamento de teste'));
 perform public.execute_finance_command(c,jsonb_build_object('kind','TRANSFER','operationKey',gen_random_uuid(),'congregationId',u,'date','2026-01-01','sourceCashboxId',box,'targetCashboxId',box2,'amountCents',10000));
 update public.financial_categories set status='INACTIVE' where id=cat and church_id=c;
 options:=jsonb_build_object('type','CATEGORY','dateFrom','2026-01-01','dateTo','2026-12-31','direction','EXPENSE','presentation','SUMMARY','categoryIds',jsonb_build_array(cat));
 execute 'set local role authenticated';
 perform set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000002',true);
 report:=public.get_finance_category_report(c,u,options);
 perform pg_temp.assert_true((report->>'totalCents')::numeric=24690 and (report->>'count')::int=2,'inclusive year excludes other categories, cancellations, dates, units and transfers');
 perform pg_temp.assert_true(report->'rows'='[]'::jsonb and report#>>'{categories,0,status}'='INACTIVE','summary contains no personal rows, inactive retained');
 report:=public.get_finance_category_report(c,u,options||jsonb_build_object('presentation','DETAILED'));
 perform pg_temp.assert_true(jsonb_array_length(report->'rows')=2 and report#>>'{rows,0,date}'='2026-01-01' and report#>>'{rows,1,date}'='2026-12-31','complete chronological details');
 report:=public.get_finance_category_report(c,u,options||jsonb_build_object('cashboxId',box));
 perform pg_temp.assert_true((report->>'totalCents')::numeric=12345,'cashbox selection');
 report:=public.get_finance_category_report(c,u,options||jsonb_build_object('dateTo','2026-01-01','categoryIds',jsonb_build_array(cat,other_cat)));
 perform pg_temp.assert_true((report->>'totalCents')::numeric=17345 and jsonb_array_length(report->'categories')=2,'multi-category and same-day totals');
 report:=public.get_finance_category_report(c,u,options||jsonb_build_object('direction','INCOME','categoryIds',jsonb_build_array(income_cat)));
 perform pg_temp.assert_true((report->>'totalCents')::numeric=100000,'income direction');
 report:=public.get_finance_category_report(c,u,options||jsonb_build_object('dateFrom','2024-02-29','dateTo','2024-02-29'));
 perform pg_temp.assert_true((report->>'totalCents')::numeric=0 and (report->>'count')::int=0,'valid leap day and no movement');
 for bad in select value from jsonb_array_elements('[{"dateFrom":"2026-02-29"},{"dateFrom":"2027-01-01"},{"direction":"ALL"},{"categoryIds":[]},{"categoryIds":"invalid"},{"presentation":"OTHER"},{"dateFrom":null}]'::jsonb) loop
  begin perform public.get_finance_category_report(c,u,options||bad);raise exception 'invalid filter accepted';exception when invalid_parameter_value then null;end;
 end loop;
 begin perform public.get_finance_category_report(c,u,options||jsonb_build_object('categoryIds',jsonb_build_array(cat,cat)));raise exception 'duplicates accepted';exception when invalid_parameter_value then null;end;
 begin perform public.get_finance_category_report(c,u,options||jsonb_build_object('categoryIds',jsonb_build_array(income_cat)));raise exception 'wrong direction accepted';exception when insufficient_privilege then null;end;
 begin perform public.get_finance_category_report(c,u,options||jsonb_build_object('categoryIds',jsonb_build_array('50000000-0000-4000-8000-000000000099')));raise exception 'foreign category';exception when insufficient_privilege then null;end;
 begin perform public.get_finance_category_report(c,hq,options);raise exception 'wrong scope';exception when insufficient_privilege then null;end;
 begin perform public.get_finance_category_report(c,u,options||jsonb_build_object('cashboxId',hqbox));raise exception 'wrong cashbox';exception when insufficient_privilege then null;end;
 begin perform public.get_finance_category_report('20000000-0000-4000-8000-000000000002','30000000-0000-4000-8000-000000000003',options);raise exception 'tenant leak';exception when insufficient_privilege then null;end;
 perform set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000003',true);
 begin perform public.get_finance_category_report(c,u,options);raise exception 'secretary scope leak';exception when insufficient_privilege then null;end;
 execute 'reset role';
 update public.user_permission_overrides set effect='DENY' where access_id='40000000-0000-4000-8000-000000000002' and permission_id=(select id from public.permissions where key='finance.view' and deleted_at is null) and deleted_at is null;
 execute 'set local role authenticated';
 perform set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000002',true);
 begin perform public.get_finance_category_report(c,u,options);raise exception 'permission override ignored';exception when insufficient_privilege then null;end;
end $$;
reset role;
select pg_temp.assert_true(not has_function_privilege('anon','public.get_finance_category_report(uuid,uuid,jsonb)','execute'),'anonymous denied');
select pg_temp.assert_true((select not prosecdef and provolatile='s' and proconfig @> array['search_path=""'] from pg_proc where oid='public.get_finance_category_report(uuid,uuid,jsonb)'::regprocedure),'invoker stable restricted search path');
rollback;
