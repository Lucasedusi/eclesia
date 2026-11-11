-- The treasurer's dashboard exposes totals by role, including when individual
-- role assignments are not readable. This helper returns only grouped counts.
create function private.dashboard_congregation_roles(p_access_id uuid)
returns jsonb language plpgsql stable security definer set search_path = ''
as $$
declare
  a public.user_church_access%rowtype;
begin
  select access.* into a
  from public.user_church_access access
  join public.churches ch on ch.id = access.church_id and ch.status = 'ACTIVE' and ch.deleted_at is null
  join public.congregations c on c.id = access.congregation_id and c.church_id = access.church_id and c.deleted_at is null
  where access.id = p_access_id and access.profile_id = (select auth.uid())
    and access.status = 'ACTIVE' and access.deleted_at is null
    and access.access_scope = 'CONGREGATION' and access.role in ('SECRETARY','TREASURER','VIEWER');

  if not found or not private.access_has_permission(a.id, 'dashboard.view')
    or not private.access_has_permission(a.id, 'members.view_basic') then return null; end if;

  if not private.access_has_permission(a.id, 'member_roles.view') then
    if a.role <> 'TREASURER' or exists (
      select 1 from public.user_permission_overrides o
      join public.permissions p on p.id = o.permission_id
      where o.access_id = a.id and o.effect = 'DENY' and o.deleted_at is null
        and p.key = 'member_roles.view' and p.deleted_at is null
    ) then return null; end if;
  end if;

  return (
    select coalesce(jsonb_agg(to_jsonb(r)), '[]'::jsonb) from (
      select role.id, role.name, count(distinct m.id) as count
      from public.members m
      join public.member_roles link on link.member_id = m.id and link.church_id = a.church_id
        and link.status = 'ACTIVE' and link.deleted_at is null
        and (link.congregation_id is null or link.congregation_id = a.congregation_id)
      join public.roles role on role.id = link.role_id and role.church_id = a.church_id
        and role.deleted_at is null and role.status = 'ACTIVE'
      where m.church_id = a.church_id and m.congregation_id = a.congregation_id
        and m.deleted_at is null and m.member_status = 'ACTIVE' and m.member_type in ('MEMBER','CHILD')
      group by role.id, role.name
    ) r
  );
end;
$$;

revoke all on function private.dashboard_congregation_roles(uuid) from public, anon, authenticated, service_role;
grant execute on function private.dashboard_congregation_roles(uuid) to authenticated;

create function public.get_dashboard_member_summary(p_access_id uuid)
returns jsonb language plpgsql stable security invoker set search_path = ''
as $$
declare
  a public.user_church_access%rowtype;
  field boolean;
  organization boolean;
  unit_name text;
  totals jsonb;
  congregations jsonb;
  regions jsonb;
  roles jsonb;
begin
  select access.* into a from public.user_church_access access
  join public.churches ch on ch.id = access.church_id and ch.status = 'ACTIVE' and ch.deleted_at is null
  where access.id = p_access_id and access.profile_id = (select auth.uid())
    and access.status = 'ACTIVE' and access.deleted_at is null;
  if not found or not private.access_has_permission(a.id, 'dashboard.view')
    or not private.access_has_permission(a.id, 'members.view_basic') then return null; end if;

  field := a.role = 'ADMIN' and a.access_scope = 'CHURCH';
  organization := private.access_has_permission(a.id, 'organization.view');
  if not field then
    if a.access_scope <> 'CONGREGATION' or a.congregation_id is null
      or a.role not in ('SECRETARY','TREASURER','VIEWER') then return null; end if;
    if organization then
      select c.name into unit_name from public.congregations c
      where c.id = a.congregation_id and c.church_id = a.church_id and c.deleted_at is null;
      if not found then return null; end if;
    end if;
    roles := private.dashboard_congregation_roles(a.id);
  end if;

  select jsonb_build_object('total', count(*), 'male', count(*) filter (where m.gender = 'MALE'),
    'female', count(*) filter (where m.gender = 'FEMALE')) into totals
  from public.members m where m.church_id = a.church_id and (field or m.congregation_id = a.congregation_id)
    and m.deleted_at is null and m.member_status = 'ACTIVE' and m.member_type in ('MEMBER','CHILD');

  if field and organization then
    with member_counts as (
      select m.congregation_id, count(*) as count from public.members m where m.church_id = a.church_id
        and m.deleted_at is null and m.member_status = 'ACTIVE' and m.member_type in ('MEMBER','CHILD')
      group by m.congregation_id
    ), units as materialized (
      select c.id, c.name, c.region_id, coalesce(mc.count, 0) as count from public.congregations c
      left join member_counts mc on mc.congregation_id = c.id
      where c.church_id = a.church_id and c.deleted_at is null
    ), areas as (
      select r.id, r.name, coalesce(sum(u.count), 0) as count from public.regions r
      left join units u on u.region_id = r.id where r.church_id = a.church_id and r.deleted_at is null
      group by r.id, r.name
    )
    select (select coalesce(jsonb_agg(to_jsonb(u) - 'region_id'), '[]'::jsonb) from units u),
           (select coalesce(jsonb_agg(to_jsonb(r)), '[]'::jsonb) from areas r)
    into congregations, regions;
  end if;

  return totals || jsonb_build_object('congregationName', unit_name, 'congregations', congregations,
    'regions', regions, 'roles', roles);
end;
$$;

revoke all on function public.get_dashboard_member_summary(uuid) from public, anon, authenticated, service_role;
grant execute on function public.get_dashboard_member_summary(uuid) to authenticated;
