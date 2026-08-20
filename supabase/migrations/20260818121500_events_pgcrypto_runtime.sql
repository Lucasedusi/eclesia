begin;

alter function public.create_event_registration(uuid,jsonb,text) set search_path = pg_catalog, extensions;
alter function public.register_event_checkin(uuid,uuid,text,text,text,text) set search_path = pg_catalog, extensions;
alter function public.reissue_event_registration_qr(uuid) set search_path = pg_catalog, extensions;

commit;
