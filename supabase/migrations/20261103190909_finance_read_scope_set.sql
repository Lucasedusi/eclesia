-- Evaluate the existing authorization rule per candidate unit, not per financial
-- row. SECURITY DEFINER only enumerates scope metadata; the canonical predicate
-- still checks the caller, active profile/church, permission and exact scope.
create function private.readable_finance_units()
returns table(church_id uuid, congregation_id uuid)
language sql stable security definer set search_path = '' as $$
  select c.church_id, c.id
  from public.congregations c
  where (select auth.uid()) is not null
    and c.deleted_at is null
    and c.church_id in (
      select a.church_id
      from public.user_church_access a
      where a.profile_id = (select auth.uid())
        and a.status = 'ACTIVE'
        and a.deleted_at is null
    )
    and private.can_access_finance_unit(c.church_id, c.id, 'finance.view');
$$;

revoke all on function private.readable_finance_units() from public, anon, authenticated;
grant execute on function private.readable_finance_units() to authenticated;

-- Keep both tenant and unit in the membership key. This uncorrelated subquery is
-- evaluated within each statement, never cached across sessions or queries.
alter policy finance_scoped_read on public.financial_transactions
using (
  deleted_at is null
  and (church_id, congregation_id) in (
    select allowed.church_id, allowed.congregation_id
    from private.readable_finance_units() allowed
  )
);

alter policy finance_scoped_read on public.financial_ledger_entries
using (
  deleted_at is null
  and (church_id, congregation_id) in (
    select allowed.church_id, allowed.congregation_id
    from private.readable_finance_units() allowed
  )
);
