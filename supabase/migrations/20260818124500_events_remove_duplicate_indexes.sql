-- Remove apenas índices introduzidos pelo módulo de Eventos que duplicavam
-- índices canônicos já existentes. Os índices usados pelas FKs compostas de
-- região, ministério e evento são preservados.
drop index if exists public.churches_events_tenant_key;
drop index if exists public.congregations_events_tenant_key;
drop index if exists public.members_events_tenant_key;
drop index if exists public.events_active_slug_unique_idx;
drop index if exists public.event_congregation_quotas_active_unique_idx;
