-- Read-only checks. All identity settings are transaction-local. Return no member data.
begin read only;
do $check$
declare
  a record;
  actual jsonb;
  expected_total integer;
  expected_male integer;
  expected_female integer;
  expected_roles jsonb;
  role_key text;
  expected_units jsonb;
  expected_areas jsonb;
  allowed boolean;
  organization boolean;
  roles_allowed boolean;
begin
  if has_function_privilege('anon','public.get_dashboard_member_summary(uuid)','execute')
    or has_function_privilege('anon','private.dashboard_congregation_roles(uuid)','execute')
    or not has_function_privilege('authenticated','public.get_dashboard_member_summary(uuid)','execute')
    then raise exception 'Unexpected dashboard function grants'; end if;

  for a in select access.* from public.user_church_access access
    join public.profiles p on p.id = access.profile_id and p.status = 'ACTIVE' and p.deleted_at is null
    join public.churches ch on ch.id = access.church_id and ch.status = 'ACTIVE' and ch.deleted_at is null
    where access.status = 'ACTIVE' and access.deleted_at is null
  loop
    perform set_config('request.jwt.claim.sub', a.profile_id::text, true);
    allowed := private.access_has_permission(a.id,'dashboard.view') and private.access_has_permission(a.id,'members.view_basic')
      and ((a.role = 'ADMIN' and a.access_scope = 'CHURCH') or
        (a.role in ('SECRETARY','TREASURER','VIEWER') and a.access_scope = 'CONGREGATION' and
          exists(select from public.congregations where id = a.congregation_id and church_id = a.church_id and deleted_at is null)));
    organization := private.access_has_permission(a.id,'organization.view');
    roles_allowed := private.access_has_permission(a.id,'member_roles.view') or (a.role = 'TREASURER' and not exists (
      select from public.user_permission_overrides o join public.permissions p on p.id = o.permission_id
      where o.access_id = a.id and o.effect = 'DENY' and o.deleted_at is null and p.key = 'member_roles.view' and p.deleted_at is null
    ));

    select count(*), count(*) filter(where gender='MALE'), count(*) filter(where gender='FEMALE')
      into expected_total, expected_male, expected_female from public.members where church_id=a.church_id
      and (a.access_scope='CHURCH' or congregation_id=a.congregation_id)
      and deleted_at is null and member_status='ACTIVE' and member_type in ('MEMBER','CHILD');

    select coalesce(jsonb_object_agg(id,n),'{}') into expected_roles from (
      select r.id,count(distinct m.id) n from public.members m
      join public.member_roles l on l.member_id=m.id and l.church_id=m.church_id and l.deleted_at is null and l.status='ACTIVE'
        and (a.access_scope='CHURCH' or l.congregation_id is null or l.congregation_id=a.congregation_id)
      join public.roles r on r.id=l.role_id and r.church_id=m.church_id and r.deleted_at is null and r.status='ACTIVE'
      where m.church_id=a.church_id and (a.access_scope='CHURCH' or m.congregation_id=a.congregation_id) and m.member_type in ('MEMBER','CHILD')
        and m.member_status='ACTIVE' and m.deleted_at is null group by r.id
    ) counts;

    select coalesce(jsonb_object_agg(c.id,(select count(*) from public.members m where m.church_id=a.church_id
      and m.congregation_id=c.id and m.member_type in ('MEMBER','CHILD') and m.member_status='ACTIVE' and m.deleted_at is null)), '{}')
      into expected_units from public.congregations c where c.church_id=a.church_id and c.deleted_at is null;
    select coalesce(jsonb_object_agg(r.id,(select count(*) from public.members m join public.congregations c
      on c.id=m.congregation_id and c.church_id=m.church_id and c.deleted_at is null where m.church_id=a.church_id
      and c.region_id=r.id and m.member_type in ('MEMBER','CHILD') and m.member_status='ACTIVE' and m.deleted_at is null)), '{}')
      into expected_areas from public.regions r where r.church_id=a.church_id and r.deleted_at is null;

    set local role authenticated;
    actual := public.get_dashboard_member_summary(a.id);
    if public.get_dashboard_member_summary(gen_random_uuid()) is not null then raise exception 'Unknown access accepted'; end if;
    perform set_config('request.jwt.claim.sub', gen_random_uuid()::text, true);
    if public.get_dashboard_member_summary(a.id) is not null or private.dashboard_congregation_roles(a.id) is not null then
      raise exception 'Another identity could read the dashboard';
    end if;
    reset role;

    if not allowed then
      if actual is not null then raise exception 'Unsupported access received indicators'; end if;
      continue;
    end if;
    if actual is null or (actual ->> 'total')::int <> expected_total or (actual ->> 'male')::int <> expected_male
      or (actual ->> 'female')::int <> expected_female then raise exception 'Incorrect member totals'; end if;
    if a.access_scope='CHURCH' and organization then
      if (select coalesce(jsonb_object_agg(v->>'id',v->'count'),'{}') from jsonb_array_elements(actual->'congregations') v) <> expected_units
        or (select coalesce(jsonb_object_agg(v->>'id',v->'count'),'{}') from jsonb_array_elements(actual->'regions') v) <> expected_areas
        then raise exception 'Incorrect field ranking'; end if;
    elsif actual->>'congregations' is not null or actual->>'regions' is not null then raise exception 'Unexpected field indicators';
    end if;
    role_key := case when a.access_scope='CHURCH' then 'fieldRoles' else 'roles' end;
    if actual->>(case when role_key='roles' then 'fieldRoles' else 'roles' end) is not null then
      raise exception 'Unexpected role ranking outside scope';
    end if;
    if roles_allowed then
      if (select coalesce(jsonb_object_agg(v->>'id',v->'count'),'{}') from jsonb_array_elements(actual->role_key) v) <> expected_roles
        or actual->>role_key is null then raise exception 'Incorrect role counts'; end if;
    elsif actual->>role_key is not null then raise exception 'Unexpected role indicators';
    end if;
  end loop;
end;
$check$;
rollback;
