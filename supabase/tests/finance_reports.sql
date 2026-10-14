begin;
create function pg_temp.assert_true(value boolean,message text) returns void language plpgsql as $$ begin if value is distinct from true then raise exception '%',message;end if;end;$$;
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
do $$ declare c uuid:='20000000-0000-4000-8000-000000000001'; u uuid:='30000000-0000-4000-8000-000000000001'; m uuid; d uuid; cat uuid; expense uuid; b uuid; b2 uuid; k uuid; command jsonb; a jsonb; s jsonb; saved jsonb; tx uuid; started timestamptz;
begin
 m:=(public.save_finance_catalog(c,jsonb_build_object('entity','PAYMENT_METHOD','congregationId',u,'name','Dinheiro','kind','CASH'))->>'id')::uuid;
 d:=(public.save_finance_catalog(c,jsonb_build_object('entity','DEPARTMENT','congregationId',u,'name','Missões','effectiveMonth','2026-10','participatesInBase',false))->>'id')::uuid;
 cat:=(public.save_finance_catalog(c,jsonb_build_object('entity','CATEGORY','congregationId',u,'name','Oferta','direction','INCOME'))->>'id')::uuid;
 expense:=(public.save_finance_catalog(c,jsonb_build_object('entity','CATEGORY','congregationId',u,'name','Despesa','direction','EXPENSE'))->>'id')::uuid;
 k:=(public.save_finance_catalog(c,jsonb_build_object('entity','CLASSIFICATION','congregationId',u,'name','Presbíteros'))->>'id')::uuid;
 b:=(public.save_finance_catalog(c,jsonb_build_object('entity','CASHBOX','congregationId',u,'name','Caixa anterior','kind','CASH','openingDate','2026-09-01','openingCents',100000,'paymentMethodIds',jsonb_build_array(m)))->>'id')::uuid;
 b2:=(public.save_finance_catalog(c,jsonb_build_object('entity','CASHBOX','congregationId',u,'name','Caixa novo','kind','CASH','openingDate','2026-10-01','openingCents',20000,'paymentMethodIds',jsonb_build_array(m)))->>'id')::uuid;
 command:=jsonb_build_object('kind','RECORD','congregationId',u,'mode','SINGLE','direction','INCOME','date','2026-10-02','cashboxId',b,'paymentMethodId',m,'contributor',jsonb_build_object('kind','COLLECTIVE'),'items',jsonb_build_array(jsonb_build_object('categoryId',cat,'departmentId',d,'amountCents',40000,'titheClassificationId',k,'description','Oferta teste')));
 perform public.execute_finance_command(c,command||jsonb_build_object('operationKey',gen_random_uuid()));
 perform public.execute_finance_command(c,command||jsonb_build_object('operationKey',gen_random_uuid(),'cashboxId',b2,'items',jsonb_build_array(jsonb_build_object('categoryId',cat,'departmentId',d,'amountCents',62000,'titheClassificationId',k))));
 perform public.execute_finance_command(c,command||jsonb_build_object('operationKey',gen_random_uuid(),'items',jsonb_build_array(jsonb_build_object('categoryId',cat,'departmentId',d,'amountCents',48000))));
 perform public.execute_finance_command(c,command||jsonb_build_object('operationKey',gen_random_uuid(),'direction','EXPENSE','items',jsonb_build_array(jsonb_build_object('categoryId',expense,'departmentId',d,'amountCents',60000))));
 perform public.execute_finance_command(c,jsonb_build_object('kind','ADJUST_BALANCE','congregationId',u,'operationKey',gen_random_uuid(),'cashboxId',b,'date','2026-10-03','amountCents',-5000,'reason','Ajuste fictício'));
 execute 'set local role authenticated';
 a:=public.get_finance_report(c,u,'{"type":"ANALYTIC","month":"2026-10"}');
 s:=public.get_finance_report(c,u,'{"type":"SYNTHETIC","month":"2026-10"}');
 perform pg_temp.assert_true(a->'summary'=s->'summary','matching totals');
 perform pg_temp.assert_true((a#>>'{summary,closingCents}')::numeric=205000,'closing reconciles');
 perform pg_temp.assert_true((a#>>'{summary,incomeCents}')::numeric=150000,'all departments included');
 perform pg_temp.assert_true(jsonb_array_length(a->'rows')=4,'complete analytic');
 perform pg_temp.assert_true((select count(distinct x->>'cashboxId')=2 from jsonb_array_elements(a->'rows') x),'analytic rows identify each cashbox');
 perform pg_temp.assert_true((select sum((x->>'amountCents')::numeric)=62000 from jsonb_array_elements(a->'rows') x where x->>'cashboxId'=b2::text),'cashbox identity preserves per-box amounts');
 perform pg_temp.assert_true(not (s ? 'rows'),'no individual rows in synthetic');
 perform pg_temp.assert_true(exists(select 1 from jsonb_array_elements(s->'categories') x where x->>'classificationName'='Presbíteros' and (x->>'amountCents')::numeric=102000),'classification consolidated between cashboxes');
 perform set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000002',true);
 perform public.get_finance_report(c,u,'{"type":"SYNTHETIC","month":"2026-10"}');
 begin
  perform public.get_finance_report(c,'30000000-0000-4000-8000-000000000002','{"type":"SYNTHETIC","month":"2026-10"}');
  raise exception 'scope leak';
 exception when insufficient_privilege then null;end;
 begin
  perform public.get_finance_report('20000000-0000-4000-8000-000000000002','30000000-0000-4000-8000-000000000003','{"type":"SYNTHETIC","month":"2026-10"}');
  raise exception 'tenant leak';
 exception when insufficient_privilege then null;end;

 perform set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000001',true);
 saved:=public.execute_finance_command(c,jsonb_build_object('kind','TRANSFER','operationKey',gen_random_uuid(),'congregationId',u,'date','2026-10-03','sourceCashboxId',b,'targetCashboxId',b2,'amountCents',30000,'description','Transferência fictícia'));
 a:=public.get_finance_report(c,u,'{"type":"ANALYTIC","month":"2026-10"}');
 perform pg_temp.assert_true((a#>>'{summary,closingCents}')::numeric=205000 and (a#>>'{summary,incomeCents}')::numeric=150000,'internal transfer leaves income and consolidated balance unchanged');
 s:=public.get_finance_report(c,u,jsonb_build_object('type','SYNTHETIC','month','2026-10','cashboxId',b));
 perform pg_temp.assert_true((s#>>'{summary,transferNetCents}')::numeric=-30000 and (s#>>'{summary,closingCents}')::numeric=93000,'source box transfer signed and reconciled');
 perform public.execute_finance_command(c,jsonb_build_object('kind','CANCEL_TRANSFER','operationKey',gen_random_uuid(),'congregationId',u,'id',saved->>'transferId','expectedRevision',1,'reason','Cancelar transferência fictícia'));
 s:=public.get_finance_report(c,u,jsonb_build_object('type','SYNTHETIC','month','2026-10','cashboxId',b));
 perform pg_temp.assert_true((s#>>'{summary,transferNetCents}')::numeric=0,'cancelled transfer reverses original effect');
 saved:=public.execute_finance_command(c,command||jsonb_build_object('operationKey',gen_random_uuid(),'date','2026-11-01'));
 tx:=(saved#>>'{transactionIds,0}')::uuid;
 perform pg_temp.assert_true((public.get_finance_report(c,u,'{"type":"SYNTHETIC","month":"2026-10"}')#>>'{summary,closingCents}')::numeric=205000,'future transaction does not affect historical closing');
 perform public.execute_finance_command(c,jsonb_build_object('kind','CORRECT_TRANSACTION','operationKey',gen_random_uuid(),'congregationId',u,'id',tx,'expectedRevision',1,'reason','Correção fictícia de mês e caixa','replacement',jsonb_build_object('direction','INCOME','date','2026-10-06','cashboxId',b2,'paymentMethodId',m,'contributor',command->'contributor','item',jsonb_build_object('categoryId',cat,'departmentId',d,'amountCents',10000))));
 perform pg_temp.assert_true((public.get_finance_report(c,u,'{"type":"SYNTHETIC","month":"2026-10"}')#>>'{summary,closingCents}')::numeric=215000,'corrected month and box represented once');
 perform public.execute_finance_command(c,jsonb_build_object('kind','CANCEL_TRANSACTION','operationKey',gen_random_uuid(),'congregationId',u,'id',tx,'expectedRevision',2,'reason','Cancelar lançamento fictício'));
 perform pg_temp.assert_true((public.get_finance_report(c,u,'{"type":"SYNTHETIC","month":"2026-10"}')#>>'{summary,closingCents}')::numeric=205000,'cancelled transaction excluded and balance reversed');
 execute 'reset role';
 update public.financial_categories set name='Oferta renomeada' where church_id=c and id=cat;
 update public.financial_cashboxes set status='INACTIVE' where church_id=c and id=b;
 execute 'set local role authenticated';
 a:=public.get_finance_report(c,u,'{"type":"ANALYTIC","month":"2026-10"}');
 perform pg_temp.assert_true(a->'rows'->0->>'categoryName'<>'Oferta renomeada','historical category name retained');
 perform pg_temp.assert_true(jsonb_array_length(a->'cashboxes')=2,'inactive cashbox retained');
 s:=public.get_finance_report(c,u,'{"type":"SYNTHETIC","month":"2026-12"}');
 perform pg_temp.assert_true((s#>>'{summary,count}')::int=0 and (s#>>'{summary,openingCents}')::numeric=205000,'empty month retains prior balance');
 execute 'reset role';
 -- Current bank metadata is scoped to the reported cashbox; local cashboxes omit it.
 update public.financial_cashboxes set cashbox_type='BANK_ACCOUNT',bank_name='Banco Exemplo',agency='0001',account_number='12345-6' where church_id=c and id=b2;
 execute 'set local role authenticated';
 a:=public.get_finance_report(c,u,'{"type":"ANALYTIC","month":"2026-10"}');
 perform pg_temp.assert_true(exists(select 1 from jsonb_array_elements(a->'cashboxes') x where x->>'id'=b2::text and x#>>'{bankDetails,agency}'='0001' and x#>>'{bankDetails,accountNumber}'='12345-6'),'bank details in analytic');
 perform pg_temp.assert_true(exists(select 1 from jsonb_array_elements(a->'cashboxes') x where x->>'id'=b::text and x->'bankDetails'='null'::jsonb),'local cashbox has no bank details');
 s:=public.get_finance_report(c,u,'{"type":"SYNTHETIC","month":"2026-10"}');
 perform pg_temp.assert_true(not exists(select 1 from jsonb_array_elements(s->'cashboxes') x where x ? 'bankDetails'),'synthetic projection unchanged');
 execute 'reset role';
 -- Bulk fictional rows to exercise >1,000 records without PostgREST truncation.
 with added as (
 insert into public.financial_transactions(church_id,congregation_id,category_id,department_id,cashbox_id,payment_method_id,transaction_type,amount,transaction_date,status,category_name,department_name,contributor_kind)
 select c,u,cat,d,b2,m,'INCOME',1,'2026-10-07','CONFIRMED','Oferta','Missões','COLLECTIVE' from generate_series(1,1001) returning id
 ) insert into public.financial_ledger_entries(church_id,congregation_id,cashbox_id,transaction_id,entry_kind,amount,financial_date)
 select c,u,b2,id,'TRANSACTION',1,'2026-10-07' from added;
 execute 'set local role authenticated';
 a:=public.get_finance_report(c,u,'{"type":"ANALYTIC","month":"2026-10"}');
 perform pg_temp.assert_true(jsonb_array_length(a->'rows')=1005,'all 1005 rows exported beyond UI and API page sizes');
 execute 'reset role';
 with added as (
 insert into public.financial_transactions(church_id,congregation_id,category_id,department_id,cashbox_id,payment_method_id,transaction_type,amount,transaction_date,status,category_name,department_name,contributor_kind)
 select c,u,cat,d,b2,m,'INCOME',1,'2026-10-07','CONFIRMED','Oferta','Missões','COLLECTIVE' from generate_series(1,8990) returning id
 ) insert into public.financial_ledger_entries(church_id,congregation_id,cashbox_id,transaction_id,entry_kind,amount,financial_date)
 select c,u,b2,id,'TRANSACTION',1,'2026-10-07' from added;
 -- 9,995 transactions + 2 auxiliary movements + 1 department + 2 boxes = 10,000 printable rows.
 execute 'set local role authenticated';
 started:=clock_timestamp();
 a:=public.get_finance_report(c,u,'{"type":"ANALYTIC","month":"2026-10"}');
 raise notice '9995 row report query milliseconds: %',extract(epoch from clock_timestamp()-started)*1000;
 perform pg_temp.assert_true(clock_timestamp()-started<interval '8 seconds','large report fits authenticated database timeout');
 perform pg_temp.assert_true(jsonb_array_length(a->'rows')=9995,'exact printable limit accepted');
 execute 'reset role';
 with added as (
 insert into public.financial_transactions(church_id,congregation_id,category_id,department_id,cashbox_id,payment_method_id,transaction_type,amount,transaction_date,status,category_name,department_name,contributor_kind)
 values(c,u,cat,d,b2,m,'INCOME',1,'2026-10-07','CONFIRMED','Oferta','Missões','COLLECTIVE') returning id
 ) insert into public.financial_ledger_entries(church_id,congregation_id,cashbox_id,transaction_id,entry_kind,amount,financial_date)
 select c,u,b2,id,'TRANSACTION',1,'2026-10-07' from added;
 execute 'set local role authenticated';
 begin perform public.get_finance_report(c,u,'{"type":"ANALYTIC","month":"2026-10"}');raise exception 'silent truncation';exception when raise_exception then if sqlerrm<>'REPORT_TOO_LARGE' then raise;end if;end;
 s:=public.get_finance_report(c,u,'{"type":"SYNTHETIC","month":"2026-10"}');
 perform pg_temp.assert_true((s#>>'{summary,count}')::int=9996,'synthetic aggregates beyond analytic limit');
 execute 'reset role';
 insert into public.financial_transactions(church_id,congregation_id,category_id,cashbox_id,transaction_type,amount,transaction_date,status) values(c,u,cat,b2,'INCOME',1,'2026-10-07','CONFIRMED');
 execute 'set local role authenticated';
 begin perform public.get_finance_report(c,u,'{"type":"SYNTHETIC","month":"2026-10"}');raise exception 'missing ledger ignored';exception when raise_exception then if sqlerrm<>'REPORT_RECONCILIATION_REQUIRED' then raise;end if;end;
end $$;
reset role;
select pg_temp.assert_true(not has_function_privilege('anon','public.get_finance_report(uuid,uuid,jsonb)','execute'),'anon denied');
rollback;
