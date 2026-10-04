begin;
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

create function pg_temp.assert_true(value boolean,message text) returns void language plpgsql as $$ begin if value is distinct from true then raise exception '%',message; end if; end $$;
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000001',true);
set local role authenticated;
select pg_temp.assert_true(jsonb_array_length(public.list_finance_operators('20000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000001'))=1,'administrator lists other active regional access');
select public.assign_finance_operator('20000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000001','40000000-0000-4000-8000-000000000004','30000000-0000-4000-8000-000000000001');
reset role;
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000004',true);
select pg_temp.assert_true(private.can_access_finance_unit('20000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000001','finance.transactions.create'),'assigned regional operator allowed');
do $$ begin
 perform public.assign_finance_operator('20000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000001','40000000-0000-4000-8000-000000000004','30000000-0000-4000-8000-000000000002');
 raise exception 'operator must not grant own scope';
 exception when insufficient_privilege then null; end $$;
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000001',true);
do $$ begin
 perform public.assign_finance_operator('20000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000001','40000000-0000-4000-8000-000000000004','30000000-0000-4000-8000-000000000002');
 raise exception 'region must not expand';
 exception when insufficient_privilege then null; end $$;
insert into public.ministries(id,church_id,congregation_id,name) values('50000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000001','Ministry fixture');
update public.user_church_access set access_scope='MINISTRY',region_id=null,ministry_id='50000000-0000-4000-8000-000000000001' where id='40000000-0000-4000-8000-000000000004';
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000004',true);
select pg_temp.assert_true(private.can_access_finance_unit('20000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000001','finance.transactions.create'),'ministry receives assigned own unit');
select pg_temp.assert_true(not private.can_access_finance_unit('20000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000002','finance.view'),'ministry no unrelated unit');
update public.ministries set status='INACTIVE' where id='50000000-0000-4000-8000-000000000001';
select pg_temp.assert_true(not private.can_access_finance_unit('20000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000001','finance.view'),'inactive ministry denied');
select pg_temp.assert_true(not has_function_privilege('anon','public.assign_finance_operator(uuid,uuid,uuid,uuid)','EXECUTE'),'anonymous assignment denied');
rollback;
