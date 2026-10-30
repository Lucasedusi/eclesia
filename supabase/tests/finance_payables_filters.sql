\set ON_ERROR_STOP on
begin;
\ir finance_fixture.sql
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000001',true);
set local role authenticated;
do $$
declare
 ch uuid := '20000000-0000-4000-8000-000000000001'; cat uuid; other_cat uuid; id uuid; options jsonb; r jsonb;
 today date := (now() at time zone 'America/Sao_Paulo')::date;
begin
 cat := (public.save_finance_catalog(ch,jsonb_build_object('entity','CATEGORY','congregationId','30000000-0000-4000-8000-000000000002','name','Filter utilities','direction','EXPENSE'))->>'id')::uuid;
 other_cat := (public.save_finance_catalog(ch,jsonb_build_object('entity','CATEGORY','congregationId','30000000-0000-4000-8000-000000000002','name','Other utilities','direction','EXPENSE'))->>'id')::uuid;
 for n in 1..28 loop
  id := (public.execute_finance_payable(ch,jsonb_build_object('kind','CREATE','requestId',gen_random_uuid(),'values',jsonb_build_object(
   'name',case when n=28 then 'Other name' else 'Status item '||n end,'categoryId',case when n=27 then other_cat else cat end,
   'dueDate',case when n=24 then today when n=25 then today+1 else today-1 end,'amountCents',null,'notes','Fictional')))->>'id')::uuid;
  if n=26 then perform public.execute_finance_payable(ch,jsonb_build_object('kind','PAY','requestId',gen_random_uuid(),'id',id,'revision',1,'paidDate',today)); end if;
 end loop;
 options:=jsonb_build_object('month',to_char(today,'YYYY-MM'),'dateFrom',today-1,'dateTo',today+1,'categoryId',cat,'search','Status item');
 r:=public.query_finance_payables(ch,options||'{"dueStatus":"OVERDUE"}'::jsonb);
 if (r->>'count')::int<>23 or jsonb_array_length(r->'items')<>20 or (r->>'pendingCount')::int<>25 or (r->>'paidCount')::int<>1 then raise exception 'filter/count applied after pagination or leaked category/search'; end if;
 r:=public.query_finance_payables(ch,options||'{"dueStatus":"OVERDUE","page":2}'::jsonb);
 if jsonb_array_length(r->'items')<>3 or (r->>'page')::int<>2 then raise exception 'filtered second page incorrect'; end if;
 r:=public.query_finance_payables(ch,options||'{"dueStatus":"TODAY","page":99}'::jsonb);
 if (r->>'count')::int<>1 or (r->>'page')::int<>1 or (r->'items'->0->>'dueDate')::date<>today then raise exception 'today or page clamping incorrect'; end if;
 r:=public.query_finance_payables(ch,options||'{"dueStatus":"UPCOMING"}'::jsonb);
 if (r->>'count')::int<>1 or (r->'items'->0->>'dueDate')::date<>today+1 then raise exception 'future filter incorrect'; end if;
 r:=public.query_finance_payables(ch,options||'{"dueStatus":"UPCOMING","status":"PAID"}'::jsonb);
 if (r->>'count')::int<>1 or r->'items'->0->>'status'<>'PAID' then raise exception 'paid tab incorrectly narrowed by due filter'; end if;
 r:=public.query_finance_payables(ch,options||'{"dueStatus":"ALL"}'::jsonb);
 if (r->>'count')::int<>25 then raise exception 'all pending incorrect'; end if;
 r:=public.query_finance_payables(ch,options||'{"dueStatus":"OVERDUE","search":"missing"}'::jsonb);
 if (r->>'count')::int<>0 or jsonb_array_length(r->'items')<>0 or (r->>'page')::int<>1 then raise exception 'empty result incorrect'; end if;
 begin
  perform public.query_finance_payables(ch,options||'{"dueStatus":"INVALID"}'::jsonb);
  raise exception 'invalid filter accepted';
 exception when raise_exception then if sqlerrm<>'INVALID_INPUT' then raise; end if; end;
 begin
  perform public.query_finance_payables('20000000-0000-4000-8000-000000000002',options||'{"dueStatus":"TODAY"}'::jsonb);
  raise exception 'cross tenant filter allowed';
 exception when insufficient_privilege then null; end;
end $$;
rollback;
