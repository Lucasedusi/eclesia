-- Use the same authorized units and database snapshot for movements and balance.
create or replace function public.preview_finance_accounting(p_church uuid, p_filters jsonb, p_page integer)
returns jsonb language plpgsql stable security invoker set search_path='' as $$
declare
  snap jsonb;
  page_no integer;
  opening numeric;
  unit_id uuid := (p_filters->>'unit')::uuid;
  box_id uuid := (p_filters->>'box')::uuid;
begin
  snap := private.accounting_snapshot(p_church, p_filters);
  select coalesce(sum(l.amount), 0) * 100 into opening
  from public.financial_ledger_entries l
  join private.accounting_units(p_church) u on u.id = l.congregation_id
  where l.church_id = p_church and l.deleted_at is null
    and l.financial_date < (p_filters->>'start')::date
    and (unit_id is null or u.id = unit_id)
    and (box_id is null or l.cashbox_id = box_id);

  page_no := least(greatest(p_page, 1), greatest(1, ceil((snap->>'total')::numeric / 50)::integer));
  return (snap - 'rows') || jsonb_build_object(
    'opening', opening, 'page', page_no, 'rows', coalesce((
      select jsonb_agg(r order by n)
      from jsonb_array_elements(snap->'rows') with ordinality a(r,n)
      where n between (page_no::bigint - 1) * 50 + 1 and page_no::bigint * 50
    ), '[]'::jsonb)
  );
end $$;
