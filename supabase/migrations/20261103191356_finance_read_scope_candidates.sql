-- Materialize candidate units first so the planner cannot evaluate the canonical
-- predicate on units belonging to churches outside this caller's active accesses.
create or replace function private.readable_finance_units()
returns table(church_id uuid, congregation_id uuid)
language sql stable security definer set search_path = '' as $$
  with candidates as materialized (
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
  )
  select c.church_id, c.id
  from candidates c
  where private.can_access_finance_unit(c.church_id, c.id, 'finance.view');
$$;

revoke all on function private.readable_finance_units() from public, anon, authenticated;
grant execute on function private.readable_finance_units() to authenticated;
