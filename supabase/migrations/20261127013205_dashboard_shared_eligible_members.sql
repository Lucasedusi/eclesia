-- The birthday panel and the aggregate use the same authenticated access gate.
-- Checking the scope does not read the member roster.
create function public.get_dashboard_member_scope(p_access_id uuid)
returns table (
  church_id uuid, congregation_id uuid, is_field boolean, congregation_name text,
  view_organization boolean, view_contact boolean
)
language sql stable security invoker set search_path = '' as $$
  with permitted as materialized (
    select a.church_id, a.congregation_id, a.access_scope = 'CHURCH' as is_field,
      private.access_has_permission(a.id, 'organization.view') as view_organization,
      private.access_has_permission(a.id, 'members.view_full') as view_contact
    from public.user_church_access a
    join public.churches ch on ch.id = a.church_id and ch.status = 'ACTIVE' and ch.deleted_at is null
    where a.id = p_access_id and a.profile_id = (select auth.uid())
      and a.status = 'ACTIVE' and a.deleted_at is null
      and private.access_has_permission(a.id, 'dashboard.view')
      and private.access_has_permission(a.id, 'members.view_basic')
      and ((a.role = 'ADMIN' and a.access_scope = 'CHURCH') or
        (a.role in ('SECRETARY', 'TREASURER', 'VIEWER') and a.access_scope = 'CONGREGATION'
          and a.congregation_id is not null))
  )
  select p.church_id, p.congregation_id, p.is_field, c.name, p.view_organization, p.view_contact
  from permitted p
  left join public.congregations c on not p.is_field and p.view_organization
    and c.id = p.congregation_id and c.church_id = p.church_id and c.deleted_at is null
  where p.is_field or not p.view_organization or c.id is not null;
$$;

revoke all on function public.get_dashboard_member_scope(uuid) from public, anon, authenticated, service_role;
grant execute on function public.get_dashboard_member_scope(uuid) to authenticated;

create or replace function public.get_dashboard_member_summary(p_access_id uuid)
returns jsonb language plpgsql stable security invoker set search_path = ''
as $$
declare
  scope record;
  organization boolean;
  rank_field_roles boolean;
  summary jsonb;
begin
  select * into scope from public.get_dashboard_member_scope(p_access_id);
  if not found then return null; end if;
  organization := scope.is_field and scope.view_organization;
  rank_field_roles := scope.is_field and private.access_has_permission(p_access_id, 'member_roles.view');

  with eligible as materialized (
    select m.id, m.congregation_id, m.gender
    from public.members m
    where m.church_id = scope.church_id and (scope.is_field or m.congregation_id = scope.congregation_id)
      and m.deleted_at is null and m.member_status = 'ACTIVE' and m.member_type in ('MEMBER', 'CHILD')
  ), member_counts as materialized (
    select e.congregation_id, count(*) as total,
      count(*) filter (where e.gender = 'MALE') as male,
      count(*) filter (where e.gender = 'FEMALE') as female
    from eligible e group by e.congregation_id
  ), units as materialized (
    select c.id, c.name, c.region_id, coalesce(mc.total, 0) as count
    from public.congregations c left join member_counts mc on mc.congregation_id = c.id
    where c.church_id = scope.church_id and c.deleted_at is null
  ), areas as (
    select r.id, r.name, coalesce(sum(u.count), 0) as count
    from public.regions r left join units u on u.region_id = r.id
    where r.church_id = scope.church_id and r.deleted_at is null group by r.id, r.name
  ), field_roles as (
    select r.id, r.name, count(*) as count from public.member_roles link
    join eligible e on e.id = link.member_id
    join public.roles r on r.id = link.role_id and r.church_id = link.church_id
    where link.church_id = scope.church_id and link.status = 'ACTIVE' and link.deleted_at is null
      and r.status = 'ACTIVE' and r.deleted_at is null
    group by r.id, r.name
  )
  select jsonb_build_object(
    'total', coalesce(sum(mc.total), 0), 'male', coalesce(sum(mc.male), 0), 'female', coalesce(sum(mc.female), 0),
    'congregationName', scope.congregation_name,
    'congregations', case when organization then
      (select coalesce(jsonb_agg(to_jsonb(u) - 'region_id'), '[]'::jsonb) from units u) end,
    'regions', case when organization then (select coalesce(jsonb_agg(to_jsonb(r)), '[]'::jsonb) from areas r) end,
    'fieldRoles', case when rank_field_roles then (select coalesce(jsonb_agg(to_jsonb(r)), '[]'::jsonb) from field_roles r) end,
    -- The scoped treasurer can read grouped counts without individual assignments.
    'roles', case when not scope.is_field then private.dashboard_congregation_roles(p_access_id) end
  ) into summary from member_counts mc;
  return summary;
end;
$$;
