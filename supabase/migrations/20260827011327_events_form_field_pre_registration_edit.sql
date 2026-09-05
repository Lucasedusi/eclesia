-- Antes da primeira inscrição, campos personalizados ainda podem mudar de
-- tipo. Depois dela, tipo e chave permanecem congelados para preservar dados.

create or replace function private.protect_event_registration_field()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_has_registrations boolean;
  v_custom_count integer;
begin
  if tg_op = 'DELETE' then
    if exists (
      select 1 from public.event_registration_field_values value
      where value.event_registration_field_id = old.id and value.deleted_at is null
    ) then raise exception 'EVENT_FIELD_HAS_ANSWERS'; end if;
    return old;
  end if;

  select exists (
    select 1 from public.event_registrations registration
    where registration.event_id = new.event_id and registration.deleted_at is null
  ) into v_has_registrations;

  if tg_op = 'UPDATE' then
    if old.field_kind is distinct from new.field_kind
      or (old.field_kind = 'STANDARD' and (old.field_key is distinct from new.field_key or old.field_type is distinct from new.field_type))
      or (v_has_registrations and (old.field_key is distinct from new.field_key or old.field_type is distinct from new.field_type)) then
      raise exception 'EVENT_FIELD_STRUCTURE_LOCKED';
    end if;
    if old.system_locked and (new.visibility <> old.visibility or not new.is_active) then
      raise exception 'EVENT_SYSTEM_FIELD_LOCKED';
    end if;
    if v_has_registrations and new.field_kind = 'CUSTOM' and old.visibility <> 'REQUIRED' and new.visibility = 'REQUIRED' then
      if exists (
        select 1 from public.event_registrations registration
        where registration.event_id = new.event_id and registration.deleted_at is null
          and not exists (
            select 1 from public.event_registration_field_values value
            where value.event_registration_id = registration.id
              and value.event_registration_field_id = new.id
              and value.deleted_at is null
          )
      ) then raise exception 'EVENT_FIELD_REQUIRED_WITH_MISSING_ANSWERS'; end if;
    elsif v_has_registrations and new.field_kind = 'STANDARD' and old.visibility <> 'REQUIRED' and new.visibility = 'REQUIRED' then
      if exists (
        select 1 from public.event_registrations registration
        left join public.congregations congregation on congregation.id=registration.congregation_id
        where registration.event_id=new.event_id and registration.deleted_at is null and case new.field_key
          when 'participant_gender' then registration.participant_gender is null
          when 'participant_phone' then coalesce(btrim(registration.participant_phone),'')=''
          when 'participant_email' then coalesce(btrim(registration.participant_email),'')=''
          when 'participant_document' then coalesce(btrim(registration.participant_document),'')=''
          when 'participant_birth_date' then registration.participant_birth_date is null
          when 'region_id' then congregation.region_id is null
          when 'congregation_id' then registration.congregation_id is null
          when 'participant_role_id' then coalesce(registration.metadata->>'participantRoleId','')=''
          when 'participant_city' then coalesce(btrim(registration.participant_city),'')=''
          when 'participant_state' then coalesce(btrim(registration.participant_state),'')=''
          when 'responsible_name' then coalesce(btrim(registration.responsible_name),'')=''
          when 'responsible_phone' then coalesce(btrim(registration.responsible_phone),'')=''
          else false end
      ) then raise exception 'EVENT_FIELD_REQUIRED_WITH_MISSING_ANSWERS'; end if;
    end if;
  elsif new.field_kind = 'CUSTOM' and v_has_registrations and new.visibility = 'REQUIRED' then
    raise exception 'EVENT_NEW_FIELD_MUST_BE_OPTIONAL';
  end if;

  if new.field_kind = 'CUSTOM' and new.is_active and new.deleted_at is null then
    select count(*) into v_custom_count
    from public.event_registration_fields field
    where field.event_id = new.event_id and field.field_kind = 'CUSTOM'
      and field.is_active and field.deleted_at is null
      and (tg_op = 'INSERT' or field.id <> new.id);
    if v_custom_count >= 20 then raise exception 'EVENT_CUSTOM_FIELD_LIMIT'; end if;
  end if;
  return new;
end;
$$;

revoke all on function private.protect_event_registration_field() from public, anon, authenticated;
