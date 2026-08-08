begin;

-- A migração entre projetos não preserva triggers do schema auth. Restaura a
-- criação automática do perfil sempre que um usuário é criado no Supabase Auth.
create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (
    id,
    full_name,
    display_name,
    email,
    status,
    accepted_terms_at
  ) values (
    new.id,
    nullif(btrim(new.raw_user_meta_data ->> 'full_name'), ''),
    nullif(split_part(btrim(new.raw_user_meta_data ->> 'full_name'), ' ', 1), ''),
    lower(new.email),
    case when new.email_confirmed_at is null then 'PENDING' else 'ACTIVE' end,
    case
      when lower(coalesce(new.raw_user_meta_data ->> 'accepted_terms', 'false')) = 'true'
        then now()
      else null
    end
  )
  on conflict (id) do update set
    full_name = coalesce(excluded.full_name, profiles.full_name),
    display_name = coalesce(excluded.display_name, profiles.display_name),
    email = excluded.email,
    updated_at = now();

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_auth_user();

-- A aceitação também garante o perfil na mesma transação. Assim o fluxo não
-- depende apenas do trigger e não pode criar um acesso órfão.
create or replace function public.accept_church_invitation(p_token text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_inv public.church_invitations%rowtype;
  v_user auth.users%rowtype;
  v_email text;
  v_access_id uuid;
begin
  select * into v_user
  from auth.users
  where id = auth.uid();

  v_email := lower(v_user.email);
  if v_user.id is null or v_email is null then
    raise exception 'Sessão inválida';
  end if;

  select * into v_inv
  from public.church_invitations
  where token_hash = encode(extensions.digest(p_token, 'sha256'), 'hex')
    and status = 'PENDING'
    and expires_at > now()
    and deleted_at is null
  for update;

  if v_inv.id is null then
    raise exception 'Convite inválido ou expirado';
  end if;
  if v_inv.email_normalized <> v_email then
    raise exception 'O convite pertence a outro e-mail';
  end if;
  if exists (
    select 1
    from public.profiles
    where id = auth.uid()
      and (deleted_at is not null or status in ('INACTIVE', 'BLOCKED'))
  ) then
    raise exception 'Perfil indisponível para aceitar convites';
  end if;

  insert into public.profiles (
    id,
    full_name,
    display_name,
    email,
    status
  ) values (
    v_user.id,
    coalesce(
      nullif(btrim(v_user.raw_user_meta_data ->> 'full_name'), ''),
      v_inv.invited_name
    ),
    coalesce(
      nullif(split_part(btrim(v_user.raw_user_meta_data ->> 'full_name'), ' ', 1), ''),
      nullif(split_part(btrim(v_inv.invited_name), ' ', 1), ''),
      split_part(v_email, '@', 1)
    ),
    v_email,
    'ACTIVE'
  )
  on conflict (id) do update set
    full_name = coalesce(profiles.full_name, excluded.full_name),
    display_name = coalesce(profiles.display_name, excluded.display_name),
    email = excluded.email,
    status = 'ACTIVE',
    updated_at = now();

  select id into v_access_id
  from public.user_church_access a
  where a.profile_id = auth.uid()
    and a.church_id = v_inv.church_id
    and a.access_scope = v_inv.access_scope
    and coalesce(a.region_id, '00000000-0000-0000-0000-000000000000'::uuid)
      = coalesce(v_inv.region_id, '00000000-0000-0000-0000-000000000000'::uuid)
    and coalesce(a.congregation_id, '00000000-0000-0000-0000-000000000000'::uuid)
      = coalesce(v_inv.congregation_id, '00000000-0000-0000-0000-000000000000'::uuid)
    and coalesce(a.ministry_id, '00000000-0000-0000-0000-000000000000'::uuid)
      = coalesce(v_inv.ministry_id, '00000000-0000-0000-0000-000000000000'::uuid)
    and a.deleted_at is null
  limit 1;

  if v_access_id is null then
    insert into public.user_church_access (
      profile_id,
      church_id,
      region_id,
      congregation_id,
      ministry_id,
      role,
      access_scope,
      status,
      invited_by,
      invited_at,
      accepted_at,
      notes
    ) values (
      auth.uid(),
      v_inv.church_id,
      v_inv.region_id,
      v_inv.congregation_id,
      v_inv.ministry_id,
      v_inv.role,
      v_inv.access_scope,
      'ACTIVE',
      v_inv.invited_by,
      v_inv.invited_at,
      now(),
      v_inv.notes
    )
    returning id into v_access_id;
  else
    update public.user_church_access
    set role = v_inv.role,
        status = 'ACTIVE',
        invited_by = v_inv.invited_by,
        invited_at = v_inv.invited_at,
        accepted_at = now(),
        notes = v_inv.notes
    where id = v_access_id;
  end if;

  insert into public.user_permission_overrides (
    access_id,
    permission_id,
    effect,
    created_by
  )
  select v_access_id,
         p.id,
         upper(item ->> 'effect'),
         v_inv.invited_by
  from jsonb_array_elements(v_inv.permission_overrides) item
  join public.permissions p
    on p.key = item ->> 'permission'
   and p.status = 'ACTIVE'
   and p.deleted_at is null
  where upper(item ->> 'effect') in ('ALLOW', 'DENY')
  on conflict do nothing;

  update public.church_invitations
  set status = 'ACCEPTED',
      accepted_at = now(),
      accepted_by = auth.uid(),
      access_id = v_access_id
  where id = v_inv.id;

  perform public.log_audit(
    v_inv.church_id,
    'users',
    'INVITATION_ACCEPTED',
    'user_church_access',
    v_access_id,
    v_email,
    'Convite aceito e acesso ativado.',
    null,
    jsonb_build_object('role', v_inv.role, 'scope', v_inv.access_scope),
    null,
    'INFO'
  );

  return v_inv.church_id;
end;
$$;

revoke all on function public.handle_new_auth_user() from public;
revoke all on function public.accept_church_invitation(text) from public;
grant execute on function public.accept_church_invitation(text) to authenticated;

commit;
