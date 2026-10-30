\set ON_ERROR_STOP on
begin;
\ir finance_fixture.sql
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000001',true);
set local role authenticated;
do $$ declare ch uuid := '20000000-0000-4000-8000-000000000001'; cat uuid; a uuid; r jsonb; v jsonb; cmd jsonb; before_count bigint; before_ledger text; begin
 cat := (public.save_finance_catalog(ch,jsonb_build_object('entity','CATEGORY','congregationId','30000000-0000-4000-8000-000000000002','name','Payable utility','direction','EXPENSE'))->>'id')::uuid;
 select count(*) into before_count from public.financial_transactions;
 select md5(coalesce(jsonb_agg(t order by t.id)::text,'[]')) into before_ledger from public.financial_transactions t;
 v := jsonb_build_object('name','Electricity','categoryId',cat,'dueDate','2026-10-31','amountCents',null,'notes','Fictional');
 cmd := jsonb_build_object('kind','CREATE','requestId',gen_random_uuid(),'values',v);
 r := public.execute_finance_payable(ch,cmd); a := (r->>'id')::uuid;
 if public.execute_finance_payable(ch,cmd) <> r then raise exception 'retry duplicated create'; end if;
 if (select count(*) from public.accounts_payable where id=a and congregation_id='30000000-0000-4000-8000-000000000002' and amount is null) <> 1 then raise exception 'wrong headquarters or unknown value'; end if;
 r := public.query_finance_payables(ch,'{"month":"2026-10"}');
 if (r->>'pendingCount')::int<>1 then raise exception 'wrong pending count'; end if;
 perform public.execute_finance_payable(ch,jsonb_build_object('kind','PAY','requestId',gen_random_uuid(),'id',a,'revision',1,'paidDate','2026-10-20'));
 begin
  perform public.execute_finance_payable(ch,jsonb_build_object('kind','UPDATE','requestId',gen_random_uuid(),'id',a,'revision',1,'values',v));
  raise exception 'stale edit accepted';
 exception when raise_exception then if sqlerrm<>'CONFLICT' then raise; end if; end;
 if (public.query_finance_payables(ch,'{"month":"2026-10","status":"PAID"}')->>'paidCount')::int<>1 then raise exception 'paid omitted from due month'; end if;
 perform public.execute_finance_payable(ch,jsonb_build_object('kind','REOPEN','requestId',gen_random_uuid(),'id',a,'revision',2,'reason','Incorrect confirmation'));
 cmd:=jsonb_build_object('kind','COPY','requestId',gen_random_uuid(),'sourceMonth','2026-10','items',jsonb_build_array(jsonb_build_object('sourceId',a,'revision',3,'categoryId',cat,'dueDate','2026-11-30','amountCents',32000)));
 if (public.execute_finance_payable(ch,cmd)->>'created')::int<>1 then raise exception 'copy failed'; end if;
 if (public.execute_finance_payable(ch,cmd||jsonb_build_object('requestId',gen_random_uuid()))->>'skipped')::int<>1 then raise exception 'copy duplicated'; end if;
 if jsonb_array_length(public.get_finance_payable(ch,a)->'history')<>3 then raise exception 'audit events missing'; end if;
 perform public.execute_finance_payable(ch,jsonb_build_object('kind','DELETE','requestId',gen_random_uuid(),'id',a,'revision',3));
 if exists(select 1 from public.accounts_payable where id=a) then raise exception 'deleted visible'; end if;
 if jsonb_array_length(public.get_finance_payable(ch,a)->'history')<>4 then raise exception 'deleted audit lost'; end if;
 if (select count(*) from public.financial_transactions)<>before_count or (select md5(coalesce(jsonb_agg(t order by t.id)::text,'[]')) from public.financial_transactions t)<>before_ledger then raise exception 'checklist changed ledger'; end if;
 begin
  perform public.query_finance_payables('20000000-0000-4000-8000-000000000002','{"month":"2026-10"}');
  raise exception 'cross tenant access';
 exception when insufficient_privilege then null; end;
 begin
  update public.accounts_payable set description='Bypass'; raise exception 'direct mutation allowed';
 exception when insufficient_privilege then null; end;
end $$;
reset role;
-- Even an explicit permission override cannot turn a treasurer into an administrator.
insert into public.user_permission_overrides(access_id,permission_id,effect)
select '40000000-0000-4000-8000-000000000002',id,'ALLOW' from public.permissions where key='finance.payables.manage';
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000002',true);
set local role authenticated;
do $$ begin
 if exists(select 1 from public.accounts_payable) then raise exception 'treasurer RLS leak'; end if;
 begin
 perform public.query_finance_payables('20000000-0000-4000-8000-000000000001','{"month":"2026-10"}');
 raise exception 'treasurer RPC leak';
 exception when insufficient_privilege then null; end;
end $$;
reset role;
-- Additional negative cases are in separate subtransactions so writes must roll back.
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000001',true);
set local role authenticated;
do $$ declare ch uuid:='20000000-0000-4000-8000-000000000001'; cat uuid; a uuid; b uuid; v jsonb; cmd jsonb; total bigint; begin
 select id into cat from public.financial_categories where church_id=ch and name='Payable utility';
 v:=jsonb_build_object('name','Rent','categoryId',cat,'dueDate','2028-01-31','amountCents',10000,'notes','');
 a:=(public.execute_finance_payable(ch,jsonb_build_object('kind','CREATE','requestId',gen_random_uuid(),'values',v))->>'id')::uuid;
 b:=(public.execute_finance_payable(ch,jsonb_build_object('kind','CREATE','requestId',gen_random_uuid(),'values',v||'{"name":"Internet"}'))->>'id')::uuid;
 select count(*) into total from public.accounts_payable;
 cmd:=jsonb_build_object('kind','COPY','requestId',gen_random_uuid(),'sourceMonth','2028-01','items',jsonb_build_array(
 jsonb_build_object('sourceId',a,'revision',1,'categoryId',cat,'dueDate','2028-02-29','amountCents',null),
 jsonb_build_object('sourceId',b,'revision',1,'categoryId',cat,'dueDate','2028-03-01','amountCents',null)));
 begin perform public.execute_finance_payable(ch,cmd); raise exception 'invalid copy date accepted'; exception when raise_exception then if sqlerrm<>'INVALID_INPUT' then raise; end if; end;
 if (select count(*) from public.accounts_payable)<>total then raise exception 'partial copy persisted'; end if;
 begin perform public.execute_finance_payable(ch,jsonb_build_object('kind','PAY','requestId',gen_random_uuid(),'id',a,'revision',1,'paidDate',((now() at time zone 'America/Sao_Paulo')::date+1)::text)); raise exception 'future payment accepted'; exception when raise_exception then if sqlerrm<>'INVALID_INPUT' then raise; end if; end;
 begin perform public.execute_finance_payable(ch,jsonb_build_object('kind','CREATE','requestId',gen_random_uuid(),'values',v||'{"amountCents":0}')); raise exception 'zero accepted'; exception when raise_exception then if sqlerrm<>'INVALID_INPUT' then raise; end if; end;
 begin perform public.execute_finance_payable(ch,jsonb_build_object('kind','CREATE','requestId',gen_random_uuid(),'values',v,'congregationId','30000000-0000-4000-8000-000000000001')); raise exception 'ownership accepted'; exception when raise_exception then if sqlerrm<>'INVALID_INPUT' then raise; end if; end;
 if (public.query_finance_payables(ch,'{"month":"2026-10","dateFrom":"2028-01-01","dateTo":"2028-01-31"}')->>'pendingCount')::int<>2 then raise exception 'custom period intersected month'; end if;
 cmd:=jsonb_build_object('kind','UPDATE','requestId',gen_random_uuid(),'id',a,'revision',1,'values',v||'{"name":"Updated"}');
 perform public.execute_finance_payable(ch,cmd);
 begin perform public.execute_finance_payable(ch,cmd||jsonb_build_object('values',v)); raise exception 'request payload collision accepted'; exception when raise_exception then if sqlerrm<>'IDEMPOTENCY_CONFLICT' then raise; end if; end;
end $$;
reset role;

-- Legacy zero amounts remain unchanged and are not exposed as checklist entries.
insert into public.accounts_payable(id,church_id,congregation_id,description,due_date,amount)
values('90000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000002','Legacy obligation','2028-01-01',0);
update public.financial_categories set status='INACTIVE' where church_id='20000000-0000-4000-8000-000000000001' and name='Payable utility';
set local role authenticated;
do $$ declare ch uuid:='20000000-0000-4000-8000-000000000001'; a public.accounts_payable; before_count bigint; begin
 if exists(select 1 from public.accounts_payable where id='90000000-0000-4000-8000-000000000001') then raise exception 'legacy inferred as checklist'; end if;
 begin perform public.get_finance_payable(ch,'90000000-0000-4000-8000-000000000001'); raise exception 'legacy detail exposed'; exception when insufficient_privilege then null; end;
 select * into a from public.accounts_payable where church_id=ch and description='Internet';
 select count(*) into before_count from public.accounts_payable;
 begin
 perform public.execute_finance_payable(ch,jsonb_build_object('kind','COPY','requestId',gen_random_uuid(),'sourceMonth','2028-01','items',jsonb_build_array(jsonb_build_object('sourceId',a.id,'revision',a.revision,'categoryId',a.category_id,'dueDate','2028-02-29','amountCents',null))));
 raise exception 'inactive category copied'; exception when raise_exception then if sqlerrm<>'INACTIVE_REFERENCE' then raise; end if; end;
 if (select count(*) from public.accounts_payable)<>before_count then raise exception 'inactive copy persisted'; end if;
end $$;
reset role;
do $$ begin
 if not exists(select 1 from public.accounts_payable where id='90000000-0000-4000-8000-000000000001' and amount=0 and not is_checklist) then raise exception 'legacy changed'; end if;
end $$;

set local role anon;
do $$ begin
 begin perform public.query_finance_payables('20000000-0000-4000-8000-000000000001','{"month":"2026-10"}'); raise exception 'anon RPC leak'; exception when insufficient_privilege then null; end;
end $$;
rollback;
