-- Impede a reatribuição de registros a outro evento/igreja por chamadas diretas
-- e mantém a proteção dos campos de sistema imutável ao longo de todo o ciclo.

create or replace function private.protect_event_registration_field_identity()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.id is distinct from new.id
    or old.church_id is distinct from new.church_id
    or old.event_id is distinct from new.event_id
    or old.created_at is distinct from new.created_at
    or old.created_by is distinct from new.created_by
    or old.system_locked is distinct from new.system_locked then
    raise exception 'EVENT_FIELD_IDENTITY_LOCKED';
  end if;
  return new;
end;
$$;

drop trigger if exists protect_event_registration_field_identity on public.event_registration_fields;
create trigger protect_event_registration_field_identity
before update on public.event_registration_fields
for each row execute function private.protect_event_registration_field_identity();

create or replace function private.protect_event_expense_identity()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.id is distinct from new.id
    or old.church_id is distinct from new.church_id
    or old.event_id is distinct from new.event_id
    or old.created_at is distinct from new.created_at
    or old.created_by is distinct from new.created_by then
    raise exception 'EVENT_EXPENSE_IDENTITY_LOCKED';
  end if;
  return new;
end;
$$;

drop trigger if exists protect_event_expense_identity on public.event_expenses;
create trigger protect_event_expense_identity
before update on public.event_expenses
for each row execute function private.protect_event_expense_identity();

revoke all on function private.protect_event_registration_field_identity() from public, anon, authenticated;
revoke all on function private.protect_event_expense_identity() from public, anon, authenticated;
