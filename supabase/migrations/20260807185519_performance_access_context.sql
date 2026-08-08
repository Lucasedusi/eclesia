-- Consolida perfil, acessos, igreja ativa e permissões em uma única viagem.
-- SECURITY INVOKER preserva RLS; a função só é executável por authenticated.

create or replace function public.get_my_access_context(
  p_preferred_church_id uuid default null
)
returns jsonb
language sql
stable
security invoker
set search_path = public
as $$
  with my_profile as (
    select
      p.id,
      p.full_name,
      p.display_name,
      p.email,
      p.avatar_url,
      p.status,
      p.deleted_at
    from public.profiles p
    where p.id = (select auth.uid())
    limit 1
  ),
  active_accesses as (
    select
      a.id,
      a.church_id,
      a.role,
      a.access_scope,
      a.status,
      a.region_id,
      a.congregation_id,
      a.ministry_id,
      a.accepted_at,
      ch.name as church_name,
      ch.logo_url as church_logo_url
    from public.user_church_access a
    join public.churches ch on ch.id = a.church_id
    where a.profile_id = (select auth.uid())
      and a.status = 'ACTIVE'
      and a.deleted_at is null
      and ch.status = 'ACTIVE'
      and ch.deleted_at is null
  ),
  selected_access as (
    select a.*
    from active_accesses a
    order by
      case when a.church_id = p_preferred_church_id then 0 else 1 end,
      a.accepted_at asc nulls last,
      a.id
    limit 1
  )
  select jsonb_build_object(
    'profile', jsonb_build_object(
      'id', p.id,
      'full_name', p.full_name,
      'display_name', p.display_name,
      'email', p.email,
      'avatar_url', p.avatar_url,
      'status', p.status,
      'deleted_at', p.deleted_at
    ),
    'accesses', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', a.id,
          'church_id', a.church_id,
          'role', a.role,
          'access_scope', a.access_scope,
          'status', a.status,
          'region_id', a.region_id,
          'congregation_id', a.congregation_id,
          'ministry_id', a.ministry_id,
          'church', jsonb_build_object(
            'id', a.church_id,
            'name', a.church_name,
            'logo_url', a.church_logo_url
          )
        )
        order by a.accepted_at asc nulls last, a.id
      )
      from active_accesses a
    ), '[]'::jsonb),
    'selected_access_id', (select s.id from selected_access s),
    'permissions', coalesce((
      select jsonb_agg(permission.permission_key order by permission.permission_key)
      from selected_access s
      cross join lateral public.get_my_permissions(s.church_id) permission
    ), '[]'::jsonb)
  )
  from my_profile p;
$$;

revoke all on function public.get_my_access_context(uuid) from public;
revoke all on function public.get_my_access_context(uuid) from anon;
grant execute on function public.get_my_access_context(uuid) to authenticated;

comment on function public.get_my_access_context(uuid) is
  'Contexto autenticado consolidado por requisição. Respeita RLS e não deve ser armazenado em cache global.';
