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
 c uuid:='20000000-0000-4000-8000-000000000001';u uuid:='30000000-0000-4000-8000-000000000001';
 method uuid;dep uuid;missions uuid;cat uuid;tithe uuid;class uuid;box uuid;target uuid;
 p jsonb;r jsonb;again jsonb;single_result jsonb;corrected jsonb;transferred jsonb;tx uuid;old_receipt uuid;before_balance numeric;
begin
 method:=(public.save_finance_catalog(c,jsonb_build_object('entity','PAYMENT_METHOD','congregationId',u,'name','Dinheiro','kind','CASH'))->>'id')::uuid;
 dep:=(public.save_finance_catalog(c,jsonb_build_object('entity','DEPARTMENT','congregationId',u,'name','Tesouraria','effectiveMonth','2026-10','participatesInBase',true))->>'id')::uuid;
 missions:=(public.save_finance_catalog(c,jsonb_build_object('entity','DEPARTMENT','congregationId',u,'name','Missões','effectiveMonth','2026-10','participatesInBase',false))->>'id')::uuid;
 cat:=(public.save_finance_catalog(c,jsonb_build_object('entity','CATEGORY','congregationId',u,'name','Oferta','direction','INCOME','departmentId',dep))->>'id')::uuid;
 tithe:=(public.save_finance_catalog(c,jsonb_build_object('entity','CATEGORY','congregationId',u,'name','Dízimo','direction','INCOME','isTithe',true,'departmentId',dep))->>'id')::uuid;
 class:=(public.save_finance_catalog(c,jsonb_build_object('entity','CLASSIFICATION','congregationId',u,'name','Diácono'))->>'id')::uuid;
 box:=(public.save_finance_catalog(c,jsonb_build_object('entity','CASHBOX','congregationId',u,'name','Caixa','kind','CASH','openingDate','2026-09-01','openingCents',0,'paymentMethodIds',jsonb_build_array(method)))->>'id')::uuid;
 target:=(public.save_finance_catalog(c,jsonb_build_object('entity','CASHBOX','congregationId',u,'name','Outro caixa','kind','CASH','openingDate','2026-09-01','openingCents',0,'paymentMethodIds',jsonb_build_array(method)))->>'id')::uuid;
 p:=jsonb_build_object('kind','RECORD','operationKey',gen_random_uuid(),'congregationId',u,'mode','ATTENDANCE','direction','INCOME','date','2026-10-01','cashboxId',box,'paymentMethodId',method,'contributor',jsonb_build_object('kind','UNREGISTERED','name','Pessoa Teste'),'items',jsonb_build_array(jsonb_build_object('categoryId',tithe,'departmentId',dep,'amountCents',20000,'titheClassificationId',class),jsonb_build_object('categoryId',cat,'departmentId',dep,'amountCents',2000),jsonb_build_object('categoryId',cat,'departmentId',missions,'amountCents',5000)));
 r:=public.execute_finance_command(c,p);old_receipt:=(r->>'receiptId')::uuid;
 perform pg_temp.assert_true(jsonb_array_length(r->'transactionIds')=3 and r->>'attendanceId' is not null,'attendance created all three items');
 perform pg_temp.assert_true((select amount=270 from public.financial_receipts where id=old_receipt),'one receipt total 270');
 perform pg_temp.assert_true((select count(*)=3 from public.financial_receipt_items where receipt_id=old_receipt),'receipt preserves all items');
 perform pg_temp.assert_true((select current_balance=270 from public.financial_cashboxes where id=box),'attendance balance 270');

 perform public.record_finance_print_request(c,(r->>'receiptId')::uuid);
 perform public.record_finance_print_request(c,(r->>'receiptId')::uuid);
 perform pg_temp.assert_true((select print_count=2 and revision=1 and amount=270 from public.financial_receipts where id=(r->>'receiptId')::uuid),'print requests only increment request count');
 perform pg_temp.assert_true((select current_balance=270 from public.financial_cashboxes where id=box) and (select count(*)=3 from public.financial_transactions where church_id=c),'printing never changes financial movements');
 perform pg_temp.assert_true(not has_function_privilege('anon','public.record_finance_print_request(uuid,uuid)','execute'),'no anonymous printing');
 perform set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000003',true);
 begin perform public.record_finance_print_request(c,(r->>'receiptId')::uuid);raise exception 'expected scope denial';exception when raise_exception then if sqlerrm<>'FORBIDDEN' then raise;end if;end;
end $$;
rollback;
