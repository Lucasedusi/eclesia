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

select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000001',true);
do $$ declare
 c uuid:='20000000-0000-4000-8000-000000000001';u uuid:='30000000-0000-4000-8000-000000000001';hq uuid:='30000000-0000-4000-8000-000000000002';
 method uuid;dep uuid;missions uuid;cat uuid;expense_cat uuid;box uuid; rules jsonb;statement jsonb;report jsonb;before_count bigint;november jsonb;retry jsonb;key uuid:=gen_random_uuid();ledger_count integer;tx_count integer;command jsonb;entry_result jsonb;
begin
 method:=(public.save_finance_catalog(c,jsonb_build_object('entity','PAYMENT_METHOD','congregationId',u,'name','Dinheiro','kind','CASH'))->>'id')::uuid;
 dep:=(public.save_finance_catalog(c,jsonb_build_object('entity','DEPARTMENT','congregationId',u,'name','Tesouraria','effectiveMonth','2026-10','participatesInBase',true))->>'id')::uuid;
 missions:=(public.save_finance_catalog(c,jsonb_build_object('entity','DEPARTMENT','congregationId',u,'name','Missões','effectiveMonth','2026-10','participatesInBase',false))->>'id')::uuid;
 cat:=(public.save_finance_catalog(c,jsonb_build_object('entity','CATEGORY','congregationId',u,'name','Oferta','direction','INCOME','departmentId',dep))->>'id')::uuid;
 expense_cat:=(public.save_finance_catalog(c,jsonb_build_object('entity','CATEGORY','congregationId',u,'name','Despesa','direction','EXPENSE','departmentId',dep))->>'id')::uuid;
 box:=(public.save_finance_catalog(c,jsonb_build_object('entity','CASHBOX','congregationId',u,'name','Caixa','kind','CASH','openingDate','2026-09-01','openingCents',10000,'paymentMethodIds',jsonb_build_array(method)))->>'id')::uuid;
 command:=jsonb_build_object('kind','RECORD','operationKey',gen_random_uuid(),'congregationId',u,'mode','SINGLE','direction','INCOME','date','2026-10-01','cashboxId',box,'paymentMethodId',method,'contributor',jsonb_build_object('kind','COLLECTIVE'),'items',jsonb_build_array(jsonb_build_object('categoryId',cat,'departmentId',dep,'amountCents',1500000)));
 entry_result:=public.execute_finance_command(c,command);
 perform public.execute_finance_command(c,command||jsonb_build_object('operationKey',gen_random_uuid(),'items',jsonb_build_array(jsonb_build_object('categoryId',cat,'departmentId',missions,'amountCents',300000))));
 perform public.execute_finance_command(c,command||jsonb_build_object('operationKey',gen_random_uuid(),'direction','EXPENSE','items',jsonb_build_array(jsonb_build_object('categoryId',expense_cat,'departmentId',dep,'amountCents',100000))));
 rules:='[
 {"name":"Repasse","destination":"CATHEDRAL","role":"DISTRIBUTION","calculation":"ELIGIBLE_INCOME_PERCENT","percentage":"35"},
 {"name":"Prebenda","destination":"LOCAL_PASTOR","role":"GROSS_PREBEND","capCents":400000,"calculation":"ELIGIBLE_INCOME_PERCENT","percentage":"35"},
 {"name":"Dízimo da prebenda","destination":"CATHEDRAL","role":"PREBEND_DEDUCTION","calculation":"GROSS_PREBEND_PERCENT","percentage":"10"},
 {"name":"Sistema","destination":"CATHEDRAL","role":"DISTRIBUTION","calculation":"FIXED","amountCents":2500},
 {"name":"Seguro","destination":"CATHEDRAL","role":"DISTRIBUTION","calculation":"FIXED","amountCents":8600},
 {"name":"Contador","destination":"CATHEDRAL","role":"DISTRIBUTION","calculation":"FIXED","amountCents":15000}]'::jsonb;
 begin perform public.generate_finance_statement(c,u,'2026-10',key);raise exception 'expected missing configuration';exception when raise_exception then if sqlerrm<>'CONFIGURATION_REQUIRED' then raise;end if;end;
 perform public.save_finance_statement_rules(c,jsonb_build_object('congregationId',u,'effectiveMonth','2026-10','items',rules));
 select count(*) into ledger_count from public.financial_ledger_entries where church_id=c;select count(*) into tx_count from public.financial_transactions where church_id=c;
 statement:=public.generate_finance_statement(c,u,'2026-10',key);

 execute 'set local role authenticated';
 report:=public.get_finance_informative_report(c,u,'{"type":"INFORMATIVE","startMonth":"2026-09","endMonth":"2026-11","includePrebend":true,"includeTransfer":true}');
 perform pg_temp.assert_true(jsonb_array_length(report->'months')=3,'inclusive range includes empty months');
 perform pg_temp.assert_true(report#>>'{months,0,month}'='2026-09' and report#>>'{months,2,month}'='2026-11','chronological order');
 perform pg_temp.assert_true(report#>'{months,0,statement}'='null'::jsonb,'absent statement is not zero');
 perform pg_temp.assert_true((report#>>'{months,1,statement,grossPrebendCents}')::numeric=400000,'capped gross before deduction');
 perform pg_temp.assert_true((report#>>'{months,1,statement,transferCents}')::numeric=525000,'only percentage on eligible income; no fixed fees or prebend tithe');
 perform pg_temp.assert_true((report#>>'{months,1,summary,incomeCents}')::numeric=1800000,'all departments in income');
 perform pg_temp.assert_true((report#>>'{months,1,summary,closingCents}')::numeric=1710000,'calculated amounts do not reduce balances');
 perform pg_temp.assert_true((report#>>'{months,2,summary,openingCents}')::numeric=1710000 and (report#>>'{months,2,summary,incomeCents}')::numeric=0,'empty month retains balance');
 perform pg_temp.assert_true(not (report#>'{months,1,statement}') ? 'sources','no unnecessary individual data');
 select count(*) into before_count from public.report_delivery_versions where church_id=c;
 report:=public.get_finance_informative_report(c,u,'{"type":"INFORMATIVE","startMonth":"2026-09","endMonth":"2026-11","includePrebend":false,"includeTransfer":false}');
 perform pg_temp.assert_true(report#>'{months,1,statement}'='null'::jsonb,'optional columns skip statement reads');
 perform pg_temp.assert_true((select count(*)=before_count from public.report_delivery_versions where church_id=c),'read does not generate versions');
 perform public.execute_finance_command(c,command||jsonb_build_object('operationKey',gen_random_uuid(),'items',jsonb_build_array(jsonb_build_object('categoryId',cat,'departmentId',dep,'amountCents',10000))));
 report:=public.get_finance_informative_report(c,u,'{"type":"INFORMATIVE","startMonth":"2026-10","endMonth":"2026-10","includePrebend":true,"includeTransfer":true}');
 perform pg_temp.assert_true((report#>>'{months,0,statement,stale}')::boolean,'stale statement visibly marked');
 perform pg_temp.assert_true((report#>>'{months,0,statement,transferCents}')::numeric=525000,'historical calculation preserved');
 perform public.generate_finance_statement(c,u,'2026-10',gen_random_uuid());
 report:=public.get_finance_informative_report(c,u,'{"type":"INFORMATIVE","startMonth":"2026-10","endMonth":"2026-10","includePrebend":false,"includeTransfer":true}');
 perform pg_temp.assert_true((report#>>'{months,0,statement,transferCents}')::numeric=528500 and not (report#>>'{months,0,statement,stale}')::boolean,'latest version selected');
 perform pg_temp.assert_true(report#>'{months,0,statement,grossPrebendCents}'='null'::jsonb,'unchecked column omitted');
 for report in select value from jsonb_array_elements('[
 {"type":"INFORMATIVE","startMonth":"2026-11","endMonth":"2026-10","includePrebend":true,"includeTransfer":true},
 {"type":"INFORMATIVE","startMonth":"2026-99","endMonth":"2026-10","includePrebend":true,"includeTransfer":true},
 {"type":"INFORMATIVE","startMonth":"2000-01","endMonth":"2099-12","includePrebend":true,"includeTransfer":true},
 {"type":"INFORMATIVE","startMonth":"2026-10","endMonth":"2026-10","includePrebend":"false","includeTransfer":true}
 ]'::jsonb) loop
  begin perform public.get_finance_informative_report(c,u,report);raise exception 'invalid range accepted';exception when invalid_parameter_value then null;end;
 end loop;
 begin perform public.get_finance_informative_report('20000000-0000-4000-8000-000000000002','30000000-0000-4000-8000-000000000003','{}');raise exception 'tenant leak';exception when insufficient_privilege then null;end;
 begin perform public.get_finance_informative_report(c,'30000000-0000-4000-8000-000000000003','{}');raise exception 'resource leak';exception when insufficient_privilege then null;end;
 for report in select to_jsonb(x) from unnest(array['10000000-0000-4000-8000-000000000002','10000000-0000-4000-8000-000000000003','10000000-0000-4000-8000-000000000004']) x loop
  perform set_config('request.jwt.claim.sub',report#>>'{}',true);
  begin perform public.get_finance_informative_report(c,u,'{}');raise exception 'non-admin access';exception when insufficient_privilege then null;end;
 end loop;
end $$;
reset role;
select pg_temp.assert_true(not has_function_privilege('anon','public.get_finance_informative_report(uuid,uuid,jsonb)','execute'),'anon denied');
select pg_temp.assert_true((select not prosecdef and provolatile='s' and proconfig @> array['search_path=""'] from pg_proc where oid='public.get_finance_informative_report(uuid,uuid,jsonb)'::regprocedure),'invoker stable with empty search path');
rollback;
