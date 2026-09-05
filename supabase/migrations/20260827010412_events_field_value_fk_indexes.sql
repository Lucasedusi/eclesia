-- Índices de apoio às chaves compostas e às leituras das respostas.

create index event_registration_field_values_registration_tenant_idx
  on public.event_registration_field_values(church_id,event_id,event_registration_id)
  where deleted_at is null;

create index event_registration_field_values_field_tenant_idx
  on public.event_registration_field_values(church_id,event_id,event_registration_field_id)
  where deleted_at is null;

create index event_registration_field_values_field_idx
  on public.event_registration_field_values(event_registration_field_id)
  where deleted_at is null;
