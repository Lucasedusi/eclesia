begin;

do $$
declare
  v_policy_definition text;
begin
  if to_regclass('public.member_credential_tokens') is null then
    raise exception 'member_credential_tokens table is missing';
  end if;

  if not exists (
    select 1
    from pg_class table_class
    join pg_namespace table_namespace on table_namespace.oid = table_class.relnamespace
    where table_namespace.nspname = 'public'
      and table_class.relname = 'member_credential_tokens'
      and table_class.relrowsecurity
  ) then
    raise exception 'member_credential_tokens must have RLS enabled';
  end if;

  if has_table_privilege('anon', 'public.member_credential_tokens', 'select')
    or has_table_privilege('anon', 'public.member_credential_tokens', 'insert')
    or has_table_privilege('anon', 'public.member_credential_tokens', 'update')
    or has_table_privilege('anon', 'public.member_credential_tokens', 'delete') then
    raise exception 'anon must not have privileges on member credential tokens';
  end if;

  if has_table_privilege('authenticated', 'public.member_credential_tokens', 'select')
    or has_table_privilege('authenticated', 'public.member_credential_tokens', 'insert')
    or has_table_privilege('authenticated', 'public.member_credential_tokens', 'update')
    or has_table_privilege('authenticated', 'public.member_credential_tokens', 'delete') then
    raise exception 'authenticated must not access member credential tokens directly';
  end if;

  if not exists (
    select 1
    from pg_constraint constraint_row
    where constraint_row.conrelid = 'public.member_credential_tokens'::regclass
      and constraint_row.contype = 'f'
      and pg_get_constraintdef(constraint_row.oid) like
        'FOREIGN KEY (church_id, member_id) REFERENCES members(church_id, id)%'
  ) then
    raise exception 'member credential token must have a tenant-safe member foreign key';
  end if;

  if not exists (
    select 1
    from pg_indexes
    where schemaname = 'public'
      and tablename = 'member_credential_tokens'
      and indexdef like '%UNIQUE%token_hash%'
  ) then
    raise exception 'token hash unique index is missing';
  end if;

  if not exists (
    select 1
    from pg_indexes
    where schemaname = 'public'
      and tablename = 'member_credential_tokens'
      and indexdef like '%UNIQUE%church_id%member_id%'
      and indexdef like '%status%ACTIVE%'
  ) then
    raise exception 'one-active-credential-per-member index is missing';
  end if;

  select pg_get_expr(policy.polqual, policy.polrelid)
  into v_policy_definition
  from pg_policy policy
  where policy.polrelid = 'public.member_sensitive_identity'::regclass
    and policy.polname = 'member_sensitive_select';

  if v_policy_definition is null
    or v_policy_definition not like '%members.credentials.issue%'
    or v_policy_definition not like '%can_access_member%' then
    raise exception 'credential issuance must read CPF only through the scoped sensitive policy';
  end if;

  if has_function_privilege(
    'anon',
    'public.activate_member_credential_token(uuid,uuid,text,uuid,timestamptz)',
    'execute'
  ) or has_function_privilege(
    'authenticated',
    'public.activate_member_credential_token(uuid,uuid,text,uuid,timestamptz)',
    'execute'
  ) then
    raise exception 'credential activation must remain server-only';
  end if;

  if not has_function_privilege(
    'service_role',
    'public.activate_member_credential_token(uuid,uuid,text,uuid,timestamptz)',
    'execute'
  ) or not has_function_privilege(
    'service_role',
    'public.revoke_member_credential_token(uuid,uuid,uuid,timestamptz)',
    'execute'
  ) then
    raise exception 'service role must be able to activate and revoke credentials';
  end if;
end;
$$;

rollback;
