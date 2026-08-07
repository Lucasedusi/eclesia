begin;

drop policy if exists congregation_documents_select_archived_managers
  on public.congregation_documents;

create policy congregation_documents_select_archived_managers
on public.congregation_documents for select to authenticated
using (
  deleted_at is not null
  and (select public.has_permission(
    church_id,
    'congregation_documents.manage'
  ))
  and (select private.is_church_admin(church_id))
  and (select public.can_access_congregation(church_id, congregation_id))
);

commit;
