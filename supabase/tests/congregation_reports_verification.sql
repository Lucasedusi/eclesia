-- Read-only catalog checks; safe for the explicitly authorized project.
begin read only;
do $$
begin
  if (select count(*) from public.permissions where key = 'congregations.reports.export' and status = 'ACTIVE' and deleted_at is null and is_sensitive and module = 'organization') <> 1 then
    raise exception 'regional report export permission missing or invalid';
  end if;
  if (select array_agg(rp.role order by rp.role) from public.role_permissions rp join public.permissions p on p.id = rp.permission_id where p.key = 'congregations.reports.export' and p.deleted_at is null and rp.deleted_at is null and rp.status = 'ACTIVE') is distinct from array['ADMIN', 'SECRETARY']::text[] then
    raise exception 'regional report default grants differ from ADMIN/SECRETARY';
  end if;
  if exists (select 1 from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'public' and c.relname in ('regions', 'congregations') and not c.relrowsecurity) then
    raise exception 'organization RLS disabled';
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'regions' and policyname = 'regions_select_scope' and qual like '%organization.view%' and qual like '%can_access_region%' and qual like '%deleted_at%') then
    raise exception 'regional select scope missing';
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'congregations' and policyname = 'congregations_select_scope' and qual like '%organization.view%' and qual like '%can_access_congregation%' and qual like '%deleted_at%') then
    raise exception 'congregation select scope missing';
  end if;
end $$;
rollback;
