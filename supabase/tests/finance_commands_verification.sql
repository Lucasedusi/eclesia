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
 update public.financial_categories set status='INACTIVE' where id=tithe;
 again:=public.execute_finance_command(c,p);
 perform pg_temp.assert_true(again->>'operationId'=r->>'operationId' and (again->>'replayed')::boolean,'retry after catalog inactivation returns original operation');
 begin perform public.execute_finance_command(c,p||jsonb_build_object('date','2026-10-02'));raise exception 'expected changed retry conflict';exception when raise_exception then if sqlerrm<>'IDEMPOTENCY_CONFLICT' then raise;end if;end;
 update public.financial_categories set status='ACTIVE' where id=tithe;
 begin perform public.execute_finance_command(c,jsonb_set(p||jsonb_build_object('operationKey',gen_random_uuid()),'{items,2,categoryId}',to_jsonb(gen_random_uuid())));raise exception 'expected invalid batch rejection';exception when raise_exception then if sqlerrm<>'INACTIVE_REFERENCE' then raise;end if;end;
 perform pg_temp.assert_true((select count(*)=3 from public.financial_transactions where church_id=c),'invalid batch left no partial rows');
 p:=p||jsonb_build_object('operationKey',gen_random_uuid(),'mode','SINGLE','issueReceipt',true,'items',jsonb_build_array(jsonb_build_object('categoryId',cat,'departmentId',dep,'amountCents',15000)));
 single_result:=public.execute_finance_command(c,p);tx:=(single_result#>>'{transactionIds,0}')::uuid;
 corrected:=public.execute_finance_command(c,jsonb_build_object('kind','CORRECT_TRANSACTION','operationKey',gen_random_uuid(),'congregationId',u,'id',tx,'expectedRevision',1,'reason','Corrigir valor','replacement',jsonb_build_object('direction','INCOME','date','2026-09-30','cashboxId',box,'paymentMethodId',method,'contributor',p->'contributor','item',jsonb_build_object('categoryId',cat,'departmentId',dep,'amountCents',10000))));
 perform pg_temp.assert_true((select current_balance=370 from public.financial_cashboxes where id=box),'correcting 150 to 100 reduces balance by 50');
 perform pg_temp.assert_true((select count(*)=2 from public.financial_transaction_revisions where transaction_id=tx),'both revisions preserved');
 perform pg_temp.assert_true((select receipt_status='SUPERSEDED' from public.financial_receipts where id=(single_result->>'receiptId')::uuid),'old receipt superseded');
 perform pg_temp.assert_true((select sum(amount)=100 from public.financial_ledger_entries where transaction_id=tx and financial_date='2026-09-30'),'corrected effect in earlier month');
 perform pg_temp.assert_true((select sum(amount)=0 from public.financial_ledger_entries where transaction_id=tx and financial_date='2026-10-01'),'old month reversed');
 begin perform public.execute_finance_command(c,jsonb_build_object('kind','CANCEL_TRANSACTION','operationKey',gen_random_uuid(),'congregationId',u,'id',tx,'expectedRevision',1,'reason','Revisão antiga'));raise exception 'expected stale conflict';exception when raise_exception then if sqlerrm<>'CONFLICT' then raise;end if;end;
 perform public.execute_finance_command(c,jsonb_build_object('kind','CANCEL_TRANSACTION','operationKey',gen_random_uuid(),'congregationId',u,'id',tx,'expectedRevision',2,'reason','Cancelar teste'));
 perform pg_temp.assert_true((select current_balance=270 from public.financial_cashboxes where id=box),'cancellation reverses balance');
 perform pg_temp.assert_true((select status='CANCELLED' and deleted_at is null from public.financial_transactions where id=tx),'cancelled transaction retained');
 transferred:=public.execute_finance_command(c,jsonb_build_object('kind','TRANSFER','operationKey',gen_random_uuid(),'congregationId',u,'date','2026-10-02','sourceCashboxId',box,'targetCashboxId',target,'amountCents',10000));
 perform pg_temp.assert_true((select sum(current_balance)=270 from public.financial_cashboxes where church_id=c),'transfer preserves consolidated balance');
 perform pg_temp.assert_true((select current_balance=170 from public.financial_cashboxes where id=box),'source debited');
 perform public.execute_finance_command(c,jsonb_build_object('kind','CANCEL_TRANSFER','operationKey',gen_random_uuid(),'congregationId',u,'id',transferred->>'transferId','expectedRevision',1,'reason','Cancelar transferência'));
 perform pg_temp.assert_true((select current_balance=270 from public.financial_cashboxes where id=box),'transfer cancellation restores both sides');
 corrected:=public.execute_finance_command(c,jsonb_build_object('kind','CORRECT_TRANSACTION','operationKey',gen_random_uuid(),'congregationId',u,'id',r#>>'{transactionIds,1}','expectedRevision',1,'reason','Corrigir item agrupado','replacement',jsonb_build_object('direction','INCOME','date','2026-10-01','cashboxId',box,'paymentMethodId',method,'contributor',p->'contributor','item',jsonb_build_object('categoryId',cat,'departmentId',dep,'amountCents',3000))));
 perform pg_temp.assert_true((select amount=280 from public.financial_receipts where id=(corrected->>'receiptId')::uuid),'group correction replaces total');
 perform pg_temp.assert_true((select count(*)=3 from public.financial_receipt_items where receipt_id=(corrected->>'receiptId')::uuid),'group correction preserves other lines');
 perform pg_temp.assert_true((select receipt_status='SUPERSEDED' from public.financial_receipts where id=old_receipt),'group original receipt retained');
 perform public.execute_finance_command(c,jsonb_build_object('kind','CANCEL_ATTENDANCE','operationKey',gen_random_uuid(),'congregationId',u,'id',r->>'attendanceId','expectedRevision',2,'reason','Cancelar atendimento'));
 perform pg_temp.assert_true((select current_balance=0 from public.financial_cashboxes where id=box),'whole attendance cancelled atomically');
 perform pg_temp.assert_true((select receipt_status='CANCELLED' from public.financial_receipts where id=(corrected->>'receiptId')::uuid),'attendance receipt cancellation visible');
 perform pg_temp.assert_true(not has_function_privilege('anon','public.execute_finance_command(uuid,jsonb)','execute'),'anonymous commands denied');
end $$;
rollback;
