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
do $$ declare c uuid:='20000000-0000-4000-8000-000000000001';u uuid:='30000000-0000-4000-8000-000000000001';hq uuid:='30000000-0000-4000-8000-000000000002';m uuid;d uuid;cat uuid;outcat uuid;b uuid;command jsonb;result jsonb;
begin
 m:=(public.save_finance_catalog(c,jsonb_build_object('entity','PAYMENT_METHOD','congregationId',u,'name','Dinheiro','kind','CASH'))->>'id')::uuid;
 d:=(public.save_finance_catalog(c,jsonb_build_object('entity','DEPARTMENT','congregationId',u,'name','Tesouraria','effectiveMonth','2026-10','participatesInBase',true))->>'id')::uuid;
 cat:=(public.save_finance_catalog(c,jsonb_build_object('entity','CATEGORY','congregationId',u,'name','Oferta','direction','INCOME'))->>'id')::uuid;
 outcat:=(public.save_finance_catalog(c,jsonb_build_object('entity','CATEGORY','congregationId',u,'name','Despesa','direction','EXPENSE'))->>'id')::uuid;
 b:=(public.save_finance_catalog(c,jsonb_build_object('entity','CASHBOX','congregationId',u,'name','Caixa','kind','CASH','openingDate','2026-09-01','openingCents',845000,'paymentMethodIds',jsonb_build_array(m)))->>'id')::uuid;
 command:=jsonb_build_object('kind','RECORD','congregationId',u,'mode','SINGLE','direction','INCOME','date','2026-10-01','cashboxId',b,'paymentMethodId',m,'contributor',jsonb_build_object('kind','COLLECTIVE'),'items',jsonb_build_array(jsonb_build_object('categoryId',cat,'departmentId',d,'amountCents',72000,'description','Oferta mensal')));
 for i in 1..25 loop perform public.execute_finance_command(c,command||jsonb_build_object('operationKey',gen_random_uuid()));end loop;
 perform public.execute_finance_command(c,command||jsonb_build_object('operationKey',gen_random_uuid(),'direction','EXPENSE','items',jsonb_build_array(jsonb_build_object('categoryId',outcat,'departmentId',d,'amountCents',244000))));
 result:=public.get_finance_overview(c,u,'2026-10');
 perform pg_temp.assert_true((result->>'openingCents')::numeric=845000 and (result->>'incomeCents')::numeric=1800000 and (result->>'expenseCents')::numeric=244000 and (result->>'closingCents')::numeric=2401000,'overview reconciles historical ledger');
 result:=public.list_finance_transactions(c,u,'{"month":"2026-10","direction":"INCOME","page":1}'::jsonb);
 perform pg_temp.assert_true((result->>'totalCount')::int=25 and jsonb_array_length(result->'items')=20 and (result->>'filteredIncomeCents')::numeric=1800000,'totals cover every matching record, pagination20');
 perform public.execute_finance_command(c,command||jsonb_build_object('operationKey',gen_random_uuid(),'date','2026-11-01'));
 perform pg_temp.assert_true((public.get_finance_overview(c,u,'2026-10')->>'closingCents')::numeric=2401000,'later movement does not change past balance');
 perform public.save_finance_catalog(c,jsonb_build_object('entity','CASHBOX','congregationId',hq,'name','Abertura no mês','kind','CASH','openingDate','2026-10-15','openingCents',10000,'paymentMethodIds',jsonb_build_array(m)));
 result:=public.get_finance_overview(c,hq,'2026-10');
 perform pg_temp.assert_true((result->>'openingCents')::numeric=0 and (result->>'openingMovementCents')::numeric=10000 and (result->>'incomeCents')::numeric=0 and (result->>'closingCents')::numeric=10000,'midmonth opening shown separately');
 perform public.execute_finance_command(c,jsonb_build_object('kind','ADJUST_BALANCE','congregationId',u,'operationKey',gen_random_uuid(),'cashboxId',b,'date','2026-10-03','amountCents',-100,'reason','Ajuste de teste'));
 result:=public.get_finance_overview(c,u,'2026-10');
 perform pg_temp.assert_true((result->>'adjustmentCents')::numeric=-100 and (result->>'expenseCents')::numeric=244000,'adjustments excluded from expenses');
 perform set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000002',true);
 begin perform public.get_finance_overview(c,hq,'2026-10');raise exception 'expected denial';exception when raise_exception then if sqlerrm<>'FORBIDDEN' then raise;end if;end;
end;$$;
rollback;
