begin;

create schema if not exists private;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Catálogo de permissões
-- ---------------------------------------------------------------------------

insert into public.permissions (
  key, name, description, module, action, is_sensitive, status
)
select proposed.*
from (values
  ('events.view', 'Visualizar eventos', 'Consultar catálogo e detalhes de eventos', 'events', 'view', false, 'ACTIVE'),
  ('events.manage', 'Gerenciar eventos', 'Criar e editar a configuração de eventos', 'events', 'manage', false, 'ACTIVE'),
  ('events.publish', 'Publicar eventos', 'Publicar, abrir, fechar, cancelar e encerrar eventos', 'events', 'publish', true, 'ACTIVE'),
  ('events.registrations.view', 'Visualizar inscrições', 'Consultar participantes e dados de inscrição', 'events', 'registrations_view', true, 'ACTIVE'),
  ('events.registrations.manage', 'Gerenciar inscrições', 'Criar, confirmar, cancelar e promover inscrições', 'events', 'registrations_manage', true, 'ACTIVE'),
  ('events.payments.view', 'Visualizar pagamentos de eventos', 'Consultar pagamentos e comprovantes', 'events', 'payments_view', true, 'ACTIVE'),
  ('events.payments.manage', 'Gerenciar pagamentos de eventos', 'Registrar, confirmar, cancelar e reembolsar pagamentos', 'events', 'payments_manage', true, 'ACTIVE'),
  ('events.checkin', 'Realizar check-in', 'Realizar e reverter check-in de participantes', 'events', 'checkin', true, 'ACTIVE'),
  ('events.documents.view', 'Visualizar documentos de eventos', 'Visualizar e baixar documentos permitidos', 'events', 'documents_view', true, 'ACTIVE'),
  ('events.documents.manage', 'Gerenciar documentos de eventos', 'Enviar, editar e excluir documentos de eventos', 'events', 'documents_manage', true, 'ACTIVE'),
  ('events.reports.export', 'Exportar relatórios de eventos', 'Gerar relatórios e exportar dados de eventos', 'events', 'reports_export', true, 'ACTIVE')
) as proposed(key, name, description, module, action, is_sensitive, status)
where not exists (
  select 1 from public.permissions permission where permission.key = proposed.key
);

update public.permissions
set status = 'ACTIVE', deleted_at = null, updated_at = now()
where key like 'events.%';

with grants(role, permission_key) as (values
  ('ADMIN', 'events.view'), ('ADMIN', 'events.manage'), ('ADMIN', 'events.publish'),
  ('ADMIN', 'events.registrations.view'), ('ADMIN', 'events.registrations.manage'),
  ('ADMIN', 'events.payments.view'), ('ADMIN', 'events.payments.manage'),
  ('ADMIN', 'events.checkin'), ('ADMIN', 'events.documents.view'),
  ('ADMIN', 'events.documents.manage'), ('ADMIN', 'events.reports.export'),
  ('SECRETARY', 'events.view'), ('SECRETARY', 'events.manage'), ('SECRETARY', 'events.publish'),
  ('SECRETARY', 'events.registrations.view'), ('SECRETARY', 'events.registrations.manage'),
  ('SECRETARY', 'events.checkin'), ('SECRETARY', 'events.documents.view'),
  ('SECRETARY', 'events.documents.manage'), ('SECRETARY', 'events.reports.export'),
  ('TREASURER', 'events.view'), ('TREASURER', 'events.registrations.view'),
  ('TREASURER', 'events.payments.view'), ('TREASURER', 'events.payments.manage'),
  ('TREASURER', 'events.documents.view'), ('TREASURER', 'events.reports.export'),
  ('LEADER', 'events.view'), ('LEADER', 'events.registrations.view'),
  ('LEADER', 'events.registrations.manage'), ('LEADER', 'events.checkin'),
  ('LEADER', 'events.documents.view'),
  ('MINISTRY_LEADER', 'events.view'), ('MINISTRY_LEADER', 'events.manage'),
  ('MINISTRY_LEADER', 'events.registrations.view'),
  ('MINISTRY_LEADER', 'events.registrations.manage'), ('MINISTRY_LEADER', 'events.checkin'),
  ('MINISTRY_LEADER', 'events.documents.view'), ('MINISTRY_LEADER', 'events.documents.manage'),
  ('VIEWER', 'events.view')
)
insert into public.role_permissions(role, permission_id, status)
select grants.role, permission.id, 'ACTIVE'
from grants
join public.permissions permission on permission.key = grants.permission_key
where not exists (
  select 1
  from public.role_permissions existing
  where existing.role = grants.role
    and existing.permission_id = permission.id
    and existing.deleted_at is null
);

with grants(role, permission_key) as (values
  ('ADMIN', 'events.view'), ('ADMIN', 'events.manage'), ('ADMIN', 'events.publish'),
  ('ADMIN', 'events.registrations.view'), ('ADMIN', 'events.registrations.manage'),
  ('ADMIN', 'events.payments.view'), ('ADMIN', 'events.payments.manage'),
  ('ADMIN', 'events.checkin'), ('ADMIN', 'events.documents.view'),
  ('ADMIN', 'events.documents.manage'), ('ADMIN', 'events.reports.export'),
  ('SECRETARY', 'events.view'), ('SECRETARY', 'events.manage'), ('SECRETARY', 'events.publish'),
  ('SECRETARY', 'events.registrations.view'), ('SECRETARY', 'events.registrations.manage'),
  ('SECRETARY', 'events.checkin'), ('SECRETARY', 'events.documents.view'),
  ('SECRETARY', 'events.documents.manage'), ('SECRETARY', 'events.reports.export'),
  ('TREASURER', 'events.view'), ('TREASURER', 'events.registrations.view'),
  ('TREASURER', 'events.payments.view'), ('TREASURER', 'events.payments.manage'),
  ('TREASURER', 'events.documents.view'), ('TREASURER', 'events.reports.export'),
  ('LEADER', 'events.view'), ('LEADER', 'events.registrations.view'),
  ('LEADER', 'events.registrations.manage'), ('LEADER', 'events.checkin'),
  ('LEADER', 'events.documents.view'),
  ('MINISTRY_LEADER', 'events.view'), ('MINISTRY_LEADER', 'events.manage'),
  ('MINISTRY_LEADER', 'events.registrations.view'),
  ('MINISTRY_LEADER', 'events.registrations.manage'), ('MINISTRY_LEADER', 'events.checkin'),
  ('MINISTRY_LEADER', 'events.documents.view'), ('MINISTRY_LEADER', 'events.documents.manage'),
  ('VIEWER', 'events.view')
)
update public.role_permissions role_permission
set status = 'ACTIVE', deleted_at = null, updated_at = now()
from grants
join public.permissions permission on permission.key = grants.permission_key
where role_permission.role = grants.role
  and role_permission.permission_id = permission.id;

-- ---------------------------------------------------------------------------
-- Estrutura principal. CREATE TABLE IF NOT EXISTS também torna esta migration
-- suficiente para ambientes que não receberam as migrations de clonagem.
-- ---------------------------------------------------------------------------

create table if not exists public.events (
  id uuid primary key default gen_random_uuid(),
  church_id uuid not null references public.churches(id) on delete restrict,
  name text not null,
  slug text,
  public_code text not null default encode(extensions.gen_random_bytes(9), 'hex'),
  description text,
  event_type text not null default 'OTHER',
  visibility text not null default 'INTERNAL',
  event_scope text not null default 'CHURCH',
  region_id uuid references public.regions(id) on delete restrict,
  congregation_id uuid references public.congregations(id) on delete restrict,
  ministry_id uuid references public.ministries(id) on delete restrict,
  status text not null default 'DRAFT',
  starts_at timestamptz not null,
  ends_at timestamptz,
  timezone text not null default 'America/Sao_Paulo',
  registration_starts_at timestamptz,
  registration_ends_at timestamptz,
  registration_mode text not null default 'INDIVIDUAL',
  capacity integer,
  allow_waitlist boolean not null default false,
  quota_mode text not null default 'NONE',
  uses_registration_batches boolean not null default false,
  requires_payment boolean not null default false,
  allow_installments boolean not null default false,
  max_installments integer not null default 1,
  requires_group_responsible boolean not null default false,
  requires_pastor_info boolean not null default false,
  requires_gender_totals boolean not null default false,
  location_name text,
  zip_code text,
  address text,
  number text,
  complement text,
  district text,
  city text,
  state text,
  country text not null default 'Brasil',
  host_city text,
  host_state text,
  banner_url text,
  banner_storage_bucket text,
  banner_storage_path text,
  settings jsonb not null default '{}'::jsonb,
  notes text,
  registration_sequence integer not null default 0,
  created_by uuid references public.profiles(id) on delete restrict,
  updated_by uuid references public.profiles(id) on delete restrict,
  published_at timestamptz,
  published_by uuid references public.profiles(id) on delete restrict,
  cancelled_at timestamptz,
  cancelled_by uuid references public.profiles(id) on delete restrict,
  cancel_reason text,
  finished_at timestamptz,
  finished_by uuid references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  deleted_by uuid references public.profiles(id) on delete restrict
);

alter table public.events
  add column if not exists public_code text default encode(extensions.gen_random_bytes(9), 'hex'),
  add column if not exists event_scope text not null default 'CHURCH',
  add column if not exists region_id uuid references public.regions(id) on delete restrict,
  add column if not exists timezone text not null default 'America/Sao_Paulo',
  add column if not exists banner_storage_bucket text,
  add column if not exists banner_storage_path text,
  add column if not exists registration_sequence integer not null default 0,
  add column if not exists updated_by uuid references public.profiles(id) on delete restrict,
  add column if not exists published_at timestamptz,
  add column if not exists published_by uuid references public.profiles(id) on delete restrict,
  add column if not exists cancelled_at timestamptz,
  add column if not exists cancelled_by uuid references public.profiles(id) on delete restrict,
  add column if not exists cancel_reason text,
  add column if not exists finished_at timestamptz,
  add column if not exists finished_by uuid references public.profiles(id) on delete restrict,
  add column if not exists deleted_by uuid references public.profiles(id) on delete restrict;

-- A tabela já existia na modelagem anterior com default GENERAL, valor que não
-- pertence ao domínio normalizado do módulo.
alter table public.events alter column quota_mode set default 'NONE';

update public.events
set public_code = encode(extensions.gen_random_bytes(9), 'hex')
where public_code is null or btrim(public_code) = '';

alter table public.events alter column public_code set not null;

create table if not exists public.event_congregation_quotas (
  id uuid primary key default gen_random_uuid(),
  church_id uuid not null references public.churches(id) on delete restrict,
  event_id uuid not null references public.events(id) on delete cascade,
  congregation_id uuid not null references public.congregations(id) on delete restrict,
  quota_total integer not null default 0,
  notes text,
  created_by uuid references public.profiles(id) on delete restrict,
  updated_by uuid references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  deleted_by uuid references public.profiles(id) on delete restrict
);

alter table public.event_congregation_quotas
  add column if not exists updated_by uuid references public.profiles(id) on delete restrict,
  add column if not exists deleted_by uuid references public.profiles(id) on delete restrict;

create table if not exists public.event_city_quotas (
  id uuid primary key default gen_random_uuid(),
  church_id uuid not null references public.churches(id) on delete restrict,
  event_id uuid not null references public.events(id) on delete cascade,
  city text not null,
  state text not null,
  quota_total integer not null default 0,
  notes text,
  created_by uuid references public.profiles(id) on delete restrict,
  updated_by uuid references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  deleted_by uuid references public.profiles(id) on delete restrict
);

create table if not exists public.event_registration_batches (
  id uuid primary key default gen_random_uuid(),
  church_id uuid not null references public.churches(id) on delete restrict,
  event_id uuid not null references public.events(id) on delete cascade,
  name text not null,
  description text,
  price numeric(12,2) not null default 0,
  capacity integer,
  starts_at timestamptz,
  ends_at timestamptz,
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_by uuid references public.profiles(id) on delete restrict,
  updated_by uuid references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  deleted_by uuid references public.profiles(id) on delete restrict
);

create table if not exists public.event_groups (
  id uuid primary key default gen_random_uuid(),
  church_id uuid not null references public.churches(id) on delete restrict,
  event_id uuid not null references public.events(id) on delete cascade,
  origin_church_name text,
  origin_field_name text,
  origin_city text not null,
  origin_state text not null default 'GO',
  responsible_name text not null,
  responsible_phone text,
  responsible_email text,
  pastor_name text,
  pastor_phone text,
  total_registrations integer not null default 0,
  male_count integer not null default 0,
  female_count integer not null default 0,
  status text not null default 'PENDING',
  notes text,
  created_by uuid references public.profiles(id) on delete restrict,
  updated_by uuid references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  deleted_by uuid references public.profiles(id) on delete restrict
);

alter table public.event_groups
  add column if not exists idempotency_key text,
  add column if not exists updated_by uuid references public.profiles(id) on delete restrict,
  add column if not exists deleted_by uuid references public.profiles(id) on delete restrict;

create table if not exists public.event_items (
  id uuid primary key default gen_random_uuid(),
  church_id uuid not null references public.churches(id) on delete restrict,
  event_id uuid not null references public.events(id) on delete cascade,
  name text not null,
  description text,
  item_type text not null default 'OTHER',
  price numeric(12,2) not null default 0,
  cost_price numeric(12,2),
  is_required boolean not null default false,
  is_active boolean not null default true,
  allow_quantity boolean not null default false,
  min_quantity integer not null default 1,
  max_quantity integer,
  available_quantity integer,
  sort_order integer not null default 0,
  settings jsonb not null default '{}'::jsonb,
  notes text,
  created_by uuid references public.profiles(id) on delete restrict,
  updated_by uuid references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  deleted_by uuid references public.profiles(id) on delete restrict
);

alter table public.event_items
  add column if not exists updated_by uuid references public.profiles(id) on delete restrict,
  add column if not exists deleted_by uuid references public.profiles(id) on delete restrict;

create table if not exists public.event_registrations (
  id uuid primary key default gen_random_uuid(),
  church_id uuid not null references public.churches(id) on delete restrict,
  event_id uuid not null references public.events(id) on delete cascade,
  event_group_id uuid references public.event_groups(id) on delete restrict,
  event_registration_batch_id uuid references public.event_registration_batches(id) on delete restrict,
  member_id uuid references public.members(id) on delete restrict,
  congregation_id uuid references public.congregations(id) on delete restrict,
  registration_number text,
  registration_source text not null default 'INTERNAL',
  participant_type text not null default 'VISITOR',
  participant_name text not null,
  participant_document text,
  participant_document_normalized text,
  participant_birth_date date,
  participant_gender text,
  participant_phone text,
  participant_email text,
  participant_city text,
  participant_state text,
  responsible_name text,
  responsible_phone text,
  responsible_registration_id uuid references public.event_registrations(id) on delete restrict,
  consent_version text,
  consent_at timestamptz,
  status text not null default 'PENDING',
  payment_status text not null default 'PENDING',
  total_amount numeric(12,2) not null default 0,
  paid_amount numeric(12,2) not null default 0,
  remaining_amount numeric(12,2) generated always as (greatest(total_amount - paid_amount, 0)) stored,
  qr_token_hash text,
  qr_token_last4 text,
  qr_code_value text,
  reservation_expires_at timestamptz,
  idempotency_key text,
  registered_at timestamptz not null default now(),
  confirmed_at timestamptz,
  cancelled_at timestamptz,
  cancelled_by uuid references public.profiles(id) on delete restrict,
  cancel_reason text,
  notes text,
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid references public.profiles(id) on delete restrict,
  updated_by uuid references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  deleted_by uuid references public.profiles(id) on delete restrict
);

alter table public.event_registrations
  add column if not exists event_registration_batch_id uuid references public.event_registration_batches(id) on delete restrict,
  add column if not exists registration_source text not null default 'INTERNAL',
  add column if not exists participant_document_normalized text,
  add column if not exists responsible_name text,
  add column if not exists responsible_phone text,
  add column if not exists responsible_registration_id uuid references public.event_registrations(id) on delete restrict,
  add column if not exists consent_version text,
  add column if not exists consent_at timestamptz,
  add column if not exists qr_token_hash text,
  add column if not exists qr_token_last4 text,
  add column if not exists reservation_expires_at timestamptz,
  add column if not exists idempotency_key text,
  add column if not exists cancelled_by uuid references public.profiles(id) on delete restrict,
  add column if not exists updated_by uuid references public.profiles(id) on delete restrict,
  add column if not exists deleted_by uuid references public.profiles(id) on delete restrict;

alter table public.event_registrations drop constraint if exists event_registrations_status_check;

update public.event_registrations
set participant_document_normalized = nullif(regexp_replace(coalesce(participant_document, ''), '\\D', '', 'g'), '')
where participant_document is not null and participant_document_normalized is null;

create table if not exists public.event_registration_items (
  id uuid primary key default gen_random_uuid(),
  church_id uuid not null references public.churches(id) on delete restrict,
  event_id uuid not null references public.events(id) on delete cascade,
  event_registration_id uuid references public.event_registrations(id) on delete cascade,
  event_group_id uuid references public.event_groups(id) on delete cascade,
  event_item_id uuid not null references public.event_items(id) on delete restrict,
  event_registration_batch_id uuid references public.event_registration_batches(id) on delete restrict,
  item_name text not null,
  item_type text not null,
  size text,
  quantity integer not null default 1,
  unit_price numeric(12,2) not null default 0,
  total_price numeric(12,2) not null default 0,
  observation text,
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid references public.profiles(id) on delete restrict,
  updated_by uuid references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  deleted_by uuid references public.profiles(id) on delete restrict
);

alter table public.event_registration_items
  add column if not exists event_registration_batch_id uuid references public.event_registration_batches(id) on delete restrict,
  add column if not exists updated_by uuid references public.profiles(id) on delete restrict,
  add column if not exists deleted_by uuid references public.profiles(id) on delete restrict;

create table if not exists public.event_payments (
  id uuid primary key default gen_random_uuid(),
  church_id uuid not null references public.churches(id) on delete restrict,
  event_id uuid not null references public.events(id) on delete cascade,
  event_registration_id uuid references public.event_registrations(id) on delete restrict,
  event_group_id uuid references public.event_groups(id) on delete restrict,
  payment_number text,
  payment_method text not null default 'PIX',
  payment_status text not null default 'PENDING',
  amount numeric(12,2) not null,
  paid_at timestamptz,
  due_date date,
  installment_number integer not null default 1,
  installments_total integer not null default 1,
  payer_name text,
  payer_document text,
  transaction_reference text,
  idempotency_key text,
  confirmed_by uuid references public.profiles(id) on delete restrict,
  failed_at timestamptz,
  failed_by uuid references public.profiles(id) on delete restrict,
  failure_reason text,
  cancelled_at timestamptz,
  cancelled_by uuid references public.profiles(id) on delete restrict,
  cancel_reason text,
  refunded_at timestamptz,
  refunded_by uuid references public.profiles(id) on delete restrict,
  refund_reason text,
  financial_transaction_id uuid,
  notes text,
  metadata jsonb not null default '{}'::jsonb,
  receipt_file_url text,
  receipt_storage_path text,
  created_by uuid references public.profiles(id) on delete restrict,
  updated_by uuid references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  deleted_by uuid references public.profiles(id) on delete restrict
);

alter table public.event_payments
  add column if not exists idempotency_key text,
  add column if not exists failed_at timestamptz,
  add column if not exists failed_by uuid references public.profiles(id) on delete restrict,
  add column if not exists failure_reason text,
  add column if not exists cancelled_at timestamptz,
  add column if not exists cancelled_by uuid references public.profiles(id) on delete restrict,
  add column if not exists cancel_reason text,
  add column if not exists refunded_at timestamptz,
  add column if not exists refunded_by uuid references public.profiles(id) on delete restrict,
  add column if not exists refund_reason text,
  add column if not exists financial_transaction_id uuid,
  add column if not exists updated_by uuid references public.profiles(id) on delete restrict,
  add column if not exists deleted_by uuid references public.profiles(id) on delete restrict;

create table if not exists public.event_checkins (
  id uuid primary key default gen_random_uuid(),
  church_id uuid not null references public.churches(id) on delete restrict,
  event_id uuid not null references public.events(id) on delete cascade,
  event_registration_id uuid not null references public.event_registrations(id) on delete restrict,
  event_group_id uuid references public.event_groups(id) on delete restrict,
  checkin_code text,
  checkin_method text not null default 'MANUAL',
  status text not null default 'CHECKED_IN',
  checked_in_at timestamptz,
  checked_in_by uuid references public.profiles(id) on delete restrict,
  cancelled_at timestamptz,
  cancelled_by uuid references public.profiles(id) on delete restrict,
  cancel_reason text,
  idempotency_key text,
  device_info text,
  notes text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

alter table public.event_checkins
  add column if not exists cancelled_at timestamptz,
  add column if not exists cancelled_by uuid references public.profiles(id) on delete restrict,
  add column if not exists cancel_reason text,
  add column if not exists idempotency_key text;

create table if not exists public.event_documents (
  id uuid primary key default gen_random_uuid(),
  church_id uuid not null references public.churches(id) on delete restrict,
  event_id uuid not null references public.events(id) on delete cascade,
  event_registration_id uuid references public.event_registrations(id) on delete restrict,
  event_group_id uuid references public.event_groups(id) on delete restrict,
  event_payment_id uuid references public.event_payments(id) on delete restrict,
  document_type text not null default 'OTHER',
  title text not null,
  description text,
  file_name text not null,
  file_url text,
  storage_bucket text not null default 'event-documents',
  storage_path text not null,
  pending_storage_path text,
  mime_type text,
  file_size bigint,
  checksum text,
  is_sensitive boolean not null default false,
  status text not null default 'ACTIVE',
  upload_status text not null default 'PENDING',
  pending_by uuid references public.profiles(id) on delete restrict,
  pending_expires_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  uploaded_by uuid references public.profiles(id) on delete restrict,
  uploaded_at timestamptz not null default now(),
  updated_by uuid references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  deleted_by uuid references public.profiles(id) on delete restrict
);

alter table public.event_documents
  add column if not exists pending_storage_path text,
  add column if not exists checksum text,
  add column if not exists upload_status text not null default 'ACTIVE',
  add column if not exists pending_by uuid references public.profiles(id) on delete restrict,
  add column if not exists pending_expires_at timestamptz,
  add column if not exists updated_by uuid references public.profiles(id) on delete restrict,
  add column if not exists deleted_by uuid references public.profiles(id) on delete restrict;

-- ---------------------------------------------------------------------------
-- Integridade, chaves compostas e índices operacionais
-- ---------------------------------------------------------------------------

create unique index if not exists regions_events_tenant_key on public.regions(church_id, id);
create unique index if not exists ministries_events_tenant_key on public.ministries(church_id, id);
create unique index if not exists events_tenant_key on public.events(church_id, id);
create unique index if not exists event_groups_tenant_key on public.event_groups(church_id, event_id, id);
create unique index if not exists event_items_tenant_key on public.event_items(church_id, event_id, id);
create unique index if not exists event_batches_tenant_key on public.event_registration_batches(church_id, event_id, id);
create unique index if not exists event_registrations_tenant_key on public.event_registrations(church_id, event_id, id);
create unique index if not exists event_payments_tenant_key on public.event_payments(church_id, event_id, id);

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'events_scope_target_check') then
    alter table public.events add constraint events_scope_target_check check (
      (event_scope = 'CHURCH' and region_id is null and congregation_id is null and ministry_id is null)
      or (event_scope = 'REGION' and region_id is not null and congregation_id is null and ministry_id is null)
      or (event_scope = 'CONGREGATION' and region_id is null and congregation_id is not null and ministry_id is null)
      or (event_scope = 'MINISTRY' and region_id is null and congregation_id is null and ministry_id is not null)
    );
  end if;
  if not exists (select 1 from pg_constraint where conname = 'events_status_v2_check') then
    alter table public.events add constraint events_status_v2_check check (
      status in ('DRAFT','PUBLISHED','REGISTRATION_OPEN','REGISTRATION_CLOSED','IN_PROGRESS','FINISHED','CANCELLED')
    );
  end if;
  if not exists (select 1 from pg_constraint where conname = 'events_type_v2_check') then
    alter table public.events add constraint events_type_v2_check check (
      event_type in ('CONFERENCE','CAMP','RETREAT','COURSE','MEETING','SERVICE','CONGRESS','TRAINING','DINNER','SYMPOSIUM','OTHER')
    );
  end if;
  if not exists (select 1 from pg_constraint where conname = 'events_visibility_v2_check') then
    alter table public.events add constraint events_visibility_v2_check check (visibility in ('PUBLIC','INTERNAL','PRIVATE'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'events_registration_mode_v2_check') then
    alter table public.events add constraint events_registration_mode_v2_check check (registration_mode in ('INDIVIDUAL','GROUP','MIXED'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'events_quota_mode_v2_check') then
    alter table public.events add constraint events_quota_mode_v2_check check (quota_mode in ('NONE','BY_CONGREGATION','BY_CITY'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'events_dates_v2_check') then
    alter table public.events add constraint events_dates_v2_check check (
      (ends_at is null or ends_at >= starts_at)
      and (registration_starts_at is null or registration_ends_at is null or registration_ends_at >= registration_starts_at)
    );
  end if;
  if not exists (select 1 from pg_constraint where conname = 'events_capacity_v2_check') then
    alter table public.events add constraint events_capacity_v2_check check (
      (capacity is null or capacity >= 0) and max_installments between 1 and 24 and registration_sequence >= 0
    );
  end if;
end $$;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'events_region_tenant_fkey') then
    alter table public.events add constraint events_region_tenant_fkey foreign key (church_id, region_id) references public.regions(church_id, id) on delete restrict;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'events_congregation_tenant_fkey') then
    alter table public.events add constraint events_congregation_tenant_fkey foreign key (church_id, congregation_id) references public.congregations(church_id, id) on delete restrict;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'events_ministry_tenant_fkey') then
    alter table public.events add constraint events_ministry_tenant_fkey foreign key (church_id, ministry_id) references public.ministries(church_id, id) on delete restrict;
  end if;
end $$;

do $$
declare
  target_table text;
  constraint_name text;
begin
  foreach target_table in array array[
    'event_congregation_quotas','event_city_quotas','event_registration_batches',
    'event_groups','event_items','event_registrations','event_registration_items',
    'event_payments','event_checkins','event_documents'
  ]
  loop
    constraint_name := target_table || '_event_tenant_fkey';
    if not exists (select 1 from pg_constraint where conname = constraint_name) then
      execute format(
        'alter table public.%I add constraint %I foreign key (church_id, event_id) references public.events(church_id, id) on delete cascade',
        target_table, constraint_name
      );
    end if;
  end loop;
end $$;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'event_congregation_quotas_target_fkey') then
    alter table public.event_congregation_quotas add constraint event_congregation_quotas_target_fkey
      foreign key (church_id, congregation_id) references public.congregations(church_id, id) on delete restrict;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'event_registrations_group_tenant_fkey') then
    alter table public.event_registrations add constraint event_registrations_group_tenant_fkey
      foreign key (church_id, event_id, event_group_id) references public.event_groups(church_id, event_id, id) on delete restrict;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'event_registrations_batch_tenant_fkey') then
    alter table public.event_registrations add constraint event_registrations_batch_tenant_fkey
      foreign key (church_id, event_id, event_registration_batch_id) references public.event_registration_batches(church_id, event_id, id) on delete restrict;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'event_registrations_congregation_tenant_fkey') then
    alter table public.event_registrations add constraint event_registrations_congregation_tenant_fkey
      foreign key (church_id, congregation_id) references public.congregations(church_id, id) on delete restrict;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'event_registrations_member_tenant_fkey') then
    alter table public.event_registrations add constraint event_registrations_member_tenant_fkey
      foreign key (church_id, member_id) references public.members(church_id, id) on delete restrict;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'event_registration_items_registration_tenant_fkey') then
    alter table public.event_registration_items add constraint event_registration_items_registration_tenant_fkey
      foreign key (church_id, event_id, event_registration_id) references public.event_registrations(church_id, event_id, id) on delete cascade;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'event_registration_items_group_tenant_fkey') then
    alter table public.event_registration_items add constraint event_registration_items_group_tenant_fkey
      foreign key (church_id, event_id, event_group_id) references public.event_groups(church_id, event_id, id) on delete cascade;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'event_registration_items_item_tenant_fkey') then
    alter table public.event_registration_items add constraint event_registration_items_item_tenant_fkey
      foreign key (church_id, event_id, event_item_id) references public.event_items(church_id, event_id, id) on delete restrict;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'event_payments_registration_tenant_fkey') then
    alter table public.event_payments add constraint event_payments_registration_tenant_fkey
      foreign key (church_id, event_id, event_registration_id) references public.event_registrations(church_id, event_id, id) on delete restrict;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'event_payments_group_tenant_fkey') then
    alter table public.event_payments add constraint event_payments_group_tenant_fkey
      foreign key (church_id, event_id, event_group_id) references public.event_groups(church_id, event_id, id) on delete restrict;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'event_checkins_registration_tenant_fkey') then
    alter table public.event_checkins add constraint event_checkins_registration_tenant_fkey
      foreign key (church_id, event_id, event_registration_id) references public.event_registrations(church_id, event_id, id) on delete restrict;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'event_documents_registration_tenant_fkey') then
    alter table public.event_documents add constraint event_documents_registration_tenant_fkey
      foreign key (church_id, event_id, event_registration_id) references public.event_registrations(church_id, event_id, id) on delete restrict;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'event_documents_group_tenant_fkey') then
    alter table public.event_documents add constraint event_documents_group_tenant_fkey
      foreign key (church_id, event_id, event_group_id) references public.event_groups(church_id, event_id, id) on delete restrict;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'event_documents_payment_tenant_fkey') then
    alter table public.event_documents add constraint event_documents_payment_tenant_fkey
      foreign key (church_id, event_id, event_payment_id) references public.event_payments(church_id, event_id, id) on delete restrict;
  end if;
end $$;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'event_quota_non_negative_check') then
    alter table public.event_congregation_quotas add constraint event_quota_non_negative_check check (quota_total >= 0);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'event_city_quota_valid_check') then
    alter table public.event_city_quotas add constraint event_city_quota_valid_check check (btrim(city) <> '' and state ~ '^[A-Z]{2}$' and quota_total >= 0);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'event_batch_valid_check') then
    alter table public.event_registration_batches add constraint event_batch_valid_check check (
      btrim(name) <> '' and price >= 0 and (capacity is null or capacity >= 0) and (starts_at is null or ends_at is null or ends_at >= starts_at)
    );
  end if;
  if not exists (select 1 from pg_constraint where conname = 'event_group_valid_check') then
    alter table public.event_groups add constraint event_group_valid_check check (
      btrim(origin_city) <> '' and origin_state ~ '^[A-Z]{2}$' and btrim(responsible_name) <> ''
      and total_registrations >= 0 and male_count >= 0 and female_count >= 0
      and status in ('PENDING','CONFIRMED','PARTIALLY_PAID','PAID','CANCELLED')
    );
  end if;
  if not exists (select 1 from pg_constraint where conname = 'event_item_valid_check') then
    alter table public.event_items add constraint event_item_valid_check check (
      btrim(name) <> '' and price >= 0 and (cost_price is null or cost_price >= 0)
      and min_quantity >= 0 and (max_quantity is null or max_quantity >= min_quantity)
      and (available_quantity is null or available_quantity >= 0)
    );
  end if;
  if not exists (select 1 from pg_constraint where conname = 'event_registration_status_v2_check') then
    alter table public.event_registrations add constraint event_registration_status_v2_check check (status in ('PENDING','CONFIRMED','WAITLIST','CANCELLED','EXPIRED','CHECKED_IN','NO_SHOW'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'event_registration_amounts_v2_check') then
    alter table public.event_registrations add constraint event_registration_amounts_v2_check check (
      total_amount >= 0 and paid_amount >= 0 and remaining_amount >= 0 and btrim(participant_name) <> ''
    );
  end if;
  if not exists (select 1 from pg_constraint where conname = 'event_registration_item_owner_xor_check') then
    alter table public.event_registration_items add constraint event_registration_item_owner_xor_check check (
      (event_registration_id is not null)::integer + (event_group_id is not null)::integer = 1
    );
  end if;
  if not exists (select 1 from pg_constraint where conname = 'event_registration_item_amount_check') then
    alter table public.event_registration_items add constraint event_registration_item_amount_check check (quantity > 0 and unit_price >= 0);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'event_payment_owner_xor_check') then
    alter table public.event_payments add constraint event_payment_owner_xor_check check (
      (event_registration_id is not null)::integer + (event_group_id is not null)::integer = 1
    );
  end if;
  if not exists (select 1 from pg_constraint where conname = 'event_payment_valid_v2_check') then
    alter table public.event_payments add constraint event_payment_valid_v2_check check (
      amount > 0 and installment_number > 0 and installments_total > 0
      and installment_number <= installments_total
      and payment_status in ('PENDING','CONFIRMED','FAILED','CANCELLED','REFUNDED')
    );
  end if;
  if not exists (select 1 from pg_constraint where conname = 'event_checkin_valid_v2_check') then
    alter table public.event_checkins add constraint event_checkin_valid_v2_check check (
      status in ('CHECKED_IN','CANCELLED') and checkin_method in ('QR_CODE','MANUAL','SEARCH')
      and ((status = 'CHECKED_IN' and checked_in_at is not null) or status = 'CANCELLED')
    );
  end if;
  if not exists (select 1 from pg_constraint where conname = 'event_document_relation_check') then
    alter table public.event_documents add constraint event_document_relation_check check (
      (event_registration_id is not null)::integer
      + (event_group_id is not null)::integer
      + (event_payment_id is not null)::integer <= 1
    );
  end if;
  if not exists (select 1 from pg_constraint where conname = 'event_document_upload_status_check') then
    alter table public.event_documents add constraint event_document_upload_status_check check (upload_status in ('PENDING','ACTIVE','FAILED'));
  end if;
end $$;

create unique index if not exists events_public_code_unique_idx on public.events(public_code);
create index if not exists events_church_status_starts_idx on public.events(church_id, status, starts_at desc, id) where deleted_at is null;
create index if not exists events_scope_idx on public.events(church_id, event_scope, region_id, congregation_id, ministry_id) where deleted_at is null;
create index if not exists events_created_by_idx on public.events(created_by) where created_by is not null;

create unique index if not exists event_city_quotas_active_unique_idx on public.event_city_quotas(event_id, lower(city), upper(state)) where deleted_at is null;
create unique index if not exists event_batches_active_name_unique_idx on public.event_registration_batches(event_id, lower(name)) where deleted_at is null;
create index if not exists event_batches_schedule_idx on public.event_registration_batches(event_id, is_active, starts_at, ends_at) where deleted_at is null;
create index if not exists event_groups_list_idx on public.event_groups(event_id, status, created_at desc, id) where deleted_at is null;
create unique index if not exists event_groups_idempotency_unique_idx on public.event_groups(event_id, idempotency_key) where idempotency_key is not null;
create index if not exists event_items_list_idx on public.event_items(event_id, is_active, sort_order, name) where deleted_at is null;
create index if not exists event_registrations_list_idx on public.event_registrations(event_id, status, registered_at desc, id) where deleted_at is null;
create index if not exists event_registrations_congregation_idx on public.event_registrations(event_id, congregation_id, status) where deleted_at is null;
create index if not exists event_registrations_city_idx on public.event_registrations(event_id, lower(participant_city), upper(participant_state), status) where deleted_at is null;
create index if not exists event_registrations_group_idx on public.event_registrations(event_group_id, status) where deleted_at is null;
create unique index if not exists event_registrations_member_active_unique_idx on public.event_registrations(event_id, member_id) where member_id is not null and status in ('PENDING','CONFIRMED','WAITLIST') and deleted_at is null;
create unique index if not exists event_registrations_document_active_unique_idx on public.event_registrations(event_id, participant_document_normalized) where participant_document_normalized is not null and status in ('PENDING','CONFIRMED','WAITLIST') and deleted_at is null;
create unique index if not exists event_registrations_number_unique_idx on public.event_registrations(event_id, registration_number) where registration_number is not null;
create unique index if not exists event_registrations_idempotency_unique_idx on public.event_registrations(event_id, idempotency_key) where idempotency_key is not null;
create unique index if not exists event_registrations_qr_hash_unique_idx on public.event_registrations(qr_token_hash) where qr_token_hash is not null;
create index if not exists event_registration_items_registration_idx on public.event_registration_items(event_registration_id) where deleted_at is null;
create index if not exists event_registration_items_group_idx on public.event_registration_items(event_group_id) where deleted_at is null;
create index if not exists event_registration_items_item_idx on public.event_registration_items(event_item_id) where deleted_at is null;
create index if not exists event_payments_list_idx on public.event_payments(event_id, payment_status, paid_at desc, id) where deleted_at is null;
create index if not exists event_payments_registration_idx on public.event_payments(event_registration_id) where deleted_at is null;
create index if not exists event_payments_group_idx on public.event_payments(event_group_id) where deleted_at is null;
create unique index if not exists event_payments_idempotency_unique_idx on public.event_payments(event_id, idempotency_key) where idempotency_key is not null;
create unique index if not exists event_payments_number_unique_idx on public.event_payments(event_id, payment_number) where payment_number is not null;
create unique index if not exists event_checkins_registration_active_unique_idx on public.event_checkins(event_registration_id) where status = 'CHECKED_IN' and deleted_at is null;
create unique index if not exists event_checkins_idempotency_unique_idx on public.event_checkins(event_id, idempotency_key) where idempotency_key is not null;
create index if not exists event_checkins_event_time_idx on public.event_checkins(event_id, checked_in_at desc, id) where deleted_at is null;
create index if not exists event_documents_list_idx on public.event_documents(event_id, document_type, created_at desc, id) where deleted_at is null;
create index if not exists event_documents_registration_idx on public.event_documents(event_registration_id) where deleted_at is null;
create index if not exists event_documents_group_idx on public.event_documents(event_group_id) where deleted_at is null;
create index if not exists event_documents_payment_idx on public.event_documents(event_payment_id) where deleted_at is null;

create or replace function private.event_registration_item_set_total()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.total_price = round(new.quantity * new.unit_price, 2);
  return new;
end;
$$;

drop trigger if exists set_event_registration_item_total on public.event_registration_items;
create trigger set_event_registration_item_total
before insert or update of quantity, unit_price on public.event_registration_items
for each row execute function private.event_registration_item_set_total();

do $$
declare target_table text;
begin
  foreach target_table in array array[
    'events','event_congregation_quotas','event_city_quotas','event_registration_batches',
    'event_groups','event_items','event_registrations','event_registration_items',
    'event_payments','event_checkins','event_documents'
  ] loop
    execute format('drop trigger if exists set_%I_updated_at on public.%I', target_table, target_table);
    execute format(
      'create trigger set_%I_updated_at before update on public.%I for each row execute function public.set_updated_at()',
      target_table, target_table
    );
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- Autorização por permissão e escopo
-- ---------------------------------------------------------------------------

create or replace function private.is_service_request()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(current_setting('request.jwt.claim.role', true), '') = 'service_role'
    or coalesce((select auth.jwt() ->> 'role'), '') = 'service_role';
$$;

create or replace function private.access_has_permission(
  p_access_id uuid,
  p_permission_key text
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.user_church_access access
    join public.profiles profile on profile.id = access.profile_id
    join public.permissions permission on permission.key = p_permission_key
      and permission.status = 'ACTIVE' and permission.deleted_at is null
    where access.id = p_access_id
      and access.profile_id = (select auth.uid())
      and access.status = 'ACTIVE' and access.deleted_at is null
      and profile.status = 'ACTIVE' and profile.deleted_at is null
      and (
        exists (
          select 1
          from public.user_permission_overrides permission_override
          where permission_override.access_id = access.id
            and permission_override.permission_id = permission.id
            and permission_override.effect = 'ALLOW'
            and permission_override.deleted_at is null
        )
        or (
          exists (
            select 1
            from public.role_permissions role_permission
            where role_permission.role = access.role
              and role_permission.permission_id = permission.id
              and role_permission.status = 'ACTIVE'
              and role_permission.deleted_at is null
          )
          and not exists (
            select 1
            from public.user_permission_overrides permission_override
            where permission_override.access_id = access.id
              and permission_override.permission_id = permission.id
              and permission_override.effect = 'DENY'
              and permission_override.deleted_at is null
          )
        )
      )
  );
$$;

create or replace function private.can_access_event_values(
  p_church_id uuid,
  p_event_scope text,
  p_region_id uuid,
  p_congregation_id uuid,
  p_ministry_id uuid,
  p_permission_key text
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select (select auth.uid()) is not null and exists (
    select 1
    from public.user_church_access access
    where access.profile_id = (select auth.uid())
      and access.church_id = p_church_id
      and access.status = 'ACTIVE'
      and access.deleted_at is null
      and (select private.access_has_permission(access.id, p_permission_key))
      and (
        access.access_scope = 'CHURCH'
        or (
          access.access_scope = 'REGION'
          and (
            (p_event_scope = 'REGION' and p_region_id = access.region_id)
            or (
              p_event_scope = 'CONGREGATION'
              and exists (
                select 1
                from public.congregations congregation
                where congregation.id = p_congregation_id
                  and congregation.church_id = p_church_id
                  and congregation.region_id = access.region_id
                  and congregation.deleted_at is null
              )
            )
          )
        )
        or (
          access.access_scope = 'CONGREGATION'
          and p_event_scope = 'CONGREGATION'
          and p_congregation_id = access.congregation_id
        )
        or (
          access.access_scope = 'MINISTRY'
          and p_event_scope = 'MINISTRY'
          and p_ministry_id = access.ministry_id
        )
      )
  );
$$;

create or replace function private.can_access_event_id(
  p_event_id uuid,
  p_permission_key text
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.events event
    where event.id = p_event_id
      and event.deleted_at is null
      and (select private.can_access_event_values(
        event.church_id, event.event_scope, event.region_id,
        event.congregation_id, event.ministry_id, p_permission_key
      ))
  );
$$;

revoke all on function private.is_service_request() from public, anon, authenticated;
revoke all on function private.access_has_permission(uuid, text) from public, anon;
revoke all on function private.can_access_event_values(uuid, text, uuid, uuid, uuid, text) from public, anon;
revoke all on function private.can_access_event_id(uuid, text) from public, anon;
grant usage on schema private to authenticated, service_role;
grant execute on function private.access_has_permission(uuid, text) to authenticated, service_role;
grant execute on function private.can_access_event_values(uuid, text, uuid, uuid, uuid, text) to authenticated, service_role;
grant execute on function private.can_access_event_id(uuid, text) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Ciclo de vida, indicadores e reconciliação
-- ---------------------------------------------------------------------------

create or replace function public.change_event_lifecycle(
  p_event_id uuid,
  p_action text,
  p_reason text default null
)
returns public.events
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_event public.events%rowtype;
  v_next_status text;
  v_old_status text;
  v_actor uuid := (select auth.uid());
begin
  select * into v_event
  from public.events
  where id = p_event_id and deleted_at is null
  for update;

  if not found then raise exception 'EVENT_NOT_FOUND'; end if;
  p_action := upper(p_action);
  v_old_status := v_event.status;
  if not (select private.can_access_event_id(p_event_id, 'events.publish')) then
    raise exception 'EVENT_ACCESS_DENIED';
  end if;

  v_next_status := case upper(p_action)
    when 'PUBLISH' then 'PUBLISHED'
    when 'OPEN_REGISTRATION' then 'REGISTRATION_OPEN'
    when 'CLOSE_REGISTRATION' then 'REGISTRATION_CLOSED'
    when 'REOPEN_REGISTRATION' then 'REGISTRATION_OPEN'
    when 'START' then 'IN_PROGRESS'
    when 'FINISH' then 'FINISHED'
    when 'CANCEL' then 'CANCELLED'
    else null
  end;

  if v_next_status is null then raise exception 'EVENT_ACTION_INVALID'; end if;
  if not (
    (p_action = 'PUBLISH' and v_event.status = 'DRAFT')
    or (p_action = 'OPEN_REGISTRATION' and v_event.status in ('PUBLISHED','REGISTRATION_CLOSED'))
    or (p_action = 'CLOSE_REGISTRATION' and v_event.status = 'REGISTRATION_OPEN')
    or (p_action = 'REOPEN_REGISTRATION' and v_event.status in ('PUBLISHED','REGISTRATION_CLOSED'))
    or (p_action = 'START' and v_event.status in ('PUBLISHED','REGISTRATION_OPEN','REGISTRATION_CLOSED'))
    or (p_action = 'FINISH' and v_event.status = 'IN_PROGRESS')
    or (p_action = 'CANCEL' and v_event.status not in ('FINISHED','CANCELLED'))
  ) then
    raise exception 'EVENT_TRANSITION_INVALID';
  end if;

  if p_action = 'PUBLISH' and (
    btrim(v_event.name) = '' or v_event.starts_at is null
    or (v_event.visibility = 'PUBLIC' and (v_event.slug is null or btrim(v_event.slug) = ''))
  ) then
    raise exception 'EVENT_NOT_READY_TO_PUBLISH';
  end if;
  if p_action = 'CANCEL' and coalesce(btrim(p_reason), '') = '' then
    raise exception 'EVENT_CANCEL_REASON_REQUIRED';
  end if;

  update public.events
  set status = v_next_status,
      updated_by = v_actor,
      published_at = case when p_action = 'PUBLISH' then now() else published_at end,
      published_by = case when p_action = 'PUBLISH' then v_actor else published_by end,
      cancelled_at = case when p_action = 'CANCEL' then now() else cancelled_at end,
      cancelled_by = case when p_action = 'CANCEL' then v_actor else cancelled_by end,
      cancel_reason = case when p_action = 'CANCEL' then btrim(p_reason) else cancel_reason end,
      finished_at = case when p_action = 'FINISH' then now() else finished_at end,
      finished_by = case when p_action = 'FINISH' then v_actor else finished_by end
  where id = p_event_id
  returning * into v_event;

  perform public.log_audit(
    v_event.church_id, 'EVENTS', p_action, 'EVENT', v_event.id, v_event.name,
    'Ciclo de vida do evento alterado',
    jsonb_build_object('status', v_old_status),
    jsonb_build_object('status', v_next_status, 'reason', p_reason),
    '{}'::jsonb, case when p_action = 'CANCEL' then 'WARNING' else 'INFO' end
  );

  return v_event;
end;
$$;

create or replace function private.recalculate_event_registration(p_registration_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_paid numeric(12,2);
  v_total numeric(12,2);
begin
  select registration.total_amount into v_total
  from public.event_registrations registration
  where registration.id = p_registration_id
  for update;

  if not found then return; end if;

  select coalesce(sum(payment.amount), 0)
  into v_paid
  from public.event_payments payment
  where payment.event_registration_id = p_registration_id
    and payment.payment_status = 'CONFIRMED'
    and payment.deleted_at is null;

  update public.event_registrations
  set paid_amount = least(v_paid, v_total),
      payment_status = case
        when v_total <= 0 or v_paid >= v_total then 'PAID'
        when v_paid > 0 then 'PARTIAL'
        else 'PENDING'
      end
  where id = p_registration_id;
end;
$$;

create or replace function private.recalculate_event_group(p_group_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.event_groups event_group
  set total_registrations = stats.total,
      male_count = stats.male,
      female_count = stats.female
  from (
    select count(*)::integer as total,
      count(*) filter (where registration.participant_gender = 'MALE')::integer as male,
      count(*) filter (where registration.participant_gender = 'FEMALE')::integer as female
    from public.event_registrations registration
    where registration.event_group_id = p_group_id
      and registration.status in ('PENDING','CONFIRMED')
      and registration.deleted_at is null
  ) stats
  where event_group.id = p_group_id;
end;
$$;

create or replace function public.get_event_stats(p_church_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  with allowed_events as (
    select event.id, event.status, event.starts_at
    from public.events event
    where event.church_id = p_church_id
      and event.deleted_at is null
      and (select private.can_access_event_values(
        event.church_id, event.event_scope, event.region_id,
        event.congregation_id, event.ministry_id, 'events.view'
      ))
  )
  select jsonb_build_object(
    'total', count(*),
    'draft', count(*) filter (where status = 'DRAFT'),
    'open', count(*) filter (where status = 'REGISTRATION_OPEN'),
    'upcoming', count(*) filter (where starts_at > now() and status not in ('CANCELLED','FINISHED')),
    'finished', count(*) filter (where status = 'FINISHED'),
    'cancelled', count(*) filter (where status = 'CANCELLED')
  )
  from allowed_events;
$$;

create or replace function public.reconcile_event_aggregates(p_event_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_group record;
  v_registration record;
  v_result jsonb;
  v_church_id uuid;
begin
  if not (
    (select private.can_access_event_id(p_event_id, 'events.manage'))
    or (select private.can_access_event_id(p_event_id, 'events.reports.export'))
  ) then raise exception 'EVENT_ACCESS_DENIED'; end if;

  select church_id into v_church_id from public.events where id = p_event_id;

  for v_registration in
    select id from public.event_registrations where event_id = p_event_id and deleted_at is null order by id
  loop
    perform private.recalculate_event_registration(v_registration.id);
  end loop;

  for v_group in
    select id from public.event_groups where event_id = p_event_id and deleted_at is null order by id
  loop
    perform private.recalculate_event_group(v_group.id);
  end loop;

  select jsonb_build_object(
    'registrations', count(*),
    'confirmed', count(*) filter (where status = 'CONFIRMED'),
    'waiting', count(*) filter (where status = 'WAITLIST')
  ) into v_result
  from public.event_registrations
  where event_id = p_event_id and deleted_at is null;

  perform public.log_audit(v_church_id, 'EVENTS', 'RECONCILE', 'EVENT', p_event_id, null,
    'Agregados do evento reconciliados', null, v_result, '{}'::jsonb, 'INFO');
  return v_result;
end;
$$;

revoke all on function public.change_event_lifecycle(uuid, text, text) from public, anon;
revoke all on function public.get_event_stats(uuid) from public, anon;
revoke all on function public.reconcile_event_aggregates(uuid) from public, anon;
grant execute on function public.change_event_lifecycle(uuid, text, text) to authenticated;
grant execute on function public.get_event_stats(uuid) to authenticated;
grant execute on function public.reconcile_event_aggregates(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Operações transacionais do domínio
-- ---------------------------------------------------------------------------

create or replace function public.create_event_registration(
  p_event_id uuid,
  p_payload jsonb,
  p_idempotency_key text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_event public.events%rowtype;
  v_registration public.event_registrations%rowtype;
  v_batch public.event_registration_batches%rowtype;
  v_group public.event_groups%rowtype;
  v_item jsonb;
  v_catalog_item public.event_items%rowtype;
  v_actor uuid := (select auth.uid());
  v_service boolean := (select private.is_service_request());
  v_active_count integer;
  v_quota integer;
  v_quota_used integer;
  v_batch_used integer;
  v_item_used integer;
  v_sequence integer;
  v_total numeric(12,2) := 0;
  v_quantity integer;
  v_status text := 'PENDING';
  v_token text := encode(extensions.gen_random_bytes(24), 'hex');
  v_document_normalized text := nullif(regexp_replace(coalesce(p_payload->>'participantDocument', ''), '\\D', '', 'g'), '');
  v_group_id uuid := nullif(p_payload->>'eventGroupId', '')::uuid;
  v_batch_id uuid := nullif(p_payload->>'batchId', '')::uuid;
  v_congregation_id uuid := nullif(p_payload->>'congregationId', '')::uuid;
  v_items jsonb := coalesce(p_payload->'items', '[]'::jsonb);
begin
  select * into v_event
  from public.events
  where id = p_event_id and deleted_at is null
  for update;

  if not found then raise exception 'EVENT_NOT_FOUND'; end if;
  if v_service then
    if coalesce(p_payload->>'registrationSource', 'PUBLIC') not in ('PUBLIC','GROUP')
      or v_event.visibility <> 'PUBLIC' then
      raise exception 'EVENT_PUBLIC_ACCESS_DENIED';
    end if;
  elsif not (select private.can_access_event_id(p_event_id, 'events.registrations.manage')) then
    raise exception 'EVENT_ACCESS_DENIED';
  end if;

  if p_idempotency_key is not null then
    select * into v_registration
    from public.event_registrations
    where event_id = p_event_id and idempotency_key = p_idempotency_key;
    if found then
      return jsonb_build_object(
        'registrationId', v_registration.id,
        'registrationNumber', v_registration.registration_number,
        'status', v_registration.status,
        'totalAmount', v_registration.total_amount,
        'idempotentReplay', true
      );
    end if;
  end if;

  if v_event.status <> 'REGISTRATION_OPEN'
    or (v_event.registration_starts_at is not null and now() < v_event.registration_starts_at)
    or (v_event.registration_ends_at is not null and now() > v_event.registration_ends_at) then
    raise exception 'EVENT_REGISTRATION_CLOSED';
  end if;
  if coalesce(btrim(p_payload->>'participantName'), '') = '' then
    raise exception 'PARTICIPANT_NAME_REQUIRED';
  end if;

  if nullif(p_payload->>'memberId', '') is not null and exists (
    select 1 from public.event_registrations
    where event_id = p_event_id
      and member_id = (p_payload->>'memberId')::uuid
      and status in ('PENDING','CONFIRMED','WAITLIST') and deleted_at is null
  ) then raise exception 'EVENT_REGISTRATION_DUPLICATE_MEMBER'; end if;
  if v_document_normalized is not null and exists (
    select 1 from public.event_registrations
    where event_id = p_event_id and participant_document_normalized = v_document_normalized
      and status in ('PENDING','CONFIRMED','WAITLIST') and deleted_at is null
  ) then raise exception 'EVENT_REGISTRATION_DUPLICATE_DOCUMENT'; end if;

  if v_group_id is not null then
    select * into v_group from public.event_groups
    where id = v_group_id and event_id = p_event_id and deleted_at is null;
    if not found then raise exception 'EVENT_GROUP_NOT_FOUND'; end if;
  end if;

  if v_event.uses_registration_batches then
    if v_batch_id is null then raise exception 'EVENT_BATCH_REQUIRED'; end if;
    select * into v_batch from public.event_registration_batches
    where id = v_batch_id and event_id = p_event_id and is_active and deleted_at is null;
    if not found then raise exception 'EVENT_BATCH_NOT_AVAILABLE'; end if;
    if (v_batch.starts_at is not null and now() < v_batch.starts_at)
      or (v_batch.ends_at is not null and now() > v_batch.ends_at) then
      raise exception 'EVENT_BATCH_NOT_AVAILABLE';
    end if;
    select count(*) into v_batch_used from public.event_registrations
    where event_registration_batch_id = v_batch_id
      and status in ('PENDING','CONFIRMED') and deleted_at is null;
    if v_batch.capacity is not null and v_batch_used >= v_batch.capacity then
      if v_event.allow_waitlist then v_status := 'WAITLIST'; else raise exception 'EVENT_BATCH_FULL'; end if;
    end if;
    v_total := v_total + v_batch.price;
  end if;

  select count(*) into v_active_count
  from public.event_registrations
  where event_id = p_event_id and status in ('PENDING','CONFIRMED') and deleted_at is null;
  if v_event.capacity is not null and v_active_count >= v_event.capacity then
    if v_event.allow_waitlist then v_status := 'WAITLIST'; else raise exception 'EVENT_CAPACITY_FULL'; end if;
  end if;

  if v_event.quota_mode = 'BY_CONGREGATION' then
    if v_congregation_id is null then raise exception 'EVENT_CONGREGATION_REQUIRED'; end if;
    select quota_total into v_quota from public.event_congregation_quotas
    where event_id = p_event_id and congregation_id = v_congregation_id and deleted_at is null;
    if not found then raise exception 'EVENT_CONGREGATION_QUOTA_NOT_CONFIGURED'; end if;
    select count(*) into v_quota_used from public.event_registrations
    where event_id = p_event_id and congregation_id = v_congregation_id
      and status in ('PENDING','CONFIRMED') and deleted_at is null;
    if v_quota_used >= v_quota then
      if v_event.allow_waitlist then v_status := 'WAITLIST'; else raise exception 'EVENT_CONGREGATION_QUOTA_FULL'; end if;
    end if;
  elsif v_event.quota_mode = 'BY_CITY' then
    select quota_total into v_quota from public.event_city_quotas
    where event_id = p_event_id
      and lower(city) = lower(coalesce(p_payload->>'participantCity', ''))
      and upper(state) = upper(coalesce(p_payload->>'participantState', ''))
      and deleted_at is null;
    if not found then raise exception 'EVENT_CITY_QUOTA_NOT_CONFIGURED'; end if;
    select count(*) into v_quota_used from public.event_registrations
    where event_id = p_event_id
      and lower(participant_city) = lower(coalesce(p_payload->>'participantCity', ''))
      and upper(participant_state) = upper(coalesce(p_payload->>'participantState', ''))
      and status in ('PENDING','CONFIRMED') and deleted_at is null;
    if v_quota_used >= v_quota then
      if v_event.allow_waitlist then v_status := 'WAITLIST'; else raise exception 'EVENT_CITY_QUOTA_FULL'; end if;
    end if;
  end if;

  if jsonb_typeof(v_items) <> 'array' then raise exception 'EVENT_ITEMS_INVALID'; end if;
  if exists (
    select 1 from public.event_items required_item
    where required_item.event_id = p_event_id and required_item.is_required
      and required_item.is_active and required_item.deleted_at is null
      and not exists (
        select 1 from jsonb_array_elements(v_items) selected
        where nullif(selected->>'itemId', '')::uuid = required_item.id
      )
  ) then raise exception 'EVENT_REQUIRED_ITEM_MISSING'; end if;

  for v_item in select * from jsonb_array_elements(v_items)
  loop
    select * into v_catalog_item from public.event_items
    where id = nullif(v_item->>'itemId', '')::uuid
      and event_id = p_event_id and is_active and deleted_at is null
    for update;
    if not found then raise exception 'EVENT_ITEM_NOT_AVAILABLE'; end if;
    v_quantity := coalesce((v_item->>'quantity')::integer, 1);
    if v_quantity < greatest(v_catalog_item.min_quantity, 1)
      or (v_catalog_item.max_quantity is not null and v_quantity > v_catalog_item.max_quantity)
      or (not v_catalog_item.allow_quantity and v_quantity <> 1) then
      raise exception 'EVENT_ITEM_QUANTITY_INVALID';
    end if;
    select coalesce(sum(registration_item.quantity), 0)::integer into v_item_used
    from public.event_registration_items registration_item
    left join public.event_registrations registration on registration.id = registration_item.event_registration_id
    where registration_item.event_item_id = v_catalog_item.id
      and registration_item.deleted_at is null
      and (registration_item.event_registration_id is null or (
        registration.status in ('PENDING','CONFIRMED') and registration.deleted_at is null
      ));
    if v_catalog_item.available_quantity is not null and v_item_used + v_quantity > v_catalog_item.available_quantity then
      raise exception 'EVENT_ITEM_STOCK_EXCEEDED';
    end if;
    v_total := v_total + round(v_catalog_item.price * v_quantity, 2);
  end loop;

  update public.events set registration_sequence = registration_sequence + 1
  where id = p_event_id returning registration_sequence into v_sequence;

  insert into public.event_registrations (
    church_id, event_id, event_group_id, event_registration_batch_id, member_id, congregation_id,
    registration_number, registration_source, participant_type, participant_name,
    participant_document, participant_document_normalized, participant_birth_date, participant_gender,
    participant_phone, participant_email, participant_city, participant_state,
    responsible_name, responsible_phone, consent_version, consent_at,
    status, payment_status, total_amount, paid_amount,
    qr_token_hash, qr_token_last4, reservation_expires_at, idempotency_key,
    notes, metadata, created_by, updated_by, confirmed_at
  ) values (
    v_event.church_id, p_event_id, v_group_id, v_batch_id,
    nullif(p_payload->>'memberId', '')::uuid, v_congregation_id,
    upper(left(coalesce(v_event.public_code, 'EVT'), 6)) || '-' || lpad(v_sequence::text, 6, '0'),
    coalesce(p_payload->>'registrationSource', case when v_service then 'PUBLIC' else 'INTERNAL' end),
    coalesce(p_payload->>'participantType', 'VISITOR'), btrim(p_payload->>'participantName'),
    nullif(btrim(p_payload->>'participantDocument'), ''), v_document_normalized,
    nullif(p_payload->>'participantBirthDate', '')::date, nullif(p_payload->>'participantGender', ''),
    nullif(btrim(p_payload->>'participantPhone'), ''), nullif(lower(btrim(p_payload->>'participantEmail')), ''),
    nullif(btrim(p_payload->>'participantCity'), ''), nullif(upper(btrim(p_payload->>'participantState')), ''),
    nullif(btrim(p_payload->>'responsibleName'), ''), nullif(btrim(p_payload->>'responsiblePhone'), ''),
    nullif(p_payload->>'consentVersion', ''), case when coalesce((p_payload->>'consentAccepted')::boolean, false) then now() else null end,
    v_status, case when v_total <= 0 then 'NOT_REQUIRED' else 'PENDING' end,
    v_total, 0, encode(extensions.digest(v_token, 'sha256'), 'hex'), right(v_token, 4),
    case when v_status = 'PENDING' and v_total > 0 then now() + interval '30 minutes' else null end,
    p_idempotency_key, nullif(btrim(p_payload->>'notes'), ''),
    coalesce(p_payload->'metadata', '{}'::jsonb), v_actor, v_actor,
    case when v_status = 'CONFIRMED' then now() else null end
  ) returning * into v_registration;

  for v_item in select * from jsonb_array_elements(v_items)
  loop
    select * into v_catalog_item from public.event_items
    where id = (v_item->>'itemId')::uuid and event_id = p_event_id;
    v_quantity := coalesce((v_item->>'quantity')::integer, 1);
    insert into public.event_registration_items (
      church_id, event_id, event_registration_id, event_item_id, event_registration_batch_id,
      item_name, item_type, size, quantity, unit_price, observation, metadata, created_by, updated_by
    ) values (
      v_event.church_id, p_event_id, v_registration.id, v_catalog_item.id, v_batch_id,
      v_catalog_item.name, v_catalog_item.item_type, nullif(v_item->>'size', ''),
      v_quantity, v_catalog_item.price, nullif(v_item->>'observation', ''),
      coalesce(v_item->'metadata', '{}'::jsonb), v_actor, v_actor
    );
  end loop;

  if v_group_id is not null then perform private.recalculate_event_group(v_group_id); end if;
  perform public.log_audit(v_event.church_id, 'EVENTS', 'CREATE_REGISTRATION', 'EVENT_REGISTRATION',
    v_registration.id, v_registration.registration_number, 'Inscrição criada', null,
    jsonb_build_object('event_id', p_event_id, 'status', v_status, 'total_amount', v_total),
    '{}'::jsonb, 'INFO');

  return jsonb_build_object(
    'registrationId', v_registration.id,
    'registrationNumber', v_registration.registration_number,
    'status', v_registration.status,
    'paymentStatus', v_registration.payment_status,
    'totalAmount', v_registration.total_amount,
    'reservationExpiresAt', v_registration.reservation_expires_at,
    'qrToken', v_token,
    'idempotentReplay', false
  );
exception
  when unique_violation then
    raise exception 'EVENT_REGISTRATION_DUPLICATE';
end;
$$;

create or replace function public.cancel_event_registration(
  p_registration_id uuid,
  p_reason text
)
returns public.event_registrations
language plpgsql
security definer
set search_path = ''
as $$
declare v_registration public.event_registrations%rowtype; v_actor uuid := (select auth.uid());
begin
  select * into v_registration from public.event_registrations
  where id = p_registration_id and deleted_at is null for update;
  if not found then raise exception 'EVENT_REGISTRATION_NOT_FOUND'; end if;
  if not (select private.can_access_event_id(v_registration.event_id, 'events.registrations.manage')) then raise exception 'EVENT_ACCESS_DENIED'; end if;
  if v_registration.status in ('CANCELLED','EXPIRED') then raise exception 'EVENT_REGISTRATION_ALREADY_INACTIVE'; end if;
  if coalesce(btrim(p_reason), '') = '' then raise exception 'EVENT_CANCEL_REASON_REQUIRED'; end if;
  update public.event_registrations set status = 'CANCELLED', cancelled_at = now(), cancelled_by = v_actor,
    cancel_reason = btrim(p_reason), updated_by = v_actor
  where id = p_registration_id returning * into v_registration;
  update public.event_checkins set status = 'CANCELLED', cancelled_at = now(), cancelled_by = v_actor,
    cancel_reason = 'Inscrição cancelada'
  where event_registration_id = p_registration_id and status = 'CHECKED_IN' and deleted_at is null;
  if v_registration.event_group_id is not null then perform private.recalculate_event_group(v_registration.event_group_id); end if;
  perform public.log_audit(v_registration.church_id, 'EVENTS', 'CANCEL_REGISTRATION', 'EVENT_REGISTRATION',
    v_registration.id, v_registration.registration_number, 'Inscrição cancelada', null,
    jsonb_build_object('reason', p_reason), '{}'::jsonb, 'WARNING');
  return v_registration;
end;
$$;

create or replace function public.promote_event_waitlist(p_registration_id uuid)
returns public.event_registrations
language plpgsql
security definer
set search_path = ''
as $$
declare v_registration public.event_registrations%rowtype; v_event public.events%rowtype; v_used integer; v_actor uuid := (select auth.uid());
begin
  select * into v_registration from public.event_registrations where id = p_registration_id and deleted_at is null for update;
  if not found or v_registration.status <> 'WAITLIST' then raise exception 'EVENT_WAITLIST_REGISTRATION_NOT_FOUND'; end if;
  select * into v_event from public.events where id = v_registration.event_id for update;
  if not (select private.can_access_event_id(v_event.id, 'events.registrations.manage')) then raise exception 'EVENT_ACCESS_DENIED'; end if;
  select count(*) into v_used from public.event_registrations where event_id = v_event.id and status in ('PENDING','CONFIRMED') and deleted_at is null;
  if v_event.capacity is not null and v_used >= v_event.capacity then raise exception 'EVENT_CAPACITY_FULL'; end if;
  update public.event_registrations set status = case when total_amount > paid_amount then 'PENDING' else 'CONFIRMED' end,
    confirmed_at = case when total_amount <= paid_amount then now() else null end,
    reservation_expires_at = case when total_amount > paid_amount then now() + interval '30 minutes' else null end,
    updated_by = v_actor where id = p_registration_id returning * into v_registration;
  if v_registration.event_group_id is not null then perform private.recalculate_event_group(v_registration.event_group_id); end if;
  return v_registration;
end;
$$;

create or replace function public.create_event_group(
  p_event_id uuid,
  p_payload jsonb,
  p_participants jsonb,
  p_idempotency_key text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_event public.events%rowtype; v_group public.event_groups%rowtype; v_participant jsonb;
  v_created jsonb; v_results jsonb := '[]'::jsonb; v_actor uuid := (select auth.uid());
  v_service boolean := (select private.is_service_request()); v_participant_key text;
begin
  select * into v_event from public.events where id = p_event_id and deleted_at is null for update;
  if not found then raise exception 'EVENT_NOT_FOUND'; end if;
  if v_service then
    if v_event.visibility <> 'PUBLIC' then raise exception 'EVENT_PUBLIC_ACCESS_DENIED'; end if;
  elsif not (select private.can_access_event_id(p_event_id, 'events.registrations.manage')) then raise exception 'EVENT_ACCESS_DENIED'; end if;
  if v_event.registration_mode not in ('GROUP','MIXED') then raise exception 'EVENT_GROUP_REGISTRATION_DISABLED'; end if;
  if jsonb_typeof(p_participants) <> 'array' or jsonb_array_length(p_participants) = 0 then raise exception 'EVENT_GROUP_PARTICIPANTS_REQUIRED'; end if;
  if p_idempotency_key is not null then
    select * into v_group from public.event_groups where event_id = p_event_id and idempotency_key = p_idempotency_key;
    if found then return jsonb_build_object('groupId', v_group.id, 'idempotentReplay', true); end if;
  end if;
  insert into public.event_groups (
    church_id, event_id, origin_church_name, origin_field_name, origin_city, origin_state,
    responsible_name, responsible_phone, responsible_email, pastor_name, pastor_phone,
    status, notes, idempotency_key, created_by, updated_by
  ) values (
    v_event.church_id, p_event_id, nullif(btrim(p_payload->>'originChurchName'), ''),
    nullif(btrim(p_payload->>'originFieldName'), ''), btrim(p_payload->>'originCity'),
    upper(coalesce(nullif(btrim(p_payload->>'originState'), ''), 'GO')),
    btrim(p_payload->>'responsibleName'), nullif(btrim(p_payload->>'responsiblePhone'), ''),
    nullif(lower(btrim(p_payload->>'responsibleEmail')), ''), nullif(btrim(p_payload->>'pastorName'), ''),
    nullif(btrim(p_payload->>'pastorPhone'), ''), 'PENDING', nullif(btrim(p_payload->>'notes'), ''),
    p_idempotency_key, v_actor, v_actor
  ) returning * into v_group;
  for v_participant in select * from jsonb_array_elements(p_participants)
  loop
    v_participant_key := case when p_idempotency_key is null then null
      else p_idempotency_key || ':' || coalesce(v_participant->>'clientKey', md5(v_participant::text)) end;
    v_created := public.create_event_registration(p_event_id,
      v_participant || jsonb_build_object(
        'eventGroupId', v_group.id, 'registrationSource', 'GROUP',
        'participantCity', coalesce(v_participant->>'participantCity', v_group.origin_city),
        'participantState', coalesce(v_participant->>'participantState', v_group.origin_state)
      ), v_participant_key);
    v_results := v_results || jsonb_build_array(v_created);
  end loop;
  perform private.recalculate_event_group(v_group.id);
  return jsonb_build_object('groupId', v_group.id, 'registrations', v_results, 'idempotentReplay', false);
end;
$$;

create or replace function public.record_event_payment(
  p_event_id uuid,
  p_owner_type text,
  p_owner_id uuid,
  p_payload jsonb,
  p_idempotency_key text default null
)
returns public.event_payments
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_event public.events%rowtype; v_payment public.event_payments%rowtype; v_registration public.event_registrations%rowtype;
  v_group public.event_groups%rowtype; v_amount numeric(12,2); v_number integer; v_actor uuid := (select auth.uid());
begin
  select * into v_event from public.events where id = p_event_id and deleted_at is null for update;
  if not found then raise exception 'EVENT_NOT_FOUND'; end if;
  if not (select private.can_access_event_id(p_event_id, 'events.payments.manage')) then raise exception 'EVENT_ACCESS_DENIED'; end if;
  if p_idempotency_key is not null then
    select * into v_payment from public.event_payments where event_id = p_event_id and idempotency_key = p_idempotency_key;
    if found then return v_payment; end if;
  end if;
  v_amount := (p_payload->>'amount')::numeric;
  if v_amount <= 0 then raise exception 'EVENT_PAYMENT_AMOUNT_INVALID'; end if;
  if upper(p_owner_type) = 'REGISTRATION' then
    select * into v_registration from public.event_registrations where id = p_owner_id and event_id = p_event_id and deleted_at is null for update;
    if not found then raise exception 'EVENT_REGISTRATION_NOT_FOUND'; end if;
    if v_amount > v_registration.remaining_amount then raise exception 'EVENT_PAYMENT_EXCEEDS_BALANCE'; end if;
  elsif upper(p_owner_type) = 'GROUP' then
    select * into v_group from public.event_groups where id = p_owner_id and event_id = p_event_id and deleted_at is null for update;
    if not found then raise exception 'EVENT_GROUP_NOT_FOUND'; end if;
  else raise exception 'EVENT_PAYMENT_OWNER_INVALID'; end if;
  select count(*) + 1 into v_number from public.event_payments where event_id = p_event_id;
  insert into public.event_payments (
    church_id, event_id, event_registration_id, event_group_id, payment_number,
    payment_method, payment_status, amount, paid_at, due_date, installment_number,
    installments_total, payer_name, payer_document, transaction_reference, idempotency_key,
    confirmed_by, notes, metadata, created_by, updated_by
  ) values (
    v_event.church_id, p_event_id,
    case when upper(p_owner_type) = 'REGISTRATION' then p_owner_id else null end,
    case when upper(p_owner_type) = 'GROUP' then p_owner_id else null end,
    upper(left(v_event.public_code, 6)) || '-P' || lpad(v_number::text, 6, '0'),
    coalesce(p_payload->>'paymentMethod', 'PIX'), coalesce(p_payload->>'paymentStatus', 'PENDING'), v_amount,
    case when coalesce(p_payload->>'paymentStatus', 'PENDING') = 'CONFIRMED' then coalesce(nullif(p_payload->>'paidAt','')::timestamptz, now()) else null end,
    nullif(p_payload->>'dueDate','')::date, coalesce((p_payload->>'installmentNumber')::integer, 1),
    coalesce((p_payload->>'installmentsTotal')::integer, 1), nullif(btrim(p_payload->>'payerName'), ''),
    nullif(btrim(p_payload->>'payerDocument'), ''), nullif(btrim(p_payload->>'transactionReference'), ''),
    p_idempotency_key, case when coalesce(p_payload->>'paymentStatus', 'PENDING') = 'CONFIRMED' then v_actor else null end,
    nullif(btrim(p_payload->>'notes'), ''), coalesce(p_payload->'metadata','{}'::jsonb), v_actor, v_actor
  ) returning * into v_payment;
  if v_payment.event_registration_id is not null then perform private.recalculate_event_registration(v_payment.event_registration_id); end if;
  return v_payment;
end;
$$;

create or replace function public.change_event_payment_status(
  p_payment_id uuid,
  p_status text,
  p_reason text default null
)
returns public.event_payments
language plpgsql
security definer
set search_path = ''
as $$
declare v_payment public.event_payments%rowtype; v_actor uuid := (select auth.uid()); v_status text := upper(p_status);
begin
  select * into v_payment from public.event_payments where id = p_payment_id and deleted_at is null for update;
  if not found then raise exception 'EVENT_PAYMENT_NOT_FOUND'; end if;
  if not (select private.can_access_event_id(v_payment.event_id, 'events.payments.manage')) then raise exception 'EVENT_ACCESS_DENIED'; end if;
  if v_status not in ('CONFIRMED','FAILED','CANCELLED','REFUNDED') then raise exception 'EVENT_PAYMENT_STATUS_INVALID'; end if;
  if v_status in ('FAILED','CANCELLED','REFUNDED') and coalesce(btrim(p_reason), '') = '' then raise exception 'EVENT_PAYMENT_REASON_REQUIRED'; end if;
  if v_status = 'REFUNDED' and v_payment.payment_status <> 'CONFIRMED' then raise exception 'EVENT_PAYMENT_REFUND_INVALID'; end if;
  update public.event_payments set payment_status = v_status, updated_by = v_actor,
    paid_at = case when v_status = 'CONFIRMED' then coalesce(paid_at, now()) else paid_at end,
    confirmed_by = case when v_status = 'CONFIRMED' then v_actor else confirmed_by end,
    failed_at = case when v_status = 'FAILED' then now() else failed_at end,
    failed_by = case when v_status = 'FAILED' then v_actor else failed_by end,
    failure_reason = case when v_status = 'FAILED' then btrim(p_reason) else failure_reason end,
    cancelled_at = case when v_status = 'CANCELLED' then now() else cancelled_at end,
    cancelled_by = case when v_status = 'CANCELLED' then v_actor else cancelled_by end,
    cancel_reason = case when v_status = 'CANCELLED' then btrim(p_reason) else cancel_reason end,
    refunded_at = case when v_status = 'REFUNDED' then now() else refunded_at end,
    refunded_by = case when v_status = 'REFUNDED' then v_actor else refunded_by end,
    refund_reason = case when v_status = 'REFUNDED' then btrim(p_reason) else refund_reason end
  where id = p_payment_id returning * into v_payment;
  if v_payment.event_registration_id is not null then perform private.recalculate_event_registration(v_payment.event_registration_id); end if;
  return v_payment;
end;
$$;

create or replace function public.register_event_checkin(
  p_event_id uuid,
  p_registration_id uuid default null,
  p_qr_token text default null,
  p_method text default 'MANUAL',
  p_notes text default null,
  p_idempotency_key text default null
)
returns public.event_checkins
language plpgsql
security definer
set search_path = ''
as $$
declare v_registration public.event_registrations%rowtype; v_checkin public.event_checkins%rowtype; v_actor uuid := (select auth.uid()); v_method text := upper(p_method);
begin
  if not (select private.can_access_event_id(p_event_id, 'events.checkin')) then raise exception 'EVENT_ACCESS_DENIED'; end if;
  if p_idempotency_key is not null then
    select * into v_checkin from public.event_checkins where event_id = p_event_id and idempotency_key = p_idempotency_key;
    if found then return v_checkin; end if;
  end if;
  if p_qr_token is not null then
    select * into v_registration from public.event_registrations
    where event_id = p_event_id and qr_token_hash = encode(extensions.digest(p_qr_token, 'sha256'), 'hex') and deleted_at is null for update;
    v_method := 'QR_CODE';
  else
    select * into v_registration from public.event_registrations
    where event_id = p_event_id and id = p_registration_id and deleted_at is null for update;
  end if;
  if not found then raise exception 'EVENT_REGISTRATION_NOT_FOUND'; end if;
  if v_registration.status <> 'CONFIRMED' then raise exception 'EVENT_CHECKIN_REGISTRATION_NOT_CONFIRMED'; end if;
  if exists (select 1 from public.event_checkins where event_registration_id = v_registration.id and status = 'CHECKED_IN' and deleted_at is null) then
    raise exception 'EVENT_CHECKIN_ALREADY_EXISTS';
  end if;
  insert into public.event_checkins (
    church_id, event_id, event_registration_id, event_group_id, checkin_code,
    checkin_method, status, checked_in_at, checked_in_by, idempotency_key, notes
  ) values (
    v_registration.church_id, p_event_id, v_registration.id, v_registration.event_group_id,
    v_registration.registration_number, v_method, 'CHECKED_IN', now(), v_actor, p_idempotency_key, nullif(btrim(p_notes), '')
  ) returning * into v_checkin;
  return v_checkin;
end;
$$;

create or replace function public.reverse_event_checkin(p_checkin_id uuid, p_reason text)
returns public.event_checkins
language plpgsql
security definer
set search_path = ''
as $$
declare v_checkin public.event_checkins%rowtype; v_actor uuid := (select auth.uid());
begin
  select * into v_checkin from public.event_checkins where id = p_checkin_id and deleted_at is null for update;
  if not found then raise exception 'EVENT_CHECKIN_NOT_FOUND'; end if;
  if not (select private.can_access_event_id(v_checkin.event_id, 'events.checkin')) then raise exception 'EVENT_ACCESS_DENIED'; end if;
  if v_checkin.status <> 'CHECKED_IN' then raise exception 'EVENT_CHECKIN_ALREADY_REVERSED'; end if;
  if coalesce(btrim(p_reason), '') = '' then raise exception 'EVENT_CHECKIN_REASON_REQUIRED'; end if;
  update public.event_checkins set status = 'CANCELLED', cancelled_at = now(), cancelled_by = v_actor,
    cancel_reason = btrim(p_reason) where id = p_checkin_id returning * into v_checkin;
  return v_checkin;
end;
$$;

create or replace function public.reissue_event_registration_qr(p_registration_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare v_registration public.event_registrations%rowtype; v_token text := encode(extensions.gen_random_bytes(24), 'hex');
begin
  select * into v_registration from public.event_registrations where id = p_registration_id and deleted_at is null for update;
  if not found then raise exception 'EVENT_REGISTRATION_NOT_FOUND'; end if;
  if not ((select private.can_access_event_id(v_registration.event_id, 'events.registrations.manage'))
    or (select private.can_access_event_id(v_registration.event_id, 'events.checkin'))) then raise exception 'EVENT_ACCESS_DENIED'; end if;
  update public.event_registrations set qr_token_hash = encode(extensions.digest(v_token, 'sha256'), 'hex'), qr_token_last4 = right(v_token, 4),
    updated_by = (select auth.uid()) where id = p_registration_id;
  return jsonb_build_object('registrationId', p_registration_id, 'registrationNumber', v_registration.registration_number, 'qrToken', v_token);
end;
$$;

create or replace function public.expire_event_reservations(p_event_id uuid)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare v_count integer;
begin
  if not ((select private.is_service_request()) or (select private.can_access_event_id(p_event_id, 'events.registrations.manage'))) then
    raise exception 'EVENT_ACCESS_DENIED';
  end if;
  update public.event_registrations set status = 'EXPIRED', cancel_reason = 'Reserva expirada', updated_at = now()
  where event_id = p_event_id and status = 'PENDING' and paid_amount = 0
    and reservation_expires_at is not null and reservation_expires_at < now() and deleted_at is null;
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

revoke all on function public.create_event_registration(uuid, jsonb, text) from public, anon;
revoke all on function public.create_event_group(uuid, jsonb, jsonb, text) from public, anon;
revoke all on function public.cancel_event_registration(uuid, text) from public, anon;
revoke all on function public.promote_event_waitlist(uuid) from public, anon;
revoke all on function public.record_event_payment(uuid, text, uuid, jsonb, text) from public, anon;
revoke all on function public.change_event_payment_status(uuid, text, text) from public, anon;
revoke all on function public.register_event_checkin(uuid, uuid, text, text, text, text) from public, anon;
revoke all on function public.reverse_event_checkin(uuid, text) from public, anon;
revoke all on function public.reissue_event_registration_qr(uuid) from public, anon;
revoke all on function public.expire_event_reservations(uuid) from public, anon;
grant execute on function public.create_event_registration(uuid, jsonb, text) to authenticated, service_role;
grant execute on function public.create_event_group(uuid, jsonb, jsonb, text) to authenticated, service_role;
grant execute on function public.cancel_event_registration(uuid, text) to authenticated;
grant execute on function public.promote_event_waitlist(uuid) to authenticated;
grant execute on function public.record_event_payment(uuid, text, uuid, jsonb, text) to authenticated;
grant execute on function public.change_event_payment_status(uuid, text, text) to authenticated;
grant execute on function public.register_event_checkin(uuid, uuid, text, text, text, text) to authenticated;
grant execute on function public.reverse_event_checkin(uuid, text) to authenticated;
grant execute on function public.reissue_event_registration_qr(uuid) to authenticated;
grant execute on function public.expire_event_reservations(uuid) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- RLS e privilégios da Data API
-- ---------------------------------------------------------------------------

do $$
declare v_table text; v_policy record;
begin
  foreach v_table in array array[
    'events','event_congregation_quotas','event_city_quotas','event_registration_batches',
    'event_groups','event_items','event_registrations','event_registration_items',
    'event_payments','event_checkins','event_documents'
  ] loop
    execute format('alter table public.%I enable row level security', v_table);
    for v_policy in
      select policyname from pg_policies where schemaname = 'public' and tablename = v_table
    loop
      execute format('drop policy if exists %I on public.%I', v_policy.policyname, v_table);
    end loop;
    execute format('revoke all on table public.%I from anon', v_table);
    execute format('revoke all on table public.%I from authenticated', v_table);
    execute format('grant select, insert, update on table public.%I to authenticated', v_table);
    execute format('grant all on table public.%I to service_role', v_table);
  end loop;
end $$;

create policy events_select_scoped on public.events for select to authenticated
using (deleted_at is null and (select private.can_access_event_values(
  church_id, event_scope, region_id, congregation_id, ministry_id, 'events.view'
)));
create policy events_insert_scoped on public.events for insert to authenticated
with check ((select private.can_access_event_values(
  church_id, event_scope, region_id, congregation_id, ministry_id, 'events.manage'
)));
create policy events_update_scoped on public.events for update to authenticated
using (deleted_at is null and (select private.can_access_event_id(id, 'events.manage')))
with check ((select private.can_access_event_values(
  church_id, event_scope, region_id, congregation_id, ministry_id, 'events.manage'
)));

create policy event_congregation_quotas_select_scoped on public.event_congregation_quotas for select to authenticated
using (deleted_at is null and (select private.can_access_event_id(event_id, 'events.view')));
create policy event_congregation_quotas_insert_scoped on public.event_congregation_quotas for insert to authenticated
with check ((select private.can_access_event_id(event_id, 'events.manage')));
create policy event_congregation_quotas_update_scoped on public.event_congregation_quotas for update to authenticated
using ((select private.can_access_event_id(event_id, 'events.manage')))
with check ((select private.can_access_event_id(event_id, 'events.manage')));

create policy event_city_quotas_select_scoped on public.event_city_quotas for select to authenticated
using (deleted_at is null and (select private.can_access_event_id(event_id, 'events.view')));
create policy event_city_quotas_insert_scoped on public.event_city_quotas for insert to authenticated
with check ((select private.can_access_event_id(event_id, 'events.manage')));
create policy event_city_quotas_update_scoped on public.event_city_quotas for update to authenticated
using ((select private.can_access_event_id(event_id, 'events.manage')))
with check ((select private.can_access_event_id(event_id, 'events.manage')));

create policy event_batches_select_scoped on public.event_registration_batches for select to authenticated
using (deleted_at is null and (select private.can_access_event_id(event_id, 'events.view')));
create policy event_batches_insert_scoped on public.event_registration_batches for insert to authenticated
with check ((select private.can_access_event_id(event_id, 'events.manage')));
create policy event_batches_update_scoped on public.event_registration_batches for update to authenticated
using ((select private.can_access_event_id(event_id, 'events.manage')))
with check ((select private.can_access_event_id(event_id, 'events.manage')));

create policy event_items_select_scoped on public.event_items for select to authenticated
using (deleted_at is null and (select private.can_access_event_id(event_id, 'events.view')));
create policy event_items_insert_scoped on public.event_items for insert to authenticated
with check ((select private.can_access_event_id(event_id, 'events.manage')));
create policy event_items_update_scoped on public.event_items for update to authenticated
using ((select private.can_access_event_id(event_id, 'events.manage')))
with check ((select private.can_access_event_id(event_id, 'events.manage')));

create policy event_groups_select_scoped on public.event_groups for select to authenticated
using (deleted_at is null and (select private.can_access_event_id(event_id, 'events.registrations.view')));
create policy event_groups_insert_scoped on public.event_groups for insert to authenticated
with check ((select private.can_access_event_id(event_id, 'events.registrations.manage')));
create policy event_groups_update_scoped on public.event_groups for update to authenticated
using ((select private.can_access_event_id(event_id, 'events.registrations.manage')))
with check ((select private.can_access_event_id(event_id, 'events.registrations.manage')));

create policy event_registrations_select_scoped on public.event_registrations for select to authenticated
using (deleted_at is null and (select private.can_access_event_id(event_id, 'events.registrations.view')));
create policy event_registrations_insert_scoped on public.event_registrations for insert to authenticated
with check ((select private.can_access_event_id(event_id, 'events.registrations.manage')));
create policy event_registrations_update_scoped on public.event_registrations for update to authenticated
using ((select private.can_access_event_id(event_id, 'events.registrations.manage')))
with check ((select private.can_access_event_id(event_id, 'events.registrations.manage')));

create policy event_registration_items_select_scoped on public.event_registration_items for select to authenticated
using (deleted_at is null and (select private.can_access_event_id(event_id, 'events.registrations.view')));
create policy event_registration_items_insert_scoped on public.event_registration_items for insert to authenticated
with check ((select private.can_access_event_id(event_id, 'events.registrations.manage')));
create policy event_registration_items_update_scoped on public.event_registration_items for update to authenticated
using ((select private.can_access_event_id(event_id, 'events.registrations.manage')))
with check ((select private.can_access_event_id(event_id, 'events.registrations.manage')));

create policy event_payments_select_scoped on public.event_payments for select to authenticated
using (deleted_at is null and (select private.can_access_event_id(event_id, 'events.payments.view')));
create policy event_payments_insert_scoped on public.event_payments for insert to authenticated
with check ((select private.can_access_event_id(event_id, 'events.payments.manage')));
create policy event_payments_update_scoped on public.event_payments for update to authenticated
using ((select private.can_access_event_id(event_id, 'events.payments.manage')))
with check ((select private.can_access_event_id(event_id, 'events.payments.manage')));

create policy event_checkins_select_scoped on public.event_checkins for select to authenticated
using (deleted_at is null and (
  (select private.can_access_event_id(event_id, 'events.checkin'))
  or (select private.can_access_event_id(event_id, 'events.registrations.view'))
));
create policy event_checkins_insert_scoped on public.event_checkins for insert to authenticated
with check ((select private.can_access_event_id(event_id, 'events.checkin')));
create policy event_checkins_update_scoped on public.event_checkins for update to authenticated
using ((select private.can_access_event_id(event_id, 'events.checkin')))
with check ((select private.can_access_event_id(event_id, 'events.checkin')));

create policy event_documents_select_scoped on public.event_documents for select to authenticated
using (deleted_at is null and (select private.can_access_event_id(event_id, 'events.documents.view')));
create policy event_documents_insert_scoped on public.event_documents for insert to authenticated
with check ((select private.can_access_event_id(event_id, 'events.documents.manage')));
create policy event_documents_update_scoped on public.event_documents for update to authenticated
using ((select private.can_access_event_id(event_id, 'events.documents.manage')))
with check ((select private.can_access_event_id(event_id, 'events.documents.manage')));

-- ---------------------------------------------------------------------------
-- Storage: documentos privados e mídia pública separada
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'event-documents', 'event-documents', false, 10485760,
  array[
    'application/pdf','image/jpeg','image/png','image/webp',
    'application/msword','application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  ]::text[]
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'event-public-media', 'event-public-media', true, 5242880,
  array['image/jpeg','image/png','image/webp']::text[]
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists event_documents_storage_select on storage.objects;
drop policy if exists event_documents_storage_insert on storage.objects;
drop policy if exists event_documents_storage_update on storage.objects;
drop policy if exists event_documents_storage_delete on storage.objects;
drop policy if exists event_public_media_select on storage.objects;
drop policy if exists event_public_media_insert on storage.objects;
drop policy if exists event_public_media_update on storage.objects;
drop policy if exists event_public_media_delete on storage.objects;

create policy event_documents_storage_select on storage.objects for select to authenticated
using (
  bucket_id = 'event-documents'
  and (storage.foldername(name))[2] = 'events'
  and (select private.can_access_event_id(((storage.foldername(name))[3])::uuid, 'events.documents.view'))
);
create policy event_documents_storage_insert on storage.objects for insert to authenticated
with check (
  bucket_id = 'event-documents'
  and (storage.foldername(name))[2] = 'events'
  and (select private.can_access_event_id(((storage.foldername(name))[3])::uuid, 'events.documents.manage'))
);
create policy event_documents_storage_update on storage.objects for update to authenticated
using (
  bucket_id = 'event-documents'
  and (select private.can_access_event_id(((storage.foldername(name))[3])::uuid, 'events.documents.manage'))
)
with check (
  bucket_id = 'event-documents'
  and (select private.can_access_event_id(((storage.foldername(name))[3])::uuid, 'events.documents.manage'))
);
create policy event_documents_storage_delete on storage.objects for delete to authenticated
using (
  bucket_id = 'event-documents'
  and (select private.can_access_event_id(((storage.foldername(name))[3])::uuid, 'events.documents.manage'))
);

create policy event_public_media_select on storage.objects for select to anon, authenticated
using (bucket_id = 'event-public-media');
create policy event_public_media_insert on storage.objects for insert to authenticated
with check (
  bucket_id = 'event-public-media'
  and (storage.foldername(name))[2] = 'events'
  and (select private.can_access_event_id(((storage.foldername(name))[3])::uuid, 'events.manage'))
);
create policy event_public_media_update on storage.objects for update to authenticated
using (
  bucket_id = 'event-public-media'
  and (select private.can_access_event_id(((storage.foldername(name))[3])::uuid, 'events.manage'))
)
with check (
  bucket_id = 'event-public-media'
  and (select private.can_access_event_id(((storage.foldername(name))[3])::uuid, 'events.manage'))
);
create policy event_public_media_delete on storage.objects for delete to authenticated
using (
  bucket_id = 'event-public-media'
  and (select private.can_access_event_id(((storage.foldername(name))[3])::uuid, 'events.manage'))
);

commit;
