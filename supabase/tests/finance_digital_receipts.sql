-- Local-only fictional fixtures; all changes roll back.
begin;
\ir finance_fixture.sql
create function pg_temp.assert_true(value boolean, message text) returns void language plpgsql as $$
begin if value is distinct from true then raise exception '%', message; end if; end; $$;
create temp table receipt_link_test (receipt_id uuid);
grant select on receipt_link_test to authenticated, service_role;
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000001',true);
do $$ declare
 c uuid := '20000000-0000-4000-8000-000000000001'; u uuid := '30000000-0000-4000-8000-000000000001';
 method uuid; dep uuid; cat uuid; box uuid; result jsonb;
begin
 method := (public.save_finance_catalog(c,jsonb_build_object('entity','PAYMENT_METHOD','congregationId',u,'name','Dinheiro','kind','CASH'))->>'id')::uuid;
 dep := (public.save_finance_catalog(c,jsonb_build_object('entity','DEPARTMENT','congregationId',u,'name','Tesouraria','effectiveMonth','2026-01','reason','Teste local','participatesInBase',true))->>'id')::uuid;
 cat := (public.save_finance_catalog(c,jsonb_build_object('entity','CATEGORY','congregationId',u,'name','Oferta','direction','INCOME','departmentId',dep))->>'id')::uuid;
 box := (public.save_finance_catalog(c,jsonb_build_object('entity','CASHBOX','congregationId',u,'name','Caixa','kind','CASH','openingDate','2026-01-01','openingCents',0,'paymentMethodIds',jsonb_build_array(method)))->>'id')::uuid;
 result := public.execute_finance_command(c,jsonb_build_object('kind','RECORD','operationKey',gen_random_uuid(),'congregationId',u,'mode','SINGLE','issueReceipt',true,'direction','INCOME','date','2026-11-02','cashboxId',box,'paymentMethodId',method,'contributor',jsonb_build_object('kind','UNREGISTERED','name','Pessoa Fictícia'),'items',jsonb_build_array(jsonb_build_object('categoryId',cat,'departmentId',dep,'amountCents',15000))));
 insert into receipt_link_test values ((result->>'receiptId')::uuid);
end $$;
select pg_temp.assert_true(not has_table_privilege('anon','public.financial_receipt_links','select'), 'anonymous link table denied');
select pg_temp.assert_true(not has_table_privilege('authenticated','public.financial_receipt_links','select,insert,update,delete'), 'authenticated link table denied');
select pg_temp.assert_true(not has_function_privilege('anon','public.issue_finance_receipt_link(uuid,uuid,text)','execute'), 'anonymous issuance denied');
select pg_temp.assert_true(not has_function_privilege('authenticated','public.consume_finance_receipt_link(text)','execute'), 'authenticated hash resolution denied');
select pg_temp.assert_true((select relrowsecurity from pg_class where oid='public.financial_receipt_links'::regclass), 'RLS enabled');

set local role authenticated;
select public.issue_finance_receipt_link('20000000-0000-4000-8000-000000000001',receipt_id,repeat('a',64)) from receipt_link_test;
do $$ declare r uuid := (select receipt_id from receipt_link_test); begin
 begin perform count(*) from public.financial_receipt_links; raise exception 'expected table denial'; exception when insufficient_privilege then null; end;
 perform set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000003',true);
 begin perform public.issue_finance_receipt_link('20000000-0000-4000-8000-000000000001',r,repeat('b',64)); raise exception 'expected wrong scope'; exception when raise_exception then if sqlerrm <> 'FORBIDDEN' then raise; end if; end;
 perform set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000001',true);
 begin perform public.issue_finance_receipt_link('20000000-0000-4000-8000-000000000002',r,repeat('b',64)); raise exception 'expected wrong church'; exception when raise_exception then if sqlerrm <> 'FORBIDDEN' then raise; end if; end;
 for i in 2..20 loop perform public.issue_finance_receipt_link('20000000-0000-4000-8000-000000000001',r,lpad(to_hex(i),64,'b')); end loop;
 begin perform public.issue_finance_receipt_link('20000000-0000-4000-8000-000000000001',r,repeat('c',64)); raise exception 'expected limit'; exception when raise_exception then if sqlerrm <> 'RECEIPT_LINK_LIMIT' then raise; end if; end;
end $$;
reset role;
select pg_temp.assert_true((select count(*)=20 and bool_and(expires_at=created_at+interval '30 days') and bool_and(created_by='10000000-0000-4000-8000-000000000001') from public.financial_receipt_links where receipt_id=(select receipt_id from receipt_link_test)), 'expiry and issuance audit');
select pg_temp.assert_true((select print_count=0 and amount=150 from public.financial_receipts where id=(select receipt_id from receipt_link_test)), 'sharing never changes money or print count');
do $$ begin
 begin insert into public.financial_receipt_links(church_id,congregation_id,receipt_id,token_hash,created_by)
 values('20000000-0000-4000-8000-000000000002','30000000-0000-4000-8000-000000000003',(select receipt_id from receipt_link_test),repeat('d',64),'10000000-0000-4000-8000-000000000001');
 raise exception 'expected cross church FK'; exception when foreign_key_violation then null; end;
 begin insert into public.financial_receipt_links(church_id,congregation_id,receipt_id,token_hash,created_by)
 values('20000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000002',(select receipt_id from receipt_link_test),repeat('d',64),'10000000-0000-4000-8000-000000000001');
 raise exception 'expected cross unit FK'; exception when foreign_key_violation then null; end;
end $$;

set local role service_role;
do $$ begin
 for i in 1..60 loop
   perform pg_temp.assert_true((select count(*)=1 from public.consume_finance_receipt_link(repeat('a',64))), 'within read limit');
 end loop;
 perform pg_temp.assert_true((select count(*)=0 from public.consume_finance_receipt_link(repeat('a',64))), 'read limit enforced');
 perform pg_temp.assert_true((select count(*)=0 from public.consume_finance_receipt_link(repeat('f',64))), 'unknown hash rejected');
end $$;
reset role;
update public.financial_receipt_links set window_started_at=now()-interval '11 minutes' where token_hash=repeat('a',64);
select pg_temp.assert_true((select count(*)=1 from public.consume_finance_receipt_link(repeat('a',64))), 'read window resets');
update public.financial_receipts set receipt_status='SUPERSEDED' where id=(select receipt_id from receipt_link_test);
select pg_temp.assert_true((select count(*)=0 from public.consume_finance_receipt_link(repeat('a',64))), 'superseded receipt invalidates links');
update public.financial_receipts set receipt_status='CANCELLED' where id=(select receipt_id from receipt_link_test);
select pg_temp.assert_true((select count(*)=0 from public.consume_finance_receipt_link(repeat('a',64))), 'cancelled receipt invalidates links');
do $$ begin
 begin perform public.issue_finance_receipt_link('20000000-0000-4000-8000-000000000001',(select receipt_id from receipt_link_test),repeat('e',64)); raise exception 'expected cancelled denial'; exception when raise_exception then if sqlerrm <> 'RECEIPT_UNAVAILABLE' then raise; end if; end;
end $$;
update public.financial_receipts set receipt_status='ISSUED',deleted_at=now() where id=(select receipt_id from receipt_link_test);
select pg_temp.assert_true((select count(*)=0 from public.consume_finance_receipt_link(repeat('a',64))), 'deleted receipt denied');
update public.financial_receipts set deleted_at=null where id=(select receipt_id from receipt_link_test);
update public.financial_receipt_links set revoked_at=now() where token_hash=repeat('a',64);
select pg_temp.assert_true((select count(*)=0 from public.consume_finance_receipt_link(repeat('a',64))), 'revoked link denied');
update public.financial_receipt_links set revoked_at=null, created_at=now()-interval '31 days',expires_at=now()-interval '1 day' where token_hash=repeat('a',64);
select pg_temp.assert_true((select count(*)=0 from public.consume_finance_receipt_link(repeat('a',64))), 'expired link denied');
set local role anon;
do $$ begin
 begin perform count(*) from public.financial_receipt_links; raise exception 'expected anon denial'; exception when insufficient_privilege then null; end;
end $$;
rollback;
