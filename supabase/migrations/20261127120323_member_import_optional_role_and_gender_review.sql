create or replace function private.member_import_classification(
  p_issues jsonb,
  p_role_id uuid,
  p_decision text
)
returns text
language sql
immutable
set search_path = ''
as $$
  select case
    when p_decision = 'SKIP' then 'SKIPPED'
    when exists (
      select 1
      from pg_catalog.jsonb_array_elements(coalesce(p_issues, '[]'::jsonb)) issue
      where issue->>'severity' = 'ERROR'
        and coalesce((issue->>'resolved')::boolean, false) = false
    ) then 'ERROR'
    when exists (
      select 1
      from pg_catalog.jsonb_array_elements(coalesce(p_issues, '[]'::jsonb)) issue
      where issue->>'severity' = 'WARNING'
        and (issue->>'code' is distinct from 'GENDER_UNKNOWN'
          or not coalesce((issue->>'resolved')::boolean, false))
    ) then 'WARNING'
    else 'VALID'
  end;
$$;

create or replace function private.recalculate_member_import_batch(p_batch_id uuid)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_total integer;
  v_valid integer;
  v_warning integer;
  v_error integer;
  v_skipped integer;
  v_pending integer;
begin
  select
    count(*),
    count(*) filter (where classification = 'VALID'),
    count(*) filter (where classification = 'WARNING'),
    count(*) filter (where classification = 'ERROR'),
    count(*) filter (where classification = 'SKIPPED'),
    count(*) filter (
      where classification <> 'SKIPPED'
        and (decision = 'PENDING' or classification = 'ERROR' or (role_id is null and btrim(role_raw) <> ''))
    )
  into v_total, v_valid, v_warning, v_error, v_skipped, v_pending
  from public.member_import_items
  where batch_id = p_batch_id;

  update public.member_import_batches batch
  set
    total_rows = v_total,
    valid_rows = v_valid,
    warning_rows = v_warning,
    error_rows = v_error,
    skipped_rows = v_skipped,
    status = case
      when batch.status in ('COMPLETED', 'CANCELLED', 'ROLLED_BACK', 'PROCESSING') then batch.status
      when v_pending = 0 and v_total > v_skipped then 'READY'
      else 'REVIEW'
    end,
    failure_code = case when batch.status = 'FAILED' then null else batch.failure_code end,
    failure_message = case when batch.status = 'FAILED' then null else batch.failure_message end
  where batch.id = p_batch_id;
end;
$$;

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
        when item.gender = 'MALE' then 'DEFAULT'
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

create or replace function private.resolve_member_import_official_item(
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
  v_gender text;
begin
  if p_resolution not in (
    'IMPORT_WITHOUT_HOLY_SPIRIT_BAPTISM_DATE',
    'IMPORT_WITHOUT_CONVERSION_DATE', 'SET_GENDER_MALE', 'SET_GENDER_FEMALE', 'CLEAR_GENDER'
  ) then
    return private.resolve_member_import_item(p_batch_id, p_item_id, p_resolution);
  end if;

  v_batch := private.assert_member_import_access(p_batch_id);
  -- Serialize edits with confirmation and recheck the current batch state.
  select * into strict v_batch from public.member_import_batches
    where id = p_batch_id and church_id = v_batch.church_id and deleted_at is null for update;
  if v_batch.status not in ('DRAFT', 'REVIEW', 'READY', 'FAILED') then
    raise exception 'IMPORT_BATCH_INVALID_STATUS';
  end if;

  select * into v_item
  from public.member_import_items item
  where item.id = p_item_id and item.batch_id = p_batch_id and item.church_id = v_batch.church_id
  for update;
  if v_item.id is null then raise exception 'IMPORT_ITEM_NOT_FOUND'; end if;

  if p_resolution in ('SET_GENDER_MALE', 'SET_GENDER_FEMALE', 'CLEAR_GENDER') then
    if v_item.decision = 'SKIP' or v_item.classification = 'IMPORTED' then
      raise exception 'IMPORT_ITEM_RESOLUTION_INVALID';
    end if;
    v_gender := case p_resolution when 'SET_GENDER_MALE' then 'MALE' when 'SET_GENDER_FEMALE' then 'FEMALE' end;
    v_issues := private.member_import_mark_issues(v_item.issues, array['GENDER_UNKNOWN'], p_resolution);
    update public.member_import_items item
    set gender = v_gender,
        role_title_variant = case
          when v_gender = 'MALE' then 'DEFAULT'
          when v_gender = 'FEMALE' then 'FEMALE'
          when exists (
            select 1 from public.roles r
            where r.church_id = item.church_id and r.id = item.role_id and r.deleted_at is null
              and nullif(btrim(r.female_abbreviation), '') is not null
              and public.normalize_member_import_name(r.female_abbreviation) = public.normalize_member_import_name(item.role_raw)
          ) then 'FEMALE'
          else 'AUTO'
        end,
        issues = v_issues,
        classification = private.member_import_classification(v_issues, item.role_id, item.decision)
    where item.id = p_item_id and item.church_id = v_batch.church_id and item.batch_id = p_batch_id;
  elsif p_resolution = 'IMPORT_WITHOUT_HOLY_SPIRIT_BAPTISM_DATE' then
    v_issues := private.member_import_mark_issues(
      v_item.issues,
      array[
        'HOLY_SPIRIT_BAPTISM_DATE_INVALID',
        'HOLY_SPIRIT_BAPTISM_DATE_FUTURE',
        'HOLY_SPIRIT_BAPTISM_BEFORE_BIRTH'
      ],
      'IMPORTED_WITHOUT_HOLY_SPIRIT_BAPTISM_DATE'
    );
    v_decision := case when private.member_import_requires_decision(v_issues) then 'PENDING' else 'IMPORT_ANYWAY' end;
    update public.member_import_items
    set holy_spirit_baptism_date = null,
      issues = v_issues,
      decision = v_decision,
      classification = private.member_import_classification(v_issues, role_id, v_decision)
    where id = p_item_id;
  else
    v_issues := private.member_import_mark_issues(
      v_item.issues,
      array['CONVERSION_DATE_INVALID', 'CONVERSION_DATE_FUTURE', 'CONVERSION_BEFORE_BIRTH'],
      'IMPORTED_WITHOUT_CONVERSION_DATE'
    );
    v_decision := case when private.member_import_requires_decision(v_issues) then 'PENDING' else 'IMPORT_ANYWAY' end;
    update public.member_import_items
    set conversion_date = null,
      issues = v_issues,
      decision = v_decision,
      classification = private.member_import_classification(v_issues, role_id, v_decision)
    where id = p_item_id;
  end if;

  perform private.recalculate_member_import_batch(p_batch_id);
  return jsonb_build_object('batch_id', p_batch_id, 'item_id', p_item_id);
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
  v_csv jsonb;
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
        or (item.role_id is null and btrim(item.role_raw) <> '')
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
      and item.role_id is not null
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

    v_csv := case when lower(right(v_batch.original_filename, 4)) = '.csv'
      then v_item.source_data else '{}'::jsonb end;
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
      source_import_batch_id, history_migration_status, email, address
    ) values (
      v_item.planned_member_id, v_batch.church_id, v_batch.congregation_id,
      v_item.full_name, v_item.gender, v_item.birth_date, v_item.marital_status,
      v_item.natural_city, v_item.natural_state, v_item.whatsapp, 'Brasil',
      v_item.father_name, v_item.mother_name, v_member_code, 'ACTIVE', 'MEMBER',
      v_item.baptism_date, case when lower(right(v_batch.original_filename, 4)) <> '.csv' then v_item.received_date end,
      p_batch_id, 'PENDING', nullif(lower(btrim(v_csv->>'email')), ''), nullif(btrim(v_csv->>'endereco'), '')
    );

    if v_item.cpf is not null or nullif(btrim(v_csv->>'identidade'), '') ~ '[[:alnum:]]' then
      insert into public.member_sensitive_identity (
        member_id, church_id, cpf, rg, created_by, updated_by
      ) values (
        v_item.planned_member_id, v_batch.church_id, v_item.cpf,
        case when btrim(v_csv->>'identidade') ~ '[[:alnum:]]' then btrim(v_csv->>'identidade') end,
        v_actor, v_actor
      );
    end if;

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
    );

    if v_item.role_id is not null then
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
    end if;

    if v_item.received_date is not null and lower(right(v_batch.original_filename, 4)) <> '.csv' then
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

-- Revalida somente linhas de lotes em aberto afetadas pela regra antiga.
do $$
declare
  batch record;
begin
  for batch in
    select b.id, b.church_id from public.member_import_batches b
    where b.status in ('DRAFT','REVIEW','READY','FAILED') and b.deleted_at is null
      and exists (select 1 from public.member_import_items i where i.church_id = b.church_id and i.batch_id = b.id
        and i.role_id is null and btrim(i.role_raw) = '' and i.issues @> '[{"code":"ROLE_REQUIRED"}]'::jsonb)
    for update
  loop
    with revised as (
      select i.id, i.decision, (select coalesce(jsonb_agg(issue order by n), '[]'::jsonb)
        from jsonb_array_elements(i.issues) with ordinality as entries(issue, n)
        where issue->>'code' is distinct from 'ROLE_REQUIRED') as issues
      from public.member_import_items i where i.church_id = batch.church_id and i.batch_id = batch.id
        and i.role_id is null and btrim(i.role_raw) = '' and i.issues @> '[{"code":"ROLE_REQUIRED"}]'::jsonb
    )
    update public.member_import_items i
    set issues = r.issues,
        classification = private.member_import_classification(r.issues, i.role_id, r.decision),
        decision = case when r.decision = 'PENDING' and not private.member_import_requires_decision(r.issues)
          then 'IMPORT' else r.decision end
    from revised r where i.id = r.id and i.church_id = batch.church_id and i.batch_id = batch.id;
    perform private.recalculate_member_import_batch(batch.id);
  end loop;
end;
$$;
