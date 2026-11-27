-- Lotes anteriores adotam ACTIVE. Valores explícitos devem ser uma das duas
-- situações iniciais de membro aceitas na preparação de um lote.
alter table public.member_import_batches
  add constraint member_import_batches_member_status_check check (
    not (settings_snapshot ? 'member_status')
    or settings_snapshot->'member_status' in ('"ACTIVE"'::jsonb, '"INACTIVE"'::jsonb)
  );

-- Substitui apenas a situação inicial no INSERT da rotina transacional.
do $migration$
declare
  definition text := pg_get_functiondef('private.execute_member_import(uuid)'::regprocedure);
  old_values text := $sql$v_member_code, 'ACTIVE', 'MEMBER'$sql$;
  new_values text := $sql$v_member_code, coalesce(v_batch.settings_snapshot->>'member_status', 'ACTIVE'), 'MEMBER'$sql$;
begin
  if position(old_values in definition) = 0 then
    raise exception 'Definição inesperada da situação inicial na importação de membros';
  end if;
  execute replace(definition, old_values, new_values);
end;
$migration$;
