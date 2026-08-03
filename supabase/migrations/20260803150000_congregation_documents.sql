-- Eclesias — documentos privados vinculados às Congregações.
-- O arquivo fica no Supabase Storage; esta tabela mantém somente metadados,
-- vínculo multi-tenant e trilha de auditoria.

begin;

-- ---------------------------------------------------------------------------
-- Catálogo de permissões
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
values
  (
    'congregation_documents.view',
    'Visualizar documentos de Congregações',
    'Consultar e baixar documentos administrativos vinculados às Congregações',
    'organization',
    'view_documents',
    true,
    'ACTIVE'
  ),
  (
    'congregation_documents.manage',
    'Gerenciar documentos de Congregações',
    'Enviar, editar e excluir documentos administrativos vinculados às Congregações',
    'organization',
    'manage_documents',
    true,
    'ACTIVE'
  )
on conflict do nothing;

update public.permissions
set status = 'ACTIVE', deleted_at = null, updated_at = now()
where key in (
  'congregation_documents.view',
  'congregation_documents.manage'
);

insert into public.role_permissions (role, permission_id, status)
select 'ADMIN', permission.id, 'ACTIVE'
from public.permissions permission
where permission.key in (
    'congregation_documents.view',
    'congregation_documents.manage'
  )
  and permission.deleted_at is null
  and not exists (
    select 1
    from public.role_permissions role_permission
    where role_permission.role = 'ADMIN'
      and role_permission.permission_id = permission.id
      and role_permission.deleted_at is null
  );

-- Mantém as novas permissões sensíveis restritas a Administradores.
create or replace function public.set_access_permission_override(
  p_access_id uuid,
  p_permission_key text,
  p_effect text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_church_id uuid;
  v_permission_id uuid;
  v_target_role text;
begin
  select church_id, role
  into v_church_id, v_target_role
  from public.user_church_access
  where id = p_access_id and deleted_at is null;

  if v_church_id is null
    or not public.has_permission(v_church_id, 'users.manage_permissions') then
    raise exception 'Acesso negado';
  end if;

  select id into v_permission_id
  from public.permissions
  where key = p_permission_key and status = 'ACTIVE' and deleted_at is null;

  if v_permission_id is null then
    raise exception 'Permissão inválida';
  end if;

  if upper(p_effect) = 'ALLOW'
    and p_permission_key in (
      'regions.manage',
      'congregations.manage',
      'positions.manage',
      'congregation_documents.view',
      'congregation_documents.manage'
    )
    and v_target_role <> 'ADMIN' then
    raise exception 'Esta permissão é exclusiva de Administradores';
  end if;

  if upper(p_effect) = 'ALLOW'
    and not public.has_permission(v_church_id, p_permission_key) then
    raise exception 'Não é permitido conceder uma permissão que você não possui';
  end if;

  if upper(p_effect) = 'INHERIT' then
    update public.user_permission_overrides
    set deleted_at = now(), updated_at = now()
    where access_id = p_access_id
      and permission_id = v_permission_id
      and deleted_at is null;
  elsif upper(p_effect) in ('ALLOW', 'DENY') then
    insert into public.user_permission_overrides (
      access_id, permission_id, effect, created_by
    ) values (
      p_access_id, v_permission_id, upper(p_effect), auth.uid()
    )
    on conflict (access_id, permission_id) where deleted_at is null
    do update set
      effect = excluded.effect,
      created_by = auth.uid(),
      updated_at = now();
  else
    raise exception 'Efeito inválido';
  end if;

  perform public.log_audit(
    v_church_id,
    'users',
    'PERMISSION_OVERRIDE_UPDATED',
    'user_church_access',
    p_access_id,
    p_permission_key,
    'Permissão personalizada alterada.',
    null,
    jsonb_build_object('permission', p_permission_key, 'effect', upper(p_effect)),
    null,
    'WARNING'
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- Tabela e integridade multi-tenant
-- ---------------------------------------------------------------------------

create unique index if not exists congregations_church_id_id_unique_idx
  on public.congregations (church_id, id);

create table if not exists public.congregation_documents (
  id uuid primary key default gen_random_uuid(),
  church_id uuid not null references public.churches(id) on delete restrict,
  congregation_id uuid not null,
  title text not null,
  category text not null default 'OTHER',
  original_file_name text not null,
  storage_bucket text not null default 'congregation-documents',
  storage_path text not null,
  mime_type text not null,
  file_size bigint not null,
  upload_status text not null default 'PENDING',
  uploaded_by uuid not null references public.profiles(id) on delete restrict,
  deleted_by uuid references public.profiles(id) on delete restrict,
  uploaded_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint congregation_documents_congregation_same_church_fk
    foreign key (church_id, congregation_id)
    references public.congregations(church_id, id)
    on delete restrict,
  constraint congregation_documents_title_not_blank_check
    check (btrim(title) <> ''),
  constraint congregation_documents_original_name_not_blank_check
    check (btrim(original_file_name) <> ''),
  constraint congregation_documents_category_check
    check (category in (
      'WATER_BILL',
      'ENERGY_BILL',
      'DEED',
      'CONTRACT',
      'TAX_DOCUMENT',
      'RECEIPT',
      'OTHER'
    )),
  constraint congregation_documents_bucket_check
    check (storage_bucket = 'congregation-documents'),
  constraint congregation_documents_mime_type_check
    check (mime_type in (
      'application/pdf',
      'image/jpeg',
      'image/png',
      'image/webp',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    )),
  constraint congregation_documents_file_size_check
    check (file_size > 0 and file_size <= 10485760),
  constraint congregation_documents_upload_status_check
    check (upload_status in ('PENDING', 'ACTIVE')),
  constraint congregation_documents_deleted_by_check
    check (
      (deleted_at is null and deleted_by is null)
      or (deleted_at is not null and deleted_by is not null)
    ),
  constraint congregation_documents_storage_path_unique unique (storage_path)
);

create index if not exists congregation_documents_congregation_active_idx
  on public.congregation_documents (
    church_id,
    congregation_id,
    uploaded_at desc,
    id
  )
  where deleted_at is null and upload_status = 'ACTIVE';

create index if not exists congregation_documents_pending_idx
  on public.congregation_documents (uploaded_at, id)
  where deleted_at is null and upload_status = 'PENDING';

create index if not exists congregation_documents_uploaded_by_idx
  on public.congregation_documents (uploaded_by);

create index if not exists congregation_documents_deleted_by_idx
  on public.congregation_documents (deleted_by)
  where deleted_by is not null;

create or replace function private.protect_congregation_document_mutation()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.title := btrim(new.title);
  new.category := upper(btrim(new.category));
  new.original_file_name := btrim(new.original_file_name);
  new.mime_type := lower(btrim(new.mime_type));

  if tg_op = 'INSERT' then
    if new.uploaded_by is distinct from (select auth.uid()) then
      raise exception 'O responsável pelo envio é inválido';
    end if;
  else
    if new.church_id is distinct from old.church_id
      or new.congregation_id is distinct from old.congregation_id
      or new.original_file_name is distinct from old.original_file_name
      or new.storage_bucket is distinct from old.storage_bucket
      or new.storage_path is distinct from old.storage_path
      or new.uploaded_by is distinct from old.uploaded_by
      or new.uploaded_at is distinct from old.uploaded_at then
      raise exception 'Não é permitido alterar a identidade do documento';
    end if;

    if (
      new.mime_type is distinct from old.mime_type
      or new.file_size is distinct from old.file_size
      or new.upload_status is distinct from old.upload_status
    ) and not (
      old.upload_status = 'PENDING'
      and new.upload_status = 'ACTIVE'
      and new.deleted_at is null
    ) then
      raise exception 'A situação do upload não pode ser alterada';
    end if;

    if old.deleted_at is not null and new.deleted_at is null then
      raise exception 'Não é permitido restaurar o documento por esta operação';
    end if;

    if new.deleted_at is distinct from old.deleted_at and new.deleted_at is not null then
      new.deleted_by := (select auth.uid());
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists protect_congregation_document_mutation
  on public.congregation_documents;
create trigger protect_congregation_document_mutation
before insert or update on public.congregation_documents
for each row execute function private.protect_congregation_document_mutation();

drop trigger if exists touch_congregation_documents_updated_at
  on public.congregation_documents;
create trigger touch_congregation_documents_updated_at
before update on public.congregation_documents
for each row execute function public.touch_updated_at();

-- Impede o arquivamento de uma Congregação que ainda possua documentos ativos.
create or replace function private.protect_congregation_documents_dependency()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.deleted_at is distinct from old.deleted_at
    and new.deleted_at is not null
    and exists (
      select 1
      from public.congregation_documents document
      where document.congregation_id = old.id
        and document.church_id = old.church_id
        and document.upload_status = 'ACTIVE'
        and document.deleted_at is null
    ) then
    raise exception 'A Congregação possui documentos ativos e deve ser apenas inativada';
  end if;

  return new;
end;
$$;

drop trigger if exists protect_congregation_documents_dependency
  on public.congregations;
create trigger protect_congregation_documents_dependency
before update of deleted_at on public.congregations
for each row execute function private.protect_congregation_documents_dependency();

-- ---------------------------------------------------------------------------
-- Auditoria
-- ---------------------------------------------------------------------------

create or replace function private.audit_congregation_document_mutation()
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
    -- O registro pendente ainda não representa um documento confirmado.
    return new;
  elsif old.upload_status = 'PENDING' and new.upload_status = 'ACTIVE' then
    v_action := 'CONGREGATION_DOCUMENT_UPLOADED';
    v_description := 'Documento da Congregação anexado.';
  elsif old.upload_status = 'PENDING' and new.deleted_at is not null then
    -- Upload inválido ou interrompido: não polui a auditoria operacional.
    return new;
  elsif new.deleted_at is distinct from old.deleted_at and new.deleted_at is not null then
    v_action := 'CONGREGATION_DOCUMENT_DELETED';
    v_description := 'Documento da Congregação excluído.';
  else
    v_action := 'CONGREGATION_DOCUMENT_UPDATED';
    v_description := 'Dados do documento da Congregação alterados.';
  end if;

  perform public.log_audit(
    new.church_id,
    'organization',
    v_action,
    'congregation_document',
    new.id,
    new.title,
    v_description,
    case when tg_op = 'UPDATE' then jsonb_build_object(
      'title', old.title,
      'category', old.category,
      'deleted_at', old.deleted_at
    ) else null end,
    jsonb_build_object(
      'congregation_id', new.congregation_id,
      'title', new.title,
      'category', new.category,
      'mime_type', new.mime_type,
      'file_size', new.file_size,
      'upload_status', new.upload_status,
      'deleted_at', new.deleted_at
    ),
    null,
    case when v_action = 'CONGREGATION_DOCUMENT_DELETED' then 'WARNING' else 'INFO' end
  );

  return new;
end;
$$;

drop trigger if exists audit_congregation_document_mutation
  on public.congregation_documents;
create trigger audit_congregation_document_mutation
after insert or update on public.congregation_documents
for each row execute function private.audit_congregation_document_mutation();

revoke all on function private.protect_congregation_document_mutation()
  from public, anon, authenticated;
revoke all on function private.protect_congregation_documents_dependency()
  from public, anon, authenticated;
revoke all on function private.audit_congregation_document_mutation()
  from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- RLS da tabela de metadados
-- ---------------------------------------------------------------------------

alter table public.congregation_documents enable row level security;

drop policy if exists congregation_documents_select on public.congregation_documents;
create policy congregation_documents_select
on public.congregation_documents for select to authenticated
using (
  deleted_at is null
  and (
    (
      upload_status = 'ACTIVE'
      and (
        (select public.has_permission(church_id, 'congregation_documents.view'))
        or (select public.has_permission(church_id, 'congregation_documents.manage'))
      )
    )
    or (
      upload_status = 'PENDING'
      and (select public.has_permission(church_id, 'congregation_documents.manage'))
    )
  )
  and (select private.is_church_admin(church_id))
  and (select public.can_access_congregation(church_id, congregation_id))
);

drop policy if exists congregation_documents_insert on public.congregation_documents;
create policy congregation_documents_insert
on public.congregation_documents for insert to authenticated
with check (
  deleted_at is null
  and upload_status = 'PENDING'
  and uploaded_by = (select auth.uid())
  and (select public.has_permission(church_id, 'congregation_documents.manage'))
  and (select private.is_church_admin(church_id))
  and (select public.can_access_congregation(church_id, congregation_id))
);

drop policy if exists congregation_documents_update on public.congregation_documents;
create policy congregation_documents_update
on public.congregation_documents for update to authenticated
using (
  deleted_at is null
  and (select public.has_permission(church_id, 'congregation_documents.manage'))
  and (select private.is_church_admin(church_id))
  and (select public.can_access_congregation(church_id, congregation_id))
)
with check (
  (select public.has_permission(church_id, 'congregation_documents.manage'))
  and (select private.is_church_admin(church_id))
  and (select public.can_access_congregation(church_id, congregation_id))
);

revoke delete on public.congregation_documents from authenticated;
grant select, insert, update on public.congregation_documents to authenticated;

-- ---------------------------------------------------------------------------
-- Bucket privado e políticas do Storage
-- Caminho obrigatório: church_id/congregation_id/document_id/arquivo.ext
-- ---------------------------------------------------------------------------

insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values (
  'congregation-documents',
  'congregation-documents',
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

drop policy if exists congregation_document_files_select on storage.objects;
create policy congregation_document_files_select
on storage.objects for select to authenticated
using (
  bucket_id = 'congregation-documents'
  and exists (
    select 1
    from public.congregation_documents document
    where document.storage_path = name
      and document.church_id = public.safe_uuid((storage.foldername(name))[1])
      and document.congregation_id = public.safe_uuid((storage.foldername(name))[2])
      and document.id = public.safe_uuid((storage.foldername(name))[3])
      and document.deleted_at is null
      and (
        (
          document.upload_status = 'ACTIVE'
          and (
            (select public.has_permission(
              document.church_id,
              'congregation_documents.view'
            ))
            or (select public.has_permission(
              document.church_id,
              'congregation_documents.manage'
            ))
          )
        )
        or (
          document.upload_status = 'PENDING'
          and (select public.has_permission(
            document.church_id,
            'congregation_documents.manage'
          ))
        )
      )
  )
  and (select private.is_church_admin(
    public.safe_uuid((storage.foldername(name))[1])
  ))
  and (select public.can_access_congregation(
    public.safe_uuid((storage.foldername(name))[1]),
    public.safe_uuid((storage.foldername(name))[2])
  ))
);

drop policy if exists congregation_document_files_insert on storage.objects;
create policy congregation_document_files_insert
on storage.objects for insert to authenticated
with check (
  bucket_id = 'congregation-documents'
  and public.safe_uuid((storage.foldername(name))[3]) is not null
  and exists (
    select 1
    from public.congregation_documents document
    where document.storage_path = name
      and document.church_id = public.safe_uuid((storage.foldername(name))[1])
      and document.congregation_id = public.safe_uuid((storage.foldername(name))[2])
      and document.id = public.safe_uuid((storage.foldername(name))[3])
      and document.deleted_at is null
      and (
        (
          document.upload_status = 'PENDING'
          and document.uploaded_by = (select auth.uid())
        )
        or document.upload_status = 'ACTIVE'
      )
  )
  and (select public.has_permission(
    public.safe_uuid((storage.foldername(name))[1]),
    'congregation_documents.manage'
  ))
  and (select private.is_church_admin(
    public.safe_uuid((storage.foldername(name))[1])
  ))
  and (select public.can_access_congregation(
    public.safe_uuid((storage.foldername(name))[1]),
    public.safe_uuid((storage.foldername(name))[2])
  ))
);

drop policy if exists congregation_document_files_update on storage.objects;
create policy congregation_document_files_update
on storage.objects for update to authenticated
using (
  bucket_id = 'congregation-documents'
  and exists (
    select 1
    from public.congregation_documents document
    where document.storage_path = name
      and document.deleted_at is null
      and (select public.has_permission(
        document.church_id,
        'congregation_documents.manage'
      ))
  )
  and (select public.has_permission(
    public.safe_uuid((storage.foldername(name))[1]),
    'congregation_documents.manage'
  ))
  and (select private.is_church_admin(
    public.safe_uuid((storage.foldername(name))[1])
  ))
  and (select public.can_access_congregation(
    public.safe_uuid((storage.foldername(name))[1]),
    public.safe_uuid((storage.foldername(name))[2])
  ))
)
with check (
  bucket_id = 'congregation-documents'
  and public.safe_uuid((storage.foldername(name))[3]) is not null
  and exists (
    select 1
    from public.congregation_documents document
    where document.storage_path = name
      and document.deleted_at is null
      and (select public.has_permission(
        document.church_id,
        'congregation_documents.manage'
      ))
  )
  and (select public.has_permission(
    public.safe_uuid((storage.foldername(name))[1]),
    'congregation_documents.manage'
  ))
  and (select private.is_church_admin(
    public.safe_uuid((storage.foldername(name))[1])
  ))
  and (select public.can_access_congregation(
    public.safe_uuid((storage.foldername(name))[1]),
    public.safe_uuid((storage.foldername(name))[2])
  ))
);

drop policy if exists congregation_document_files_delete on storage.objects;
create policy congregation_document_files_delete
on storage.objects for delete to authenticated
using (
  bucket_id = 'congregation-documents'
  and exists (
    select 1
    from public.congregation_documents document
    where document.storage_path = name
      and document.deleted_at is null
      and (select public.has_permission(
        document.church_id,
        'congregation_documents.manage'
      ))
  )
  and (select public.has_permission(
    public.safe_uuid((storage.foldername(name))[1]),
    'congregation_documents.manage'
  ))
  and (select private.is_church_admin(
    public.safe_uuid((storage.foldername(name))[1])
  ))
  and (select public.can_access_congregation(
    public.safe_uuid((storage.foldername(name))[1]),
    public.safe_uuid((storage.foldername(name))[2])
  ))
);

revoke all on function public.set_access_permission_override(uuid, text, text)
  from public, anon;
grant execute on function public.set_access_permission_override(uuid, text, text)
  to authenticated;

commit;
