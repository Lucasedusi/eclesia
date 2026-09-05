-- Validação definitiva das respostas personalizadas no servidor. As RPCs
-- públicas são envolvidas para rejeitar chaves desconhecidas antes da gravação.

create or replace function private.assert_event_custom_fields_payload(
  p_event_id uuid,
  p_values jsonb
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_answer record;
  v_field public.event_registration_fields%rowtype;
  v_text text;
begin
  p_values := coalesce(p_values, '{}'::jsonb);
  if jsonb_typeof(p_values) <> 'object' then
    raise exception 'EVENT_CUSTOM_FIELDS_INVALID';
  end if;

  for v_answer in select key, value from jsonb_each(p_values)
  loop
    select * into v_field
    from public.event_registration_fields field
    where field.event_id = p_event_id
      and field.field_key = v_answer.key
      and field.field_kind = 'CUSTOM'
      and field.is_active
      and field.visibility <> 'HIDDEN'
      and field.deleted_at is null;
    if not found then raise exception 'EVENT_CUSTOM_FIELD_NOT_AVAILABLE'; end if;

    if v_answer.value is null or v_answer.value = 'null'::jsonb
      or v_answer.value = '""'::jsonb then
      if v_field.visibility = 'REQUIRED' then raise exception 'EVENT_REQUIRED_FIELD_MISSING'; end if;
      continue;
    end if;

    v_text := v_answer.value #>> '{}';
    if v_field.field_type = 'SHORT_TEXT' then
      if jsonb_typeof(v_answer.value) <> 'string' or char_length(v_text) > 300 then
        raise exception 'EVENT_CUSTOM_FIELD_VALUE_INVALID';
      end if;
    elsif v_field.field_type = 'LONG_TEXT' then
      if jsonb_typeof(v_answer.value) <> 'string' or char_length(v_text) > 3000 then
        raise exception 'EVENT_CUSTOM_FIELD_VALUE_INVALID';
      end if;
    elsif v_field.field_type = 'DATE' then
      if jsonb_typeof(v_answer.value) <> 'string' or v_text !~ '^\d{4}-\d{2}-\d{2}$' then
        raise exception 'EVENT_CUSTOM_FIELD_VALUE_INVALID';
      end if;
      begin
        perform v_text::date;
      exception when others then
        raise exception 'EVENT_CUSTOM_FIELD_VALUE_INVALID';
      end;
    elsif v_field.field_type = 'NUMBER' then
      if not (
        jsonb_typeof(v_answer.value) = 'number'
        or (jsonb_typeof(v_answer.value) = 'string' and v_text ~ '^-?[0-9]+([.,][0-9]+)?$')
      ) then raise exception 'EVENT_CUSTOM_FIELD_VALUE_INVALID'; end if;
    elsif v_field.field_type = 'SINGLE_SELECT' then
      if jsonb_typeof(v_answer.value) <> 'string' or not (v_field.options ? v_text) then
        raise exception 'EVENT_CUSTOM_FIELD_VALUE_INVALID';
      end if;
    elsif v_field.field_type = 'BOOLEAN' then
      if jsonb_typeof(v_answer.value) <> 'boolean' then
        raise exception 'EVENT_CUSTOM_FIELD_VALUE_INVALID';
      end if;
    else
      raise exception 'EVENT_CUSTOM_FIELD_VALUE_INVALID';
    end if;
  end loop;
end;
$$;

create or replace function private.validate_event_custom_field_value()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_registration public.event_registrations%rowtype;
  v_field public.event_registration_fields%rowtype;
begin
  select * into v_registration from public.event_registrations where id = new.event_registration_id;
  select * into v_field from public.event_registration_fields where id = new.event_registration_field_id;
  if not found or v_registration.id is null
    or v_registration.church_id <> new.church_id
    or v_registration.event_id <> new.event_id
    or v_field.church_id <> new.church_id
    or v_field.event_id <> new.event_id
    or v_field.field_key <> new.field_key_snapshot then
    raise exception 'EVENT_CUSTOM_FIELD_OWNERSHIP_INVALID';
  end if;
  perform private.assert_event_custom_fields_payload(new.event_id, jsonb_build_object(new.field_key_snapshot, new.value));
  return new;
end;
$$;

drop trigger if exists validate_event_custom_field_value on public.event_registration_field_values;
create trigger validate_event_custom_field_value
before insert or update of church_id,event_id,event_registration_id,event_registration_field_id,value,field_key_snapshot
on public.event_registration_field_values
for each row execute function private.validate_event_custom_field_value();

alter function public.create_event_registration_v3(uuid,jsonb,text)
  rename to create_event_registration_v3_unvalidated;

create function public.create_event_registration_v3(
  p_event_id uuid,
  p_payload jsonb,
  p_idempotency_key text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.assert_event_custom_fields_payload(p_event_id, coalesce(p_payload->'customFields','{}'::jsonb));
  return public.create_event_registration_v3_unvalidated(p_event_id, p_payload, p_idempotency_key);
end;
$$;

alter function public.update_event_registration(uuid,uuid,timestamptz,jsonb)
  rename to update_event_registration_unvalidated;

create function public.update_event_registration(
  p_event_id uuid,
  p_registration_id uuid,
  p_expected_updated_at timestamptz,
  p_payload jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.assert_event_custom_fields_payload(p_event_id, coalesce(p_payload->'customFields','{}'::jsonb));
  return public.update_event_registration_unvalidated(p_event_id, p_registration_id, p_expected_updated_at, p_payload);
end;
$$;

revoke all on function private.assert_event_custom_fields_payload(uuid,jsonb) from public, anon, authenticated;
revoke all on function private.validate_event_custom_field_value() from public, anon, authenticated;
revoke all on function public.create_event_registration_v3_unvalidated(uuid,jsonb,text) from public, anon, authenticated, service_role;
revoke all on function public.update_event_registration_unvalidated(uuid,uuid,timestamptz,jsonb) from public, anon, authenticated, service_role;
revoke all on function public.create_event_registration(uuid,jsonb,text) from public, anon, authenticated, service_role;
revoke all on function public.create_event_registration_v3(uuid,jsonb,text) from public, anon;
grant execute on function public.create_event_registration_v3(uuid,jsonb,text) to authenticated, service_role;
revoke all on function public.update_event_registration(uuid,uuid,timestamptz,jsonb) from public, anon;
grant execute on function public.update_event_registration(uuid,uuid,timestamptz,jsonb) to authenticated;
