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

insert into public.congregations(id,church_id,name,status,region_id) values
 ('30000000-0000-4000-8000-000000000004','20000000-0000-4000-8000-000000000001','Arquivada','INACTIVE','25000000-0000-4000-8000-000000000001'),
 ('30000000-0000-4000-8000-000000000005','20000000-0000-4000-8000-000000000001','Headquarters II','ACTIVE','25000000-0000-4000-8000-000000000001');
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000001',true);
set local role authenticated;
do $$ declare
 c uuid:='20000000-0000-4000-8000-000000000001';u uuid:='30000000-0000-4000-8000-000000000001';other_unit uuid:='30000000-0000-4000-8000-000000000002';
 method uuid;dep uuid;cat uuid;tithe uuid;class uuid;box uuid;tx uuid;r jsonb;p jsonb;q jsonb;aid uuid;bad uuid;
begin
 perform pg_temp.assert_true(jsonb_array_length(public.lookup_finance_congregations(c,u,'Head'))=2,'matching congregations returned with separate IDs');
 perform pg_temp.assert_true(jsonb_array_length(public.lookup_finance_congregations(c,u,'other'))=0,'foreign church hidden');
 perform pg_temp.assert_true(jsonb_array_length(public.lookup_finance_congregations(c,u,'Arquivada'))=0,'inactive hidden');
 method:=(public.save_finance_catalog(c,jsonb_build_object('entity','PAYMENT_METHOD','congregationId',u,'name','Dinheiro','kind','CASH'))->>'id')::uuid;
 dep:=(public.save_finance_catalog(c,jsonb_build_object('entity','DEPARTMENT','congregationId',u,'name','Tesouraria','effectiveMonth','2026-10','participatesInBase',true))->>'id')::uuid;
 cat:=(public.save_finance_catalog(c,jsonb_build_object('entity','CATEGORY','congregationId',u,'name','Inscrição','direction','BOTH','departmentId',dep))->>'id')::uuid;
 tithe:=(public.save_finance_catalog(c,jsonb_build_object('entity','CATEGORY','congregationId',u,'name','Dízimo','direction','INCOME','isTithe',true,'departmentId',dep))->>'id')::uuid;
 class:=(public.save_finance_catalog(c,jsonb_build_object('entity','CLASSIFICATION','congregationId',u,'name','Membro'))->>'id')::uuid;
 box:=(public.save_finance_catalog(c,jsonb_build_object('entity','CASHBOX','congregationId',u,'name','Caixa','kind','CASH','openingDate','2026-09-01','openingCents',0,'paymentMethodIds',jsonb_build_array(method)))->>'id')::uuid;
 p:=jsonb_build_object('kind','RECORD','operationKey',gen_random_uuid(),'congregationId',u,'mode','ATTENDANCE','direction','INCOME','date','2026-10-01','cashboxId',box,'paymentMethodId',method,'contributor',jsonb_build_object('kind','CONGREGATION','congregationId',other_unit,'name','FORGED'),'items',jsonb_build_array(jsonb_build_object('categoryId',cat,'departmentId',dep,'amountCents',20000)));
 r:=public.execute_finance_command(c,p);tx:=(r#>>'{transactionIds,0}')::uuid;aid:=(r->>'attendanceId')::uuid;
 perform pg_temp.assert_true((select congregation_id=u and contributor_congregation_id=other_unit and person_name='Headquarters' and member_id is null from public.financial_transactions where id=tx),'trusted name and separate accounting unit');
 perform pg_temp.assert_true((select contributor_congregation_id=other_unit from public.financial_attendances where id=aid),'attendance owns identity');
 perform pg_temp.assert_true((select snapshot->>'personName'='Headquarters' from public.financial_receipts where id=(r->>'receiptId')::uuid),'receipt retains resolved name');
 perform pg_temp.assert_true((select new_values->>'contributor_congregation_id'=other_unit::text from public.financial_transaction_revisions where transaction_id=tx and revision=1),'audit includes stable link');
 perform pg_temp.assert_true((public.execute_finance_command(c,p)->>'replayed')::boolean,'retry remains idempotent');
 q:=public.list_finance_transactions(c,u,jsonb_build_object('month','2026-10','contributorCongregationId',other_unit));
 perform pg_temp.assert_true((q->>'totalCount')::int=1 and q->>'contributorCongregationId'=other_unit::text,'query by stable identity');
 perform pg_temp.assert_true((public.list_finance_transactions(c,u,jsonb_build_object('month','2026-10','contributorCongregationId',u))->>'totalCount')::int=0,'accounting congregation is not payer');
 q:=jsonb_build_object('kind','CORRECT_TRANSACTION','operationKey',gen_random_uuid(),'congregationId',u,'id',tx,'expectedRevision',1,'reason','Corrigir identificação','replacement',(p-'kind'-'mode'-'operationKey'-'congregationId'-'items')||jsonb_build_object('item',p#>'{items,0}','contributor',jsonb_build_object('kind','CONGREGATION','congregationId','30000000-0000-4000-8000-000000000005')));
 begin perform public.execute_finance_command(c,q);raise exception 'attendance identity changed';exception when invalid_parameter_value then null;end;

 update public.congregations set name='Headquarters Renamed' where church_id=c and id=other_unit;
 q:=jsonb_set(q,'{replacement,contributor,congregationId}',to_jsonb(other_unit));
 r:=public.execute_finance_command(c,q);
 perform pg_temp.assert_true((select person_name='Headquarters' and contributor_congregation_id=other_unit from public.financial_transactions where id=tx),'attendance correction preserves historical identity after rename');
 update public.congregations set name='Headquarters' where church_id=c and id=other_unit;
 foreach bad in array array['30000000-0000-4000-8000-000000000003'::uuid,'30000000-0000-4000-8000-000000000004'::uuid] loop
  begin perform public.execute_finance_command(c,p||jsonb_build_object('operationKey',gen_random_uuid(),'contributor',jsonb_build_object('kind','CONGREGATION','congregationId',bad)));raise exception 'invalid congregation accepted';exception when raise_exception then if sqlerrm<>'INACTIVE_REFERENCE' then raise;end if;end;
 end loop;
 begin perform public.execute_finance_command(c,p||jsonb_build_object('operationKey',gen_random_uuid(),'items',jsonb_build_array(jsonb_build_object('categoryId',tithe,'departmentId',dep,'amountCents',100,'titheClassificationId',class))));raise exception 'congregation accepted as tithe person';exception when invalid_parameter_value then null;end;
 p:=p||jsonb_build_object('operationKey',gen_random_uuid(),'mode','SINGLE','direction','EXPENSE','issueReceipt',true,'contributor',jsonb_build_object('kind','ORGANIZATION','name','  Energia Exemplo  '),'beneficiaryName','FORGED');
 r:=public.execute_finance_command(c,p);tx:=(r#>>'{transactionIds,0}')::uuid;
 perform pg_temp.assert_true((select person_name='Energia Exemplo' and beneficiary_name='Energia Exemplo' and contributor_kind='ORGANIZATION' and contributor_congregation_id is null from public.financial_transactions where id=tx),'organization expense has one trusted identity');
 perform pg_temp.assert_true((select snapshot->>'personName'='Energia Exemplo' from public.financial_receipts where id=(r->>'receiptId')::uuid),'expense receipt');
 q:=jsonb_build_object('kind','CORRECT_TRANSACTION','operationKey',gen_random_uuid(),'congregationId',u,'id',tx,'expectedRevision',1,'reason','Alterar favorecido','replacement',(p-'kind'-'mode'-'operationKey'-'congregationId'-'items')||jsonb_build_object('item',p#>'{items,0}','contributor',jsonb_build_object('kind','CONGREGATION','congregationId',other_unit)));
 r:=public.execute_finance_command(c,q);
 perform pg_temp.assert_true((select contributor_congregation_id=other_unit and person_name='Headquarters' from public.financial_transactions where id=tx),'single correction replaces identity through audited writer');
 perform pg_temp.assert_true((select new_values->>'contributor_congregation_id'=other_unit::text from public.financial_transaction_revisions where transaction_id=tx and revision=2),'correction audit preserves link');
 r:=public.execute_finance_command(c,p||jsonb_build_object('operationKey',gen_random_uuid(),'contributor',jsonb_build_object('kind','COLLECTIVE'),'beneficiaryName','Legado livre'));
 perform pg_temp.assert_true((select beneficiary_name='Legado livre' and contributor_congregation_id is null from public.financial_transactions where id=(r#>>'{transactionIds,0}')::uuid),'legacy expense name supported');
 perform set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000002',true);
 perform pg_temp.assert_true(jsonb_array_length(public.lookup_finance_congregations(c,u,'Head'))=2,'scoped treasurer sees minimal congregation directory');
 begin perform public.lookup_finance_congregations(c,other_unit,'Head');raise exception 'wrong scope accepted';exception when insufficient_privilege then null;end;
 perform set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000004',true);
 perform pg_temp.assert_true(jsonb_array_length(public.lookup_finance_congregations(c,u,'Head'))=2,'finance read user can filter names');
 perform set_config('request.jwt.claim.sub','',true);
 begin perform public.lookup_finance_congregations(c,u,'Head');raise exception 'unauthenticated accepted';exception when insufficient_privilege then null;end;
 perform pg_temp.assert_true(not has_function_privilege('anon','public.lookup_finance_congregations(uuid,uuid,text)','execute'),'anon grant revoked');
end $$;
reset role;
do $$ declare ident uuid; begin
 select id into ident from public.financial_transactions where church_id='20000000-0000-4000-8000-000000000001' and contributor_kind='CONGREGATION' limit 1;
 begin update public.financial_transactions set contributor_kind=null where id=ident; raise exception 'null type bypassed link constraint'; exception when check_violation then null; end;
 begin update public.financial_transactions set contributor_congregation_id='30000000-0000-4000-8000-000000000003' where id=ident; raise exception 'cross-church foreign key bypass'; exception when foreign_key_violation then null; end;
end $$;
select pg_temp.assert_true(not has_function_privilege('authenticated','private.finance_write_item_with_source(uuid,uuid,uuid,jsonb,jsonb,uuid,uuid,text,text)','execute'),'private writer remains private');
rollback;
