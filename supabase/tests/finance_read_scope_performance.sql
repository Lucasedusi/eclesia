-- Local fictional data, rolled back. Run as postgres to inspect per-session counters.
-- Catches per-row authorization work, scope/permission union bugs, stale identity
-- caching, cross-church reads, and widening of the existing SELECT grants.
begin;
set local statement_timeout = '60s';
set local track_functions = 'all';
\ir finance_fixture.sql

create function pg_temp.assert_true(ok boolean, label text) returns void
language plpgsql as $$ begin if ok is distinct from true then raise exception '%', label; end if; end $$;

insert into public.financial_categories(id,church_id,name,category_type) values
 ('60000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001','Scope fixture','INCOME'),
 ('60000000-0000-4000-8000-000000000002','20000000-0000-4000-8000-000000000002','Scope fixture','INCOME');
insert into public.financial_cashboxes(id,church_id,congregation_id,name,cashbox_type,opening_date)
select ('70000000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,
 ('20000000-0000-4000-8000-'||lpad((case when n=3 then 2 else 1 end)::text,12,'0'))::uuid,
 ('30000000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,'Scope fixture','CASH','2026-01-01'
from generate_series(1,3) n;
with added as (
 insert into public.financial_transactions(church_id,congregation_id,category_id,cashbox_id,transaction_type,amount,transaction_date)
 select '20000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000001',
 '60000000-0000-4000-8000-000000000001','70000000-0000-4000-8000-000000000001','INCOME',1,'2026-10-01'
 from generate_series(1,1000) returning id,church_id,congregation_id,cashbox_id
) insert into public.financial_ledger_entries(church_id,congregation_id,cashbox_id,transaction_id,entry_kind,amount,financial_date)
select church_id,congregation_id,cashbox_id,id,'TRANSACTION',1,'2026-10-01' from added;
with added as (
 insert into public.financial_transactions(church_id,congregation_id,category_id,cashbox_id,transaction_type,amount,transaction_date)
 select b.church_id,b.congregation_id,c.id,b.id,'INCOME',20,'2026-10-01'
 from public.financial_cashboxes b join public.financial_categories c on c.church_id=b.church_id
 where b.id in ('70000000-0000-4000-8000-000000000002','70000000-0000-4000-8000-000000000003')
 and c.id in ('60000000-0000-4000-8000-000000000001','60000000-0000-4000-8000-000000000002')
 returning id,church_id,congregation_id,cashbox_id
) insert into public.financial_ledger_entries(church_id,congregation_id,cashbox_id,transaction_id,entry_kind,amount,financial_date)
select church_id,congregation_id,cashbox_id,id,'TRANSACTION',20,'2026-10-01' from added;
with added as (
 insert into public.financial_transactions(church_id,congregation_id,category_id,cashbox_id,transaction_type,amount,transaction_date,deleted_at)
 values('20000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000001',
 '60000000-0000-4000-8000-000000000001','70000000-0000-4000-8000-000000000001','INCOME',99,'2026-10-01',now())
 returning id
) insert into public.financial_ledger_entries(church_id,congregation_id,cashbox_id,transaction_id,entry_kind,amount,financial_date,deleted_at)
select '20000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000001',
 '70000000-0000-4000-8000-000000000001',id,'TRANSACTION',99,'2026-10-01',now() from added;

-- A prepared statement is deliberately reused across caller and permission changes.
prepare scope_counts(bigint,bigint,text) as select pg_temp.assert_true(
 (select count(*) from public.financial_transactions where church_id='20000000-0000-4000-8000-000000000001')=$1
 and (select count(*) from public.financial_transactions where church_id='20000000-0000-4000-8000-000000000002')=$2
 and (select count(*) from public.financial_ledger_entries where church_id='20000000-0000-4000-8000-000000000001')=$1
 and (select count(*) from public.financial_ledger_entries where church_id='20000000-0000-4000-8000-000000000002')=$2,$3);
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000001',true);
set local role authenticated;
execute scope_counts(1001,0,'church administrator sees own live rows only');
select pg_temp.assert_true((public.get_finance_overview('20000000-0000-4000-8000-000000000001',
 '30000000-0000-4000-8000-000000000001','2026-10')->>'incomeCents')::numeric=100000,'overview retains exact amounts');
do $$ declare before_calls bigint; used bigint; total numeric; begin
 select coalesce(sum(calls),0) into before_calls from pg_stat_xact_user_functions where schemaname='private' and funcname='can_access_finance_unit';
 select sum(amount) into total from public.financial_transactions where church_id='20000000-0000-4000-8000-000000000001' and congregation_id='30000000-0000-4000-8000-000000000001';
 select coalesce(sum(calls),0)-before_calls into used from pg_stat_xact_user_functions where schemaname='private' and funcname='can_access_finance_unit';
 perform pg_temp.assert_true(total=1000,'transaction sum preserves soft delete');
 perform pg_temp.assert_true(used<=50,format('transaction scope evaluations scale with rows: %s (budget 50)',used));
 select coalesce(sum(calls),0) into before_calls from pg_stat_xact_user_functions where schemaname='private' and funcname='can_access_finance_unit';
 select sum(amount) into total from public.financial_ledger_entries where church_id='20000000-0000-4000-8000-000000000001' and congregation_id='30000000-0000-4000-8000-000000000001';
 select coalesce(sum(calls),0)-before_calls into used from pg_stat_xact_user_functions where schemaname='private' and funcname='can_access_finance_unit';
 perform pg_temp.assert_true(total=1000,'ledger sum preserves soft delete');
 perform pg_temp.assert_true(used<=50,format('ledger scope evaluations scale with rows: %s (budget 50)',used));
end $$;
reset role;

select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000002',true);
set local role authenticated;
execute scope_counts(1000,0,'congregation reader cannot see headquarters or another church');
reset role;
-- A broad access without permission must not borrow permission from a narrow access.
insert into public.user_church_access(id,profile_id,church_id,role,access_scope,status) values
 ('40000000-0000-4000-8000-000000000005','10000000-0000-4000-8000-000000000002','20000000-0000-4000-8000-000000000001','VIEWER','CHURCH','ACTIVE');
insert into public.user_permission_overrides(access_id,permission_id,effect)
select '40000000-0000-4000-8000-000000000005',id,'DENY' from public.permissions where key='finance.view';
set local role authenticated;
execute scope_counts(1000,0,'permission and scope stay on the same access');
reset role;
update public.user_permission_overrides set effect='ALLOW' where access_id='40000000-0000-4000-8000-000000000005';
set local role authenticated;
execute scope_counts(1001,0,'grant is visible to the next prepared query');
reset role;
update public.user_permission_overrides set effect='DENY' where access_id='40000000-0000-4000-8000-000000000005';
insert into public.user_church_access(id,profile_id,church_id,role,access_scope,congregation_id,status) values
 ('40000000-0000-4000-8000-000000000006','10000000-0000-4000-8000-000000000002','20000000-0000-4000-8000-000000000002','TREASURER','CONGREGATION','30000000-0000-4000-8000-000000000003','ACTIVE');
insert into public.user_permission_overrides(access_id,permission_id,effect)
select '40000000-0000-4000-8000-000000000006',id,'ALLOW' from public.permissions where key='finance.view';
set local role authenticated;
execute scope_counts(1000,1,'independently authorized second church is readable');
reset role;
update public.user_church_access set deleted_at=now() where id='40000000-0000-4000-8000-000000000006';
set local role authenticated;
execute scope_counts(1000,0,'revoked second church is immediately unreadable');
reset role;
update public.user_permission_overrides set effect='DENY' where access_id='40000000-0000-4000-8000-000000000002' and permission_id=(select id from public.permissions where key='finance.view');
set local role authenticated;
execute scope_counts(0,0,'explicit permission denial is immediate');
reset role;

select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000004',true);
set local role authenticated;
execute scope_counts(1000,0,'regional reader cannot see headquarters outside region');
reset role;
insert into public.ministries(id,church_id,congregation_id,name) values
 ('50000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000001','Scope ministry');
update public.user_church_access set access_scope='MINISTRY',region_id=null,ministry_id='50000000-0000-4000-8000-000000000001' where id='40000000-0000-4000-8000-000000000004';
set local role authenticated;
execute scope_counts(0,0,'unassigned ministry cannot read a congregation');
reset role;
insert into public.financial_operational_assignments(church_id,access_id,congregation_id,created_by) values
 ('20000000-0000-4000-8000-000000000001','40000000-0000-4000-8000-000000000004','30000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001');
set local role authenticated;
execute scope_counts(1000,0,'local ministry sees its assigned unit');
reset role;
update public.financial_operational_assignments set congregation_id='30000000-0000-4000-8000-000000000002' where access_id='40000000-0000-4000-8000-000000000004';
set local role authenticated;
execute scope_counts(0,0,'assignment does not override local ministry scope');
reset role;
update public.ministries set is_global=true,congregation_id=null where id='50000000-0000-4000-8000-000000000001';
set local role authenticated;
execute scope_counts(1,0,'global ministry sees only its assigned unit');
reset role;
update public.ministries set status='INACTIVE' where id='50000000-0000-4000-8000-000000000001';
set local role authenticated;
execute scope_counts(0,0,'inactive ministry denied');
reset role;
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000001',true);
update public.profiles set status='BLOCKED' where id='10000000-0000-4000-8000-000000000001';
set local role authenticated;
execute scope_counts(0,0,'blocked profile denied');
reset role;
update public.profiles set status='ACTIVE' where id='10000000-0000-4000-8000-000000000001';
update public.congregations set deleted_at=now() where id='30000000-0000-4000-8000-000000000001';
set local role authenticated;
execute scope_counts(1,0,'deleted congregation denied');
reset role;
update public.churches set status='INACTIVE' where id='20000000-0000-4000-8000-000000000001';
set local role authenticated;
execute scope_counts(0,0,'inactive church denied');
reset role;
select set_config('request.jwt.claim.sub','',true);
set local role authenticated;
execute scope_counts(0,0,'authenticated role without identity sees nothing');
reset role;
select pg_temp.assert_true(not has_table_privilege('anon','public.financial_transactions','SELECT'),'anonymous transactions denied');
select pg_temp.assert_true(not has_table_privilege('anon','public.financial_ledger_entries','SELECT'),'anonymous ledger denied');
select pg_temp.assert_true(not has_table_privilege('authenticated','public.financial_transactions','UPDATE'),'direct transaction mutations remain denied');
select pg_temp.assert_true(not has_table_privilege('authenticated','public.financial_ledger_entries','INSERT'),'direct ledger insert remains denied');
deallocate scope_counts;
rollback;
