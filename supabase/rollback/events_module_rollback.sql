-- ROLLBACK DESTRUTIVO DO MÓDULO DE EVENTOS
-- Faça backup antes de executar. Este arquivo remove dados, Storage e objetos
-- do módulo; não é executado automaticamente por nenhuma aplicação.
begin;

delete from storage.objects where bucket_id in ('event-documents','event-public-media');
delete from storage.buckets where id in ('event-documents','event-public-media');

drop table if exists private.event_public_submission_limits cascade;
drop table if exists public.event_documents cascade;
drop table if exists public.event_checkins cascade;
drop table if exists public.event_payments cascade;
drop table if exists public.event_registration_items cascade;
drop table if exists public.event_registrations cascade;
drop table if exists public.event_items cascade;
drop table if exists public.event_groups cascade;
drop table if exists public.event_registration_batches cascade;
drop table if exists public.event_city_quotas cascade;
drop table if exists public.event_congregation_quotas cascade;
drop table if exists public.events cascade;

delete from public.role_permissions
where permission_id in (select id from public.permissions where module = 'events');
delete from public.permissions where module = 'events';

drop index if exists public.regions_events_tenant_key;
drop index if exists public.ministries_events_tenant_key;

commit;
