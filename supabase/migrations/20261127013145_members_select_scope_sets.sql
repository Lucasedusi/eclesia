begin;

-- Build hashable scope sets for this statement without scanning the member list.
-- Permissions are unioned across the caller's accesses in a church, independently
-- of which access supplies the matching scope (the original policy's semantics).
create function private.member_read_scopes(p_target text)
returns table (church_id uuid, target_id uuid, archived boolean)
language sql stable security definer set search_path = '' as $$
  with accesses as materialized (
    select a.church_id, a.access_scope, a.region_id, a.congregation_id, a.ministry_id
    from public.user_church_access a
    where a.profile_id = (select auth.uid())
      and a.role <> 'ACCOUNTANT' and a.status = 'ACTIVE' and a.deleted_at is null
      and (
        (p_target = 'CHURCH' and a.access_scope = 'CHURCH')
        or (p_target = 'CONGREGATION' and a.access_scope in ('REGION', 'CONGREGATION'))
        or (p_target = 'MEMBER' and a.access_scope = 'MINISTRY')
      )
  ), permissions as materialized (
    select ch.church_id, p.permission_key = 'members.restore' as archived
    from (select distinct a.church_id from accesses a) ch
    cross join lateral public.get_my_permissions(ch.church_id) p
    where p.permission_key in ('members.view_basic', 'members.restore')
  ), scopes as (
    select a.church_id, a.church_id as target_id, p.archived
    from accesses a join permissions p on p.church_id = a.church_id
    where a.access_scope = 'CHURCH'
    union all
    select a.church_id, a.congregation_id, p.archived
    from accesses a join permissions p on p.church_id = a.church_id
    where a.access_scope = 'CONGREGATION'
    union all
    select a.church_id, c.id, p.archived
    from accesses a join permissions p on p.church_id = a.church_id
    join public.congregations c on c.church_id = a.church_id and c.region_id = a.region_id
    where a.access_scope = 'REGION'
    union all
    select a.church_id, m.id, p.archived
    from accesses a join permissions p on p.church_id = a.church_id
    join public.member_ministries mm on mm.ministry_id = a.ministry_id
      and mm.status = 'ACTIVE' and mm.deleted_at is null
    join public.members m on m.id = mm.member_id and m.church_id = a.church_id
      and (m.deleted_at is not null) = p.archived
    where a.access_scope = 'MINISTRY'
  )
  select distinct s.church_id, s.target_id, s.archived from scopes s;
$$;

revoke all on function private.member_read_scopes(text) from public, anon, authenticated, service_role;
grant execute on function private.member_read_scopes(text) to authenticated;

alter policy members_select_scope on public.members using (
  (church_id, deleted_at is not null) in (
    select s.church_id, s.archived from private.member_read_scopes('CHURCH') s
  )
  or (church_id, congregation_id, deleted_at is not null) in (
    select s.church_id, s.target_id, s.archived from private.member_read_scopes('CONGREGATION') s
  )
  or (church_id, id, deleted_at is not null) in (
    select s.church_id, s.target_id, s.archived from private.member_read_scopes('MEMBER') s
  )
);

commit;
