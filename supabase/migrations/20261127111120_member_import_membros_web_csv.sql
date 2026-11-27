-- Campos exclusivos do CSV são conservados no item de origem. A matrícula do
-- legado não substitui o código de membro gerado pelo Eklesias.
alter table public.member_import_items drop constraint member_import_items_source_check;
alter table public.member_import_items add constraint member_import_items_source_check check (
  jsonb_typeof(source_data) = 'object'
  and source_data - array[
    'nome', 'fone', 'dtnascimento', 'cargo', 'cpf', 'estadocivil', 'dtcadastro',
    'sexo', 'cep', 'cidade', 'estado', 'naturalidade_cidade', 'naturalidade_uf',
    'nome_pai', 'nome_mae', 'data_batismo', 'data_batismo_agua',
    'data_batismo_espirito', 'data_conversao', 'id', 'endereco', 'identidade', 'email'
  ] = '{}'::jsonb
);

-- Duas revisões do mesmo arquivo podem existir. Somente uma pode ser concluída.
create unique index member_import_csv_file_duplicate
on public.member_import_batches (church_id, congregation_id, file_sha256)
where status = 'COMPLETED' and rolled_back_at is null and deleted_at is null
  and lower(right(original_filename, 4)) = '.csv';

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
