-- Consolida políticas equivalentes e cobre FKs apontadas pelo Database Linter.
begin;

drop policy if exists members_select_scope on public.members;
drop policy if exists members_select_archived_restore on public.members;
create policy members_select_scope
on public.members for select to authenticated
using (
  (select public.can_access_member(church_id, id, congregation_id))
  and (
    (
      deleted_at is null
      and (select public.has_permission(church_id, 'members.view_basic'))
    )
    or (
      deleted_at is not null
      and (select public.has_permission(church_id, 'members.restore'))
    )
  )
);

drop policy if exists member_documents_select_scope on public.member_documents;
drop policy if exists member_documents_select_archived_managers on public.member_documents;
create policy member_documents_select_scope
on public.member_documents for select to authenticated
using (
  exists (
    select 1
    from public.members member
    where member.id = member_id
      and member.church_id = member_documents.church_id
      and (select public.can_access_member(
        member.church_id,
        member.id,
        member.congregation_id
      ))
  )
  and (
    (
      deleted_at is null
      and (
        (select public.has_permission(church_id, 'members.view_full'))
        or (select public.has_permission(church_id, 'members.manage_documents'))
      )
      and (
        not is_sensitive
        or (select public.has_permission(church_id, 'members.view_sensitive_documents'))
      )
    )
    or (
      deleted_at is not null
      and (select public.has_permission(church_id, 'members.manage_documents'))
    )
  )
);

create index if not exists member_pastoral_notes_created_by_idx
  on public.member_pastoral_notes (created_by);
create index if not exists member_pastoral_notes_updated_by_idx
  on public.member_pastoral_notes (updated_by);
create index if not exists member_sensitive_identity_created_by_idx
  on public.member_sensitive_identity (created_by);
create index if not exists member_sensitive_identity_updated_by_idx
  on public.member_sensitive_identity (updated_by);
create index if not exists member_roles_church_congregation_idx
  on public.member_roles (church_id, congregation_id);

commit;
