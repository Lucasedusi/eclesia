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
set local role authenticated;
do $$ declare
 c uuid:='20000000-0000-4000-8000-000000000001';u uuid:='30000000-0000-4000-8000-000000000001';hq uuid:='30000000-0000-4000-8000-000000000002';
 method uuid;dep uuid;prebend uuid;repasse uuid;box uuid;hqbox uuid;bank uuid;pix uuid;tx uuid;aid uuid;batch uuid;line uuid;
 p jsonb;r jsonb;q jsonb;report jsonb;options jsonb;invalid jsonb;before_count bigint;
begin
 method:=(public.save_finance_catalog(c,jsonb_build_object('entity','PAYMENT_METHOD','congregationId',u,'name','Dinheiro','kind','CASH'))->>'id')::uuid;
 dep:=(public.save_finance_catalog(c,jsonb_build_object('entity','DEPARTMENT','congregationId',u,'name','Tesouraria','effectiveMonth','2026-10','participatesInBase',true,'reason','Configuração fictícia inicial'))->>'id')::uuid;
 prebend:=(public.save_finance_catalog(c,jsonb_build_object('entity','CATEGORY','congregationId',u,'name','Prebenda','direction','EXPENSE','departmentId',dep,'informativeRole','PREBEND'))->>'id')::uuid;
 repasse:=(public.save_finance_catalog(c,jsonb_build_object('entity','CATEGORY','congregationId',u,'name','Repasse','direction','BOTH','departmentId',dep,'informativeRole','TRANSFER'))->>'id')::uuid;
 box:=(public.save_finance_catalog(c,jsonb_build_object('entity','CASHBOX','congregationId',u,'name','Caixa','kind','CASH','openingDate','2026-01-01','openingCents',0,'paymentMethodIds',jsonb_build_array(method)))->>'id')::uuid;
 hqbox:=(public.save_finance_catalog(c,jsonb_build_object('entity','CASHBOX','congregationId',hq,'name','Caixa','kind','CASH','openingDate','2026-01-01','openingCents',0,'paymentMethodIds',jsonb_build_array(method)))->>'id')::uuid;
 p:=jsonb_build_object('kind','RECORD','operationKey',gen_random_uuid(),'congregationId',hq,'mode','SINGLE','direction','INCOME','date','2026-11-05','referenceMonth','2026-10','cashboxId',hqbox,'paymentMethodId',method,'contributor',jsonb_build_object('kind','CONGREGATION','congregationId',u),'items',jsonb_build_array(jsonb_build_object('categoryId',repasse,'departmentId',dep,'amountCents',50000)));
 r:=public.execute_finance_command(c,p);tx:=(r#>>'{transactionIds,0}')::uuid;
 perform pg_temp.assert_true((select reference_year=2026 and reference_month=10 and transaction_date='2026-11-05' from public.financial_transactions where id=tx),'Reference October persists independently of November receipt');
 perform pg_temp.assert_true((public.execute_finance_command(c,p)->>'replayed')::boolean,'New reference command is idempotent');
 perform pg_temp.assert_true((select count(*)=1 and min(financial_date)='2026-11-05' from public.financial_ledger_entries where transaction_id=tx),'Ledger uses movement date exactly once');
 perform pg_temp.assert_true((public.get_finance_overview(c,hq,'2026-10')->>'incomeCents')::numeric=0 and (public.get_finance_overview(c,hq,'2026-11')->>'incomeCents')::numeric=50000,'Cash overview uses November');
 perform pg_temp.assert_true((public.list_finance_transactions(c,hq,'{"month":"2026-10"}')->>'totalCount')::int=0 and (public.list_finance_transactions(c,hq,'{"month":"2026-11"}')->>'totalCount')::int=1,'Transaction filters use movement month');
 perform public.execute_finance_command(c,p||jsonb_build_object('operationKey',gen_random_uuid(),'congregationId',u,'cashboxId',box,'direction','EXPENSE','contributor',jsonb_build_object('kind','ORGANIZATION','name','Pastor fictício'),'items',jsonb_build_array(jsonb_build_object('categoryId',prebend,'departmentId',dep,'amountCents',100000))));
 options:='{"type":"INFORMATIVE","startMonth":"2026-10","endMonth":"2026-11","includePrebend":true,"includeTransfer":true}';
 report:=public.get_finance_informative_report(c,u,options);
 perform pg_temp.assert_true((report#>>'{months,0,recorded,transferCents}')::numeric=0 and (report#>>'{months,0,recorded,grossPrebendCents}')::numeric=0,'Individual informative has no October movements');
 perform pg_temp.assert_true((report#>>'{months,1,recorded,transferCents}')::numeric=50000 and (report#>>'{months,1,recorded,grossPrebendCents}')::numeric=100000,'Individual informative keeps both values in November');
 report:=public.get_finance_ranking_report(c,options||'{"type":"RANKING","includeInactive":false}');
 select x->'report' into report from jsonb_array_elements(report->'units') x where x->>'id'=u::text;
 perform pg_temp.assert_true((report#>>'{months,0,recorded,transferCents}')::numeric=0 and (report#>>'{months,0,recorded,grossPrebendCents}')::numeric=0 and (report#>>'{months,1,recorded,transferCents}')::numeric=50000 and (report#>>'{months,1,recorded,grossPrebendCents}')::numeric=100000,'General informative also uses November');
 -- Corrections retain an omitted reference (old clients) and explicitly change it with audit.
 q:=jsonb_build_object('kind','CORRECT_TRANSACTION','operationKey',gen_random_uuid(),'congregationId',hq,'id',tx,'expectedRevision',1,'reason','Conferência da referência','replacement',(p-'kind'-'mode'-'operationKey'-'congregationId'-'items'-'referenceMonth')||jsonb_build_object('item',p#>'{items,0}'));
 perform public.execute_finance_command(c,q);
 perform pg_temp.assert_true((select reference_month=10 from public.financial_transactions where id=tx),'Legacy correction preserves saved reference');
 perform public.execute_finance_command(c,jsonb_set(q,'{replacement,referenceMonth}','"2026-09"')||jsonb_build_object('operationKey',gen_random_uuid(),'expectedRevision',2));
 perform pg_temp.assert_true((select previous_values->>'reference_month'='10' and new_values->>'reference_month'='9' from public.financial_transaction_revisions where transaction_id=tx and revision=3),'Reference correction is audited');
 -- Invalid direct RPC input rolls back operation and ledger writes.
 select count(*) into before_count from public.financial_operations where church_id=c;
 for invalid in select value from jsonb_array_elements('[null,"","2026-00","2026-13","1999-12","2100-01","2026-10-01",202610,{}]') loop
  begin perform public.execute_finance_command(c,p||jsonb_build_object('operationKey',gen_random_uuid(),'referenceMonth',invalid)); raise exception 'Invalid reference accepted'; exception when invalid_parameter_value then null; end;
 end loop;
 perform pg_temp.assert_true((select count(*)=before_count from public.financial_operations where church_id=c),'Invalid reference creates no operation');
 r:=public.execute_finance_command(c,(p-'referenceMonth')||jsonb_build_object('operationKey',gen_random_uuid()));
 perform pg_temp.assert_true((select reference_month=11 from public.financial_transactions where id=(r#>>'{transactionIds,0}')::uuid),'Legacy new command defaults to movement month');
 -- One reference for all new attendance items, independently editable per item later.
 r:=public.execute_finance_command(c,p||jsonb_build_object('operationKey',gen_random_uuid(),'mode','ATTENDANCE','items',(p->'items')||(p->'items')));aid:=(r->>'attendanceId')::uuid;
 perform pg_temp.assert_true((select count(*)=2 and bool_and(reference_month=10) from public.financial_transactions where attendance_id=aid),'Attendance saves reference on every item');
 q:=jsonb_set(q,'{id}',r#>'{transactionIds,0}')||jsonb_build_object('operationKey',gen_random_uuid());
 perform public.execute_finance_command(c,jsonb_set(q,'{replacement,referenceMonth}','"2026-08"'));
 perform pg_temp.assert_true((select count(*)=1 from public.financial_transactions where attendance_id=aid and reference_month=8),'Attendance item correction changes only its informational reference');
 -- Bank source date stays immutable while reference is independent.
 pix:=(public.save_finance_catalog(c,jsonb_build_object('entity','PAYMENT_METHOD','congregationId',hq,'name','Pix','kind','PIX'))->>'id')::uuid;
 bank:=(public.save_finance_catalog(c,jsonb_build_object('entity','CASHBOX','congregationId',hq,'name','Banco','kind','BANK_ACCOUNT','openingDate','2026-01-01','openingCents',0,'paymentMethodIds',jsonb_build_array(pix)))->>'id')::uuid;
 r:=public.prepare_finance_bank_import(c,hq,bank,repeat('c',64),'referencia.xlsx',jsonb_build_object('parserVersion','SICOOB_XLSX_V1','reconciliation','UNAVAILABLE','balances','[]'::jsonb,'rows',jsonb_build_array(jsonb_build_object('rowNumber',3,'date','2026-11-05','document','PIX','history','PIX RECEBIDO','complement','Referência fictícia','amountCents',50000))));
 batch:=(r->>'id')::uuid;select id into line from public.finance_bank_import_items where batch_id=batch;
 r:=public.finance_bank_import_item(c,hq,line,1,gen_random_uuid(),'POST',jsonb_build_object('command',p||jsonb_build_object('cashboxId',bank,'paymentMethodId',pix)));
 perform pg_temp.assert_true((select reference_month=10 and transaction_date='2026-11-05' and source_type='IMPORT' from public.financial_transactions where id=(r#>>'{result,transactionIds,0}')::uuid),'Bank import preserves reference and original date');
 -- Existing permission/tenant/scope boundaries remain effective.
 begin perform public.execute_finance_command('20000000-0000-4000-8000-000000000002',p||jsonb_build_object('operationKey',gen_random_uuid())); raise exception 'Tenant leak'; exception when insufficient_privilege then null; end;
 perform set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000002',true);
 begin perform public.execute_finance_command(c,p||jsonb_build_object('operationKey',gen_random_uuid())); raise exception 'Scope leak'; exception when insufficient_privilege then null; end;
 perform set_config('request.jwt.claim.sub','',true);
 begin perform public.execute_finance_command(c,p||jsonb_build_object('operationKey',gen_random_uuid())); raise exception 'Unauthenticated access'; exception when insufficient_privilege then null; end;
end $$;
reset role;
select pg_temp.assert_true(not has_function_privilege('anon','public.execute_finance_command(uuid,jsonb)','execute'),'Anon denied');
select pg_temp.assert_true(not has_function_privilege('authenticated','private.finance_write_item_with_source(uuid,uuid,uuid,jsonb,jsonb,uuid,uuid,text,text)','execute'),'Private writer stays private');
select pg_temp.assert_true((select proconfig @> array['search_path=""'] from pg_proc where oid='private.finance_write_item_with_source(uuid,uuid,uuid,jsonb,jsonb,uuid,uuid,text,text)'::regprocedure),'Writer has empty search path');
rollback;
