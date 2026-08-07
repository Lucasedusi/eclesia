-- Regra e fluxo canônicos de Cargo dos membros:
-- somente um Cargo ativo por membro, com preservação integral do histórico.

with ranked_active_roles as (
  select
    link.id,
    pg_catalog.row_number() over (
      partition by link.church_id, link.member_id
      order by
        link.is_primary desc,
        link.start_date desc nulls last,
        link.created_at desc,
        link.id desc
    ) as position
  from public.member_roles link
  where link.status = 'ACTIVE'
    and link.deleted_at is null
), closed_roles as (
  update public.member_roles link
  set
    status = 'ENDED',
    end_date = coalesce(link.end_date, current_date),
    is_primary = false,
    notes = case
      when nullif(pg_catalog.btrim(link.notes), '') is null
        then 'Vínculo encerrado na adequação para um único Cargo ativo.'
      else link.notes || E'\nVínculo encerrado na adequação para um único Cargo ativo.'
    end,
    updated_at = now()
  from ranked_active_roles ranked
  where link.id = ranked.id
    and ranked.position > 1
  returning link.*
)
insert into public.member_history (
  church_id,
  member_id,
  congregation_id,
  history_type,
  title,
  description,
  old_value,
  event_date,
  is_sensitive,
  metadata
)
select
  closed.church_id,
  closed.member_id,
  closed.congregation_id,
  'ROLE_ENDED',
  'Cargo anterior encerrado',
  'Vínculo encerrado durante a adequação para um único Cargo ativo por membro.',
  role.name,
  coalesce(closed.end_date, current_date),
  false,
  pg_catalog.jsonb_build_object(
    'role_id', closed.role_id,
    'link_id', closed.id,
    'reason', 'single_active_role_migration'
  )
from closed_roles closed
join public.roles role
  on role.id = closed.role_id
 and role.church_id = closed.church_id;

update public.member_roles
set is_primary = true,
    updated_at = now()
where status = 'ACTIVE'
  and deleted_at is null
  and is_primary = false;

create unique index if not exists member_roles_one_active_per_member_idx
  on public.member_roles (church_id, member_id)
  where status = 'ACTIVE' and deleted_at is null;

create or replace function public.manage_member_role(
  p_member_id uuid,
  p_operation text,
  p_role_id uuid default null,
  p_link_id uuid default null,
  p_start_date date default null,
  p_end_date date default null,
  p_notes text default null,
  p_is_primary boolean default false
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_member public.members%rowtype;
  v_current public.member_roles%rowtype;
  v_result uuid;
  v_operation text := pg_catalog.upper(pg_catalog.btrim(p_operation));
  v_event_date date := coalesce(p_start_date, current_date);
  v_old_role_name text;
  v_new_role_name text;
begin
  if v_actor is null then
    raise exception 'AUTH_REQUIRED';
  end if;

  select *
  into v_member
  from public.members member
  where member.id = p_member_id
    and member.deleted_at is null
  for update;

  if v_member.id is null then
    raise exception 'MEMBER_NOT_FOUND';
  end if;

  if not public.has_permission(v_member.church_id, 'member_roles.manage')
    or not public.can_access_member(
      v_member.church_id,
      v_member.id,
      v_member.congregation_id
    ) then
    raise exception 'MEMBER_ROLE_PERMISSION_DENIED';
  end if;

  if v_operation <> 'SET' then
    raise exception 'MEMBER_ROLE_OPERATION_INVALID';
  end if;

  if p_start_date is not null and p_start_date > current_date then
    raise exception 'MEMBER_ROLE_DATE_INVALID';
  end if;

  if p_role_id is not null then
    select
      case
        when v_member.gender = 'FEMALE'
          then coalesce(role.female_name, role.name)
        else role.name
      end
    into v_new_role_name
    from public.roles role
    where role.id = p_role_id
      and role.church_id = v_member.church_id
      and role.status = 'ACTIVE'
      and role.deleted_at is null;

    if v_new_role_name is null then
      raise exception 'MEMBER_ROLE_INVALID';
    end if;
  end if;

  select *
  into v_current
  from public.member_roles link
  where link.church_id = v_member.church_id
    and link.member_id = p_member_id
    and link.status = 'ACTIVE'
    and link.deleted_at is null
  for update;

  if v_current.id is not null then
    select
      case
        when v_member.gender = 'FEMALE'
          then coalesce(role.female_name, role.name)
        else role.name
      end
    into v_old_role_name
    from public.roles role
    where role.id = v_current.role_id
      and role.church_id = v_member.church_id;
  end if;

  if v_current.id is not null and v_current.role_id = p_role_id then
    update public.member_roles
    set
      start_date = p_start_date,
      notes = nullif(pg_catalog.btrim(p_notes), ''),
      is_primary = true,
      updated_at = now()
    where id = v_current.id;
    return v_current.id;
  end if;

  if v_current.id is not null then
    update public.member_roles
    set
      status = 'ENDED',
      end_date = greatest(
        v_event_date,
        coalesce(v_current.start_date, v_event_date)
      ),
      is_primary = false,
      updated_at = now()
    where id = v_current.id;
    v_result := v_current.id;
  end if;

  if p_role_id is not null then
    insert into public.member_roles (
      church_id,
      member_id,
      role_id,
      congregation_id,
      is_primary,
      status,
      start_date,
      notes,
      created_by
    ) values (
      v_member.church_id,
      p_member_id,
      p_role_id,
      v_member.congregation_id,
      true,
      'ACTIVE',
      p_start_date,
      nullif(pg_catalog.btrim(p_notes), ''),
      v_actor
    )
    returning id into v_result;
  end if;

  if v_current.id is not null or p_role_id is not null then
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
      'ROLE_CHANGED',
      'Cargo alterado',
      case
        when v_current.id is null then 'O Cargo do membro foi definido.'
        when p_role_id is null then 'O Cargo atual do membro foi encerrado.'
        else 'O Cargo do membro foi atualizado.'
      end,
      v_old_role_name,
      v_new_role_name,
      v_event_date,
      false,
      v_actor,
      pg_catalog.jsonb_strip_nulls(
        pg_catalog.jsonb_build_object(
          'old_role_id', v_current.role_id,
          'new_role_id', p_role_id,
          'old_link_id', v_current.id,
          'new_link_id', case when p_role_id is not null then v_result else null end
        )
      )
    );
  end if;

  return coalesce(v_result, p_member_id);
end;
$$;

revoke all on function public.manage_member_role(
  uuid, text, uuid, uuid, date, date, text, boolean
) from public, anon;
grant execute on function public.manage_member_role(
  uuid, text, uuid, uuid, date, date, text, boolean
) to authenticated, service_role;

create or replace function public.normalize_member_role_history_language()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.history_type in ('ROLE_ASSIGNED', 'ROLE_CHANGED', 'ROLE_ENDED') then
    new.title := pg_catalog.replace(new.title, 'Cargo principal', 'Cargo');
    new.description := pg_catalog.replace(
      new.description,
      'Cargo principal',
      'Cargo'
    );
  end if;
  return new;
end;
$$;

revoke all on function public.normalize_member_role_history_language()
  from public, anon, authenticated;

drop trigger if exists normalize_member_role_history_language_values
  on public.member_history;
create trigger normalize_member_role_history_language_values
before insert or update of history_type, title, description
on public.member_history
for each row execute function public.normalize_member_role_history_language();

update public.member_history
set
  title = pg_catalog.replace(title, 'Cargo principal', 'Cargo'),
  description = pg_catalog.replace(description, 'Cargo principal', 'Cargo')
where history_type in ('ROLE_ASSIGNED', 'ROLE_CHANGED', 'ROLE_ENDED')
  and deleted_at is null
  and (
    title like '%Cargo principal%'
    or description like '%Cargo principal%'
  );

notify pgrst, 'reload schema';
