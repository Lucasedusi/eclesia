-- Chaves compostas garantem no próprio banco que nenhuma despesa, definição
-- ou resposta possa cruzar os limites de igreja e evento.

create unique index event_registration_fields_tenant_key
  on public.event_registration_fields(church_id,event_id,id);

alter table public.event_expenses
  add constraint event_expenses_event_tenant_fkey
  foreign key (church_id,event_id) references public.events(church_id,id) on delete cascade;

alter table public.event_registration_fields
  add constraint event_registration_fields_event_tenant_fkey
  foreign key (church_id,event_id) references public.events(church_id,id) on delete cascade;

alter table public.event_registration_field_values
  add constraint event_registration_field_values_registration_tenant_fkey
  foreign key (church_id,event_id,event_registration_id)
  references public.event_registrations(church_id,event_id,id) on delete cascade;

alter table public.event_registration_field_values
  add constraint event_registration_field_values_field_tenant_fkey
  foreign key (church_id,event_id,event_registration_field_id)
  references public.event_registration_fields(church_id,event_id,id) on delete restrict;

create index event_expenses_event_name_idx
  on public.event_expenses(event_id,lower(name) text_pattern_ops)
  where deleted_at is null;
