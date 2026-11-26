-- LOCAL ONLY: synthetic fixtures, entirely rolled back.
begin;
insert into auth.users(id, email) values
 ('a1000000-0000-4000-8000-000000000001', 'region-admin@example.invalid'),
 ('a1000000-0000-4000-8000-000000000002', 'region-secretary@example.invalid'),
 ('a1000000-0000-4000-8000-000000000003', 'congregation-secretary@example.invalid'),
 ('a1000000-0000-4000-8000-000000000004', 'region-viewer@example.invalid'),
 ('a1000000-0000-4000-8000-000000000005', 'utility-accountant@example.invalid');
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
insert into public.congregations(id, church_id, region_id, name, deleted_at) values
 ('a4000000-0000-4000-8000-000000000004', 'a2000000-0000-4000-8000-000000000002', 'a3000000-0000-4000-8000-000000000004', 'Outra igreja', null),
 ('a4000000-0000-4000-8000-000000000005', 'a2000000-0000-4000-8000-000000000001', 'a3000000-0000-4000-8000-000000000001', 'Arquivada', now());
insert into public.user_church_access(profile_id, church_id, role, access_scope, region_id, congregation_id, status) values
 ('a1000000-0000-4000-8000-000000000001', 'a2000000-0000-4000-8000-000000000001', 'ADMIN', 'CHURCH', null, null, 'ACTIVE'),
 ('a1000000-0000-4000-8000-000000000002', 'a2000000-0000-4000-8000-000000000001', 'SECRETARY', 'REGION', 'a3000000-0000-4000-8000-000000000001', null, 'ACTIVE'),
 ('a1000000-0000-4000-8000-000000000003', 'a2000000-0000-4000-8000-000000000001', 'SECRETARY', 'CONGREGATION', null, 'a4000000-0000-4000-8000-000000000001', 'ACTIVE'),
 ('a1000000-0000-4000-8000-000000000004', 'a2000000-0000-4000-8000-000000000001', 'VIEWER', 'CHURCH', null, null, 'ACTIVE'),
 ('a1000000-0000-4000-8000-000000000005', 'a2000000-0000-4000-8000-000000000001', 'ACCOUNTANT', 'CONGREGATION', null, 'a4000000-0000-4000-8000-000000000001', 'ACTIVE');

set local role anon;
do $$ begin
  if has_table_privilege('anon', 'public.congregation_utility_accounts', 'SELECT')
    or has_function_privilege('anon', 'public.save_congregation_registration(uuid,jsonb,text,text,uuid)', 'EXECUTE') then
    raise exception 'anonymous utility grant';
  end if;
  begin
    if (select count(*) from public.regions) <> 0 or (select count(*) from public.congregations) <> 0 then raise exception 'anonymous regional access'; end if;
  exception when insufficient_privilege then null;
  end;
end $$;
reset role;
select set_config('request.jwt.claim.sub', 'a1000000-0000-4000-8000-000000000001', true);
set local role authenticated;
do $$ begin
  if not public.has_permission('a2000000-0000-4000-8000-000000000001', 'congregations.reports.export') then raise exception 'admin export denied'; end if;
  perform public.save_congregation_registration(c.church_id, to_jsonb(c), '00123-X', '00084/9', c.id)
    from public.congregations c;
  if (select count(*) from public.congregation_utility_accounts where energy_unit = '00123-X' and water_account = '00084/9') <> 3 then
    raise exception 'admin utility save failed';
  end if;
  begin
    perform public.save_congregation_registration(c.church_id, to_jsonb(c) || '{"name":"Rollback esperado"}'::jsonb, repeat('1', 65), '', c.id)
      from public.congregations c limit 1;
    raise exception 'oversize utility account accepted';
  exception when string_data_right_truncation then null;
  end;
  if exists(select 1 from public.congregations where name = 'Rollback esperado') then raise exception 'partial registration saved'; end if;
  if (select count(*) from public.regions) <> 2 or (select count(*) from public.congregations) <> 3 then raise exception 'admin tenant/archive scope incorrect'; end if;
end $$;
reset role;
select set_config('request.jwt.claim.sub', 'a1000000-0000-4000-8000-000000000002', true);
set local role authenticated;
do $$ begin
  if not public.has_permission('a2000000-0000-4000-8000-000000000001', 'congregations.reports.export') then raise exception 'secretary export denied'; end if;
  if (select count(*) from public.congregation_utility_accounts) <> 2 then raise exception 'utility region scope incorrect'; end if;
  update public.congregation_utility_accounts set energy_unit = 'denied';
  if found then raise exception 'secretary edited account'; end if;
  if (select count(*) from public.regions) <> 1 or (select count(*) from public.congregations) <> 2 then raise exception 'regional scope incorrect'; end if;
end $$;
reset role;
select set_config('request.jwt.claim.sub', 'a1000000-0000-4000-8000-000000000003', true);
set local role authenticated;
do $$ begin
  if (select count(*) from public.congregation_utility_accounts) <> 1 then raise exception 'utility congregation scope incorrect'; end if;
  if (select count(*) from public.regions) <> 1 or (select count(*) from public.congregations) <> 1 then raise exception 'congregational scope incorrect'; end if;
  if public.can_access_region('a2000000-0000-4000-8000-000000000001', 'a3000000-0000-4000-8000-000000000002') then raise exception 'wrong regional allowed'; end if;
end $$;
reset role;
select set_config('request.jwt.claim.sub', 'a1000000-0000-4000-8000-000000000004', true);
set local role authenticated;
do $$ begin
  if public.has_permission('a2000000-0000-4000-8000-000000000001', 'congregations.reports.export') then raise exception 'viewer export allowed by default'; end if;
end $$;
reset role;
select set_config('request.jwt.claim.sub', 'a1000000-0000-4000-8000-000000000005', true);
set local role authenticated;
do $$ begin
  assert exists(select from public.congregations), 'accountant should see assigned financial unit';
  assert not exists(select from public.congregation_utility_accounts), 'accountant read administrative identifiers';
end $$;
reset role;
select set_config('request.jwt.claim.sub', 'a1000000-0000-4000-8000-000000000001', true);
set local role authenticated;
do $$
declare
  church constant uuid := 'a2000000-0000-4000-8000-000000000001';
  payload jsonb := '{"region_id":"a3000000-0000-4000-8000-000000000001", "name":"Cadastro de teste", "display_order":0, "country":"Brasil", "status":"ACTIVE"}';
  created_id uuid;
begin
  created_id := public.save_congregation_registration(church, payload, '001-0', 'W/20');
  assert exists(select from public.congregation_utility_accounts where church_id = church and congregation_id = created_id and energy_unit = '001-0' and water_account = 'W/20');
  perform public.save_congregation_registration(church, payload, '', 'W/20', created_id);
  assert exists(select from public.congregation_utility_accounts where congregation_id = created_id and energy_unit is null and water_account = 'W/20');
end $$;
reset role;
do $$ begin
  assert exists(select from public.audit_logs where action = 'CONGREGATION_UTILITIES_UPDATED'
    and church_id = 'a2000000-0000-4000-8000-000000000001'), 'missing utility audit';
  assert not exists(select from public.audit_logs a where a.church_id = 'a2000000-0000-4000-8000-000000000001'
    and to_jsonb(a)::text like '%00123-X%'), 'utility identifier leaked into audit';
end $$;
rollback;
