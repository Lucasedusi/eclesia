-- Regressão do CSV com dados fictícios. Todas as operações são revertidas.
begin;

do $test$
declare
  actor uuid := gen_random_uuid();
  church uuid := gen_random_uuid();
  other_church uuid := gen_random_uuid();
  region uuid := gen_random_uuid();
  destination uuid := gen_random_uuid();
  other_unit uuid := gen_random_uuid();
  foreign_unit uuid := gen_random_uuid();
  member_role uuid := gen_random_uuid();
  access_id uuid := gen_random_uuid();
  batch uuid;
  duplicate_batch uuid;
  payload jsonb;
  items jsonb;
  forbidden jsonb;
begin
  if has_function_privilege('anon', 'public.prepare_member_import_official(jsonb,jsonb)', 'execute')
    or has_function_privilege('anon', 'public.execute_member_import(uuid)', 'execute') then
    raise exception 'Importação acessível ao perfil anônimo';
  end if;
  insert into auth.users(id, email) values (actor, actor || '@example.invalid');
  update public.profiles set status = 'ACTIVE' where id = actor;
  insert into public.churches(id, name) values (church, 'Teste CSV'), (other_church, 'Outro campo');
  insert into public.regions(id, church_id, name) values (region, church, 'Regional');
  insert into public.congregations(id, church_id, name, region_id, is_headquarters) values
    (destination, church, 'Destino', region, false), (other_unit, church, 'Outra congregação', null, true),
    (foreign_unit, other_church, 'Outro campo', null, true);
  insert into public.roles(id, church_id, name, abbreviation) values (member_role, church, 'Cargo do teste', 'CT');
  insert into public.app_settings(church_id) select church where not exists
    (select 1 from public.app_settings where church_id = church);
  insert into public.user_church_access(id, profile_id, church_id, role, access_scope, congregation_id)
    values (access_id, actor, church, 'SECRETARY', 'CONGREGATION', destination);
  insert into public.user_permission_overrides(access_id, permission_id, effect)
    select access_id, p.id, 'ALLOW' from public.permissions p where p.key = 'members.import' and p.deleted_at is null;
  payload := jsonb_build_object('church_id', church, 'congregation_id', destination,
    'file_sha256', repeat('a', 64), 'file_size_bytes', 120, 'original_filename', 'teste.CSV');
  items := jsonb_build_array(jsonb_build_object('row_number', 2, 'source_data',
    '{"id":"0001","identidade":"001X","endereco":"Rua Exemplo","email":"MEMBRO@example.invalid","dtcadastro":"2001-01-03"}'::jsonb,
    'full_name', 'Pessoa do teste', 'normalized_name_key', 'pessoa do teste', 'role_raw', 'CT',
    'role_id', member_role, 'received_date', '2001-01-03', 'classification', 'VALID', 'decision', 'IMPORT'));
  perform set_config('request.jwt.claim.sub', actor::text, true);
  set local role authenticated;

  for forbidden in select p from (values
    (payload || jsonb_build_object('congregation_id', other_unit)),
    (payload || jsonb_build_object('church_id', other_church, 'congregation_id', foreign_unit))) denied(p)
  loop
    begin
      perform public.prepare_member_import_official(forbidden, items);
      raise exception 'Destino fora do escopo aceito';
    exception when raise_exception then
      if sqlerrm <> 'IMPORT_PERMISSION_DENIED' then raise; end if;
    end;
  end loop;

  batch := public.prepare_member_import_official(payload, items);
  duplicate_batch := public.prepare_member_import_official(payload, items);
  perform public.execute_member_import(batch);
  perform public.execute_member_import(batch);
  begin
    perform public.execute_member_import(duplicate_batch);
    raise exception 'Segundo lote do mesmo CSV aceito';
  exception when raise_exception then
    if sqlerrm <> 'IMPORT_DUPLICATE_CHANGED_DURING_CONFIRMATION' then raise; end if;
  end;
  reset role;

  if (select count(*) from public.members where church_id = church) <> 1 or not exists (
    select 1 from public.members m
    join public.member_sensitive_identity s on s.member_id = m.id and s.church_id = m.church_id
    where m.source_import_batch_id = batch and m.congregation_id = destination
      and m.email = 'membro@example.invalid' and m.address = 'Rua Exemplo'
      and s.rg = '001X' and s.cpf is null and m.received_date is null
  ) or exists (select 1 from public.member_history where church_id = church and history_type = 'MEMBER_RECEIVED') then
    raise exception 'Divergência na gravação do CSV';
  end if;

  set local role authenticated;
  batch := public.prepare_member_import_official(
    payload || jsonb_build_object('original_filename', 'modelo.xlsx', 'file_sha256', repeat('b',64)),
    jsonb_set(items, '{0,source_data}', '{"dtcadastro":"2001-01-03"}'::jsonb));
  perform public.execute_member_import(batch);
  reset role;
  if not exists (
    select 1 from public.members m join public.member_history h on h.member_id = m.id and h.church_id = m.church_id
    where m.source_import_batch_id = batch and m.received_date = date '2001-01-03' and h.history_type = 'MEMBER_RECEIVED'
  ) then
    raise exception 'Data de recebimento do modelo XLSX não preservada';
  end if;
end;
$test$;

rollback;
