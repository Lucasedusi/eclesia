begin;
create function pg_temp.assert_true(value boolean,message text) returns void language plpgsql as $$ begin if value is distinct from true then raise exception '%',message; end if; end; $$;
-- Local-only fictional data, intended to run inside the caller's transaction.
-- All IDs are reserved for this suite and nothing is committed.
insert into auth.users(id,email) values
 ('10000000-0000-4000-8000-000000000001','finance-admin@example.invalid'),
 ('10000000-0000-4000-8000-000000000002','finance-treasurer@example.invalid'),
 ('10000000-0000-4000-8000-000000000003','finance-secretary@example.invalid'),
 ('10000000-0000-4000-8000-000000000004','finance-observer@example.invalid');
insert into public.profiles(id,full_name,status) select id,'Finance fixture','ACTIVE' from auth.users where email like 'finance-%@example.invalid' on conflict(id) do update set status='ACTIVE';
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
 method uuid;dep uuid;cat uuid;box uuid;other_method uuid;tx uuid;attendance uuid;payload jsonb;
begin
 method:=(public.save_finance_catalog(c,jsonb_build_object('entity','PAYMENT_METHOD','congregationId',u,'name','Dinheiro','kind','CASH'))->>'id')::uuid;
 dep:=(public.save_finance_catalog(c,jsonb_build_object('entity','DEPARTMENT','congregationId',u,'name','Tesouraria','effectiveMonth','2026-10','participatesInBase',true))->>'id')::uuid;
 cat:=(public.save_finance_catalog(c,jsonb_build_object('entity','CATEGORY','congregationId',u,'name','Oferta','direction','INCOME','departmentId',dep))->>'id')::uuid;
 payload:=jsonb_build_object('entity','CASHBOX','congregationId',u,'name','Caixa','kind','CASH','openingDate','2026-10-01','openingCents',10000,'paymentMethodIds',jsonb_build_array(method));
 box:=(public.save_finance_catalog(c,payload)->>'id')::uuid;
 perform pg_temp.assert_true((select current_balance=100 from public.financial_cashboxes where id=box),'opening reflected in protected balance');
 perform pg_temp.assert_true((select sum(amount)=100 from public.financial_ledger_entries where cashbox_id=box),'opening ledger effect');
 perform pg_temp.assert_true((select count(*)=0 from public.financial_transactions where church_id=c),'opening excluded from income');
 begin perform public.save_finance_catalog(c,payload||jsonb_build_object('id',box,'status','INACTIVE'));raise exception 'expected nonzero rejection'; exception when raise_exception then if sqlerrm<>'CONFLICT' then raise; end if; end;
 begin update public.financial_ledger_entries set amount=0 where cashbox_id=box;raise exception 'expected immutable ledger';exception when check_violation then null;end;
 begin insert into public.financial_cashboxes(church_id,congregation_id,name) values(c,'30000000-0000-4000-8000-000000000003','Invalid');raise exception 'expected cross tenant rejection';exception when foreign_key_violation then null;end;
 other_method:=(public.save_finance_catalog(c,jsonb_build_object('entity','PAYMENT_METHOD','congregationId',u,'name','Pix','kind','PIX'))->>'id')::uuid;
 begin insert into public.financial_transactions(church_id,congregation_id,category_id,cashbox_id,payment_method_id,transaction_type,amount) values(c,u,cat,box,other_method,'INCOME',10);raise exception 'expected unlinked method rejection';exception when foreign_key_violation then null;end;
 insert into public.financial_transactions(church_id,congregation_id,category_id,cashbox_id,payment_method_id,transaction_type,amount) values(c,u,cat,box,method,'INCOME',10) returning id into tx;
 insert into public.financial_attendances(church_id,congregation_id,contributor_kind,cashbox_id,payment_method_id,transaction_date) values(c,u,'COLLECTIVE',box,method,'2026-10-01') returning id into attendance;
 begin insert into public.financial_receipts(church_id,congregation_id,financial_transaction_id,attendance_id,receipt_number) values(c,u,tx,attendance,'bad');raise exception 'expected two origins rejection';exception when check_violation then null;end;
 perform pg_temp.assert_true(not has_table_privilege('authenticated','public.financial_ledger_entries','INSERT'),'client cannot forge ledger');
 perform pg_temp.assert_true(not has_table_privilege('anon','public.financial_ledger_entries','SELECT'),'anonymous ledger denied');
end $$;
rollback;
