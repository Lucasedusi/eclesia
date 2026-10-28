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
 method uuid;dep uuid;cat uuid;prebend uuid;repasse uuid;box uuid;hqbox uuid;report jsonb;command jsonb;receipt jsonb;result jsonb;options jsonb;
 before_report jsonb;before_count bigint;tx uuid;
begin
 execute 'set local role authenticated';
 options:='{"type":"INFORMATIVE","startMonth":"2026-09","endMonth":"2026-11","includePrebend":true,"includeTransfer":true}';
 begin perform public.get_finance_informative_report(c,u,options);raise exception 'Missing configuration accepted';exception when raise_exception then if sqlerrm<>'REPORT_CONFIGURATION_REQUIRED' then raise;end if;end;
 report:=public.get_finance_informative_report(c,u,options||'{"includePrebend":false,"includeTransfer":false}');
 perform pg_temp.assert_true(report#>'{months,0,recorded,grossPrebendCents}'='null'::jsonb,'Unchecked columns need no category mapping');
 method:=(public.save_finance_catalog(c,jsonb_build_object('entity','PAYMENT_METHOD','congregationId',u,'name','Dinheiro','kind','CASH'))->>'id')::uuid;
 dep:=(public.save_finance_catalog(c,jsonb_build_object('entity','DEPARTMENT','congregationId',u,'name','Tesouraria','effectiveMonth','2026-10','participatesInBase',true))->>'id')::uuid;
 cat:=(public.save_finance_catalog(c,jsonb_build_object('entity','CATEGORY','congregationId',u,'name','Repasse (nome não classifica)','direction','INCOME','departmentId',dep))->>'id')::uuid;
 prebend:=(public.save_finance_catalog(c,jsonb_build_object('entity','CATEGORY','congregationId',u,'name','Prebenda','direction','EXPENSE','departmentId',dep,'informativeRole','PREBEND'))->>'id')::uuid;
 repasse:=(public.save_finance_catalog(c,jsonb_build_object('entity','CATEGORY','congregationId',u,'name','Repasse','direction','BOTH','departmentId',dep,'informativeRole','TRANSFER'))->>'id')::uuid;
 begin perform public.save_finance_catalog(c,jsonb_build_object('entity','CATEGORY','congregationId',u,'name','Inválida','direction','INCOME','informativeRole','PREBEND'));raise exception 'Incompatible role accepted';exception when check_violation then null;end;
 box:=(public.save_finance_catalog(c,jsonb_build_object('entity','CASHBOX','congregationId',u,'name','Caixa','kind','CASH','openingDate','2026-09-01','openingCents',10000,'paymentMethodIds',jsonb_build_array(method)))->>'id')::uuid;
 hqbox:=(public.save_finance_catalog(c,jsonb_build_object('entity','CASHBOX','congregationId',hq,'name','Caixa','kind','CASH','openingDate','2026-09-01','openingCents',0,'paymentMethodIds',jsonb_build_array(method)))->>'id')::uuid;
 command:=jsonb_build_object('kind','RECORD','operationKey',gen_random_uuid(),'congregationId',u,'mode','SINGLE','direction','INCOME','date','2026-10-01','cashboxId',box,'paymentMethodId',method,'contributor',jsonb_build_object('kind','COLLECTIVE'),'items',jsonb_build_array(jsonb_build_object('categoryId',cat,'departmentId',dep,'amountCents',1800000)));
 perform public.execute_finance_command(c,command);
 perform public.execute_finance_command(c,command||jsonb_build_object('operationKey',gen_random_uuid(),'direction','EXPENSE','items',jsonb_build_array(jsonb_build_object('categoryId',prebend,'departmentId',dep,'amountCents',400000))));
 perform public.execute_finance_command(c,command||jsonb_build_object('operationKey',gen_random_uuid(),'direction','EXPENSE','items',jsonb_build_array(jsonb_build_object('categoryId',repasse,'departmentId',dep,'amountCents',100000))));
 receipt:=command||jsonb_build_object('congregationId',hq,'cashboxId',hqbox,'contributor',jsonb_build_object('kind','CONGREGATION','congregationId',u),'items',jsonb_build_array(jsonb_build_object('categoryId',repasse,'departmentId',dep,'amountCents',70000)));
 perform public.execute_finance_command(c,receipt||jsonb_build_object('operationKey',gen_random_uuid()));
 perform public.execute_finance_command(c,receipt||jsonb_build_object('operationKey',gen_random_uuid(),'date','2026-11-01','items',jsonb_build_array(jsonb_build_object('categoryId',repasse,'departmentId',dep,'amountCents',30000))));
 -- A label match and a canceled receipt must not count.
 perform public.execute_finance_command(c,receipt||jsonb_build_object('operationKey',gen_random_uuid(),'items',jsonb_build_array(jsonb_build_object('categoryId',cat,'departmentId',dep,'amountCents',90000))));
 result:=public.execute_finance_command(c,receipt||jsonb_build_object('operationKey',gen_random_uuid())); tx:=(result#>>'{transactionIds,0}')::uuid;
 perform public.execute_finance_command(c,jsonb_build_object('kind','CANCEL_TRANSACTION','congregationId',hq,'id',tx,'expectedRevision',1,'reason','Cancelamento de teste','operationKey',gen_random_uuid()));
 -- Unidentified receipts stay visible only in the general review, never allocated by name.
 perform public.execute_finance_command(c,receipt||jsonb_build_object('operationKey',gen_random_uuid(),'contributor',jsonb_build_object('kind','COLLECTIVE')));
 select count(*) into before_count from public.financial_ledger_entries where church_id=c;
 before_report:=public.get_finance_report(c,u,'{"type":"SYNTHETIC","month":"2026-10"}');
 report:=public.get_finance_informative_report(c,u,options);
 perform pg_temp.assert_true(report->>'source'='TRANSACTIONS','Explicit new contract');
 perform pg_temp.assert_true(jsonb_array_length(report->'months')=3,'Inclusive range');
 perform pg_temp.assert_true((report#>>'{months,0,recorded,transferCents}')::numeric=0,'Empty month equals zero without a statement');
 perform pg_temp.assert_true((report#>>'{months,1,recorded,grossPrebendCents}')::numeric=400000,'Actual gross expense without tithe deduction');
 perform pg_temp.assert_true((report#>>'{months,1,recorded,transferCents}')::numeric=70000,'Partial Cathedral receipt, not the 100000 outgoing payment');
 perform pg_temp.assert_true((report#>>'{months,2,recorded,transferCents}')::numeric=30000,'Receipt month, not outgoing month');
 perform pg_temp.assert_true(report#>'{months,1,summary}'=before_report->'summary','Informative columns never change balances');
 perform pg_temp.assert_true((select count(*)=before_count from public.financial_ledger_entries where church_id=c),'Read does not post ledger entries');
 report:=public.get_finance_informative_report(c,hq,options);
 perform pg_temp.assert_true((report#>>'{months,1,recorded,transferCents}')::numeric=0,'Cathedral row does not duplicate receipts');
 report:=public.get_finance_ranking_report(c,(options||'{"type":"RANKING","includeInactive":false}'));
 perform pg_temp.assert_true((report#>>'{transferReview,receivedCents}')::numeric=170000 and (report#>>'{transferReview,unidentifiedCents}')::numeric=70000,'All valid receipts reconciled, canceled/name match excluded');
 -- Generate an advisory statement with deliberately different amounts, then verify independence.
 perform public.save_finance_statement_rules(c,jsonb_build_object('congregationId',u,'effectiveMonth','2026-10','items','[{"name":"Repasse","destination":"CATHEDRAL","role":"DISTRIBUTION","calculation":"ELIGIBLE_INCOME_PERCENT","percentage":"35"},{"name":"Prebenda","destination":"LOCAL_PASTOR","role":"GROSS_PREBEND","calculation":"ELIGIBLE_INCOME_PERCENT","percentage":"20","capCents":300000}]'::jsonb));
 perform public.generate_finance_statement(c,u,'2026-10',gen_random_uuid());
 report:=public.get_finance_informative_report(c,u,options);
 perform pg_temp.assert_true((report#>>'{months,1,recorded,grossPrebendCents}')::numeric=400000 and (report#>>'{months,1,recorded,transferCents}')::numeric=70000,'Statement generation cannot change actual values');
 perform public.save_finance_catalog(c,jsonb_build_object('entity','CATEGORY','id',repasse,'congregationId',u,'name','Nome novo','direction','BOTH','status','INACTIVE'));
 perform public.save_finance_catalog(c,jsonb_build_object('entity','CATEGORY','id',prebend,'congregationId',u,'name','Outra descrição','direction','EXPENSE','status','INACTIVE'));
 report:=public.get_finance_informative_report(c,u,options);
 perform pg_temp.assert_true((report#>>'{months,1,recorded,transferCents}')::numeric=70000 and (report#>>'{months,1,recorded,grossPrebendCents}')::numeric=400000,'Rename/inactivation keeps classification and history');
 -- Known but inactive payers are explicitly outside the selected ranking, not unidentified.
 execute 'reset role';
 update public.congregations set status='INACTIVE' where id=u;
 execute 'set local role authenticated';
 report:=public.get_finance_ranking_report(c,options||'{"type":"RANKING","includeInactive":false}');
 perform pg_temp.assert_true((report#>>'{transferReview,outsideReportCents}')::numeric=100000 and (report#>>'{transferReview,unidentifiedCents}')::numeric=70000,'Inactive payer remains known and is reconciled outside selection');
 report:=public.get_finance_ranking_report(c,options||'{"type":"RANKING","includeInactive":true}');
 perform pg_temp.assert_true((report#>>'{transferReview,outsideReportCents}')::numeric=0,'Including inactive units restores allocation');
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
