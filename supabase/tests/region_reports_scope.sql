-- LOCAL ONLY: synthetic fixtures, entirely rolled back.
begin;
insert into auth.users(id, email) values
 ('a1000000-0000-4000-8000-000000000001', 'region-admin@example.invalid'),
 ('a1000000-0000-4000-8000-000000000002', 'region-secretary@example.invalid'),
 ('a1000000-0000-4000-8000-000000000003', 'congregation-secretary@example.invalid'),
 ('a1000000-0000-4000-8000-000000000004', 'region-viewer@example.invalid');
insert into public.profiles(id, full_name, status)
select id, 'Relatório fictício', 'ACTIVE' from auth.users where id::text like 'a1000000-%'
on conflict(id) do update set status = 'ACTIVE';
insert into public.churches(id, name) values
 ('a2000000-0000-4000-8000-000000000001', 'Igreja de teste A'),
 ('a2000000-0000-4000-8000-000000000002', 'Igreja de teste B');
insert into public.regions(id, church_id, name, deleted_at) values
 ('a3000000-0000-4000-8000-000000000001', 'a2000000-0000-4000-8000-000000000001', 'Regional A', null),
 ('a3000000-0000-4000-8000-000000000002', 'a2000000-0000-4000-8000-000000000001', 'Regional B', null),
 ('a3000000-0000-4000-8000-000000000003', 'a2000000-0000-4000-8000-000000000001', 'Regional arquivada', now()),
 ('a3000000-0000-4000-8000-000000000004', 'a2000000-0000-4000-8000-000000000002', 'Outra igreja', null);
insert into public.congregations(id, church_id, region_id, name) values
 ('a4000000-0000-4000-8000-000000000001', 'a2000000-0000-4000-8000-000000000001', 'a3000000-0000-4000-8000-000000000001', 'Congregação A'),
 ('a4000000-0000-4000-8000-000000000002', 'a2000000-0000-4000-8000-000000000001', 'a3000000-0000-4000-8000-000000000001', 'Congregação B'),
 ('a4000000-0000-4000-8000-000000000003', 'a2000000-0000-4000-8000-000000000001', 'a3000000-0000-4000-8000-000000000002', 'Congregação C');
insert into public.user_church_access(profile_id, church_id, role, access_scope, region_id, congregation_id, status) values
 ('a1000000-0000-4000-8000-000000000001', 'a2000000-0000-4000-8000-000000000001', 'ADMIN', 'CHURCH', null, null, 'ACTIVE'),
 ('a1000000-0000-4000-8000-000000000002', 'a2000000-0000-4000-8000-000000000001', 'SECRETARY', 'REGION', 'a3000000-0000-4000-8000-000000000001', null, 'ACTIVE'),
 ('a1000000-0000-4000-8000-000000000003', 'a2000000-0000-4000-8000-000000000001', 'SECRETARY', 'CONGREGATION', null, 'a4000000-0000-4000-8000-000000000001', 'ACTIVE'),
 ('a1000000-0000-4000-8000-000000000004', 'a2000000-0000-4000-8000-000000000001', 'VIEWER', 'CHURCH', null, null, 'ACTIVE');

set local role anon;
do $$ begin
  begin
    if (select count(*) from public.regions) <> 0 then raise exception 'anonymous regional access'; end if;
  exception when insufficient_privilege then null;
  end;
end $$;
reset role;
select set_config('request.jwt.claim.sub', 'a1000000-0000-4000-8000-000000000001', true);
set local role authenticated;
do $$ begin
  if not public.has_permission('a2000000-0000-4000-8000-000000000001', 'regions.reports.export') then raise exception 'admin export denied'; end if;
  if (select count(*) from public.regions) <> 2 then raise exception 'admin tenant/archive scope incorrect'; end if;
end $$;
reset role;
select set_config('request.jwt.claim.sub', 'a1000000-0000-4000-8000-000000000002', true);
set local role authenticated;
do $$ begin
  if not public.has_permission('a2000000-0000-4000-8000-000000000001', 'regions.reports.export') then raise exception 'secretary export denied'; end if;
  if (select count(*) from public.regions) <> 1 or (select count(*) from public.congregations) <> 2 then raise exception 'regional scope incorrect'; end if;
end $$;
reset role;
select set_config('request.jwt.claim.sub', 'a1000000-0000-4000-8000-000000000003', true);
set local role authenticated;
do $$ begin
  if (select count(*) from public.regions) <> 1 or (select count(*) from public.congregations) <> 1 then raise exception 'congregational scope incorrect'; end if;
  if public.can_access_region('a2000000-0000-4000-8000-000000000001', 'a3000000-0000-4000-8000-000000000002') then raise exception 'wrong regional allowed'; end if;
end $$;
reset role;
select set_config('request.jwt.claim.sub', 'a1000000-0000-4000-8000-000000000004', true);
set local role authenticated;
do $$ begin
  if public.has_permission('a2000000-0000-4000-8000-000000000001', 'regions.reports.export') then raise exception 'viewer export allowed by default'; end if;
end $$;
reset role;
rollback;
