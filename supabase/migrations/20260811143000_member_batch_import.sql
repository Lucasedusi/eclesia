-- Cadastro de membros em lote por planilha.
-- A migration é idempotente para facilitar homologação e recuperação segura.

create schema if not exists private;

-- ---------------------------------------------------------------------------
-- Permissão administrativa
-- ---------------------------------------------------------------------------

insert into public.permissions (
  key, name, description, module, action, is_sensitive, status
) select
  'members.import',
  'Importar membros',
  'Permite preparar, revisar, confirmar, relatar e desfazer lotes de membros.',
  'members',
  'import',
  true,
  'ACTIVE'
where not exists (
  select 1 from public.permissions permission
  where lower(permission.key) = 'members.import' and permission.deleted_at is null
);

update public.permissions
set
  name = 'Importar membros',
  description = 'Permite preparar, revisar, confirmar, relatar e desfazer lotes de membros.',
  module = 'members',
  action = 'import',
  is_sensitive = true,
  status = 'ACTIVE',
  updated_at = now()
where lower(key) = 'members.import' and deleted_at is null;

insert into public.role_permissions (role, permission_id, status)
select 'ADMIN', permission.id, 'ACTIVE'
from public.permissions permission
where permission.key = 'members.import'
  and permission.deleted_at is null
  and not exists (
    select 1
    from public.role_permissions existing
    where existing.role = 'ADMIN'
      and existing.permission_id = permission.id
      and existing.deleted_at is null
  );

-- ---------------------------------------------------------------------------
-- Lotes e itens
-- ---------------------------------------------------------------------------

create table if not exists public.member_import_batches (
  id uuid primary key default gen_random_uuid(),
  church_id uuid not null references public.churches(id) on delete restrict,
  congregation_id uuid not null,
  source_system text not null default 'LEGACY_SPREADSHEET',
  original_filename text not null,
  worksheet_name text not null,
  file_size_bytes bigint not null,
  file_sha256 text not null,
  status text not null default 'DRAFT',
  total_rows integer not null default 0,
  valid_rows integer not null default 0,
  warning_rows integer not null default 0,
  error_rows integer not null default 0,
  skipped_rows integer not null default 0,
  imported_rows integer not null default 0,
  normalization_version integer not null default 1,
  settings_snapshot jsonb not null default '{}'::jsonb,
  failure_code text,
  failure_message text,
  created_by uuid not null references public.profiles(id) on delete restrict,
  validated_at timestamptz,
  confirmed_at timestamptz,
  completed_at timestamptz,
  rolled_back_at timestamptz,
  rolled_back_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint member_import_batches_status_check check (status in (
    'DRAFT', 'REVIEW', 'READY', 'PROCESSING', 'COMPLETED', 'FAILED',
    'CANCELLED', 'ROLLED_BACK'
  )),
  constraint member_import_batches_source_check check (source_system = 'LEGACY_SPREADSHEET'),
  constraint member_import_batches_file_size_check check (file_size_bytes > 0 and file_size_bytes <= 5242880),
  constraint member_import_batches_hash_check check (file_sha256 ~ '^[0-9a-f]{64}$'),
  constraint member_import_batches_counts_check check (
    total_rows >= 0 and valid_rows >= 0 and warning_rows >= 0 and
    error_rows >= 0 and skipped_rows >= 0 and imported_rows >= 0
  ),
  constraint member_import_batches_congregation_same_church_fk
    foreign key (church_id, congregation_id)
    references public.congregations(church_id, id) on delete restrict
);

create unique index if not exists member_import_batches_church_id_id_unique_idx
  on public.member_import_batches(church_id, id);
create index if not exists member_import_batches_church_created_idx
  on public.member_import_batches(church_id, created_at desc)
  where deleted_at is null;
create index if not exists member_import_batches_congregation_created_idx
  on public.member_import_batches(church_id, congregation_id, created_at desc)
  where deleted_at is null;
create index if not exists member_import_batches_status_created_idx
  on public.member_import_batches(church_id, status, created_at desc)
  where deleted_at is null;
create index if not exists member_import_batches_file_hash_idx
  on public.member_import_batches(church_id, congregation_id, file_sha256)
  where deleted_at is null;

create table if not exists public.member_import_items (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid not null,
  church_id uuid not null,
  row_number integer not null,
  source_data jsonb not null,
  full_name text not null,
  normalized_name_key text not null,
  phone_raw text,
  whatsapp text,
  birth_date date,
  role_raw text not null,
  role_id uuid,
  role_title_variant text not null default 'AUTO',
  cpf text,
  marital_status_raw text,
  marital_status text,
  received_date date,
  classification text not null,
  decision text not null default 'PENDING',
  issues jsonb not null default '[]'::jsonb,
  planned_member_id uuid not null default gen_random_uuid(),
  imported_member_id uuid references public.members(id) on delete set null,
  imported_member_code text,
  imported_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint member_import_items_batch_same_church_fk
    foreign key (church_id, batch_id)
    references public.member_import_batches(church_id, id) on delete cascade,
  constraint member_import_items_role_same_church_fk
    foreign key (church_id, role_id)
    references public.roles(church_id, id) on delete restrict,
  constraint member_import_items_row_unique unique (batch_id, row_number),
  constraint member_import_items_row_check check (row_number >= 2),
  constraint member_import_items_source_check check (
    jsonb_typeof(source_data) = 'object'
    and source_data - array[
      'nome', 'fone', 'dtnascimento', 'cargo', 'cpf', 'estadocivil', 'dtcadastro'
    ] = '{}'::jsonb
  ),
  constraint member_import_items_title_variant_check check (role_title_variant in ('AUTO', 'DEFAULT', 'FEMALE')),
  constraint member_import_items_marital_check check (
    marital_status is null or marital_status in (
      'SINGLE', 'MARRIED', 'DIVORCED', 'SEPARATED', 'WIDOWED',
      'STABLE_UNION', 'OTHER'
    )
  ),
  constraint member_import_items_classification_check check (
    classification in ('VALID', 'WARNING', 'ERROR', 'SKIPPED', 'IMPORTED')
  ),
  constraint member_import_items_decision_check check (
    decision in ('PENDING', 'IMPORT', 'IMPORT_ANYWAY', 'SKIP')
  ),
  constraint member_import_items_cpf_check check (cpf is null or public.is_valid_cpf(cpf)),
  constraint member_import_items_dates_check check (
    birth_date is null or received_date is null or received_date >= birth_date
  )
);

create index if not exists member_import_items_batch_classification_idx
  on public.member_import_items(batch_id, classification, row_number);
create index if not exists member_import_items_church_cpf_idx
  on public.member_import_items(church_id, cpf)
  where cpf is not null;
create index if not exists member_import_items_name_birth_idx
  on public.member_import_items(batch_id, normalized_name_key, birth_date);
create index if not exists member_import_items_imported_member_idx
  on public.member_import_items(imported_member_id)
  where imported_member_id is not null;

-- ---------------------------------------------------------------------------
-- Campos de origem, revisão e variante de título
-- ---------------------------------------------------------------------------

alter table public.members
  add column if not exists source_import_batch_id uuid,
  add column if not exists history_migration_status text,
  add column if not exists history_migration_updated_at timestamptz,
  add column if not exists history_migration_updated_by uuid;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'members_source_import_batch_id_fkey'
      and conrelid = 'public.members'::regclass
  ) then
    alter table public.members
      add constraint members_source_import_batch_id_fkey
      foreign key (source_import_batch_id)
      references public.member_import_batches(id) on delete set null;
  end if;
  if not exists (
    select 1 from pg_constraint
    where conname = 'members_history_migration_updated_by_fkey'
      and conrelid = 'public.members'::regclass
  ) then
    alter table public.members
      add constraint members_history_migration_updated_by_fkey
      foreign key (history_migration_updated_by)
      references public.profiles(id) on delete set null;
  end if;
end;
$$;

alter table public.members drop constraint if exists members_history_migration_status_check;
alter table public.members
  add constraint members_history_migration_status_check
  check (history_migration_status is null or history_migration_status in ('PENDING', 'PARTIAL', 'REVIEWED'));

create index if not exists members_source_import_batch_idx
  on public.members(source_import_batch_id)
  where source_import_batch_id is not null;
create index if not exists members_history_migration_status_idx
  on public.members(church_id, history_migration_status)
  where history_migration_status is not null and deleted_at is null;

alter table public.member_roles
  add column if not exists title_variant text not null default 'AUTO';
alter table public.member_roles drop constraint if exists member_roles_title_variant_check;
alter table public.member_roles
  add constraint member_roles_title_variant_check
  check (title_variant in ('AUTO', 'DEFAULT', 'FEMALE'));

alter table public.members drop constraint if exists members_marital_status_check;
alter table public.members
  add constraint members_marital_status_check
  check (marital_status is null or marital_status in (
    'SINGLE', 'MARRIED', 'DIVORCED', 'SEPARATED', 'WIDOWED',
    'STABLE_UNION', 'OTHER'
  ));

alter table public.member_history drop constraint if exists member_history_type_check;
alter table public.member_history
  add constraint member_history_type_check
  check (history_type in (
    'MEMBER_CREATED', 'MEMBER_IMPORTED', 'MEMBER_RECEIVED',
    'CONGREGATION_CHANGE', 'ROLE_ASSIGNED', 'ROLE_CHANGED', 'ROLE_ENDED',
    'STATUS_CHANGE', 'MEMBER_INACTIVATED', 'MEMBER_REACTIVATED',
    'MEMBER_TRANSFERRED', 'MEMBER_DISCIPLINED', 'MEMBER_DISCIPLINE_ENDED',
    'MEMBER_DECEASED', 'BAPTISM_UPDATED', 'GENERAL_NOTE', 'PASTORAL_NOTE'
  ));

-- Cidade e UF permanecem disponíveis no cadastro individual, mas passam a
-- ser opcionais. As funções são ajustadas a partir de suas definições atuais
-- para preservar integralmente as demais regras atômicas já homologadas.
do $migration$
declare
  v_definition text;
begin
  v_definition := pg_get_functiondef('public.create_member_atomic(uuid,jsonb)'::regprocedure);
  if position('MEMBER_ADDRESS_REQUIRED' in v_definition) > 0 then
    v_definition := replace(
      v_definition,
      $old$
  if nullif(btrim(p_payload->>'city'), '') is null
    or nullif(btrim(p_payload->>'state'), '') is null then
    raise exception 'MEMBER_ADDRESS_REQUIRED';
  end if;
$old$,
      E'\n'
    );
    v_definition := replace(
      v_definition,
      $old$    btrim(p_payload->>'city'),
    upper(btrim(p_payload->>'state')),$old$,
      $new$    nullif(btrim(p_payload->>'city'), ''),
    nullif(upper(btrim(p_payload->>'state')), ''),$new$
    );
    if position('MEMBER_ADDRESS_REQUIRED' in v_definition) > 0 then
      raise exception 'MEMBER_CREATE_ADDRESS_RULE_NOT_PATCHED';
    end if;
    execute v_definition;
  end if;

  v_definition := pg_get_functiondef('public.update_member_atomic(uuid,timestamp with time zone,jsonb)'::regprocedure);
  if position('MEMBER_ADDRESS_REQUIRED' in v_definition) > 0 then
    v_definition := replace(
      v_definition,
      $old$
  if nullif(btrim(p_payload->>'city'), '') is null
    or nullif(btrim(p_payload->>'state'), '') is null then
    raise exception 'MEMBER_ADDRESS_REQUIRED';
  end if;
$old$,
      E'\n'
    );
    v_definition := replace(
      v_definition,
      $old$    city = btrim(p_payload->>'city'),
    state = upper(btrim(p_payload->>'state')),$old$,
      $new$    city = nullif(btrim(p_payload->>'city'), ''),
    state = nullif(upper(btrim(p_payload->>'state')), ''),$new$
    );
    if position('MEMBER_ADDRESS_REQUIRED' in v_definition) > 0 then
      raise exception 'MEMBER_UPDATE_ADDRESS_RULE_NOT_PATCHED';
    end if;
    execute v_definition;
  end if;
end;
$migration$;

-- O texto do histórico precisa respeitar a variante escolhida na importação,
-- mesmo sem inferir o gênero da pessoa pelo nome ou pelo Cargo.
create or replace function public.enrich_member_role_history()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_uuid_pattern constant text := '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$';
  v_old_role_id text;
  v_new_role_id text;
  v_role_id text;
  v_old_role_name text;
  v_new_role_name text;
  v_role_name text;
  v_title_variant text := coalesce(nullif(new.metadata->>'title_variant', ''), 'AUTO');
begin
  if new.history_type not in ('ROLE_ASSIGNED', 'ROLE_CHANGED', 'ROLE_ENDED') then
    return new;
  end if;

  v_old_role_id := nullif(new.metadata->>'old_role_id', '');
  v_new_role_id := nullif(new.metadata->>'new_role_id', '');
  v_role_id := nullif(new.metadata->>'role_id', '');
  if v_old_role_id is null and coalesce(new.old_value, '') ~* v_uuid_pattern then v_old_role_id := new.old_value; end if;
  if v_new_role_id is null and coalesce(new.new_value, '') ~* v_uuid_pattern then v_new_role_id := new.new_value; end if;

  if v_old_role_id is not null then
    select case
      when v_title_variant = 'FEMALE' then coalesce(role.female_name, role.name)
      when v_title_variant = 'DEFAULT' then role.name
      when member.gender = 'FEMALE' then coalesce(role.female_name, role.name)
      else role.name
    end into v_old_role_name
    from public.roles role
    join public.members member on member.id = new.member_id and member.church_id = new.church_id
    where role.id::text = v_old_role_id and role.church_id = new.church_id;
  end if;
  if v_new_role_id is not null then
    select case
      when v_title_variant = 'FEMALE' then coalesce(role.female_name, role.name)
      when v_title_variant = 'DEFAULT' then role.name
      when member.gender = 'FEMALE' then coalesce(role.female_name, role.name)
      else role.name
    end into v_new_role_name
    from public.roles role
    join public.members member on member.id = new.member_id and member.church_id = new.church_id
    where role.id::text = v_new_role_id and role.church_id = new.church_id;
  end if;
  if v_role_id is not null then
    select case
      when v_title_variant = 'FEMALE' then coalesce(role.female_name, role.name)
      when v_title_variant = 'DEFAULT' then role.name
      when member.gender = 'FEMALE' then coalesce(role.female_name, role.name)
      else role.name
    end into v_role_name
    from public.roles role
    join public.members member on member.id = new.member_id and member.church_id = new.church_id
    where role.id::text = v_role_id and role.church_id = new.church_id;
  end if;

  if new.history_type = 'ROLE_ASSIGNED' then
    new.new_value := coalesce(v_role_name, v_new_role_name, new.new_value);
  elsif new.history_type = 'ROLE_ENDED' then
    new.old_value := coalesce(v_role_name, v_old_role_name, new.old_value);
  else
    new.old_value := coalesce(v_old_role_name, new.old_value);
    new.new_value := coalesce(v_new_role_name, v_role_name, new.new_value);
  end if;
  return new;
end;
$$;

revoke all on function public.enrich_member_role_history() from public, anon, authenticated;

drop trigger if exists set_member_import_batches_updated_at on public.member_import_batches;
create trigger set_member_import_batches_updated_at
before update on public.member_import_batches
for each row execute function public.set_updated_at();

drop trigger if exists set_member_import_items_updated_at on public.member_import_items;
create trigger set_member_import_items_updated_at
before update on public.member_import_items
for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- RLS e exposição explícita no Data API
-- ---------------------------------------------------------------------------

alter table public.member_import_batches enable row level security;
alter table public.member_import_items enable row level security;

drop policy if exists member_import_batches_select_scope on public.member_import_batches;
create policy member_import_batches_select_scope
on public.member_import_batches for select to authenticated
using (
  deleted_at is null
  and (select public.has_permission(church_id, 'members.import'))
  and (select public.can_access_congregation(church_id, congregation_id))
);

drop policy if exists member_import_batches_insert_scope on public.member_import_batches;
create policy member_import_batches_insert_scope
on public.member_import_batches for insert to authenticated
with check (
  deleted_at is null
  and created_by = (select auth.uid())
  and (select public.has_permission(church_id, 'members.import'))
  and (select public.can_access_congregation(church_id, congregation_id))
);

drop policy if exists member_import_batches_update_scope on public.member_import_batches;
create policy member_import_batches_update_scope
on public.member_import_batches for update to authenticated
using (
  deleted_at is null
  and (select public.has_permission(church_id, 'members.import'))
  and (select public.can_access_congregation(church_id, congregation_id))
)
with check (
  deleted_at is null
  and (select public.has_permission(church_id, 'members.import'))
  and (select public.can_access_congregation(church_id, congregation_id))
);

drop policy if exists member_import_items_select_scope on public.member_import_items;
create policy member_import_items_select_scope
on public.member_import_items for select to authenticated
using (
  exists (
    select 1
    from public.member_import_batches batch
    where batch.id = member_import_items.batch_id
      and batch.church_id = member_import_items.church_id
      and batch.deleted_at is null
      and (select public.has_permission(batch.church_id, 'members.import'))
      and (select public.can_access_congregation(batch.church_id, batch.congregation_id))
  )
);

drop policy if exists member_import_items_insert_scope on public.member_import_items;
create policy member_import_items_insert_scope
on public.member_import_items for insert to authenticated
with check (
  exists (
    select 1
    from public.member_import_batches batch
    where batch.id = member_import_items.batch_id
      and batch.church_id = member_import_items.church_id
      and batch.deleted_at is null
      and batch.status in ('DRAFT', 'REVIEW', 'READY')
      and (select public.has_permission(batch.church_id, 'members.import'))
      and (select public.can_access_congregation(batch.church_id, batch.congregation_id))
  )
);

drop policy if exists member_import_items_update_scope on public.member_import_items;
create policy member_import_items_update_scope
on public.member_import_items for update to authenticated
using (
  exists (
    select 1
    from public.member_import_batches batch
    where batch.id = member_import_items.batch_id
      and batch.church_id = member_import_items.church_id
      and batch.deleted_at is null
      and batch.status in ('DRAFT', 'REVIEW', 'READY', 'FAILED')
      and (select public.has_permission(batch.church_id, 'members.import'))
      and (select public.can_access_congregation(batch.church_id, batch.congregation_id))
  )
)
with check (
  exists (
    select 1
    from public.member_import_batches batch
    where batch.id = member_import_items.batch_id
      and batch.church_id = member_import_items.church_id
      and batch.deleted_at is null
      and (select public.has_permission(batch.church_id, 'members.import'))
      and (select public.can_access_congregation(batch.church_id, batch.congregation_id))
  )
);

revoke all on table public.member_import_batches from public, anon;
revoke all on table public.member_import_items from public, anon;
grant select, insert, update on table public.member_import_batches to authenticated;
grant select, insert, update on table public.member_import_items to authenticated;

-- ---------------------------------------------------------------------------
-- Normalização e candidatos a duplicidade (security invoker + RLS)
-- ---------------------------------------------------------------------------

create or replace function public.normalize_member_import_name(p_value text)
returns text
language sql
immutable
security invoker
set search_path = ''
as $$
  select pg_catalog.btrim(pg_catalog.regexp_replace(
    pg_catalog.lower(pg_catalog.translate(
      coalesce(p_value, ''),
      'áàâãäéèêëíìîïóòôõöúùûüçñÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇÑ',
      'aaaaaeeeeiiiiooooouuuucnAAAAAEEEEIIIIOOOOOUUUUCN'
    )),
    '\s+', ' ', 'g'
  ));
$$;

create or replace function public.get_member_import_duplicate_candidates(
  p_church_id uuid,
  p_candidates jsonb
)
returns table (
  candidate_key text,
  member_id uuid,
  full_name text,
  birth_date date,
  congregation_id uuid,
  archived boolean
)
language sql
stable
security invoker
set search_path = ''
as $$
  with candidates as (
    select distinct
      nullif(pg_catalog.btrim(candidate.name_key), '') as name_key,
      candidate.birth_date
    from pg_catalog.jsonb_to_recordset(coalesce(p_candidates, '[]'::jsonb))
      as candidate(name_key text, birth_date date)
  )
  select
    candidate.name_key,
    member.id,
    member.full_name,
    member.birth_date,
    member.congregation_id,
    member.deleted_at is not null
  from candidates candidate
  join public.members member
    on member.church_id = p_church_id
   and public.normalize_member_import_name(member.full_name) = candidate.name_key
   and (
     candidate.birth_date is null
     or member.birth_date is null
     or member.birth_date = candidate.birth_date
   )
  where candidate.name_key is not null
    and (select public.has_permission(p_church_id, 'members.import'))
    and (select public.can_access_member(
      member.church_id, member.id, member.congregation_id
    ));
$$;

revoke all on function public.normalize_member_import_name(text) from public, anon;
revoke all on function public.get_member_import_duplicate_candidates(uuid, jsonb) from public, anon;
grant execute on function public.normalize_member_import_name(text) to authenticated;
grant execute on function public.get_member_import_duplicate_candidates(uuid, jsonb) to authenticated;

create or replace function public.get_member_import_history_stats(p_church_id uuid)
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  select jsonb_build_object(
    'completed', count(*) filter (where batch.status = 'COMPLETED'),
    'imported', coalesce(sum(batch.imported_rows) filter (where batch.status = 'COMPLETED'), 0),
    'warnings', count(*) filter (where batch.warning_rows > 0),
    'rolled_back', count(*) filter (where batch.status = 'ROLLED_BACK')
  )
  from public.member_import_batches batch
  where batch.church_id = p_church_id
    and batch.deleted_at is null;
$$;

revoke all on function public.get_member_import_history_stats(uuid) from public, anon;
grant execute on function public.get_member_import_history_stats(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Helpers privados para revisão dos itens
-- ---------------------------------------------------------------------------

create or replace function private.member_import_mark_issues(
  p_issues jsonb,
  p_codes text[],
  p_resolution text
)
returns jsonb
language sql
immutable
set search_path = ''
as $$
  select coalesce(
    pg_catalog.jsonb_agg(
      case
        when issue->>'code' = any(p_codes) then
          issue || pg_catalog.jsonb_build_object(
            'resolved', true,
            'resolution', p_resolution
          )
        else issue
      end
    ),
    '[]'::jsonb
  )
  from pg_catalog.jsonb_array_elements(coalesce(p_issues, '[]'::jsonb)) issue;
$$;

create or replace function private.member_import_requires_decision(p_issues jsonb)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select exists (
    select 1
    from pg_catalog.jsonb_array_elements(coalesce(p_issues, '[]'::jsonb)) issue
    where coalesce((issue->>'resolved')::boolean, false) = false
      and (
        issue->>'severity' = 'ERROR'
        or issue->>'code' in (
          'MARITAL_STATUS_UNKNOWN',
          'POSSIBLE_DUPLICATE_NAME_BIRTH',
          'POSSIBLE_DUPLICATE_NAME'
        )
      )
  );
$$;

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
    when p_role_id is null then 'ERROR'
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
        and (decision = 'PENDING' or classification = 'ERROR' or role_id is null)
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

create or replace function private.assert_member_import_access(p_batch_id uuid)
returns public.member_import_batches
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_batch public.member_import_batches%rowtype;
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
  select * into v_batch
  from public.member_import_batches batch
  where batch.id = p_batch_id and batch.deleted_at is null;
  if v_batch.id is null then raise exception 'IMPORT_BATCH_NOT_FOUND'; end if;
  if not public.has_permission(v_batch.church_id, 'members.import')
    or not public.can_access_congregation(v_batch.church_id, v_batch.congregation_id) then
    raise exception 'IMPORT_PERMISSION_DENIED';
  end if;
  return v_batch;
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
  v_issues jsonb;
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
      array['BIRTH_DATE_INVALID', 'BIRTH_DATE_FUTURE', 'BIRTH_DATE_TOO_OLD', 'RECEIVED_BEFORE_BIRTH'],
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
    coalesce((p_payload->>'normalization_version')::integer, 1),
    coalesce(p_payload->'settings_snapshot', '{}'::jsonb),
    v_actor, now()
  ) returning id into v_batch_id;

  insert into public.member_import_items (
    batch_id, church_id, row_number, source_data, full_name,
    normalized_name_key, phone_raw, whatsapp, birth_date, role_raw,
    role_id, role_title_variant, cpf, marital_status_raw, marital_status,
    received_date, classification, decision, issues, planned_member_id
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
      'normalization_version', coalesce((p_payload->>'normalization_version')::integer, 1)
    ),
    'INFO'
  );
  return v_batch_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- Auditoria resumida durante a transação de importação
-- ---------------------------------------------------------------------------

create or replace function public.audit_member_mutation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare v_action text; declare v_description text;
begin
  if current_setting('eclesias.member_import', true) = 'on' then return new; end if;
  if tg_op = 'INSERT' then
    v_action := 'MEMBER_CREATED'; v_description := 'Membro cadastrado.';
    perform public.log_audit(new.church_id, 'members', v_action, 'member', new.id,
      new.full_name, v_description, null,
      jsonb_build_object('congregation_id', new.congregation_id, 'member_status', new.member_status, 'member_type', new.member_type), null, 'INFO');
  else
    if new.deleted_at is distinct from old.deleted_at then
      v_action := 'MEMBER_ARCHIVED'; v_description := 'Cadastro de membro arquivado.';
    elsif new.congregation_id is distinct from old.congregation_id then
      v_action := 'MEMBER_TRANSFERRED'; v_description := 'Congregação do membro alterada.';
    elsif new.member_status is distinct from old.member_status then
      v_action := 'MEMBER_STATUS_CHANGED'; v_description := 'Situação do membro alterada.';
    else
      v_action := 'MEMBER_UPDATED'; v_description := 'Cadastro de membro atualizado.';
    end if;
    perform public.log_audit(new.church_id, 'members', v_action, 'member', new.id,
      new.full_name, v_description,
      jsonb_build_object('congregation_id', old.congregation_id, 'member_status', old.member_status, 'member_type', old.member_type),
      jsonb_build_object('congregation_id', new.congregation_id, 'member_status', new.member_status, 'member_type', new.member_type), null,
      case when v_action in ('MEMBER_ARCHIVED','MEMBER_TRANSFERRED') then 'WARNING' else 'INFO' end);
  end if;
  return new;
end;
$$;

create or replace function public.audit_sensitive_member_mutation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare v_changed jsonb;
begin
  if current_setting('eclesias.member_import', true) = 'on' then return new; end if;
  if tg_op = 'UPDATE' then
    v_changed := jsonb_build_object(
      'cpf', new.cpf is distinct from old.cpf,
      'rg', new.rg is distinct from old.rg,
      'issuing_agency', new.issuing_agency is distinct from old.issuing_agency
    );
  else
    v_changed := jsonb_build_object(
      'cpf', new.cpf is not null,
      'rg', new.rg is not null,
      'issuing_agency', new.issuing_agency is not null
    );
  end if;
  perform public.log_audit(new.church_id, 'members',
    case when tg_op = 'INSERT' then 'SENSITIVE_IDENTITY_CREATED' else 'SENSITIVE_IDENTITY_UPDATED' end,
    'member', new.member_id, null, 'Dados de identidade sensível alterados.', null, null,
    jsonb_build_object('changed_fields', v_changed), 'WARNING');
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Execução atômica do lote
-- ---------------------------------------------------------------------------

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
      id, church_id, congregation_id, full_name, birth_date, marital_status,
      whatsapp, country, member_code, member_status, member_type, received_date,
      source_import_batch_id, history_migration_status
    ) values (
      v_item.planned_member_id, v_batch.church_id, v_batch.congregation_id,
      v_item.full_name, v_item.birth_date, v_item.marital_status,
      v_item.whatsapp, 'Brasil', v_member_code, 'ACTIVE', 'MEMBER',
      v_item.received_date, p_batch_id, 'PENDING'
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

-- ---------------------------------------------------------------------------
-- Desfazimento protegido
-- ---------------------------------------------------------------------------

create or replace function private.rollback_member_import(p_batch_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_batch public.member_import_batches%rowtype;
  v_blockers jsonb;
  v_deleted integer;
begin
  v_batch := private.assert_member_import_access(p_batch_id);
  select * into v_batch
  from public.member_import_batches batch
  where batch.id = p_batch_id
  for update;
  if v_batch.status = 'ROLLED_BACK' then
    return jsonb_build_object('batch_id', p_batch_id, 'already_rolled_back', true, 'deleted_rows', 0);
  end if;
  if v_batch.status <> 'COMPLETED' or v_batch.completed_at is null then
    raise exception 'IMPORT_BATCH_INVALID_STATUS';
  end if;

  -- Serializa qualquer edição concorrente antes de avaliar os bloqueadores.
  -- Assim, uma alteração não pode entrar entre a verificação e o DELETE.
  perform 1
  from public.members member
  where member.source_import_batch_id = p_batch_id
  for update;

  select coalesce(jsonb_agg(jsonb_build_object(
    'member_id', member.id,
    'member_code', member.member_code,
    'full_name', member.full_name,
    'reason', blocker.reason
  ) order by member.full_name), '[]'::jsonb)
  into v_blockers
  from public.members member
  cross join lateral (
    select case
      when member.updated_at > v_batch.completed_at then 'MEMBER_UPDATED'
      when exists (
        select 1 from public.member_roles link
        where link.member_id = member.id
          and (link.created_at > v_batch.completed_at or link.updated_at > v_batch.completed_at)
      ) then 'ROLE_CHANGED'
      when exists (
        select 1 from public.member_history history
        where history.member_id = member.id
          and history.created_at > v_batch.completed_at
          and coalesce(history.metadata->>'batch_id', '') <> p_batch_id::text
      ) then 'HISTORY_ADDED'
      when exists (
        select 1 from public.member_documents document
        where document.member_id = member.id and document.created_at > v_batch.completed_at
      ) then 'DOCUMENT_ADDED'
      when exists (
        select 1 from public.member_pastoral_notes note
        where note.member_id = member.id and note.created_at > v_batch.completed_at
      ) then 'PASTORAL_NOTE_ADDED'
      when exists (
        select 1 from public.member_ministries ministry
        where ministry.member_id = member.id and ministry.created_at > v_batch.completed_at
      ) then 'MINISTRY_ADDED'
      when exists (
        select 1 from public.financial_transactions transaction
        where transaction.member_id = member.id and transaction.created_at > v_batch.completed_at
      ) then 'FINANCIAL_TRANSACTION_ADDED'
      when exists (
        select 1 from public.audit_logs audit
        where audit.entity_type = 'member'
          and audit.entity_id = member.id
          and audit.created_at > v_batch.completed_at
      ) then 'AUDIT_AFTER_IMPORT'
      else null
    end as reason
  ) blocker
  where member.source_import_batch_id = p_batch_id
    and blocker.reason is not null;

  if jsonb_array_length(v_blockers) > 0 then
    return jsonb_build_object(
      'batch_id', p_batch_id,
      'blocked', true,
      'blockers', v_blockers
    );
  end if;
  if (
    select count(*) from public.members member
    where member.source_import_batch_id = p_batch_id
  ) <> v_batch.imported_rows then
    raise exception 'IMPORT_ROLLBACK_BLOCKED';
  end if;

  perform set_config('eclesias.member_import', 'on', true);
  delete from public.members member
  where member.source_import_batch_id = p_batch_id;
  get diagnostics v_deleted = row_count;

  update public.member_import_batches
  set
    status = 'ROLLED_BACK',
    rolled_back_at = now(),
    rolled_back_by = v_actor
  where id = p_batch_id;

  perform public.log_audit(
    v_batch.church_id, 'members', 'MEMBER_IMPORT_ROLLED_BACK',
    'member_import_batch', p_batch_id, null,
    'Lote de membros desfeito após verificação de segurança.',
    null, jsonb_build_object('deleted_rows', v_deleted),
    jsonb_build_object('batch_id', p_batch_id, 'congregation_id', v_batch.congregation_id),
    'WARNING'
  );

  return jsonb_build_object(
    'batch_id', p_batch_id,
    'blocked', false,
    'deleted_rows', v_deleted,
    'already_rolled_back', false
  );
end;
$$;

create or replace function private.cancel_member_import(p_batch_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare v_batch public.member_import_batches%rowtype;
begin
  v_batch := private.assert_member_import_access(p_batch_id);
  if v_batch.status not in ('DRAFT', 'REVIEW', 'READY', 'FAILED') then
    raise exception 'IMPORT_BATCH_INVALID_STATUS';
  end if;
  update public.member_import_batches
  set status = 'CANCELLED'
  where id = p_batch_id;
  perform public.log_audit(
    v_batch.church_id, 'members', 'MEMBER_IMPORT_CANCELLED',
    'member_import_batch', p_batch_id, null,
    'Lote de importação cancelado.', null, null,
    jsonb_build_object('batch_id', p_batch_id), 'INFO'
  );
  return jsonb_build_object('batch_id', p_batch_id, 'cancelled', true);
end;
$$;

-- Wrappers security invoker expostos ao Data API. A lógica privilegiada fica
-- no schema privado e repete autenticação, permissão, tenant e escopo.
create or replace function public.execute_member_import(p_batch_id uuid)
returns jsonb language sql security invoker set search_path = ''
as $$ select private.execute_member_import(p_batch_id); $$;

create or replace function public.rollback_member_import(p_batch_id uuid)
returns jsonb language sql security invoker set search_path = ''
as $$ select private.rollback_member_import(p_batch_id); $$;

create or replace function public.cancel_member_import(p_batch_id uuid)
returns jsonb language sql security invoker set search_path = ''
as $$ select private.cancel_member_import(p_batch_id); $$;

create or replace function public.resolve_member_import_mapping(
  p_batch_id uuid, p_kind text, p_raw_value text, p_value text
)
returns jsonb language sql security invoker set search_path = ''
as $$ select private.resolve_member_import_mapping(p_batch_id, p_kind, p_raw_value, p_value); $$;

create or replace function public.resolve_member_import_item(
  p_batch_id uuid, p_item_id uuid, p_resolution text
)
returns jsonb language sql security invoker set search_path = ''
as $$ select private.resolve_member_import_item(p_batch_id, p_item_id, p_resolution); $$;

create or replace function public.prepare_member_import(p_payload jsonb, p_items jsonb)
returns uuid language sql security invoker set search_path = ''
as $$ select private.prepare_member_import(p_payload, p_items); $$;

revoke all on function private.assert_member_import_access(uuid) from public, anon, authenticated;
revoke all on function private.execute_member_import(uuid) from public, anon;
revoke all on function private.rollback_member_import(uuid) from public, anon;
revoke all on function private.cancel_member_import(uuid) from public, anon;
revoke all on function private.resolve_member_import_mapping(uuid, text, text, text) from public, anon;
revoke all on function private.resolve_member_import_item(uuid, uuid, text) from public, anon;
revoke all on function private.prepare_member_import(jsonb, jsonb) from public, anon;
grant usage on schema private to authenticated;
grant execute on function private.execute_member_import(uuid) to authenticated;
grant execute on function private.rollback_member_import(uuid) to authenticated;
grant execute on function private.cancel_member_import(uuid) to authenticated;
grant execute on function private.resolve_member_import_mapping(uuid, text, text, text) to authenticated;
grant execute on function private.resolve_member_import_item(uuid, uuid, text) to authenticated;
grant execute on function private.prepare_member_import(jsonb, jsonb) to authenticated;

revoke all on function public.execute_member_import(uuid) from public, anon;
revoke all on function public.rollback_member_import(uuid) from public, anon;
revoke all on function public.cancel_member_import(uuid) from public, anon;
revoke all on function public.resolve_member_import_mapping(uuid, text, text, text) from public, anon;
revoke all on function public.resolve_member_import_item(uuid, uuid, text) from public, anon;
revoke all on function public.prepare_member_import(jsonb, jsonb) from public, anon;
grant execute on function public.execute_member_import(uuid) to authenticated;
grant execute on function public.rollback_member_import(uuid) to authenticated;
grant execute on function public.cancel_member_import(uuid) to authenticated;
grant execute on function public.resolve_member_import_mapping(uuid, text, text, text) to authenticated;
grant execute on function public.resolve_member_import_item(uuid, uuid, text) to authenticated;
grant execute on function public.prepare_member_import(jsonb, jsonb) to authenticated;

notify pgrst, 'reload schema';
