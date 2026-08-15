begin;

-- O download é autorizado no servidor da aplicação e o evento é gravado com o
-- cliente de serviço. Assim, nenhum usuário autenticado recebe acesso a uma
-- função SECURITY DEFINER exposta pelo schema público.
drop function if exists public.log_administrative_document_download(uuid);

-- Índice redundante criado na primeira versão da migração. A chave primária de
-- churches(id) já cobre todas as FKs do módulo.
drop index if exists public.churches_church_id_id_unique_idx;

-- Índices de suporte às chaves estrangeiras. Além das consultas administrativas,
-- eles evitam varreduras completas quando um perfil referenciado é alterado.
create index if not exists document_categories_created_by_idx
  on public.document_categories (created_by);
create index if not exists document_categories_updated_by_idx
  on public.document_categories (updated_by);
create index if not exists document_categories_archived_by_idx
  on public.document_categories (archived_by)
  where archived_by is not null;
create index if not exists document_categories_deleted_by_idx
  on public.document_categories (deleted_by)
  where deleted_by is not null;

create index if not exists document_folders_created_by_idx
  on public.document_folders (created_by);
create index if not exists document_folders_updated_by_idx
  on public.document_folders (updated_by);
create index if not exists document_folders_archived_by_idx
  on public.document_folders (archived_by)
  where archived_by is not null;
create index if not exists document_folders_deleted_by_idx
  on public.document_folders (deleted_by)
  where deleted_by is not null;

create index if not exists document_tags_created_by_idx
  on public.document_tags (created_by);
create index if not exists document_tags_updated_by_idx
  on public.document_tags (updated_by);
create index if not exists document_tags_deleted_by_idx
  on public.document_tags (deleted_by)
  where deleted_by is not null;

create index if not exists administrative_documents_uploaded_by_fk_idx
  on public.administrative_documents (uploaded_by);
create index if not exists administrative_documents_updated_by_idx
  on public.administrative_documents (updated_by);
create index if not exists administrative_documents_archived_by_idx
  on public.administrative_documents (archived_by)
  where archived_by is not null;
create index if not exists administrative_documents_deleted_by_idx
  on public.administrative_documents (deleted_by)
  where deleted_by is not null;
create index if not exists administrative_documents_pending_by_idx
  on public.administrative_documents (pending_by)
  where pending_by is not null;

create index if not exists administrative_document_tags_church_document_idx
  on public.administrative_document_tags (church_id, document_id);
create index if not exists administrative_document_tags_created_by_idx
  on public.administrative_document_tags (created_by);

commit;
