-- Amplia a importação em lote de membros para o modelo cadastral de 13 campos.
-- O formato anterior de sete colunas permanece compatível: os novos campos são opcionais.

alter table public.member_import_items
  add column if not exists gender_raw text,
  add column if not exists gender text,
  add column if not exists natural_city text,
  add column if not exists natural_state text,
  add column if not exists father_name text,
  add column if not exists mother_name text,
  add column if not exists baptism_date date;

alter table public.member_import_items
  drop constraint if exists member_import_items_source_check,
  drop constraint if exists member_import_items_gender_check,
  drop constraint if exists member_import_items_natural_state_check,
  drop constraint if exists member_import_items_extended_lengths_check,
  drop constraint if exists member_import_items_dates_check;

alter table public.member_import_items
  add constraint member_import_items_source_check check (
    jsonb_typeof(source_data) = 'object'
    and source_data - array[
      'nome', 'fone', 'dtnascimento', 'cargo', 'cpf', 'estadocivil', 'dtcadastro',
      'sexo', 'naturalidade_cidade', 'naturalidade_uf', 'nome_pai', 'nome_mae',
      'data_batismo'
    ] = '{}'::jsonb
  ),
  add constraint member_import_items_gender_check check (
    gender is null or gender in ('MALE', 'FEMALE')
  ),
  add constraint member_import_items_natural_state_check check (
    natural_state is null or natural_state in (
      'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS',
      'MG', 'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN', 'RS', 'RO', 'RR', 'SC',
      'SP', 'SE', 'TO'
    )
  ),
  add constraint member_import_items_extended_lengths_check check (
    (natural_city is null or char_length(natural_city) <= 120)
    and (father_name is null or char_length(father_name) <= 160)
    and (mother_name is null or char_length(mother_name) <= 160)
  ),
  add constraint member_import_items_dates_check check (
    (birth_date is null or received_date is null or received_date >= birth_date)
    and (birth_date is null or baptism_date is null or baptism_date >= birth_date)
  );

create or replace function private.resolve_member_import_mapping(
  p_batch_id uuid,
  p_kind text,
  p_raw_value text,
  p_value text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_batch public.member_import_batches%rowtype;
  v_role public.roles%rowtype;
begin
  v_batch := private.assert_member_import_access(p_batch_id);
  if v_batch.status not in ('DRAFT', 'REVIEW', 'READY', 'FAILED') then
    raise exception 'IMPORT_BATCH_INVALID_STATUS';
  end if;

  if p_kind = 'ROLE' then
    select * into v_role
    from public.roles role
    where role.id = p_value::uuid
      and role.church_id = v_batch.church_id
      and role.status = 'ACTIVE'
      and role.deleted_at is null;
    if v_role.id is null then raise exception 'IMPORT_ROLE_INVALID'; end if;

    update public.member_import_items item
    set
      role_id = v_role.id,
      role_title_variant = case
        when item.gender = 'FEMALE' then 'FEMALE'
        when public.normalize_member_import_name(item.role_raw) =
          public.normalize_member_import_name(v_role.female_abbreviation)
          and v_role.female_abbreviation is not null then 'FEMALE'
        else 'DEFAULT'
      end,
      issues = private.member_import_mark_issues(
        item.issues,
        array['ROLE_UNKNOWN', 'ROLE_INACTIVE'],
        'MAPPED_TO:' || v_role.id::text
      )
    where item.batch_id = p_batch_id
      and item.role_raw = p_raw_value
      and item.classification <> 'IMPORTED';
  elsif p_kind = 'MARITAL_STATUS' then
    if p_value not in ('SINGLE', 'MARRIED', 'DIVORCED', 'SEPARATED', 'WIDOWED', 'STABLE_UNION', 'OTHER') then
      raise exception 'IMPORT_MARITAL_STATUS_INVALID';
    end if;
    update public.member_import_items item
    set
      marital_status = p_value,
      issues = private.member_import_mark_issues(
        item.issues,
        array['MARITAL_STATUS_UNKNOWN'],
        'MAPPED_TO:' || p_value
      )
    where item.batch_id = p_batch_id
      and item.marital_status_raw = p_raw_value
      and item.classification <> 'IMPORTED';
  else
    raise exception 'IMPORT_MAPPING_INVALID';
  end if;

  update public.member_import_items item
  set
    decision = case
      when item.decision = 'SKIP' then item.decision
      when private.member_import_requires_decision(item.issues) then 'PENDING'
      else 'IMPORT'
    end,
    classification = private.member_import_classification(
      item.issues,
      item.role_id,
      case when item.decision = 'SKIP' then 'SKIP' else 'IMPORT' end
    )
  where item.batch_id = p_batch_id and item.classification <> 'IMPORTED';

  perform private.recalculate_member_import_batch(p_batch_id);
  return jsonb_build_object('batch_id', p_batch_id, 'updated', true);
end;
$$;

create or replace function private.resolve_member_import_item(
  p_batch_id uuid,
  p_item_id uuid,
  p_resolution text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_batch public.member_import_batches%rowtype;
  v_item public.member_import_items%rowtype;
  v_issues jsonb;
  v_decision text;
begin
  v_batch := private.assert_member_import_access(p_batch_id);
  if v_batch.status not in ('DRAFT', 'REVIEW', 'READY', 'FAILED') then
    raise exception 'IMPORT_BATCH_INVALID_STATUS';
  end if;
  select * into v_item
  from public.member_import_items item
  where item.id = p_item_id and item.batch_id = p_batch_id
  for update;
  if v_item.id is null then raise exception 'IMPORT_ITEM_NOT_FOUND'; end if;

  if p_resolution = 'SKIP' then
    update public.member_import_items
    set decision = 'SKIP', classification = 'SKIPPED'
    where id = p_item_id;
  elsif p_resolution = 'RESTORE' then
    v_decision := case when private.member_import_requires_decision(v_item.issues) then 'PENDING' else 'IMPORT' end;
    update public.member_import_items
    set
      decision = v_decision,
      classification = private.member_import_classification(issues, role_id, v_decision)
    where id = p_item_id;
  elsif p_resolution = 'IMPORT_WITHOUT_CPF' then
    if exists (
      select 1 from jsonb_array_elements(v_item.issues) issue
      where issue->>'code' = 'CPF_ALREADY_EXISTS'
        and coalesce((issue->>'resolved')::boolean, false) = false
    ) then
      raise exception 'IMPORT_CPF_CONFLICT';
    end if;
    v_issues := private.member_import_mark_issues(
      v_item.issues,
      array['CPF_INVALID', 'CPF_DUPLICATE_FILE'],
      'IMPORTED_WITHOUT_CPF'
    );
    v_decision := case when private.member_import_requires_decision(v_issues) then 'PENDING' else 'IMPORT_ANYWAY' end;
    update public.member_import_items
    set cpf = null, issues = v_issues, decision = v_decision,
      classification = private.member_import_classification(v_issues, role_id, v_decision)
    where id = p_item_id;
  elsif p_resolution = 'IMPORT_WITHOUT_BIRTH_DATE' then
    v_issues := private.member_import_mark_issues(
      v_item.issues,
      array['BIRTH_DATE_INVALID', 'BIRTH_DATE_FUTURE', 'BIRTH_DATE_TOO_OLD', 'RECEIVED_BEFORE_BIRTH', 'BAPTISM_BEFORE_BIRTH'],
      'IMPORTED_WITHOUT_BIRTH_DATE'
    );
    v_decision := case when private.member_import_requires_decision(v_issues) then 'PENDING' else 'IMPORT_ANYWAY' end;
    update public.member_import_items
    set birth_date = null, issues = v_issues, decision = v_decision,
      classification = private.member_import_classification(v_issues, role_id, v_decision)
    where id = p_item_id;
  elsif p_resolution = 'IMPORT_WITHOUT_RECEIVED_DATE' then
    v_issues := private.member_import_mark_issues(
      v_item.issues,
      array['RECEIVED_DATE_INVALID', 'RECEIVED_DATE_FUTURE', 'RECEIVED_BEFORE_BIRTH'],
      'IMPORTED_WITHOUT_RECEIVED_DATE'
    );
    v_decision := case when private.member_import_requires_decision(v_issues) then 'PENDING' else 'IMPORT_ANYWAY' end;
    update public.member_import_items
    set received_date = null, issues = v_issues, decision = v_decision,
      classification = private.member_import_classification(v_issues, role_id, v_decision)
    where id = p_item_id;
  elsif p_resolution = 'IMPORT_WITHOUT_BAPTISM_DATE' then
    v_issues := private.member_import_mark_issues(
      v_item.issues,
      array['BAPTISM_DATE_INVALID', 'BAPTISM_DATE_FUTURE', 'BAPTISM_BEFORE_BIRTH'],
      'IMPORTED_WITHOUT_BAPTISM_DATE'
    );
    v_decision := case when private.member_import_requires_decision(v_issues) then 'PENDING' else 'IMPORT_ANYWAY' end;
    update public.member_import_items
    set baptism_date = null, issues = v_issues, decision = v_decision,
      classification = private.member_import_classification(v_issues, role_id, v_decision)
    where id = p_item_id;
  elsif p_resolution = 'IMPORT_AS_NEW' then
    v_issues := private.member_import_mark_issues(
      v_item.issues,
      array['POSSIBLE_DUPLICATE_NAME_BIRTH', 'POSSIBLE_DUPLICATE_NAME'],
      'IMPORT_AS_NEW'
    );
    v_decision := case when private.member_import_requires_decision(v_issues) then 'PENDING' else 'IMPORT_ANYWAY' end;
    update public.member_import_items
    set issues = v_issues, decision = v_decision,
      classification = private.member_import_classification(v_issues, role_id, v_decision)
    where id = p_item_id;
    perform public.log_audit(
      v_batch.church_id, 'members', 'MEMBER_IMPORT_DUPLICATE_ACCEPTED',
      'member_import_batch', p_batch_id, null,
      'Possível duplicidade aceita durante a revisão do lote.',
      null, null,
      jsonb_build_object('batch_id', p_batch_id, 'row_number', v_item.row_number),
      'WARNING'
    );
  else
    raise exception 'IMPORT_ITEM_RESOLUTION_INVALID';
  end if;

  perform private.recalculate_member_import_batch(p_batch_id);
  return jsonb_build_object('batch_id', p_batch_id, 'item_id', p_item_id);
end;
$$;

create or replace function private.prepare_member_import(
  p_payload jsonb,
  p_items jsonb
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_batch_id uuid;
  v_church_id uuid := nullif(p_payload->>'church_id', '')::uuid;
  v_congregation_id uuid := nullif(p_payload->>'congregation_id', '')::uuid;
  v_total integer := jsonb_array_length(coalesce(p_items, '[]'::jsonb));
  v_file_size bigint := coalesce((p_payload->>'file_size_bytes')::bigint, 0);
  v_file_hash text := lower(coalesce(p_payload->>'file_sha256', ''));
begin
  if v_actor is null then raise exception 'AUTH_REQUIRED'; end if;
  if v_church_id is null or v_congregation_id is null then
    raise exception 'IMPORT_CONGREGATION_INVALID';
  end if;
  if not public.has_permission(v_church_id, 'members.import')
    or not public.can_access_congregation(v_church_id, v_congregation_id) then
    raise exception 'IMPORT_PERMISSION_DENIED';
  end if;
  if not exists (
    select 1 from public.congregations congregation
    where congregation.id = v_congregation_id
      and congregation.church_id = v_church_id
      and congregation.status = 'ACTIVE'
      and congregation.deleted_at is null
  ) then raise exception 'IMPORT_CONGREGATION_INVALID'; end if;
  if v_total < 1 then raise exception 'IMPORT_WORKSHEET_EMPTY'; end if;
  if v_total > 500 then raise exception 'IMPORT_ROW_LIMIT_EXCEEDED'; end if;
  if v_file_size < 1 or v_file_size > 5242880 then
    raise exception 'IMPORT_FILE_TOO_LARGE';
  end if;
  if v_file_hash !~ '^[0-9a-f]{64}$' then
    raise exception 'IMPORT_FILE_INVALID_TYPE';
  end if;
  if exists (
    select 1 from public.member_import_batches batch
    where batch.church_id = v_church_id
      and batch.congregation_id = v_congregation_id
      and batch.file_sha256 = v_file_hash
      and batch.status = 'COMPLETED'
      and batch.rolled_back_at is null
      and batch.deleted_at is null
  ) then raise exception 'IMPORT_FILE_DUPLICATE'; end if;

  insert into public.member_import_batches (
    church_id, congregation_id, original_filename, worksheet_name,
    file_size_bytes, file_sha256, status, total_rows,
    normalization_version, settings_snapshot, created_by, validated_at
  ) values (
    v_church_id, v_congregation_id,
    left(coalesce(p_payload->>'original_filename', 'importacao.xlsx'), 255),
    left(coalesce(p_payload->>'worksheet_name', 'Planilha'), 120),
    v_file_size, v_file_hash, 'DRAFT', v_total,
    coalesce((p_payload->>'normalization_version')::integer, 2),
    coalesce(p_payload->'settings_snapshot', '{}'::jsonb),
    v_actor, now()
  ) returning id into v_batch_id;

  insert into public.member_import_items (
    batch_id, church_id, row_number, source_data, full_name,
    normalized_name_key, phone_raw, whatsapp, birth_date, role_raw,
    role_id, role_title_variant, cpf, marital_status_raw, marital_status,
    received_date, gender_raw, gender, natural_city, natural_state,
    father_name, mother_name, baptism_date, classification, decision, issues,
    planned_member_id
  )
  select
    v_batch_id,
    v_church_id,
    item.row_number,
    item.source_data,
    item.full_name,
    item.normalized_name_key,
    nullif(item.phone_raw, ''),
    nullif(item.whatsapp, ''),
    item.birth_date,
    item.role_raw,
    item.role_id,
    coalesce(nullif(item.role_title_variant, ''), 'AUTO'),
    nullif(item.cpf, ''),
    nullif(item.marital_status_raw, ''),
    nullif(item.marital_status, ''),
    item.received_date,
    nullif(item.gender_raw, ''),
    nullif(item.gender, ''),
    nullif(item.natural_city, ''),
    nullif(item.natural_state, ''),
    nullif(item.father_name, ''),
    nullif(item.mother_name, ''),
    item.baptism_date,
    item.classification,
    item.decision,
    coalesce(item.issues, '[]'::jsonb),
    coalesce(item.planned_member_id, gen_random_uuid())
  from jsonb_to_recordset(p_items) as item(
    row_number integer,
    source_data jsonb,
    full_name text,
    normalized_name_key text,
    phone_raw text,
    whatsapp text,
    birth_date date,
    role_raw text,
    role_id uuid,
    role_title_variant text,
    cpf text,
    marital_status_raw text,
    marital_status text,
    received_date date,
    gender_raw text,
    gender text,
    natural_city text,
    natural_state text,
    father_name text,
    mother_name text,
    baptism_date date,
    classification text,
    decision text,
    issues jsonb,
    planned_member_id uuid
  );

  perform private.recalculate_member_import_batch(v_batch_id);
  perform public.log_audit(
    v_church_id, 'members', 'MEMBER_IMPORT_PREPARED',
    'member_import_batch', v_batch_id, null,
    'Planilha analisada e preparada para revisão.', null,
    jsonb_build_object('total_rows', v_total),
    jsonb_build_object(
      'batch_id', v_batch_id,
      'congregation_id', v_congregation_id,
      'file_hash', left(v_file_hash, 12),
      'normalization_version', coalesce((p_payload->>'normalization_version')::integer, 2)
    ),
    'INFO'
  );
  return v_batch_id;
end;
$$;

create or replace function private.execute_member_import(p_batch_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_batch public.member_import_batches%rowtype;
  v_item public.member_import_items%rowtype;
  v_settings public.app_settings%rowtype;
  v_member_code text;
  v_role_name text;
  v_next_number integer;
  v_imported integer := 0;
  v_skipped integer := 0;
begin
  v_batch := private.assert_member_import_access(p_batch_id);
  select * into v_batch
  from public.member_import_batches batch
  where batch.id = p_batch_id
  for update;

  if v_batch.status = 'COMPLETED' then
    return jsonb_build_object(
      'batch_id', p_batch_id,
      'imported_rows', v_batch.imported_rows,
      'skipped_rows', v_batch.skipped_rows,
      'already_completed', true
    );
  end if;
  if v_batch.status not in ('READY', 'FAILED') then
    raise exception 'IMPORT_BATCH_INVALID_STATUS';
  end if;
  if not exists (
    select 1 from public.member_import_items item
    where item.batch_id = p_batch_id and item.decision in ('IMPORT', 'IMPORT_ANYWAY')
  ) then raise exception 'IMPORT_UNRESOLVED_ERRORS'; end if;
  if exists (
    select 1
    from public.member_import_items item
    where item.batch_id = p_batch_id
      and item.decision <> 'SKIP'
      and (
        item.decision = 'PENDING'
        or item.classification = 'ERROR'
        or item.role_id is null
        or item.full_name is null
        or btrim(item.full_name) = ''
        or exists (
          select 1 from jsonb_array_elements(item.issues) issue
          where issue->>'severity' = 'ERROR'
            and coalesce((issue->>'resolved')::boolean, false) = false
        )
      )
  ) then raise exception 'IMPORT_UNRESOLVED_ERRORS'; end if;

  if not exists (
    select 1 from public.congregations congregation
    where congregation.id = v_batch.congregation_id
      and congregation.church_id = v_batch.church_id
      and congregation.status = 'ACTIVE'
      and congregation.deleted_at is null
  ) then raise exception 'IMPORT_CONGREGATION_INVALID'; end if;

  if exists (
    select 1
    from public.member_import_items item
    left join public.roles role
      on role.id = item.role_id
     and role.church_id = item.church_id
     and role.status = 'ACTIVE'
     and role.deleted_at is null
    where item.batch_id = p_batch_id
      and item.decision in ('IMPORT', 'IMPORT_ANYWAY')
      and role.id is null
  ) then raise exception 'IMPORT_ROLE_INVALID'; end if;

  if exists (
    select 1
    from public.member_import_items item
    join public.member_sensitive_identity identity
      on identity.church_id = item.church_id
     and identity.cpf = item.cpf
     and identity.deleted_at is null
    where item.batch_id = p_batch_id
      and item.decision in ('IMPORT', 'IMPORT_ANYWAY')
      and item.cpf is not null
  ) then raise exception 'IMPORT_CPF_CONFLICT'; end if;

  select * into v_settings
  from public.app_settings settings
  where settings.church_id = v_batch.church_id
    and settings.status = 'ACTIVE'
    and settings.deleted_at is null
  for update;
  if v_settings.id is null then raise exception 'MEMBER_SETTINGS_NOT_FOUND'; end if;
  v_next_number := greatest(v_settings.member_code_next_number, 1);

  update public.member_import_batches
  set status = 'PROCESSING', confirmed_at = now(), failure_code = null, failure_message = null
  where id = p_batch_id;

  perform set_config('eclesias.member_import', 'on', true);

  for v_item in
    select *
    from public.member_import_items item
    where item.batch_id = p_batch_id
    order by item.row_number
    for update
  loop
    if v_item.decision = 'SKIP' then
      v_skipped := v_skipped + 1;
      continue;
    end if;

    v_member_code := null;
    if v_settings.enable_member_auto_code then
      loop
        v_member_code := coalesce(nullif(upper(btrim(v_settings.member_code_prefix)), ''), 'MEM')
          || lpad(v_next_number::text, greatest(1, least(v_settings.member_code_padding, 10)), '0');
        exit when not exists (
          select 1 from public.members member
          where member.church_id = v_batch.church_id
            and member.member_code = v_member_code
        );
        v_next_number := v_next_number + 1;
      end loop;
      v_next_number := v_next_number + 1;
    end if;

    insert into public.members (
      id, church_id, congregation_id, full_name, gender, birth_date, marital_status,
      natural_city, natural_state, whatsapp, country, father_name, mother_name,
      member_code, member_status, member_type, baptism_date, received_date,
      source_import_batch_id, history_migration_status
    ) values (
      v_item.planned_member_id, v_batch.church_id, v_batch.congregation_id,
      v_item.full_name, v_item.gender, v_item.birth_date, v_item.marital_status,
      v_item.natural_city, v_item.natural_state, v_item.whatsapp, 'Brasil',
      v_item.father_name, v_item.mother_name, v_member_code, 'ACTIVE', 'MEMBER',
      v_item.baptism_date, v_item.received_date, p_batch_id, 'PENDING'
    );

    if v_item.cpf is not null then
      insert into public.member_sensitive_identity (
        member_id, church_id, cpf, created_by, updated_by
      ) values (
        v_item.planned_member_id, v_batch.church_id, v_item.cpf, v_actor, v_actor
      );
    end if;

    insert into public.member_roles (
      church_id, member_id, role_id, congregation_id, is_primary, status,
      start_date, notes, title_variant, created_by
    ) values (
      v_batch.church_id, v_item.planned_member_id, v_item.role_id,
      v_batch.congregation_id, true, 'ACTIVE', null,
      'Cargo atual migrado do sistema anterior; data de início não informada.',
      v_item.role_title_variant, v_actor
    );

    select case
      when v_item.role_title_variant = 'FEMALE' then coalesce(role.female_name, role.name)
      else role.name
    end into v_role_name
    from public.roles role where role.id = v_item.role_id;

    insert into public.member_history (
      church_id, member_id, congregation_id, history_type, title, description,
      new_value, event_date, is_sensitive, created_by, metadata
    ) values (
      v_batch.church_id, v_item.planned_member_id, v_batch.congregation_id,
      'MEMBER_IMPORTED', 'Cadastro migrado para o EKLESIA',
      'Cadastro-base importado do sistema anterior por planilha.',
      null, current_date, false, v_actor,
      jsonb_build_object(
        'batch_id', p_batch_id,
        'row_number', v_item.row_number,
        'source_system', v_batch.source_system,
        'history_migration_status', 'PENDING'
      )
    ), (
      v_batch.church_id, v_item.planned_member_id, v_batch.congregation_id,
      'ROLE_ASSIGNED', 'Cargo atual informado na migração',
      'Cargo atual migrado do sistema anterior; data de início/consagração não informada.',
      v_role_name, current_date, false, v_actor,
      jsonb_build_object(
        'role_id', v_item.role_id,
        'batch_id', p_batch_id,
        'source_abbreviation', v_item.role_raw,
        'title_variant', v_item.role_title_variant,
        'effective_date_known', false
      )
    );

    if v_item.received_date is not null then
      insert into public.member_history (
        church_id, member_id, congregation_id, history_type, title, description,
        event_date, is_sensitive, created_by, metadata
      ) values (
        v_batch.church_id, v_item.planned_member_id, v_batch.congregation_id,
        'MEMBER_RECEIVED', 'Recebimento como membro',
        'Data de recebimento migrada do sistema anterior; forma de recebimento não informada.',
        v_item.received_date, false, v_actor,
        jsonb_build_object('batch_id', p_batch_id, 'received_by', null)
      );
    end if;

    if v_item.baptism_date is not null then
      insert into public.member_history (
        church_id, member_id, congregation_id, history_type, title, description,
        event_date, is_sensitive, created_by, metadata
      ) values (
        v_batch.church_id, v_item.planned_member_id, v_batch.congregation_id,
        'BAPTISM_UPDATED', 'Batismo nas águas',
        'Data do batismo nas águas migrada do sistema anterior.',
        v_item.baptism_date, false, v_actor,
        jsonb_build_object('batch_id', p_batch_id, 'source_field', 'data_batismo')
      );
    end if;

    update public.member_import_items
    set
      classification = 'IMPORTED',
      imported_member_id = v_item.planned_member_id,
      imported_member_code = v_member_code,
      imported_at = now()
    where id = v_item.id;
    v_imported := v_imported + 1;
  end loop;

  if v_settings.enable_member_auto_code then
    update public.app_settings
    set member_code_next_number = v_next_number
    where id = v_settings.id;
  end if;

  update public.member_import_batches
  set
    status = 'COMPLETED',
    imported_rows = v_imported,
    skipped_rows = v_skipped,
    error_rows = 0,
    completed_at = now()
  where id = p_batch_id;

  perform public.log_audit(
    v_batch.church_id, 'members', 'MEMBER_IMPORT_COMPLETED',
    'member_import_batch', p_batch_id, null,
    'Lote de membros importado com sucesso.', null,
    jsonb_build_object('imported_rows', v_imported, 'skipped_rows', v_skipped),
    jsonb_build_object(
      'batch_id', p_batch_id,
      'congregation_id', v_batch.congregation_id,
      'file_hash', left(v_batch.file_sha256, 12),
      'normalization_version', v_batch.normalization_version
    ),
    'INFO'
  );

  return jsonb_build_object(
    'batch_id', p_batch_id,
    'imported_rows', v_imported,
    'skipped_rows', v_skipped,
    'already_completed', false
  );
exception
  when unique_violation then
    raise exception 'IMPORT_DUPLICATE_CHANGED_DURING_CONFIRMATION';
end;
$$;
