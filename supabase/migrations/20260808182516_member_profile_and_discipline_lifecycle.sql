-- EKLESIA — correção do perfil e ciclo de vida explícito da disciplina.

begin;

-- Restaura a proteção por coluna que pode se perder em clonagens do projeto.
-- A RLS continua limitando o UPDATE ao próprio perfil.
revoke update on public.profiles from authenticated;
grant update (
  full_name,
  display_name,
  phone,
  whatsapp,
  avatar_url,
  locale,
  timezone,
  last_seen_at
) on public.profiles to authenticated;

drop policy if exists profiles_update_self on public.profiles;
create policy profiles_update_self
on public.profiles for update to authenticated
using (
  id = (select auth.uid())
  and deleted_at is null
)
with check (
  id = (select auth.uid())
  and deleted_at is null
);

-- O encerramento de disciplina possui identidade própria no histórico.
alter table public.member_history
  drop constraint if exists member_history_type_check;
alter table public.member_history
  add constraint member_history_type_check
  check (history_type in (
    'MEMBER_CREATED',
    'MEMBER_RECEIVED',
    'CONGREGATION_CHANGE',
    'ROLE_ASSIGNED',
    'ROLE_CHANGED',
    'ROLE_ENDED',
    'STATUS_CHANGE',
    'MEMBER_INACTIVATED',
    'MEMBER_REACTIVATED',
    'MEMBER_TRANSFERRED',
    'MEMBER_DISCIPLINED',
    'MEMBER_DISCIPLINE_ENDED',
    'MEMBER_DECEASED',
    'BAPTISM_UPDATED',
    'GENERAL_NOTE',
    'PASTORAL_NOTE'
  ));

create or replace function public.change_member_lifecycle_v2(
  p_member_id uuid,
  p_action text,
  p_event_date date default current_date,
  p_reason text default null,
  p_target_congregation_id uuid default null,
  p_destination_church text default null,
  p_end_roles boolean default true,
  p_sensitive boolean default false,
  p_expected_end_date date default null,
  p_reactivate_role boolean default true
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_member public.members%rowtype;
  v_action text := pg_catalog.upper(pg_catalog.btrim(p_action));
  v_suspended_role_id uuid;
  v_discipline_history_id uuid;
  v_discipline_event_date date;
  v_role_reactivated boolean := false;
  v_role_ended boolean := false;
  v_has_active_role boolean := false;
begin
  if v_actor is null then
    raise exception 'AUTH_REQUIRED';
  end if;
  if p_event_date is null or p_event_date > current_date then
    raise exception 'MEMBER_EVENT_DATE_INVALID';
  end if;

  select *
  into v_member
  from public.members member
  where member.id = p_member_id
  for update;

  if v_member.id is null then
    raise exception 'MEMBER_NOT_FOUND';
  end if;

  if not public.can_access_member(
    v_member.church_id,
    v_member.id,
    v_member.congregation_id
  ) then
    raise exception 'MEMBER_PERMISSION_DENIED';
  end if;

  -- Arquivar e restaurar não modificam a situação e permanecem compatíveis.
  if v_action in ('ARCHIVE', 'RESTORE') then
    return public.change_member_lifecycle(
      p_member_id,
      v_action,
      p_event_date,
      p_reason,
      p_target_congregation_id,
      p_destination_church,
      p_end_roles,
      p_sensitive
    );
  end if;

  if v_member.deleted_at is not null then
    raise exception 'MEMBER_NOT_FOUND';
  end if;

  if v_member.member_status in ('TRANSFERRED', 'DECEASED') then
    raise exception 'MEMBER_STATUS_FINAL';
  end if;

  if v_action = 'INACTIVATE' and v_member.member_status <> 'ACTIVE' then
    raise exception 'MEMBER_STATUS_TRANSITION_INVALID';
  elsif v_action = 'REACTIVATE' and v_member.member_status <> 'INACTIVE' then
    raise exception 'MEMBER_STATUS_TRANSITION_INVALID';
  elsif v_action in ('MOVE_CONGREGATION', 'TRANSFER', 'DECEASED')
    and v_member.member_status <> 'ACTIVE' then
    raise exception 'MEMBER_STATUS_TRANSITION_INVALID';
  elsif v_action = 'DISCIPLINE' and v_member.member_status <> 'ACTIVE' then
    raise exception 'MEMBER_STATUS_TRANSITION_INVALID';
  elsif v_action = 'END_DISCIPLINE'
    and v_member.member_status <> 'DISCIPLINED' then
    raise exception 'MEMBER_STATUS_TRANSITION_INVALID';
  end if;

  if v_action = 'DISCIPLINE' then
    if not public.has_permission(v_member.church_id, 'members.change_status')
      or not public.has_permission(
        v_member.church_id,
        'member_history.view_sensitive'
      ) then
      raise exception 'MEMBER_PERMISSION_DENIED';
    end if;
    if nullif(pg_catalog.btrim(p_reason), '') is null then
      raise exception 'MEMBER_REASON_REQUIRED';
    end if;
    if p_expected_end_date is not null
      and p_expected_end_date < p_event_date then
      raise exception 'MEMBER_EXPECTED_END_DATE_INVALID';
    end if;

    if p_end_roles then
      select link.id
      into v_suspended_role_id
      from public.member_roles link
      where link.church_id = v_member.church_id
        and link.member_id = p_member_id
        and link.status = 'ACTIVE'
        and link.deleted_at is null
      order by link.created_at desc, link.id desc
      limit 1
      for update;

      if v_suspended_role_id is not null then
        update public.member_roles
        set
          status = 'SUSPENDED',
          is_primary = false,
          updated_at = now()
        where id = v_suspended_role_id;
      end if;
    end if;

    update public.members
    set member_status = 'DISCIPLINED'
    where id = p_member_id;

    insert into public.member_history (
      church_id,
      member_id,
      congregation_id,
      history_type,
      title,
      description,
      old_value,
      new_value,
      event_date,
      is_sensitive,
      created_by,
      metadata
    ) values (
      v_member.church_id,
      p_member_id,
      v_member.congregation_id,
      'MEMBER_DISCIPLINED',
      'Situação disciplinar registrada',
      pg_catalog.btrim(p_reason),
      v_member.member_status,
      'DISCIPLINED',
      p_event_date,
      true,
      v_actor,
      pg_catalog.jsonb_strip_nulls(
        pg_catalog.jsonb_build_object(
          'roles_suspended', v_suspended_role_id is not null,
          'suspended_role_link_id', v_suspended_role_id,
          'expected_end_date', p_expected_end_date
        )
      )
    )
    returning id into v_discipline_history_id;

    return pg_catalog.jsonb_build_object(
      'status', 'DISCIPLINED',
      'archived', false,
      'discipline_history_id', v_discipline_history_id,
      'role_suspended', v_suspended_role_id is not null,
      'expected_end_date', p_expected_end_date
    );
  end if;

  if v_action = 'END_DISCIPLINE' then
    if not public.has_permission(v_member.church_id, 'members.change_status')
      or not public.has_permission(
        v_member.church_id,
        'member_history.view_sensitive'
      ) then
      raise exception 'MEMBER_PERMISSION_DENIED';
    end if;

    select history.id, history.event_date,
      public.safe_uuid(history.metadata ->> 'suspended_role_link_id')
    into v_discipline_history_id, v_discipline_event_date, v_suspended_role_id
    from public.member_history history
    where history.church_id = v_member.church_id
      and history.member_id = p_member_id
      and history.history_type = 'MEMBER_DISCIPLINED'
      and history.deleted_at is null
    order by history.event_date desc, history.created_at desc, history.id desc
    limit 1;

    if v_discipline_event_date is not null
      and p_event_date < v_discipline_event_date then
      raise exception 'MEMBER_DISCIPLINE_END_DATE_INVALID';
    end if;

    if v_suspended_role_id is not null then
      select link.id
      into v_suspended_role_id
      from public.member_roles link
      where link.id = v_suspended_role_id
        and link.church_id = v_member.church_id
        and link.member_id = p_member_id
        and link.status = 'SUSPENDED'
        and link.deleted_at is null
      for update;
    end if;

    -- Compatibilidade com disciplinas registradas antes desta migração.
    if v_suspended_role_id is null then
      select link.id
      into v_suspended_role_id
      from public.member_roles link
      where link.church_id = v_member.church_id
        and link.member_id = p_member_id
        and link.status = 'SUSPENDED'
        and link.deleted_at is null
      order by link.updated_at desc, link.created_at desc, link.id desc
      limit 1
      for update;
    end if;

    select exists (
      select 1
      from public.member_roles link
      where link.church_id = v_member.church_id
        and link.member_id = p_member_id
        and link.status = 'ACTIVE'
        and link.deleted_at is null
    ) into v_has_active_role;

    if v_suspended_role_id is not null then
      if p_reactivate_role and not v_has_active_role then
        update public.member_roles
        set
          status = 'ACTIVE',
          end_date = null,
          is_primary = true,
          updated_at = now()
        where id = v_suspended_role_id;
        v_role_reactivated := true;
      else
        update public.member_roles
        set
          status = 'ENDED',
          end_date = greatest(
            p_event_date,
            coalesce(start_date, p_event_date)
          ),
          is_primary = false,
          updated_at = now()
        where id = v_suspended_role_id;
        v_role_ended := true;
      end if;
    end if;

    update public.members
    set
      member_status = 'ACTIVE',
      inactive_reason = null
    where id = p_member_id;

    insert into public.member_history (
      church_id,
      member_id,
      congregation_id,
      history_type,
      title,
      description,
      old_value,
      new_value,
      event_date,
      is_sensitive,
      created_by,
      metadata
    ) values (
      v_member.church_id,
      p_member_id,
      v_member.congregation_id,
      'MEMBER_DISCIPLINE_ENDED',
      'Disciplina encerrada',
      nullif(pg_catalog.btrim(p_reason), ''),
      'DISCIPLINED',
      'ACTIVE',
      p_event_date,
      true,
      v_actor,
      pg_catalog.jsonb_strip_nulls(
        pg_catalog.jsonb_build_object(
          'discipline_history_id', v_discipline_history_id,
          'suspended_role_link_id', v_suspended_role_id,
          'role_reactivated', v_role_reactivated,
          'role_ended', v_role_ended,
          'active_role_prevented_reactivation', v_has_active_role
        )
      )
    );

    return pg_catalog.jsonb_build_object(
      'status', 'ACTIVE',
      'archived', false,
      'role_reactivated', v_role_reactivated,
      'role_ended', v_role_ended
    );
  end if;

  return public.change_member_lifecycle(
    p_member_id,
    v_action,
    p_event_date,
    p_reason,
    p_target_congregation_id,
    p_destination_church,
    p_end_roles,
    p_sensitive
  );
end;
$$;

revoke all on function public.change_member_lifecycle_v2(
  uuid, text, date, text, uuid, text, boolean, boolean, date, boolean
) from public, anon;
grant execute on function public.change_member_lifecycle_v2(
  uuid, text, date, text, uuid, text, boolean, boolean, date, boolean
) to authenticated, service_role;

comment on function public.change_member_lifecycle_v2(
  uuid, text, date, text, uuid, text, boolean, boolean, date, boolean
) is 'Executa transições válidas do membro e controla disciplina/Cargo atomicamente.';

commit;
