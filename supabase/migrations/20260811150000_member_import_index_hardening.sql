-- Índices de cobertura dos relacionamentos do módulo de importação.
-- Além das consultas do produto, estes índices evitam varreduras integrais
-- durante validação/remoção das entidades referenciadas.

create index if not exists member_import_batches_created_by_idx
  on public.member_import_batches(created_by);

create index if not exists member_import_batches_rolled_back_by_idx
  on public.member_import_batches(rolled_back_by);

create index if not exists member_import_items_church_batch_idx
  on public.member_import_items(church_id, batch_id);

create index if not exists member_import_items_church_role_idx
  on public.member_import_items(church_id, role_id);

create index if not exists members_history_migration_updated_by_idx
  on public.members(history_migration_updated_by);
