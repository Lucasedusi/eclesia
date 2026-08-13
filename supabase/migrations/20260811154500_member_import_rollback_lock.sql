-- Fecha a janela de concorrência entre a verificação de alterações posteriores
-- e a remoção do lote. Todos os membros do lote são bloqueados antes da análise.

do $migration$
declare
  v_definition text;
begin
  v_definition := pg_get_functiondef('private.rollback_member_import(uuid)'::regprocedure);
  if position($needle$where member.source_import_batch_id = p_batch_id
  for update;$needle$ in v_definition) = 0 then
    v_definition := replace(
      v_definition,
      $old$  if v_batch.status <> 'COMPLETED' or v_batch.completed_at is null then
    raise exception 'IMPORT_BATCH_INVALID_STATUS';
  end if;

  select coalesce(jsonb_agg(jsonb_build_object($old$,
      $new$  if v_batch.status <> 'COMPLETED' or v_batch.completed_at is null then
    raise exception 'IMPORT_BATCH_INVALID_STATUS';
  end if;

  perform 1
  from public.members member
  where member.source_import_batch_id = p_batch_id
  for update;

  select coalesce(jsonb_agg(jsonb_build_object($new$
    );
    if position($needle$where member.source_import_batch_id = p_batch_id
  for update;$needle$ in v_definition) = 0 then
      raise exception 'MEMBER_IMPORT_ROLLBACK_LOCK_NOT_PATCHED';
    end if;
    execute v_definition;
  end if;
end;
$migration$;
