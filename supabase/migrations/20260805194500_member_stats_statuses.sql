-- Completa os indicadores do painel sem retirar a proteção da RLS.
create or replace function public.get_member_stats(p_church_id uuid)
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  select jsonb_build_object(
    'total', count(*) filter (where member.deleted_at is null),
    'active', count(*) filter (
      where member.deleted_at is null and member.member_status = 'ACTIVE'
    ),
    'inactive', count(*) filter (
      where member.deleted_at is null and member.member_status = 'INACTIVE'
    ),
    'members', count(*) filter (
      where member.deleted_at is null and member.member_type = 'MEMBER'
    ),
    'congregated', count(*) filter (
      where member.deleted_at is null and member.member_type = 'CONGREGATED'
    ),
    'visitors', count(*) filter (
      where member.deleted_at is null and member.member_type = 'VISITOR'
    ),
    'children', count(*) filter (
      where member.deleted_at is null and member.member_type = 'CHILD'
    ),
    'archived', count(*) filter (where member.deleted_at is not null)
  )
  from public.members member
  where member.church_id = p_church_id;
$$;

revoke all on function public.get_member_stats(uuid) from public, anon;
grant execute on function public.get_member_stats(uuid) to authenticated;
