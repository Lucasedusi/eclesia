-- Agregação do histórico em uma única consulta no banco, sem transferir todos
-- os lotes para o servidor de aplicação. A RLS dos lotes continua aplicável.

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

notify pgrst, 'reload schema';
