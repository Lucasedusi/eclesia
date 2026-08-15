begin;

-- ---------------------------------------------------------------------------
-- Permissões exclusivas do Administrador da Igreja
-- ---------------------------------------------------------------------------

insert into public.permissions (
  key, name, description, module, action, is_sensitive, status
)
select proposed.*
from (values
  (
    'documents.view',
    'Visualizar documentos administrativos',
    'Consultar, pesquisar, pré-visualizar e baixar documentos administrativos',
    'documents',
    'view',
    true,
    'ACTIVE'
  ),
  (
    'documents.manage',
    'Gerenciar documentos administrativos',
    'Gerenciar categorias, dossiês, tags e documentos administrativos',
    'documents',
    'manage',
    true,
    'ACTIVE'
  )
) as proposed(key, name, description, module, action, is_sensitive, status)
where not exists (
  select 1 from public.permissions permission where permission.key = proposed.key
);

update public.permissions
set
  is_sensitive = true,
  status = 'ACTIVE',
  deleted_at = null,
  updated_at = now()
where key in ('documents.view', 'documents.manage');

insert into public.role_permissions (role, permission_id, status)
select 'ADMIN', permission.id, 'ACTIVE'
from public.permissions permission
where permission.key in ('documents.view', 'documents.manage')
  and permission.deleted_at is null
  and not exists (
    select 1
    from public.role_permissions role_permission
    where role_permission.role = 'ADMIN'
      and role_permission.permission_id = permission.id
      and role_permission.deleted_at is null
  );

update public.role_permissions role_permission
set status = 'ACTIVE', deleted_at = null, updated_at = now()
from public.permissions permission
where role_permission.permission_id = permission.id
  and role_permission.role = 'ADMIN'
  and permission.key in ('documents.view', 'documents.manage');

update public.role_permissions role_permission
set status = 'INACTIVE', deleted_at = coalesce(role_permission.deleted_at, now()), updated_at = now()
from public.permissions permission
where role_permission.permission_id = permission.id
  and role_permission.role <> 'ADMIN'
  and role_permission.deleted_at is null
  and permission.key in ('documents.view', 'documents.manage');

update public.user_permission_overrides permission_override
set deleted_at = coalesce(permission_override.deleted_at, now()), updated_at = now()
from public.permissions permission,
     public.user_church_access access
where permission_override.permission_id = permission.id
  and permission_override.access_id = access.id
  and permission_override.deleted_at is null
  and permission_override.effect = 'ALLOW'
  and permission.key in ('documents.view', 'documents.manage')
  and (access.role <> 'ADMIN' or access.access_scope <> 'CHURCH');

create or replace function private.guard_administrative_document_permission()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_permission_key text;
  v_role text;
  v_scope text;
begin
  select permission.key
  into v_permission_key
  from public.permissions permission
  where permission.id = new.permission_id;

  if v_permission_key not in ('documents.view', 'documents.manage') then
    return new;
  end if;

  if tg_table_name = 'role_permissions' then
    if new.deleted_at is null
      and new.status = 'ACTIVE'
      and new.role::text <> 'ADMIN' then
      raise exception 'Permissões de Documentos são exclusivas do papel ADMIN';
    end if;
    return new;
  end if;

  select access.role::text, access.access_scope::text
  into v_role, v_scope
  from public.user_church_access access
  where access.id = new.access_id
    and access.deleted_at is null;

  if new.deleted_at is null
    and new.effect = 'ALLOW'
    and (v_role is distinct from 'ADMIN' or v_scope is distinct from 'CHURCH') then
    raise exception 'Permissões de Documentos são exclusivas do Administrador da Igreja';
  end if;

  return new;
end;
$$;

drop trigger if exists guard_document_role_permission on public.role_permissions;
create trigger guard_document_role_permission
before insert or update on public.role_permissions
for each row execute function private.guard_administrative_document_permission();

drop trigger if exists guard_document_user_permission_override on public.user_permission_overrides;
create trigger guard_document_user_permission_override
before insert or update on public.user_permission_overrides
for each row execute function private.guard_administrative_document_permission();

revoke all on function private.guard_administrative_document_permission()
from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Estrutura multi-tenant: Categoria -> Pasta/Dossiê -> Documento
-- ---------------------------------------------------------------------------

create unique index if not exists churches_church_id_id_unique_idx
  on public.churches (id, id);

create table if not exists public.document_categories (
  id uuid primary key default gen_random_uuid(),
  church_id uuid not null references public.churches(id) on delete restrict,
  name text not null,
  description text,
  color text,
  icon text,
  status text not null default 'ACTIVE',
  created_by uuid not null references public.profiles(id) on delete restrict,
  updated_by uuid not null references public.profiles(id) on delete restrict,
  archived_at timestamptz,
  archived_by uuid references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  deleted_by uuid references public.profiles(id) on delete restrict,
  constraint document_categories_name_not_blank_check check (btrim(name) <> ''),
  constraint document_categories_status_check check (status in ('ACTIVE', 'ARCHIVED')),
  constraint document_categories_color_check check (
    color is null or color ~ '^#[0-9A-Fa-f]{6}$'
  ),
  constraint document_categories_archive_pair_check check (
    (status = 'ACTIVE' and archived_at is null and archived_by is null)
    or (status = 'ARCHIVED' and archived_at is not null and archived_by is not null)
  ),
  constraint document_categories_delete_pair_check check (
    (deleted_at is null and deleted_by is null)
    or (deleted_at is not null and deleted_by is not null)
  )
);

create unique index if not exists document_categories_church_id_id_unique_idx
  on public.document_categories (church_id, id);
create unique index if not exists document_categories_active_name_unique_idx
  on public.document_categories (church_id, lower(btrim(name)))
  where deleted_at is null and status = 'ACTIVE';
create index if not exists document_categories_listing_idx
  on public.document_categories (church_id, status, name, id);

create table if not exists public.document_folders (
  id uuid primary key default gen_random_uuid(),
  church_id uuid not null references public.churches(id) on delete restrict,
  category_id uuid not null,
  name text not null,
  description text,
  physical_location text,
  status text not null default 'ACTIVE',
  created_by uuid not null references public.profiles(id) on delete restrict,
  updated_by uuid not null references public.profiles(id) on delete restrict,
  archived_at timestamptz,
  archived_by uuid references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  deleted_by uuid references public.profiles(id) on delete restrict,
  constraint document_folders_category_same_church_fk
    foreign key (church_id, category_id)
    references public.document_categories(church_id, id)
    on delete restrict,
  constraint document_folders_name_not_blank_check check (btrim(name) <> ''),
  constraint document_folders_status_check check (status in ('ACTIVE', 'ARCHIVED')),
  constraint document_folders_archive_pair_check check (
    (status = 'ACTIVE' and archived_at is null and archived_by is null)
    or (status = 'ARCHIVED' and archived_at is not null and archived_by is not null)
  ),
  constraint document_folders_delete_pair_check check (
    (deleted_at is null and deleted_by is null)
    or (deleted_at is not null and deleted_by is not null)
  )
);

create unique index if not exists document_folders_church_id_id_unique_idx
  on public.document_folders (church_id, id);
create unique index if not exists document_folders_category_active_name_unique_idx
  on public.document_folders (church_id, category_id, lower(btrim(name)))
  where deleted_at is null and status = 'ACTIVE';
create index if not exists document_folders_listing_idx
  on public.document_folders (church_id, category_id, status, name, id);

create table if not exists public.document_tags (
  id uuid primary key default gen_random_uuid(),
  church_id uuid not null references public.churches(id) on delete restrict,
  name text not null,
  created_by uuid not null references public.profiles(id) on delete restrict,
  updated_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  deleted_by uuid references public.profiles(id) on delete restrict,
  constraint document_tags_name_not_blank_check check (btrim(name) <> ''),
  constraint document_tags_delete_pair_check check (
    (deleted_at is null and deleted_by is null)
    or (deleted_at is not null and deleted_by is not null)
  )
);

create unique index if not exists document_tags_church_id_id_unique_idx
  on public.document_tags (church_id, id);
create unique index if not exists document_tags_active_name_unique_idx
  on public.document_tags (church_id, lower(btrim(name)))
  where deleted_at is null;
create index if not exists document_tags_listing_idx
  on public.document_tags (church_id, name, id)
  where deleted_at is null;

create table if not exists public.administrative_documents (
  id uuid primary key default gen_random_uuid(),
  church_id uuid not null references public.churches(id) on delete restrict,
  folder_id uuid not null,
  title text not null,
  description text,
  document_date date,
  reference_number text,
  physical_location text,
  notes text,
  original_file_name text not null,
  storage_bucket text not null default 'administrative-documents',
  storage_path text not null,
  mime_type text not null,
  file_extension text not null,
  file_size bigint not null,
  upload_status text not null default 'PENDING',
  status text not null default 'ACTIVE',
  uploaded_by uuid not null references public.profiles(id) on delete restrict,
  updated_by uuid not null references public.profiles(id) on delete restrict,
  uploaded_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz,
  archived_by uuid references public.profiles(id) on delete restrict,
  deleted_at timestamptz,
  deleted_by uuid references public.profiles(id) on delete restrict,
  pending_storage_path text,
  pending_original_file_name text,
  pending_mime_type text,
  pending_file_extension text,
  pending_file_size bigint,
  pending_started_at timestamptz,
  pending_by uuid references public.profiles(id) on delete restrict,
  constraint administrative_documents_folder_same_church_fk
    foreign key (church_id, folder_id)
    references public.document_folders(church_id, id)
    on delete restrict,
  constraint administrative_documents_title_not_blank_check check (btrim(title) <> ''),
  constraint administrative_documents_original_name_not_blank_check
    check (btrim(original_file_name) <> ''),
  constraint administrative_documents_bucket_check
    check (storage_bucket = 'administrative-documents'),
  constraint administrative_documents_mime_type_check check (mime_type in (
    'application/pdf',
    'image/jpeg',
    'image/png',
    'image/webp',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  )),
  constraint administrative_documents_extension_check
    check (file_extension in ('pdf', 'jpg', 'jpeg', 'png', 'webp', 'doc', 'docx', 'xls', 'xlsx')),
  constraint administrative_documents_file_size_check
    check (file_size > 0 and file_size <= 10485760),
  constraint administrative_documents_upload_status_check
    check (upload_status in ('PENDING', 'ACTIVE')),
  constraint administrative_documents_status_check check (status in ('ACTIVE', 'ARCHIVED')),
  constraint administrative_documents_archive_pair_check check (
    (status = 'ACTIVE' and archived_at is null and archived_by is null)
    or (status = 'ARCHIVED' and archived_at is not null and archived_by is not null)
  ),
  constraint administrative_documents_delete_pair_check check (
    (deleted_at is null and deleted_by is null)
    or (deleted_at is not null and deleted_by is not null)
  ),
  constraint administrative_documents_pending_pair_check check (
    (
      pending_storage_path is null
      and pending_original_file_name is null
      and pending_mime_type is null
      and pending_file_extension is null
      and pending_file_size is null
      and pending_started_at is null
      and pending_by is null
    )
    or (
      upload_status = 'ACTIVE'
      and pending_storage_path is not null
      and pending_original_file_name is not null
      and pending_mime_type is not null
      and pending_file_extension is not null
      and pending_file_size between 1 and 10485760
      and pending_started_at is not null
      and pending_by is not null
    )
  ),
  constraint administrative_documents_storage_path_unique unique (storage_path),
  constraint administrative_documents_pending_storage_path_unique unique (pending_storage_path)
);

create index if not exists administrative_documents_listing_idx
  on public.administrative_documents (church_id, status, uploaded_at desc, id)
  where deleted_at is null and upload_status = 'ACTIVE';
create index if not exists administrative_documents_folder_listing_idx
  on public.administrative_documents (church_id, folder_id, status, uploaded_at desc, id)
  where deleted_at is null and upload_status = 'ACTIVE';
create index if not exists administrative_documents_deleted_idx
  on public.administrative_documents (church_id, deleted_at desc, id)
  where deleted_at is not null;
create index if not exists administrative_documents_pending_idx
  on public.administrative_documents (church_id, uploaded_at, id)
  where deleted_at is null and upload_status = 'PENDING';
create index if not exists administrative_documents_pending_replacement_idx
  on public.administrative_documents (church_id, pending_started_at, id)
  where pending_storage_path is not null;
create index if not exists administrative_documents_uploader_idx
  on public.administrative_documents (church_id, uploaded_by, uploaded_at desc);
create index if not exists administrative_documents_reference_idx
  on public.administrative_documents (church_id, reference_number)
  where reference_number is not null;

create unique index if not exists administrative_documents_church_id_id_unique_idx
  on public.administrative_documents (church_id, id);

create table if not exists public.administrative_document_tags (
  church_id uuid not null references public.churches(id) on delete restrict,
  document_id uuid not null,
  tag_id uuid not null,
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  primary key (document_id, tag_id),
  constraint administrative_document_tags_document_same_church_fk
    foreign key (church_id, document_id)
    references public.administrative_documents(church_id, id)
    on delete cascade,
  constraint administrative_document_tags_tag_same_church_fk
    foreign key (church_id, tag_id)
    references public.document_tags(church_id, id)
    on delete restrict
);

create index if not exists administrative_document_tags_church_tag_idx
  on public.administrative_document_tags (church_id, tag_id, document_id);

-- ---------------------------------------------------------------------------
-- Normalização e proteção de identidade
-- ---------------------------------------------------------------------------

create or replace function private.protect_document_category_mutation()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.name := btrim(regexp_replace(new.name, '\s+', ' ', 'g'));
  new.description := nullif(btrim(coalesce(new.description, '')), '');
  new.icon := nullif(btrim(coalesce(new.icon, '')), '');
  new.color := nullif(upper(btrim(coalesce(new.color, ''))), '');

  if tg_op = 'INSERT' then
    new.created_by := (select auth.uid());
    new.updated_by := (select auth.uid());
  else
    if new.id is distinct from old.id
      or new.church_id is distinct from old.church_id
      or new.created_by is distinct from old.created_by
      or new.created_at is distinct from old.created_at then
      raise exception 'Não é permitido alterar a identidade da categoria';
    end if;
    new.updated_by := (select auth.uid());
  end if;

  if new.status = 'ARCHIVED' and old.status is distinct from 'ARCHIVED' then
    new.archived_at := now();
    new.archived_by := (select auth.uid());
  elsif new.status = 'ACTIVE' then
    new.archived_at := null;
    new.archived_by := null;
  end if;

  if new.deleted_at is distinct from old.deleted_at then
    new.deleted_by := case when new.deleted_at is null then null else (select auth.uid()) end;
  end if;
  return new;
end;
$$;

create or replace function private.protect_document_folder_mutation()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.name := btrim(regexp_replace(new.name, '\s+', ' ', 'g'));
  new.description := nullif(btrim(coalesce(new.description, '')), '');
  new.physical_location := nullif(btrim(coalesce(new.physical_location, '')), '');

  if not exists (
    select 1 from public.document_categories category
    where category.id = new.category_id
      and category.church_id = new.church_id
      and category.deleted_at is null
  ) then
    raise exception 'A categoria informada não está disponível';
  end if;

  if tg_op = 'INSERT' then
    new.created_by := (select auth.uid());
    new.updated_by := (select auth.uid());
  else
    if new.id is distinct from old.id
      or new.church_id is distinct from old.church_id
      or new.created_by is distinct from old.created_by
      or new.created_at is distinct from old.created_at then
      raise exception 'Não é permitido alterar a identidade da pasta';
    end if;
    new.updated_by := (select auth.uid());
  end if;

  if new.status = 'ARCHIVED' and old.status is distinct from 'ARCHIVED' then
    new.archived_at := now();
    new.archived_by := (select auth.uid());
  elsif new.status = 'ACTIVE' then
    new.archived_at := null;
    new.archived_by := null;
  end if;

  if new.deleted_at is distinct from old.deleted_at then
    new.deleted_by := case when new.deleted_at is null then null else (select auth.uid()) end;
  end if;
  return new;
end;
$$;

create or replace function private.protect_document_tag_mutation()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.name := btrim(regexp_replace(new.name, '\s+', ' ', 'g'));
  if tg_op = 'INSERT' then
    new.created_by := (select auth.uid());
    new.updated_by := (select auth.uid());
  else
    if new.id is distinct from old.id
      or new.church_id is distinct from old.church_id
      or new.created_by is distinct from old.created_by
      or new.created_at is distinct from old.created_at then
      raise exception 'Não é permitido alterar a identidade da tag';
    end if;
    new.updated_by := (select auth.uid());
  end if;
  if new.deleted_at is distinct from old.deleted_at then
    new.deleted_by := case when new.deleted_at is null then null else (select auth.uid()) end;
  end if;
  return new;
end;
$$;

create or replace function private.protect_administrative_document_mutation()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.title := btrim(regexp_replace(new.title, '\s+', ' ', 'g'));
  new.description := nullif(btrim(coalesce(new.description, '')), '');
  new.reference_number := nullif(btrim(coalesce(new.reference_number, '')), '');
  new.physical_location := nullif(btrim(coalesce(new.physical_location, '')), '');
  new.notes := nullif(btrim(coalesce(new.notes, '')), '');
  new.original_file_name := btrim(new.original_file_name);
  new.mime_type := lower(btrim(new.mime_type));
  new.file_extension := lower(btrim(new.file_extension));

  if not exists (
    select 1
    from public.document_folders folder
    join public.document_categories category
      on category.id = folder.category_id and category.church_id = folder.church_id
    where folder.id = new.folder_id
      and folder.church_id = new.church_id
      and folder.deleted_at is null
      and category.deleted_at is null
  ) then
    raise exception 'A pasta informada não está disponível';
  end if;

  if tg_op = 'INSERT' then
    new.uploaded_by := (select auth.uid());
    new.updated_by := (select auth.uid());
  else
    if new.id is distinct from old.id
      or new.church_id is distinct from old.church_id
      or new.folder_id is distinct from old.folder_id
      or new.storage_bucket is distinct from old.storage_bucket
      or new.uploaded_by is distinct from old.uploaded_by
      or new.uploaded_at is distinct from old.uploaded_at then
      raise exception 'Não é permitido alterar a identidade do documento';
    end if;

    if new.storage_path is distinct from old.storage_path and not (
      old.upload_status = 'ACTIVE'
      and old.pending_storage_path is not null
      and new.storage_path = old.pending_storage_path
      and new.pending_storage_path is null
    ) then
      raise exception 'A substituição do arquivo não foi preparada';
    end if;

    if old.upload_status = 'ACTIVE' and new.upload_status <> 'ACTIVE' then
      raise exception 'A situação do upload não pode retroceder';
    end if;
    if old.upload_status = 'PENDING' and new.upload_status = 'ACTIVE'
      and new.deleted_at is not null then
      raise exception 'Um upload excluído não pode ser ativado';
    end if;
    new.updated_by := (select auth.uid());
  end if;

  if new.status = 'ARCHIVED' and old.status is distinct from 'ARCHIVED' then
    new.archived_at := now();
    new.archived_by := (select auth.uid());
  elsif new.status = 'ACTIVE' then
    new.archived_at := null;
    new.archived_by := null;
  end if;

  if new.deleted_at is distinct from old.deleted_at then
    new.deleted_by := case when new.deleted_at is null then null else (select auth.uid()) end;
  end if;
  return new;
end;
$$;

drop trigger if exists protect_document_categories_mutation on public.document_categories;
create trigger protect_document_categories_mutation
before insert or update on public.document_categories
for each row execute function private.protect_document_category_mutation();

drop trigger if exists touch_document_categories_updated_at on public.document_categories;
create trigger touch_document_categories_updated_at
before update on public.document_categories
for each row execute function public.touch_updated_at();

drop trigger if exists protect_document_folders_mutation on public.document_folders;
create trigger protect_document_folders_mutation
before insert or update on public.document_folders
for each row execute function private.protect_document_folder_mutation();

drop trigger if exists touch_document_folders_updated_at on public.document_folders;
create trigger touch_document_folders_updated_at
before update on public.document_folders
for each row execute function public.touch_updated_at();

drop trigger if exists protect_document_tags_mutation on public.document_tags;
create trigger protect_document_tags_mutation
before insert or update on public.document_tags
for each row execute function private.protect_document_tag_mutation();

drop trigger if exists touch_document_tags_updated_at on public.document_tags;
create trigger touch_document_tags_updated_at
before update on public.document_tags
for each row execute function public.touch_updated_at();

drop trigger if exists protect_administrative_documents_mutation on public.administrative_documents;
create trigger protect_administrative_documents_mutation
before insert or update on public.administrative_documents
for each row execute function private.protect_administrative_document_mutation();

drop trigger if exists touch_administrative_documents_updated_at on public.administrative_documents;
create trigger touch_administrative_documents_updated_at
before update on public.administrative_documents
for each row execute function public.touch_updated_at();

-- Impede exclusão lógica de contêineres que ainda possuam conteúdo.
create or replace function private.guard_document_container_deletion()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.deleted_at is distinct from old.deleted_at and new.deleted_at is not null then
    if tg_table_name = 'document_categories' and exists (
      select 1 from public.document_folders folder
      where folder.category_id = old.id and folder.church_id = old.church_id
    ) then
      raise exception 'A categoria possui pastas vinculadas';
    end if;
    if tg_table_name = 'document_folders' and exists (
      select 1 from public.administrative_documents document
      where document.folder_id = old.id and document.church_id = old.church_id
    ) then
      raise exception 'A pasta possui documentos vinculados';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists guard_document_category_deletion on public.document_categories;
create trigger guard_document_category_deletion
before update of deleted_at on public.document_categories
for each row execute function private.guard_document_container_deletion();

drop trigger if exists guard_document_folder_deletion on public.document_folders;
create trigger guard_document_folder_deletion
before update of deleted_at on public.document_folders
for each row execute function private.guard_document_container_deletion();

revoke all on function private.protect_document_category_mutation() from public, anon, authenticated;
revoke all on function private.protect_document_folder_mutation() from public, anon, authenticated;
revoke all on function private.protect_document_tag_mutation() from public, anon, authenticated;
revoke all on function private.protect_administrative_document_mutation() from public, anon, authenticated;
revoke all on function private.guard_document_container_deletion() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Auditoria geral do EKLESIA
-- ---------------------------------------------------------------------------

create or replace function private.audit_document_category_mutation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_action text;
  v_description text;
begin
  if tg_op = 'INSERT' then
    v_action := 'DOCUMENT_CATEGORY_CREATED';
    v_description := 'Categoria de documentos criada.';
  elsif new.deleted_at is distinct from old.deleted_at then
    v_action := case when new.deleted_at is null then 'DOCUMENT_CATEGORY_RESTORED' else 'DOCUMENT_CATEGORY_DELETED' end;
    v_description := case when new.deleted_at is null then 'Categoria de documentos restaurada.' else 'Categoria de documentos enviada para a lixeira.' end;
  elsif new.status is distinct from old.status then
    v_action := case when new.status = 'ARCHIVED' then 'DOCUMENT_CATEGORY_ARCHIVED' else 'DOCUMENT_CATEGORY_RESTORED' end;
    v_description := case when new.status = 'ARCHIVED' then 'Categoria de documentos arquivada.' else 'Categoria de documentos restaurada.' end;
  else
    v_action := 'DOCUMENT_CATEGORY_UPDATED';
    v_description := 'Categoria de documentos alterada.';
  end if;
  perform public.log_audit(
    new.church_id, 'documents', v_action, 'document_category', new.id, new.name,
    v_description,
    case when tg_op = 'UPDATE' then jsonb_build_object('name', old.name, 'status', old.status, 'deleted_at', old.deleted_at) else null end,
    jsonb_build_object('name', new.name, 'status', new.status, 'deleted_at', new.deleted_at),
    null,
    case when new.deleted_at is not null then 'WARNING' else 'INFO' end
  );
  return new;
end;
$$;

create or replace function private.audit_document_folder_mutation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_action text;
  v_description text;
begin
  if tg_op = 'INSERT' then
    v_action := 'DOCUMENT_FOLDER_CREATED';
    v_description := 'Pasta ou dossiê criado.';
  elsif new.deleted_at is distinct from old.deleted_at then
    v_action := case when new.deleted_at is null then 'DOCUMENT_FOLDER_RESTORED' else 'DOCUMENT_FOLDER_DELETED' end;
    v_description := case when new.deleted_at is null then 'Pasta ou dossiê restaurado.' else 'Pasta ou dossiê enviado para a lixeira.' end;
  elsif new.category_id is distinct from old.category_id then
    v_action := 'DOCUMENT_FOLDER_MOVED';
    v_description := 'Pasta ou dossiê movido para outra categoria.';
  elsif new.status is distinct from old.status then
    v_action := case when new.status = 'ARCHIVED' then 'DOCUMENT_FOLDER_ARCHIVED' else 'DOCUMENT_FOLDER_RESTORED' end;
    v_description := case when new.status = 'ARCHIVED' then 'Pasta ou dossiê arquivado.' else 'Pasta ou dossiê restaurado.' end;
  else
    v_action := 'DOCUMENT_FOLDER_UPDATED';
    v_description := 'Pasta ou dossiê alterado.';
  end if;
  perform public.log_audit(
    new.church_id, 'documents', v_action, 'document_folder', new.id, new.name,
    v_description,
    case when tg_op = 'UPDATE' then jsonb_build_object('category_id', old.category_id, 'name', old.name, 'status', old.status, 'deleted_at', old.deleted_at) else null end,
    jsonb_build_object('category_id', new.category_id, 'name', new.name, 'status', new.status, 'deleted_at', new.deleted_at),
    null,
    case when new.deleted_at is not null then 'WARNING' else 'INFO' end
  );
  return new;
end;
$$;

create or replace function private.audit_administrative_document_mutation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_action text;
  v_description text;
begin
  if tg_op = 'INSERT' then
    return new;
  elsif old.upload_status = 'PENDING' and new.upload_status = 'ACTIVE' then
    v_action := 'ADMINISTRATIVE_DOCUMENT_UPLOADED';
    v_description := 'Documento administrativo enviado.';
  elsif old.upload_status = 'PENDING' and new.deleted_at is not null then
    return new;
  elsif new.storage_path is distinct from old.storage_path then
    v_action := 'ADMINISTRATIVE_DOCUMENT_FILE_REPLACED';
    v_description := 'Arquivo do documento administrativo substituído.';
  elsif new.deleted_at is distinct from old.deleted_at then
    v_action := case when new.deleted_at is null then 'ADMINISTRATIVE_DOCUMENT_RESTORED' else 'ADMINISTRATIVE_DOCUMENT_TRASHED' end;
    v_description := case when new.deleted_at is null then 'Documento administrativo restaurado da lixeira.' else 'Documento administrativo enviado para a lixeira.' end;
  elsif new.status is distinct from old.status then
    v_action := case when new.status = 'ARCHIVED' then 'ADMINISTRATIVE_DOCUMENT_ARCHIVED' else 'ADMINISTRATIVE_DOCUMENT_RESTORED' end;
    v_description := case when new.status = 'ARCHIVED' then 'Documento administrativo arquivado.' else 'Documento administrativo restaurado.' end;
  elsif new.pending_storage_path is distinct from old.pending_storage_path then
    return new;
  else
    v_action := 'ADMINISTRATIVE_DOCUMENT_UPDATED';
    v_description := 'Metadados do documento administrativo alterados.';
  end if;
  perform public.log_audit(
    new.church_id, 'documents', v_action, 'administrative_document', new.id, new.title,
    v_description,
    jsonb_build_object(
      'title', old.title, 'reference_number', old.reference_number,
      'status', old.status, 'deleted_at', old.deleted_at,
      'original_file_name', old.original_file_name
    ),
    jsonb_build_object(
      'folder_id', new.folder_id, 'title', new.title,
      'reference_number', new.reference_number, 'status', new.status,
      'deleted_at', new.deleted_at, 'original_file_name', new.original_file_name,
      'mime_type', new.mime_type, 'file_size', new.file_size
    ),
    null,
    case when new.deleted_at is not null then 'WARNING' else 'INFO' end
  );
  return new;
end;
$$;

create or replace function private.audit_document_tag_mutation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_action text;
  v_description text;
begin
  if tg_op = 'INSERT' then
    v_action := 'DOCUMENT_TAG_CREATED';
    v_description := 'Tag de documentos criada.';
  elsif new.deleted_at is distinct from old.deleted_at then
    v_action := case when new.deleted_at is null then 'DOCUMENT_TAG_RESTORED' else 'DOCUMENT_TAG_DELETED' end;
    v_description := case when new.deleted_at is null then 'Tag de documentos restaurada.' else 'Tag de documentos excluída.' end;
  else
    v_action := 'DOCUMENT_TAG_UPDATED';
    v_description := 'Tag de documentos alterada.';
  end if;
  perform public.log_audit(
    new.church_id,
    'documents',
    v_action,
    'document_tag',
    new.id,
    new.name,
    v_description,
    case when tg_op = 'UPDATE' then jsonb_build_object('name', old.name, 'deleted_at', old.deleted_at) else null end,
    jsonb_build_object('name', new.name, 'deleted_at', new.deleted_at),
    null,
    'INFO'
  );
  return new;
end;
$$;

create or replace function private.audit_document_tag_assignment()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_document_id uuid;
  v_church_id uuid;
  v_tag_id uuid;
  v_document_title text;
  v_tag_name text;
begin
  v_document_id := case when tg_op = 'DELETE' then old.document_id else new.document_id end;
  v_church_id := case when tg_op = 'DELETE' then old.church_id else new.church_id end;
  v_tag_id := case when tg_op = 'DELETE' then old.tag_id else new.tag_id end;
  select document.title into v_document_title from public.administrative_documents document where document.id = v_document_id;
  select tag.name into v_tag_name from public.document_tags tag where tag.id = v_tag_id;
  perform public.log_audit(
    v_church_id,
    'documents',
    case when tg_op = 'DELETE' then 'DOCUMENT_TAG_REMOVED' else 'DOCUMENT_TAG_ASSIGNED' end,
    'administrative_document',
    v_document_id,
    v_document_title,
    case when tg_op = 'DELETE' then 'Tag removida do documento.' else 'Tag associada ao documento.' end,
    null,
    jsonb_build_object('tag_id', v_tag_id, 'tag_name', v_tag_name),
    null,
    'INFO'
  );
  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

drop trigger if exists audit_document_categories_mutation on public.document_categories;
create trigger audit_document_categories_mutation
after insert or update on public.document_categories
for each row execute function private.audit_document_category_mutation();

drop trigger if exists audit_document_folders_mutation on public.document_folders;
create trigger audit_document_folders_mutation
after insert or update on public.document_folders
for each row execute function private.audit_document_folder_mutation();

drop trigger if exists audit_administrative_documents_mutation on public.administrative_documents;
create trigger audit_administrative_documents_mutation
after insert or update on public.administrative_documents
for each row execute function private.audit_administrative_document_mutation();

drop trigger if exists audit_document_tags_mutation on public.document_tags;
create trigger audit_document_tags_mutation
after insert or update on public.document_tags
for each row execute function private.audit_document_tag_mutation();

drop trigger if exists audit_document_tag_assignments on public.administrative_document_tags;
create trigger audit_document_tag_assignments
after insert or delete on public.administrative_document_tags
for each row execute function private.audit_document_tag_assignment();

revoke all on function private.audit_document_category_mutation() from public, anon, authenticated;
revoke all on function private.audit_document_folder_mutation() from public, anon, authenticated;
revoke all on function private.audit_administrative_document_mutation() from public, anon, authenticated;
revoke all on function private.audit_document_tag_mutation() from public, anon, authenticated;
revoke all on function private.audit_document_tag_assignment() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Pesquisa paginada por metadados (SECURITY INVOKER + RLS)
-- ---------------------------------------------------------------------------

create or replace function public.search_administrative_documents(
  p_church_id uuid,
  p_search text default null,
  p_category_id uuid default null,
  p_folder_id uuid default null,
  p_tag_id uuid default null,
  p_format text default null,
  p_state text default 'ACTIVE',
  p_date_from date default null,
  p_date_to date default null,
  p_uploaded_by uuid default null,
  p_sort text default 'RECENT',
  p_page integer default 1,
  p_page_size integer default 20
)
returns table (
  id uuid,
  folder_id uuid,
  folder_name text,
  category_id uuid,
  category_name text,
  title text,
  description text,
  document_date date,
  reference_number text,
  physical_location text,
  notes text,
  original_file_name text,
  mime_type text,
  file_extension text,
  file_size bigint,
  status text,
  effective_status text,
  uploaded_by uuid,
  uploaded_by_name text,
  uploaded_at timestamptz,
  updated_at timestamptz,
  tags jsonb,
  total_count bigint
)
language sql
stable
security invoker
set search_path = ''
as $$
  with filtered as (
    select
      document.id,
      document.folder_id,
      folder.name as folder_name,
      folder.category_id,
      category.name as category_name,
      document.title,
      document.description,
      document.document_date,
      document.reference_number,
      document.physical_location,
      document.notes,
      document.original_file_name,
      document.mime_type,
      document.file_extension,
      document.file_size,
      document.status,
      case
        when document.deleted_at is not null then 'DELETED'
        when document.status = 'ARCHIVED' or folder.status = 'ARCHIVED' or category.status = 'ARCHIVED' then 'ARCHIVED'
        else 'ACTIVE'
      end as effective_status,
      document.uploaded_by,
      coalesce(profile.display_name, profile.full_name, profile.email, 'Usuário') as uploaded_by_name,
      document.uploaded_at,
      document.updated_at,
      coalesce((
        select jsonb_agg(
          jsonb_build_object('id', tag.id, 'name', tag.name)
          order by tag.name
        )
        from public.administrative_document_tags assignment
        join public.document_tags tag
          on tag.id = assignment.tag_id
         and tag.church_id = assignment.church_id
         and tag.deleted_at is null
        where assignment.document_id = document.id
          and assignment.church_id = document.church_id
      ), '[]'::jsonb) as tags
    from public.administrative_documents document
    join public.document_folders folder
      on folder.id = document.folder_id and folder.church_id = document.church_id
    join public.document_categories category
      on category.id = folder.category_id and category.church_id = folder.church_id
    left join public.profiles profile on profile.id = document.uploaded_by
    where document.church_id = p_church_id
      and document.upload_status = 'ACTIVE'
      and folder.deleted_at is null
      and category.deleted_at is null
      and (select private.is_church_admin(p_church_id))
      and (
        (select public.has_permission(p_church_id, 'documents.view'))
        or (select public.has_permission(p_church_id, 'documents.manage'))
      )
      and (
        case upper(coalesce(p_state, 'ACTIVE'))
          when 'DELETED' then document.deleted_at is not null
          when 'ARCHIVED' then document.deleted_at is null and (
            document.status = 'ARCHIVED' or folder.status = 'ARCHIVED' or category.status = 'ARCHIVED'
          )
          when 'ALL' then true
          else document.deleted_at is null
            and document.status = 'ACTIVE'
            and folder.status = 'ACTIVE'
            and category.status = 'ACTIVE'
        end
      )
      and (p_category_id is null or category.id = p_category_id)
      and (p_folder_id is null or folder.id = p_folder_id)
      and (p_format is null or p_format = '' or document.file_extension = lower(p_format))
      and (p_uploaded_by is null or document.uploaded_by = p_uploaded_by)
      and (p_date_from is null or document.uploaded_at::date >= p_date_from)
      and (p_date_to is null or document.uploaded_at::date <= p_date_to)
      and (
        p_tag_id is null
        or exists (
          select 1
          from public.administrative_document_tags assignment
          where assignment.document_id = document.id
            and assignment.church_id = document.church_id
            and assignment.tag_id = p_tag_id
        )
      )
      and (
        nullif(btrim(coalesce(p_search, '')), '') is null
        or document.title ilike '%' || btrim(p_search) || '%'
        or document.original_file_name ilike '%' || btrim(p_search) || '%'
        or coalesce(document.reference_number, '') ilike '%' || btrim(p_search) || '%'
        or coalesce(document.description, '') ilike '%' || btrim(p_search) || '%'
        or coalesce(document.notes, '') ilike '%' || btrim(p_search) || '%'
        or coalesce(document.physical_location, '') ilike '%' || btrim(p_search) || '%'
        or folder.name ilike '%' || btrim(p_search) || '%'
        or category.name ilike '%' || btrim(p_search) || '%'
        or exists (
          select 1
          from public.administrative_document_tags assignment
          join public.document_tags tag on tag.id = assignment.tag_id
          where assignment.document_id = document.id
            and assignment.church_id = document.church_id
            and tag.deleted_at is null
            and tag.name ilike '%' || btrim(p_search) || '%'
        )
      )
  )
  select
    filtered.id,
    filtered.folder_id,
    filtered.folder_name,
    filtered.category_id,
    filtered.category_name,
    filtered.title,
    filtered.description,
    filtered.document_date,
    filtered.reference_number,
    filtered.physical_location,
    filtered.notes,
    filtered.original_file_name,
    filtered.mime_type,
    filtered.file_extension,
    filtered.file_size,
    filtered.status,
    filtered.effective_status,
    filtered.uploaded_by,
    filtered.uploaded_by_name,
    filtered.uploaded_at,
    filtered.updated_at,
    filtered.tags,
    count(*) over() as total_count
  from filtered
  order by
    case when upper(p_sort) = 'OLDEST' then filtered.uploaded_at end asc,
    case when upper(p_sort) = 'TITLE_ASC' then lower(filtered.title) end asc,
    case when upper(p_sort) = 'SIZE_DESC' then filtered.file_size end desc,
    case when upper(p_sort) = 'SIZE_ASC' then filtered.file_size end asc,
    case when upper(p_sort) = 'RECENT' then filtered.uploaded_at end desc,
    filtered.uploaded_at desc,
    filtered.id desc
  limit greatest(1, least(coalesce(p_page_size, 20), 50))
  offset (greatest(coalesce(p_page, 1), 1) - 1) * greatest(1, least(coalesce(p_page_size, 20), 50));
$$;

create or replace function public.update_administrative_document_metadata(
  p_document_id uuid,
  p_title text,
  p_description text default null,
  p_document_date date default null,
  p_reference_number text default null,
  p_physical_location text default null,
  p_notes text default null,
  p_tag_names text[] default array[]::text[]
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_church_id uuid;
begin
  select document.church_id
  into v_church_id
  from public.administrative_documents document
  where document.id = p_document_id
    and document.upload_status = 'ACTIVE'
    and document.deleted_at is null;

  if v_church_id is null
    or not (select private.is_church_admin(v_church_id))
    or not (select public.has_permission(v_church_id, 'documents.manage')) then
    raise exception 'Acesso negado';
  end if;

  update public.administrative_documents
  set
    title = p_title,
    description = p_description,
    document_date = p_document_date,
    reference_number = p_reference_number,
    physical_location = p_physical_location,
    notes = p_notes,
    updated_by = (select auth.uid())
  where id = p_document_id
    and church_id = v_church_id
    and upload_status = 'ACTIVE'
    and deleted_at is null;

  insert into public.document_tags (
    church_id, name, created_by, updated_by
  )
  select
    v_church_id,
    desired.name,
    (select auth.uid()),
    (select auth.uid())
  from (
    select distinct btrim(regexp_replace(raw_name, '\s+', ' ', 'g')) as name
    from unnest(coalesce(p_tag_names, array[]::text[])) raw_name
    where btrim(raw_name) <> ''
  ) desired
  where not exists (
    select 1
    from public.document_tags tag
    where tag.church_id = v_church_id
      and lower(btrim(tag.name)) = lower(btrim(desired.name))
      and tag.deleted_at is null
  )
  on conflict do nothing;

  delete from public.administrative_document_tags assignment
  where assignment.document_id = p_document_id
    and assignment.church_id = v_church_id
    and assignment.tag_id not in (
      select tag.id
      from public.document_tags tag
      where tag.church_id = v_church_id
        and tag.deleted_at is null
        and lower(btrim(tag.name)) in (
          select lower(btrim(regexp_replace(raw_name, '\s+', ' ', 'g')))
          from unnest(coalesce(p_tag_names, array[]::text[])) raw_name
          where btrim(raw_name) <> ''
        )
    );

  insert into public.administrative_document_tags (
    church_id, document_id, tag_id, created_by
  )
  select
    v_church_id,
    p_document_id,
    tag.id,
    (select auth.uid())
  from public.document_tags tag
  where tag.church_id = v_church_id
    and tag.deleted_at is null
    and lower(btrim(tag.name)) in (
      select lower(btrim(regexp_replace(raw_name, '\s+', ' ', 'g')))
      from unnest(coalesce(p_tag_names, array[]::text[])) raw_name
      where btrim(raw_name) <> ''
    )
  on conflict (document_id, tag_id) do nothing;
end;
$$;

create or replace function public.log_administrative_document_download(p_document_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_document public.administrative_documents%rowtype;
begin
  select document.* into v_document
  from public.administrative_documents document
  where document.id = p_document_id
    and document.upload_status = 'ACTIVE';

  if v_document.id is null
    or not (select private.is_church_admin(v_document.church_id))
    or not (
      (select public.has_permission(v_document.church_id, 'documents.view'))
      or (select public.has_permission(v_document.church_id, 'documents.manage'))
    ) then
    raise exception 'Acesso negado';
  end if;

  perform public.log_audit(
    v_document.church_id,
    'documents',
    'ADMINISTRATIVE_DOCUMENT_DOWNLOADED',
    'administrative_document',
    v_document.id,
    v_document.title,
    'Documento administrativo baixado.',
    null,
    null,
    null,
    'INFO'
  );
end;
$$;

revoke all on function public.search_administrative_documents(uuid,text,uuid,uuid,uuid,text,text,date,date,uuid,text,integer,integer)
from public, anon;
grant execute on function public.search_administrative_documents(uuid,text,uuid,uuid,uuid,text,text,date,date,uuid,text,integer,integer)
to authenticated;
revoke all on function public.update_administrative_document_metadata(uuid,text,text,date,text,text,text,text[])
from public, anon;
grant execute on function public.update_administrative_document_metadata(uuid,text,text,date,text,text,text,text[])
to authenticated;
revoke all on function public.log_administrative_document_download(uuid) from public, anon;
grant execute on function public.log_administrative_document_download(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- RLS e privilégios explícitos do Data API
-- ---------------------------------------------------------------------------

alter table public.document_categories enable row level security;
alter table public.document_folders enable row level security;
alter table public.document_tags enable row level security;
alter table public.administrative_documents enable row level security;
alter table public.administrative_document_tags enable row level security;

create policy document_categories_select on public.document_categories
for select to authenticated using (
  (select private.is_church_admin(church_id))
  and (
    (select public.has_permission(church_id, 'documents.view'))
    or (select public.has_permission(church_id, 'documents.manage'))
  )
);
create policy document_categories_insert on public.document_categories
for insert to authenticated with check (
  created_by = (select auth.uid())
  and updated_by = (select auth.uid())
  and (select private.is_church_admin(church_id))
  and (select public.has_permission(church_id, 'documents.manage'))
);
create policy document_categories_update on public.document_categories
for update to authenticated using (
  (select private.is_church_admin(church_id))
  and (select public.has_permission(church_id, 'documents.manage'))
)
with check (
  (select private.is_church_admin(church_id))
  and (select public.has_permission(church_id, 'documents.manage'))
);

create policy document_folders_select on public.document_folders
for select to authenticated using (
  (select private.is_church_admin(church_id))
  and (
    (select public.has_permission(church_id, 'documents.view'))
    or (select public.has_permission(church_id, 'documents.manage'))
  )
);
create policy document_folders_insert on public.document_folders
for insert to authenticated with check (
  created_by = (select auth.uid())
  and updated_by = (select auth.uid())
  and (select private.is_church_admin(church_id))
  and (select public.has_permission(church_id, 'documents.manage'))
);
create policy document_folders_update on public.document_folders
for update to authenticated using (
  (select private.is_church_admin(church_id))
  and (select public.has_permission(church_id, 'documents.manage'))
)
with check (
  (select private.is_church_admin(church_id))
  and (select public.has_permission(church_id, 'documents.manage'))
);

create policy document_tags_select on public.document_tags
for select to authenticated using (
  (select private.is_church_admin(church_id))
  and (
    (select public.has_permission(church_id, 'documents.view'))
    or (select public.has_permission(church_id, 'documents.manage'))
  )
);
create policy document_tags_insert on public.document_tags
for insert to authenticated with check (
  created_by = (select auth.uid())
  and updated_by = (select auth.uid())
  and (select private.is_church_admin(church_id))
  and (select public.has_permission(church_id, 'documents.manage'))
);
create policy document_tags_update on public.document_tags
for update to authenticated using (
  (select private.is_church_admin(church_id))
  and (select public.has_permission(church_id, 'documents.manage'))
)
with check (
  (select private.is_church_admin(church_id))
  and (select public.has_permission(church_id, 'documents.manage'))
);

create policy administrative_documents_select on public.administrative_documents
for select to authenticated using (
  (select private.is_church_admin(church_id))
  and (
    (select public.has_permission(church_id, 'documents.view'))
    or (select public.has_permission(church_id, 'documents.manage'))
  )
);
create policy administrative_documents_insert on public.administrative_documents
for insert to authenticated with check (
  upload_status = 'PENDING'
  and uploaded_by = (select auth.uid())
  and updated_by = (select auth.uid())
  and (select private.is_church_admin(church_id))
  and (select public.has_permission(church_id, 'documents.manage'))
);
create policy administrative_documents_update on public.administrative_documents
for update to authenticated using (
  (select private.is_church_admin(church_id))
  and (select public.has_permission(church_id, 'documents.manage'))
)
with check (
  (select private.is_church_admin(church_id))
  and (select public.has_permission(church_id, 'documents.manage'))
);

create policy administrative_document_tags_select on public.administrative_document_tags
for select to authenticated using (
  (select private.is_church_admin(church_id))
  and (
    (select public.has_permission(church_id, 'documents.view'))
    or (select public.has_permission(church_id, 'documents.manage'))
  )
);
create policy administrative_document_tags_insert on public.administrative_document_tags
for insert to authenticated with check (
  created_by = (select auth.uid())
  and (select private.is_church_admin(church_id))
  and (select public.has_permission(church_id, 'documents.manage'))
);
create policy administrative_document_tags_delete on public.administrative_document_tags
for delete to authenticated using (
  (select private.is_church_admin(church_id))
  and (select public.has_permission(church_id, 'documents.manage'))
);

revoke all on public.document_categories from anon;
revoke all on public.document_folders from anon;
revoke all on public.document_tags from anon;
revoke all on public.administrative_documents from anon;
revoke all on public.administrative_document_tags from anon;
grant select, insert, update on public.document_categories to authenticated;
grant select, insert, update on public.document_folders to authenticated;
grant select, insert, update on public.document_tags to authenticated;
grant select, insert, update on public.administrative_documents to authenticated;
grant select, insert, delete on public.administrative_document_tags to authenticated;
revoke delete on public.document_categories from authenticated;
revoke delete on public.document_folders from authenticated;
revoke delete on public.document_tags from authenticated;
revoke delete on public.administrative_documents from authenticated;

-- ---------------------------------------------------------------------------
-- Bucket privado e políticas equivalentes do Storage
-- Caminho: church/category/folder/document/file.ext
-- ---------------------------------------------------------------------------

insert into storage.buckets (
  id, name, public, file_size_limit, allowed_mime_types
)
values (
  'administrative-documents',
  'administrative-documents',
  false,
  10485760,
  array[
    'application/pdf',
    'image/jpeg',
    'image/png',
    'image/webp',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  ]::text[]
)
on conflict (id) do update set
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create policy administrative_document_files_select on storage.objects
for select to authenticated using (
  bucket_id = 'administrative-documents'
  and (select private.is_church_admin(public.safe_uuid((storage.foldername(name))[1])))
  and (
    (select public.has_permission(public.safe_uuid((storage.foldername(name))[1]), 'documents.view'))
    or (select public.has_permission(public.safe_uuid((storage.foldername(name))[1]), 'documents.manage'))
  )
  and exists (
    select 1
    from public.administrative_documents document
    where document.church_id = public.safe_uuid((storage.foldername(name))[1])
      and document.folder_id = public.safe_uuid((storage.foldername(name))[3])
      and document.id = public.safe_uuid((storage.foldername(name))[4])
      and (
        document.storage_path = name
        or document.pending_storage_path = name
      )
  )
);

create policy administrative_document_files_insert on storage.objects
for insert to authenticated with check (
  bucket_id = 'administrative-documents'
  and (select private.is_church_admin(public.safe_uuid((storage.foldername(name))[1])))
  and (select public.has_permission(public.safe_uuid((storage.foldername(name))[1]), 'documents.manage'))
  and exists (
    select 1
    from public.administrative_documents document
    where document.church_id = public.safe_uuid((storage.foldername(name))[1])
      and document.folder_id = public.safe_uuid((storage.foldername(name))[3])
      and document.id = public.safe_uuid((storage.foldername(name))[4])
      and document.deleted_at is null
      and (
        (
          document.storage_path = name
          and document.upload_status = 'PENDING'
          and document.uploaded_by = (select auth.uid())
        )
        or (
          document.pending_storage_path = name
          and document.upload_status = 'ACTIVE'
          and document.pending_by = (select auth.uid())
        )
      )
  )
);

create policy administrative_document_files_delete on storage.objects
for delete to authenticated using (
  bucket_id = 'administrative-documents'
  and (select private.is_church_admin(public.safe_uuid((storage.foldername(name))[1])))
  and (select public.has_permission(public.safe_uuid((storage.foldername(name))[1]), 'documents.manage'))
  and exists (
    select 1
    from public.administrative_documents document
    where document.church_id = public.safe_uuid((storage.foldername(name))[1])
      and document.id = public.safe_uuid((storage.foldername(name))[4])
      and (document.storage_path = name or document.pending_storage_path = name)
  )
);

commit;
