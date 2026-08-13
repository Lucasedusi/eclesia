-- Consolida o modelo oficial da importação de membros.
-- Os modelos anteriores continuam aceitos; todos os novos campos são opcionais.

alter table public.member_import_items
  add column if not exists zip_code text,
  add column if not exists city text,
  add column if not exists state text,
  add column if not exists holy_spirit_baptism_date date,
  add column if not exists conversion_date date;

alter table public.member_import_items
  drop constraint if exists member_import_items_source_check,
  drop constraint if exists member_import_items_address_check,
  drop constraint if exists member_import_items_state_check,
  drop constraint if exists member_import_items_dates_check;

alter table public.member_import_items
  add constraint member_import_items_source_check check (
    jsonb_typeof(source_data) = 'object'
    and source_data - array[
      'nome', 'fone', 'dtnascimento', 'cargo', 'cpf', 'estadocivil', 'dtcadastro',
      'sexo', 'cep', 'cidade', 'estado', 'naturalidade_cidade', 'naturalidade_uf',
      'nome_pai', 'nome_mae', 'data_batismo', 'data_batismo_agua',
      'data_batismo_espirito', 'data_conversao'
    ] = '{}'::jsonb
  ),
  add constraint member_import_items_address_check check (
    (zip_code is null or zip_code ~ '^[0-9]{8}$')
    and (city is null or char_length(city) <= 120)
  ),
  add constraint member_import_items_state_check check (
    state is null or state in (
      'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS',
      'MG', 'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN', 'RS', 'RO', 'RR', 'SC',
      'SP', 'SE', 'TO'
    )
  ),
  add constraint member_import_items_dates_check check (
    (birth_date is null or received_date is null or received_date >= birth_date)
    and (birth_date is null or baptism_date is null or baptism_date >= birth_date)
    and (birth_date is null or holy_spirit_baptism_date is null or holy_spirit_baptism_date >= birth_date)
    and (birth_date is null or conversion_date is null or conversion_date >= birth_date)
  );

create or replace function private.prepare_member_import_official(
  p_payload jsonb,
  p_items jsonb
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_batch_id uuid;
begin
  v_batch_id := private.prepare_member_import(p_payload, p_items);

  update public.member_import_items target
  set
    zip_code = nullif(source.zip_code, ''),
    city = nullif(source.city, ''),
    state = nullif(source.state, ''),
    holy_spirit_baptism_date = source.holy_spirit_baptism_date,
    conversion_date = source.conversion_date
  from jsonb_to_recordset(p_items) as source(
    row_number integer,
    zip_code text,
    city text,
    state text,
    holy_spirit_baptism_date date,
    conversion_date date
  )
  where target.batch_id = v_batch_id
    and target.row_number = source.row_number;

  return v_batch_id;
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
begin
  if p_resolution not in (
    'IMPORT_WITHOUT_HOLY_SPIRIT_BAPTISM_DATE',
    'IMPORT_WITHOUT_CONVERSION_DATE'
  ) then
    return private.resolve_member_import_item(p_batch_id, p_item_id, p_resolution);
  end if;

  v_batch := private.assert_member_import_access(p_batch_id);
  if v_batch.status not in ('DRAFT', 'REVIEW', 'READY', 'FAILED') then
    raise exception 'IMPORT_BATCH_INVALID_STATUS';
  end if;

  select * into v_item
  from public.member_import_items item
  where item.id = p_item_id and item.batch_id = p_batch_id
  for update;
  if v_item.id is null then raise exception 'IMPORT_ITEM_NOT_FOUND'; end if;

  if p_resolution = 'IMPORT_WITHOUT_HOLY_SPIRIT_BAPTISM_DATE' then
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

create or replace function private.apply_member_import_official_fields()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_item public.member_import_items%rowtype;
begin
  if new.source_import_batch_id is null then return new; end if;

  select * into v_item
  from public.member_import_items item
  where item.batch_id = new.source_import_batch_id
    and item.planned_member_id = new.id;

  if v_item.id is null then return new; end if;
  new.zip_code := v_item.zip_code;
  new.city := v_item.city;
  new.state := v_item.state;
  new.conversion_date := v_item.conversion_date;
  new.holy_spirit_baptism_date := v_item.holy_spirit_baptism_date;
  new.has_holy_spirit_baptism := v_item.holy_spirit_baptism_date is not null;
  return new;
end;
$$;

drop trigger if exists member_import_official_fields_before_insert on public.members;
create trigger member_import_official_fields_before_insert
before insert on public.members
for each row execute function private.apply_member_import_official_fields();

create or replace function private.log_member_import_official_history()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
begin
  if new.source_import_batch_id is null then return new; end if;

  if new.conversion_date is not null then
    insert into public.member_history (
      church_id, member_id, congregation_id, history_type, title, description,
      event_date, is_sensitive, created_by, metadata
    ) values (
      new.church_id, new.id, new.congregation_id, 'GENERAL_NOTE', 'Conversão',
      'Data da conversão migrada do sistema anterior.', new.conversion_date,
      false, v_actor,
      jsonb_build_object('batch_id', new.source_import_batch_id, 'source_field', 'data_conversao')
    );
  end if;

  if new.holy_spirit_baptism_date is not null then
    insert into public.member_history (
      church_id, member_id, congregation_id, history_type, title, description,
      event_date, is_sensitive, created_by, metadata
    ) values (
      new.church_id, new.id, new.congregation_id, 'BAPTISM_UPDATED',
      'Batismo com o Espírito Santo',
      'Data do batismo com o Espírito Santo migrada do sistema anterior.',
      new.holy_spirit_baptism_date, false, v_actor,
      jsonb_build_object('batch_id', new.source_import_batch_id, 'source_field', 'data_batismo_espirito')
    );
  end if;

  return new;
end;
$$;

drop trigger if exists member_import_official_history_after_insert on public.members;
create trigger member_import_official_history_after_insert
after insert on public.members
for each row execute function private.log_member_import_official_history();

create or replace function public.prepare_member_import_official(p_payload jsonb, p_items jsonb)
returns uuid
language sql
security invoker
set search_path = ''
as $$
  select private.prepare_member_import_official(p_payload, p_items);
$$;

create or replace function public.resolve_member_import_official_item(
  p_batch_id uuid,
  p_item_id uuid,
  p_resolution text
)
returns jsonb
language sql
security invoker
set search_path = ''
as $$
  select private.resolve_member_import_official_item(p_batch_id, p_item_id, p_resolution);
$$;

revoke all on function private.prepare_member_import_official(jsonb, jsonb) from public, anon, authenticated;
revoke all on function private.resolve_member_import_official_item(uuid, uuid, text) from public, anon, authenticated;
revoke all on function private.apply_member_import_official_fields() from public, anon, authenticated;
revoke all on function private.log_member_import_official_history() from public, anon, authenticated;
grant usage on schema private to authenticated;
grant execute on function private.prepare_member_import_official(jsonb, jsonb) to authenticated;
grant execute on function private.resolve_member_import_official_item(uuid, uuid, text) to authenticated;

revoke all on function public.prepare_member_import_official(jsonb, jsonb) from public, anon;
revoke all on function public.resolve_member_import_official_item(uuid, uuid, text) from public, anon;
grant execute on function public.prepare_member_import_official(jsonb, jsonb) to authenticated;
grant execute on function public.resolve_member_import_official_item(uuid, uuid, text) to authenticated;

grant select, insert, update on public.member_import_items to authenticated;

notify pgrst, 'reload schema';
