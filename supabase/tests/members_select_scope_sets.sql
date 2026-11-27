-- Local-only regression, run as postgres. Compare exact visible IDs under RLS
-- to both the previous policy's predicates and the independently specified fixtures.
begin;
set local statement_timeout = '60s';
set local track_functions = 'all';

create function pg_temp.assert_member_scope(
  scenario text, caller uuid, candidates uuid[], expected uuid[]
) returns void language plpgsql as $$
declare
  previous_ids uuid[];
  actual_ids uuid[];
begin
  perform set_config('request.jwt.claim.sub', caller::text, true);
  select coalesce(array_agg(m.id order by m.id), '{}') into previous_ids
  from public.members m
  where m.id = any(candidates)
    and public.can_access_member(m.church_id, m.id, m.congregation_id)
    and ((m.deleted_at is null and public.has_permission(m.church_id, 'members.view_basic'))
      or (m.deleted_at is not null and public.has_permission(m.church_id, 'members.restore')));

  set local role authenticated;
  select coalesce(array_agg(m.id order by m.id), '{}') into actual_ids
  from public.members m where m.id = any(candidates);
  reset role;

  if actual_ids <> previous_ids
    or actual_ids <> array(select id from unnest(expected) id order by id) then
    raise exception 'Unexpected member visibility for %', scenario;
  end if;
end;
$$;

do $test$
declare
  home uuid := gen_random_uuid();
  other uuid := gen_random_uuid();
  region uuid := gen_random_uuid();
  ministry uuid := gen_random_uuid();
  units uuid[] := array(select gen_random_uuid() from generate_series(1, 3));
  users uuid[] := array(select gen_random_uuid() from generate_series(1, 6));
  accesses uuid[] := array(select gen_random_uuid() from generate_series(1, 7));
  members uuid[] := array(select gen_random_uuid() from generate_series(1, 7));
  basic uuid;
  restore uuid;
  permission_calls bigint;
  calls_after bigint;
  visible integer;
begin
  if has_table_privilege('anon', 'public.members', 'select')
    or has_function_privilege('anon', 'private.member_read_scopes(text)', 'execute')
    or not has_function_privilege('authenticated', 'private.member_read_scopes(text)', 'execute') then
    raise exception 'Unexpected member SELECT or helper grants';
  end if;

  insert into auth.users(id, email) select id, id || '@example.invalid' from unnest(users) id;
  update public.profiles set status = 'ACTIVE' where id = any(users);
  insert into public.churches(id, name) values (home, 'Member scope A'), (other, 'Member scope B');
  insert into public.regions(id, church_id, name) values (region, home, 'Member scope region');
  insert into public.congregations(id, church_id, name, region_id, is_headquarters) values
    (units[1], home, 'Member scope unit A', region, false),
    (units[2], home, 'Member scope unit B', null, true),
    (units[3], other, 'Member scope unit C', null, true);
  insert into public.ministries(id, church_id, congregation_id, name)
    values (ministry, home, units[1], 'Member scope ministry');
  insert into public.members(id, church_id, congregation_id, full_name, deleted_at) values
    (members[1], home, units[1], 'Ministry active A', null),
    (members[2], home, units[1], 'Ministry archived', now()),
    (members[3], home, units[2], 'Ministry active B', null),
    (members[4], home, units[2], 'Archived outside ministry', now()),
    (members[5], other, units[3], 'Other church', null),
    (members[6], home, units[1], 'Ended ministry link', null),
    (members[7], home, units[2], 'Deleted ministry link', null);
  insert into public.member_ministries(church_id, member_id, ministry_id, status, deleted_at) values
    (home, members[1], ministry, 'ACTIVE', null),
    (home, members[2], ministry, 'ACTIVE', null),
    (home, members[3], ministry, 'ACTIVE', null),
    (home, members[6], ministry, 'ENDED', null),
    (home, members[7], ministry, 'ACTIVE', now());
  insert into public.user_church_access(id, profile_id, church_id, role, access_scope, region_id, congregation_id, ministry_id, status) values
    (accesses[1], users[1], home, 'ADMIN', 'CHURCH', null, null, null, 'ACTIVE'),
    (accesses[2], users[2], home, 'VIEWER', 'CONGREGATION', null, units[1], null, 'ACTIVE'),
    (accesses[3], users[3], home, 'VIEWER', 'REGION', region, null, null, 'ACTIVE'),
    (accesses[4], users[4], home, 'MINISTRY_LEADER', 'MINISTRY', null, null, ministry, 'ACTIVE'),
    (accesses[5], users[5], home, 'ACCOUNTANT', 'CONGREGATION', null, units[1], null, 'ACTIVE');

  select id into strict basic from public.permissions where key = 'members.view_basic' and deleted_at is null;
  select id into strict restore from public.permissions where key = 'members.restore' and deleted_at is null;
  insert into public.user_permission_overrides(access_id, permission_id, effect) values
    (accesses[2], basic, 'ALLOW'), (accesses[2], restore, 'DENY'),
    (accesses[3], basic, 'ALLOW'), (accesses[3], restore, 'DENY'),
    (accesses[4], basic, 'ALLOW'), (accesses[4], restore, 'ALLOW'),
    (accesses[5], basic, 'ALLOW'), (accesses[5], restore, 'ALLOW');

  perform pg_temp.assert_member_scope('church', users[1], members, array[members[1],members[2],members[3],members[4],members[6],members[7]]);
  perform pg_temp.assert_member_scope('congregation', users[2], members, array[members[1],members[6]]);
  perform pg_temp.assert_member_scope('region', users[3], members, array[members[1],members[6]]);
  update public.congregations set status = 'INACTIVE' where id = units[1];
  perform pg_temp.assert_member_scope('region with inactive congregation', users[3], members, array[members[1],members[6]]);
  update public.congregations set status = 'ACTIVE' where id = units[1];
  perform pg_temp.assert_member_scope('ministry', users[4], members, array[members[1],members[2],members[3]]);
  perform pg_temp.assert_member_scope('accountant with overrides', users[5], members, '{}');
  perform pg_temp.assert_member_scope('no access', users[6], members, '{}');

  update public.user_permission_overrides set effect = 'DENY' where access_id = accesses[4] and permission_id = basic;
  perform pg_temp.assert_member_scope('restore only', users[4], members, array[members[2]]);
  update public.user_permission_overrides set effect = 'DENY' where access_id = accesses[4] and permission_id = restore;
  perform pg_temp.assert_member_scope('both denied', users[4], members, '{}');

  -- Basic comes from the congregation access; the wider access supplies scope.
  insert into public.user_church_access(id, profile_id, church_id, role, access_scope, status)
    values (accesses[6], users[2], home, 'VIEWER', 'CHURCH', 'ACTIVE');
  insert into public.user_permission_overrides(access_id, permission_id, effect) values
    (accesses[6], basic, 'DENY'), (accesses[6], restore, 'DENY');
  perform pg_temp.assert_member_scope('permission and scope from different accesses', users[2], members, array[members[1],members[3],members[6],members[7]]);
  insert into public.user_church_access(id, profile_id, church_id, role, access_scope, congregation_id, status)
    values (accesses[7], users[2], other, 'VIEWER', 'CONGREGATION', units[3], 'ACTIVE');
  insert into public.user_permission_overrides(access_id, permission_id, effect) values (accesses[7], basic, 'ALLOW');
  perform pg_temp.assert_member_scope('second church independently granted', users[2], members, array[members[1],members[3],members[5],members[6],members[7]]);
  update public.user_church_access set deleted_at = now() where id = accesses[6];
  update public.user_church_access set status = 'INACTIVE' where id = accesses[7];
  perform pg_temp.assert_member_scope('revocations', users[2], members, array[members[1],members[6]]);

  update public.profiles set status = 'BLOCKED' where id = users[3];
  perform pg_temp.assert_member_scope('blocked profile', users[3], members, '{}');
  update public.churches set status = 'INACTIVE' where id = home;
  perform pg_temp.assert_member_scope('inactive church', users[1], members, '{}');
  update public.churches set status = 'ACTIVE' where id = home;

  -- The number of permission evaluations must stay bounded as member count grows.
  insert into public.members(church_id, congregation_id, full_name)
    select home, units[1], 'Scope volume ' || n from generate_series(1, 128) n;
  perform set_config('request.jwt.claim.sub', users[1]::text, true);
  select coalesce(sum(calls), 0) into permission_calls from pg_stat_xact_user_functions
    where schemaname = 'public' and funcname = 'get_my_permissions';
  set local role authenticated;
  select count(*) into visible from public.members m where m.church_id = home and m.deleted_at is null;
  reset role;
  select coalesce(sum(calls), 0) into calls_after from pg_stat_xact_user_functions
    where schemaname = 'public' and funcname = 'get_my_permissions';
  if visible <> 132 or calls_after - permission_calls not between 1 and 3 then
    raise exception 'Unexpected member count (%) or permission evaluation count (%)', visible, calls_after - permission_calls;
  end if;
end;
$test$;
rollback;
