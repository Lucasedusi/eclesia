begin;

create table public.member_credential_tokens (
  id uuid primary key default gen_random_uuid(),
  church_id uuid not null references public.churches(id) on delete cascade,
  member_id uuid not null,
  token_hash text not null,
  status text not null default 'PENDING',
  pending_expires_at timestamptz not null,
  issued_at timestamptz,
  revoked_at timestamptz,
  revocation_reason text,
  created_by uuid references public.profiles(id) on delete set null,
  revoked_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint member_credential_tokens_member_same_church_fk
    foreign key (church_id, member_id)
    references public.members(church_id, id)
    on delete cascade,
  constraint member_credential_tokens_hash_chk
    check (token_hash ~ '^[0-9a-f]{64}$'),
  constraint member_credential_tokens_status_chk
    check (status in ('PENDING', 'ACTIVE', 'REVOKED')),
  constraint member_credential_tokens_revocation_reason_chk
    check (revocation_reason is null or revocation_reason in ('MANUAL', 'REISSUED')),
  constraint member_credential_tokens_expiry_chk
    check (pending_expires_at > created_at),
  constraint member_credential_tokens_lifecycle_chk
    check (
      (status = 'PENDING' and issued_at is null and revoked_at is null and revocation_reason is null)
      or (status = 'ACTIVE' and issued_at is not null and revoked_at is null and revocation_reason is null)
      or (status = 'REVOKED' and revoked_at is not null and revocation_reason is not null)
    )
);

create unique index member_credential_tokens_hash_unique_idx
  on public.member_credential_tokens(token_hash);

create unique index member_credential_tokens_one_active_member_idx
  on public.member_credential_tokens(church_id, member_id)
  where status = 'ACTIVE';

create index member_credential_tokens_pending_expiry_idx
  on public.member_credential_tokens(pending_expires_at)
  where status = 'PENDING';

create index member_credential_tokens_member_history_idx
  on public.member_credential_tokens(church_id, member_id, created_at desc);

create trigger set_member_credential_tokens_updated_at
before update on public.member_credential_tokens
for each row execute function public.set_updated_at();

alter table public.member_credential_tokens enable row level security;

revoke all on table public.member_credential_tokens from public, anon, authenticated;
grant select, insert, update on table public.member_credential_tokens to service_role;

comment on table public.member_credential_tokens is
  'Server-only lifecycle for revocable member credential validation tokens. Only SHA-256 hashes are stored.';

create or replace function public.audit_member_credential_token_mutation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor_id uuid;
  v_actor_email text;
begin
  if new.status is not distinct from old.status then
    return new;
  end if;

  v_actor_id := case when new.status = 'ACTIVE' then new.created_by else new.revoked_by end;
  select auth_user.email
  into v_actor_email
  from auth.users auth_user
  where auth_user.id = v_actor_id;

  insert into public.audit_logs (
    church_id,
    actor_profile_id,
    actor_email,
    module,
    action,
    entity_type,
    entity_id,
    entity_label,
    description,
    old_values,
    new_values,
    metadata,
    severity
  ) values (
    new.church_id,
    v_actor_id,
    v_actor_email,
    'MEMBERS',
    case when new.status = 'ACTIVE'
      then 'ISSUE_MEMBER_PHYSICAL_CREDENTIAL'
      else 'REVOKE_MEMBER_PHYSICAL_CREDENTIAL'
    end,
    'MEMBER',
    new.member_id,
    null,
    case when new.status = 'ACTIVE'
      then 'Credencial física de membro emitida'
      else 'Credencial física de membro revogada'
    end,
    null,
    null,
    jsonb_build_object(
      'format', 'pdf',
      'sides', 2,
      'qr_mode', 'PUBLIC_VALIDATION',
      'reason', new.revocation_reason
    ),
    case when new.status = 'ACTIVE' then 'INFO' else 'WARNING' end
  );

  return new;
end;
$$;

revoke all on function public.audit_member_credential_token_mutation()
  from public, anon, authenticated, service_role;

create trigger audit_member_credential_token_status
after update of status on public.member_credential_tokens
for each row execute function public.audit_member_credential_token_mutation();

create or replace function public.activate_member_credential_token(
  p_church_id uuid,
  p_member_id uuid,
  p_token_hash text,
  p_actor_id uuid,
  p_issued_at timestamptz
)
returns boolean
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_target public.member_credential_tokens%rowtype;
begin
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(p_member_id::text, 0)
  );

  select token_row.*
  into v_target
  from public.member_credential_tokens token_row
  where token_row.church_id = p_church_id
    and token_row.member_id = p_member_id
    and token_row.token_hash = p_token_hash
  for update;

  if not found then
    return false;
  end if;

  if v_target.status = 'ACTIVE' then
    return true;
  end if;

  if v_target.status <> 'PENDING'
    or v_target.pending_expires_at <= p_issued_at then
    return false;
  end if;

  update public.member_credential_tokens existing_token
  set
    status = 'REVOKED',
    revoked_at = p_issued_at,
    revoked_by = p_actor_id,
    revocation_reason = 'REISSUED'
  where existing_token.church_id = p_church_id
    and existing_token.member_id = p_member_id
    and existing_token.status = 'ACTIVE';

  update public.member_credential_tokens target_token
  set
    status = 'ACTIVE',
    issued_at = p_issued_at,
    revoked_at = null,
    revoked_by = null,
    revocation_reason = null
  where target_token.id = v_target.id;

  return true;
end;
$$;

revoke all on function public.activate_member_credential_token(uuid, uuid, text, uuid, timestamptz)
  from public, anon, authenticated;
grant execute on function public.activate_member_credential_token(uuid, uuid, text, uuid, timestamptz)
  to service_role;

create or replace function public.revoke_member_credential_token(
  p_church_id uuid,
  p_member_id uuid,
  p_actor_id uuid,
  p_revoked_at timestamptz
)
returns boolean
language plpgsql
security invoker
set search_path = ''
as $$
begin
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(p_member_id::text, 0)
  );

  update public.member_credential_tokens active_token
  set
    status = 'REVOKED',
    revoked_at = p_revoked_at,
    revoked_by = p_actor_id,
    revocation_reason = 'MANUAL'
  where active_token.church_id = p_church_id
    and active_token.member_id = p_member_id
    and active_token.status = 'ACTIVE';

  return found;
end;
$$;

revoke all on function public.revoke_member_credential_token(uuid, uuid, uuid, timestamptz)
  from public, anon, authenticated;
grant execute on function public.revoke_member_credential_token(uuid, uuid, uuid, timestamptz)
  to service_role;

drop policy if exists member_sensitive_select on public.member_sensitive_identity;
create policy member_sensitive_select
on public.member_sensitive_identity for select to authenticated
using (
  deleted_at is null
  and (
    (select public.has_permission(church_id, 'members.view_sensitive_identity'))
    or (select public.has_permission(church_id, 'members.credentials.issue'))
  )
  and exists (
    select 1
    from public.members member
    where member.id = member_id
      and member.church_id = member_sensitive_identity.church_id
      and member.deleted_at is null
      and (select public.can_access_member(
        member.church_id,
        member.id,
        member.congregation_id
      ))
  )
);

commit;
