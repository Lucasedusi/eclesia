-- Refinamentos do módulo de Membros:
-- CPF válido, WhatsApp brasileiro e histórico de Cargos legível.

create or replace function public.is_valid_cpf(p_value text)
returns boolean
language plpgsql
immutable
strict
set search_path = ''
as $$
declare
  v_cpf text := pg_catalog.regexp_replace(p_value, '[^0-9]', '', 'g');
  v_sum integer := 0;
  v_remainder integer;
  v_first_digit integer;
  v_second_digit integer;
  v_index integer;
begin
  if pg_catalog.length(v_cpf) <> 11 or v_cpf ~ '^([0-9])\1{10}$' then
    return false;
  end if;

  for v_index in 1..9 loop
    v_sum := v_sum + pg_catalog.substr(v_cpf, v_index, 1)::integer * (11 - v_index);
  end loop;
  v_remainder := v_sum % 11;
  v_first_digit := case when v_remainder < 2 then 0 else 11 - v_remainder end;

  if v_first_digit <> pg_catalog.substr(v_cpf, 10, 1)::integer then
    return false;
  end if;

  v_sum := 0;
  for v_index in 1..10 loop
    v_sum := v_sum + pg_catalog.substr(v_cpf, v_index, 1)::integer * (12 - v_index);
  end loop;
  v_remainder := v_sum % 11;
  v_second_digit := case when v_remainder < 2 then 0 else 11 - v_remainder end;

  return v_second_digit = pg_catalog.substr(v_cpf, 11, 1)::integer;
end;
$$;

revoke all on function public.is_valid_cpf(text) from public, anon;
grant execute on function public.is_valid_cpf(text) to authenticated, service_role;

update public.member_sensitive_identity
set cpf = nullif(pg_catalog.regexp_replace(coalesce(cpf, ''), '[^0-9]', '', 'g'), '')
where cpf is not null;

do $$
begin
  if not exists (
    select 1
    from pg_catalog.pg_constraint
    where conname = 'member_sensitive_identity_cpf_valid_chk'
      and conrelid = 'public.member_sensitive_identity'::pg_catalog.regclass
  ) then
    alter table public.member_sensitive_identity
      add constraint member_sensitive_identity_cpf_valid_chk
      check (cpf is null or public.is_valid_cpf(cpf)) not valid;
  end if;
end;
$$;

alter table public.member_sensitive_identity
  validate constraint member_sensitive_identity_cpf_valid_chk;

create or replace function public.validate_member_tenant()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_whatsapp text;
begin
  new.full_name := pg_catalog.btrim(new.full_name);
  new.preferred_name := nullif(pg_catalog.btrim(new.preferred_name), '');
  new.email := nullif(pg_catalog.lower(pg_catalog.btrim(new.email)), '');
  new.state := nullif(pg_catalog.upper(pg_catalog.btrim(new.state)), '');
  new.country := coalesce(nullif(pg_catalog.btrim(new.country), ''), 'Brasil');

  v_whatsapp := nullif(
    pg_catalog.regexp_replace(coalesce(new.whatsapp, ''), '[^0-9]', '', 'g'),
    ''
  );
  if v_whatsapp is not null and pg_catalog.length(v_whatsapp) > 11 and pg_catalog.left(v_whatsapp, 2) = '55' then
    v_whatsapp := pg_catalog.substr(v_whatsapp, 3);
  end if;
  if v_whatsapp is not null and v_whatsapp !~ '^[0-9]{11}$' then
    raise exception 'MEMBER_WHATSAPP_INVALID';
  end if;
  new.whatsapp := v_whatsapp;

  if new.full_name = '' then raise exception 'MEMBER_NAME_REQUIRED'; end if;
  if new.birth_date > current_date
    or new.conversion_date > current_date
    or new.baptism_date > current_date
    or new.holy_spirit_baptism_date > current_date
    or new.received_date > current_date then
    raise exception 'MEMBER_DATE_IN_FUTURE';
  end if;

  if not exists (
    select 1 from public.congregations congregation
    where congregation.id = new.congregation_id
      and congregation.church_id = new.church_id
      and congregation.deleted_at is null
  ) then
    raise exception 'MEMBER_CONGREGATION_INVALID';
  end if;

  if tg_op = 'UPDATE' and new.church_id <> old.church_id then
    raise exception 'MEMBER_CHURCH_IMMUTABLE';
  end if;
  return new;
end;
$$;

update public.members
set whatsapp = whatsapp
where whatsapp is not null;

create or replace function public.enrich_member_role_history()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_uuid_pattern constant text := '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$';
  v_old_role_id text;
  v_new_role_id text;
  v_role_id text;
  v_old_role_name text;
  v_new_role_name text;
  v_role_name text;
begin
  if new.history_type not in ('ROLE_ASSIGNED', 'ROLE_CHANGED', 'ROLE_ENDED') then
    return new;
  end if;

  v_old_role_id := nullif(new.metadata->>'old_role_id', '');
  v_new_role_id := nullif(new.metadata->>'new_role_id', '');
  v_role_id := nullif(new.metadata->>'role_id', '');

  if v_old_role_id is null and coalesce(new.old_value, '') ~* v_uuid_pattern then
    v_old_role_id := new.old_value;
  end if;
  if v_new_role_id is null and coalesce(new.new_value, '') ~* v_uuid_pattern then
    v_new_role_id := new.new_value;
  end if;

  if v_old_role_id is not null then
    select case when member.gender = 'FEMALE' then coalesce(role.female_name, role.name) else role.name end
    into v_old_role_name
    from public.roles role
    join public.members member on member.id = new.member_id and member.church_id = new.church_id
    where role.id::text = v_old_role_id and role.church_id = new.church_id;
  end if;

  if v_new_role_id is not null then
    select case when member.gender = 'FEMALE' then coalesce(role.female_name, role.name) else role.name end
    into v_new_role_name
    from public.roles role
    join public.members member on member.id = new.member_id and member.church_id = new.church_id
    where role.id::text = v_new_role_id and role.church_id = new.church_id;
  end if;

  if v_role_id is not null then
    select case when member.gender = 'FEMALE' then coalesce(role.female_name, role.name) else role.name end
    into v_role_name
    from public.roles role
    join public.members member on member.id = new.member_id and member.church_id = new.church_id
    where role.id::text = v_role_id and role.church_id = new.church_id;
  end if;

  if new.history_type = 'ROLE_ASSIGNED' then
    new.new_value := coalesce(v_role_name, v_new_role_name, new.new_value);
  elsif new.history_type = 'ROLE_ENDED' then
    new.old_value := coalesce(v_role_name, v_old_role_name, new.old_value);
  else
    new.old_value := coalesce(v_old_role_name, new.old_value);
    new.new_value := coalesce(v_new_role_name, v_role_name, new.new_value);
  end if;
  return new;
end;
$$;

revoke all on function public.enrich_member_role_history() from public, anon, authenticated;

drop trigger if exists enrich_member_role_history_values on public.member_history;
create trigger enrich_member_role_history_values
before insert or update of history_type, metadata, old_value, new_value
on public.member_history
for each row execute function public.enrich_member_role_history();

update public.member_history
set metadata = metadata
where history_type in ('ROLE_ASSIGNED', 'ROLE_CHANGED', 'ROLE_ENDED')
  and deleted_at is null;

drop index if exists public.members_preferred_name_trgm_active_idx;

notify pgrst, 'reload schema';
