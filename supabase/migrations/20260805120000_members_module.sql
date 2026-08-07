-- EKLESIA — readequação completa do Módulo de Membros
-- Cadastro transacional, ciclo de vida, histórico, documentos privados,
-- paginação/indexação e consolidação das permissões canônicas.

begin;

create schema if not exists private;
revoke all on schema private from public, anon;
grant usage on schema private to authenticated;

create extension if not exists pg_trgm with schema extensions;

-- ---------------------------------------------------------------------------
-- Preservação de dados legados antes da limpeza da tabela principal
-- ---------------------------------------------------------------------------

insert into public.member_sensitive_identity (
  member_id,
  church_id,
  cpf,
  rg,
  issuing_agency,
  created_by,
  updated_by
)
select
  member.id,
  member.church_id,
  nullif(regexp_replace(coalesce(member.cpf, ''), '[^0-9]', '', 'g'), ''),
  nullif(btrim(member.rg), ''),
  nullif(btrim(member.issuing_agency), ''),
  null,
  null
from public.members member
where member.cpf is not null
   or member.rg is not null
   or member.issuing_agency is not null
on conflict (member_id) do update set
  cpf = coalesce(public.member_sensitive_identity.cpf, excluded.cpf),
  rg = coalesce(public.member_sensitive_identity.rg, excluded.rg),
  issuing_agency = coalesce(
    public.member_sensitive_identity.issuing_agency,
    excluded.issuing_agency
  ),
  updated_at = now();

insert into public.member_pastoral_notes (
  member_id,
  church_id,
  notes,
  created_by,
  updated_by
)
select
  member.id,
  member.church_id,
  btrim(member.pastoral_notes),
  null,
  null
from public.members member
where nullif(btrim(member.pastoral_notes), '') is not null
on conflict (member_id) do update set
  notes = case
    when nullif(btrim(public.member_pastoral_notes.notes), '') is null
      then excluded.notes
    else public.member_pastoral_notes.notes
  end,
  updated_at = now();

drop trigger if exists clear_members_legacy_sensitive_columns on public.members;
drop function if exists public.clear_legacy_member_sensitive_columns();

drop index if exists public.members_main_role_idx;
drop index if exists public.members_ministry_idx;

alter table public.members
  drop column if exists photo_url,
  drop column if exists wedding_date,
  drop column if exists cpf,
  drop column if exists rg,
  drop column if exists issuing_agency,
  drop column if exists phone,
  drop column if exists guardian_name,
  drop column if exists guardian_phone,
  drop column if exists joined_at,
  drop column if exists child_presentation_date,
  drop column if exists main_role,
  drop column if exists ministry,
  drop column if exists is_public_worker,
  drop column if exists is_active_in_ministry,
  drop column if exists can_receive_notifications,
  drop column if exists pastoral_notes;

update public.members
set member_type = 'VISITOR', member_status = 'ACTIVE'
where member_status = 'VISITOR';

alter table public.members drop constraint if exists members_status_check;
alter table public.members
  add constraint members_status_check
  check (member_status in (
    'ACTIVE', 'INACTIVE', 'TRANSFERRED', 'DISCIPLINED', 'DECEASED'
  ));

alter table public.member_history
  add column if not exists metadata jsonb not null default '{}'::jsonb;

alter table public.member_history
  drop constraint if exists member_history_type_check;
alter table public.member_history
  add constraint member_history_type_check
  check (history_type in (
    'MEMBER_CREATED',
    'MEMBER_RECEIVED',
    'CONGREGATION_CHANGE',
    'ROLE_ASSIGNED',
    'ROLE_CHANGED',
    'ROLE_ENDED',
    'STATUS_CHANGE',
    'MEMBER_INACTIVATED',
    'MEMBER_REACTIVATED',
    'MEMBER_TRANSFERRED',
    'MEMBER_DISCIPLINED',
    'MEMBER_DECEASED',
    'BAPTISM_UPDATED',
    'GENERAL_NOTE',
    'PASTORAL_NOTE'
  ));

update public.member_documents
set document_type = 'MEMBERSHIP_FORM'
where document_type = 'MEMBER_FORM';

alter table public.member_documents
  drop constraint if exists member_documents_type_check;
alter table public.member_documents
  add constraint member_documents_type_check
  check (document_type in (
    'PHOTO',
    'CPF',
    'RG',
    'BIRTH_CERTIFICATE',
    'MARRIAGE_CERTIFICATE',
    'TRANSFER_LETTER',
    'ADDRESS_PROOF',
    'BAPTISM_CERTIFICATE',
    'MEMBERSHIP_FORM',
    'OTHER'
  ));

alter table public.member_documents drop column if exists file_url;

-- Integridade multi-tenant nas tabelas filhas.
create unique index if not exists members_church_id_id_unique_idx
  on public.members (church_id, id);
create unique index if not exists roles_church_id_id_unique_idx
  on public.roles (church_id, id);
create unique index if not exists congregations_church_id_id_unique_idx
  on public.congregations (church_id, id);

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'member_sensitive_identity_member_same_church_fk'
      and conrelid = 'public.member_sensitive_identity'::regclass
  ) then
    alter table public.member_sensitive_identity
      add constraint member_sensitive_identity_member_same_church_fk
      foreign key (church_id, member_id)
      references public.members(church_id, id)
      on delete cascade;
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'member_pastoral_notes_member_same_church_fk'
      and conrelid = 'public.member_pastoral_notes'::regclass
  ) then
    alter table public.member_pastoral_notes
      add constraint member_pastoral_notes_member_same_church_fk
      foreign key (church_id, member_id)
      references public.members(church_id, id)
      on delete cascade;
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'member_history_member_same_church_fk'
      and conrelid = 'public.member_history'::regclass
  ) then
    alter table public.member_history
      add constraint member_history_member_same_church_fk
      foreign key (church_id, member_id)
      references public.members(church_id, id)
      on delete cascade;
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'member_documents_member_same_church_fk'
      and conrelid = 'public.member_documents'::regclass
  ) then
    alter table public.member_documents
      add constraint member_documents_member_same_church_fk
      foreign key (church_id, member_id)
      references public.members(church_id, id)
      on delete cascade;
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'member_roles_member_same_church_fk'
      and conrelid = 'public.member_roles'::regclass
  ) then
    alter table public.member_roles
      add constraint member_roles_member_same_church_fk
      foreign key (church_id, member_id)
      references public.members(church_id, id)
      on delete cascade;
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'member_roles_role_same_church_fk'
      and conrelid = 'public.member_roles'::regclass
  ) then
    alter table public.member_roles
      add constraint member_roles_role_same_church_fk
      foreign key (church_id, role_id)
      references public.roles(church_id, id)
      on delete restrict;
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'member_roles_congregation_same_church_fk'
      and conrelid = 'public.member_roles'::regclass
  ) then
    alter table public.member_roles
      add constraint member_roles_congregation_same_church_fk
      foreign key (church_id, congregation_id)
      references public.congregations(church_id, id)
      on delete restrict;
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- Permissões canônicas
-- ---------------------------------------------------------------------------

insert into public.permissions (
  key,
  name,
  description,
  module,
  action,
  is_sensitive,
  status
)
values (
  'members.restore',
  'Restaurar membro arquivado',
  'Restaurar cadastros de membros excluídos logicamente',
  'members',
  'restore',
  true,
  'ACTIVE'
)
on conflict do nothing;

update public.permissions
set status = 'ACTIVE', deleted_at = null, updated_at = now()
where key in (
  'members.view_basic',
  'members.view_full',
  'members.create',
  'members.update',
  'members.change_status',
  'members.transfer',
  'members.archive',
  'members.restore',
  'members.view_sensitive_identity',
  'members.manage_sensitive_identity',
  'members.view_pastoral_notes',
  'members.edit_pastoral_notes',
  'members.manage_documents',
  'members.view_sensitive_documents',
  'member_roles.view',
  'member_roles.manage',
  'member_history.view',
  'member_history.create',
  'member_history.view_sensitive',
  'positions.manage'
);

insert into public.role_permissions (role, permission_id, status)
select 'ADMIN', permission.id, 'ACTIVE'
from public.permissions permission
where permission.key = 'members.restore'
  and permission.deleted_at is null
  and not exists (
    select 1
    from public.role_permissions role_permission
    where role_permission.role = 'ADMIN'
      and role_permission.permission_id = permission.id
      and role_permission.deleted_at is null
  );

-- ---------------------------------------------------------------------------
-- Índices alinhados às consultas paginadas, relacionamentos e RLS
-- ---------------------------------------------------------------------------

create index if not exists members_list_name_active_idx
  on public.members (church_id, full_name, id)
  where deleted_at is null;

create index if not exists members_list_status_active_idx
  on public.members (church_id, member_status, full_name, id)
  where deleted_at is null;

create index if not exists members_list_congregation_status_active_idx
  on public.members (church_id, congregation_id, member_status, full_name, id)
  where deleted_at is null;

create index if not exists members_list_type_active_idx
  on public.members (church_id, member_type, full_name, id)
  where deleted_at is null;

create index if not exists members_full_name_trgm_active_idx
  on public.members using gin (full_name extensions.gin_trgm_ops)
  where deleted_at is null;

create index if not exists members_preferred_name_trgm_active_idx
  on public.members using gin (preferred_name extensions.gin_trgm_ops)
  where deleted_at is null and preferred_name is not null;

create index if not exists member_roles_member_active_idx
  on public.member_roles (church_id, member_id, status, is_primary)
  where deleted_at is null;

create index if not exists member_roles_role_active_idx
  on public.member_roles (church_id, role_id, status, member_id)
  where deleted_at is null;

create index if not exists member_history_timeline_active_idx
  on public.member_history (church_id, member_id, event_date desc, id desc)
  where deleted_at is null;

create index if not exists member_documents_member_active_idx
  on public.member_documents (church_id, member_id, uploaded_at desc, id desc)
  where deleted_at is null;

create index if not exists member_pastoral_notes_church_member_active_idx
  on public.member_pastoral_notes (church_id, member_id)
  where deleted_at is null;

create index if not exists member_sensitive_identity_church_member_active_idx
  on public.member_sensitive_identity (church_id, member_id)
  where deleted_at is null;

create index if not exists financial_transactions_member_timeline_active_idx
  on public.financial_transactions (
    church_id,
    member_id,
    transaction_date desc,
    id desc
  )
  where deleted_at is null and member_id is not null;

-- ---------------------------------------------------------------------------
-- RLS para leitura, escrita, sensibilidade e exclusão lógica
-- ---------------------------------------------------------------------------

alter table public.members enable row level security;
alter table public.member_sensitive_identity enable row level security;
alter table public.member_pastoral_notes enable row level security;
alter table public.member_history enable row level security;
alter table public.member_documents enable row level security;
alter table public.member_roles enable row level security;

drop policy if exists members_select_scope on public.members;
create policy members_select_scope
on public.members for select to authenticated
using (
  deleted_at is null
  and (select public.has_permission(church_id, 'members.view_basic'))
  and (select public.can_access_member(church_id, id, congregation_id))
);

drop policy if exists members_select_archived_restore on public.members;
create policy members_select_archived_restore
on public.members for select to authenticated
using (
  deleted_at is not null
  and (select public.has_permission(church_id, 'members.restore'))
  and (select public.can_access_member(church_id, id, congregation_id))
);

drop policy if exists members_insert_scope on public.members;
create policy members_insert_scope
on public.members for insert to authenticated
with check (
  deleted_at is null
  and (select public.has_permission(church_id, 'members.create'))
  and (select public.can_access_congregation(church_id, congregation_id))
);

drop policy if exists members_update_scope on public.members;
create policy members_update_scope
on public.members for update to authenticated
using (
  deleted_at is null
  and (select public.has_permission(church_id, 'members.update'))
  and (select public.can_access_member(church_id, id, congregation_id))
)
with check (
  (select public.has_permission(church_id, 'members.update'))
  and (select public.can_access_congregation(church_id, congregation_id))
);

drop policy if exists member_sensitive_select on public.member_sensitive_identity;
create policy member_sensitive_select
on public.member_sensitive_identity for select to authenticated
using (
  deleted_at is null
  and (select public.has_permission(church_id, 'members.view_sensitive_identity'))
  and exists (
    select 1 from public.members member
    where member.id = member_id
      and member.church_id = member_sensitive_identity.church_id
      and (select public.can_access_member(
        member.church_id,
        member.id,
        member.congregation_id
      ))
  )
);

drop policy if exists member_sensitive_insert on public.member_sensitive_identity;
create policy member_sensitive_insert
on public.member_sensitive_identity for insert to authenticated
with check (
  deleted_at is null
  and (select public.has_permission(church_id, 'members.manage_sensitive_identity'))
  and exists (
    select 1 from public.members member
    where member.id = member_id
      and member.church_id = member_sensitive_identity.church_id
      and (select public.can_access_member(
        member.church_id,
        member.id,
        member.congregation_id
      ))
  )
);

drop policy if exists member_sensitive_update on public.member_sensitive_identity;
create policy member_sensitive_update
on public.member_sensitive_identity for update to authenticated
using (
  (select public.has_permission(church_id, 'members.manage_sensitive_identity'))
)
with check (
  (select public.has_permission(church_id, 'members.manage_sensitive_identity'))
  and exists (
    select 1 from public.members member
    where member.id = member_id
      and member.church_id = member_sensitive_identity.church_id
      and (select public.can_access_member(
        member.church_id,
        member.id,
        member.congregation_id
      ))
  )
);

drop policy if exists pastoral_notes_select on public.member_pastoral_notes;
create policy pastoral_notes_select
on public.member_pastoral_notes for select to authenticated
using (
  deleted_at is null
  and (select public.has_permission(church_id, 'members.view_pastoral_notes'))
  and exists (
    select 1 from public.members member
    where member.id = member_id
      and member.church_id = member_pastoral_notes.church_id
      and (select public.can_access_member(
        member.church_id,
        member.id,
        member.congregation_id
      ))
  )
);

drop policy if exists pastoral_notes_insert on public.member_pastoral_notes;
create policy pastoral_notes_insert
on public.member_pastoral_notes for insert to authenticated
with check (
  deleted_at is null
  and (select public.has_permission(church_id, 'members.edit_pastoral_notes'))
  and exists (
    select 1 from public.members member
    where member.id = member_id
      and member.church_id = member_pastoral_notes.church_id
      and (select public.can_access_member(
        member.church_id,
        member.id,
        member.congregation_id
      ))
  )
);

drop policy if exists pastoral_notes_update on public.member_pastoral_notes;
create policy pastoral_notes_update
on public.member_pastoral_notes for update to authenticated
using (
  (select public.has_permission(church_id, 'members.edit_pastoral_notes'))
)
with check (
  (select public.has_permission(church_id, 'members.edit_pastoral_notes'))
  and exists (
    select 1 from public.members member
    where member.id = member_id
      and member.church_id = member_pastoral_notes.church_id
      and (select public.can_access_member(
        member.church_id,
        member.id,
        member.congregation_id
      ))
  )
);

drop policy if exists member_history_select_scope on public.member_history;
create policy member_history_select_scope
on public.member_history for select to authenticated
using (
  deleted_at is null
  and (select public.has_permission(church_id, 'member_history.view'))
  and (
    not is_sensitive
    or (select public.has_permission(church_id, 'member_history.view_sensitive'))
  )
  and exists (
    select 1 from public.members member
    where member.id = member_id
      and member.church_id = member_history.church_id
      and (select public.can_access_member(
        member.church_id,
        member.id,
        member.congregation_id
      ))
  )
);

drop policy if exists member_history_insert_scope on public.member_history;
create policy member_history_insert_scope
on public.member_history for insert to authenticated
with check (
  deleted_at is null
  and (select public.has_permission(church_id, 'member_history.create'))
  and (
    not is_sensitive
    or (select public.has_permission(church_id, 'member_history.view_sensitive'))
  )
  and exists (
    select 1 from public.members member
    where member.id = member_id
      and member.church_id = member_history.church_id
      and (select public.can_access_member(
        member.church_id,
        member.id,
        member.congregation_id
      ))
  )
);

drop policy if exists member_documents_select_scope on public.member_documents;
create policy member_documents_select_scope
on public.member_documents for select to authenticated
using (
  deleted_at is null
  and (
    (select public.has_permission(church_id, 'members.view_full'))
    or (select public.has_permission(church_id, 'members.manage_documents'))
  )
  and (
    not is_sensitive
    or (select public.has_permission(church_id, 'members.view_sensitive_documents'))
  )
  and exists (
    select 1 from public.members member
    where member.id = member_id
      and member.church_id = member_documents.church_id
      and (select public.can_access_member(
        member.church_id,
        member.id,
        member.congregation_id
      ))
  )
);

drop policy if exists member_documents_select_archived_managers
  on public.member_documents;
create policy member_documents_select_archived_managers
on public.member_documents for select to authenticated
using (
  deleted_at is not null
  and (select public.has_permission(church_id, 'members.manage_documents'))
  and exists (
    select 1 from public.members member
    where member.id = member_id
      and member.church_id = member_documents.church_id
      and (select public.can_access_member(
        member.church_id,
        member.id,
        member.congregation_id
      ))
  )
);

drop policy if exists member_documents_insert_scope on public.member_documents;
create policy member_documents_insert_scope
on public.member_documents for insert to authenticated
with check (
  deleted_at is null
  and (select public.has_permission(church_id, 'members.manage_documents'))
  and exists (
    select 1 from public.members member
    where member.id = member_id
      and member.church_id = member_documents.church_id
      and (select public.can_access_member(
        member.church_id,
        member.id,
        member.congregation_id
      ))
  )
);

drop policy if exists member_documents_update_scope on public.member_documents;
create policy member_documents_update_scope
on public.member_documents for update to authenticated
using (
  deleted_at is null
  and (select public.has_permission(church_id, 'members.manage_documents'))
  and exists (
    select 1 from public.members member
    where member.id = member_id
      and member.church_id = member_documents.church_id
      and (select public.can_access_member(
        member.church_id,
        member.id,
        member.congregation_id
      ))
  )
)
with check (
  (select public.has_permission(church_id, 'members.manage_documents'))
  and exists (
    select 1 from public.members member
    where member.id = member_id
      and member.church_id = member_documents.church_id
      and (select public.can_access_member(
        member.church_id,
        member.id,
        member.congregation_id
      ))
  )
);

drop policy if exists member_roles_select_scope on public.member_roles;
create policy member_roles_select_scope
on public.member_roles for select to authenticated
using (
  deleted_at is null
  and (select public.has_permission(church_id, 'member_roles.view'))
  and exists (
    select 1 from public.members member
    where member.id = member_id
      and member.church_id = member_roles.church_id
      and (select public.can_access_member(
        member.church_id,
        member.id,
        member.congregation_id
      ))
  )
);

drop policy if exists member_roles_insert_scope on public.member_roles;
create policy member_roles_insert_scope
on public.member_roles for insert to authenticated
with check (
  deleted_at is null
  and (select public.has_permission(church_id, 'member_roles.manage'))
  and exists (
    select 1 from public.members member
    where member.id = member_id
      and member.church_id = member_roles.church_id
      and (select public.can_access_member(
        member.church_id,
        member.id,
        member.congregation_id
      ))
  )
);

drop policy if exists member_roles_update_scope on public.member_roles;
create policy member_roles_update_scope
on public.member_roles for update to authenticated
using (
  deleted_at is null
  and (select public.has_permission(church_id, 'member_roles.manage'))
)
with check (
  (select public.has_permission(church_id, 'member_roles.manage'))
  and exists (
    select 1 from public.members member
    where member.id = member_id
      and member.church_id = member_roles.church_id
      and (select public.can_access_member(
        member.church_id,
        member.id,
        member.congregation_id
      ))
  )
);

drop policy if exists roles_select_access on public.roles;
create policy roles_select_access
on public.roles for select to authenticated
using (
  deleted_at is null
  and (select public.can_access_church(church_id))
  and (
    (select public.has_permission(church_id, 'organization.view'))
    or (select public.has_permission(church_id, 'members.view_basic'))
    or (select public.has_permission(church_id, 'member_roles.view'))
  )
);

-- ---------------------------------------------------------------------------
-- Bucket privado e políticas de Storage vinculadas aos metadados autorizados
-- ---------------------------------------------------------------------------

insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values (
  'member-documents',
  'member-documents',
  false,
  10485760,
  array[
    'application/pdf',
    'image/jpeg',
    'image/png',
    'image/webp',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ]::text[]
)
on conflict (id) do update set
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists member_files_select on storage.objects;
create policy member_files_select
on storage.objects for select to authenticated
using (
  bucket_id = 'member-documents'
  and exists (
    select 1
    from public.member_documents document
    where document.storage_bucket = storage.objects.bucket_id
      and document.storage_path = storage.objects.name
      and document.deleted_at is null
  )
);

drop policy if exists member_files_insert on storage.objects;
create policy member_files_insert
on storage.objects for insert to authenticated
with check (
  bucket_id = 'member-documents'
  and (select public.has_permission(
    public.safe_uuid((storage.foldername(name))[1]),
    'members.manage_documents'
  ))
  and exists (
    select 1
    from public.members member
    where member.church_id = public.safe_uuid((storage.foldername(name))[1])
      and member.id = public.safe_uuid((storage.foldername(name))[2])
      and member.deleted_at is null
      and (select public.can_access_member(
        member.church_id,
        member.id,
        member.congregation_id
      ))
  )
);

drop policy if exists member_files_update on storage.objects;
create policy member_files_update
on storage.objects for update to authenticated
using (
  bucket_id = 'member-documents'
  and (select public.has_permission(
    public.safe_uuid((storage.foldername(name))[1]),
    'members.manage_documents'
  ))
  and exists (
    select 1
    from public.members member
    where member.church_id = public.safe_uuid((storage.foldername(name))[1])
      and member.id = public.safe_uuid((storage.foldername(name))[2])
      and member.deleted_at is null
      and (select public.can_access_member(
        member.church_id,
        member.id,
        member.congregation_id
      ))
  )
)
with check (
  bucket_id = 'member-documents'
  and (select public.has_permission(
    public.safe_uuid((storage.foldername(name))[1]),
    'members.manage_documents'
  ))
);

drop policy if exists member_files_delete on storage.objects;
create policy member_files_delete
on storage.objects for delete to authenticated
using (
  bucket_id = 'member-documents'
  and (select public.has_permission(
    public.safe_uuid((storage.foldername(name))[1]),
    'members.manage_documents'
  ))
  and exists (
    select 1
    from public.members member
    where member.church_id = public.safe_uuid((storage.foldername(name))[1])
      and member.id = public.safe_uuid((storage.foldername(name))[2])
      and member.deleted_at is null
      and (select public.can_access_member(
        member.church_id,
        member.id,
        member.congregation_id
      ))
  )
);

-- ---------------------------------------------------------------------------
-- Estatísticas agregadas respeitando RLS
-- ---------------------------------------------------------------------------

create or replace function public.get_member_stats(p_church_id uuid)
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  select jsonb_build_object(
    'total', count(*),
    'active', count(*) filter (where member.member_status = 'ACTIVE'),
    'members', count(*) filter (where member.member_type = 'MEMBER'),
    'congregated', count(*) filter (where member.member_type = 'CONGREGATED'),
    'visitors', count(*) filter (where member.member_type = 'VISITOR'),
    'children', count(*) filter (where member.member_type = 'CHILD')
  )
  from public.members member
  where member.church_id = p_church_id
    and member.deleted_at is null;
$$;

-- ---------------------------------------------------------------------------
-- Cadastro atômico com código concorrente, dados protegidos e histórico
-- ---------------------------------------------------------------------------

create or replace function public.create_member_atomic(
  p_church_id uuid,
  p_payload jsonb
)
returns table(member_id uuid, member_code text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_member_id uuid;
  v_member_code text;
  v_congregation_id uuid := nullif(p_payload->>'congregation_id', '')::uuid;
  v_role_id uuid := nullif(p_payload->>'main_role_id', '')::uuid;
  v_role_start_date date := nullif(p_payload->>'role_start_date', '')::date;
  v_member_type text := upper(coalesce(nullif(btrim(p_payload->>'member_type'), ''), 'MEMBER'));
  v_auto_code boolean;
  v_prefix text;
  v_next_number integer;
  v_padding integer;
  v_settings_id uuid;
  v_cpf text := nullif(regexp_replace(coalesce(p_payload->>'cpf', ''), '[^0-9]', '', 'g'), '');
  v_rg text := nullif(btrim(p_payload->>'rg'), '');
  v_issuing_agency text := nullif(btrim(p_payload->>'issuing_agency'), '');
  v_pastoral_notes text := nullif(btrim(p_payload->>'pastoral_notes'), '');
  v_received_date date := nullif(p_payload->>'received_date', '')::date;
begin
  if v_actor is null then
    raise exception 'AUTH_REQUIRED';
  end if;

  if not public.has_permission(p_church_id, 'members.create') then
    raise exception 'MEMBER_PERMISSION_DENIED';
  end if;

  if v_congregation_id is null
    or not exists (
      select 1
      from public.congregations congregation
      where congregation.id = v_congregation_id
        and congregation.church_id = p_church_id
        and congregation.status = 'ACTIVE'
        and congregation.deleted_at is null
    )
    or not public.can_access_congregation(p_church_id, v_congregation_id) then
    raise exception 'MEMBER_CONGREGATION_INVALID';
  end if;

  if nullif(btrim(p_payload->>'full_name'), '') is null then
    raise exception 'MEMBER_NAME_REQUIRED';
  end if;

  if nullif(btrim(p_payload->>'city'), '') is null
    or nullif(btrim(p_payload->>'state'), '') is null then
    raise exception 'MEMBER_ADDRESS_REQUIRED';
  end if;

  if v_cpf is not null and length(v_cpf) <> 11 then
    raise exception 'MEMBER_CPF_INVALID';
  end if;

  if (v_cpf is not null or v_rg is not null or v_issuing_agency is not null)
    and not public.has_permission(
      p_church_id,
      'members.manage_sensitive_identity'
    ) then
    raise exception 'MEMBER_SENSITIVE_PERMISSION_DENIED';
  end if;

  if v_pastoral_notes is not null
    and not public.has_permission(p_church_id, 'members.edit_pastoral_notes') then
    raise exception 'MEMBER_PASTORAL_PERMISSION_DENIED';
  end if;

  select
    settings.id,
    settings.enable_member_auto_code,
    coalesce(nullif(upper(btrim(settings.member_code_prefix)), ''), 'MEM'),
    greatest(settings.member_code_next_number, 1),
    greatest(1, least(settings.member_code_padding, 10))
  into
    v_settings_id,
    v_auto_code,
    v_prefix,
    v_next_number,
    v_padding
  from public.app_settings settings
  where settings.church_id = p_church_id
    and settings.status = 'ACTIVE'
    and settings.deleted_at is null
  for update;

  if v_settings_id is null then
    raise exception 'MEMBER_SETTINGS_NOT_FOUND';
  end if;

  if v_auto_code then
    loop
      v_member_code := v_prefix || lpad(v_next_number::text, v_padding, '0');
      exit when not exists (
        select 1 from public.members existing_member
        where existing_member.church_id = p_church_id
          and existing_member.member_code = v_member_code
      );
      v_next_number := v_next_number + 1;
    end loop;

    update public.app_settings
    set member_code_next_number = v_next_number + 1,
        updated_at = now()
    where id = v_settings_id;
  else
    v_member_code := nullif(upper(btrim(p_payload->>'member_code')), '');
  end if;

  insert into public.members (
    church_id,
    congregation_id,
    full_name,
    preferred_name,
    gender,
    birth_date,
    marital_status,
    nationality,
    natural_city,
    natural_state,
    profession,
    education_level,
    physical_file_number,
    whatsapp,
    email,
    zip_code,
    address,
    number,
    complement,
    district,
    city,
    state,
    country,
    father_name,
    mother_name,
    spouse_name,
    member_code,
    member_status,
    member_type,
    conversion_date,
    baptism_date,
    baptism_church,
    has_holy_spirit_baptism,
    holy_spirit_baptism_date,
    previous_church,
    received_by,
    received_date,
    letter_origin_church,
    notes
  ) values (
    p_church_id,
    v_congregation_id,
    btrim(p_payload->>'full_name'),
    nullif(btrim(p_payload->>'preferred_name'), ''),
    nullif(upper(btrim(p_payload->>'gender')), ''),
    nullif(p_payload->>'birth_date', '')::date,
    nullif(upper(btrim(p_payload->>'marital_status')), ''),
    coalesce(nullif(btrim(p_payload->>'nationality'), ''), 'Brasileira'),
    nullif(btrim(p_payload->>'natural_city'), ''),
    nullif(upper(btrim(p_payload->>'natural_state')), ''),
    nullif(btrim(p_payload->>'profession'), ''),
    nullif(btrim(p_payload->>'education_level'), ''),
    nullif(btrim(p_payload->>'physical_file_number'), ''),
    nullif(regexp_replace(coalesce(p_payload->>'whatsapp', ''), '[^0-9]', '', 'g'), ''),
    nullif(lower(btrim(p_payload->>'email')), ''),
    nullif(regexp_replace(coalesce(p_payload->>'zip_code', ''), '[^0-9]', '', 'g'), ''),
    nullif(btrim(p_payload->>'address'), ''),
    nullif(btrim(p_payload->>'number'), ''),
    nullif(btrim(p_payload->>'complement'), ''),
    nullif(btrim(p_payload->>'district'), ''),
    btrim(p_payload->>'city'),
    upper(btrim(p_payload->>'state')),
    coalesce(nullif(btrim(p_payload->>'country'), ''), 'Brasil'),
    nullif(btrim(p_payload->>'father_name'), ''),
    nullif(btrim(p_payload->>'mother_name'), ''),
    nullif(btrim(p_payload->>'spouse_name'), ''),
    v_member_code,
    'ACTIVE',
    v_member_type,
    nullif(p_payload->>'conversion_date', '')::date,
    nullif(p_payload->>'baptism_date', '')::date,
    nullif(btrim(p_payload->>'baptism_church'), ''),
    coalesce((p_payload->>'has_holy_spirit_baptism')::boolean, false),
    nullif(p_payload->>'holy_spirit_baptism_date', '')::date,
    nullif(btrim(p_payload->>'previous_church'), ''),
    nullif(upper(btrim(p_payload->>'received_by')), ''),
    v_received_date,
    nullif(btrim(p_payload->>'letter_origin_church'), ''),
    nullif(btrim(p_payload->>'notes'), '')
  )
  returning id, members.member_code
  into v_member_id, v_member_code;

  if v_cpf is not null or v_rg is not null or v_issuing_agency is not null then
    insert into public.member_sensitive_identity (
      member_id,
      church_id,
      cpf,
      rg,
      issuing_agency,
      created_by,
      updated_by
    ) values (
      v_member_id,
      p_church_id,
      v_cpf,
      v_rg,
      v_issuing_agency,
      v_actor,
      v_actor
    );
  end if;

  if v_pastoral_notes is not null then
    insert into public.member_pastoral_notes (
      member_id,
      church_id,
      notes,
      created_by,
      updated_by
    ) values (
      v_member_id,
      p_church_id,
      v_pastoral_notes,
      v_actor,
      v_actor
    );
  end if;

  if v_role_id is not null then
    if not public.has_permission(p_church_id, 'member_roles.manage') then
      raise exception 'MEMBER_ROLE_PERMISSION_DENIED';
    end if;

    if not exists (
      select 1 from public.roles role
      where role.id = v_role_id
        and role.church_id = p_church_id
        and role.status = 'ACTIVE'
        and role.deleted_at is null
    ) then
      raise exception 'MEMBER_ROLE_INVALID';
    end if;

    insert into public.member_roles (
      church_id,
      member_id,
      role_id,
      congregation_id,
      is_primary,
      status,
      start_date,
      created_by
    ) values (
      p_church_id,
      v_member_id,
      v_role_id,
      v_congregation_id,
      true,
      'ACTIVE',
      v_role_start_date,
      v_actor
    );

    insert into public.member_history (
      church_id,
      member_id,
      congregation_id,
      history_type,
      title,
      description,
      event_date,
      is_sensitive,
      created_by,
      metadata
    ) values (
      p_church_id,
      v_member_id,
      v_congregation_id,
      'ROLE_ASSIGNED',
      'Cargo principal atribuído',
      'Cargo principal informado no cadastro inicial.',
      coalesce(v_role_start_date, current_date),
      false,
      v_actor,
      jsonb_build_object('role_id', v_role_id)
    );
  end if;

  insert into public.member_history (
    church_id,
    member_id,
    congregation_id,
    history_type,
    title,
    description,
    event_date,
    is_sensitive,
    created_by,
    metadata
  ) values (
    p_church_id,
    v_member_id,
    v_congregation_id,
    'MEMBER_CREATED',
    'Cadastro criado no EKLESIA',
    'Registro cadastral criado no sistema.',
    current_date,
    false,
    v_actor,
    jsonb_build_object('member_type', v_member_type)
  );

  if v_received_date is not null or nullif(btrim(p_payload->>'received_by'), '') is not null then
    insert into public.member_history (
      church_id,
      member_id,
      congregation_id,
      history_type,
      title,
      description,
      event_date,
      is_sensitive,
      created_by,
      metadata
    ) values (
      p_church_id,
      v_member_id,
      v_congregation_id,
      'MEMBER_RECEIVED',
      'Recebimento oficial na igreja',
      'Informação de recebimento registrada no cadastro inicial.',
      coalesce(v_received_date, current_date),
      false,
      v_actor,
      jsonb_build_object(
        'received_by', nullif(upper(btrim(p_payload->>'received_by')), ''),
        'origin_church', nullif(btrim(p_payload->>'letter_origin_church'), '')
      )
    );
  end if;

  return query select v_member_id, v_member_code;
end;
$$;

-- ---------------------------------------------------------------------------
-- Edição atômica com controle otimista de concorrência
-- ---------------------------------------------------------------------------

create or replace function public.update_member_atomic(
  p_member_id uuid,
  p_expected_updated_at timestamptz,
  p_payload jsonb
)
returns timestamptz
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_member public.members%rowtype;
  v_updated_at timestamptz;
  v_cpf text;
  v_rg text;
  v_issuing_agency text;
  v_pastoral_notes text;
  v_role_id uuid;
  v_current_primary_role uuid;
begin
  if v_actor is null then raise exception 'AUTH_REQUIRED'; end if;

  select * into v_member
  from public.members member
  where member.id = p_member_id
    and member.deleted_at is null
  for update;

  if v_member.id is null then raise exception 'MEMBER_NOT_FOUND'; end if;

  if not public.has_permission(v_member.church_id, 'members.update')
    or not public.can_access_member(
      v_member.church_id,
      v_member.id,
      v_member.congregation_id
    ) then
    raise exception 'MEMBER_PERMISSION_DENIED';
  end if;

  if p_expected_updated_at is null
    or v_member.updated_at is distinct from p_expected_updated_at then
    raise exception 'MEMBER_CONFLICT';
  end if;

  if nullif(btrim(p_payload->>'full_name'), '') is null then
    raise exception 'MEMBER_NAME_REQUIRED';
  end if;

  if nullif(btrim(p_payload->>'city'), '') is null
    or nullif(btrim(p_payload->>'state'), '') is null then
    raise exception 'MEMBER_ADDRESS_REQUIRED';
  end if;

  update public.members member
  set
    full_name = btrim(p_payload->>'full_name'),
    preferred_name = nullif(btrim(p_payload->>'preferred_name'), ''),
    gender = nullif(upper(btrim(p_payload->>'gender')), ''),
    birth_date = nullif(p_payload->>'birth_date', '')::date,
    marital_status = nullif(upper(btrim(p_payload->>'marital_status')), ''),
    nationality = coalesce(nullif(btrim(p_payload->>'nationality'), ''), 'Brasileira'),
    natural_city = nullif(btrim(p_payload->>'natural_city'), ''),
    natural_state = nullif(upper(btrim(p_payload->>'natural_state')), ''),
    profession = nullif(btrim(p_payload->>'profession'), ''),
    education_level = nullif(btrim(p_payload->>'education_level'), ''),
    physical_file_number = nullif(btrim(p_payload->>'physical_file_number'), ''),
    whatsapp = nullif(regexp_replace(coalesce(p_payload->>'whatsapp', ''), '[^0-9]', '', 'g'), ''),
    email = nullif(lower(btrim(p_payload->>'email')), ''),
    zip_code = nullif(regexp_replace(coalesce(p_payload->>'zip_code', ''), '[^0-9]', '', 'g'), ''),
    address = nullif(btrim(p_payload->>'address'), ''),
    number = nullif(btrim(p_payload->>'number'), ''),
    complement = nullif(btrim(p_payload->>'complement'), ''),
    district = nullif(btrim(p_payload->>'district'), ''),
    city = btrim(p_payload->>'city'),
    state = upper(btrim(p_payload->>'state')),
    country = coalesce(nullif(btrim(p_payload->>'country'), ''), 'Brasil'),
    father_name = nullif(btrim(p_payload->>'father_name'), ''),
    mother_name = nullif(btrim(p_payload->>'mother_name'), ''),
    spouse_name = nullif(btrim(p_payload->>'spouse_name'), ''),
    member_type = upper(coalesce(nullif(btrim(p_payload->>'member_type'), ''), member.member_type)),
    conversion_date = nullif(p_payload->>'conversion_date', '')::date,
    baptism_date = nullif(p_payload->>'baptism_date', '')::date,
    baptism_church = nullif(btrim(p_payload->>'baptism_church'), ''),
    has_holy_spirit_baptism = coalesce((p_payload->>'has_holy_spirit_baptism')::boolean, false),
    holy_spirit_baptism_date = nullif(p_payload->>'holy_spirit_baptism_date', '')::date,
    previous_church = nullif(btrim(p_payload->>'previous_church'), ''),
    received_by = nullif(upper(btrim(p_payload->>'received_by')), ''),
    received_date = nullif(p_payload->>'received_date', '')::date,
    letter_origin_church = nullif(btrim(p_payload->>'letter_origin_church'), ''),
    notes = nullif(btrim(p_payload->>'notes'), '')
  where member.id = p_member_id
  returning member.updated_at into v_updated_at;

  if p_payload ? 'cpf' or p_payload ? 'rg' or p_payload ? 'issuing_agency' then
    if not public.has_permission(
      v_member.church_id,
      'members.manage_sensitive_identity'
    ) then
      raise exception 'MEMBER_SENSITIVE_PERMISSION_DENIED';
    end if;

    v_cpf := nullif(regexp_replace(coalesce(p_payload->>'cpf', ''), '[^0-9]', '', 'g'), '');
    v_rg := nullif(btrim(p_payload->>'rg'), '');
    v_issuing_agency := nullif(btrim(p_payload->>'issuing_agency'), '');

    if v_cpf is not null and length(v_cpf) <> 11 then
      raise exception 'MEMBER_CPF_INVALID';
    end if;

    insert into public.member_sensitive_identity (
      member_id,
      church_id,
      cpf,
      rg,
      issuing_agency,
      created_by,
      updated_by,
      deleted_at
    ) values (
      p_member_id,
      v_member.church_id,
      v_cpf,
      v_rg,
      v_issuing_agency,
      v_actor,
      v_actor,
      null
    )
    on conflict (member_id) do update set
      cpf = excluded.cpf,
      rg = excluded.rg,
      issuing_agency = excluded.issuing_agency,
      updated_by = v_actor,
      updated_at = now(),
      deleted_at = null;
  end if;

  if p_payload ? 'pastoral_notes' then
    if not public.has_permission(
      v_member.church_id,
      'members.edit_pastoral_notes'
    ) then
      raise exception 'MEMBER_PASTORAL_PERMISSION_DENIED';
    end if;

    v_pastoral_notes := nullif(btrim(p_payload->>'pastoral_notes'), '');

    if v_pastoral_notes is not null then
      insert into public.member_pastoral_notes (
        member_id,
        church_id,
        notes,
        created_by,
        updated_by,
        deleted_at
      ) values (
        p_member_id,
        v_member.church_id,
        v_pastoral_notes,
        v_actor,
        v_actor,
        null
      )
      on conflict (member_id) do update set
        notes = excluded.notes,
        updated_by = v_actor,
        updated_at = now(),
        deleted_at = null;
    else
      update public.member_pastoral_notes
      set deleted_at = now(), updated_by = v_actor, updated_at = now()
      where member_id = p_member_id and deleted_at is null;
    end if;
  end if;

  if p_payload ? 'main_role_id' then
    if not public.has_permission(v_member.church_id, 'member_roles.manage') then
      raise exception 'MEMBER_ROLE_PERMISSION_DENIED';
    end if;

    v_role_id := nullif(p_payload->>'main_role_id', '')::uuid;

    select role_id into v_current_primary_role
    from public.member_roles
    where member_id = p_member_id
      and status = 'ACTIVE'
      and is_primary = true
      and deleted_at is null
    limit 1;

    if v_role_id is distinct from v_current_primary_role then
      update public.member_roles
      set is_primary = false, updated_at = now()
      where member_id = p_member_id
        and status = 'ACTIVE'
        and is_primary = true
        and deleted_at is null;

      if v_role_id is not null then
        if not exists (
          select 1 from public.roles role
          where role.id = v_role_id
            and role.church_id = v_member.church_id
            and role.status = 'ACTIVE'
            and role.deleted_at is null
        ) then
          raise exception 'MEMBER_ROLE_INVALID';
        end if;

        insert into public.member_roles (
          church_id,
          member_id,
          role_id,
          congregation_id,
          is_primary,
          status,
          start_date,
          created_by
        ) values (
          v_member.church_id,
          p_member_id,
          v_role_id,
          v_member.congregation_id,
          true,
          'ACTIVE',
          nullif(p_payload->>'role_start_date', '')::date,
          v_actor
        )
        on conflict (member_id, role_id)
          where deleted_at is null and status = 'ACTIVE'
        do update set
          is_primary = true,
          congregation_id = v_member.congregation_id,
          start_date = coalesce(
            excluded.start_date,
            public.member_roles.start_date
          ),
          updated_at = now();
      end if;

      insert into public.member_history (
        church_id,
        member_id,
        congregation_id,
        history_type,
        title,
        description,
        old_value,
        new_value,
        event_date,
        is_sensitive,
        created_by,
        metadata
      ) values (
        v_member.church_id,
        p_member_id,
        v_member.congregation_id,
        'ROLE_CHANGED',
        'Cargo principal alterado',
        'O Cargo principal do membro foi atualizado.',
        v_current_primary_role::text,
        v_role_id::text,
        current_date,
        false,
        v_actor,
        jsonb_build_object(
          'old_role_id', v_current_primary_role,
          'new_role_id', v_role_id
        )
      );
    end if;
  end if;

  if v_member.member_type is distinct from upper(p_payload->>'member_type') then
    insert into public.member_history (
      church_id, member_id, congregation_id, history_type, title,
      description, old_value, new_value, event_date, is_sensitive,
      created_by, metadata
    ) values (
      v_member.church_id, p_member_id, v_member.congregation_id,
      'STATUS_CHANGE', 'Tipo de cadastro alterado',
      'O tipo de vínculo cadastral foi atualizado.',
      v_member.member_type, upper(p_payload->>'member_type'), current_date,
      false, v_actor, '{}'::jsonb
    );
  end if;

  if v_member.received_date is distinct from nullif(p_payload->>'received_date', '')::date
    or v_member.received_by is distinct from nullif(upper(btrim(p_payload->>'received_by')), '') then
    insert into public.member_history (
      church_id, member_id, congregation_id, history_type, title,
      description, old_value, new_value, event_date, is_sensitive,
      created_by, metadata
    ) values (
      v_member.church_id, p_member_id, v_member.congregation_id,
      'MEMBER_RECEIVED', 'Recebimento atualizado',
      'A informação de recebimento oficial foi atualizada.',
      v_member.received_by, nullif(upper(btrim(p_payload->>'received_by')), ''),
      coalesce(nullif(p_payload->>'received_date', '')::date, current_date),
      false, v_actor,
      jsonb_build_object(
        'old_date', v_member.received_date,
        'new_date', nullif(p_payload->>'received_date', '')::date
      )
    );
  end if;

  if v_member.baptism_date is distinct from nullif(p_payload->>'baptism_date', '')::date
    or v_member.has_holy_spirit_baptism is distinct from coalesce((p_payload->>'has_holy_spirit_baptism')::boolean, false)
    or v_member.holy_spirit_baptism_date is distinct from nullif(p_payload->>'holy_spirit_baptism_date', '')::date then
    insert into public.member_history (
      church_id, member_id, congregation_id, history_type, title,
      description, event_date, is_sensitive, created_by, metadata
    ) values (
      v_member.church_id, p_member_id, v_member.congregation_id,
      'BAPTISM_UPDATED', 'Informações de batismo atualizadas',
      'Os dados de batismo do membro foram atualizados.',
      current_date, false, v_actor, '{}'::jsonb
    );
  end if;

  return v_updated_at;
end;
$$;

-- ---------------------------------------------------------------------------
-- Ciclo de vida e movimentações atômicas
-- ---------------------------------------------------------------------------

create or replace function public.change_member_lifecycle(
  p_member_id uuid,
  p_action text,
  p_event_date date default current_date,
  p_reason text default null,
  p_target_congregation_id uuid default null,
  p_destination_church text default null,
  p_end_roles boolean default true,
  p_sensitive boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_member public.members%rowtype;
  v_action text := upper(btrim(p_action));
  v_old_congregation_name text;
  v_new_congregation_name text;
begin
  if v_actor is null then raise exception 'AUTH_REQUIRED'; end if;
  if p_event_date is null or p_event_date > current_date then
    raise exception 'MEMBER_EVENT_DATE_INVALID';
  end if;

  select * into v_member
  from public.members member
  where member.id = p_member_id
  for update;

  if v_member.id is null then raise exception 'MEMBER_NOT_FOUND'; end if;

  if not public.can_access_member(
    v_member.church_id,
    v_member.id,
    v_member.congregation_id
  ) then
    raise exception 'MEMBER_PERMISSION_DENIED';
  end if;

  if v_action = 'ARCHIVE' then
    if v_member.deleted_at is not null then raise exception 'MEMBER_ALREADY_ARCHIVED'; end if;
    if not public.has_permission(v_member.church_id, 'members.archive') then
      raise exception 'MEMBER_PERMISSION_DENIED';
    end if;
    update public.members set deleted_at = now() where id = p_member_id;
    return jsonb_build_object('status', v_member.member_status, 'archived', true);
  elsif v_action = 'RESTORE' then
    if v_member.deleted_at is null then raise exception 'MEMBER_NOT_ARCHIVED'; end if;
    if not public.has_permission(v_member.church_id, 'members.restore') then
      raise exception 'MEMBER_PERMISSION_DENIED';
    end if;
    update public.members set deleted_at = null where id = p_member_id;
    return jsonb_build_object('status', v_member.member_status, 'archived', false);
  end if;

  if v_member.deleted_at is not null then raise exception 'MEMBER_NOT_FOUND'; end if;

  if v_action = 'MOVE_CONGREGATION' then
    if not public.has_permission(v_member.church_id, 'members.transfer') then
      raise exception 'MEMBER_PERMISSION_DENIED';
    end if;
    if p_target_congregation_id is null
      or p_target_congregation_id = v_member.congregation_id
      or not exists (
        select 1 from public.congregations congregation
        where congregation.id = p_target_congregation_id
          and congregation.church_id = v_member.church_id
          and congregation.status = 'ACTIVE'
          and congregation.deleted_at is null
      )
      or not public.can_access_congregation(
        v_member.church_id,
        p_target_congregation_id
      ) then
      raise exception 'MEMBER_CONGREGATION_INVALID';
    end if;

    select name into v_old_congregation_name
    from public.congregations where id = v_member.congregation_id;
    select name into v_new_congregation_name
    from public.congregations where id = p_target_congregation_id;

    update public.members
    set congregation_id = p_target_congregation_id
    where id = p_member_id;

    update public.member_roles
    set congregation_id = p_target_congregation_id, updated_at = now()
    where member_id = p_member_id
      and status = 'ACTIVE'
      and deleted_at is null;

    insert into public.member_history (
      church_id, member_id, congregation_id, history_type, title,
      description, old_value, new_value, event_date, is_sensitive,
      created_by, metadata
    ) values (
      v_member.church_id, p_member_id, p_target_congregation_id,
      'CONGREGATION_CHANGE', 'Mudança de Congregação',
      nullif(btrim(p_reason), ''), v_old_congregation_name,
      v_new_congregation_name, p_event_date, false, v_actor,
      jsonb_build_object(
        'origin_congregation_id', v_member.congregation_id,
        'destination_congregation_id', p_target_congregation_id
      )
    );

  elsif v_action = 'INACTIVATE' then
    if not public.has_permission(v_member.church_id, 'members.change_status') then
      raise exception 'MEMBER_PERMISSION_DENIED';
    end if;
    if nullif(btrim(p_reason), '') is null then raise exception 'MEMBER_REASON_REQUIRED'; end if;
    update public.members
    set member_status = 'INACTIVE', inactive_reason = btrim(p_reason)
    where id = p_member_id;
    insert into public.member_history (
      church_id, member_id, congregation_id, history_type, title,
      description, old_value, new_value, event_date, is_sensitive,
      created_by, metadata
    ) values (
      v_member.church_id, p_member_id, v_member.congregation_id,
      'MEMBER_INACTIVATED', 'Membro inativado', btrim(p_reason),
      v_member.member_status, 'INACTIVE', p_event_date, p_sensitive,
      v_actor, '{}'::jsonb
    );

  elsif v_action = 'REACTIVATE' then
    if not public.has_permission(v_member.church_id, 'members.change_status') then
      raise exception 'MEMBER_PERMISSION_DENIED';
    end if;
    update public.members
    set member_status = 'ACTIVE', inactive_reason = null
    where id = p_member_id;
    insert into public.member_history (
      church_id, member_id, congregation_id, history_type, title,
      description, old_value, new_value, event_date, is_sensitive,
      created_by, metadata
    ) values (
      v_member.church_id, p_member_id, v_member.congregation_id,
      'MEMBER_REACTIVATED', 'Membro reativado', nullif(btrim(p_reason), ''),
      v_member.member_status, 'ACTIVE', p_event_date, false,
      v_actor, '{}'::jsonb
    );

  elsif v_action = 'TRANSFER' then
    if not public.has_permission(v_member.church_id, 'members.transfer') then
      raise exception 'MEMBER_PERMISSION_DENIED';
    end if;
    if nullif(btrim(p_destination_church), '') is null then
      raise exception 'MEMBER_DESTINATION_REQUIRED';
    end if;
    update public.members
    set member_status = 'TRANSFERRED',
        letter_destination_church = btrim(p_destination_church),
        transfer_date = p_event_date
    where id = p_member_id;
    if p_end_roles then
      update public.member_roles
      set status = 'ENDED', end_date = p_event_date,
          is_primary = false, updated_at = now()
      where member_id = p_member_id
        and status = 'ACTIVE'
        and deleted_at is null;
    end if;
    insert into public.member_history (
      church_id, member_id, congregation_id, history_type, title,
      description, old_value, new_value, event_date, is_sensitive,
      created_by, metadata
    ) values (
      v_member.church_id, p_member_id, v_member.congregation_id,
      'MEMBER_TRANSFERRED', 'Membro transferido para outra igreja',
      nullif(btrim(p_reason), ''), v_member.member_status,
      btrim(p_destination_church), p_event_date, false, v_actor,
      jsonb_build_object('roles_ended', p_end_roles)
    );

  elsif v_action = 'DISCIPLINE' then
    if not public.has_permission(v_member.church_id, 'members.change_status')
      or not public.has_permission(v_member.church_id, 'member_history.view_sensitive') then
      raise exception 'MEMBER_PERMISSION_DENIED';
    end if;
    if nullif(btrim(p_reason), '') is null then raise exception 'MEMBER_REASON_REQUIRED'; end if;
    update public.members set member_status = 'DISCIPLINED' where id = p_member_id;
    if p_end_roles then
      update public.member_roles
      set status = 'SUSPENDED', is_primary = false, updated_at = now()
      where member_id = p_member_id
        and status = 'ACTIVE'
        and deleted_at is null;
    end if;
    insert into public.member_history (
      church_id, member_id, congregation_id, history_type, title,
      description, old_value, new_value, event_date, is_sensitive,
      created_by, metadata
    ) values (
      v_member.church_id, p_member_id, v_member.congregation_id,
      'MEMBER_DISCIPLINED', 'Situação disciplinar registrada',
      btrim(p_reason), v_member.member_status, 'DISCIPLINED',
      p_event_date, true, v_actor,
      jsonb_build_object('roles_suspended', p_end_roles)
    );

  elsif v_action = 'DECEASED' then
    if not public.has_permission(v_member.church_id, 'members.change_status') then
      raise exception 'MEMBER_PERMISSION_DENIED';
    end if;
    update public.members set member_status = 'DECEASED' where id = p_member_id;
    update public.member_roles
    set status = 'ENDED', end_date = p_event_date,
        is_primary = false, updated_at = now()
    where member_id = p_member_id
      and status = 'ACTIVE'
      and deleted_at is null;
    insert into public.member_history (
      church_id, member_id, congregation_id, history_type, title,
      description, old_value, new_value, event_date, is_sensitive,
      created_by, metadata
    ) values (
      v_member.church_id, p_member_id, v_member.congregation_id,
      'MEMBER_DECEASED', 'Falecimento registrado',
      nullif(btrim(p_reason), ''), v_member.member_status, 'DECEASED',
      p_event_date, false, v_actor, '{}'::jsonb
    );
  else
    raise exception 'MEMBER_ACTION_INVALID';
  end if;

  return jsonb_build_object(
    'status', (
      select member.member_status from public.members member
      where member.id = p_member_id
    ),
    'congregation_id', (
      select member.congregation_id from public.members member
      where member.id = p_member_id
    ),
    'archived', false
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- Gerenciamento transacional dos Cargos do membro
-- ---------------------------------------------------------------------------

create or replace function public.manage_member_role(
  p_member_id uuid,
  p_operation text,
  p_role_id uuid default null,
  p_link_id uuid default null,
  p_start_date date default null,
  p_end_date date default null,
  p_notes text default null,
  p_is_primary boolean default false
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_member public.members%rowtype;
  v_link public.member_roles%rowtype;
  v_result uuid;
  v_operation text := upper(btrim(p_operation));
begin
  if v_actor is null then raise exception 'AUTH_REQUIRED'; end if;

  select * into v_member
  from public.members member
  where member.id = p_member_id and member.deleted_at is null
  for update;

  if v_member.id is null then raise exception 'MEMBER_NOT_FOUND'; end if;
  if not public.has_permission(v_member.church_id, 'member_roles.manage')
    or not public.can_access_member(
      v_member.church_id,
      v_member.id,
      v_member.congregation_id
    ) then
    raise exception 'MEMBER_ROLE_PERMISSION_DENIED';
  end if;

  if v_operation = 'ADD' then
    if p_role_id is null or not exists (
      select 1 from public.roles role
      where role.id = p_role_id
        and role.church_id = v_member.church_id
        and role.status = 'ACTIVE'
        and role.deleted_at is null
    ) then
      raise exception 'MEMBER_ROLE_INVALID';
    end if;

    if p_is_primary then
      update public.member_roles
      set is_primary = false, updated_at = now()
      where member_id = p_member_id
        and status = 'ACTIVE'
        and is_primary = true
        and deleted_at is null;
    end if;

    insert into public.member_roles (
      church_id, member_id, role_id, congregation_id, is_primary,
      status, start_date, notes, created_by
    ) values (
      v_member.church_id, p_member_id, p_role_id,
      v_member.congregation_id, p_is_primary, 'ACTIVE', p_start_date,
      nullif(btrim(p_notes), ''), v_actor
    ) returning id into v_result;

    insert into public.member_history (
      church_id, member_id, congregation_id, history_type, title,
      description, event_date, is_sensitive, created_by, metadata
    ) values (
      v_member.church_id, p_member_id, v_member.congregation_id,
      'ROLE_ASSIGNED', 'Cargo atribuído ao membro',
      nullif(btrim(p_notes), ''), coalesce(p_start_date, current_date),
      false, v_actor,
      jsonb_build_object('role_id', p_role_id, 'is_primary', p_is_primary)
    );

  else
    select * into v_link
    from public.member_roles link
    where link.id = p_link_id
      and link.member_id = p_member_id
      and link.church_id = v_member.church_id
      and link.deleted_at is null
    for update;

    if v_link.id is null then raise exception 'MEMBER_ROLE_LINK_NOT_FOUND'; end if;

    if v_operation = 'END' then
      if coalesce(p_end_date, current_date) < coalesce(v_link.start_date, '-infinity'::date) then
        raise exception 'MEMBER_ROLE_DATE_INVALID';
      end if;
      update public.member_roles
      set status = 'ENDED', end_date = coalesce(p_end_date, current_date),
          notes = coalesce(nullif(btrim(p_notes), ''), notes),
          is_primary = false, updated_at = now()
      where id = v_link.id;
      v_result := v_link.id;
      insert into public.member_history (
        church_id, member_id, congregation_id, history_type, title,
        description, event_date, is_sensitive, created_by, metadata
      ) values (
        v_member.church_id, p_member_id, v_member.congregation_id,
        'ROLE_ENDED', 'Cargo encerrado', nullif(btrim(p_notes), ''),
        coalesce(p_end_date, current_date), false, v_actor,
        jsonb_build_object('role_id', v_link.role_id, 'link_id', v_link.id)
      );
    elsif v_operation = 'SET_PRIMARY' then
      if v_link.status <> 'ACTIVE' then raise exception 'MEMBER_ROLE_NOT_ACTIVE'; end if;
      update public.member_roles
      set is_primary = false, updated_at = now()
      where member_id = p_member_id
        and status = 'ACTIVE'
        and is_primary = true
        and deleted_at is null;
      update public.member_roles set is_primary = true, updated_at = now()
      where id = v_link.id;
      v_result := v_link.id;
      insert into public.member_history (
        church_id, member_id, congregation_id, history_type, title,
        description, event_date, is_sensitive, created_by, metadata
      ) values (
        v_member.church_id, p_member_id, v_member.congregation_id,
        'ROLE_CHANGED', 'Cargo principal alterado',
        'O Cargo foi definido como principal.', current_date,
        false, v_actor,
        jsonb_build_object('role_id', v_link.role_id, 'link_id', v_link.id)
      );
    elsif v_operation = 'UPDATE' then
      if p_end_date is not null
        and p_start_date is not null
        and p_end_date < p_start_date then
        raise exception 'MEMBER_ROLE_DATE_INVALID';
      end if;
      if p_is_primary and v_link.status = 'ACTIVE' then
        update public.member_roles
        set is_primary = false, updated_at = now()
        where member_id = p_member_id
          and status = 'ACTIVE'
          and is_primary = true
          and id <> v_link.id
          and deleted_at is null;
      end if;
      update public.member_roles
      set start_date = p_start_date,
          end_date = p_end_date,
          notes = nullif(btrim(p_notes), ''),
          is_primary = case when status = 'ACTIVE' then p_is_primary else false end,
          updated_at = now()
      where id = v_link.id;
      v_result := v_link.id;
    else
      raise exception 'MEMBER_ROLE_OPERATION_INVALID';
    end if;
  end if;

  return v_result;
end;
$$;

-- Normalização e validação de tenant com search_path fixo.
create or replace function public.validate_member_tenant()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.full_name := btrim(new.full_name);
  new.preferred_name := nullif(btrim(new.preferred_name), '');
  new.email := nullif(lower(btrim(new.email)), '');
  new.state := nullif(upper(btrim(new.state)), '');
  new.country := coalesce(nullif(btrim(new.country), ''), 'Brasil');

  if new.full_name = '' then raise exception 'MEMBER_NAME_REQUIRED'; end if;
  if new.birth_date > current_date
    or new.conversion_date > current_date
    or new.baptism_date > current_date
    or new.holy_spirit_baptism_date > current_date
    or new.received_date > current_date then
    raise exception 'MEMBER_DATE_IN_FUTURE';
  end if;

  if not exists (
    select 1 from public.congregations congregation
    where congregation.id = new.congregation_id
      and congregation.church_id = new.church_id
      and congregation.deleted_at is null
  ) then
    raise exception 'MEMBER_CONGREGATION_INVALID';
  end if;

  if tg_op = 'UPDATE' and new.church_id <> old.church_id then
    raise exception 'MEMBER_CHURCH_IMMUTABLE';
  end if;
  return new;
end;
$$;

alter function public.has_permission(uuid, text) set search_path = '';
alter function public.can_access_church(uuid) set search_path = '';
alter function public.can_access_congregation(uuid, uuid) set search_path = '';
alter function public.can_access_member(uuid, uuid, uuid) set search_path = '';
alter function public.audit_member_mutation() set search_path = '';
alter function public.audit_sensitive_member_mutation() set search_path = '';

-- Data API: grants explícitos para o comportamento atual e futuro do Supabase.
grant select, insert, update on public.members to authenticated;
grant select, insert, update on public.member_sensitive_identity to authenticated;
grant select, insert, update on public.member_pastoral_notes to authenticated;
grant select, insert, update on public.member_history to authenticated;
grant select, insert, update on public.member_documents to authenticated;
grant select, insert, update on public.member_roles to authenticated;
grant select on public.roles to authenticated;
grant select on public.financial_transactions to authenticated;

revoke all on public.members from anon;
revoke all on public.member_sensitive_identity from anon;
revoke all on public.member_pastoral_notes from anon;
revoke all on public.member_history from anon;
revoke all on public.member_documents from anon;
revoke all on public.member_roles from anon;

revoke all on function public.get_member_stats(uuid) from public, anon;
revoke all on function public.create_member_atomic(uuid, jsonb) from public, anon;
revoke all on function public.update_member_atomic(uuid, timestamptz, jsonb) from public, anon;
revoke all on function public.change_member_lifecycle(uuid, text, date, text, uuid, text, boolean, boolean) from public, anon;
revoke all on function public.manage_member_role(uuid, text, uuid, uuid, date, date, text, boolean) from public, anon;

grant execute on function public.get_member_stats(uuid) to authenticated;
grant execute on function public.create_member_atomic(uuid, jsonb) to authenticated;
grant execute on function public.update_member_atomic(uuid, timestamptz, jsonb) to authenticated;
grant execute on function public.change_member_lifecycle(uuid, text, date, text, uuid, text, boolean, boolean) to authenticated;
grant execute on function public.manage_member_role(uuid, text, uuid, uuid, date, date, text, boolean) to authenticated;

commit;
