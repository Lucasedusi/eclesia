create or replace function public.complete_church_onboarding(p_payload jsonb)
returns uuid
language plpgsql security definer set search_path = public, auth as $$
declare
  v_user auth.users%rowtype;
  v_church_id uuid;
  v_congregation_id uuid;
  v_name text := nullif(btrim(p_payload->>'church_name'), '');
  v_headquarters_name text := nullif(btrim(p_payload->>'headquarters_name'), '');
begin
  select * into v_user from auth.users where id = auth.uid();
  if v_user.id is null then raise exception 'Sessão inválida'; end if;
  if v_name is null or v_headquarters_name is null then raise exception 'Igreja e Congregação Sede são obrigatórias'; end if;
  if exists(
    select 1
    from public.user_church_access
    where profile_id = auth.uid()
      and status = 'ACTIVE'
      and deleted_at is null
  ) then
    raise exception 'Este usuário já possui acesso ativo a uma igreja';
  end if;

  perform pg_advisory_xact_lock(182529, 20260801);

  if exists(select 1 from public.churches) then
    raise exception 'O cadastro inicial já foi concluído';
  end if;

  insert into public.churches(
    name, legal_name, document, email, phone, whatsapp, zip_code, address,
    number, complement, district, city, state, country, senior_pastor_name,
    senior_pastor_spouse_name, status
  ) values (
    v_name, nullif(btrim(p_payload->>'legal_name'), ''), nullif(btrim(p_payload->>'document'), ''),
    nullif(btrim(p_payload->>'church_email'), ''), nullif(btrim(p_payload->>'phone'), ''),
    nullif(btrim(p_payload->>'whatsapp'), ''), nullif(btrim(p_payload->>'zip_code'), ''),
    nullif(btrim(p_payload->>'address'), ''), nullif(btrim(p_payload->>'number'), ''),
    nullif(btrim(p_payload->>'complement'), ''), nullif(btrim(p_payload->>'district'), ''),
    nullif(btrim(p_payload->>'city'), ''), nullif(upper(btrim(p_payload->>'state')), ''),
    coalesce(nullif(btrim(p_payload->>'country'), ''), 'Brasil'),
    nullif(btrim(p_payload->>'senior_pastor_name'), ''),
    nullif(btrim(p_payload->>'senior_pastor_spouse_name'), ''), 'ACTIVE'
  ) returning id into v_church_id;

  insert into public.congregations(
    church_id, name, code, pastor_name, pastor_spouse_name, phone, whatsapp, email,
    zip_code, address, number, complement, district, city, state, country,
    is_headquarters, status
  ) values (
    v_church_id, v_headquarters_name, coalesce(nullif(upper(btrim(p_payload->>'headquarters_code')), ''), 'SEDE'),
    coalesce(nullif(btrim(p_payload->>'headquarters_pastor_name'), ''), nullif(btrim(p_payload->>'senior_pastor_name'), '')),
    nullif(btrim(p_payload->>'headquarters_pastor_spouse_name'), ''),
    nullif(btrim(p_payload->>'phone'), ''), nullif(btrim(p_payload->>'whatsapp'), ''),
    nullif(btrim(p_payload->>'church_email'), ''), nullif(btrim(p_payload->>'zip_code'), ''),
    nullif(btrim(p_payload->>'address'), ''), nullif(btrim(p_payload->>'number'), ''),
    nullif(btrim(p_payload->>'complement'), ''), nullif(btrim(p_payload->>'district'), ''),
    nullif(btrim(p_payload->>'city'), ''), nullif(upper(btrim(p_payload->>'state')), ''),
    coalesce(nullif(btrim(p_payload->>'country'), ''), 'Brasil'), true, 'ACTIVE'
  ) returning id into v_congregation_id;

  insert into public.app_settings(
    church_id, app_name, display_church_name, primary_color, member_code_prefix,
    member_code_next_number, member_code_padding, enable_member_auto_code,
    default_country, default_state, default_city, status
  ) values (
    v_church_id, coalesce(nullif(btrim(p_payload->>'app_name'), ''), 'Eclesias'),
    coalesce(nullif(btrim(p_payload->>'display_church_name'), ''), v_name), '#415BA5',
    coalesce(nullif(upper(regexp_replace(p_payload->>'member_code_prefix', '[^A-Za-z0-9]', '', 'g')), ''), 'MEM'),
    greatest(coalesce((p_payload->>'member_code_next_number')::integer, 1), 1),
    least(greatest(coalesce((p_payload->>'member_code_padding')::integer, 4), 1), 10),
    true, coalesce(nullif(btrim(p_payload->>'country'), ''), 'Brasil'),
    nullif(upper(btrim(p_payload->>'state')), ''), nullif(btrim(p_payload->>'city'), ''), 'ACTIVE'
  );

  insert into public.profiles(id, full_name, display_name, email, status, accepted_terms_at)
  values(
    v_user.id,
    coalesce(nullif(btrim(v_user.raw_user_meta_data->>'full_name'), ''), split_part(v_user.email, '@', 1)),
    coalesce(nullif(split_part(btrim(v_user.raw_user_meta_data->>'full_name'), ' ', 1), ''), split_part(v_user.email, '@', 1)),
    lower(v_user.email), 'ACTIVE', now()
  ) on conflict(id) do update set status = 'ACTIVE', email = excluded.email,
    accepted_terms_at = coalesce(profiles.accepted_terms_at, now()), updated_at = now();

  insert into public.user_church_access(
    profile_id, church_id, role, access_scope, status, accepted_at
  ) values (v_user.id, v_church_id, 'ADMIN', 'CHURCH', 'ACTIVE', now());

  perform public.log_audit(v_church_id, 'auth', 'ONBOARDING_COMPLETED', 'church',
    v_church_id, v_name, 'Igreja, Congregação Sede e primeiro Administrador criados.',
    null, jsonb_build_object('headquarters_id', v_congregation_id), null, 'INFO');
  return v_church_id;
end;
$$;
