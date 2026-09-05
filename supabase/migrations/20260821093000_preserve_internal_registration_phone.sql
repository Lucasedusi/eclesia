-- Preserve the phone entered in an internal registration when the member record has no WhatsApp.
do $migration$
declare
  v_definition text;
  v_old_fragment constant text := $old$v_phone := nullif(btrim(v_member.whatsapp), '');$old$;
  v_new_fragment constant text := $new$v_phone := coalesce(nullif(btrim(v_member.whatsapp), ''), v_phone);$new$;
begin
  select pg_get_functiondef('public.create_event_registration(uuid,jsonb,text)'::regprocedure)
  into v_definition;

  if position(v_old_fragment in v_definition) = 0 then
    raise exception 'CREATE_EVENT_REGISTRATION_PHONE_FRAGMENT_NOT_FOUND';
  end if;

  execute replace(v_definition, v_old_fragment, v_new_fragment);
end;
$migration$;

revoke all on function public.create_event_registration(uuid, jsonb, text) from public, anon;
grant execute on function public.create_event_registration(uuid, jsonb, text) to authenticated, service_role;
