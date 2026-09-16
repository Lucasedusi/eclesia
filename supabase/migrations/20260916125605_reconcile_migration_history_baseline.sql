begin;

-- The historical 202607310001 migration was authored when pgcrypto routines
-- were reachable without schema qualification. Keep the production behavior,
-- but make resolution deterministic and safe for SECURITY DEFINER execution.
create or replace function public.create_church_invitation(
  p_church_id uuid,
  p_name text,
  p_email text,
  p_role text,
  p_scope text,
  p_region_id uuid default null,
  p_congregation_id uuid default null,
  p_ministry_id uuid default null,
  p_notes text default null,
  p_permission_overrides jsonb default '[]'::jsonb
) returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_token text := pg_catalog.encode(extensions.gen_random_bytes(32), 'hex');
  v_invite_id uuid;
begin
  if not public.has_permission(p_church_id, 'users.invite') then
    raise exception 'Acesso negado';
  end if;

  if p_role = 'ADMIN' and not exists (
    select 1
    from public.user_church_access access
    where access.profile_id = auth.uid()
      and access.church_id = p_church_id
      and access.role = 'ADMIN'
      and access.access_scope = 'CHURCH'
      and access.status = 'ACTIVE'
      and access.deleted_at is null
  ) then
    raise exception 'Somente Administradores podem convidar outro Administrador';
  end if;

  insert into public.church_invitations (
    church_id,
    invited_name,
    email,
    email_normalized,
    token_hash,
    role,
    access_scope,
    region_id,
    congregation_id,
    ministry_id,
    permission_overrides,
    invited_by,
    notes
  ) values (
    p_church_id,
    pg_catalog.btrim(p_name),
    pg_catalog.lower(pg_catalog.btrim(p_email)),
    pg_catalog.lower(pg_catalog.btrim(p_email)),
    pg_catalog.encode(extensions.digest(v_token, 'sha256'), 'hex'),
    p_role,
    p_scope,
    p_region_id,
    p_congregation_id,
    p_ministry_id,
    coalesce(p_permission_overrides, '[]'::jsonb),
    auth.uid(),
    nullif(pg_catalog.btrim(p_notes), '')
  )
  returning id into v_invite_id;

  perform public.log_audit(
    p_church_id,
    'users',
    'INVITATION_CREATED',
    'church_invitation',
    v_invite_id,
    pg_catalog.lower(pg_catalog.btrim(p_email)),
    'Convite de acesso criado.',
    null,
    pg_catalog.jsonb_build_object('role', p_role, 'scope', p_scope),
    null,
    'INFO'
  );

  return v_token;
end;
$$;

create or replace function public.renew_church_invitation(p_invitation_id uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_token text := pg_catalog.encode(extensions.gen_random_bytes(32), 'hex');
  v_church_id uuid;
begin
  select invitation.church_id
  into v_church_id
  from public.church_invitations invitation
  where invitation.id = p_invitation_id
    and invitation.deleted_at is null;

  if v_church_id is null
    or not public.has_permission(v_church_id, 'users.invite') then
    raise exception 'Acesso negado';
  end if;

  update public.church_invitations invitation
  set token_hash = pg_catalog.encode(extensions.digest(v_token, 'sha256'), 'hex'),
      status = 'PENDING',
      invited_at = pg_catalog.now(),
      expires_at = pg_catalog.now() + interval '7 days',
      cancelled_at = null,
      accepted_at = null,
      accepted_by = null,
      access_id = null
  where invitation.id = p_invitation_id;

  perform public.log_audit(
    v_church_id,
    'users',
    'INVITATION_RENEWED',
    'church_invitation',
    p_invitation_id,
    null,
    'Convite reenviado.',
    null,
    null,
    null,
    'INFO'
  );

  return v_token;
end;
$$;

-- The linked project already has these hardened search paths. Reproduce them
-- locally after the older migration that set a broader path.
alter function public.register_event_checkin(uuid, uuid, text, text, text, text)
  set search_path = '';

alter function public.reissue_event_registration_qr(uuid)
  set search_path = '';

-- Compatibility wrappers are needed only while the immutable history replays.
drop function public.digest(text, text);
drop function public.gen_random_bytes(integer);

commit;
