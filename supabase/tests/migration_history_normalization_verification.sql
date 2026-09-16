-- Verifica que o baseline histórico não deixa compatibilidade temporária no
-- schema final e que os RPCs divergentes permanecem alinhados ao ambiente
-- online. O script é somente leitura.
do $$
declare
  v_definition text;
  v_config text[];
begin
  select pg_get_functiondef(procedure.oid)
  into v_definition
  from pg_proc procedure
  join pg_namespace namespace on namespace.oid = procedure.pronamespace
  where namespace.nspname = 'public'
    and procedure.proname = 'create_church_invitation'
    and pg_get_function_identity_arguments(procedure.oid) =
      'p_church_id uuid, p_name text, p_email text, p_role text, p_scope text, p_region_id uuid, p_congregation_id uuid, p_ministry_id uuid, p_notes text, p_permission_overrides jsonb';

  if v_definition is null
    or position('extensions.gen_random_bytes' in v_definition) = 0
    or position('extensions.digest' in v_definition) = 0
    or position('SET search_path TO ''''' in v_definition) = 0 then
    raise exception 'create_church_invitation não qualifica as funções de pgcrypto';
  end if;

  select pg_get_functiondef(procedure.oid)
  into v_definition
  from pg_proc procedure
  join pg_namespace namespace on namespace.oid = procedure.pronamespace
  where namespace.nspname = 'public'
    and procedure.proname = 'renew_church_invitation'
    and pg_get_function_identity_arguments(procedure.oid) = 'p_invitation_id uuid';

  if v_definition is null
    or position('extensions.gen_random_bytes' in v_definition) = 0
    or position('extensions.digest' in v_definition) = 0
    or position('SET search_path TO ''''' in v_definition) = 0 then
    raise exception 'renew_church_invitation não qualifica as funções de pgcrypto';
  end if;

  foreach v_definition in array array[
    'create_church_invitation(uuid,text,text,text,text,uuid,uuid,uuid,text,jsonb)',
    'renew_church_invitation(uuid)',
    'register_event_checkin(uuid,uuid,text,text,text,text)',
    'reissue_event_registration_qr(uuid)'
  ] loop
    select procedure.proconfig
    into v_config
    from pg_proc procedure
    where procedure.oid = to_regprocedure('public.' || v_definition);

    if v_config is distinct from array['search_path=""']::text[] then
      raise exception 'search_path divergente em public.%: %', v_definition, v_config;
    end if;
  end loop;

  if to_regprocedure('public.digest(text,text)') is not null then
    raise exception 'Wrapper temporário public.digest(text,text) permanece no schema';
  end if;

  if to_regprocedure('public.gen_random_bytes(integer)') is not null then
    raise exception 'Wrapper temporário public.gen_random_bytes(integer) permanece no schema';
  end if;
end $$;

select 'migration_history_normalization_verification_ok' as result;
