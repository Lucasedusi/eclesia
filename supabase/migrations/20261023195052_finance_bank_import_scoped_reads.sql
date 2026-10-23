-- Evaluate operational scope once per query rather than once for every statement row.
-- The private helper returns only units for which the current caller has both permissions.
create function private.bank_import_units() returns table(church_id uuid,congregation_id uuid)
language sql stable security definer set search_path='' as $$
 select c.church_id,c.id from public.congregations c
 where c.deleted_at is null and exists(select 1 from public.user_church_access a where a.church_id=c.church_id and a.profile_id=(select auth.uid()) and a.status='ACTIVE' and a.deleted_at is null)
 and private.bank_import_access(c.church_id,c.id);
$$;
revoke all on function private.bank_import_units() from public,anon;
grant execute on function private.bank_import_units() to authenticated;
do $$ declare t text;begin
 foreach t in array array['finance_bank_import_batches','finance_bank_import_items','finance_bank_import_links','finance_bank_import_events'] loop
  execute format('drop policy bank_import_read on public.%I',t);
  execute format('create policy bank_import_read on public.%I for select to authenticated using ((church_id,congregation_id) in (select u.church_id,u.congregation_id from private.bank_import_units() u))',t);
 end loop;
end $$;
