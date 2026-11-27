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
  no_role_item uuid;
  with_role_item uuid;
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
      and m.member_status = 'ACTIVE' and m.email = 'membro@example.invalid' and m.address = 'Rua Exemplo'
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

  -- O mesmo lote admite linhas com e sem cargo e mantém a escolha de sexo por linha.
  set local role authenticated;
  items := jsonb_build_array(
    jsonb_build_object('row_number', 2, 'source_data', '{}'::jsonb, 'full_name', 'Sem cargo',
      'normalized_name_key', 'sem cargo', 'role_raw', '', 'classification', 'VALID', 'decision', 'IMPORT'),
    jsonb_build_object('row_number', 3, 'source_data', '{}'::jsonb, 'full_name', 'Com cargo',
      'normalized_name_key', 'com cargo', 'role_raw', 'CT', 'role_id', member_role,
      'classification', 'VALID', 'decision', 'IMPORT'));
  batch := public.prepare_member_import_official(payload || jsonb_build_object('file_sha256', repeat('c',64)), items);
  reset role;
  select id into strict no_role_item from public.member_import_items where batch_id = batch and row_number = 2;
  select id into strict with_role_item from public.member_import_items where batch_id = batch and row_number = 3;
  perform set_config('request.jwt.claim.sub', gen_random_uuid()::text, true);
  set local role authenticated;
  begin
    perform public.resolve_member_import_official_item(batch, no_role_item, 'SET_GENDER_MALE');
    raise exception 'Alteração de sexo por outro usuário aceita';
  exception when raise_exception then
    if sqlerrm <> 'IMPORT_PERMISSION_DENIED' then raise; end if;
  end;
  perform set_config('request.jwt.claim.sub', actor::text, true);
  perform public.resolve_member_import_official_item(batch, no_role_item, 'SET_GENDER_MALE');
  perform public.resolve_member_import_official_item(batch, no_role_item, 'SET_GENDER_FEMALE');
  perform public.resolve_member_import_official_item(batch, with_role_item, 'SET_GENDER_FEMALE');
  perform public.resolve_member_import_official_item(batch, with_role_item, 'CLEAR_GENDER');
  perform public.execute_member_import(batch);
  begin
    perform public.resolve_member_import_official_item(batch, with_role_item, 'SET_GENDER_MALE');
    raise exception 'Edição de lote já concluído aceita';
  exception when raise_exception then
    if sqlerrm <> 'IMPORT_BATCH_INVALID_STATUS' then raise; end if;
  end;
  reset role;
  if not exists (select 1 from public.members m where m.source_import_batch_id = batch
      and m.full_name = 'Sem cargo' and m.gender = 'FEMALE'
      and not exists(select 1 from public.member_roles mr where mr.church_id = church and mr.member_id = m.id)
      and not exists(select 1 from public.member_history h where h.church_id = church and h.member_id = m.id and h.history_type = 'ROLE_ASSIGNED'))
    or not exists (select 1 from public.members m join public.member_roles mr on mr.member_id = m.id and mr.church_id = m.church_id
      where m.source_import_batch_id = batch and m.full_name = 'Com cargo' and m.gender is null and mr.role_id = member_role) then
    raise exception 'Cargo opcional ou sexo por membro divergente após a confirmação';
  end if;

  -- Planilha oficial. O contador passa da largura configurada dentro do mesmo lote.
  update public.app_settings set member_code_next_number=99, member_code_padding=2,
    member_code_prefix='T', enable_member_auto_code=true where church_id=church;
  items := jsonb_set(items, '{0,source_data}', '{"endereco":"Rua Teste, 42","bairro":"Centro","pais":"Portugal",
    "profissao":"Docente","nacionalidade":"Portuguesa","telefone_fixo":"1134567890","cadastro_legado":"2015-03-10"}');
  items := jsonb_set(items, '{0,received_date}', '"2015-03-10"');
  payload := payload || jsonb_build_object('file_sha256',repeat('d',64),'original_filename','limpa.xlsx',
    'settings_snapshot',jsonb_build_object('workbook_schema','congregation'));
  set local role authenticated;
  batch := public.prepare_member_import_official(payload,items);
  duplicate_batch := public.prepare_member_import_official(payload,items);
  perform public.execute_member_import(batch);
  begin
    perform public.execute_member_import(duplicate_batch);
    raise exception 'Mesmo lote confirmado duas vezes';
  exception when raise_exception then
    if sqlerrm <> 'IMPORT_DUPLICATE_CHANGED_DURING_CONFIRMATION' then raise; end if;
  end;
  reset role;
  if not exists (select 1 from public.members where source_import_batch_id=batch and church_id=church
    and member_code='T99' and address='Rua Teste, 42' and district='Centro' and country='Portugal'
    and profession='Docente' and nationality='Portuguesa' and legacy_registration_date=date '2015-03-10'
    and landline='1134567890' and whatsapp is null and received_date is null)
    or not exists (select 1 from public.members where source_import_batch_id=batch and member_code='T100')
    or exists (select 1 from public.member_history h join public.members m on m.id=h.member_id
      where m.source_import_batch_id=batch and h.history_type='MEMBER_RECEIVED') then
    raise exception 'Divergência na gravação da planilha de congregação';
  end if;

  -- A situação pertence ao lote inteiro e também se aplica a membros sem cargo.
  payload := jsonb_set(payload, '{settings_snapshot,member_status}', '"INACTIVE"')
    || jsonb_build_object('file_sha256', repeat('e',64));
  set local role authenticated;
  batch := public.prepare_member_import_official(payload, items);
  perform public.execute_member_import(batch);
  perform public.execute_member_import(batch);
  reset role;
  if (select count(*) from public.members m where m.church_id = church
    and m.source_import_batch_id = batch and m.member_status = 'INACTIVE' and m.deleted_at is null) <> 2 then
    raise exception 'Situação inativa do lote não foi aplicada a todos os cadastros';
  end if;
  set local role authenticated;
  begin
    perform public.prepare_member_import_official(jsonb_set(payload, '{settings_snapshot,member_status}', '"DECEASED"')
      || jsonb_build_object('file_sha256', repeat('f',64)), items);
    raise exception 'Situação inválida aceita na preparação do lote';
  exception when check_violation then
    null;
  end;
end;
$test$;

rollback;
