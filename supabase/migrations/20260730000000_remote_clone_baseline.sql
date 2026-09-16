-- Historical schema baseline reconstructed from the 11 audited trial_clone_*
-- migration rows of project dhgrfvakdbtedqfgecys. It contains schema metadata
-- only; no production table data, credentials, or secrets are included.

-- Source: remote migration 20260808000035_trial_clone_public_tables
create extension if not exists pgcrypto with schema extensions;
create extension if not exists pg_trgm with schema extensions;
create table public.accounts_payable (id uuid default gen_random_uuid() not null,
  church_id uuid not null,
  congregation_id uuid,
  department_id uuid,
  category_id uuid,
  cashbox_id uuid,
  payment_method_id uuid,
  financial_transaction_id uuid,
  payable_number text,
  description text not null,
  supplier_name text,
  document_number text,
  amount numeric(12,2) default 0 not null,
  due_date date not null,
  paid_at timestamp with time zone,
  status text default 'PENDING'::text not null,
  payment_reference text,
  has_attachment boolean default false not null,
  notes text,
  metadata jsonb default jsonb_build_object('source', 'manual', 'generates_transaction', false, 'transaction_generated', false) not null,
  created_by uuid,
  paid_by uuid,
  cancelled_by uuid,
  cancelled_at timestamp with time zone,
  cancel_reason text,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null,
  deleted_at timestamp with time zone,
  constraint accounts_payable_pkey PRIMARY KEY (id));
create table public.app_settings (id uuid default gen_random_uuid() not null,
  church_id uuid not null,
  app_name text default 'Eclesias'::text not null,
  display_church_name text,
  logo_url text,
  favicon_url text,
  primary_color text default '#0b51b7'::text,
  secondary_color text default '#090f4d'::text,
  member_code_prefix text default 'MEM'::text,
  member_code_next_number integer default 1 not null,
  member_code_padding integer default 4 not null,
  enable_member_auto_code boolean default true not null,
  default_country text default 'Brasil'::text not null,
  default_state text,
  default_city text,
  max_upload_size_mb integer default 10 not null,
  allow_sensitive_documents boolean default true not null,
  enable_audit_logs boolean default true not null,
  enable_notifications boolean default false not null,
  notification_channels jsonb default jsonb_build_object('email', false, 'whatsapp', false, 'system', true) not null,
  dashboard_settings jsonb default jsonb_build_object('show_total_members', true, 'show_active_members', true, 'show_congregations', true, 'show_birthdays', true, 'show_recent_updates', true) not null,
  document_settings jsonb default jsonb_build_object('allowed_file_types', jsonb_build_array('pdf', 'jpg', 'jpeg', 'png'), 'require_document_type', true, 'private_bucket', true) not null,
  report_settings jsonb default jsonb_build_object('show_church_logo', true, 'show_generated_at', true, 'show_responsible_user', true) not null,
  status text default 'ACTIVE'::text not null,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null,
  deleted_at timestamp with time zone,
  constraint app_settings_pkey PRIMARY KEY (id));
create table public.audit_logs (id uuid default gen_random_uuid() not null,
  church_id uuid,
  actor_profile_id uuid,
  actor_email text,
  module text not null,
  action text not null,
  entity_type text,
  entity_id uuid,
  entity_label text,
  description text,
  old_values jsonb,
  new_values jsonb,
  metadata jsonb,
  ip_address text,
  user_agent text,
  severity text default 'INFO'::text not null,
  created_at timestamp with time zone default now() not null,
  constraint audit_logs_pkey PRIMARY KEY (id));
create table public.church_invitations (id uuid default gen_random_uuid() not null,
  church_id uuid not null,
  invited_name text not null,
  email text not null,
  email_normalized text not null,
  token_hash text not null,
  role text not null,
  access_scope text not null,
  region_id uuid,
  congregation_id uuid,
  ministry_id uuid,
  permission_overrides jsonb default '[]'::jsonb not null,
  status text default 'PENDING'::text not null,
  invited_by uuid not null,
  invited_at timestamp with time zone default now() not null,
  expires_at timestamp with time zone default (now() + '7 days'::interval) not null,
  accepted_at timestamp with time zone,
  accepted_by uuid,
  access_id uuid,
  cancelled_at timestamp with time zone,
  notes text,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null,
  deleted_at timestamp with time zone,
  constraint church_invitations_pkey PRIMARY KEY (id));
create table public.churches (id uuid default gen_random_uuid() not null,
  name text not null,
  legal_name text,
  document text,
  email text,
  phone text,
  whatsapp text,
  logo_url text,
  zip_code text,
  address text,
  number text,
  complement text,
  district text,
  city text,
  state text,
  country text default 'Brasil'::text not null,
  senior_pastor_name text,
  senior_pastor_spouse_name text,
  status text default 'ACTIVE'::text not null,
  notes text,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null,
  deleted_at timestamp with time zone,
  constraint churches_pkey PRIMARY KEY (id));
create table public.congregation_documents (id uuid default gen_random_uuid() not null,
  church_id uuid not null,
  congregation_id uuid not null,
  title text not null,
  category text default 'OTHER'::text not null,
  original_file_name text not null,
  storage_bucket text default 'congregation-documents'::text not null,
  storage_path text not null,
  mime_type text not null,
  file_size bigint not null,
  upload_status text default 'PENDING'::text not null,
  uploaded_by uuid not null,
  deleted_by uuid,
  uploaded_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null,
  deleted_at timestamp with time zone,
  constraint congregation_documents_pkey PRIMARY KEY (id),
  constraint congregation_documents_storage_path_unique UNIQUE (storage_path));
create table public.congregations (id uuid default gen_random_uuid() not null,
  church_id uuid not null,
  region_id uuid,
  name text not null,
  code text,
  pastor_name text,
  pastor_spouse_name text,
  phone text,
  whatsapp text,
  email text,
  zip_code text,
  address text,
  number text,
  complement text,
  district text,
  city text,
  state text,
  country text default 'Brasil'::text not null,
  status text default 'ACTIVE'::text not null,
  notes text,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null,
  deleted_at timestamp with time zone,
  is_headquarters boolean default false not null,
  display_order integer default 0 not null,
  constraint congregations_pkey PRIMARY KEY (id));
create table public.event_checkins (id uuid default gen_random_uuid() not null,
  church_id uuid not null,
  event_id uuid not null,
  event_registration_id uuid not null,
  event_group_id uuid,
  checkin_code text,
  checkin_method text default 'MANUAL'::text not null,
  status text default 'CHECKED_IN'::text not null,
  checked_in_at timestamp with time zone,
  checked_in_by uuid,
  device_info text,
  notes text,
  metadata jsonb default jsonb_build_object('source', 'manual', 'qr_validated', false, 'duplicate_attempt', false) not null,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null,
  deleted_at timestamp with time zone,
  constraint event_checkins_pkey PRIMARY KEY (id));
create table public.event_congregation_quotas (id uuid default gen_random_uuid() not null,
  church_id uuid not null,
  event_id uuid not null,
  congregation_id uuid not null,
  quota_total integer default 0 not null,
  notes text,
  created_by uuid,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null,
  deleted_at timestamp with time zone,
  constraint event_congregation_quotas_pkey PRIMARY KEY (id));
create table public.event_documents (id uuid default gen_random_uuid() not null,
  church_id uuid not null,
  event_id uuid not null,
  event_registration_id uuid,
  event_group_id uuid,
  event_payment_id uuid,
  document_type text default 'OTHER'::text not null,
  title text not null,
  description text,
  file_name text not null,
  file_url text,
  storage_bucket text default 'event-documents'::text not null,
  storage_path text not null,
  mime_type text,
  file_size bigint,
  is_sensitive boolean default false not null,
  status text default 'ACTIVE'::text not null,
  metadata jsonb default jsonb_build_object('source', 'manual', 'public_visible', false, 'requires_permission', true) not null,
  uploaded_by uuid,
  uploaded_at timestamp with time zone default now() not null,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null,
  deleted_at timestamp with time zone,
  constraint event_documents_pkey PRIMARY KEY (id));
create table public.event_groups (id uuid default gen_random_uuid() not null,
  church_id uuid not null,
  event_id uuid not null,
  origin_church_name text,
  origin_field_name text,
  origin_city text not null,
  origin_state text default 'GO'::text not null,
  responsible_name text not null,
  responsible_phone text,
  responsible_email text,
  pastor_name text,
  pastor_phone text,
  total_registrations integer default 0 not null,
  male_count integer default 0 not null,
  female_count integer default 0 not null,
  status text default 'PENDING'::text not null,
  notes text,
  created_by uuid,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null,
  deleted_at timestamp with time zone,
  constraint event_groups_pkey PRIMARY KEY (id));
create table public.event_items (id uuid default gen_random_uuid() not null,
  church_id uuid not null,
  event_id uuid not null,
  name text not null,
  description text,
  item_type text default 'OTHER'::text not null,
  price numeric(12,2) default 0 not null,
  cost_price numeric(12,2),
  is_required boolean default false not null,
  is_active boolean default true not null,
  allow_quantity boolean default false not null,
  min_quantity integer default 1 not null,
  max_quantity integer,
  available_quantity integer,
  sort_order integer default 0 not null,
  settings jsonb default jsonb_build_object('requires_size', false, 'requires_observation', false, 'show_on_public_form', true, 'counts_as_registration', false, 'counts_for_capacity', false, 'counts_for_quota', false, 'allow_group_quantity', true) not null,
  notes text,
  created_by uuid,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null,
  deleted_at timestamp with time zone,
  constraint event_items_pkey PRIMARY KEY (id));
create table public.event_payments (id uuid default gen_random_uuid() not null,
  church_id uuid not null,
  event_id uuid not null,
  event_registration_id uuid,
  event_group_id uuid,
  payment_number text,
  payment_method text default 'PIX'::text not null,
  payment_status text default 'PENDING'::text not null,
  amount numeric(12,2) default 0 not null,
  paid_at timestamp with time zone,
  due_date date,
  installment_number integer default 1 not null,
  installments_total integer default 1 not null,
  transaction_reference text,
  payer_name text,
  payer_document text,
  receipt_file_url text,
  receipt_storage_path text,
  notes text,
  metadata jsonb default jsonb_build_object('source', 'manual', 'requires_confirmation', true, 'receipt_uploaded', false) not null,
  confirmed_by uuid,
  created_by uuid,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null,
  deleted_at timestamp with time zone,
  constraint event_payments_pkey PRIMARY KEY (id));
create table public.event_registration_items (id uuid default gen_random_uuid() not null,
  church_id uuid not null,
  event_id uuid not null,
  event_registration_id uuid,
  event_group_id uuid,
  event_item_id uuid not null,
  item_name text not null,
  item_type text not null,
  unit_price numeric(12,2) default 0 not null,
  quantity integer default 1 not null,
  total_price numeric(12,2) generated always as ((unit_price * (quantity)::numeric)) stored,
  size text,
  observation text,
  metadata jsonb default jsonb_build_object('source', 'manual', 'is_required', false, 'counts_as_registration', false, 'counts_for_capacity', false, 'counts_for_quota', false) not null,
  created_by uuid,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null,
  deleted_at timestamp with time zone,
  constraint event_registration_items_pkey PRIMARY KEY (id));
create table public.event_registrations (id uuid default gen_random_uuid() not null,
  church_id uuid not null,
  event_id uuid not null,
  event_group_id uuid,
  member_id uuid,
  congregation_id uuid,
  registration_number text,
  participant_name text not null,
  participant_document text,
  participant_phone text,
  participant_email text,
  participant_birth_date date,
  participant_gender text,
  participant_city text,
  participant_state text,
  participant_type text default 'EXTERNAL'::text not null,
  status text default 'PENDING'::text not null,
  payment_status text default 'PENDING'::text not null,
  total_amount numeric(12,2) default 0 not null,
  paid_amount numeric(12,2) default 0 not null,
  remaining_amount numeric(12,2) generated always as (GREATEST((total_amount - paid_amount), (0)::numeric)) stored,
  registered_at timestamp with time zone default now() not null,
  confirmed_at timestamp with time zone,
  cancelled_at timestamp with time zone,
  cancel_reason text,
  qr_code_value text,
  notes text,
  metadata jsonb default jsonb_build_object('source', 'manual', 'is_group_member', false, 'requires_checkin', true, 'badge_printed', false) not null,
  created_by uuid,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null,
  deleted_at timestamp with time zone,
  constraint event_registrations_pkey PRIMARY KEY (id));
create table public.events (id uuid default gen_random_uuid() not null,
  church_id uuid not null,
  congregation_id uuid,
  ministry_id uuid,
  name text not null,
  slug text,
  description text,
  event_type text default 'OTHER'::text not null,
  visibility text default 'INTERNAL'::text not null,
  status text default 'DRAFT'::text not null,
  registration_mode text default 'INDIVIDUAL'::text not null,
  quota_mode text default 'GENERAL'::text not null,
  host_city text,
  host_state text,
  location_name text,
  zip_code text,
  address text,
  number text,
  complement text,
  district text,
  city text,
  state text,
  country text default 'Brasil'::text not null,
  starts_at timestamp with time zone not null,
  ends_at timestamp with time zone,
  registration_starts_at timestamp with time zone,
  registration_ends_at timestamp with time zone,
  capacity integer,
  allow_waitlist boolean default false not null,
  requires_payment boolean default false not null,
  allow_installments boolean default false not null,
  max_installments integer default 1 not null,
  requires_group_responsible boolean default false not null,
  requires_gender_totals boolean default false not null,
  requires_pastor_info boolean default false not null,
  uses_registration_batches boolean default false not null,
  banner_url text,
  settings jsonb default jsonb_build_object('require_congregation', false, 'require_document', false, 'require_phone', true, 'require_email', false, 'allow_external_registrations', true, 'allow_member_link', true, 'show_remaining_spots', true, 'generate_qr_code', true, 'allow_group_registration', false, 'allow_individual_registration', true, 'show_quota_report', false, 'show_gender_totals', false, 'show_caravan_receipt', false) not null,
  notes text,
  created_by uuid,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null,
  deleted_at timestamp with time zone,
  constraint events_pkey PRIMARY KEY (id));
create table public.financial_cashboxes (id uuid default gen_random_uuid() not null,
  church_id uuid not null,
  congregation_id uuid,
  name text not null,
  code text,
  description text,
  cashbox_type text default 'OTHER'::text not null,
  bank_name text,
  agency text,
  account_number text,
  pix_key text,
  opening_balance numeric(12,2) default 0 not null,
  current_balance numeric(12,2) default 0 not null,
  is_default boolean default false not null,
  sort_order integer default 0 not null,
  status text default 'ACTIVE'::text not null,
  created_by uuid,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null,
  deleted_at timestamp with time zone,
  constraint financial_cashboxes_pkey PRIMARY KEY (id));
create table public.financial_categories (id uuid default gen_random_uuid() not null,
  church_id uuid not null,
  department_id uuid,
  parent_id uuid,
  name text not null,
  code text,
  description text,
  category_type text default 'INCOME'::text not null,
  category_group text default 'OTHER'::text not null,
  is_tithe boolean default false not null,
  is_offering boolean default false not null,
  is_report_delivery_item boolean default false not null,
  requires_member boolean default false not null,
  generate_receipt boolean default false not null,
  is_default boolean default false not null,
  sort_order integer default 0 not null,
  status text default 'ACTIVE'::text not null,
  created_by uuid,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null,
  deleted_at timestamp with time zone,
  constraint financial_categories_pkey PRIMARY KEY (id));
create table public.financial_departments (id uuid default gen_random_uuid() not null,
  church_id uuid not null,
  congregation_id uuid,
  name text not null,
  code text,
  description text,
  department_type text default 'OTHER'::text not null,
  is_default boolean default false not null,
  sort_order integer default 0 not null,
  status text default 'ACTIVE'::text not null,
  created_by uuid,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null,
  deleted_at timestamp with time zone,
  constraint financial_departments_pkey PRIMARY KEY (id));
create table public.financial_documents (id uuid default gen_random_uuid() not null,
  church_id uuid not null,
  congregation_id uuid,
  financial_transaction_id uuid,
  financial_receipt_id uuid,
  document_type text default 'OTHER'::text not null,
  title text not null,
  description text,
  file_name text not null,
  file_url text,
  storage_bucket text default 'financial-documents'::text not null,
  storage_path text not null,
  mime_type text,
  file_size bigint,
  is_sensitive boolean default true not null,
  status text default 'ACTIVE'::text not null,
  metadata jsonb default jsonb_build_object('source', 'manual', 'public_visible', false, 'requires_permission', true) not null,
  uploaded_by uuid,
  uploaded_at timestamp with time zone default now() not null,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null,
  deleted_at timestamp with time zone,
  accounts_payable_id uuid,
  constraint financial_documents_pkey PRIMARY KEY (id));
create table public.financial_payment_methods (id uuid default gen_random_uuid() not null,
  church_id uuid not null,
  name text not null,
  code text,
  description text,
  method_type text default 'OTHER'::text not null,
  requires_reference boolean default false not null,
  requires_receipt_upload boolean default false not null,
  is_default boolean default false not null,
  sort_order integer default 0 not null,
  status text default 'ACTIVE'::text not null,
  created_by uuid,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null,
  deleted_at timestamp with time zone,
  constraint financial_payment_methods_pkey PRIMARY KEY (id));
create table public.financial_receipts (id uuid default gen_random_uuid() not null,
  church_id uuid not null,
  congregation_id uuid,
  financial_transaction_id uuid not null,
  receipt_number text not null,
  receipt_type text default 'INCOME'::text not null,
  receipt_status text default 'ISSUED'::text not null,
  receipt_title text,
  person_name text,
  amount numeric(12,2) default 0 not null,
  issued_at timestamp with time zone default now() not null,
  printed_at timestamp with time zone,
  printed_by uuid,
  print_count integer default 0 not null,
  printer_name text,
  receipt_content text,
  receipt_html text,
  metadata jsonb default jsonb_build_object('source', 'financial_transaction', 'print_format', 'thermal', 'paper_width_mm', 80, 'can_reprint', true) not null,
  cancelled_by uuid,
  cancelled_at timestamp with time zone,
  cancel_reason text,
  created_by uuid,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null,
  deleted_at timestamp with time zone,
  constraint financial_receipts_pkey PRIMARY KEY (id));
create table public.financial_transactions (id uuid default gen_random_uuid() not null,
  church_id uuid not null,
  congregation_id uuid,
  member_id uuid,
  department_id uuid,
  cashbox_id uuid,
  payment_method_id uuid,
  category_id uuid not null,
  transaction_type text not null,
  source_type text default 'MANUAL'::text not null,
  transaction_number text,
  document_number text,
  person_name text,
  is_unregistered_person boolean default false not null,
  description text,
  amount numeric(12,2) default 0 not null,
  transaction_date date default CURRENT_DATE not null,
  reference_month integer,
  reference_year integer,
  payment_reference text,
  has_attachment boolean default false not null,
  generate_receipt boolean default false not null,
  receipt_printed boolean default false not null,
  status text default 'CONFIRMED'::text not null,
  notes text,
  metadata jsonb default jsonb_build_object('source', 'manual', 'created_from_screen', 'financial_transactions', 'thermal_receipt_available', false) not null,
  confirmed_by uuid,
  confirmed_at timestamp with time zone,
  cancelled_by uuid,
  cancelled_at timestamp with time zone,
  cancel_reason text,
  created_by uuid,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null,
  deleted_at timestamp with time zone,
  constraint financial_transactions_pkey PRIMARY KEY (id));
create table public.member_documents (id uuid default gen_random_uuid() not null,
  church_id uuid not null,
  member_id uuid not null,
  document_type text not null,
  title text not null,
  description text,
  file_name text not null,
  storage_bucket text default 'member-documents'::text not null,
  storage_path text not null,
  mime_type text,
  file_size bigint,
  is_sensitive boolean default false not null,
  uploaded_by uuid,
  uploaded_at timestamp with time zone default now() not null,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null,
  deleted_at timestamp with time zone,
  constraint member_documents_pkey PRIMARY KEY (id));
create table public.member_history (id uuid default gen_random_uuid() not null,
  church_id uuid not null,
  member_id uuid not null,
  congregation_id uuid,
  history_type text not null,
  title text not null,
  description text,
  old_value text,
  new_value text,
  event_date date default CURRENT_DATE not null,
  is_sensitive boolean default false not null,
  created_by uuid,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null,
  deleted_at timestamp with time zone,
  metadata jsonb default '{}'::jsonb not null,
  constraint member_history_pkey PRIMARY KEY (id));
create table public.member_ministries (id uuid default gen_random_uuid() not null,
  church_id uuid not null,
  member_id uuid not null,
  ministry_id uuid not null,
  congregation_id uuid,
  is_leader boolean default false not null,
  is_primary boolean default false not null,
  status text default 'ACTIVE'::text not null,
  start_date date,
  end_date date,
  notes text,
  created_by uuid,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null,
  deleted_at timestamp with time zone,
  constraint member_ministries_pkey PRIMARY KEY (id));
create table public.member_pastoral_notes (member_id uuid not null,
  church_id uuid not null,
  notes text not null,
  created_by uuid,
  updated_by uuid,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null,
  deleted_at timestamp with time zone,
  constraint member_pastoral_notes_pkey PRIMARY KEY (member_id));
create table public.member_roles (id uuid default gen_random_uuid() not null,
  church_id uuid not null,
  member_id uuid not null,
  role_id uuid not null,
  congregation_id uuid,
  is_primary boolean default false not null,
  status text default 'ACTIVE'::text not null,
  start_date date,
  end_date date,
  notes text,
  created_by uuid,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null,
  deleted_at timestamp with time zone,
  constraint member_roles_pkey PRIMARY KEY (id));
create table public.member_sensitive_identity (member_id uuid not null,
  church_id uuid not null,
  cpf text,
  rg text,
  issuing_agency text,
  created_by uuid,
  updated_by uuid,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null,
  deleted_at timestamp with time zone,
  constraint member_sensitive_identity_pkey PRIMARY KEY (member_id));
create table public.members (id uuid default gen_random_uuid() not null,
  church_id uuid not null,
  congregation_id uuid not null,
  full_name text not null,
  preferred_name text,
  gender text,
  birth_date date,
  marital_status text,
  nationality text default 'Brasileira'::text,
  natural_city text,
  natural_state text,
  profession text,
  education_level text,
  physical_file_number text,
  whatsapp text,
  email text,
  zip_code text,
  address text,
  number text,
  complement text,
  district text,
  city text,
  state text,
  country text default 'Brasil'::text not null,
  father_name text,
  mother_name text,
  spouse_name text,
  member_code text,
  member_status text default 'ACTIVE'::text not null,
  member_type text default 'MEMBER'::text not null,
  conversion_date date,
  baptism_date date,
  baptism_church text,
  has_holy_spirit_baptism boolean default false not null,
  holy_spirit_baptism_date date,
  previous_church text,
  received_by text,
  received_date date,
  letter_origin_church text,
  letter_destination_church text,
  transfer_date date,
  inactive_reason text,
  notes text,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null,
  deleted_at timestamp with time zone,
  constraint members_pkey PRIMARY KEY (id));
create table public.ministries (id uuid default gen_random_uuid() not null,
  church_id uuid not null,
  congregation_id uuid,
  leader_member_id uuid,
  name text not null,
  description text,
  category text default 'OTHER'::text not null,
  is_global boolean default false not null,
  status text default 'ACTIVE'::text not null,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null,
  deleted_at timestamp with time zone,
  constraint ministries_pkey PRIMARY KEY (id));
create table public.permissions (id uuid default gen_random_uuid() not null,
  key text not null,
  name text not null,
  description text,
  module text not null,
  action text not null,
  is_sensitive boolean default false not null,
  status text default 'ACTIVE'::text not null,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null,
  deleted_at timestamp with time zone,
  constraint permissions_pkey PRIMARY KEY (id));
create table public.profiles (id uuid not null,
  full_name text,
  display_name text,
  email text,
  phone text,
  whatsapp text,
  avatar_url text,
  status text default 'ACTIVE'::text not null,
  is_platform_admin boolean default false not null,
  locale text default 'pt-BR'::text not null,
  timezone text default 'America/Sao_Paulo'::text not null,
  last_seen_at timestamp with time zone,
  accepted_terms_at timestamp with time zone,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null,
  deleted_at timestamp with time zone,
  constraint profiles_pkey PRIMARY KEY (id));
create table public.regions (id uuid default gen_random_uuid() not null,
  church_id uuid not null,
  name text not null,
  description text,
  coordinator_name text,
  coordinator_phone text,
  status text default 'ACTIVE'::text not null,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null,
  deleted_at timestamp with time zone,
  display_order integer default 0 not null,
  constraint regions_pkey PRIMARY KEY (id));
create table public.report_deliveries (id uuid default gen_random_uuid() not null,
  church_id uuid not null,
  congregation_id uuid not null,
  reference_month integer not null,
  reference_year integer not null,
  period_start date not null,
  period_end date not null,
  delivery_number text,
  calculation_mode text default 'AUTO'::text not null,
  total_income numeric(12,2) default 0 not null,
  total_expense numeric(12,2) default 0 not null,
  gross_amount numeric(12,2) default 0 not null,
  total_central_income numeric(12,2) default 0 not null,
  total_congregation_expense numeric(12,2) default 0 not null,
  pastoral_prebend_amount numeric(12,2) default 0 not null,
  pastoral_prebend_tithe_amount numeric(12,2) default 0 not null,
  net_pastoral_prebend_amount numeric(12,2) default 0 not null,
  net_congregation_amount numeric(12,2) default 0 not null,
  status text default 'DRAFT'::text not null,
  delivered_at timestamp with time zone,
  delivered_by uuid,
  reviewed_at timestamp with time zone,
  reviewed_by uuid,
  finalized_at timestamp with time zone,
  finalized_by uuid,
  notes text,
  metadata jsonb default jsonb_build_object('source', 'manual', 'rules_snapshot_created', false, 'transactions_attached', false, 'can_generate_financial_transactions', true) not null,
  created_by uuid,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null,
  deleted_at timestamp with time zone,
  constraint report_deliveries_pkey PRIMARY KEY (id));
create table public.report_delivery_items (id uuid default gen_random_uuid() not null,
  church_id uuid not null,
  congregation_id uuid not null,
  report_delivery_id uuid not null,
  report_delivery_rule_id uuid,
  category_id uuid,
  rule_name text not null,
  rule_code text,
  rule_description text,
  rule_type text not null,
  rule_nature text not null,
  calculation_base text not null,
  base_amount numeric(12,2) default 0 not null,
  percentage_value numeric(8,4),
  fixed_amount numeric(12,2),
  manual_amount numeric(12,2),
  calculated_amount numeric(12,2) default 0 not null,
  applies_to_central_church boolean default true not null,
  applies_to_congregation boolean default true not null,
  affects_pastoral_prebend boolean default false not null,
  deducts_from_pastoral_prebend boolean default false not null,
  generate_central_income boolean default false not null,
  generate_congregation_expense boolean default false not null,
  central_transaction_id uuid,
  congregation_transaction_id uuid,
  sort_order integer default 0 not null,
  notes text,
  metadata jsonb default jsonb_build_object('source', 'report_delivery_calculation', 'is_rule_snapshot', true, 'generated_financial_transactions', false) not null,
  created_by uuid,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null,
  deleted_at timestamp with time zone,
  constraint report_delivery_items_pkey PRIMARY KEY (id));
create table public.report_delivery_rules (id uuid default gen_random_uuid() not null,
  church_id uuid not null,
  congregation_id uuid,
  category_id uuid,
  name text not null,
  code text,
  description text,
  rule_type text default 'PERCENTAGE'::text not null,
  rule_nature text default 'OTHER'::text not null,
  calculation_base text default 'TOTAL_INCOME'::text not null,
  percentage_value numeric(8,4),
  fixed_amount numeric(12,2),
  applies_to_central_church boolean default true not null,
  applies_to_congregation boolean default true not null,
  affects_pastoral_prebend boolean default false not null,
  deducts_from_pastoral_prebend boolean default false not null,
  generate_central_income boolean default false not null,
  generate_congregation_expense boolean default false not null,
  is_required boolean default true not null,
  is_default boolean default false not null,
  sort_order integer default 0 not null,
  effective_from date default CURRENT_DATE not null,
  effective_until date,
  status text default 'ACTIVE'::text not null,
  metadata jsonb default jsonb_build_object('source', 'manual', 'editable_name', true, 'editable_value', true, 'congregation_specific', false) not null,
  created_by uuid,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null,
  deleted_at timestamp with time zone,
  constraint report_delivery_rules_pkey PRIMARY KEY (id));
create table public.role_permissions (id uuid default gen_random_uuid() not null,
  role text not null,
  permission_id uuid not null,
  status text default 'ACTIVE'::text not null,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null,
  deleted_at timestamp with time zone,
  constraint role_permissions_pkey PRIMARY KEY (id));
create table public.roles (id uuid default gen_random_uuid() not null,
  church_id uuid not null,
  name text not null,
  description text,
  category text default 'ECCLESIASTICAL'::text not null,
  level integer default 100 not null,
  is_ministerial boolean default false not null,
  is_leadership boolean default false not null,
  status text default 'ACTIVE'::text not null,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null,
  deleted_at timestamp with time zone,
  female_name text,
  abbreviation text,
  female_abbreviation text,
  display_order integer default 0 not null,
  created_by uuid,
  updated_by uuid,
  constraint roles_pkey PRIMARY KEY (id));
create table public.user_church_access (id uuid default gen_random_uuid() not null,
  profile_id uuid not null,
  church_id uuid not null,
  region_id uuid,
  congregation_id uuid,
  ministry_id uuid,
  role text not null,
  access_scope text default 'CHURCH'::text not null,
  status text default 'ACTIVE'::text not null,
  invited_by uuid,
  invited_at timestamp with time zone,
  accepted_at timestamp with time zone,
  last_access_at timestamp with time zone,
  notes text,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null,
  deleted_at timestamp with time zone,
  constraint user_church_access_pkey PRIMARY KEY (id));
create table public.user_permission_overrides (id uuid default gen_random_uuid() not null,
  access_id uuid not null,
  permission_id uuid not null,
  effect text not null,
  created_by uuid,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null,
  deleted_at timestamp with time zone,
  constraint user_permission_overrides_pkey PRIMARY KEY (id));

-- Source: remote migration 20260808000230_trial_clone_public_routines
CREATE OR REPLACE FUNCTION public.set_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
begin
  new.updated_at = now();
  return new;
end;
$function$
;
CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  insert into public.profiles (
    id,
    full_name,
    display_name,
    email,
    avatar_url,
    status
  )
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name'),
    coalesce(new.raw_user_meta_data ->> 'display_name', new.raw_user_meta_data ->> 'name'),
    new.email,
    new.raw_user_meta_data ->> 'avatar_url',
    'ACTIVE'
  )
  on conflict (id) do nothing;

  return new;
end;
$function$
;
CREATE OR REPLACE FUNCTION public.touch_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
begin
  new.updated_at = now();
  return new;
end;
$function$
;
CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'auth'
AS $function$
begin
  insert into public.profiles (
    id, full_name, display_name, email, status, accepted_terms_at
  ) values (
    new.id,
    nullif(btrim(new.raw_user_meta_data ->> 'full_name'), ''),
    nullif(split_part(btrim(new.raw_user_meta_data ->> 'full_name'), ' ', 1), ''),
    lower(new.email),
    case when new.email_confirmed_at is null then 'PENDING' else 'ACTIVE' end,
    case when lower(coalesce(new.raw_user_meta_data ->> 'accepted_terms', 'false')) = 'true' then now() else null end
  )
  on conflict (id) do update set
    full_name = coalesce(excluded.full_name, profiles.full_name),
    display_name = coalesce(excluded.display_name, profiles.display_name),
    email = excluded.email,
    updated_at = now();
  return new;
end;
$function$
;
CREATE OR REPLACE FUNCTION public.validate_access_target_tenant()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
begin
  if new.role = 'ADMIN' and new.access_scope <> 'CHURCH' then
    raise exception 'Administrador deve possuir escopo CHURCH';
  end if;
  if new.role = 'MINISTRY_LEADER' and new.access_scope <> 'MINISTRY' then
    raise exception 'Líder de Ministério deve possuir escopo MINISTRY';
  end if;
  if new.region_id is not null and not exists (
    select 1 from public.regions r where r.id = new.region_id and r.church_id = new.church_id and r.deleted_at is null
  ) then raise exception 'Regional não pertence à igreja'; end if;
  if new.congregation_id is not null and not exists (
    select 1 from public.congregations c where c.id = new.congregation_id and c.church_id = new.church_id and c.deleted_at is null
  ) then raise exception 'Congregação não pertence à igreja'; end if;
  if new.ministry_id is not null and not exists (
    select 1 from public.ministries m where m.id = new.ministry_id and m.church_id = new.church_id and m.deleted_at is null
  ) then raise exception 'Ministério não pertence à igreja'; end if;
  return new;
end;
$function$
;
CREATE OR REPLACE FUNCTION public.validate_member_tenant()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare
  v_whatsapp text;
begin
  new.full_name := pg_catalog.btrim(new.full_name);
  new.preferred_name := nullif(pg_catalog.btrim(new.preferred_name), '');
  new.email := nullif(pg_catalog.lower(pg_catalog.btrim(new.email)), '');
  new.state := nullif(pg_catalog.upper(pg_catalog.btrim(new.state)), '');
  new.country := coalesce(nullif(pg_catalog.btrim(new.country), ''), 'Brasil');

  v_whatsapp := nullif(
    pg_catalog.regexp_replace(coalesce(new.whatsapp, ''), '[^0-9]', '', 'g'),
    ''
  );
  if v_whatsapp is not null and pg_catalog.length(v_whatsapp) > 11 and pg_catalog.left(v_whatsapp, 2) = '55' then
    v_whatsapp := pg_catalog.substr(v_whatsapp, 3);
  end if;
  if v_whatsapp is not null and v_whatsapp !~ '^[0-9]{11}$' then
    raise exception 'MEMBER_WHATSAPP_INVALID';
  end if;
  new.whatsapp := v_whatsapp;

  if new.full_name = '' then raise exception 'MEMBER_NAME_REQUIRED'; end if;
  if new.birth_date > current_date
    or new.conversion_date > current_date
    or new.baptism_date > current_date
    or new.holy_spirit_baptism_date > current_date
    or new.received_date > current_date then
    raise exception 'MEMBER_DATE_IN_FUTURE';
  end if;

  if not exists (
    select 1 from public.congregations congregation
    where congregation.id = new.congregation_id
      and congregation.church_id = new.church_id
      and congregation.deleted_at is null
  ) then
    raise exception 'MEMBER_CONGREGATION_INVALID';
  end if;

  if tg_op = 'UPDATE' and new.church_id <> old.church_id then
    raise exception 'MEMBER_CHURCH_IMMUTABLE';
  end if;
  return new;
end;
$function$
;
CREATE OR REPLACE FUNCTION public.validate_congregation_tenant()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
begin
  if new.region_id is not null and not exists (
    select 1 from public.regions r where r.id = new.region_id and r.church_id = new.church_id and r.deleted_at is null
  ) then raise exception 'Regional não pertence à igreja da congregação'; end if;
  return new;
end;
$function$
;
CREATE OR REPLACE FUNCTION public.protect_last_church_admin()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
declare
  removes_admin boolean;
  remaining_admins integer;
begin
  removes_admin := old.role = 'ADMIN' and old.access_scope = 'CHURCH'
    and old.status = 'ACTIVE' and old.deleted_at is null
    and (new.role <> 'ADMIN' or new.access_scope <> 'CHURCH' or new.status <> 'ACTIVE' or new.deleted_at is not null);
  if removes_admin then
    select count(*) into remaining_admins
    from public.user_church_access a
    where a.church_id = old.church_id and a.id <> old.id
      and a.role = 'ADMIN' and a.access_scope = 'CHURCH'
      and a.status = 'ACTIVE' and a.deleted_at is null;
    if remaining_admins = 0 then raise exception 'A igreja deve manter ao menos um Administrador ativo'; end if;
  end if;
  return new;
end;
$function$
;
CREATE OR REPLACE FUNCTION public.get_my_permissions(p_church_id uuid)
 RETURNS TABLE(permission_key text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  with active_access as (
    select a.id, a.role
    from public.user_church_access a
    join public.profiles pr on pr.id = a.profile_id
    join public.churches ch on ch.id = a.church_id
    where a.profile_id = auth.uid() and a.church_id = p_church_id
      and a.status = 'ACTIVE' and a.deleted_at is null
      and pr.status = 'ACTIVE' and pr.deleted_at is null
      and ch.status = 'ACTIVE' and ch.deleted_at is null
  ), inherited as (
    select aa.id as access_id, p.id as permission_id, p.key
    from active_access aa
    join public.role_permissions rp on rp.role = aa.role and rp.status = 'ACTIVE' and rp.deleted_at is null
    join public.permissions p on p.id = rp.permission_id and p.status = 'ACTIVE' and p.deleted_at is null
    where not exists (
      select 1 from public.user_permission_overrides o
      where o.access_id = aa.id and o.permission_id = p.id
        and o.effect = 'DENY' and o.deleted_at is null
    )
  ), allowed as (
    select aa.id as access_id, p.id as permission_id, p.key
    from active_access aa
    join public.user_permission_overrides o on o.access_id = aa.id and o.effect = 'ALLOW' and o.deleted_at is null
    join public.permissions p on p.id = o.permission_id and p.status = 'ACTIVE' and p.deleted_at is null
  )
  select distinct key from (select key from inherited union all select key from allowed) effective;
$function$
;
CREATE OR REPLACE FUNCTION public.has_permission(p_church_id uuid, p_permission_key text)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select exists(select 1 from public.get_my_permissions(p_church_id) where permission_key = p_permission_key);
$function$
;
CREATE OR REPLACE FUNCTION public.can_access_church(p_church_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select exists (
    select 1 from public.user_church_access a
    join public.profiles p on p.id = a.profile_id
    where a.profile_id = auth.uid() and a.church_id = p_church_id
      and a.status = 'ACTIVE' and a.deleted_at is null
      and p.status = 'ACTIVE' and p.deleted_at is null
  );
$function$
;
CREATE OR REPLACE FUNCTION public.can_access_region(p_church_id uuid, p_region_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select exists (
    select 1
    from public.user_church_access access
    where access.profile_id = (select auth.uid())
      and access.church_id = p_church_id
      and access.status = 'ACTIVE'
      and access.deleted_at is null
      and (
        access.access_scope = 'CHURCH'
        or (access.access_scope = 'REGION' and access.region_id = p_region_id)
        or (
          access.access_scope = 'CONGREGATION'
          and exists (
            select 1
            from public.congregations congregation
            where congregation.id = access.congregation_id
              and congregation.church_id = p_church_id
              and congregation.region_id = p_region_id
              and congregation.deleted_at is null
          )
        )
      )
  );
$function$
;
CREATE OR REPLACE FUNCTION public.can_access_congregation(p_church_id uuid, p_congregation_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select exists (
    select 1
    from public.user_church_access a
    join public.congregations c on c.id = p_congregation_id and c.church_id = p_church_id
    where a.profile_id = auth.uid() and a.church_id = p_church_id
      and a.status = 'ACTIVE' and a.deleted_at is null and c.deleted_at is null
      and (
        a.access_scope = 'CHURCH' or
        (a.access_scope = 'REGION' and a.region_id = c.region_id) or
        (a.access_scope = 'CONGREGATION' and a.congregation_id = c.id)
      )
  );
$function$
;
CREATE OR REPLACE FUNCTION public.can_access_member(p_church_id uuid, p_member_id uuid, p_congregation_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select exists (
    select 1
    from public.user_church_access a
    left join public.congregations c on c.id = p_congregation_id
    where a.profile_id = auth.uid() and a.church_id = p_church_id
      and a.status = 'ACTIVE' and a.deleted_at is null
      and (
        a.access_scope = 'CHURCH' or
        (a.access_scope = 'REGION' and a.region_id = c.region_id) or
        (a.access_scope = 'CONGREGATION' and a.congregation_id = p_congregation_id) or
        (a.access_scope = 'MINISTRY' and exists (
          select 1 from public.member_ministries mm
          where mm.member_id = p_member_id and mm.ministry_id = a.ministry_id
            and mm.status = 'ACTIVE' and mm.deleted_at is null
        ))
      )
  );
$function$
;
CREATE OR REPLACE FUNCTION public.log_audit(p_church_id uuid, p_module text, p_action text, p_entity_type text DEFAULT NULL::text, p_entity_id uuid DEFAULT NULL::uuid, p_entity_label text DEFAULT NULL::text, p_description text DEFAULT NULL::text, p_old_values jsonb DEFAULT NULL::jsonb, p_new_values jsonb DEFAULT NULL::jsonb, p_metadata jsonb DEFAULT NULL::jsonb, p_severity text DEFAULT 'INFO'::text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'auth'
AS $function$
declare v_email text;
begin
  select email into v_email from auth.users where id = auth.uid();
  insert into public.audit_logs(
    church_id, actor_profile_id, actor_email, module, action, entity_type,
    entity_id, entity_label, description, old_values, new_values, metadata, severity
  ) values (
    p_church_id, auth.uid(), v_email, p_module, p_action, p_entity_type,
    p_entity_id, p_entity_label, p_description, p_old_values, p_new_values, p_metadata, p_severity
  );
end;
$function$
;
CREATE OR REPLACE FUNCTION public.audit_member_mutation()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v_action text; declare v_description text;
begin
  if tg_op = 'INSERT' then
    v_action := 'MEMBER_CREATED'; v_description := 'Membro cadastrado.';
    perform public.log_audit(new.church_id, 'members', v_action, 'member', new.id,
      new.full_name, v_description, null,
      jsonb_build_object('congregation_id', new.congregation_id, 'member_status', new.member_status, 'member_type', new.member_type), null, 'INFO');
  else
    if new.deleted_at is distinct from old.deleted_at then
      v_action := 'MEMBER_ARCHIVED'; v_description := 'Cadastro de membro arquivado.';
    elsif new.congregation_id is distinct from old.congregation_id then
      v_action := 'MEMBER_TRANSFERRED'; v_description := 'Congregação do membro alterada.';
    elsif new.member_status is distinct from old.member_status then
      v_action := 'MEMBER_STATUS_CHANGED'; v_description := 'Situação do membro alterada.';
    else
      v_action := 'MEMBER_UPDATED'; v_description := 'Cadastro de membro atualizado.';
    end if;
    perform public.log_audit(new.church_id, 'members', v_action, 'member', new.id,
      new.full_name, v_description,
      jsonb_build_object('congregation_id', old.congregation_id, 'member_status', old.member_status, 'member_type', old.member_type),
      jsonb_build_object('congregation_id', new.congregation_id, 'member_status', new.member_status, 'member_type', new.member_type), null,
      case when v_action in ('MEMBER_ARCHIVED','MEMBER_TRANSFERRED') then 'WARNING' else 'INFO' end);
  end if;
  return new;
end;
$function$
;
CREATE OR REPLACE FUNCTION public.audit_sensitive_member_mutation()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v_changed jsonb;
begin
  if tg_op = 'UPDATE' then
    v_changed := jsonb_build_object(
      'cpf', new.cpf is distinct from old.cpf,
      'rg', new.rg is distinct from old.rg,
      'issuing_agency', new.issuing_agency is distinct from old.issuing_agency
    );
  else
    v_changed := jsonb_build_object(
      'cpf', new.cpf is not null,
      'rg', new.rg is not null,
      'issuing_agency', new.issuing_agency is not null
    );
  end if;
  perform public.log_audit(new.church_id, 'members',
    case when tg_op = 'INSERT' then 'SENSITIVE_IDENTITY_CREATED' else 'SENSITIVE_IDENTITY_UPDATED' end,
    'member', new.member_id, null, 'Dados de identidade sensível alterados.', null, null,
    jsonb_build_object('changed_fields', v_changed), 'WARNING');
  return new;
end;
$function$
;
CREATE OR REPLACE FUNCTION public.audit_pastoral_note_mutation()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  perform public.log_audit(new.church_id, 'members',
    case when tg_op = 'INSERT' then 'PASTORAL_NOTE_CREATED' else 'PASTORAL_NOTE_UPDATED' end,
    'member', new.member_id, null, 'Observação pastoral confidencial alterada.', null, null, null, 'WARNING');
  return new;
end;
$function$
;
CREATE OR REPLACE FUNCTION public.audit_institution_update()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  perform public.log_audit(new.id, 'church', 'CHURCH_UPDATED', 'church', new.id,
    new.name, 'Dados institucionais alterados.',
    jsonb_build_object('name', old.name, 'email', old.email, 'phone', old.phone),
    jsonb_build_object('name', new.name, 'email', new.email, 'phone', new.phone), null, 'WARNING');
  return new;
end;
$function$
;
CREATE OR REPLACE FUNCTION public.audit_app_settings_update()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if new.app_name is distinct from old.app_name
    or new.display_church_name is distinct from old.display_church_name
    or new.member_code_prefix is distinct from old.member_code_prefix
    or new.member_code_padding is distinct from old.member_code_padding
    or new.primary_color is distinct from old.primary_color
    or new.secondary_color is distinct from old.secondary_color then
    perform public.log_audit(new.church_id, 'settings', 'SETTINGS_UPDATED', 'app_settings', new.id,
      new.display_church_name, 'Configurações institucionais alteradas.', null,
      jsonb_build_object('app_name', new.app_name, 'member_code_prefix', new.member_code_prefix,
        'member_code_padding', new.member_code_padding), null, 'WARNING');
  end if;
  return new;
end;
$function$
;
CREATE OR REPLACE FUNCTION public.complete_church_onboarding(p_payload jsonb)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'auth'
AS $function$
declare
  v_user auth.users%rowtype;
  v_church_id uuid;
  v_congregation_id uuid;
  v_name text := nullif(btrim(p_payload->>'church_name'), '');
  v_headquarters_name text := nullif(btrim(p_payload->>'headquarters_name'), '');
begin
  select * into v_user from auth.users where id = auth.uid();
  if v_user.id is null then raise exception 'Sessão inválida'; end if;
  if v_name is null or v_headquarters_name is null then raise exception 'Igreja e Congregação Sede são obrigatórias'; end if;
  if exists(
    select 1
    from public.user_church_access
    where profile_id = auth.uid()
      and status = 'ACTIVE'
      and deleted_at is null
  ) then
    raise exception 'Este usuário já possui acesso ativo a uma igreja';
  end if;

  perform pg_advisory_xact_lock(182529, 20260801);

  if exists(select 1 from public.churches) then
    raise exception 'O cadastro inicial já foi concluído';
  end if;

  insert into public.churches(
    name, legal_name, document, email, phone, whatsapp, zip_code, address,
    number, complement, district, city, state, country, senior_pastor_name,
    senior_pastor_spouse_name, status
  ) values (
    v_name, nullif(btrim(p_payload->>'legal_name'), ''), nullif(btrim(p_payload->>'document'), ''),
    nullif(btrim(p_payload->>'church_email'), ''), nullif(btrim(p_payload->>'phone'), ''),
    nullif(btrim(p_payload->>'whatsapp'), ''), nullif(btrim(p_payload->>'zip_code'), ''),
    nullif(btrim(p_payload->>'address'), ''), nullif(btrim(p_payload->>'number'), ''),
    nullif(btrim(p_payload->>'complement'), ''), nullif(btrim(p_payload->>'district'), ''),
    nullif(btrim(p_payload->>'city'), ''), nullif(upper(btrim(p_payload->>'state')), ''),
    coalesce(nullif(btrim(p_payload->>'country'), ''), 'Brasil'),
    nullif(btrim(p_payload->>'senior_pastor_name'), ''),
    nullif(btrim(p_payload->>'senior_pastor_spouse_name'), ''), 'ACTIVE'
  ) returning id into v_church_id;

  insert into public.congregations(
    church_id, name, code, pastor_name, pastor_spouse_name, phone, whatsapp, email,
    zip_code, address, number, complement, district, city, state, country,
    is_headquarters, status
  ) values (
    v_church_id, v_headquarters_name, coalesce(nullif(upper(btrim(p_payload->>'headquarters_code')), ''), 'SEDE'),
    coalesce(nullif(btrim(p_payload->>'headquarters_pastor_name'), ''), nullif(btrim(p_payload->>'senior_pastor_name'), '')),
    nullif(btrim(p_payload->>'headquarters_pastor_spouse_name'), ''),
    nullif(btrim(p_payload->>'phone'), ''), nullif(btrim(p_payload->>'whatsapp'), ''),
    nullif(btrim(p_payload->>'church_email'), ''), nullif(btrim(p_payload->>'zip_code'), ''),
    nullif(btrim(p_payload->>'address'), ''), nullif(btrim(p_payload->>'number'), ''),
    nullif(btrim(p_payload->>'complement'), ''), nullif(btrim(p_payload->>'district'), ''),
    nullif(btrim(p_payload->>'city'), ''), nullif(upper(btrim(p_payload->>'state')), ''),
    coalesce(nullif(btrim(p_payload->>'country'), ''), 'Brasil'), true, 'ACTIVE'
  ) returning id into v_congregation_id;

  insert into public.app_settings(
    church_id, app_name, display_church_name, primary_color, member_code_prefix,
    member_code_next_number, member_code_padding, enable_member_auto_code,
    default_country, default_state, default_city, status
  ) values (
    v_church_id, coalesce(nullif(btrim(p_payload->>'app_name'), ''), 'Eclesias'),
    coalesce(nullif(btrim(p_payload->>'display_church_name'), ''), v_name), '#415BA5',
    coalesce(nullif(upper(regexp_replace(p_payload->>'member_code_prefix', '[^A-Za-z0-9]', '', 'g')), ''), 'MEM'),
    greatest(coalesce((p_payload->>'member_code_next_number')::integer, 1), 1),
    least(greatest(coalesce((p_payload->>'member_code_padding')::integer, 4), 1), 10),
    true, coalesce(nullif(btrim(p_payload->>'country'), ''), 'Brasil'),
    nullif(upper(btrim(p_payload->>'state')), ''), nullif(btrim(p_payload->>'city'), ''), 'ACTIVE'
  );

  insert into public.profiles(id, full_name, display_name, email, status, accepted_terms_at)
  values(
    v_user.id,
    coalesce(nullif(btrim(v_user.raw_user_meta_data->>'full_name'), ''), split_part(v_user.email, '@', 1)),
    coalesce(nullif(split_part(btrim(v_user.raw_user_meta_data->>'full_name'), ' ', 1), ''), split_part(v_user.email, '@', 1)),
    lower(v_user.email), 'ACTIVE', now()
  ) on conflict(id) do update set status = 'ACTIVE', email = excluded.email,
    accepted_terms_at = coalesce(profiles.accepted_terms_at, now()), updated_at = now();

  insert into public.user_church_access(
    profile_id, church_id, role, access_scope, status, accepted_at
  ) values (v_user.id, v_church_id, 'ADMIN', 'CHURCH', 'ACTIVE', now());

  perform public.log_audit(v_church_id, 'auth', 'ONBOARDING_COMPLETED', 'church',
    v_church_id, v_name, 'Igreja, Congregação Sede e primeiro Administrador criados.',
    null, jsonb_build_object('headquarters_id', v_congregation_id), null, 'INFO');
  return v_church_id;
end;
$function$
;
CREATE OR REPLACE FUNCTION public.create_church_invitation(p_church_id uuid, p_name text, p_email text, p_role text, p_scope text, p_region_id uuid DEFAULT NULL::uuid, p_congregation_id uuid DEFAULT NULL::uuid, p_ministry_id uuid DEFAULT NULL::uuid, p_notes text DEFAULT NULL::text, p_permission_overrides jsonb DEFAULT '[]'::jsonb)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare v_token text := encode(extensions.gen_random_bytes(32), 'hex');
declare v_invite_id uuid;
begin
  if not public.has_permission(p_church_id, 'users.invite') then raise exception 'Acesso negado'; end if;
  if p_role = 'ADMIN' and not exists (
    select 1 from public.user_church_access a where a.profile_id = auth.uid()
      and a.church_id = p_church_id and a.role = 'ADMIN' and a.access_scope = 'CHURCH'
      and a.status = 'ACTIVE' and a.deleted_at is null
  ) then raise exception 'Somente Administradores podem convidar outro Administrador'; end if;
  insert into public.church_invitations(
    church_id, invited_name, email, email_normalized, token_hash, role, access_scope,
    region_id, congregation_id, ministry_id, permission_overrides, invited_by, notes
  ) values (
    p_church_id, btrim(p_name), lower(btrim(p_email)), lower(btrim(p_email)),
    encode(extensions.digest(v_token, 'sha256'), 'hex'), p_role, p_scope,
    p_region_id, p_congregation_id, p_ministry_id, coalesce(p_permission_overrides, '[]'::jsonb),
    auth.uid(), nullif(btrim(p_notes), '')
  ) returning id into v_invite_id;
  perform public.log_audit(p_church_id, 'users', 'INVITATION_CREATED', 'church_invitation',
    v_invite_id, lower(btrim(p_email)), 'Convite de acesso criado.', null,
    jsonb_build_object('role', p_role, 'scope', p_scope), null, 'INFO');
  return v_token;
end;
$function$
;
CREATE OR REPLACE FUNCTION public.renew_church_invitation(p_invitation_id uuid)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare v_token text := encode(extensions.gen_random_bytes(32), 'hex');
declare v_church_id uuid;
begin
  select church_id into v_church_id from public.church_invitations
  where id = p_invitation_id and deleted_at is null;
  if v_church_id is null or not public.has_permission(v_church_id, 'users.invite') then raise exception 'Acesso negado'; end if;
  update public.church_invitations set token_hash = encode(extensions.digest(v_token, 'sha256'), 'hex'),
    status = 'PENDING', invited_at = now(), expires_at = now() + interval '7 days',
    cancelled_at = null, accepted_at = null, accepted_by = null, access_id = null
  where id = p_invitation_id;
  perform public.log_audit(v_church_id, 'users', 'INVITATION_RENEWED', 'church_invitation',
    p_invitation_id, null, 'Convite reenviado.', null, null, null, 'INFO');
  return v_token;
end;
$function$
;
CREATE OR REPLACE FUNCTION public.cancel_church_invitation(p_invitation_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare v_church_id uuid;
begin
  select church_id into v_church_id from public.church_invitations
  where id = p_invitation_id and status = 'PENDING' and deleted_at is null for update;
  if v_church_id is null or not public.has_permission(v_church_id, 'users.invite') then raise exception 'Acesso negado'; end if;
  update public.church_invitations set status = 'CANCELLED', cancelled_at = now()
  where id = p_invitation_id;
  perform public.log_audit(v_church_id, 'users', 'INVITATION_CANCELLED', 'church_invitation',
    p_invitation_id, null, 'Convite cancelado.', null, null, null, 'WARNING');
end;
$function$
;
CREATE OR REPLACE FUNCTION public.accept_church_invitation(p_token text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'auth'
AS $function$
declare v_inv public.church_invitations%rowtype;
declare v_email text;
declare v_access_id uuid;
begin
  select lower(email) into v_email from auth.users where id = auth.uid();
  if v_email is null then raise exception 'Sessão inválida'; end if;
  select * into v_inv from public.church_invitations
  where token_hash = encode(extensions.digest(p_token, 'sha256'), 'hex')
    and status = 'PENDING' and expires_at > now() and deleted_at is null
  for update;
  if v_inv.id is null then raise exception 'Convite inválido ou expirado'; end if;
  if v_inv.email_normalized <> v_email then raise exception 'O convite pertence a outro e-mail'; end if;
  if exists(select 1 from public.profiles where id = auth.uid() and status in ('INACTIVE','BLOCKED')) then
    raise exception 'Perfil indisponível para aceitar convites';
  end if;

  update public.profiles set status = 'ACTIVE', email = v_email, updated_at = now()
  where id = auth.uid() and deleted_at is null;

  select id into v_access_id from public.user_church_access a
  where a.profile_id = auth.uid() and a.church_id = v_inv.church_id
    and a.access_scope = v_inv.access_scope
    and coalesce(a.region_id, '00000000-0000-0000-0000-000000000000'::uuid) = coalesce(v_inv.region_id, '00000000-0000-0000-0000-000000000000'::uuid)
    and coalesce(a.congregation_id, '00000000-0000-0000-0000-000000000000'::uuid) = coalesce(v_inv.congregation_id, '00000000-0000-0000-0000-000000000000'::uuid)
    and coalesce(a.ministry_id, '00000000-0000-0000-0000-000000000000'::uuid) = coalesce(v_inv.ministry_id, '00000000-0000-0000-0000-000000000000'::uuid)
    and a.deleted_at is null limit 1;

  if v_access_id is null then
    insert into public.user_church_access(
      profile_id, church_id, region_id, congregation_id, ministry_id, role,
      access_scope, status, invited_by, invited_at, accepted_at, notes
    ) values (
      auth.uid(), v_inv.church_id, v_inv.region_id, v_inv.congregation_id,
      v_inv.ministry_id, v_inv.role, v_inv.access_scope, 'ACTIVE', v_inv.invited_by,
      v_inv.invited_at, now(), v_inv.notes
    ) returning id into v_access_id;
  else
    update public.user_church_access set role = v_inv.role, status = 'ACTIVE',
      invited_by = v_inv.invited_by, invited_at = v_inv.invited_at, accepted_at = now(), notes = v_inv.notes
    where id = v_access_id;
  end if;

  insert into public.user_permission_overrides(access_id, permission_id, effect, created_by)
  select v_access_id, p.id, upper(item->>'effect'), v_inv.invited_by
  from jsonb_array_elements(v_inv.permission_overrides) item
  join public.permissions p on p.key = item->>'permission' and p.status = 'ACTIVE' and p.deleted_at is null
  where upper(item->>'effect') in ('ALLOW','DENY')
  on conflict do nothing;

  update public.church_invitations set status = 'ACCEPTED', accepted_at = now(),
    accepted_by = auth.uid(), access_id = v_access_id where id = v_inv.id;
  perform public.log_audit(v_inv.church_id, 'users', 'INVITATION_ACCEPTED', 'user_church_access',
    v_access_id, v_email, 'Convite aceito e acesso ativado.', null,
    jsonb_build_object('role', v_inv.role, 'scope', v_inv.access_scope), null, 'INFO');
  return v_inv.church_id;
end;
$function$
;
CREATE OR REPLACE FUNCTION public.update_church_access(p_access_id uuid, p_role text, p_scope text, p_status text, p_region_id uuid DEFAULT NULL::uuid, p_congregation_id uuid DEFAULT NULL::uuid, p_ministry_id uuid DEFAULT NULL::uuid, p_notes text DEFAULT NULL::text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare v_old public.user_church_access%rowtype;
begin
  select * into v_old from public.user_church_access where id = p_access_id and deleted_at is null for update;
  if v_old.id is null then raise exception 'Acesso não encontrado'; end if;
  if not public.has_permission(v_old.church_id, 'users.update_access') then raise exception 'Acesso negado'; end if;
  if (v_old.role = 'ADMIN' or p_role = 'ADMIN') and not exists (
    select 1 from public.user_church_access a where a.profile_id = auth.uid()
      and a.church_id = v_old.church_id and a.role = 'ADMIN' and a.access_scope = 'CHURCH'
      and a.status = 'ACTIVE' and a.deleted_at is null
  ) then raise exception 'Somente Administradores podem alterar outro Administrador'; end if;
  update public.user_church_access set role = p_role, access_scope = p_scope,
    status = p_status, region_id = p_region_id, congregation_id = p_congregation_id,
    ministry_id = p_ministry_id, notes = nullif(btrim(p_notes), '')
  where id = p_access_id;
  perform public.log_audit(v_old.church_id, 'users', 'ACCESS_UPDATED', 'user_church_access',
    p_access_id, null, 'Acesso de usuário alterado.', to_jsonb(v_old) - 'notes',
    jsonb_build_object('role', p_role, 'scope', p_scope, 'status', p_status), null, 'WARNING');
end;
$function$
;
CREATE OR REPLACE FUNCTION public.set_access_permission_override(p_access_id uuid, p_permission_key text, p_effect text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_church_id uuid;
  v_permission_id uuid;
  v_target_role text;
begin
  select church_id, role
  into v_church_id, v_target_role
  from public.user_church_access
  where id = p_access_id and deleted_at is null;

  if v_church_id is null
    or not public.has_permission(v_church_id, 'users.manage_permissions') then
    raise exception 'Acesso negado';
  end if;

  select id into v_permission_id
  from public.permissions
  where key = p_permission_key and status = 'ACTIVE' and deleted_at is null;

  if v_permission_id is null then
    raise exception 'Permissão inválida';
  end if;

  if upper(p_effect) = 'ALLOW'
    and p_permission_key in (
      'regions.manage',
      'congregations.manage',
      'positions.manage',
      'congregation_documents.view',
      'congregation_documents.manage'
    )
    and v_target_role <> 'ADMIN' then
    raise exception 'Esta permissão é exclusiva de Administradores';
  end if;

  if upper(p_effect) = 'ALLOW'
    and not public.has_permission(v_church_id, p_permission_key) then
    raise exception 'Não é permitido conceder uma permissão que você não possui';
  end if;

  if upper(p_effect) = 'INHERIT' then
    update public.user_permission_overrides
    set deleted_at = now(), updated_at = now()
    where access_id = p_access_id
      and permission_id = v_permission_id
      and deleted_at is null;
  elsif upper(p_effect) in ('ALLOW', 'DENY') then
    insert into public.user_permission_overrides (
      access_id, permission_id, effect, created_by
    ) values (
      p_access_id, v_permission_id, upper(p_effect), auth.uid()
    )
    on conflict (access_id, permission_id) where deleted_at is null
    do update set
      effect = excluded.effect,
      created_by = auth.uid(),
      updated_at = now();
  else
    raise exception 'Efeito inválido';
  end if;

  perform public.log_audit(
    v_church_id,
    'users',
    'PERMISSION_OVERRIDE_UPDATED',
    'user_church_access',
    p_access_id,
    p_permission_key,
    'Permissão personalizada alterada.',
    null,
    jsonb_build_object('permission', p_permission_key, 'effect', upper(p_effect)),
    null,
    'WARNING'
  );
end;
$function$
;
CREATE OR REPLACE FUNCTION public.safe_uuid(p_value text)
 RETURNS uuid
 LANGUAGE plpgsql
 IMMUTABLE
 SET search_path TO 'public'
AS $function$
begin
  return p_value::uuid;
exception when invalid_text_representation then
  return null;
end;
$function$
;
CREATE OR REPLACE FUNCTION public.get_member_stats(p_church_id uuid)
 RETURNS jsonb
 LANGUAGE sql
 STABLE
 SET search_path TO ''
AS $function$
  select jsonb_build_object(
    'total', count(*) filter (where member.deleted_at is null),
    'active', count(*) filter (
      where member.deleted_at is null and member.member_status = 'ACTIVE'
    ),
    'inactive', count(*) filter (
      where member.deleted_at is null and member.member_status = 'INACTIVE'
    ),
    'members', count(*) filter (
      where member.deleted_at is null and member.member_type = 'MEMBER'
    ),
    'congregated', count(*) filter (
      where member.deleted_at is null and member.member_type = 'CONGREGATED'
    ),
    'visitors', count(*) filter (
      where member.deleted_at is null and member.member_type = 'VISITOR'
    ),
    'children', count(*) filter (
      where member.deleted_at is null and member.member_type = 'CHILD'
    ),
    'archived', count(*) filter (where member.deleted_at is not null)
  )
  from public.members member
  where member.church_id = p_church_id;
$function$
;
CREATE OR REPLACE FUNCTION public.create_member_atomic(p_church_id uuid, p_payload jsonb)
 RETURNS TABLE(member_id uuid, member_code text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_actor uuid := auth.uid();
  v_member_id uuid;
  v_member_code text;
  v_congregation_id uuid := nullif(p_payload->>'congregation_id', '')::uuid;
  v_role_id uuid := nullif(p_payload->>'main_role_id', '')::uuid;
  v_role_start_date date := nullif(p_payload->>'role_start_date', '')::date;
  v_member_type text := upper(coalesce(nullif(btrim(p_payload->>'member_type'), ''), 'MEMBER'));
  v_auto_code boolean;
  v_prefix text;
  v_next_number integer;
  v_padding integer;
  v_settings_id uuid;
  v_cpf text := nullif(regexp_replace(coalesce(p_payload->>'cpf', ''), '[^0-9]', '', 'g'), '');
  v_rg text := nullif(btrim(p_payload->>'rg'), '');
  v_issuing_agency text := nullif(btrim(p_payload->>'issuing_agency'), '');
  v_pastoral_notes text := nullif(btrim(p_payload->>'pastoral_notes'), '');
  v_received_date date := nullif(p_payload->>'received_date', '')::date;
begin
  if v_actor is null then
    raise exception 'AUTH_REQUIRED';
  end if;

  if not public.has_permission(p_church_id, 'members.create') then
    raise exception 'MEMBER_PERMISSION_DENIED';
  end if;

  if v_congregation_id is null
    or not exists (
      select 1
      from public.congregations congregation
      where congregation.id = v_congregation_id
        and congregation.church_id = p_church_id
        and congregation.status = 'ACTIVE'
        and congregation.deleted_at is null
    )
    or not public.can_access_congregation(p_church_id, v_congregation_id) then
    raise exception 'MEMBER_CONGREGATION_INVALID';
  end if;

  if nullif(btrim(p_payload->>'full_name'), '') is null then
    raise exception 'MEMBER_NAME_REQUIRED';
  end if;

  if nullif(btrim(p_payload->>'city'), '') is null
    or nullif(btrim(p_payload->>'state'), '') is null then
    raise exception 'MEMBER_ADDRESS_REQUIRED';
  end if;

  if v_cpf is not null and length(v_cpf) <> 11 then
    raise exception 'MEMBER_CPF_INVALID';
  end if;

  if (v_cpf is not null or v_rg is not null or v_issuing_agency is not null)
    and not public.has_permission(
      p_church_id,
      'members.manage_sensitive_identity'
    ) then
    raise exception 'MEMBER_SENSITIVE_PERMISSION_DENIED';
  end if;

  if v_pastoral_notes is not null
    and not public.has_permission(p_church_id, 'members.edit_pastoral_notes') then
    raise exception 'MEMBER_PASTORAL_PERMISSION_DENIED';
  end if;

  select
    settings.id,
    settings.enable_member_auto_code,
    coalesce(nullif(upper(btrim(settings.member_code_prefix)), ''), 'MEM'),
    greatest(settings.member_code_next_number, 1),
    greatest(1, least(settings.member_code_padding, 10))
  into
    v_settings_id,
    v_auto_code,
    v_prefix,
    v_next_number,
    v_padding
  from public.app_settings settings
  where settings.church_id = p_church_id
    and settings.status = 'ACTIVE'
    and settings.deleted_at is null
  for update;

  if v_settings_id is null then
    raise exception 'MEMBER_SETTINGS_NOT_FOUND';
  end if;

  if v_auto_code then
    loop
      v_member_code := v_prefix || lpad(v_next_number::text, v_padding, '0');
      exit when not exists (
        select 1 from public.members existing_member
        where existing_member.church_id = p_church_id
          and existing_member.member_code = v_member_code
      );
      v_next_number := v_next_number + 1;
    end loop;

    update public.app_settings
    set member_code_next_number = v_next_number + 1,
        updated_at = now()
    where id = v_settings_id;
  else
    v_member_code := nullif(upper(btrim(p_payload->>'member_code')), '');
  end if;

  insert into public.members (
    church_id,
    congregation_id,
    full_name,
    preferred_name,
    gender,
    birth_date,
    marital_status,
    nationality,
    natural_city,
    natural_state,
    profession,
    education_level,
    physical_file_number,
    whatsapp,
    email,
    zip_code,
    address,
    number,
    complement,
    district,
    city,
    state,
    country,
    father_name,
    mother_name,
    spouse_name,
    member_code,
    member_status,
    member_type,
    conversion_date,
    baptism_date,
    baptism_church,
    has_holy_spirit_baptism,
    holy_spirit_baptism_date,
    previous_church,
    received_by,
    received_date,
    letter_origin_church,
    notes
  ) values (
    p_church_id,
    v_congregation_id,
    btrim(p_payload->>'full_name'),
    nullif(btrim(p_payload->>'preferred_name'), ''),
    nullif(upper(btrim(p_payload->>'gender')), ''),
    nullif(p_payload->>'birth_date', '')::date,
    nullif(upper(btrim(p_payload->>'marital_status')), ''),
    coalesce(nullif(btrim(p_payload->>'nationality'), ''), 'Brasileira'),
    nullif(btrim(p_payload->>'natural_city'), ''),
    nullif(upper(btrim(p_payload->>'natural_state')), ''),
    nullif(btrim(p_payload->>'profession'), ''),
    nullif(btrim(p_payload->>'education_level'), ''),
    nullif(btrim(p_payload->>'physical_file_number'), ''),
    nullif(regexp_replace(coalesce(p_payload->>'whatsapp', ''), '[^0-9]', '', 'g'), ''),
    nullif(lower(btrim(p_payload->>'email')), ''),
    nullif(regexp_replace(coalesce(p_payload->>'zip_code', ''), '[^0-9]', '', 'g'), ''),
    nullif(btrim(p_payload->>'address'), ''),
    nullif(btrim(p_payload->>'number'), ''),
    nullif(btrim(p_payload->>'complement'), ''),
    nullif(btrim(p_payload->>'district'), ''),
    btrim(p_payload->>'city'),
    upper(btrim(p_payload->>'state')),
    coalesce(nullif(btrim(p_payload->>'country'), ''), 'Brasil'),
    nullif(btrim(p_payload->>'father_name'), ''),
    nullif(btrim(p_payload->>'mother_name'), ''),
    nullif(btrim(p_payload->>'spouse_name'), ''),
    v_member_code,
    'ACTIVE',
    v_member_type,
    nullif(p_payload->>'conversion_date', '')::date,
    nullif(p_payload->>'baptism_date', '')::date,
    nullif(btrim(p_payload->>'baptism_church'), ''),
    coalesce((p_payload->>'has_holy_spirit_baptism')::boolean, false),
    nullif(p_payload->>'holy_spirit_baptism_date', '')::date,
    nullif(btrim(p_payload->>'previous_church'), ''),
    nullif(upper(btrim(p_payload->>'received_by')), ''),
    v_received_date,
    nullif(btrim(p_payload->>'letter_origin_church'), ''),
    nullif(btrim(p_payload->>'notes'), '')
  )
  returning id, members.member_code
  into v_member_id, v_member_code;

  if v_cpf is not null or v_rg is not null or v_issuing_agency is not null then
    insert into public.member_sensitive_identity (
      member_id,
      church_id,
      cpf,
      rg,
      issuing_agency,
      created_by,
      updated_by
    ) values (
      v_member_id,
      p_church_id,
      v_cpf,
      v_rg,
      v_issuing_agency,
      v_actor,
      v_actor
    );
  end if;

  if v_pastoral_notes is not null then
    insert into public.member_pastoral_notes (
      member_id,
      church_id,
      notes,
      created_by,
      updated_by
    ) values (
      v_member_id,
      p_church_id,
      v_pastoral_notes,
      v_actor,
      v_actor
    );
  end if;

  if v_role_id is not null then
    if not public.has_permission(p_church_id, 'member_roles.manage') then
      raise exception 'MEMBER_ROLE_PERMISSION_DENIED';
    end if;

    if not exists (
      select 1 from public.roles role
      where role.id = v_role_id
        and role.church_id = p_church_id
        and role.status = 'ACTIVE'
        and role.deleted_at is null
    ) then
      raise exception 'MEMBER_ROLE_INVALID';
    end if;

    insert into public.member_roles (
      church_id,
      member_id,
      role_id,
      congregation_id,
      is_primary,
      status,
      start_date,
      created_by
    ) values (
      p_church_id,
      v_member_id,
      v_role_id,
      v_congregation_id,
      true,
      'ACTIVE',
      v_role_start_date,
      v_actor
    );

    insert into public.member_history (
      church_id,
      member_id,
      congregation_id,
      history_type,
      title,
      description,
      event_date,
      is_sensitive,
      created_by,
      metadata
    ) values (
      p_church_id,
      v_member_id,
      v_congregation_id,
      'ROLE_ASSIGNED',
      'Cargo principal atribuído',
      'Cargo principal informado no cadastro inicial.',
      coalesce(v_role_start_date, current_date),
      false,
      v_actor,
      jsonb_build_object('role_id', v_role_id)
    );
  end if;

  insert into public.member_history (
    church_id,
    member_id,
    congregation_id,
    history_type,
    title,
    description,
    event_date,
    is_sensitive,
    created_by,
    metadata
  ) values (
    p_church_id,
    v_member_id,
    v_congregation_id,
    'MEMBER_CREATED',
    'Cadastro criado no EKLESIA',
    'Registro cadastral criado no sistema.',
    current_date,
    false,
    v_actor,
    jsonb_build_object('member_type', v_member_type)
  );

  if v_received_date is not null or nullif(btrim(p_payload->>'received_by'), '') is not null then
    insert into public.member_history (
      church_id,
      member_id,
      congregation_id,
      history_type,
      title,
      description,
      event_date,
      is_sensitive,
      created_by,
      metadata
    ) values (
      p_church_id,
      v_member_id,
      v_congregation_id,
      'MEMBER_RECEIVED',
      'Recebimento oficial na igreja',
      'Informação de recebimento registrada no cadastro inicial.',
      coalesce(v_received_date, current_date),
      false,
      v_actor,
      jsonb_build_object(
        'received_by', nullif(upper(btrim(p_payload->>'received_by')), ''),
        'origin_church', nullif(btrim(p_payload->>'letter_origin_church'), '')
      )
    );
  end if;

  return query select v_member_id, v_member_code;
end;
$function$
;
CREATE OR REPLACE FUNCTION public.update_member_atomic(p_member_id uuid, p_expected_updated_at timestamp with time zone, p_payload jsonb)
 RETURNS timestamp with time zone
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_actor uuid := auth.uid();
  v_member public.members%rowtype;
  v_updated_at timestamptz;
  v_cpf text;
  v_rg text;
  v_issuing_agency text;
  v_pastoral_notes text;
  v_role_id uuid;
  v_current_primary_role uuid;
begin
  if v_actor is null then raise exception 'AUTH_REQUIRED'; end if;

  select * into v_member
  from public.members member
  where member.id = p_member_id
    and member.deleted_at is null
  for update;

  if v_member.id is null then raise exception 'MEMBER_NOT_FOUND'; end if;

  if not public.has_permission(v_member.church_id, 'members.update')
    or not public.can_access_member(
      v_member.church_id,
      v_member.id,
      v_member.congregation_id
    ) then
    raise exception 'MEMBER_PERMISSION_DENIED';
  end if;

  if p_expected_updated_at is null
    or v_member.updated_at is distinct from p_expected_updated_at then
    raise exception 'MEMBER_CONFLICT';
  end if;

  if nullif(btrim(p_payload->>'full_name'), '') is null then
    raise exception 'MEMBER_NAME_REQUIRED';
  end if;

  if nullif(btrim(p_payload->>'city'), '') is null
    or nullif(btrim(p_payload->>'state'), '') is null then
    raise exception 'MEMBER_ADDRESS_REQUIRED';
  end if;

  update public.members member
  set
    full_name = btrim(p_payload->>'full_name'),
    preferred_name = nullif(btrim(p_payload->>'preferred_name'), ''),
    gender = nullif(upper(btrim(p_payload->>'gender')), ''),
    birth_date = nullif(p_payload->>'birth_date', '')::date,
    marital_status = nullif(upper(btrim(p_payload->>'marital_status')), ''),
    nationality = coalesce(nullif(btrim(p_payload->>'nationality'), ''), 'Brasileira'),
    natural_city = nullif(btrim(p_payload->>'natural_city'), ''),
    natural_state = nullif(upper(btrim(p_payload->>'natural_state')), ''),
    profession = nullif(btrim(p_payload->>'profession'), ''),
    education_level = nullif(btrim(p_payload->>'education_level'), ''),
    physical_file_number = nullif(btrim(p_payload->>'physical_file_number'), ''),
    whatsapp = nullif(regexp_replace(coalesce(p_payload->>'whatsapp', ''), '[^0-9]', '', 'g'), ''),
    email = nullif(lower(btrim(p_payload->>'email')), ''),
    zip_code = nullif(regexp_replace(coalesce(p_payload->>'zip_code', ''), '[^0-9]', '', 'g'), ''),
    address = nullif(btrim(p_payload->>'address'), ''),
    number = nullif(btrim(p_payload->>'number'), ''),
    complement = nullif(btrim(p_payload->>'complement'), ''),
    district = nullif(btrim(p_payload->>'district'), ''),
    city = btrim(p_payload->>'city'),
    state = upper(btrim(p_payload->>'state')),
    country = coalesce(nullif(btrim(p_payload->>'country'), ''), 'Brasil'),
    father_name = nullif(btrim(p_payload->>'father_name'), ''),
    mother_name = nullif(btrim(p_payload->>'mother_name'), ''),
    spouse_name = nullif(btrim(p_payload->>'spouse_name'), ''),
    member_type = upper(coalesce(nullif(btrim(p_payload->>'member_type'), ''), member.member_type)),
    conversion_date = nullif(p_payload->>'conversion_date', '')::date,
    baptism_date = nullif(p_payload->>'baptism_date', '')::date,
    baptism_church = nullif(btrim(p_payload->>'baptism_church'), ''),
    has_holy_spirit_baptism = coalesce((p_payload->>'has_holy_spirit_baptism')::boolean, false),
    holy_spirit_baptism_date = nullif(p_payload->>'holy_spirit_baptism_date', '')::date,
    previous_church = nullif(btrim(p_payload->>'previous_church'), ''),
    received_by = nullif(upper(btrim(p_payload->>'received_by')), ''),
    received_date = nullif(p_payload->>'received_date', '')::date,
    letter_origin_church = nullif(btrim(p_payload->>'letter_origin_church'), ''),
    notes = nullif(btrim(p_payload->>'notes'), '')
  where member.id = p_member_id
  returning member.updated_at into v_updated_at;

  if p_payload ? 'cpf' or p_payload ? 'rg' or p_payload ? 'issuing_agency' then
    if not public.has_permission(
      v_member.church_id,
      'members.manage_sensitive_identity'
    ) then
      raise exception 'MEMBER_SENSITIVE_PERMISSION_DENIED';
    end if;

    v_cpf := nullif(regexp_replace(coalesce(p_payload->>'cpf', ''), '[^0-9]', '', 'g'), '');
    v_rg := nullif(btrim(p_payload->>'rg'), '');
    v_issuing_agency := nullif(btrim(p_payload->>'issuing_agency'), '');

    if v_cpf is not null and length(v_cpf) <> 11 then
      raise exception 'MEMBER_CPF_INVALID';
    end if;

    insert into public.member_sensitive_identity (
      member_id,
      church_id,
      cpf,
      rg,
      issuing_agency,
      created_by,
      updated_by,
      deleted_at
    ) values (
      p_member_id,
      v_member.church_id,
      v_cpf,
      v_rg,
      v_issuing_agency,
      v_actor,
      v_actor,
      null
    )
    on conflict (member_id) do update set
      cpf = excluded.cpf,
      rg = excluded.rg,
      issuing_agency = excluded.issuing_agency,
      updated_by = v_actor,
      updated_at = now(),
      deleted_at = null;
  end if;

  if p_payload ? 'pastoral_notes' then
    if not public.has_permission(
      v_member.church_id,
      'members.edit_pastoral_notes'
    ) then
      raise exception 'MEMBER_PASTORAL_PERMISSION_DENIED';
    end if;

    v_pastoral_notes := nullif(btrim(p_payload->>'pastoral_notes'), '');

    if v_pastoral_notes is not null then
      insert into public.member_pastoral_notes (
        member_id,
        church_id,
        notes,
        created_by,
        updated_by,
        deleted_at
      ) values (
        p_member_id,
        v_member.church_id,
        v_pastoral_notes,
        v_actor,
        v_actor,
        null
      )
      on conflict (member_id) do update set
        notes = excluded.notes,
        updated_by = v_actor,
        updated_at = now(),
        deleted_at = null;
    else
      update public.member_pastoral_notes
      set deleted_at = now(), updated_by = v_actor, updated_at = now()
      where member_id = p_member_id and deleted_at is null;
    end if;
  end if;

  if p_payload ? 'main_role_id' then
    if not public.has_permission(v_member.church_id, 'member_roles.manage') then
      raise exception 'MEMBER_ROLE_PERMISSION_DENIED';
    end if;

    v_role_id := nullif(p_payload->>'main_role_id', '')::uuid;

    select role_id into v_current_primary_role
    from public.member_roles
    where member_id = p_member_id
      and status = 'ACTIVE'
      and is_primary = true
      and deleted_at is null
    limit 1;

    if v_role_id is distinct from v_current_primary_role then
      update public.member_roles
      set is_primary = false, updated_at = now()
      where member_id = p_member_id
        and status = 'ACTIVE'
        and is_primary = true
        and deleted_at is null;

      if v_role_id is not null then
        if not exists (
          select 1 from public.roles role
          where role.id = v_role_id
            and role.church_id = v_member.church_id
            and role.status = 'ACTIVE'
            and role.deleted_at is null
        ) then
          raise exception 'MEMBER_ROLE_INVALID';
        end if;

        insert into public.member_roles (
          church_id,
          member_id,
          role_id,
          congregation_id,
          is_primary,
          status,
          start_date,
          created_by
        ) values (
          v_member.church_id,
          p_member_id,
          v_role_id,
          v_member.congregation_id,
          true,
          'ACTIVE',
          nullif(p_payload->>'role_start_date', '')::date,
          v_actor
        )
        on conflict (member_id, role_id)
          where deleted_at is null and status = 'ACTIVE'
        do update set
          is_primary = true,
          congregation_id = v_member.congregation_id,
          start_date = coalesce(
            excluded.start_date,
            public.member_roles.start_date
          ),
          updated_at = now();
      end if;

      insert into public.member_history (
        church_id,
        member_id,
        congregation_id,
        history_type,
        title,
        description,
        old_value,
        new_value,
        event_date,
        is_sensitive,
        created_by,
        metadata
      ) values (
        v_member.church_id,
        p_member_id,
        v_member.congregation_id,
        'ROLE_CHANGED',
        'Cargo principal alterado',
        'O Cargo principal do membro foi atualizado.',
        v_current_primary_role::text,
        v_role_id::text,
        current_date,
        false,
        v_actor,
        jsonb_build_object(
          'old_role_id', v_current_primary_role,
          'new_role_id', v_role_id
        )
      );
    end if;
  end if;

  if v_member.member_type is distinct from upper(p_payload->>'member_type') then
    insert into public.member_history (
      church_id, member_id, congregation_id, history_type, title,
      description, old_value, new_value, event_date, is_sensitive,
      created_by, metadata
    ) values (
      v_member.church_id, p_member_id, v_member.congregation_id,
      'STATUS_CHANGE', 'Tipo de cadastro alterado',
      'O tipo de vínculo cadastral foi atualizado.',
      v_member.member_type, upper(p_payload->>'member_type'), current_date,
      false, v_actor, '{}'::jsonb
    );
  end if;

  if v_member.received_date is distinct from nullif(p_payload->>'received_date', '')::date
    or v_member.received_by is distinct from nullif(upper(btrim(p_payload->>'received_by')), '') then
    insert into public.member_history (
      church_id, member_id, congregation_id, history_type, title,
      description, old_value, new_value, event_date, is_sensitive,
      created_by, metadata
    ) values (
      v_member.church_id, p_member_id, v_member.congregation_id,
      'MEMBER_RECEIVED', 'Recebimento atualizado',
      'A informação de recebimento oficial foi atualizada.',
      v_member.received_by, nullif(upper(btrim(p_payload->>'received_by')), ''),
      coalesce(nullif(p_payload->>'received_date', '')::date, current_date),
      false, v_actor,
      jsonb_build_object(
        'old_date', v_member.received_date,
        'new_date', nullif(p_payload->>'received_date', '')::date
      )
    );
  end if;

  if v_member.baptism_date is distinct from nullif(p_payload->>'baptism_date', '')::date
    or v_member.has_holy_spirit_baptism is distinct from coalesce((p_payload->>'has_holy_spirit_baptism')::boolean, false)
    or v_member.holy_spirit_baptism_date is distinct from nullif(p_payload->>'holy_spirit_baptism_date', '')::date then
    insert into public.member_history (
      church_id, member_id, congregation_id, history_type, title,
      description, event_date, is_sensitive, created_by, metadata
    ) values (
      v_member.church_id, p_member_id, v_member.congregation_id,
      'BAPTISM_UPDATED', 'Informações de batismo atualizadas',
      'Os dados de batismo do membro foram atualizados.',
      current_date, false, v_actor, '{}'::jsonb
    );
  end if;

  return v_updated_at;
end;
$function$
;
CREATE OR REPLACE FUNCTION public.change_member_lifecycle(p_member_id uuid, p_action text, p_event_date date DEFAULT CURRENT_DATE, p_reason text DEFAULT NULL::text, p_target_congregation_id uuid DEFAULT NULL::uuid, p_destination_church text DEFAULT NULL::text, p_end_roles boolean DEFAULT true, p_sensitive boolean DEFAULT false)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_actor uuid := auth.uid();
  v_member public.members%rowtype;
  v_action text := upper(btrim(p_action));
  v_old_congregation_name text;
  v_new_congregation_name text;
begin
  if v_actor is null then raise exception 'AUTH_REQUIRED'; end if;
  if p_event_date is null or p_event_date > current_date then
    raise exception 'MEMBER_EVENT_DATE_INVALID';
  end if;

  select * into v_member
  from public.members member
  where member.id = p_member_id
  for update;

  if v_member.id is null then raise exception 'MEMBER_NOT_FOUND'; end if;

  if not public.can_access_member(
    v_member.church_id,
    v_member.id,
    v_member.congregation_id
  ) then
    raise exception 'MEMBER_PERMISSION_DENIED';
  end if;

  if v_action = 'ARCHIVE' then
    if v_member.deleted_at is not null then raise exception 'MEMBER_ALREADY_ARCHIVED'; end if;
    if not public.has_permission(v_member.church_id, 'members.archive') then
      raise exception 'MEMBER_PERMISSION_DENIED';
    end if;
    update public.members set deleted_at = now() where id = p_member_id;
    return jsonb_build_object('status', v_member.member_status, 'archived', true);
  elsif v_action = 'RESTORE' then
    if v_member.deleted_at is null then raise exception 'MEMBER_NOT_ARCHIVED'; end if;
    if not public.has_permission(v_member.church_id, 'members.restore') then
      raise exception 'MEMBER_PERMISSION_DENIED';
    end if;
    update public.members set deleted_at = null where id = p_member_id;
    return jsonb_build_object('status', v_member.member_status, 'archived', false);
  end if;

  if v_member.deleted_at is not null then raise exception 'MEMBER_NOT_FOUND'; end if;

  if v_action = 'MOVE_CONGREGATION' then
    if not public.has_permission(v_member.church_id, 'members.transfer') then
      raise exception 'MEMBER_PERMISSION_DENIED';
    end if;
    if p_target_congregation_id is null
      or p_target_congregation_id = v_member.congregation_id
      or not exists (
        select 1 from public.congregations congregation
        where congregation.id = p_target_congregation_id
          and congregation.church_id = v_member.church_id
          and congregation.status = 'ACTIVE'
          and congregation.deleted_at is null
      )
      or not public.can_access_congregation(
        v_member.church_id,
        p_target_congregation_id
      ) then
      raise exception 'MEMBER_CONGREGATION_INVALID';
    end if;

    select name into v_old_congregation_name
    from public.congregations where id = v_member.congregation_id;
    select name into v_new_congregation_name
    from public.congregations where id = p_target_congregation_id;

    update public.members
    set congregation_id = p_target_congregation_id
    where id = p_member_id;

    update public.member_roles
    set congregation_id = p_target_congregation_id, updated_at = now()
    where member_id = p_member_id
      and status = 'ACTIVE'
      and deleted_at is null;

    insert into public.member_history (
      church_id, member_id, congregation_id, history_type, title,
      description, old_value, new_value, event_date, is_sensitive,
      created_by, metadata
    ) values (
      v_member.church_id, p_member_id, p_target_congregation_id,
      'CONGREGATION_CHANGE', 'Mudança de Congregação',
      nullif(btrim(p_reason), ''), v_old_congregation_name,
      v_new_congregation_name, p_event_date, false, v_actor,
      jsonb_build_object(
        'origin_congregation_id', v_member.congregation_id,
        'destination_congregation_id', p_target_congregation_id
      )
    );

  elsif v_action = 'INACTIVATE' then
    if not public.has_permission(v_member.church_id, 'members.change_status') then
      raise exception 'MEMBER_PERMISSION_DENIED';
    end if;
    if nullif(btrim(p_reason), '') is null then raise exception 'MEMBER_REASON_REQUIRED'; end if;
    update public.members
    set member_status = 'INACTIVE', inactive_reason = btrim(p_reason)
    where id = p_member_id;
    insert into public.member_history (
      church_id, member_id, congregation_id, history_type, title,
      description, old_value, new_value, event_date, is_sensitive,
      created_by, metadata
    ) values (
      v_member.church_id, p_member_id, v_member.congregation_id,
      'MEMBER_INACTIVATED', 'Membro inativado', btrim(p_reason),
      v_member.member_status, 'INACTIVE', p_event_date, p_sensitive,
      v_actor, '{}'::jsonb
    );

  elsif v_action = 'REACTIVATE' then
    if not public.has_permission(v_member.church_id, 'members.change_status') then
      raise exception 'MEMBER_PERMISSION_DENIED';
    end if;
    update public.members
    set member_status = 'ACTIVE', inactive_reason = null
    where id = p_member_id;
    insert into public.member_history (
      church_id, member_id, congregation_id, history_type, title,
      description, old_value, new_value, event_date, is_sensitive,
      created_by, metadata
    ) values (
      v_member.church_id, p_member_id, v_member.congregation_id,
      'MEMBER_REACTIVATED', 'Membro reativado', nullif(btrim(p_reason), ''),
      v_member.member_status, 'ACTIVE', p_event_date, false,
      v_actor, '{}'::jsonb
    );

  elsif v_action = 'TRANSFER' then
    if not public.has_permission(v_member.church_id, 'members.transfer') then
      raise exception 'MEMBER_PERMISSION_DENIED';
    end if;
    if nullif(btrim(p_destination_church), '') is null then
      raise exception 'MEMBER_DESTINATION_REQUIRED';
    end if;
    update public.members
    set member_status = 'TRANSFERRED',
        letter_destination_church = btrim(p_destination_church),
        transfer_date = p_event_date
    where id = p_member_id;
    if p_end_roles then
      update public.member_roles
      set status = 'ENDED', end_date = p_event_date,
          is_primary = false, updated_at = now()
      where member_id = p_member_id
        and status = 'ACTIVE'
        and deleted_at is null;
    end if;
    insert into public.member_history (
      church_id, member_id, congregation_id, history_type, title,
      description, old_value, new_value, event_date, is_sensitive,
      created_by, metadata
    ) values (
      v_member.church_id, p_member_id, v_member.congregation_id,
      'MEMBER_TRANSFERRED', 'Membro transferido para outra igreja',
      nullif(btrim(p_reason), ''), v_member.member_status,
      btrim(p_destination_church), p_event_date, false, v_actor,
      jsonb_build_object('roles_ended', p_end_roles)
    );

  elsif v_action = 'DISCIPLINE' then
    if not public.has_permission(v_member.church_id, 'members.change_status')
      or not public.has_permission(v_member.church_id, 'member_history.view_sensitive') then
      raise exception 'MEMBER_PERMISSION_DENIED';
    end if;
    if nullif(btrim(p_reason), '') is null then raise exception 'MEMBER_REASON_REQUIRED'; end if;
    update public.members set member_status = 'DISCIPLINED' where id = p_member_id;
    if p_end_roles then
      update public.member_roles
      set status = 'SUSPENDED', is_primary = false, updated_at = now()
      where member_id = p_member_id
        and status = 'ACTIVE'
        and deleted_at is null;
    end if;
    insert into public.member_history (
      church_id, member_id, congregation_id, history_type, title,
      description, old_value, new_value, event_date, is_sensitive,
      created_by, metadata
    ) values (
      v_member.church_id, p_member_id, v_member.congregation_id,
      'MEMBER_DISCIPLINED', 'Situação disciplinar registrada',
      btrim(p_reason), v_member.member_status, 'DISCIPLINED',
      p_event_date, true, v_actor,
      jsonb_build_object('roles_suspended', p_end_roles)
    );

  elsif v_action = 'DECEASED' then
    if not public.has_permission(v_member.church_id, 'members.change_status') then
      raise exception 'MEMBER_PERMISSION_DENIED';
    end if;
    update public.members set member_status = 'DECEASED' where id = p_member_id;
    update public.member_roles
    set status = 'ENDED', end_date = p_event_date,
        is_primary = false, updated_at = now()
    where member_id = p_member_id
      and status = 'ACTIVE'
      and deleted_at is null;
    insert into public.member_history (
      church_id, member_id, congregation_id, history_type, title,
      description, old_value, new_value, event_date, is_sensitive,
      created_by, metadata
    ) values (
      v_member.church_id, p_member_id, v_member.congregation_id,
      'MEMBER_DECEASED', 'Falecimento registrado',
      nullif(btrim(p_reason), ''), v_member.member_status, 'DECEASED',
      p_event_date, false, v_actor, '{}'::jsonb
    );
  else
    raise exception 'MEMBER_ACTION_INVALID';
  end if;

  return jsonb_build_object(
    'status', (
      select member.member_status from public.members member
      where member.id = p_member_id
    ),
    'congregation_id', (
      select member.congregation_id from public.members member
      where member.id = p_member_id
    ),
    'archived', false
  );
end;
$function$
;
CREATE OR REPLACE FUNCTION public.manage_member_role(p_member_id uuid, p_operation text, p_role_id uuid DEFAULT NULL::uuid, p_link_id uuid DEFAULT NULL::uuid, p_start_date date DEFAULT NULL::date, p_end_date date DEFAULT NULL::date, p_notes text DEFAULT NULL::text, p_is_primary boolean DEFAULT false)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_actor uuid := auth.uid();
  v_member public.members%rowtype;
  v_current public.member_roles%rowtype;
  v_result uuid;
  v_operation text := pg_catalog.upper(pg_catalog.btrim(p_operation));
  v_event_date date := coalesce(p_start_date, current_date);
  v_old_role_name text;
  v_new_role_name text;
begin
  if v_actor is null then
    raise exception 'AUTH_REQUIRED';
  end if;

  select *
  into v_member
  from public.members member
  where member.id = p_member_id
    and member.deleted_at is null
  for update;

  if v_member.id is null then
    raise exception 'MEMBER_NOT_FOUND';
  end if;

  if not public.has_permission(v_member.church_id, 'member_roles.manage')
    or not public.can_access_member(
      v_member.church_id,
      v_member.id,
      v_member.congregation_id
    ) then
    raise exception 'MEMBER_ROLE_PERMISSION_DENIED';
  end if;

  if v_operation <> 'SET' then
    raise exception 'MEMBER_ROLE_OPERATION_INVALID';
  end if;

  if p_start_date is not null and p_start_date > current_date then
    raise exception 'MEMBER_ROLE_DATE_INVALID';
  end if;

  if p_role_id is not null then
    select
      case
        when v_member.gender = 'FEMALE'
          then coalesce(role.female_name, role.name)
        else role.name
      end
    into v_new_role_name
    from public.roles role
    where role.id = p_role_id
      and role.church_id = v_member.church_id
      and role.status = 'ACTIVE'
      and role.deleted_at is null;

    if v_new_role_name is null then
      raise exception 'MEMBER_ROLE_INVALID';
    end if;
  end if;

  select *
  into v_current
  from public.member_roles link
  where link.church_id = v_member.church_id
    and link.member_id = p_member_id
    and link.status = 'ACTIVE'
    and link.deleted_at is null
  for update;

  if v_current.id is not null then
    select
      case
        when v_member.gender = 'FEMALE'
          then coalesce(role.female_name, role.name)
        else role.name
      end
    into v_old_role_name
    from public.roles role
    where role.id = v_current.role_id
      and role.church_id = v_member.church_id;
  end if;

  if v_current.id is not null and v_current.role_id = p_role_id then
    update public.member_roles
    set
      start_date = p_start_date,
      notes = nullif(pg_catalog.btrim(p_notes), ''),
      is_primary = true,
      updated_at = now()
    where id = v_current.id;
    return v_current.id;
  end if;

  if v_current.id is not null then
    update public.member_roles
    set
      status = 'ENDED',
      end_date = greatest(
        v_event_date,
        coalesce(v_current.start_date, v_event_date)
      ),
      is_primary = false,
      updated_at = now()
    where id = v_current.id;
    v_result := v_current.id;
  end if;

  if p_role_id is not null then
    insert into public.member_roles (
      church_id,
      member_id,
      role_id,
      congregation_id,
      is_primary,
      status,
      start_date,
      notes,
      created_by
    ) values (
      v_member.church_id,
      p_member_id,
      p_role_id,
      v_member.congregation_id,
      true,
      'ACTIVE',
      p_start_date,
      nullif(pg_catalog.btrim(p_notes), ''),
      v_actor
    )
    returning id into v_result;
  end if;

  if v_current.id is not null or p_role_id is not null then
    insert into public.member_history (
      church_id,
      member_id,
      congregation_id,
      history_type,
      title,
      description,
      old_value,
      new_value,
      event_date,
      is_sensitive,
      created_by,
      metadata
    ) values (
      v_member.church_id,
      p_member_id,
      v_member.congregation_id,
      'ROLE_CHANGED',
      'Cargo alterado',
      case
        when v_current.id is null then 'O Cargo do membro foi definido.'
        when p_role_id is null then 'O Cargo atual do membro foi encerrado.'
        else 'O Cargo do membro foi atualizado.'
      end,
      v_old_role_name,
      v_new_role_name,
      v_event_date,
      false,
      v_actor,
      pg_catalog.jsonb_strip_nulls(
        pg_catalog.jsonb_build_object(
          'old_role_id', v_current.role_id,
          'new_role_id', p_role_id,
          'old_link_id', v_current.id,
          'new_link_id', case when p_role_id is not null then v_result else null end
        )
      )
    );
  end if;

  return coalesce(v_result, p_member_id);
end;
$function$
;
CREATE OR REPLACE FUNCTION public.is_valid_cpf(p_value text)
 RETURNS boolean
 LANGUAGE plpgsql
 IMMUTABLE STRICT
 SET search_path TO ''
AS $function$
declare
  v_cpf text := pg_catalog.regexp_replace(p_value, '[^0-9]', '', 'g');
  v_sum integer := 0;
  v_remainder integer;
  v_first_digit integer;
  v_second_digit integer;
  v_index integer;
begin
  if pg_catalog.length(v_cpf) <> 11 or v_cpf ~ '^([0-9])\1{10}$' then
    return false;
  end if;

  for v_index in 1..9 loop
    v_sum := v_sum + pg_catalog.substr(v_cpf, v_index, 1)::integer * (11 - v_index);
  end loop;
  v_remainder := v_sum % 11;
  v_first_digit := case when v_remainder < 2 then 0 else 11 - v_remainder end;

  if v_first_digit <> pg_catalog.substr(v_cpf, 10, 1)::integer then
    return false;
  end if;

  v_sum := 0;
  for v_index in 1..10 loop
    v_sum := v_sum + pg_catalog.substr(v_cpf, v_index, 1)::integer * (12 - v_index);
  end loop;
  v_remainder := v_sum % 11;
  v_second_digit := case when v_remainder < 2 then 0 else 11 - v_remainder end;

  return v_second_digit = pg_catalog.substr(v_cpf, 11, 1)::integer;
end;
$function$
;
CREATE OR REPLACE FUNCTION public.enrich_member_role_history()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare
  v_uuid_pattern constant text := '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$';
  v_old_role_id text;
  v_new_role_id text;
  v_role_id text;
  v_old_role_name text;
  v_new_role_name text;
  v_role_name text;
begin
  if new.history_type not in ('ROLE_ASSIGNED', 'ROLE_CHANGED', 'ROLE_ENDED') then
    return new;
  end if;

  v_old_role_id := nullif(new.metadata->>'old_role_id', '');
  v_new_role_id := nullif(new.metadata->>'new_role_id', '');
  v_role_id := nullif(new.metadata->>'role_id', '');

  if v_old_role_id is null and coalesce(new.old_value, '') ~* v_uuid_pattern then
    v_old_role_id := new.old_value;
  end if;
  if v_new_role_id is null and coalesce(new.new_value, '') ~* v_uuid_pattern then
    v_new_role_id := new.new_value;
  end if;

  if v_old_role_id is not null then
    select case when member.gender = 'FEMALE' then coalesce(role.female_name, role.name) else role.name end
    into v_old_role_name
    from public.roles role
    join public.members member on member.id = new.member_id and member.church_id = new.church_id
    where role.id::text = v_old_role_id and role.church_id = new.church_id;
  end if;

  if v_new_role_id is not null then
    select case when member.gender = 'FEMALE' then coalesce(role.female_name, role.name) else role.name end
    into v_new_role_name
    from public.roles role
    join public.members member on member.id = new.member_id and member.church_id = new.church_id
    where role.id::text = v_new_role_id and role.church_id = new.church_id;
  end if;

  if v_role_id is not null then
    select case when member.gender = 'FEMALE' then coalesce(role.female_name, role.name) else role.name end
    into v_role_name
    from public.roles role
    join public.members member on member.id = new.member_id and member.church_id = new.church_id
    where role.id::text = v_role_id and role.church_id = new.church_id;
  end if;

  if new.history_type = 'ROLE_ASSIGNED' then
    new.new_value := coalesce(v_role_name, v_new_role_name, new.new_value);
  elsif new.history_type = 'ROLE_ENDED' then
    new.old_value := coalesce(v_role_name, v_old_role_name, new.old_value);
  else
    new.old_value := coalesce(v_old_role_name, new.old_value);
    new.new_value := coalesce(v_new_role_name, v_role_name, new.new_value);
  end if;
  return new;
end;
$function$
;
CREATE OR REPLACE FUNCTION public.normalize_member_role_history_language()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
begin
  if new.history_type in ('ROLE_ASSIGNED', 'ROLE_CHANGED', 'ROLE_ENDED') then
    new.title := pg_catalog.replace(new.title, 'Cargo principal', 'Cargo');
    new.description := pg_catalog.replace(
      new.description,
      'Cargo principal',
      'Cargo'
    );
  end if;
  return new;
end;
$function$
;
CREATE OR REPLACE FUNCTION public.get_my_access_context(p_preferred_church_id uuid DEFAULT NULL::uuid)
 RETURNS jsonb
 LANGUAGE sql
 STABLE
 SET search_path TO 'public'
AS $function$
  with my_profile as (
    select
      p.id,
      p.full_name,
      p.display_name,
      p.email,
      p.avatar_url,
      p.status,
      p.deleted_at
    from public.profiles p
    where p.id = (select auth.uid())
    limit 1
  ),
  active_accesses as (
    select
      a.id,
      a.church_id,
      a.role,
      a.access_scope,
      a.status,
      a.region_id,
      a.congregation_id,
      a.ministry_id,
      a.accepted_at,
      ch.name as church_name,
      ch.logo_url as church_logo_url
    from public.user_church_access a
    join public.churches ch on ch.id = a.church_id
    where a.profile_id = (select auth.uid())
      and a.status = 'ACTIVE'
      and a.deleted_at is null
      and ch.status = 'ACTIVE'
      and ch.deleted_at is null
  ),
  selected_access as (
    select a.*
    from active_accesses a
    order by
      case when a.church_id = p_preferred_church_id then 0 else 1 end,
      a.accepted_at asc nulls last,
      a.id
    limit 1
  )
  select jsonb_build_object(
    'profile', jsonb_build_object(
      'id', p.id,
      'full_name', p.full_name,
      'display_name', p.display_name,
      'email', p.email,
      'avatar_url', p.avatar_url,
      'status', p.status,
      'deleted_at', p.deleted_at
    ),
    'accesses', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', a.id,
          'church_id', a.church_id,
          'role', a.role,
          'access_scope', a.access_scope,
          'status', a.status,
          'region_id', a.region_id,
          'congregation_id', a.congregation_id,
          'ministry_id', a.ministry_id,
          'church', jsonb_build_object(
            'id', a.church_id,
            'name', a.church_name,
            'logo_url', a.church_logo_url
          )
        )
        order by a.accepted_at asc nulls last, a.id
      )
      from active_accesses a
    ), '[]'::jsonb),
    'selected_access_id', (select s.id from selected_access s),
    'permissions', coalesce((
      select jsonb_agg(permission.permission_key order by permission.permission_key)
      from selected_access s
      cross join lateral public.get_my_permissions(s.church_id) permission
    ), '[]'::jsonb)
  )
  from my_profile p;
$function$
;

-- Source: remote migration 20260808000324_trial_clone_public_indexes
CREATE INDEX accounts_payable_cashbox_id_idx ON public.accounts_payable USING btree (cashbox_id);
CREATE INDEX accounts_payable_category_id_idx ON public.accounts_payable USING btree (category_id);
CREATE INDEX accounts_payable_church_id_idx ON public.accounts_payable USING btree (church_id);
CREATE INDEX accounts_payable_congregation_id_idx ON public.accounts_payable USING btree (congregation_id);
CREATE INDEX accounts_payable_created_by_idx ON public.accounts_payable USING btree (created_by);
CREATE INDEX accounts_payable_deleted_at_idx ON public.accounts_payable USING btree (deleted_at);
CREATE INDEX accounts_payable_department_id_idx ON public.accounts_payable USING btree (department_id);
CREATE INDEX accounts_payable_document_number_idx ON public.accounts_payable USING btree (document_number);
CREATE INDEX accounts_payable_due_date_idx ON public.accounts_payable USING btree (due_date);
CREATE INDEX accounts_payable_financial_transaction_id_idx ON public.accounts_payable USING btree (financial_transaction_id);
CREATE INDEX accounts_payable_has_attachment_idx ON public.accounts_payable USING btree (has_attachment);
CREATE INDEX accounts_payable_metadata_gin_idx ON public.accounts_payable USING gin (metadata);
CREATE INDEX accounts_payable_number_idx ON public.accounts_payable USING btree (payable_number);
CREATE UNIQUE INDEX accounts_payable_number_unique_idx ON public.accounts_payable USING btree (church_id, payable_number) WHERE ((payable_number IS NOT NULL) AND (payable_number <> ''::text) AND (deleted_at IS NULL));
CREATE INDEX accounts_payable_paid_at_idx ON public.accounts_payable USING btree (paid_at);
CREATE INDEX accounts_payable_paid_by_idx ON public.accounts_payable USING btree (paid_by);
CREATE INDEX accounts_payable_payment_method_id_idx ON public.accounts_payable USING btree (payment_method_id);
CREATE INDEX accounts_payable_status_idx ON public.accounts_payable USING btree (status);
CREATE INDEX accounts_payable_supplier_name_idx ON public.accounts_payable USING btree (supplier_name);
CREATE INDEX app_settings_church_id_idx ON public.app_settings USING btree (church_id);
CREATE UNIQUE INDEX app_settings_church_unique_idx ON public.app_settings USING btree (church_id) WHERE (deleted_at IS NULL);
CREATE INDEX app_settings_dashboard_settings_gin_idx ON public.app_settings USING gin (dashboard_settings);
CREATE INDEX app_settings_deleted_at_idx ON public.app_settings USING btree (deleted_at);
CREATE INDEX app_settings_document_settings_gin_idx ON public.app_settings USING gin (document_settings);
CREATE INDEX app_settings_notification_channels_gin_idx ON public.app_settings USING gin (notification_channels);
CREATE INDEX app_settings_report_settings_gin_idx ON public.app_settings USING gin (report_settings);
CREATE INDEX app_settings_status_idx ON public.app_settings USING btree (status);
CREATE INDEX audit_logs_action_idx ON public.audit_logs USING btree (action);
CREATE INDEX audit_logs_actor_profile_id_idx ON public.audit_logs USING btree (actor_profile_id);
CREATE INDEX audit_logs_church_id_idx ON public.audit_logs USING btree (church_id);
CREATE INDEX audit_logs_created_at_idx ON public.audit_logs USING btree (created_at);
CREATE INDEX audit_logs_entity_idx ON public.audit_logs USING btree (entity_type, entity_id);
CREATE INDEX audit_logs_metadata_gin_idx ON public.audit_logs USING gin (metadata);
CREATE INDEX audit_logs_module_idx ON public.audit_logs USING btree (module);
CREATE INDEX audit_logs_new_values_gin_idx ON public.audit_logs USING gin (new_values);
CREATE INDEX audit_logs_old_values_gin_idx ON public.audit_logs USING gin (old_values);
CREATE INDEX audit_logs_severity_idx ON public.audit_logs USING btree (severity);
CREATE INDEX church_invitations_church_status_idx ON public.church_invitations USING btree (church_id, status);
CREATE INDEX church_invitations_email_status_idx ON public.church_invitations USING btree (email_normalized, status);
CREATE UNIQUE INDEX church_invitations_pending_target_idx ON public.church_invitations USING btree (church_id, email_normalized, access_scope, COALESCE(region_id, '00000000-0000-0000-0000-000000000000'::uuid), COALESCE(congregation_id, '00000000-0000-0000-0000-000000000000'::uuid), COALESCE(ministry_id, '00000000-0000-0000-0000-000000000000'::uuid)) WHERE ((status = 'PENDING'::text) AND (deleted_at IS NULL));
CREATE UNIQUE INDEX church_invitations_token_hash_idx ON public.church_invitations USING btree (token_hash) WHERE (deleted_at IS NULL);
CREATE INDEX churches_city_state_idx ON public.churches USING btree (city, state);
CREATE INDEX churches_deleted_at_idx ON public.churches USING btree (deleted_at);
CREATE UNIQUE INDEX churches_document_active_unique_idx ON public.churches USING btree (lower(regexp_replace(document, '[^0-9A-Za-z]'::text, ''::text, 'g'::text))) WHERE ((document IS NOT NULL) AND (document <> ''::text) AND (deleted_at IS NULL));
CREATE INDEX churches_status_idx ON public.churches USING btree (status);
CREATE INDEX congregation_documents_congregation_active_idx ON public.congregation_documents USING btree (church_id, congregation_id, uploaded_at DESC, id) WHERE ((deleted_at IS NULL) AND (upload_status = 'ACTIVE'::text));
CREATE INDEX congregation_documents_deleted_by_idx ON public.congregation_documents USING btree (deleted_by) WHERE (deleted_by IS NOT NULL);
CREATE INDEX congregation_documents_pending_idx ON public.congregation_documents USING btree (uploaded_at, id) WHERE ((deleted_at IS NULL) AND (upload_status = 'PENDING'::text));
CREATE INDEX congregation_documents_uploaded_by_idx ON public.congregation_documents USING btree (uploaded_by);
CREATE UNIQUE INDEX congregations_church_code_active_unique_idx ON public.congregations USING btree (church_id, upper(btrim(code))) WHERE ((code IS NOT NULL) AND (btrim(code) <> ''::text) AND (deleted_at IS NULL));
CREATE INDEX congregations_church_id_idx ON public.congregations USING btree (church_id);
CREATE UNIQUE INDEX congregations_church_name_active_unique_idx ON public.congregations USING btree (church_id, lower(btrim(name))) WHERE (deleted_at IS NULL);
CREATE INDEX congregations_church_region_active_idx ON public.congregations USING btree (church_id, region_id) WHERE (deleted_at IS NULL);
CREATE INDEX congregations_church_status_order_active_idx ON public.congregations USING btree (church_id, status, display_order, name, id) WHERE (deleted_at IS NULL);
CREATE INDEX congregations_city_state_idx ON public.congregations USING btree (city, state);
CREATE INDEX congregations_deleted_at_idx ON public.congregations USING btree (deleted_at);
CREATE UNIQUE INDEX congregations_one_active_headquarters_idx ON public.congregations USING btree (church_id) WHERE ((is_headquarters = true) AND (status = 'ACTIVE'::text) AND (deleted_at IS NULL));
CREATE INDEX congregations_region_id_idx ON public.congregations USING btree (region_id);
CREATE INDEX congregations_status_idx ON public.congregations USING btree (status);
CREATE INDEX event_checkins_checked_in_at_idx ON public.event_checkins USING btree (checked_in_at);
CREATE INDEX event_checkins_checked_in_by_idx ON public.event_checkins USING btree (checked_in_by);
CREATE INDEX event_checkins_church_id_idx ON public.event_checkins USING btree (church_id);
CREATE INDEX event_checkins_code_idx ON public.event_checkins USING btree (checkin_code);
CREATE UNIQUE INDEX event_checkins_code_unique_idx ON public.event_checkins USING btree (church_id, checkin_code) WHERE ((checkin_code IS NOT NULL) AND (checkin_code <> ''::text) AND (deleted_at IS NULL));
CREATE INDEX event_checkins_deleted_at_idx ON public.event_checkins USING btree (deleted_at);
CREATE INDEX event_checkins_event_id_idx ON public.event_checkins USING btree (event_id);
CREATE INDEX event_checkins_group_id_idx ON public.event_checkins USING btree (event_group_id);
CREATE INDEX event_checkins_metadata_gin_idx ON public.event_checkins USING gin (metadata);
CREATE INDEX event_checkins_method_idx ON public.event_checkins USING btree (checkin_method);
CREATE INDEX event_checkins_registration_id_idx ON public.event_checkins USING btree (event_registration_id);
CREATE UNIQUE INDEX event_checkins_registration_unique_idx ON public.event_checkins USING btree (event_registration_id) WHERE ((deleted_at IS NULL) AND (status = 'CHECKED_IN'::text));
CREATE INDEX event_checkins_status_idx ON public.event_checkins USING btree (status);
CREATE INDEX event_congregation_quotas_church_id_idx ON public.event_congregation_quotas USING btree (church_id);
CREATE INDEX event_congregation_quotas_congregation_id_idx ON public.event_congregation_quotas USING btree (congregation_id);
CREATE INDEX event_congregation_quotas_created_by_idx ON public.event_congregation_quotas USING btree (created_by);
CREATE INDEX event_congregation_quotas_deleted_at_idx ON public.event_congregation_quotas USING btree (deleted_at);
CREATE INDEX event_congregation_quotas_event_id_idx ON public.event_congregation_quotas USING btree (event_id);
CREATE UNIQUE INDEX event_congregation_quotas_unique_idx ON public.event_congregation_quotas USING btree (event_id, congregation_id) WHERE (deleted_at IS NULL);
CREATE INDEX event_documents_church_id_idx ON public.event_documents USING btree (church_id);
CREATE INDEX event_documents_deleted_at_idx ON public.event_documents USING btree (deleted_at);
CREATE INDEX event_documents_event_id_idx ON public.event_documents USING btree (event_id);
CREATE INDEX event_documents_group_id_idx ON public.event_documents USING btree (event_group_id);
CREATE INDEX event_documents_is_sensitive_idx ON public.event_documents USING btree (is_sensitive);
CREATE INDEX event_documents_metadata_gin_idx ON public.event_documents USING gin (metadata);
CREATE INDEX event_documents_payment_id_idx ON public.event_documents USING btree (event_payment_id);
CREATE INDEX event_documents_registration_id_idx ON public.event_documents USING btree (event_registration_id);
CREATE INDEX event_documents_status_idx ON public.event_documents USING btree (status);
CREATE UNIQUE INDEX event_documents_storage_path_unique_idx ON public.event_documents USING btree (storage_bucket, storage_path) WHERE (deleted_at IS NULL);
CREATE INDEX event_documents_type_idx ON public.event_documents USING btree (document_type);
CREATE INDEX event_documents_uploaded_at_idx ON public.event_documents USING btree (uploaded_at);
CREATE INDEX event_documents_uploaded_by_idx ON public.event_documents USING btree (uploaded_by);
CREATE INDEX event_groups_church_id_idx ON public.event_groups USING btree (church_id);
CREATE INDEX event_groups_created_by_idx ON public.event_groups USING btree (created_by);
CREATE INDEX event_groups_deleted_at_idx ON public.event_groups USING btree (deleted_at);
CREATE INDEX event_groups_event_id_idx ON public.event_groups USING btree (event_id);
CREATE UNIQUE INDEX event_groups_event_origin_unique_idx ON public.event_groups USING btree (event_id, lower(origin_city), lower(origin_state), lower(COALESCE(origin_field_name, ''::text))) WHERE (deleted_at IS NULL);
CREATE INDEX event_groups_origin_city_state_idx ON public.event_groups USING btree (origin_city, origin_state);
CREATE INDEX event_groups_pastor_name_idx ON public.event_groups USING btree (pastor_name);
CREATE INDEX event_groups_responsible_name_idx ON public.event_groups USING btree (responsible_name);
CREATE INDEX event_groups_status_idx ON public.event_groups USING btree (status);
CREATE INDEX event_items_church_id_idx ON public.event_items USING btree (church_id);
CREATE INDEX event_items_created_by_idx ON public.event_items USING btree (created_by);
CREATE INDEX event_items_deleted_at_idx ON public.event_items USING btree (deleted_at);
CREATE INDEX event_items_event_id_idx ON public.event_items USING btree (event_id);
CREATE UNIQUE INDEX event_items_event_name_unique_idx ON public.event_items USING btree (event_id, lower(name)) WHERE (deleted_at IS NULL);
CREATE INDEX event_items_is_active_idx ON public.event_items USING btree (is_active);
CREATE INDEX event_items_is_required_idx ON public.event_items USING btree (is_required);
CREATE INDEX event_items_settings_gin_idx ON public.event_items USING gin (settings);
CREATE INDEX event_items_sort_order_idx ON public.event_items USING btree (sort_order);
CREATE INDEX event_items_type_idx ON public.event_items USING btree (item_type);
CREATE INDEX event_payments_church_id_idx ON public.event_payments USING btree (church_id);
CREATE INDEX event_payments_confirmed_by_idx ON public.event_payments USING btree (confirmed_by);
CREATE INDEX event_payments_created_by_idx ON public.event_payments USING btree (created_by);
CREATE INDEX event_payments_deleted_at_idx ON public.event_payments USING btree (deleted_at);
CREATE INDEX event_payments_due_date_idx ON public.event_payments USING btree (due_date);
CREATE INDEX event_payments_event_id_idx ON public.event_payments USING btree (event_id);
CREATE INDEX event_payments_group_id_idx ON public.event_payments USING btree (event_group_id);
CREATE UNIQUE INDEX event_payments_group_installment_unique_idx ON public.event_payments USING btree (event_group_id, installment_number) WHERE ((event_group_id IS NOT NULL) AND (deleted_at IS NULL) AND (payment_status <> 'CANCELLED'::text));
CREATE INDEX event_payments_metadata_gin_idx ON public.event_payments USING gin (metadata);
CREATE INDEX event_payments_method_idx ON public.event_payments USING btree (payment_method);
CREATE UNIQUE INDEX event_payments_number_unique_idx ON public.event_payments USING btree (church_id, payment_number) WHERE ((payment_number IS NOT NULL) AND (payment_number <> ''::text) AND (deleted_at IS NULL));
CREATE INDEX event_payments_paid_at_idx ON public.event_payments USING btree (paid_at);
CREATE INDEX event_payments_payment_number_idx ON public.event_payments USING btree (payment_number);
CREATE INDEX event_payments_registration_id_idx ON public.event_payments USING btree (event_registration_id);
CREATE UNIQUE INDEX event_payments_registration_installment_unique_idx ON public.event_payments USING btree (event_registration_id, installment_number) WHERE ((event_registration_id IS NOT NULL) AND (deleted_at IS NULL) AND (payment_status <> 'CANCELLED'::text));
CREATE INDEX event_payments_status_idx ON public.event_payments USING btree (payment_status);
CREATE INDEX event_registration_items_church_id_idx ON public.event_registration_items USING btree (church_id);
CREATE INDEX event_registration_items_created_by_idx ON public.event_registration_items USING btree (created_by);
CREATE INDEX event_registration_items_deleted_at_idx ON public.event_registration_items USING btree (deleted_at);
CREATE INDEX event_registration_items_event_id_idx ON public.event_registration_items USING btree (event_id);
CREATE INDEX event_registration_items_event_item_id_idx ON public.event_registration_items USING btree (event_item_id);
CREATE INDEX event_registration_items_group_id_idx ON public.event_registration_items USING btree (event_group_id);
CREATE UNIQUE INDEX event_registration_items_group_item_unique_idx ON public.event_registration_items USING btree (event_group_id, event_item_id) WHERE ((event_group_id IS NOT NULL) AND (deleted_at IS NULL));
CREATE INDEX event_registration_items_item_type_idx ON public.event_registration_items USING btree (item_type);
CREATE INDEX event_registration_items_metadata_gin_idx ON public.event_registration_items USING gin (metadata);
CREATE INDEX event_registration_items_registration_id_idx ON public.event_registration_items USING btree (event_registration_id);
CREATE UNIQUE INDEX event_registration_items_registration_item_unique_idx ON public.event_registration_items USING btree (event_registration_id, event_item_id) WHERE ((event_registration_id IS NOT NULL) AND (deleted_at IS NULL));
CREATE INDEX event_registrations_church_id_idx ON public.event_registrations USING btree (church_id);
CREATE INDEX event_registrations_congregation_id_idx ON public.event_registrations USING btree (congregation_id);
CREATE INDEX event_registrations_created_by_idx ON public.event_registrations USING btree (created_by);
CREATE INDEX event_registrations_deleted_at_idx ON public.event_registrations USING btree (deleted_at);
CREATE UNIQUE INDEX event_registrations_event_document_unique_idx ON public.event_registrations USING btree (event_id, participant_document) WHERE ((participant_document IS NOT NULL) AND (participant_document <> ''::text) AND (deleted_at IS NULL) AND (status <> 'CANCELLED'::text));
CREATE INDEX event_registrations_event_group_id_idx ON public.event_registrations USING btree (event_group_id);
CREATE INDEX event_registrations_event_id_idx ON public.event_registrations USING btree (event_id);
CREATE UNIQUE INDEX event_registrations_event_member_unique_idx ON public.event_registrations USING btree (event_id, member_id) WHERE ((member_id IS NOT NULL) AND (deleted_at IS NULL) AND (status <> 'CANCELLED'::text));
CREATE INDEX event_registrations_member_id_idx ON public.event_registrations USING btree (member_id);
CREATE INDEX event_registrations_metadata_gin_idx ON public.event_registrations USING gin (metadata);
CREATE UNIQUE INDEX event_registrations_number_unique_idx ON public.event_registrations USING btree (church_id, registration_number) WHERE ((registration_number IS NOT NULL) AND (registration_number <> ''::text) AND (deleted_at IS NULL));
CREATE INDEX event_registrations_participant_document_idx ON public.event_registrations USING btree (participant_document);
CREATE INDEX event_registrations_participant_name_idx ON public.event_registrations USING btree (participant_name);
CREATE INDEX event_registrations_payment_status_idx ON public.event_registrations USING btree (payment_status);
CREATE INDEX event_registrations_registered_at_idx ON public.event_registrations USING btree (registered_at);
CREATE INDEX event_registrations_registration_number_idx ON public.event_registrations USING btree (registration_number);
CREATE INDEX event_registrations_status_idx ON public.event_registrations USING btree (status);
CREATE INDEX events_church_id_idx ON public.events USING btree (church_id);
CREATE UNIQUE INDEX events_church_slug_unique_idx ON public.events USING btree (church_id, lower(slug)) WHERE ((slug IS NOT NULL) AND (slug <> ''::text) AND (deleted_at IS NULL));
CREATE INDEX events_congregation_id_idx ON public.events USING btree (congregation_id);
CREATE INDEX events_deleted_at_idx ON public.events USING btree (deleted_at);
CREATE INDEX events_host_city_state_idx ON public.events USING btree (host_city, host_state);
CREATE INDEX events_ministry_id_idx ON public.events USING btree (ministry_id);
CREATE INDEX events_name_idx ON public.events USING btree (name);
CREATE INDEX events_quota_mode_idx ON public.events USING btree (quota_mode);
CREATE INDEX events_registration_mode_idx ON public.events USING btree (registration_mode);
CREATE INDEX events_registration_period_idx ON public.events USING btree (registration_starts_at, registration_ends_at);
CREATE INDEX events_settings_gin_idx ON public.events USING gin (settings);
CREATE INDEX events_slug_idx ON public.events USING btree (slug);
CREATE INDEX events_starts_at_idx ON public.events USING btree (starts_at);
CREATE INDEX events_status_idx ON public.events USING btree (status);
CREATE INDEX events_type_idx ON public.events USING btree (event_type);
CREATE INDEX events_visibility_idx ON public.events USING btree (visibility);
CREATE INDEX financial_cashboxes_church_id_idx ON public.financial_cashboxes USING btree (church_id);
CREATE INDEX financial_cashboxes_code_idx ON public.financial_cashboxes USING btree (code);
CREATE UNIQUE INDEX financial_cashboxes_code_unique_idx ON public.financial_cashboxes USING btree (church_id, lower(code)) WHERE ((code IS NOT NULL) AND (code <> ''::text) AND (deleted_at IS NULL));
CREATE INDEX financial_cashboxes_congregation_id_idx ON public.financial_cashboxes USING btree (congregation_id);
CREATE INDEX financial_cashboxes_created_by_idx ON public.financial_cashboxes USING btree (created_by);
CREATE INDEX financial_cashboxes_deleted_at_idx ON public.financial_cashboxes USING btree (deleted_at);
CREATE INDEX financial_cashboxes_is_default_idx ON public.financial_cashboxes USING btree (is_default);
CREATE INDEX financial_cashboxes_name_idx ON public.financial_cashboxes USING btree (name);
CREATE INDEX financial_cashboxes_sort_order_idx ON public.financial_cashboxes USING btree (sort_order);
CREATE INDEX financial_cashboxes_status_idx ON public.financial_cashboxes USING btree (status);
CREATE INDEX financial_cashboxes_type_idx ON public.financial_cashboxes USING btree (cashbox_type);
CREATE UNIQUE INDEX financial_cashboxes_unique_idx ON public.financial_cashboxes USING btree (church_id, COALESCE(congregation_id, '00000000-0000-0000-0000-000000000000'::uuid), lower(name)) WHERE (deleted_at IS NULL);
CREATE INDEX financial_categories_church_id_idx ON public.financial_categories USING btree (church_id);
CREATE INDEX financial_categories_code_idx ON public.financial_categories USING btree (code);
CREATE UNIQUE INDEX financial_categories_code_unique_idx ON public.financial_categories USING btree (church_id, lower(code)) WHERE ((code IS NOT NULL) AND (code <> ''::text) AND (deleted_at IS NULL));
CREATE INDEX financial_categories_created_by_idx ON public.financial_categories USING btree (created_by);
CREATE INDEX financial_categories_deleted_at_idx ON public.financial_categories USING btree (deleted_at);
CREATE INDEX financial_categories_department_id_idx ON public.financial_categories USING btree (department_id);
CREATE INDEX financial_categories_generate_receipt_idx ON public.financial_categories USING btree (generate_receipt);
CREATE INDEX financial_categories_group_idx ON public.financial_categories USING btree (category_group);
CREATE INDEX financial_categories_is_offering_idx ON public.financial_categories USING btree (is_offering);
CREATE INDEX financial_categories_is_report_delivery_item_idx ON public.financial_categories USING btree (is_report_delivery_item);
CREATE INDEX financial_categories_is_tithe_idx ON public.financial_categories USING btree (is_tithe);
CREATE INDEX financial_categories_name_idx ON public.financial_categories USING btree (name);
CREATE INDEX financial_categories_parent_id_idx ON public.financial_categories USING btree (parent_id);
CREATE INDEX financial_categories_requires_member_idx ON public.financial_categories USING btree (requires_member);
CREATE INDEX financial_categories_sort_order_idx ON public.financial_categories USING btree (sort_order);
CREATE INDEX financial_categories_status_idx ON public.financial_categories USING btree (status);
CREATE INDEX financial_categories_type_idx ON public.financial_categories USING btree (category_type);
CREATE UNIQUE INDEX financial_categories_unique_idx ON public.financial_categories USING btree (church_id, lower(name)) WHERE (deleted_at IS NULL);
CREATE INDEX financial_departments_church_id_idx ON public.financial_departments USING btree (church_id);
CREATE INDEX financial_departments_code_idx ON public.financial_departments USING btree (code);
CREATE UNIQUE INDEX financial_departments_code_unique_idx ON public.financial_departments USING btree (church_id, lower(code)) WHERE ((code IS NOT NULL) AND (code <> ''::text) AND (deleted_at IS NULL));
CREATE INDEX financial_departments_congregation_id_idx ON public.financial_departments USING btree (congregation_id);
CREATE INDEX financial_departments_created_by_idx ON public.financial_departments USING btree (created_by);
CREATE INDEX financial_departments_deleted_at_idx ON public.financial_departments USING btree (deleted_at);
CREATE INDEX financial_departments_name_idx ON public.financial_departments USING btree (name);
CREATE INDEX financial_departments_sort_order_idx ON public.financial_departments USING btree (sort_order);
CREATE INDEX financial_departments_status_idx ON public.financial_departments USING btree (status);
CREATE INDEX financial_departments_type_idx ON public.financial_departments USING btree (department_type);
CREATE UNIQUE INDEX financial_departments_unique_idx ON public.financial_departments USING btree (church_id, COALESCE(congregation_id, '00000000-0000-0000-0000-000000000000'::uuid), lower(name)) WHERE (deleted_at IS NULL);
CREATE INDEX financial_documents_accounts_payable_id_idx ON public.financial_documents USING btree (accounts_payable_id);
CREATE INDEX financial_documents_church_id_idx ON public.financial_documents USING btree (church_id);
CREATE INDEX financial_documents_congregation_id_idx ON public.financial_documents USING btree (congregation_id);
CREATE INDEX financial_documents_deleted_at_idx ON public.financial_documents USING btree (deleted_at);
CREATE INDEX financial_documents_is_sensitive_idx ON public.financial_documents USING btree (is_sensitive);
CREATE INDEX financial_documents_metadata_gin_idx ON public.financial_documents USING gin (metadata);
CREATE INDEX financial_documents_receipt_id_idx ON public.financial_documents USING btree (financial_receipt_id);
CREATE INDEX financial_documents_status_idx ON public.financial_documents USING btree (status);
CREATE UNIQUE INDEX financial_documents_storage_path_unique_idx ON public.financial_documents USING btree (storage_bucket, storage_path) WHERE (deleted_at IS NULL);
CREATE INDEX financial_documents_transaction_id_idx ON public.financial_documents USING btree (financial_transaction_id);
CREATE INDEX financial_documents_type_idx ON public.financial_documents USING btree (document_type);
CREATE INDEX financial_documents_uploaded_at_idx ON public.financial_documents USING btree (uploaded_at);
CREATE INDEX financial_documents_uploaded_by_idx ON public.financial_documents USING btree (uploaded_by);
CREATE INDEX financial_payment_methods_church_id_idx ON public.financial_payment_methods USING btree (church_id);
CREATE INDEX financial_payment_methods_code_idx ON public.financial_payment_methods USING btree (code);
CREATE UNIQUE INDEX financial_payment_methods_code_unique_idx ON public.financial_payment_methods USING btree (church_id, lower(code)) WHERE ((code IS NOT NULL) AND (code <> ''::text) AND (deleted_at IS NULL));
CREATE INDEX financial_payment_methods_created_by_idx ON public.financial_payment_methods USING btree (created_by);
CREATE INDEX financial_payment_methods_deleted_at_idx ON public.financial_payment_methods USING btree (deleted_at);
CREATE INDEX financial_payment_methods_is_default_idx ON public.financial_payment_methods USING btree (is_default);
CREATE INDEX financial_payment_methods_name_idx ON public.financial_payment_methods USING btree (name);
CREATE INDEX financial_payment_methods_sort_order_idx ON public.financial_payment_methods USING btree (sort_order);
CREATE INDEX financial_payment_methods_status_idx ON public.financial_payment_methods USING btree (status);
CREATE INDEX financial_payment_methods_type_idx ON public.financial_payment_methods USING btree (method_type);
CREATE UNIQUE INDEX financial_payment_methods_unique_idx ON public.financial_payment_methods USING btree (church_id, lower(name)) WHERE (deleted_at IS NULL);
CREATE INDEX financial_receipts_church_id_idx ON public.financial_receipts USING btree (church_id);
CREATE INDEX financial_receipts_congregation_id_idx ON public.financial_receipts USING btree (congregation_id);
CREATE INDEX financial_receipts_created_by_idx ON public.financial_receipts USING btree (created_by);
CREATE INDEX financial_receipts_deleted_at_idx ON public.financial_receipts USING btree (deleted_at);
CREATE INDEX financial_receipts_issued_at_idx ON public.financial_receipts USING btree (issued_at);
CREATE INDEX financial_receipts_metadata_gin_idx ON public.financial_receipts USING gin (metadata);
CREATE INDEX financial_receipts_number_idx ON public.financial_receipts USING btree (receipt_number);
CREATE UNIQUE INDEX financial_receipts_number_unique_idx ON public.financial_receipts USING btree (church_id, receipt_number) WHERE (deleted_at IS NULL);
CREATE INDEX financial_receipts_person_name_idx ON public.financial_receipts USING btree (person_name);
CREATE INDEX financial_receipts_printed_at_idx ON public.financial_receipts USING btree (printed_at);
CREATE INDEX financial_receipts_printed_by_idx ON public.financial_receipts USING btree (printed_by);
CREATE INDEX financial_receipts_status_idx ON public.financial_receipts USING btree (receipt_status);
CREATE INDEX financial_receipts_transaction_id_idx ON public.financial_receipts USING btree (financial_transaction_id);
CREATE INDEX financial_receipts_type_idx ON public.financial_receipts USING btree (receipt_type);
CREATE INDEX financial_transactions_cashbox_id_idx ON public.financial_transactions USING btree (cashbox_id);
CREATE INDEX financial_transactions_category_id_idx ON public.financial_transactions USING btree (category_id);
CREATE INDEX financial_transactions_church_id_idx ON public.financial_transactions USING btree (church_id);
CREATE INDEX financial_transactions_congregation_id_idx ON public.financial_transactions USING btree (congregation_id);
CREATE INDEX financial_transactions_created_by_idx ON public.financial_transactions USING btree (created_by);
CREATE INDEX financial_transactions_deleted_at_idx ON public.financial_transactions USING btree (deleted_at);
CREATE INDEX financial_transactions_department_id_idx ON public.financial_transactions USING btree (department_id);
CREATE INDEX financial_transactions_document_number_idx ON public.financial_transactions USING btree (document_number);
CREATE INDEX financial_transactions_generate_receipt_idx ON public.financial_transactions USING btree (generate_receipt);
CREATE INDEX financial_transactions_has_attachment_idx ON public.financial_transactions USING btree (has_attachment);
CREATE INDEX financial_transactions_is_unregistered_person_idx ON public.financial_transactions USING btree (is_unregistered_person);
CREATE INDEX financial_transactions_member_id_idx ON public.financial_transactions USING btree (member_id);
CREATE INDEX financial_transactions_member_timeline_active_idx ON public.financial_transactions USING btree (church_id, member_id, transaction_date DESC, id DESC) WHERE ((deleted_at IS NULL) AND (member_id IS NOT NULL));
CREATE INDEX financial_transactions_metadata_gin_idx ON public.financial_transactions USING gin (metadata);
CREATE INDEX financial_transactions_number_idx ON public.financial_transactions USING btree (transaction_number);
CREATE UNIQUE INDEX financial_transactions_number_unique_idx ON public.financial_transactions USING btree (church_id, transaction_number) WHERE ((transaction_number IS NOT NULL) AND (transaction_number <> ''::text) AND (deleted_at IS NULL));
CREATE INDEX financial_transactions_payment_method_id_idx ON public.financial_transactions USING btree (payment_method_id);
CREATE INDEX financial_transactions_person_name_idx ON public.financial_transactions USING btree (person_name);
CREATE INDEX financial_transactions_reference_month_year_idx ON public.financial_transactions USING btree (reference_year, reference_month);
CREATE INDEX financial_transactions_source_idx ON public.financial_transactions USING btree (source_type);
CREATE INDEX financial_transactions_status_idx ON public.financial_transactions USING btree (status);
CREATE INDEX financial_transactions_transaction_date_idx ON public.financial_transactions USING btree (transaction_date);
CREATE INDEX financial_transactions_type_idx ON public.financial_transactions USING btree (transaction_type);
CREATE INDEX member_documents_church_id_idx ON public.member_documents USING btree (church_id);
CREATE INDEX member_documents_deleted_at_idx ON public.member_documents USING btree (deleted_at);
CREATE INDEX member_documents_is_sensitive_idx ON public.member_documents USING btree (is_sensitive);
CREATE INDEX member_documents_member_active_idx ON public.member_documents USING btree (church_id, member_id, uploaded_at DESC, id DESC) WHERE (deleted_at IS NULL);
CREATE INDEX member_documents_member_id_idx ON public.member_documents USING btree (member_id);
CREATE UNIQUE INDEX member_documents_storage_path_unique_idx ON public.member_documents USING btree (storage_bucket, storage_path) WHERE (deleted_at IS NULL);
CREATE INDEX member_documents_type_idx ON public.member_documents USING btree (document_type);
CREATE INDEX member_documents_uploaded_at_idx ON public.member_documents USING btree (uploaded_at);
CREATE INDEX member_history_church_id_idx ON public.member_history USING btree (church_id);
CREATE INDEX member_history_congregation_id_idx ON public.member_history USING btree (congregation_id);
CREATE INDEX member_history_deleted_at_idx ON public.member_history USING btree (deleted_at);
CREATE INDEX member_history_event_date_idx ON public.member_history USING btree (event_date);
CREATE INDEX member_history_is_sensitive_idx ON public.member_history USING btree (is_sensitive);
CREATE INDEX member_history_member_id_idx ON public.member_history USING btree (member_id);
CREATE INDEX member_history_timeline_active_idx ON public.member_history USING btree (church_id, member_id, event_date DESC, id DESC) WHERE (deleted_at IS NULL);
CREATE INDEX member_history_type_idx ON public.member_history USING btree (history_type);
CREATE UNIQUE INDEX member_ministries_active_unique_idx ON public.member_ministries USING btree (member_id, ministry_id) WHERE ((deleted_at IS NULL) AND (status = 'ACTIVE'::text));
CREATE INDEX member_ministries_church_id_idx ON public.member_ministries USING btree (church_id);
CREATE INDEX member_ministries_congregation_id_idx ON public.member_ministries USING btree (congregation_id);
CREATE INDEX member_ministries_deleted_at_idx ON public.member_ministries USING btree (deleted_at);
CREATE INDEX member_ministries_is_leader_idx ON public.member_ministries USING btree (is_leader);
CREATE INDEX member_ministries_is_primary_idx ON public.member_ministries USING btree (is_primary);
CREATE INDEX member_ministries_member_id_idx ON public.member_ministries USING btree (member_id);
CREATE INDEX member_ministries_ministry_id_idx ON public.member_ministries USING btree (ministry_id);
CREATE UNIQUE INDEX member_ministries_one_primary_active_idx ON public.member_ministries USING btree (member_id) WHERE ((deleted_at IS NULL) AND (status = 'ACTIVE'::text) AND (is_primary = true));
CREATE INDEX member_ministries_status_idx ON public.member_ministries USING btree (status);
CREATE INDEX member_pastoral_notes_church_member_active_idx ON public.member_pastoral_notes USING btree (church_id, member_id) WHERE (deleted_at IS NULL);
CREATE INDEX member_pastoral_notes_created_by_idx ON public.member_pastoral_notes USING btree (created_by);
CREATE INDEX member_pastoral_notes_updated_by_idx ON public.member_pastoral_notes USING btree (updated_by);
CREATE UNIQUE INDEX member_roles_active_unique_idx ON public.member_roles USING btree (member_id, role_id) WHERE ((deleted_at IS NULL) AND (status = 'ACTIVE'::text));
CREATE INDEX member_roles_church_congregation_idx ON public.member_roles USING btree (church_id, congregation_id);
CREATE INDEX member_roles_church_id_idx ON public.member_roles USING btree (church_id);
CREATE INDEX member_roles_congregation_id_idx ON public.member_roles USING btree (congregation_id);
CREATE INDEX member_roles_deleted_at_idx ON public.member_roles USING btree (deleted_at);
CREATE INDEX member_roles_is_primary_idx ON public.member_roles USING btree (is_primary);
CREATE INDEX member_roles_member_active_idx ON public.member_roles USING btree (church_id, member_id, status, is_primary) WHERE (deleted_at IS NULL);
CREATE INDEX member_roles_member_id_idx ON public.member_roles USING btree (member_id);
CREATE UNIQUE INDEX member_roles_one_active_per_member_idx ON public.member_roles USING btree (church_id, member_id) WHERE ((status = 'ACTIVE'::text) AND (deleted_at IS NULL));
CREATE UNIQUE INDEX member_roles_one_primary_active_idx ON public.member_roles USING btree (member_id) WHERE ((deleted_at IS NULL) AND (status = 'ACTIVE'::text) AND (is_primary = true));
CREATE INDEX member_roles_role_active_idx ON public.member_roles USING btree (church_id, role_id, status, member_id) WHERE (deleted_at IS NULL);
CREATE INDEX member_roles_role_id_idx ON public.member_roles USING btree (role_id);
CREATE INDEX member_roles_status_idx ON public.member_roles USING btree (status);
CREATE UNIQUE INDEX member_sensitive_identity_church_cpf_idx ON public.member_sensitive_identity USING btree (church_id, cpf) WHERE ((cpf IS NOT NULL) AND (cpf <> ''::text) AND (deleted_at IS NULL));
CREATE INDEX member_sensitive_identity_church_member_active_idx ON public.member_sensitive_identity USING btree (church_id, member_id) WHERE (deleted_at IS NULL);
CREATE INDEX member_sensitive_identity_created_by_idx ON public.member_sensitive_identity USING btree (created_by);
CREATE INDEX member_sensitive_identity_updated_by_idx ON public.member_sensitive_identity USING btree (updated_by);
CREATE INDEX members_church_id_idx ON public.members USING btree (church_id);
CREATE UNIQUE INDEX members_church_member_code_unique_idx ON public.members USING btree (church_id, member_code) WHERE ((member_code IS NOT NULL) AND (member_code <> ''::text));
CREATE INDEX members_city_state_idx ON public.members USING btree (city, state);
CREATE INDEX members_congregation_id_idx ON public.members USING btree (congregation_id);
CREATE INDEX members_deleted_at_idx ON public.members USING btree (deleted_at);
CREATE INDEX members_full_name_idx ON public.members USING btree (full_name);
CREATE INDEX members_full_name_trgm_active_idx ON public.members USING gin (full_name gin_trgm_ops) WHERE (deleted_at IS NULL);
CREATE INDEX members_list_congregation_status_active_idx ON public.members USING btree (church_id, congregation_id, member_status, full_name, id) WHERE (deleted_at IS NULL);
CREATE INDEX members_list_name_active_idx ON public.members USING btree (church_id, full_name, id) WHERE (deleted_at IS NULL);
CREATE INDEX members_list_status_active_idx ON public.members USING btree (church_id, member_status, full_name, id) WHERE (deleted_at IS NULL);
CREATE INDEX members_list_type_active_idx ON public.members USING btree (church_id, member_type, full_name, id) WHERE (deleted_at IS NULL);
CREATE INDEX members_member_status_idx ON public.members USING btree (member_status);
CREATE INDEX members_member_type_idx ON public.members USING btree (member_type);
CREATE INDEX ministries_category_idx ON public.ministries USING btree (category);
CREATE UNIQUE INDEX ministries_church_congregation_name_unique_idx ON public.ministries USING btree (church_id, COALESCE(congregation_id, '00000000-0000-0000-0000-000000000000'::uuid), lower(name)) WHERE (deleted_at IS NULL);
CREATE INDEX ministries_church_id_idx ON public.ministries USING btree (church_id);
CREATE INDEX ministries_congregation_id_idx ON public.ministries USING btree (congregation_id);
CREATE INDEX ministries_deleted_at_idx ON public.ministries USING btree (deleted_at);
CREATE INDEX ministries_is_global_idx ON public.ministries USING btree (is_global);
CREATE INDEX ministries_leader_member_id_idx ON public.ministries USING btree (leader_member_id);
CREATE INDEX ministries_status_idx ON public.ministries USING btree (status);
CREATE INDEX permissions_action_idx ON public.permissions USING btree (action);
CREATE INDEX permissions_deleted_at_idx ON public.permissions USING btree (deleted_at);
CREATE INDEX permissions_is_sensitive_idx ON public.permissions USING btree (is_sensitive);
CREATE INDEX permissions_key_idx ON public.permissions USING btree (key);
CREATE UNIQUE INDEX permissions_key_unique_idx ON public.permissions USING btree (lower(key)) WHERE (deleted_at IS NULL);
CREATE INDEX permissions_module_idx ON public.permissions USING btree (module);
CREATE INDEX permissions_status_idx ON public.permissions USING btree (status);
CREATE INDEX profiles_deleted_at_idx ON public.profiles USING btree (deleted_at);
CREATE INDEX profiles_email_idx ON public.profiles USING btree (email);
CREATE UNIQUE INDEX profiles_email_unique_idx ON public.profiles USING btree (lower(email)) WHERE ((email IS NOT NULL) AND (email <> ''::text) AND (deleted_at IS NULL));
CREATE INDEX profiles_is_platform_admin_idx ON public.profiles USING btree (is_platform_admin);
CREATE INDEX profiles_status_idx ON public.profiles USING btree (status);
CREATE INDEX regions_church_id_idx ON public.regions USING btree (church_id);
CREATE UNIQUE INDEX regions_church_name_active_unique_idx ON public.regions USING btree (church_id, lower(btrim(name))) WHERE (deleted_at IS NULL);
CREATE INDEX regions_church_status_order_active_idx ON public.regions USING btree (church_id, status, display_order, name, id) WHERE (deleted_at IS NULL);
CREATE INDEX regions_deleted_at_idx ON public.regions USING btree (deleted_at);
CREATE INDEX regions_status_idx ON public.regions USING btree (status);
CREATE INDEX report_deliveries_calculation_mode_idx ON public.report_deliveries USING btree (calculation_mode);
CREATE INDEX report_deliveries_church_id_idx ON public.report_deliveries USING btree (church_id);
CREATE INDEX report_deliveries_congregation_id_idx ON public.report_deliveries USING btree (congregation_id);
CREATE INDEX report_deliveries_created_by_idx ON public.report_deliveries USING btree (created_by);
CREATE INDEX report_deliveries_deleted_at_idx ON public.report_deliveries USING btree (deleted_at);
CREATE INDEX report_deliveries_delivered_at_idx ON public.report_deliveries USING btree (delivered_at);
CREATE INDEX report_deliveries_delivery_number_idx ON public.report_deliveries USING btree (delivery_number);
CREATE INDEX report_deliveries_finalized_at_idx ON public.report_deliveries USING btree (finalized_at);
CREATE INDEX report_deliveries_metadata_gin_idx ON public.report_deliveries USING gin (metadata);
CREATE UNIQUE INDEX report_deliveries_number_unique_idx ON public.report_deliveries USING btree (church_id, delivery_number) WHERE ((delivery_number IS NOT NULL) AND (delivery_number <> ''::text) AND (deleted_at IS NULL));
CREATE INDEX report_deliveries_period_idx ON public.report_deliveries USING btree (period_start, period_end);
CREATE INDEX report_deliveries_reference_month_year_idx ON public.report_deliveries USING btree (reference_year, reference_month);
CREATE INDEX report_deliveries_reviewed_at_idx ON public.report_deliveries USING btree (reviewed_at);
CREATE INDEX report_deliveries_status_idx ON public.report_deliveries USING btree (status);
CREATE UNIQUE INDEX report_deliveries_unique_month_idx ON public.report_deliveries USING btree (church_id, congregation_id, reference_year, reference_month) WHERE ((deleted_at IS NULL) AND (status <> 'CANCELLED'::text));
CREATE INDEX report_delivery_items_calculation_base_idx ON public.report_delivery_items USING btree (calculation_base);
CREATE INDEX report_delivery_items_category_id_idx ON public.report_delivery_items USING btree (category_id);
CREATE INDEX report_delivery_items_central_transaction_id_idx ON public.report_delivery_items USING btree (central_transaction_id);
CREATE INDEX report_delivery_items_church_id_idx ON public.report_delivery_items USING btree (church_id);
CREATE INDEX report_delivery_items_congregation_id_idx ON public.report_delivery_items USING btree (congregation_id);
CREATE INDEX report_delivery_items_congregation_transaction_id_idx ON public.report_delivery_items USING btree (congregation_transaction_id);
CREATE INDEX report_delivery_items_created_by_idx ON public.report_delivery_items USING btree (created_by);
CREATE INDEX report_delivery_items_deleted_at_idx ON public.report_delivery_items USING btree (deleted_at);
CREATE INDEX report_delivery_items_delivery_id_idx ON public.report_delivery_items USING btree (report_delivery_id);
CREATE INDEX report_delivery_items_metadata_gin_idx ON public.report_delivery_items USING gin (metadata);
CREATE INDEX report_delivery_items_rule_code_idx ON public.report_delivery_items USING btree (rule_code);
CREATE INDEX report_delivery_items_rule_id_idx ON public.report_delivery_items USING btree (report_delivery_rule_id);
CREATE INDEX report_delivery_items_rule_nature_idx ON public.report_delivery_items USING btree (rule_nature);
CREATE INDEX report_delivery_items_rule_type_idx ON public.report_delivery_items USING btree (rule_type);
CREATE INDEX report_delivery_items_sort_order_idx ON public.report_delivery_items USING btree (sort_order);
CREATE UNIQUE INDEX report_delivery_items_unique_idx ON public.report_delivery_items USING btree (report_delivery_id, lower(rule_name)) WHERE (deleted_at IS NULL);
CREATE INDEX report_delivery_rules_calculation_base_idx ON public.report_delivery_rules USING btree (calculation_base);
CREATE INDEX report_delivery_rules_category_id_idx ON public.report_delivery_rules USING btree (category_id);
CREATE INDEX report_delivery_rules_church_id_idx ON public.report_delivery_rules USING btree (church_id);
CREATE INDEX report_delivery_rules_code_idx ON public.report_delivery_rules USING btree (code);
CREATE UNIQUE INDEX report_delivery_rules_code_unique_idx ON public.report_delivery_rules USING btree (church_id, COALESCE(congregation_id, '00000000-0000-0000-0000-000000000000'::uuid), lower(code)) WHERE ((code IS NOT NULL) AND (code <> ''::text) AND (deleted_at IS NULL));
CREATE INDEX report_delivery_rules_congregation_id_idx ON public.report_delivery_rules USING btree (congregation_id);
CREATE INDEX report_delivery_rules_created_by_idx ON public.report_delivery_rules USING btree (created_by);
CREATE INDEX report_delivery_rules_deleted_at_idx ON public.report_delivery_rules USING btree (deleted_at);
CREATE INDEX report_delivery_rules_effective_dates_idx ON public.report_delivery_rules USING btree (effective_from, effective_until);
CREATE INDEX report_delivery_rules_metadata_gin_idx ON public.report_delivery_rules USING gin (metadata);
CREATE INDEX report_delivery_rules_name_idx ON public.report_delivery_rules USING btree (name);
CREATE INDEX report_delivery_rules_nature_idx ON public.report_delivery_rules USING btree (rule_nature);
CREATE INDEX report_delivery_rules_sort_order_idx ON public.report_delivery_rules USING btree (sort_order);
CREATE INDEX report_delivery_rules_status_idx ON public.report_delivery_rules USING btree (status);
CREATE INDEX report_delivery_rules_type_idx ON public.report_delivery_rules USING btree (rule_type);
CREATE UNIQUE INDEX report_delivery_rules_unique_idx ON public.report_delivery_rules USING btree (church_id, COALESCE(congregation_id, '00000000-0000-0000-0000-000000000000'::uuid), lower(name), effective_from) WHERE (deleted_at IS NULL);
CREATE INDEX role_permissions_deleted_at_idx ON public.role_permissions USING btree (deleted_at);
CREATE INDEX role_permissions_permission_id_idx ON public.role_permissions USING btree (permission_id);
CREATE INDEX role_permissions_role_idx ON public.role_permissions USING btree (role);
CREATE UNIQUE INDEX role_permissions_role_permission_unique_idx ON public.role_permissions USING btree (role, permission_id) WHERE (deleted_at IS NULL);
CREATE INDEX role_permissions_status_idx ON public.role_permissions USING btree (status);
CREATE INDEX roles_category_idx ON public.roles USING btree (category);
CREATE INDEX roles_church_id_idx ON public.roles USING btree (church_id);
CREATE UNIQUE INDEX roles_church_name_trimmed_active_unique_idx ON public.roles USING btree (church_id, lower(btrim(name))) WHERE (deleted_at IS NULL);
CREATE UNIQUE INDEX roles_church_name_unique_idx ON public.roles USING btree (church_id, lower(name)) WHERE (deleted_at IS NULL);
CREATE INDEX roles_church_status_order_active_idx ON public.roles USING btree (church_id, status, display_order, name, id) WHERE (deleted_at IS NULL);
CREATE INDEX roles_created_by_idx ON public.roles USING btree (created_by);
CREATE INDEX roles_deleted_at_idx ON public.roles USING btree (deleted_at);
CREATE INDEX roles_level_idx ON public.roles USING btree (level);
CREATE INDEX roles_status_idx ON public.roles USING btree (status);
CREATE INDEX roles_updated_by_idx ON public.roles USING btree (updated_by);
CREATE INDEX user_church_access_church_id_idx ON public.user_church_access USING btree (church_id);
CREATE INDEX user_church_access_congregation_id_idx ON public.user_church_access USING btree (congregation_id);
CREATE INDEX user_church_access_deleted_at_idx ON public.user_church_access USING btree (deleted_at);
CREATE INDEX user_church_access_ministry_id_idx ON public.user_church_access USING btree (ministry_id);
CREATE INDEX user_church_access_profile_id_idx ON public.user_church_access USING btree (profile_id);
CREATE INDEX user_church_access_region_id_idx ON public.user_church_access USING btree (region_id);
CREATE INDEX user_church_access_role_idx ON public.user_church_access USING btree (role);
CREATE INDEX user_church_access_scope_idx ON public.user_church_access USING btree (access_scope);
CREATE INDEX user_church_access_status_idx ON public.user_church_access USING btree (status);
CREATE UNIQUE INDEX user_church_access_unique_active_idx ON public.user_church_access USING btree (profile_id, church_id, access_scope, COALESCE(region_id, '00000000-0000-0000-0000-000000000000'::uuid), COALESCE(congregation_id, '00000000-0000-0000-0000-000000000000'::uuid), COALESCE(ministry_id, '00000000-0000-0000-0000-000000000000'::uuid)) WHERE ((deleted_at IS NULL) AND (status = 'ACTIVE'::text));
CREATE INDEX user_permission_overrides_access_idx ON public.user_permission_overrides USING btree (access_id) WHERE (deleted_at IS NULL);
CREATE UNIQUE INDEX user_permission_overrides_active_unique_idx ON public.user_permission_overrides USING btree (access_id, permission_id) WHERE (deleted_at IS NULL);

-- Source: remote migration 20260808000442_trial_clone_referenced_unique_indexes
CREATE UNIQUE INDEX congregations_church_id_id_unique_idx ON public.congregations USING btree (church_id, id);
CREATE UNIQUE INDEX members_church_id_id_unique_idx ON public.members USING btree (church_id, id);
CREATE UNIQUE INDEX roles_church_id_id_unique_idx ON public.roles USING btree (church_id, id);

-- Source: remote migration 20260808000501_trial_clone_public_constraints
alter table public.accounts_payable add constraint accounts_payable_amount_check CHECK (amount >= 0::numeric);
alter table public.accounts_payable add constraint accounts_payable_paid_check CHECK (status = 'PAID'::text AND paid_at IS NOT NULL OR status <> 'PAID'::text);
alter table public.accounts_payable add constraint accounts_payable_status_check CHECK (status = ANY (ARRAY['PENDING'::text, 'PAID'::text, 'OVERDUE'::text, 'CANCELLED'::text]));
alter table public.app_settings add constraint app_settings_max_upload_size_check CHECK (max_upload_size_mb >= 1 AND max_upload_size_mb <= 100);
alter table public.app_settings add constraint app_settings_member_code_next_number_check CHECK (member_code_next_number >= 1);
alter table public.app_settings add constraint app_settings_member_code_padding_check CHECK (member_code_padding >= 1 AND member_code_padding <= 10);
alter table public.app_settings add constraint app_settings_status_check CHECK (status = ANY (ARRAY['ACTIVE'::text, 'INACTIVE'::text]));
alter table public.audit_logs add constraint audit_logs_severity_check CHECK (severity = ANY (ARRAY['INFO'::text, 'WARNING'::text, 'CRITICAL'::text]));
alter table public.church_invitations add constraint church_invitations_access_scope_check CHECK (access_scope = ANY (ARRAY['CHURCH'::text, 'REGION'::text, 'CONGREGATION'::text, 'MINISTRY'::text]));
alter table public.church_invitations add constraint church_invitations_role_check CHECK (role = ANY (ARRAY['ADMIN'::text, 'SECRETARY'::text, 'TREASURER'::text, 'LEADER'::text, 'MINISTRY_LEADER'::text, 'VIEWER'::text]));
alter table public.church_invitations add constraint church_invitations_role_scope_check CHECK (role = 'ADMIN'::text AND access_scope = 'CHURCH'::text OR role = 'MINISTRY_LEADER'::text AND access_scope = 'MINISTRY'::text OR (role <> ALL (ARRAY['ADMIN'::text, 'MINISTRY_LEADER'::text])));
alter table public.church_invitations add constraint church_invitations_scope_target_check CHECK (access_scope = 'CHURCH'::text AND region_id IS NULL AND congregation_id IS NULL AND ministry_id IS NULL OR access_scope = 'REGION'::text AND region_id IS NOT NULL AND congregation_id IS NULL AND ministry_id IS NULL OR access_scope = 'CONGREGATION'::text AND region_id IS NULL AND congregation_id IS NOT NULL AND ministry_id IS NULL OR access_scope = 'MINISTRY'::text AND region_id IS NULL AND congregation_id IS NULL AND ministry_id IS NOT NULL);
alter table public.church_invitations add constraint church_invitations_status_check CHECK (status = ANY (ARRAY['PENDING'::text, 'ACCEPTED'::text, 'EXPIRED'::text, 'CANCELLED'::text]));
alter table public.churches add constraint churches_status_check CHECK (status = ANY (ARRAY['ACTIVE'::text, 'INACTIVE'::text, 'SUSPENDED'::text]));
alter table public.congregation_documents add constraint congregation_documents_bucket_check CHECK (storage_bucket = 'congregation-documents'::text);
alter table public.congregation_documents add constraint congregation_documents_category_check CHECK (category = ANY (ARRAY['WATER_BILL'::text, 'ENERGY_BILL'::text, 'DEED'::text, 'CONTRACT'::text, 'TAX_DOCUMENT'::text, 'RECEIPT'::text, 'OTHER'::text]));
alter table public.congregation_documents add constraint congregation_documents_deleted_by_check CHECK (deleted_at IS NULL AND deleted_by IS NULL OR deleted_at IS NOT NULL AND deleted_by IS NOT NULL);
alter table public.congregation_documents add constraint congregation_documents_file_size_check CHECK (file_size > 0 AND file_size <= 10485760);
alter table public.congregation_documents add constraint congregation_documents_mime_type_check CHECK (mime_type = ANY (ARRAY['application/pdf'::text, 'image/jpeg'::text, 'image/png'::text, 'image/webp'::text, 'application/msword'::text, 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'::text]));
alter table public.congregation_documents add constraint congregation_documents_original_name_not_blank_check CHECK (btrim(original_file_name) <> ''::text);
alter table public.congregation_documents add constraint congregation_documents_title_not_blank_check CHECK (btrim(title) <> ''::text);
alter table public.congregation_documents add constraint congregation_documents_upload_status_check CHECK (upload_status = ANY (ARRAY['PENDING'::text, 'ACTIVE'::text]));
alter table public.congregations add constraint congregations_display_order_check CHECK (display_order >= 0);
alter table public.congregations add constraint congregations_name_not_blank_check CHECK (btrim(name) <> ''::text);
alter table public.congregations add constraint congregations_status_check CHECK (status = ANY (ARRAY['ACTIVE'::text, 'INACTIVE'::text]));
alter table public.event_checkins add constraint event_checkins_method_check CHECK (checkin_method = ANY (ARRAY['QR_CODE'::text, 'MANUAL'::text, 'SEARCH'::text, 'IMPORT'::text, 'OTHER'::text]));
alter table public.event_checkins add constraint event_checkins_status_check CHECK (status = ANY (ARRAY['PENDING'::text, 'CHECKED_IN'::text, 'CANCELLED'::text, 'INVALID'::text]));
alter table public.event_congregation_quotas add constraint event_congregation_quotas_total_check CHECK (quota_total >= 0);
alter table public.event_documents add constraint event_documents_file_size_check CHECK (file_size IS NULL OR file_size >= 0);
alter table public.event_documents add constraint event_documents_status_check CHECK (status = ANY (ARRAY['ACTIVE'::text, 'INACTIVE'::text, 'ARCHIVED'::text]));
alter table public.event_documents add constraint event_documents_type_check CHECK (document_type = ANY (ARRAY['BANNER'::text, 'PAYMENT_RECEIPT'::text, 'REGISTRATION_RECEIPT'::text, 'GROUP_LIST'::text, 'AUTHORIZATION'::text, 'SPREADSHEET'::text, 'CONTRACT'::text, 'REPORT'::text, 'ADMINISTRATIVE'::text, 'OTHER'::text]));
alter table public.event_groups add constraint event_groups_counts_check CHECK (total_registrations >= 0 AND male_count >= 0 AND female_count >= 0 AND total_registrations >= (male_count + female_count));
alter table public.event_groups add constraint event_groups_status_check CHECK (status = ANY (ARRAY['PENDING'::text, 'CONFIRMED'::text, 'PARTIALLY_PAID'::text, 'PAID'::text, 'CANCELLED'::text]));
alter table public.event_items add constraint event_items_cost_price_check CHECK (cost_price IS NULL OR cost_price >= 0::numeric);
alter table public.event_items add constraint event_items_price_check CHECK (price >= 0::numeric);
alter table public.event_items add constraint event_items_quantity_check CHECK (min_quantity >= 0 AND (max_quantity IS NULL OR max_quantity >= min_quantity) AND (available_quantity IS NULL OR available_quantity >= 0));
alter table public.event_items add constraint event_items_type_check CHECK (item_type = ANY (ARRAY['REGISTRATION'::text, 'SHIRT'::text, 'FOOD'::text, 'LODGING'::text, 'TRANSPORT'::text, 'KIT'::text, 'DONATION'::text, 'OTHER'::text]));
alter table public.event_payments add constraint event_payments_amount_check CHECK (amount >= 0::numeric);
alter table public.event_payments add constraint event_payments_installments_check CHECK (installment_number >= 1 AND installments_total >= 1 AND installment_number <= installments_total);
alter table public.event_payments add constraint event_payments_method_check CHECK (payment_method = ANY (ARRAY['PIX'::text, 'CASH'::text, 'CREDIT_CARD'::text, 'DEBIT_CARD'::text, 'BANK_TRANSFER'::text, 'BANK_SLIP'::text, 'OTHER'::text]));
alter table public.event_payments add constraint event_payments_owner_check CHECK (event_registration_id IS NOT NULL OR event_group_id IS NOT NULL);
alter table public.event_payments add constraint event_payments_status_check CHECK (payment_status = ANY (ARRAY['PENDING'::text, 'CONFIRMED'::text, 'CANCELLED'::text, 'REFUNDED'::text, 'FAILED'::text]));
alter table public.event_registration_items add constraint event_registration_items_owner_check CHECK (event_registration_id IS NOT NULL OR event_group_id IS NOT NULL);
alter table public.event_registration_items add constraint event_registration_items_price_check CHECK (unit_price >= 0::numeric);
alter table public.event_registration_items add constraint event_registration_items_quantity_check CHECK (quantity >= 1);
alter table public.event_registration_items add constraint event_registration_items_type_check CHECK (item_type = ANY (ARRAY['REGISTRATION'::text, 'SHIRT'::text, 'FOOD'::text, 'LODGING'::text, 'TRANSPORT'::text, 'KIT'::text, 'DONATION'::text, 'OTHER'::text]));
alter table public.event_registrations add constraint event_registrations_amounts_check CHECK (total_amount >= 0::numeric AND paid_amount >= 0::numeric AND paid_amount <= total_amount);
alter table public.event_registrations add constraint event_registrations_gender_check CHECK (participant_gender IS NULL OR (participant_gender = ANY (ARRAY['MALE'::text, 'FEMALE'::text])));
alter table public.event_registrations add constraint event_registrations_participant_type_check CHECK (participant_type = ANY (ARRAY['MEMBER'::text, 'CONGREGATED'::text, 'VISITOR'::text, 'EXTERNAL'::text, 'CHILD'::text, 'WORKER'::text, 'PASTOR'::text]));
alter table public.event_registrations add constraint event_registrations_payment_status_check CHECK (payment_status = ANY (ARRAY['NOT_REQUIRED'::text, 'PENDING'::text, 'PARTIAL'::text, 'PAID'::text, 'REFUNDED'::text, 'CANCELLED'::text]));
alter table public.event_registrations add constraint event_registrations_status_check CHECK (status = ANY (ARRAY['PENDING'::text, 'CONFIRMED'::text, 'WAITLIST'::text, 'CANCELLED'::text, 'CHECKED_IN'::text, 'NO_SHOW'::text]));
alter table public.events add constraint events_capacity_check CHECK (capacity IS NULL OR capacity >= 0);
alter table public.events add constraint events_dates_check CHECK (ends_at IS NULL OR ends_at >= starts_at);
alter table public.events add constraint events_max_installments_check CHECK (max_installments >= 1 AND max_installments <= 12);
alter table public.events add constraint events_quota_mode_check CHECK (quota_mode = ANY (ARRAY['GENERAL'::text, 'BY_CONGREGATION'::text, 'BY_CITY'::text, 'NONE'::text]));
alter table public.events add constraint events_registration_dates_check CHECK (registration_ends_at IS NULL OR registration_starts_at IS NULL OR registration_ends_at >= registration_starts_at);
alter table public.events add constraint events_registration_mode_check CHECK (registration_mode = ANY (ARRAY['INDIVIDUAL'::text, 'GROUP'::text, 'MIXED'::text]));
alter table public.events add constraint events_status_check CHECK (status = ANY (ARRAY['DRAFT'::text, 'PUBLISHED'::text, 'REGISTRATION_OPEN'::text, 'REGISTRATION_CLOSED'::text, 'IN_PROGRESS'::text, 'FINISHED'::text, 'CANCELLED'::text]));
alter table public.events add constraint events_type_check CHECK (event_type = ANY (ARRAY['CONFERENCE'::text, 'CAMP'::text, 'RETREAT'::text, 'COURSE'::text, 'MEETING'::text, 'SERVICE'::text, 'CONGRESS'::text, 'TRAINING'::text, 'DINNER'::text, 'SYMPOSIUM'::text, 'OTHER'::text]));
alter table public.events add constraint events_visibility_check CHECK (visibility = ANY (ARRAY['PUBLIC'::text, 'PRIVATE'::text, 'INTERNAL'::text]));
alter table public.financial_cashboxes add constraint financial_cashboxes_status_check CHECK (status = ANY (ARRAY['ACTIVE'::text, 'INACTIVE'::text]));
alter table public.financial_cashboxes add constraint financial_cashboxes_type_check CHECK (cashbox_type = ANY (ARRAY['CASH'::text, 'BANK_ACCOUNT'::text, 'PIX'::text, 'CARD'::text, 'EVENT'::text, 'OTHER'::text]));
alter table public.financial_categories add constraint financial_categories_group_check CHECK (category_group = ANY (ARRAY['TITHE'::text, 'OFFERING'::text, 'DONATION'::text, 'EVENT'::text, 'MISSION'::text, 'CONSTRUCTION'::text, 'ADMINISTRATIVE'::text, 'PASTORAL'::text, 'REPORT_DELIVERY'::text, 'TAX'::text, 'INSURANCE'::text, 'OTHER'::text]));
alter table public.financial_categories add constraint financial_categories_status_check CHECK (status = ANY (ARRAY['ACTIVE'::text, 'INACTIVE'::text]));
alter table public.financial_categories add constraint financial_categories_type_check CHECK (category_type = ANY (ARRAY['INCOME'::text, 'EXPENSE'::text, 'BOTH'::text]));
alter table public.financial_departments add constraint financial_departments_status_check CHECK (status = ANY (ARRAY['ACTIVE'::text, 'INACTIVE'::text]));
alter table public.financial_departments add constraint financial_departments_type_check CHECK (department_type = ANY (ARRAY['TREASURY'::text, 'CONSTRUCTION'::text, 'MISSIONS'::text, 'EVENTS'::text, 'MINISTRY'::text, 'SOCIAL'::text, 'ADMINISTRATIVE'::text, 'OTHER'::text]));
alter table public.financial_documents add constraint financial_documents_file_size_check CHECK (file_size IS NULL OR file_size >= 0);
alter table public.financial_documents add constraint financial_documents_relation_check CHECK (financial_transaction_id IS NOT NULL OR financial_receipt_id IS NOT NULL OR accounts_payable_id IS NOT NULL);
alter table public.financial_documents add constraint financial_documents_status_check CHECK (status = ANY (ARRAY['ACTIVE'::text, 'INACTIVE'::text, 'ARCHIVED'::text]));
alter table public.financial_documents add constraint financial_documents_type_check CHECK (document_type = ANY (ARRAY['PAYMENT_PROOF'::text, 'PIX_RECEIPT'::text, 'INVOICE'::text, 'BANK_SLIP'::text, 'CARD_RECEIPT'::text, 'MANUAL_RECEIPT'::text, 'THERMAL_RECEIPT'::text, 'REPORT'::text, 'CONTRACT'::text, 'OTHER'::text]));
alter table public.financial_payment_methods add constraint financial_payment_methods_status_check CHECK (status = ANY (ARRAY['ACTIVE'::text, 'INACTIVE'::text]));
alter table public.financial_payment_methods add constraint financial_payment_methods_type_check CHECK (method_type = ANY (ARRAY['CASH'::text, 'PIX'::text, 'DEBIT_CARD'::text, 'CREDIT_CARD'::text, 'BANK_TRANSFER'::text, 'BANK_SLIP'::text, 'CHECK'::text, 'OTHER'::text]));
alter table public.financial_receipts add constraint financial_receipts_amount_check CHECK (amount >= 0::numeric);
alter table public.financial_receipts add constraint financial_receipts_print_count_check CHECK (print_count >= 0);
alter table public.financial_receipts add constraint financial_receipts_status_check CHECK (receipt_status = ANY (ARRAY['ISSUED'::text, 'PRINTED'::text, 'CANCELLED'::text, 'REPRINTED'::text]));
alter table public.financial_receipts add constraint financial_receipts_type_check CHECK (receipt_type = ANY (ARRAY['TITHE'::text, 'OFFERING'::text, 'INCOME'::text, 'EXPENSE'::text, 'REPORT_DELIVERY'::text, 'OTHER'::text]));
alter table public.financial_transactions add constraint financial_transactions_amount_check CHECK (amount >= 0::numeric);
alter table public.financial_transactions add constraint financial_transactions_person_check CHECK (member_id IS NOT NULL AND is_unregistered_person = false OR member_id IS NULL AND is_unregistered_person = true AND person_name IS NOT NULL AND length(TRIM(BOTH FROM person_name)) > 0 OR member_id IS NULL AND is_unregistered_person = false);
alter table public.financial_transactions add constraint financial_transactions_reference_month_check CHECK (reference_month IS NULL OR reference_month >= 1 AND reference_month <= 12);
alter table public.financial_transactions add constraint financial_transactions_reference_year_check CHECK (reference_year IS NULL OR reference_year >= 2000);
alter table public.financial_transactions add constraint financial_transactions_source_check CHECK (source_type = ANY (ARRAY['MANUAL'::text, 'EVENT'::text, 'REPORT_DELIVERY'::text, 'ACCOUNTS_PAYABLE'::text, 'IMPORT'::text, 'OTHER'::text]));
alter table public.financial_transactions add constraint financial_transactions_status_check CHECK (status = ANY (ARRAY['DRAFT'::text, 'CONFIRMED'::text, 'CANCELLED'::text, 'REVERSED'::text]));
alter table public.financial_transactions add constraint financial_transactions_type_check CHECK (transaction_type = ANY (ARRAY['INCOME'::text, 'EXPENSE'::text]));
alter table public.member_documents add constraint member_documents_file_size_check CHECK (file_size IS NULL OR file_size >= 0);
alter table public.member_documents add constraint member_documents_type_check CHECK (document_type = ANY (ARRAY['PHOTO'::text, 'CPF'::text, 'RG'::text, 'BIRTH_CERTIFICATE'::text, 'MARRIAGE_CERTIFICATE'::text, 'TRANSFER_LETTER'::text, 'ADDRESS_PROOF'::text, 'BAPTISM_CERTIFICATE'::text, 'MEMBERSHIP_FORM'::text, 'OTHER'::text]));
alter table public.member_history add constraint member_history_type_check CHECK (history_type = ANY (ARRAY['MEMBER_CREATED'::text, 'MEMBER_RECEIVED'::text, 'CONGREGATION_CHANGE'::text, 'ROLE_ASSIGNED'::text, 'ROLE_CHANGED'::text, 'ROLE_ENDED'::text, 'STATUS_CHANGE'::text, 'MEMBER_INACTIVATED'::text, 'MEMBER_REACTIVATED'::text, 'MEMBER_TRANSFERRED'::text, 'MEMBER_DISCIPLINED'::text, 'MEMBER_DECEASED'::text, 'BAPTISM_UPDATED'::text, 'GENERAL_NOTE'::text, 'PASTORAL_NOTE'::text]));
alter table public.member_ministries add constraint member_ministries_dates_check CHECK (end_date IS NULL OR start_date IS NULL OR end_date >= start_date);
alter table public.member_ministries add constraint member_ministries_status_check CHECK (status = ANY (ARRAY['ACTIVE'::text, 'INACTIVE'::text, 'ENDED'::text, 'SUSPENDED'::text]));
alter table public.member_roles add constraint member_roles_dates_check CHECK (end_date IS NULL OR start_date IS NULL OR end_date >= start_date);
alter table public.member_roles add constraint member_roles_status_check CHECK (status = ANY (ARRAY['ACTIVE'::text, 'INACTIVE'::text, 'ENDED'::text, 'SUSPENDED'::text]));
alter table public.member_sensitive_identity add constraint member_sensitive_identity_cpf_valid_chk CHECK (cpf IS NULL OR is_valid_cpf(cpf));
alter table public.members add constraint members_gender_check CHECK (gender IS NULL OR (gender = ANY (ARRAY['MALE'::text, 'FEMALE'::text])));
alter table public.members add constraint members_marital_status_check CHECK (marital_status IS NULL OR (marital_status = ANY (ARRAY['SINGLE'::text, 'MARRIED'::text, 'DIVORCED'::text, 'WIDOWED'::text, 'STABLE_UNION'::text, 'OTHER'::text])));
alter table public.members add constraint members_received_by_check CHECK (received_by IS NULL OR (received_by = ANY (ARRAY['BAPTISM'::text, 'LETTER'::text, 'ACCLAMATION'::text, 'RECONCILIATION'::text, 'TRANSFER'::text, 'OTHER'::text])));
alter table public.members add constraint members_status_check CHECK (member_status = ANY (ARRAY['ACTIVE'::text, 'INACTIVE'::text, 'TRANSFERRED'::text, 'DISCIPLINED'::text, 'DECEASED'::text]));
alter table public.members add constraint members_type_check CHECK (member_type = ANY (ARRAY['MEMBER'::text, 'CONGREGATED'::text, 'VISITOR'::text, 'CHILD'::text]));
alter table public.ministries add constraint ministries_category_check CHECK (category = ANY (ARRAY['WORSHIP'::text, 'YOUTH'::text, 'WOMEN'::text, 'MEN'::text, 'CHILDREN'::text, 'EDUCATION'::text, 'MISSIONS'::text, 'EVANGELISM'::text, 'ADMINISTRATIVE'::text, 'FINANCIAL'::text, 'COMMUNICATION'::text, 'SOCIAL'::text, 'INTERCESSION'::text, 'RECEPTION'::text, 'OTHER'::text]));
alter table public.ministries add constraint ministries_status_check CHECK (status = ANY (ARRAY['ACTIVE'::text, 'INACTIVE'::text]));
alter table public.permissions add constraint permissions_status_check CHECK (status = ANY (ARRAY['ACTIVE'::text, 'INACTIVE'::text]));
alter table public.profiles add constraint profiles_status_check CHECK (status = ANY (ARRAY['ACTIVE'::text, 'INACTIVE'::text, 'BLOCKED'::text, 'PENDING'::text]));
alter table public.regions add constraint regions_display_order_check CHECK (display_order >= 0);
alter table public.regions add constraint regions_name_not_blank_check CHECK (btrim(name) <> ''::text);
alter table public.regions add constraint regions_status_check CHECK (status = ANY (ARRAY['ACTIVE'::text, 'INACTIVE'::text]));
alter table public.report_deliveries add constraint report_deliveries_amounts_check CHECK (total_income >= 0::numeric AND total_expense >= 0::numeric AND gross_amount >= 0::numeric AND total_central_income >= 0::numeric AND total_congregation_expense >= 0::numeric AND pastoral_prebend_amount >= 0::numeric AND pastoral_prebend_tithe_amount >= 0::numeric AND net_pastoral_prebend_amount >= 0::numeric AND net_congregation_amount >= 0::numeric);
alter table public.report_deliveries add constraint report_deliveries_calculation_mode_check CHECK (calculation_mode = ANY (ARRAY['AUTO'::text, 'MANUAL'::text, 'MIXED'::text]));
alter table public.report_deliveries add constraint report_deliveries_period_check CHECK (period_end >= period_start);
alter table public.report_deliveries add constraint report_deliveries_reference_month_check CHECK (reference_month >= 1 AND reference_month <= 12);
alter table public.report_deliveries add constraint report_deliveries_reference_year_check CHECK (reference_year >= 2000);
alter table public.report_deliveries add constraint report_deliveries_status_check CHECK (status = ANY (ARRAY['DRAFT'::text, 'CALCULATED'::text, 'DELIVERED'::text, 'REVIEWED'::text, 'FINALIZED'::text, 'CANCELLED'::text]));
alter table public.report_delivery_items add constraint report_delivery_items_amounts_check CHECK (base_amount >= 0::numeric AND calculated_amount >= 0::numeric AND (percentage_value IS NULL OR percentage_value >= 0::numeric AND percentage_value <= 100::numeric) AND (fixed_amount IS NULL OR fixed_amount >= 0::numeric) AND (manual_amount IS NULL OR manual_amount >= 0::numeric));
alter table public.report_delivery_items add constraint report_delivery_items_calculation_base_check CHECK (calculation_base = ANY (ARRAY['TOTAL_INCOME'::text, 'PASTORAL_PREBEND'::text, 'MANUAL'::text, 'NONE'::text]));
alter table public.report_delivery_items add constraint report_delivery_items_nature_check CHECK (rule_nature = ANY (ARRAY['TRANSFER'::text, 'PASTORAL_PAYMENT'::text, 'DEDUCTION'::text, 'CONTRIBUTION'::text, 'OTHER'::text]));
alter table public.report_delivery_items add constraint report_delivery_items_type_check CHECK (rule_type = ANY (ARRAY['PERCENTAGE'::text, 'FIXED_AMOUNT'::text, 'MANUAL_AMOUNT'::text]));
alter table public.report_delivery_items add constraint report_delivery_items_value_check CHECK (rule_type = 'PERCENTAGE'::text AND percentage_value IS NOT NULL OR rule_type = 'FIXED_AMOUNT'::text AND fixed_amount IS NOT NULL OR rule_type = 'MANUAL_AMOUNT'::text);
alter table public.report_delivery_rules add constraint report_delivery_rules_calculation_base_check CHECK (calculation_base = ANY (ARRAY['TOTAL_INCOME'::text, 'PASTORAL_PREBEND'::text, 'MANUAL'::text, 'NONE'::text]));
alter table public.report_delivery_rules add constraint report_delivery_rules_effective_dates_check CHECK (effective_until IS NULL OR effective_until >= effective_from);
alter table public.report_delivery_rules add constraint report_delivery_rules_fixed_amount_check CHECK (fixed_amount IS NULL OR fixed_amount >= 0::numeric);
alter table public.report_delivery_rules add constraint report_delivery_rules_nature_check CHECK (rule_nature = ANY (ARRAY['TRANSFER'::text, 'PASTORAL_PAYMENT'::text, 'DEDUCTION'::text, 'CONTRIBUTION'::text, 'OTHER'::text]));
alter table public.report_delivery_rules add constraint report_delivery_rules_percentage_check CHECK (percentage_value IS NULL OR percentage_value >= 0::numeric AND percentage_value <= 100::numeric);
alter table public.report_delivery_rules add constraint report_delivery_rules_status_check CHECK (status = ANY (ARRAY['ACTIVE'::text, 'INACTIVE'::text]));
alter table public.report_delivery_rules add constraint report_delivery_rules_type_check CHECK (rule_type = ANY (ARRAY['PERCENTAGE'::text, 'FIXED_AMOUNT'::text, 'MANUAL_AMOUNT'::text]));
alter table public.report_delivery_rules add constraint report_delivery_rules_value_check CHECK (rule_type = 'PERCENTAGE'::text AND percentage_value IS NOT NULL OR rule_type = 'FIXED_AMOUNT'::text AND fixed_amount IS NOT NULL OR rule_type = 'MANUAL_AMOUNT'::text);
alter table public.role_permissions add constraint role_permissions_role_check CHECK (role = ANY (ARRAY['ADMIN'::text, 'SECRETARY'::text, 'TREASURER'::text, 'LEADER'::text, 'MINISTRY_LEADER'::text, 'VIEWER'::text]));
alter table public.role_permissions add constraint role_permissions_status_check CHECK (status = ANY (ARRAY['ACTIVE'::text, 'INACTIVE'::text]));
alter table public.roles add constraint roles_category_check CHECK (category = ANY (ARRAY['ECCLESIASTICAL'::text, 'ADMINISTRATIVE'::text, 'MINISTRY'::text, 'SUPPORT'::text, 'OTHER'::text]));
alter table public.roles add constraint roles_display_order_check CHECK (display_order >= 0);
alter table public.roles add constraint roles_name_not_blank_check CHECK (btrim(name) <> ''::text);
alter table public.roles add constraint roles_status_check CHECK (status = ANY (ARRAY['ACTIVE'::text, 'INACTIVE'::text]));
alter table public.user_church_access add constraint user_church_access_role_check CHECK (role = ANY (ARRAY['ADMIN'::text, 'SECRETARY'::text, 'TREASURER'::text, 'LEADER'::text, 'MINISTRY_LEADER'::text, 'VIEWER'::text]));
alter table public.user_church_access add constraint user_church_access_scope_check CHECK (access_scope = ANY (ARRAY['CHURCH'::text, 'REGION'::text, 'CONGREGATION'::text, 'MINISTRY'::text]));
alter table public.user_church_access add constraint user_church_access_scope_target_check CHECK (access_scope = 'CHURCH'::text AND region_id IS NULL AND congregation_id IS NULL AND ministry_id IS NULL OR access_scope = 'REGION'::text AND region_id IS NOT NULL AND congregation_id IS NULL AND ministry_id IS NULL OR access_scope = 'CONGREGATION'::text AND congregation_id IS NOT NULL AND ministry_id IS NULL OR access_scope = 'MINISTRY'::text AND ministry_id IS NOT NULL);
alter table public.user_church_access add constraint user_church_access_status_check CHECK (status = ANY (ARRAY['ACTIVE'::text, 'INACTIVE'::text, 'PENDING'::text, 'BLOCKED'::text]));
alter table public.user_permission_overrides add constraint user_permission_overrides_effect_check CHECK (effect = ANY (ARRAY['ALLOW'::text, 'DENY'::text]));
alter table public.accounts_payable add constraint accounts_payable_cancelled_by_fkey FOREIGN KEY (cancelled_by) REFERENCES profiles(id) ON DELETE SET NULL;
alter table public.accounts_payable add constraint accounts_payable_cashbox_id_fkey FOREIGN KEY (cashbox_id) REFERENCES financial_cashboxes(id) ON DELETE SET NULL;
alter table public.accounts_payable add constraint accounts_payable_category_id_fkey FOREIGN KEY (category_id) REFERENCES financial_categories(id) ON DELETE SET NULL;
alter table public.accounts_payable add constraint accounts_payable_church_id_fkey FOREIGN KEY (church_id) REFERENCES churches(id) ON DELETE RESTRICT;
alter table public.accounts_payable add constraint accounts_payable_congregation_id_fkey FOREIGN KEY (congregation_id) REFERENCES congregations(id) ON DELETE SET NULL;
alter table public.accounts_payable add constraint accounts_payable_created_by_fkey FOREIGN KEY (created_by) REFERENCES profiles(id) ON DELETE SET NULL;
alter table public.accounts_payable add constraint accounts_payable_department_id_fkey FOREIGN KEY (department_id) REFERENCES financial_departments(id) ON DELETE SET NULL;
alter table public.accounts_payable add constraint accounts_payable_financial_transaction_id_fkey FOREIGN KEY (financial_transaction_id) REFERENCES financial_transactions(id) ON DELETE SET NULL;
alter table public.accounts_payable add constraint accounts_payable_paid_by_fkey FOREIGN KEY (paid_by) REFERENCES profiles(id) ON DELETE SET NULL;
alter table public.accounts_payable add constraint accounts_payable_payment_method_id_fkey FOREIGN KEY (payment_method_id) REFERENCES financial_payment_methods(id) ON DELETE SET NULL;
alter table public.app_settings add constraint app_settings_church_id_fkey FOREIGN KEY (church_id) REFERENCES churches(id) ON DELETE CASCADE;
alter table public.audit_logs add constraint audit_logs_actor_profile_id_fkey FOREIGN KEY (actor_profile_id) REFERENCES profiles(id) ON DELETE SET NULL;
alter table public.audit_logs add constraint audit_logs_church_id_fkey FOREIGN KEY (church_id) REFERENCES churches(id) ON DELETE SET NULL;
alter table public.church_invitations add constraint church_invitations_accepted_by_fkey FOREIGN KEY (accepted_by) REFERENCES profiles(id) ON DELETE SET NULL;
alter table public.church_invitations add constraint church_invitations_access_id_fkey FOREIGN KEY (access_id) REFERENCES user_church_access(id) ON DELETE SET NULL;
alter table public.church_invitations add constraint church_invitations_church_id_fkey FOREIGN KEY (church_id) REFERENCES churches(id) ON DELETE RESTRICT;
alter table public.church_invitations add constraint church_invitations_congregation_id_fkey FOREIGN KEY (congregation_id) REFERENCES congregations(id) ON DELETE SET NULL;
alter table public.church_invitations add constraint church_invitations_invited_by_fkey FOREIGN KEY (invited_by) REFERENCES profiles(id) ON DELETE RESTRICT;
alter table public.church_invitations add constraint church_invitations_ministry_id_fkey FOREIGN KEY (ministry_id) REFERENCES ministries(id) ON DELETE SET NULL;
alter table public.church_invitations add constraint church_invitations_region_id_fkey FOREIGN KEY (region_id) REFERENCES regions(id) ON DELETE SET NULL;
alter table public.congregation_documents add constraint congregation_documents_church_id_fkey FOREIGN KEY (church_id) REFERENCES churches(id) ON DELETE RESTRICT;
alter table public.congregation_documents add constraint congregation_documents_congregation_same_church_fk FOREIGN KEY (church_id, congregation_id) REFERENCES congregations(church_id, id) ON DELETE RESTRICT;
alter table public.congregation_documents add constraint congregation_documents_deleted_by_fkey FOREIGN KEY (deleted_by) REFERENCES profiles(id) ON DELETE RESTRICT;
alter table public.congregation_documents add constraint congregation_documents_uploaded_by_fkey FOREIGN KEY (uploaded_by) REFERENCES profiles(id) ON DELETE RESTRICT;
alter table public.congregations add constraint congregations_church_id_fkey FOREIGN KEY (church_id) REFERENCES churches(id) ON DELETE RESTRICT;
alter table public.congregations add constraint congregations_region_id_fkey FOREIGN KEY (region_id) REFERENCES regions(id) ON DELETE SET NULL;
alter table public.event_checkins add constraint event_checkins_checked_in_by_fkey FOREIGN KEY (checked_in_by) REFERENCES profiles(id) ON DELETE SET NULL;
alter table public.event_checkins add constraint event_checkins_church_id_fkey FOREIGN KEY (church_id) REFERENCES churches(id) ON DELETE RESTRICT;
alter table public.event_checkins add constraint event_checkins_event_group_id_fkey FOREIGN KEY (event_group_id) REFERENCES event_groups(id) ON DELETE SET NULL;
alter table public.event_checkins add constraint event_checkins_event_id_fkey FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE;
alter table public.event_checkins add constraint event_checkins_event_registration_id_fkey FOREIGN KEY (event_registration_id) REFERENCES event_registrations(id) ON DELETE CASCADE;
alter table public.event_congregation_quotas add constraint event_congregation_quotas_church_id_fkey FOREIGN KEY (church_id) REFERENCES churches(id) ON DELETE RESTRICT;
alter table public.event_congregation_quotas add constraint event_congregation_quotas_congregation_id_fkey FOREIGN KEY (congregation_id) REFERENCES congregations(id) ON DELETE CASCADE;
alter table public.event_congregation_quotas add constraint event_congregation_quotas_created_by_fkey FOREIGN KEY (created_by) REFERENCES profiles(id) ON DELETE SET NULL;
alter table public.event_congregation_quotas add constraint event_congregation_quotas_event_id_fkey FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE;
alter table public.event_documents add constraint event_documents_church_id_fkey FOREIGN KEY (church_id) REFERENCES churches(id) ON DELETE RESTRICT;
alter table public.event_documents add constraint event_documents_event_group_id_fkey FOREIGN KEY (event_group_id) REFERENCES event_groups(id) ON DELETE CASCADE;
alter table public.event_documents add constraint event_documents_event_id_fkey FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE;
alter table public.event_documents add constraint event_documents_event_payment_id_fkey FOREIGN KEY (event_payment_id) REFERENCES event_payments(id) ON DELETE CASCADE;
alter table public.event_documents add constraint event_documents_event_registration_id_fkey FOREIGN KEY (event_registration_id) REFERENCES event_registrations(id) ON DELETE CASCADE;
alter table public.event_documents add constraint event_documents_uploaded_by_fkey FOREIGN KEY (uploaded_by) REFERENCES profiles(id) ON DELETE SET NULL;
alter table public.event_groups add constraint event_groups_church_id_fkey FOREIGN KEY (church_id) REFERENCES churches(id) ON DELETE RESTRICT;
alter table public.event_groups add constraint event_groups_created_by_fkey FOREIGN KEY (created_by) REFERENCES profiles(id) ON DELETE SET NULL;
alter table public.event_groups add constraint event_groups_event_id_fkey FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE;
alter table public.event_items add constraint event_items_church_id_fkey FOREIGN KEY (church_id) REFERENCES churches(id) ON DELETE RESTRICT;
alter table public.event_items add constraint event_items_created_by_fkey FOREIGN KEY (created_by) REFERENCES profiles(id) ON DELETE SET NULL;
alter table public.event_items add constraint event_items_event_id_fkey FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE;
alter table public.event_payments add constraint event_payments_church_id_fkey FOREIGN KEY (church_id) REFERENCES churches(id) ON DELETE RESTRICT;
alter table public.event_payments add constraint event_payments_confirmed_by_fkey FOREIGN KEY (confirmed_by) REFERENCES profiles(id) ON DELETE SET NULL;
alter table public.event_payments add constraint event_payments_created_by_fkey FOREIGN KEY (created_by) REFERENCES profiles(id) ON DELETE SET NULL;
alter table public.event_payments add constraint event_payments_event_group_id_fkey FOREIGN KEY (event_group_id) REFERENCES event_groups(id) ON DELETE CASCADE;
alter table public.event_payments add constraint event_payments_event_id_fkey FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE;
alter table public.event_payments add constraint event_payments_event_registration_id_fkey FOREIGN KEY (event_registration_id) REFERENCES event_registrations(id) ON DELETE CASCADE;
alter table public.event_registration_items add constraint event_registration_items_church_id_fkey FOREIGN KEY (church_id) REFERENCES churches(id) ON DELETE RESTRICT;
alter table public.event_registration_items add constraint event_registration_items_created_by_fkey FOREIGN KEY (created_by) REFERENCES profiles(id) ON DELETE SET NULL;
alter table public.event_registration_items add constraint event_registration_items_event_group_id_fkey FOREIGN KEY (event_group_id) REFERENCES event_groups(id) ON DELETE CASCADE;
alter table public.event_registration_items add constraint event_registration_items_event_id_fkey FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE;
alter table public.event_registration_items add constraint event_registration_items_event_item_id_fkey FOREIGN KEY (event_item_id) REFERENCES event_items(id) ON DELETE RESTRICT;
alter table public.event_registration_items add constraint event_registration_items_event_registration_id_fkey FOREIGN KEY (event_registration_id) REFERENCES event_registrations(id) ON DELETE CASCADE;
alter table public.event_registrations add constraint event_registrations_church_id_fkey FOREIGN KEY (church_id) REFERENCES churches(id) ON DELETE RESTRICT;
alter table public.event_registrations add constraint event_registrations_congregation_id_fkey FOREIGN KEY (congregation_id) REFERENCES congregations(id) ON DELETE SET NULL;
alter table public.event_registrations add constraint event_registrations_created_by_fkey FOREIGN KEY (created_by) REFERENCES profiles(id) ON DELETE SET NULL;
alter table public.event_registrations add constraint event_registrations_event_group_id_fkey FOREIGN KEY (event_group_id) REFERENCES event_groups(id) ON DELETE SET NULL;
alter table public.event_registrations add constraint event_registrations_event_id_fkey FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE;
alter table public.event_registrations add constraint event_registrations_member_id_fkey FOREIGN KEY (member_id) REFERENCES members(id) ON DELETE SET NULL;
alter table public.events add constraint events_church_id_fkey FOREIGN KEY (church_id) REFERENCES churches(id) ON DELETE RESTRICT;
alter table public.events add constraint events_congregation_id_fkey FOREIGN KEY (congregation_id) REFERENCES congregations(id) ON DELETE SET NULL;
alter table public.events add constraint events_created_by_fkey FOREIGN KEY (created_by) REFERENCES profiles(id) ON DELETE SET NULL;
alter table public.events add constraint events_ministry_id_fkey FOREIGN KEY (ministry_id) REFERENCES ministries(id) ON DELETE SET NULL;
alter table public.financial_cashboxes add constraint financial_cashboxes_church_id_fkey FOREIGN KEY (church_id) REFERENCES churches(id) ON DELETE RESTRICT;
alter table public.financial_cashboxes add constraint financial_cashboxes_congregation_id_fkey FOREIGN KEY (congregation_id) REFERENCES congregations(id) ON DELETE SET NULL;
alter table public.financial_cashboxes add constraint financial_cashboxes_created_by_fkey FOREIGN KEY (created_by) REFERENCES profiles(id) ON DELETE SET NULL;
alter table public.financial_categories add constraint financial_categories_church_id_fkey FOREIGN KEY (church_id) REFERENCES churches(id) ON DELETE RESTRICT;
alter table public.financial_categories add constraint financial_categories_created_by_fkey FOREIGN KEY (created_by) REFERENCES profiles(id) ON DELETE SET NULL;
alter table public.financial_categories add constraint financial_categories_department_id_fkey FOREIGN KEY (department_id) REFERENCES financial_departments(id) ON DELETE SET NULL;
alter table public.financial_categories add constraint financial_categories_parent_id_fkey FOREIGN KEY (parent_id) REFERENCES financial_categories(id) ON DELETE SET NULL;
alter table public.financial_departments add constraint financial_departments_church_id_fkey FOREIGN KEY (church_id) REFERENCES churches(id) ON DELETE RESTRICT;
alter table public.financial_departments add constraint financial_departments_congregation_id_fkey FOREIGN KEY (congregation_id) REFERENCES congregations(id) ON DELETE SET NULL;
alter table public.financial_departments add constraint financial_departments_created_by_fkey FOREIGN KEY (created_by) REFERENCES profiles(id) ON DELETE SET NULL;
alter table public.financial_documents add constraint financial_documents_accounts_payable_id_fkey FOREIGN KEY (accounts_payable_id) REFERENCES accounts_payable(id) ON DELETE CASCADE;
alter table public.financial_documents add constraint financial_documents_church_id_fkey FOREIGN KEY (church_id) REFERENCES churches(id) ON DELETE RESTRICT;
alter table public.financial_documents add constraint financial_documents_congregation_id_fkey FOREIGN KEY (congregation_id) REFERENCES congregations(id) ON DELETE SET NULL;
alter table public.financial_documents add constraint financial_documents_financial_receipt_id_fkey FOREIGN KEY (financial_receipt_id) REFERENCES financial_receipts(id) ON DELETE CASCADE;
alter table public.financial_documents add constraint financial_documents_financial_transaction_id_fkey FOREIGN KEY (financial_transaction_id) REFERENCES financial_transactions(id) ON DELETE CASCADE;
alter table public.financial_documents add constraint financial_documents_uploaded_by_fkey FOREIGN KEY (uploaded_by) REFERENCES profiles(id) ON DELETE SET NULL;
alter table public.financial_payment_methods add constraint financial_payment_methods_church_id_fkey FOREIGN KEY (church_id) REFERENCES churches(id) ON DELETE RESTRICT;
alter table public.financial_payment_methods add constraint financial_payment_methods_created_by_fkey FOREIGN KEY (created_by) REFERENCES profiles(id) ON DELETE SET NULL;
alter table public.financial_receipts add constraint financial_receipts_cancelled_by_fkey FOREIGN KEY (cancelled_by) REFERENCES profiles(id) ON DELETE SET NULL;
alter table public.financial_receipts add constraint financial_receipts_church_id_fkey FOREIGN KEY (church_id) REFERENCES churches(id) ON DELETE RESTRICT;
alter table public.financial_receipts add constraint financial_receipts_congregation_id_fkey FOREIGN KEY (congregation_id) REFERENCES congregations(id) ON DELETE SET NULL;
alter table public.financial_receipts add constraint financial_receipts_created_by_fkey FOREIGN KEY (created_by) REFERENCES profiles(id) ON DELETE SET NULL;
alter table public.financial_receipts add constraint financial_receipts_financial_transaction_id_fkey FOREIGN KEY (financial_transaction_id) REFERENCES financial_transactions(id) ON DELETE CASCADE;
alter table public.financial_receipts add constraint financial_receipts_printed_by_fkey FOREIGN KEY (printed_by) REFERENCES profiles(id) ON DELETE SET NULL;
alter table public.financial_transactions add constraint financial_transactions_cancelled_by_fkey FOREIGN KEY (cancelled_by) REFERENCES profiles(id) ON DELETE SET NULL;
alter table public.financial_transactions add constraint financial_transactions_cashbox_id_fkey FOREIGN KEY (cashbox_id) REFERENCES financial_cashboxes(id) ON DELETE SET NULL;
alter table public.financial_transactions add constraint financial_transactions_category_id_fkey FOREIGN KEY (category_id) REFERENCES financial_categories(id) ON DELETE RESTRICT;
alter table public.financial_transactions add constraint financial_transactions_church_id_fkey FOREIGN KEY (church_id) REFERENCES churches(id) ON DELETE RESTRICT;
alter table public.financial_transactions add constraint financial_transactions_confirmed_by_fkey FOREIGN KEY (confirmed_by) REFERENCES profiles(id) ON DELETE SET NULL;
alter table public.financial_transactions add constraint financial_transactions_congregation_id_fkey FOREIGN KEY (congregation_id) REFERENCES congregations(id) ON DELETE SET NULL;
alter table public.financial_transactions add constraint financial_transactions_created_by_fkey FOREIGN KEY (created_by) REFERENCES profiles(id) ON DELETE SET NULL;
alter table public.financial_transactions add constraint financial_transactions_department_id_fkey FOREIGN KEY (department_id) REFERENCES financial_departments(id) ON DELETE SET NULL;
alter table public.financial_transactions add constraint financial_transactions_member_id_fkey FOREIGN KEY (member_id) REFERENCES members(id) ON DELETE SET NULL;
alter table public.financial_transactions add constraint financial_transactions_payment_method_id_fkey FOREIGN KEY (payment_method_id) REFERENCES financial_payment_methods(id) ON DELETE SET NULL;
alter table public.member_documents add constraint member_documents_church_id_fkey FOREIGN KEY (church_id) REFERENCES churches(id) ON DELETE RESTRICT;
alter table public.member_documents add constraint member_documents_member_id_fkey FOREIGN KEY (member_id) REFERENCES members(id) ON DELETE CASCADE;
alter table public.member_documents add constraint member_documents_member_same_church_fk FOREIGN KEY (church_id, member_id) REFERENCES members(church_id, id) ON DELETE CASCADE;
alter table public.member_history add constraint member_history_church_id_fkey FOREIGN KEY (church_id) REFERENCES churches(id) ON DELETE RESTRICT;
alter table public.member_history add constraint member_history_congregation_id_fkey FOREIGN KEY (congregation_id) REFERENCES congregations(id) ON DELETE SET NULL;
alter table public.member_history add constraint member_history_member_id_fkey FOREIGN KEY (member_id) REFERENCES members(id) ON DELETE CASCADE;
alter table public.member_history add constraint member_history_member_same_church_fk FOREIGN KEY (church_id, member_id) REFERENCES members(church_id, id) ON DELETE CASCADE;
alter table public.member_ministries add constraint member_ministries_church_id_fkey FOREIGN KEY (church_id) REFERENCES churches(id) ON DELETE RESTRICT;
alter table public.member_ministries add constraint member_ministries_congregation_id_fkey FOREIGN KEY (congregation_id) REFERENCES congregations(id) ON DELETE SET NULL;
alter table public.member_ministries add constraint member_ministries_member_id_fkey FOREIGN KEY (member_id) REFERENCES members(id) ON DELETE CASCADE;
alter table public.member_ministries add constraint member_ministries_ministry_id_fkey FOREIGN KEY (ministry_id) REFERENCES ministries(id) ON DELETE RESTRICT;
alter table public.member_pastoral_notes add constraint member_pastoral_notes_church_id_fkey FOREIGN KEY (church_id) REFERENCES churches(id) ON DELETE RESTRICT;
alter table public.member_pastoral_notes add constraint member_pastoral_notes_created_by_fkey FOREIGN KEY (created_by) REFERENCES profiles(id) ON DELETE SET NULL;
alter table public.member_pastoral_notes add constraint member_pastoral_notes_member_id_fkey FOREIGN KEY (member_id) REFERENCES members(id) ON DELETE CASCADE;
alter table public.member_pastoral_notes add constraint member_pastoral_notes_member_same_church_fk FOREIGN KEY (church_id, member_id) REFERENCES members(church_id, id) ON DELETE CASCADE;
alter table public.member_pastoral_notes add constraint member_pastoral_notes_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES profiles(id) ON DELETE SET NULL;
alter table public.member_roles add constraint member_roles_church_id_fkey FOREIGN KEY (church_id) REFERENCES churches(id) ON DELETE RESTRICT;
alter table public.member_roles add constraint member_roles_congregation_id_fkey FOREIGN KEY (congregation_id) REFERENCES congregations(id) ON DELETE SET NULL;
alter table public.member_roles add constraint member_roles_congregation_same_church_fk FOREIGN KEY (church_id, congregation_id) REFERENCES congregations(church_id, id) ON DELETE RESTRICT;
alter table public.member_roles add constraint member_roles_member_id_fkey FOREIGN KEY (member_id) REFERENCES members(id) ON DELETE CASCADE;
alter table public.member_roles add constraint member_roles_member_same_church_fk FOREIGN KEY (church_id, member_id) REFERENCES members(church_id, id) ON DELETE CASCADE;
alter table public.member_roles add constraint member_roles_role_id_fkey FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE RESTRICT;
alter table public.member_roles add constraint member_roles_role_same_church_fk FOREIGN KEY (church_id, role_id) REFERENCES roles(church_id, id) ON DELETE RESTRICT;
alter table public.member_sensitive_identity add constraint member_sensitive_identity_church_id_fkey FOREIGN KEY (church_id) REFERENCES churches(id) ON DELETE RESTRICT;
alter table public.member_sensitive_identity add constraint member_sensitive_identity_created_by_fkey FOREIGN KEY (created_by) REFERENCES profiles(id) ON DELETE SET NULL;
alter table public.member_sensitive_identity add constraint member_sensitive_identity_member_id_fkey FOREIGN KEY (member_id) REFERENCES members(id) ON DELETE CASCADE;
alter table public.member_sensitive_identity add constraint member_sensitive_identity_member_same_church_fk FOREIGN KEY (church_id, member_id) REFERENCES members(church_id, id) ON DELETE CASCADE;
alter table public.member_sensitive_identity add constraint member_sensitive_identity_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES profiles(id) ON DELETE SET NULL;
alter table public.members add constraint members_church_id_fkey FOREIGN KEY (church_id) REFERENCES churches(id) ON DELETE RESTRICT;
alter table public.members add constraint members_congregation_id_fkey FOREIGN KEY (congregation_id) REFERENCES congregations(id) ON DELETE RESTRICT;
alter table public.ministries add constraint ministries_church_id_fkey FOREIGN KEY (church_id) REFERENCES churches(id) ON DELETE RESTRICT;
alter table public.ministries add constraint ministries_congregation_id_fkey FOREIGN KEY (congregation_id) REFERENCES congregations(id) ON DELETE SET NULL;
alter table public.ministries add constraint ministries_leader_member_id_fkey FOREIGN KEY (leader_member_id) REFERENCES members(id) ON DELETE SET NULL;
alter table public.profiles add constraint profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;
alter table public.regions add constraint regions_church_id_fkey FOREIGN KEY (church_id) REFERENCES churches(id) ON DELETE RESTRICT;
alter table public.report_deliveries add constraint report_deliveries_church_id_fkey FOREIGN KEY (church_id) REFERENCES churches(id) ON DELETE RESTRICT;
alter table public.report_deliveries add constraint report_deliveries_congregation_id_fkey FOREIGN KEY (congregation_id) REFERENCES congregations(id) ON DELETE RESTRICT;
alter table public.report_deliveries add constraint report_deliveries_created_by_fkey FOREIGN KEY (created_by) REFERENCES profiles(id) ON DELETE SET NULL;
alter table public.report_deliveries add constraint report_deliveries_delivered_by_fkey FOREIGN KEY (delivered_by) REFERENCES profiles(id) ON DELETE SET NULL;
alter table public.report_deliveries add constraint report_deliveries_finalized_by_fkey FOREIGN KEY (finalized_by) REFERENCES profiles(id) ON DELETE SET NULL;
alter table public.report_deliveries add constraint report_deliveries_reviewed_by_fkey FOREIGN KEY (reviewed_by) REFERENCES profiles(id) ON DELETE SET NULL;
alter table public.report_delivery_items add constraint report_delivery_items_category_id_fkey FOREIGN KEY (category_id) REFERENCES financial_categories(id) ON DELETE SET NULL;
alter table public.report_delivery_items add constraint report_delivery_items_central_transaction_id_fkey FOREIGN KEY (central_transaction_id) REFERENCES financial_transactions(id) ON DELETE SET NULL;
alter table public.report_delivery_items add constraint report_delivery_items_church_id_fkey FOREIGN KEY (church_id) REFERENCES churches(id) ON DELETE RESTRICT;
alter table public.report_delivery_items add constraint report_delivery_items_congregation_id_fkey FOREIGN KEY (congregation_id) REFERENCES congregations(id) ON DELETE RESTRICT;
alter table public.report_delivery_items add constraint report_delivery_items_congregation_transaction_id_fkey FOREIGN KEY (congregation_transaction_id) REFERENCES financial_transactions(id) ON DELETE SET NULL;
alter table public.report_delivery_items add constraint report_delivery_items_created_by_fkey FOREIGN KEY (created_by) REFERENCES profiles(id) ON DELETE SET NULL;
alter table public.report_delivery_items add constraint report_delivery_items_report_delivery_id_fkey FOREIGN KEY (report_delivery_id) REFERENCES report_deliveries(id) ON DELETE CASCADE;
alter table public.report_delivery_items add constraint report_delivery_items_report_delivery_rule_id_fkey FOREIGN KEY (report_delivery_rule_id) REFERENCES report_delivery_rules(id) ON DELETE SET NULL;
alter table public.report_delivery_rules add constraint report_delivery_rules_category_id_fkey FOREIGN KEY (category_id) REFERENCES financial_categories(id) ON DELETE SET NULL;
alter table public.report_delivery_rules add constraint report_delivery_rules_church_id_fkey FOREIGN KEY (church_id) REFERENCES churches(id) ON DELETE RESTRICT;
alter table public.report_delivery_rules add constraint report_delivery_rules_congregation_id_fkey FOREIGN KEY (congregation_id) REFERENCES congregations(id) ON DELETE SET NULL;
alter table public.report_delivery_rules add constraint report_delivery_rules_created_by_fkey FOREIGN KEY (created_by) REFERENCES profiles(id) ON DELETE SET NULL;
alter table public.role_permissions add constraint role_permissions_permission_id_fkey FOREIGN KEY (permission_id) REFERENCES permissions(id) ON DELETE CASCADE;
alter table public.roles add constraint roles_church_id_fkey FOREIGN KEY (church_id) REFERENCES churches(id) ON DELETE RESTRICT;
alter table public.roles add constraint roles_created_by_fkey FOREIGN KEY (created_by) REFERENCES profiles(id) ON DELETE SET NULL;
alter table public.roles add constraint roles_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES profiles(id) ON DELETE SET NULL;
alter table public.user_church_access add constraint user_church_access_church_id_fkey FOREIGN KEY (church_id) REFERENCES churches(id) ON DELETE RESTRICT;
alter table public.user_church_access add constraint user_church_access_congregation_id_fkey FOREIGN KEY (congregation_id) REFERENCES congregations(id) ON DELETE SET NULL;
alter table public.user_church_access add constraint user_church_access_invited_by_fkey FOREIGN KEY (invited_by) REFERENCES profiles(id) ON DELETE SET NULL;
alter table public.user_church_access add constraint user_church_access_ministry_id_fkey FOREIGN KEY (ministry_id) REFERENCES ministries(id) ON DELETE SET NULL;
alter table public.user_church_access add constraint user_church_access_profile_id_fkey FOREIGN KEY (profile_id) REFERENCES profiles(id) ON DELETE CASCADE;
alter table public.user_church_access add constraint user_church_access_region_id_fkey FOREIGN KEY (region_id) REFERENCES regions(id) ON DELETE SET NULL;
alter table public.user_permission_overrides add constraint user_permission_overrides_access_id_fkey FOREIGN KEY (access_id) REFERENCES user_church_access(id) ON DELETE CASCADE;
alter table public.user_permission_overrides add constraint user_permission_overrides_created_by_fkey FOREIGN KEY (created_by) REFERENCES profiles(id) ON DELETE SET NULL;
alter table public.user_permission_overrides add constraint user_permission_overrides_permission_id_fkey FOREIGN KEY (permission_id) REFERENCES permissions(id) ON DELETE CASCADE;

-- Source: remote migration 20260808000556_trial_clone_private_routines
create schema if not exists private;
revoke all on schema private from public, anon, authenticated;
CREATE OR REPLACE FUNCTION private.is_church_admin(p_church_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select exists (
    select 1
    from public.user_church_access access
    join public.profiles profile on profile.id = access.profile_id
    join public.churches church on church.id = access.church_id
    where access.profile_id = (select auth.uid())
      and access.church_id = p_church_id
      and access.role = 'ADMIN'
      and access.access_scope = 'CHURCH'
      and access.status = 'ACTIVE'
      and access.deleted_at is null
      and profile.status = 'ACTIVE'
      and profile.deleted_at is null
      and church.status = 'ACTIVE'
      and church.deleted_at is null
  );
$function$
;
CREATE OR REPLACE FUNCTION private.count_congregation_dependencies(p_congregation_id uuid)
 RETURNS integer
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_table text;
  v_count integer;
  v_total integer := 0;
  v_tables text[] := array[
    'user_church_access',
    'church_invitations',
    'members',
    'member_history',
    'member_roles',
    'ministries',
    'member_ministries',
    'events',
    'event_congregation_quotas',
    'event_registrations',
    'financial_departments',
    'financial_cashboxes',
    'financial_transactions',
    'financial_receipts',
    'financial_documents',
    'accounts_payable',
    'report_delivery_rules',
    'report_deliveries',
    'report_delivery_items'
  ];
begin
  foreach v_table in array v_tables loop
    if exists (
      select 1
      from information_schema.columns
      where table_schema = 'public'
        and table_name = v_table
        and column_name = 'congregation_id'
    ) then
      execute format(
        'select count(*)::integer from public.%I where congregation_id = $1',
        v_table
      ) into v_count using p_congregation_id;
      v_total := v_total + coalesce(v_count, 0);
    end if;
  end loop;

  return v_total;
end;
$function$
;
CREATE OR REPLACE FUNCTION private.protect_region_mutation()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_linked integer;
  v_active integer;
begin
  new.name := btrim(new.name);
  new.description := nullif(btrim(new.description), '');
  new.coordinator_name := nullif(btrim(new.coordinator_name), '');
  new.coordinator_phone := nullif(btrim(new.coordinator_phone), '');

  if tg_op = 'UPDATE' and new.church_id <> old.church_id then
    raise exception 'Não é permitido alterar a igreja de uma Regional';
  end if;

  if tg_op = 'UPDATE' and new.deleted_at is distinct from old.deleted_at
    and new.deleted_at is not null then
    select count(*)::integer into v_linked
    from public.congregations congregation
    where congregation.region_id = old.id
      and congregation.deleted_at is null;

    if v_linked > 0 then
      raise exception 'A Regional possui % Congregação(ões) vinculada(s)', v_linked;
    end if;
  end if;

  if tg_op = 'UPDATE' and old.status = 'ACTIVE' and new.status = 'INACTIVE' then
    select count(*)::integer into v_active
    from public.congregations congregation
    where congregation.region_id = old.id
      and congregation.status = 'ACTIVE'
      and congregation.deleted_at is null;

    if v_active > 0 then
      raise exception 'A Regional possui % Congregação(ões) ativa(s)', v_active;
    end if;
  end if;

  return new;
end;
$function$
;
CREATE OR REPLACE FUNCTION private.protect_congregation_mutation()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_dependencies integer;
begin
  new.name := btrim(new.name);
  new.code := nullif(upper(btrim(new.code)), '');
  new.pastor_name := nullif(btrim(new.pastor_name), '');
  new.pastor_spouse_name := nullif(btrim(new.pastor_spouse_name), '');
  new.phone := nullif(btrim(new.phone), '');
  new.whatsapp := nullif(btrim(new.whatsapp), '');
  new.email := nullif(lower(btrim(new.email)), '');
  new.zip_code := nullif(btrim(new.zip_code), '');
  new.address := nullif(btrim(new.address), '');
  new.number := nullif(btrim(new.number), '');
  new.complement := nullif(btrim(new.complement), '');
  new.district := nullif(btrim(new.district), '');
  new.city := nullif(btrim(new.city), '');
  new.state := nullif(upper(btrim(new.state)), '');
  new.country := coalesce(nullif(btrim(new.country), ''), 'Brasil');
  new.notes := nullif(btrim(new.notes), '');

  if tg_op = 'UPDATE' and new.church_id <> old.church_id then
    raise exception 'Não é permitido alterar a igreja de uma Congregação';
  end if;

  if tg_op = 'UPDATE' and new.is_headquarters is distinct from old.is_headquarters then
    raise exception 'Não é permitido alterar a identificação da Congregação Sede';
  end if;

  if new.is_headquarters then
    if new.status <> 'ACTIVE' or new.deleted_at is not null then
      raise exception 'A Congregação Sede não pode ser inativada ou excluída';
    end if;

    if tg_op = 'INSERT' and exists (
      select 1
      from public.congregations headquarters
      where headquarters.church_id = new.church_id
        and headquarters.is_headquarters = true
        and headquarters.deleted_at is null
    ) then
      raise exception 'A igreja já possui uma Congregação Sede';
    end if;
  elsif new.region_id is null then
    raise exception 'Selecione uma Regional para a Congregação';
  end if;

  if new.region_id is not null and not exists (
    select 1
    from public.regions region
    where region.id = new.region_id
      and region.church_id = new.church_id
      and region.status = 'ACTIVE'
      and region.deleted_at is null
  ) then
    raise exception 'A Regional deve estar ativa e pertencer à mesma igreja';
  end if;

  if tg_op = 'UPDATE' and new.deleted_at is distinct from old.deleted_at
    and new.deleted_at is not null then
    if old.is_headquarters then
      raise exception 'A Congregação Sede não pode ser excluída';
    end if;

    v_dependencies := private.count_congregation_dependencies(old.id);
    if v_dependencies > 0 then
      raise exception 'A Congregação possui % dependência(s) e deve ser apenas inativada', v_dependencies;
    end if;
  end if;

  return new;
end;
$function$
;
CREATE OR REPLACE FUNCTION private.protect_role_mutation()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  new.name := btrim(new.name);
  new.female_name := nullif(btrim(new.female_name), '');
  new.abbreviation := nullif(btrim(new.abbreviation), '');
  new.female_abbreviation := nullif(btrim(new.female_abbreviation), '');
  new.description := nullif(btrim(new.description), '');
  new.level := new.display_order;

  if tg_op = 'INSERT' then
    new.created_by := coalesce(new.created_by, auth.uid());
  else
    if new.church_id <> old.church_id then
      raise exception 'Não é permitido alterar a igreja de um Cargo';
    end if;

    if new.deleted_at is distinct from old.deleted_at
      and new.deleted_at is not null
      and exists (
        select 1 from public.member_roles member_role
        where member_role.role_id = old.id
      ) then
      raise exception 'O Cargo possui vínculos com membros e deve ser apenas inativado';
    end if;
  end if;

  new.updated_by := auth.uid();
  return new;
end;
$function$
;
CREATE OR REPLACE FUNCTION private.audit_region_mutation()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_action text;
  v_description text;
begin
  if tg_op = 'INSERT' then
    v_action := 'REGION_CREATED';
    v_description := 'Regional cadastrada.';
  elsif new.deleted_at is distinct from old.deleted_at and new.deleted_at is not null then
    v_action := 'REGION_ARCHIVED';
    v_description := 'Regional excluída logicamente.';
  elsif new.status is distinct from old.status then
    v_action := 'REGION_STATUS_CHANGED';
    v_description := 'Situação da Regional alterada.';
  else
    v_action := 'REGION_UPDATED';
    v_description := 'Dados da Regional alterados.';
  end if;

  perform public.log_audit(
    new.church_id, 'organization', v_action, 'region', new.id, new.name,
    v_description,
    case when tg_op = 'UPDATE' then jsonb_build_object(
      'name', old.name,
      'coordinator_name', old.coordinator_name,
      'status', old.status,
      'display_order', old.display_order
    ) else null end,
    jsonb_build_object(
      'name', new.name,
      'coordinator_name', new.coordinator_name,
      'status', new.status,
      'display_order', new.display_order
    ),
    null,
    case when v_action in ('REGION_ARCHIVED', 'REGION_STATUS_CHANGED') then 'WARNING' else 'INFO' end
  );

  return new;
end;
$function$
;
CREATE OR REPLACE FUNCTION private.audit_congregation_mutation()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_action text;
  v_description text;
begin
  if tg_op = 'INSERT' then
    v_action := 'CONGREGATION_CREATED';
    v_description := 'Congregação cadastrada.';
  elsif new.deleted_at is distinct from old.deleted_at and new.deleted_at is not null then
    v_action := 'CONGREGATION_ARCHIVED';
    v_description := 'Congregação excluída logicamente.';
  elsif new.region_id is distinct from old.region_id then
    v_action := 'CONGREGATION_REGION_CHANGED';
    v_description := 'Regional da Congregação alterada.';
  elsif new.status is distinct from old.status then
    v_action := 'CONGREGATION_STATUS_CHANGED';
    v_description := 'Situação da Congregação alterada.';
  else
    v_action := 'CONGREGATION_UPDATED';
    v_description := 'Dados da Congregação alterados.';
  end if;

  perform public.log_audit(
    new.church_id, 'organization', v_action, 'congregation', new.id, new.name,
    v_description,
    case when tg_op = 'UPDATE' then jsonb_build_object(
      'name', old.name,
      'code', old.code,
      'region_id', old.region_id,
      'status', old.status,
      'display_order', old.display_order
    ) else null end,
    jsonb_build_object(
      'name', new.name,
      'code', new.code,
      'region_id', new.region_id,
      'status', new.status,
      'display_order', new.display_order,
      'is_headquarters', new.is_headquarters
    ),
    null,
    case when v_action in ('CONGREGATION_ARCHIVED', 'CONGREGATION_REGION_CHANGED', 'CONGREGATION_STATUS_CHANGED') then 'WARNING' else 'INFO' end
  );

  return new;
end;
$function$
;
CREATE OR REPLACE FUNCTION private.audit_role_mutation()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_action text;
  v_description text;
begin
  if tg_op = 'INSERT' then
    v_action := 'POSITION_CREATED';
    v_description := 'Cargo eclesiástico cadastrado.';
  elsif new.deleted_at is distinct from old.deleted_at and new.deleted_at is not null then
    v_action := 'POSITION_ARCHIVED';
    v_description := 'Cargo eclesiástico excluído logicamente.';
  elsif new.status is distinct from old.status then
    v_action := 'POSITION_STATUS_CHANGED';
    v_description := 'Situação do Cargo alterada.';
  elsif new.display_order is distinct from old.display_order then
    v_action := 'POSITION_ORDER_CHANGED';
    v_description := 'Ordem do Cargo alterada.';
  else
    v_action := 'POSITION_UPDATED';
    v_description := 'Dados do Cargo alterados.';
  end if;

  perform public.log_audit(
    new.church_id, 'organization', v_action, 'position', new.id, new.name,
    v_description,
    case when tg_op = 'UPDATE' then jsonb_build_object(
      'name', old.name,
      'female_name', old.female_name,
      'abbreviation', old.abbreviation,
      'female_abbreviation', old.female_abbreviation,
      'status', old.status,
      'display_order', old.display_order
    ) else null end,
    jsonb_build_object(
      'name', new.name,
      'female_name', new.female_name,
      'abbreviation', new.abbreviation,
      'female_abbreviation', new.female_abbreviation,
      'status', new.status,
      'display_order', new.display_order
    ),
    null,
    case when v_action in ('POSITION_ARCHIVED', 'POSITION_STATUS_CHANGED') then 'WARNING' else 'INFO' end
  );

  return new;
end;
$function$
;
CREATE OR REPLACE FUNCTION private.protect_congregation_document_mutation()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
begin
  new.title := btrim(new.title);
  new.category := upper(btrim(new.category));
  new.original_file_name := btrim(new.original_file_name);
  new.mime_type := lower(btrim(new.mime_type));

  if tg_op = 'INSERT' then
    if new.uploaded_by is distinct from (select auth.uid()) then
      raise exception 'O responsável pelo envio é inválido';
    end if;
  else
    if new.church_id is distinct from old.church_id
      or new.congregation_id is distinct from old.congregation_id
      or new.original_file_name is distinct from old.original_file_name
      or new.storage_bucket is distinct from old.storage_bucket
      or new.storage_path is distinct from old.storage_path
      or new.uploaded_by is distinct from old.uploaded_by
      or new.uploaded_at is distinct from old.uploaded_at then
      raise exception 'Não é permitido alterar a identidade do documento';
    end if;

    if (
      new.mime_type is distinct from old.mime_type
      or new.file_size is distinct from old.file_size
      or new.upload_status is distinct from old.upload_status
    ) and not (
      old.upload_status = 'PENDING'
      and new.upload_status = 'ACTIVE'
      and new.deleted_at is null
    ) then
      raise exception 'A situação do upload não pode ser alterada';
    end if;

    if old.deleted_at is not null and new.deleted_at is null then
      raise exception 'Não é permitido restaurar o documento por esta operação';
    end if;

    if new.deleted_at is distinct from old.deleted_at and new.deleted_at is not null then
      new.deleted_by := (select auth.uid());
    end if;
  end if;

  return new;
end;
$function$
;
CREATE OR REPLACE FUNCTION private.protect_congregation_documents_dependency()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  if new.deleted_at is distinct from old.deleted_at
    and new.deleted_at is not null
    and exists (
      select 1
      from public.congregation_documents document
      where document.congregation_id = old.id
        and document.church_id = old.church_id
        and document.upload_status = 'ACTIVE'
        and document.deleted_at is null
    ) then
    raise exception 'A Congregação possui documentos ativos e deve ser apenas inativada';
  end if;

  return new;
end;
$function$
;
CREATE OR REPLACE FUNCTION private.audit_congregation_document_mutation()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_action text;
  v_description text;
begin
  if tg_op = 'INSERT' then
    -- O registro pendente ainda não representa um documento confirmado.
    return new;
  elsif old.upload_status = 'PENDING' and new.upload_status = 'ACTIVE' then
    v_action := 'CONGREGATION_DOCUMENT_UPLOADED';
    v_description := 'Documento da Congregação anexado.';
  elsif old.upload_status = 'PENDING' and new.deleted_at is not null then
    -- Upload inválido ou interrompido: não polui a auditoria operacional.
    return new;
  elsif new.deleted_at is distinct from old.deleted_at and new.deleted_at is not null then
    v_action := 'CONGREGATION_DOCUMENT_DELETED';
    v_description := 'Documento da Congregação excluído.';
  else
    v_action := 'CONGREGATION_DOCUMENT_UPDATED';
    v_description := 'Dados do documento da Congregação alterados.';
  end if;

  perform public.log_audit(
    new.church_id,
    'organization',
    v_action,
    'congregation_document',
    new.id,
    new.title,
    v_description,
    case when tg_op = 'UPDATE' then jsonb_build_object(
      'title', old.title,
      'category', old.category,
      'deleted_at', old.deleted_at
    ) else null end,
    jsonb_build_object(
      'congregation_id', new.congregation_id,
      'title', new.title,
      'category', new.category,
      'mime_type', new.mime_type,
      'file_size', new.file_size,
      'upload_status', new.upload_status,
      'deleted_at', new.deleted_at
    ),
    null,
    case when v_action = 'CONGREGATION_DOCUMENT_DELETED' then 'WARNING' else 'INFO' end
  );

  return new;
end;
$function$
;

-- Source: remote migration 20260808000614_trial_clone_public_triggers
CREATE TRIGGER set_accounts_payable_updated_at BEFORE UPDATE ON accounts_payable FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER audit_app_settings_update AFTER UPDATE ON app_settings FOR EACH ROW EXECUTE FUNCTION audit_app_settings_update();
CREATE TRIGGER set_app_settings_updated_at BEFORE UPDATE ON app_settings FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER touch_church_invitations_updated_at BEFORE UPDATE ON church_invitations FOR EACH ROW EXECUTE FUNCTION touch_updated_at();
CREATE TRIGGER validate_church_invitation_target BEFORE INSERT OR UPDATE ON church_invitations FOR EACH ROW EXECUTE FUNCTION validate_access_target_tenant();
CREATE TRIGGER audit_churches_update AFTER UPDATE ON churches FOR EACH ROW EXECUTE FUNCTION audit_institution_update();
CREATE TRIGGER set_churches_updated_at BEFORE UPDATE ON churches FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER audit_congregation_document_mutation AFTER INSERT OR UPDATE ON congregation_documents FOR EACH ROW EXECUTE FUNCTION private.audit_congregation_document_mutation();
CREATE TRIGGER protect_congregation_document_mutation BEFORE INSERT OR UPDATE ON congregation_documents FOR EACH ROW EXECUTE FUNCTION private.protect_congregation_document_mutation();
CREATE TRIGGER touch_congregation_documents_updated_at BEFORE UPDATE ON congregation_documents FOR EACH ROW EXECUTE FUNCTION touch_updated_at();
CREATE TRIGGER audit_congregations_organization_mutation AFTER INSERT OR UPDATE ON congregations FOR EACH ROW EXECUTE FUNCTION private.audit_congregation_mutation();
CREATE TRIGGER protect_congregation_documents_dependency BEFORE UPDATE OF deleted_at ON congregations FOR EACH ROW EXECUTE FUNCTION private.protect_congregation_documents_dependency();
CREATE TRIGGER protect_congregations_organization_mutation BEFORE INSERT OR UPDATE ON congregations FOR EACH ROW EXECUTE FUNCTION private.protect_congregation_mutation();
CREATE TRIGGER set_congregations_updated_at BEFORE UPDATE ON congregations FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER validate_congregations_tenant BEFORE INSERT OR UPDATE ON congregations FOR EACH ROW EXECUTE FUNCTION validate_congregation_tenant();
CREATE TRIGGER set_event_checkins_updated_at BEFORE UPDATE ON event_checkins FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER set_event_congregation_quotas_updated_at BEFORE UPDATE ON event_congregation_quotas FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER set_event_documents_updated_at BEFORE UPDATE ON event_documents FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER set_event_groups_updated_at BEFORE UPDATE ON event_groups FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER set_event_items_updated_at BEFORE UPDATE ON event_items FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER set_event_payments_updated_at BEFORE UPDATE ON event_payments FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER set_event_registration_items_updated_at BEFORE UPDATE ON event_registration_items FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER set_event_registrations_updated_at BEFORE UPDATE ON event_registrations FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER set_financial_cashboxes_updated_at BEFORE UPDATE ON financial_cashboxes FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER set_financial_departments_updated_at BEFORE UPDATE ON financial_departments FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER set_financial_documents_updated_at BEFORE UPDATE ON financial_documents FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER set_financial_payment_methods_updated_at BEFORE UPDATE ON financial_payment_methods FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER set_financial_receipts_updated_at BEFORE UPDATE ON financial_receipts FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER set_financial_transactions_updated_at BEFORE UPDATE ON financial_transactions FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER set_member_documents_updated_at BEFORE UPDATE ON member_documents FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER enrich_member_role_history_values BEFORE INSERT OR UPDATE OF history_type, metadata, old_value, new_value ON member_history FOR EACH ROW EXECUTE FUNCTION enrich_member_role_history();
CREATE TRIGGER normalize_member_role_history_language_values BEFORE INSERT OR UPDATE OF history_type, title, description ON member_history FOR EACH ROW EXECUTE FUNCTION normalize_member_role_history_language();
CREATE TRIGGER set_member_history_updated_at BEFORE UPDATE ON member_history FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER set_member_ministries_updated_at BEFORE UPDATE ON member_ministries FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER audit_member_pastoral_notes AFTER INSERT OR UPDATE ON member_pastoral_notes FOR EACH ROW EXECUTE FUNCTION audit_pastoral_note_mutation();
CREATE TRIGGER touch_member_pastoral_notes_updated_at BEFORE UPDATE ON member_pastoral_notes FOR EACH ROW EXECUTE FUNCTION touch_updated_at();
CREATE TRIGGER set_member_roles_updated_at BEFORE UPDATE ON member_roles FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER audit_member_sensitive_identity AFTER INSERT OR UPDATE ON member_sensitive_identity FOR EACH ROW EXECUTE FUNCTION audit_sensitive_member_mutation();
CREATE TRIGGER touch_member_sensitive_identity_updated_at BEFORE UPDATE ON member_sensitive_identity FOR EACH ROW EXECUTE FUNCTION touch_updated_at();
CREATE TRIGGER audit_members_mutation AFTER INSERT OR UPDATE ON members FOR EACH ROW EXECUTE FUNCTION audit_member_mutation();
CREATE TRIGGER set_members_updated_at BEFORE UPDATE ON members FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER validate_members_tenant BEFORE INSERT OR UPDATE ON members FOR EACH ROW EXECUTE FUNCTION validate_member_tenant();
CREATE TRIGGER set_ministries_updated_at BEFORE UPDATE ON ministries FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER set_permissions_updated_at BEFORE UPDATE ON permissions FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER set_profiles_updated_at BEFORE UPDATE ON profiles FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER audit_regions_organization_mutation AFTER INSERT OR UPDATE ON regions FOR EACH ROW EXECUTE FUNCTION private.audit_region_mutation();
CREATE TRIGGER protect_regions_organization_mutation BEFORE INSERT OR UPDATE ON regions FOR EACH ROW EXECUTE FUNCTION private.protect_region_mutation();
CREATE TRIGGER set_regions_updated_at BEFORE UPDATE ON regions FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER set_report_deliveries_updated_at BEFORE UPDATE ON report_deliveries FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER set_report_delivery_items_updated_at BEFORE UPDATE ON report_delivery_items FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER set_report_delivery_rules_updated_at BEFORE UPDATE ON report_delivery_rules FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER set_role_permissions_updated_at BEFORE UPDATE ON role_permissions FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER audit_roles_organization_mutation AFTER INSERT OR UPDATE ON roles FOR EACH ROW EXECUTE FUNCTION private.audit_role_mutation();
CREATE TRIGGER protect_roles_organization_mutation BEFORE INSERT OR UPDATE ON roles FOR EACH ROW EXECUTE FUNCTION private.protect_role_mutation();
CREATE TRIGGER set_roles_updated_at BEFORE UPDATE ON roles FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER protect_last_admin_access BEFORE UPDATE ON user_church_access FOR EACH ROW EXECUTE FUNCTION protect_last_church_admin();
CREATE TRIGGER set_user_church_access_updated_at BEFORE UPDATE ON user_church_access FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER validate_user_church_access_target BEFORE INSERT OR UPDATE ON user_church_access FOR EACH ROW EXECUTE FUNCTION validate_access_target_tenant();
CREATE TRIGGER touch_user_permission_overrides_updated_at BEFORE UPDATE ON user_permission_overrides FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

-- Source: remote migration 20260808000644_trial_clone_public_rls_policies
alter table public."accounts_payable" enable row level security;
alter table public."app_settings" enable row level security;
alter table public."audit_logs" enable row level security;
alter table public."church_invitations" enable row level security;
alter table public."churches" enable row level security;
alter table public."congregation_documents" enable row level security;
alter table public."congregations" enable row level security;
alter table public."event_checkins" enable row level security;
alter table public."event_congregation_quotas" enable row level security;
alter table public."event_documents" enable row level security;
alter table public."event_groups" enable row level security;
alter table public."event_items" enable row level security;
alter table public."event_payments" enable row level security;
alter table public."event_registration_items" enable row level security;
alter table public."event_registrations" enable row level security;
alter table public."events" enable row level security;
alter table public."financial_cashboxes" enable row level security;
alter table public."financial_categories" enable row level security;
alter table public."financial_departments" enable row level security;
alter table public."financial_documents" enable row level security;
alter table public."financial_payment_methods" enable row level security;
alter table public."financial_receipts" enable row level security;
alter table public."financial_transactions" enable row level security;
alter table public."member_documents" enable row level security;
alter table public."member_history" enable row level security;
alter table public."member_ministries" enable row level security;
alter table public."member_pastoral_notes" enable row level security;
alter table public."member_roles" enable row level security;
alter table public."member_sensitive_identity" enable row level security;
alter table public."members" enable row level security;
alter table public."ministries" enable row level security;
alter table public."permissions" enable row level security;
alter table public."profiles" enable row level security;
alter table public."regions" enable row level security;
alter table public."report_deliveries" enable row level security;
alter table public."report_delivery_items" enable row level security;
alter table public."report_delivery_rules" enable row level security;
alter table public."role_permissions" enable row level security;
alter table public."roles" enable row level security;
alter table public."user_church_access" enable row level security;
alter table public."user_permission_overrides" enable row level security;
create policy "Users with finance manage permission can manage accounts payabl" on public.accounts_payable as permissive for all to authenticated using ((EXISTS ( SELECT 1
   FROM ((user_church_access uca
     JOIN role_permissions rp ON ((rp.role = uca.role)))
     JOIN permissions p ON ((p.id = rp.permission_id)))
  WHERE ((uca.profile_id = auth.uid()) AND (uca.church_id = accounts_payable.church_id) AND (uca.status = 'ACTIVE'::text) AND (uca.deleted_at IS NULL) AND (rp.status = 'ACTIVE'::text) AND (rp.deleted_at IS NULL) AND (p.key = 'finance.manage'::text) AND (p.status = 'ACTIVE'::text) AND (p.deleted_at IS NULL))))) with check ((EXISTS ( SELECT 1
   FROM ((user_church_access uca
     JOIN role_permissions rp ON ((rp.role = uca.role)))
     JOIN permissions p ON ((p.id = rp.permission_id)))
  WHERE ((uca.profile_id = auth.uid()) AND (uca.church_id = accounts_payable.church_id) AND (uca.status = 'ACTIVE'::text) AND (uca.deleted_at IS NULL) AND (rp.status = 'ACTIVE'::text) AND (rp.deleted_at IS NULL) AND (p.key = 'finance.manage'::text) AND (p.status = 'ACTIVE'::text) AND (p.deleted_at IS NULL)))));
create policy "Users with finance permission can view accounts payable" on public.accounts_payable as permissive for select to authenticated using (((deleted_at IS NULL) AND (EXISTS ( SELECT 1
   FROM ((user_church_access uca
     JOIN role_permissions rp ON ((rp.role = uca.role)))
     JOIN permissions p ON ((p.id = rp.permission_id)))
  WHERE ((uca.profile_id = auth.uid()) AND (uca.church_id = accounts_payable.church_id) AND (uca.status = 'ACTIVE'::text) AND (uca.deleted_at IS NULL) AND (rp.status = 'ACTIVE'::text) AND (rp.deleted_at IS NULL) AND (p.key = ANY (ARRAY['finance.view'::text, 'finance.manage'::text])) AND (p.status = 'ACTIVE'::text) AND (p.deleted_at IS NULL))))));
create policy "Church admins can update app settings" on public.app_settings as permissive for update to authenticated using ((EXISTS ( SELECT 1
   FROM user_church_access uca
  WHERE ((uca.profile_id = auth.uid()) AND (uca.church_id = app_settings.church_id) AND (uca.role = 'ADMIN'::text) AND (uca.status = 'ACTIVE'::text) AND (uca.deleted_at IS NULL))))) with check ((EXISTS ( SELECT 1
   FROM user_church_access uca
  WHERE ((uca.profile_id = auth.uid()) AND (uca.church_id = app_settings.church_id) AND (uca.role = 'ADMIN'::text) AND (uca.status = 'ACTIVE'::text) AND (uca.deleted_at IS NULL)))));
create policy "Church users can view app settings" on public.app_settings as permissive for select to authenticated using ((EXISTS ( SELECT 1
   FROM user_church_access uca
  WHERE ((uca.profile_id = auth.uid()) AND (uca.church_id = app_settings.church_id) AND (uca.status = 'ACTIVE'::text) AND (uca.deleted_at IS NULL)))));
create policy "Platform admins can view all app settings" on public.app_settings as permissive for select to authenticated using ((EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = auth.uid()) AND (p.is_platform_admin = true) AND (p.status = 'ACTIVE'::text) AND (p.deleted_at IS NULL)))));
create policy app_settings_select_access on public.app_settings as permissive for select to authenticated using ((can_access_church(church_id) AND (deleted_at IS NULL)));
create policy app_settings_update_permission on public.app_settings as permissive for update to authenticated using ((has_permission(church_id, 'settings.update'::text) AND (deleted_at IS NULL))) with check ((has_permission(church_id, 'settings.update'::text) AND (deleted_at IS NULL)));
create policy "Authenticated users can create audit logs" on public.audit_logs as permissive for insert to authenticated with check ((auth.uid() = actor_profile_id));
create policy "Platform admins can view audit logs" on public.audit_logs as permissive for select to authenticated using ((EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = auth.uid()) AND (p.is_platform_admin = true) AND (p.status = 'ACTIVE'::text) AND (p.deleted_at IS NULL)))));
create policy audit_select_permission on public.audit_logs as permissive for select to authenticated using (((church_id IS NOT NULL) AND has_permission(church_id, 'audit.view'::text)));
create policy invitations_select_authorized on public.church_invitations as permissive for select to authenticated using (((deleted_at IS NULL) AND (has_permission(church_id, 'users.view'::text) OR (email_normalized = lower(COALESCE((auth.jwt() ->> 'email'::text), ''::text))))));
create policy invitations_update_authorized on public.church_invitations as permissive for update to authenticated using (has_permission(church_id, 'users.invite'::text)) with check (has_permission(church_id, 'users.invite'::text));
create policy churches_select_access on public.churches as permissive for select to authenticated using ((can_access_church(id) AND (deleted_at IS NULL)));
create policy churches_update_permission on public.churches as permissive for update to authenticated using ((has_permission(id, 'church.update'::text) AND (deleted_at IS NULL))) with check ((has_permission(id, 'church.update'::text) AND (deleted_at IS NULL)));
create policy congregation_documents_insert on public.congregation_documents as permissive for insert to authenticated with check (((deleted_at IS NULL) AND (upload_status = 'PENDING'::text) AND (uploaded_by = ( SELECT auth.uid() AS uid)) AND ( SELECT has_permission(congregation_documents.church_id, 'congregation_documents.manage'::text) AS has_permission) AND ( SELECT private.is_church_admin(congregation_documents.church_id) AS is_church_admin) AND ( SELECT can_access_congregation(congregation_documents.church_id, congregation_documents.congregation_id) AS can_access_congregation)));
create policy congregation_documents_select on public.congregation_documents as permissive for select to authenticated using (((deleted_at IS NULL) AND (((upload_status = 'ACTIVE'::text) AND (( SELECT has_permission(congregation_documents.church_id, 'congregation_documents.view'::text) AS has_permission) OR ( SELECT has_permission(congregation_documents.church_id, 'congregation_documents.manage'::text) AS has_permission))) OR ((upload_status = 'PENDING'::text) AND ( SELECT has_permission(congregation_documents.church_id, 'congregation_documents.manage'::text) AS has_permission))) AND ( SELECT private.is_church_admin(congregation_documents.church_id) AS is_church_admin) AND ( SELECT can_access_congregation(congregation_documents.church_id, congregation_documents.congregation_id) AS can_access_congregation)));
create policy congregation_documents_select_archived_managers on public.congregation_documents as permissive for select to authenticated using (((deleted_at IS NOT NULL) AND ( SELECT has_permission(congregation_documents.church_id, 'congregation_documents.manage'::text) AS has_permission) AND ( SELECT private.is_church_admin(congregation_documents.church_id) AS is_church_admin) AND ( SELECT can_access_congregation(congregation_documents.church_id, congregation_documents.congregation_id) AS can_access_congregation)));
create policy congregation_documents_update on public.congregation_documents as permissive for update to authenticated using (((deleted_at IS NULL) AND ( SELECT has_permission(congregation_documents.church_id, 'congregation_documents.manage'::text) AS has_permission) AND ( SELECT private.is_church_admin(congregation_documents.church_id) AS is_church_admin) AND ( SELECT can_access_congregation(congregation_documents.church_id, congregation_documents.congregation_id) AS can_access_congregation))) with check ((( SELECT has_permission(congregation_documents.church_id, 'congregation_documents.manage'::text) AS has_permission) AND ( SELECT private.is_church_admin(congregation_documents.church_id) AS is_church_admin) AND ( SELECT can_access_congregation(congregation_documents.church_id, congregation_documents.congregation_id) AS can_access_congregation)));
create policy congregations_insert on public.congregations as permissive for insert to authenticated with check (((deleted_at IS NULL) AND ( SELECT has_permission(congregations.church_id, 'congregations.manage'::text) AS has_permission) AND ( SELECT private.is_church_admin(congregations.church_id) AS is_church_admin)));
create policy congregations_select_scope on public.congregations as permissive for select to authenticated using (((deleted_at IS NULL) AND ( SELECT has_permission(congregations.church_id, 'organization.view'::text) AS has_permission) AND ( SELECT can_access_congregation(congregations.church_id, congregations.id) AS can_access_congregation)));
create policy congregations_update on public.congregations as permissive for update to authenticated using (((deleted_at IS NULL) AND ( SELECT has_permission(congregations.church_id, 'congregations.manage'::text) AS has_permission) AND ( SELECT private.is_church_admin(congregations.church_id) AS is_church_admin))) with check ((( SELECT has_permission(congregations.church_id, 'congregations.manage'::text) AS has_permission) AND ( SELECT private.is_church_admin(congregations.church_id) AS is_church_admin)));
create policy "Church users can view event checkins" on public.event_checkins as permissive for select to authenticated using ((EXISTS ( SELECT 1
   FROM user_church_access uca
  WHERE ((uca.profile_id = auth.uid()) AND (uca.church_id = event_checkins.church_id) AND (uca.status = 'ACTIVE'::text) AND (uca.deleted_at IS NULL)))));
create policy "Users with events manage permission can manage event checkins" on public.event_checkins as permissive for all to authenticated using ((EXISTS ( SELECT 1
   FROM ((user_church_access uca
     JOIN role_permissions rp ON ((rp.role = uca.role)))
     JOIN permissions p ON ((p.id = rp.permission_id)))
  WHERE ((uca.profile_id = auth.uid()) AND (uca.church_id = event_checkins.church_id) AND (uca.status = 'ACTIVE'::text) AND (uca.deleted_at IS NULL) AND (rp.status = 'ACTIVE'::text) AND (rp.deleted_at IS NULL) AND (p.key = 'events.manage'::text) AND (p.status = 'ACTIVE'::text) AND (p.deleted_at IS NULL))))) with check ((EXISTS ( SELECT 1
   FROM ((user_church_access uca
     JOIN role_permissions rp ON ((rp.role = uca.role)))
     JOIN permissions p ON ((p.id = rp.permission_id)))
  WHERE ((uca.profile_id = auth.uid()) AND (uca.church_id = event_checkins.church_id) AND (uca.status = 'ACTIVE'::text) AND (uca.deleted_at IS NULL) AND (rp.status = 'ACTIVE'::text) AND (rp.deleted_at IS NULL) AND (p.key = 'events.manage'::text) AND (p.status = 'ACTIVE'::text) AND (p.deleted_at IS NULL)))));
create policy "Church users can view event congregation quotas" on public.event_congregation_quotas as permissive for select to authenticated using ((EXISTS ( SELECT 1
   FROM user_church_access uca
  WHERE ((uca.profile_id = auth.uid()) AND (uca.church_id = event_congregation_quotas.church_id) AND (uca.status = 'ACTIVE'::text) AND (uca.deleted_at IS NULL)))));
create policy "Users with events manage permission can manage event congregati" on public.event_congregation_quotas as permissive for all to authenticated using ((EXISTS ( SELECT 1
   FROM ((user_church_access uca
     JOIN role_permissions rp ON ((rp.role = uca.role)))
     JOIN permissions p ON ((p.id = rp.permission_id)))
  WHERE ((uca.profile_id = auth.uid()) AND (uca.church_id = event_congregation_quotas.church_id) AND (uca.status = 'ACTIVE'::text) AND (uca.deleted_at IS NULL) AND (rp.status = 'ACTIVE'::text) AND (rp.deleted_at IS NULL) AND (p.key = 'events.manage'::text) AND (p.status = 'ACTIVE'::text) AND (p.deleted_at IS NULL))))) with check ((EXISTS ( SELECT 1
   FROM ((user_church_access uca
     JOIN role_permissions rp ON ((rp.role = uca.role)))
     JOIN permissions p ON ((p.id = rp.permission_id)))
  WHERE ((uca.profile_id = auth.uid()) AND (uca.church_id = event_congregation_quotas.church_id) AND (uca.status = 'ACTIVE'::text) AND (uca.deleted_at IS NULL) AND (rp.status = 'ACTIVE'::text) AND (rp.deleted_at IS NULL) AND (p.key = 'events.manage'::text) AND (p.status = 'ACTIVE'::text) AND (p.deleted_at IS NULL)))));
create policy "Church users can view non sensitive event documents" on public.event_documents as permissive for select to authenticated using (((is_sensitive = false) AND (status = 'ACTIVE'::text) AND (deleted_at IS NULL) AND (EXISTS ( SELECT 1
   FROM user_church_access uca
  WHERE ((uca.profile_id = auth.uid()) AND (uca.church_id = event_documents.church_id) AND (uca.status = 'ACTIVE'::text) AND (uca.deleted_at IS NULL))))));
create policy "Users with event or finance permission can view sensitive event" on public.event_documents as permissive for select to authenticated using (((is_sensitive = true) AND (status = 'ACTIVE'::text) AND (deleted_at IS NULL) AND (EXISTS ( SELECT 1
   FROM ((user_church_access uca
     JOIN role_permissions rp ON ((rp.role = uca.role)))
     JOIN permissions p ON ((p.id = rp.permission_id)))
  WHERE ((uca.profile_id = auth.uid()) AND (uca.church_id = event_documents.church_id) AND (uca.status = 'ACTIVE'::text) AND (uca.deleted_at IS NULL) AND (rp.status = 'ACTIVE'::text) AND (rp.deleted_at IS NULL) AND (p.key = ANY (ARRAY['events.manage'::text, 'finance.view'::text, 'finance.manage'::text, 'documents.view_sensitive'::text])) AND (p.status = 'ACTIVE'::text) AND (p.deleted_at IS NULL))))));
create policy "Users with events manage permission can manage event documents" on public.event_documents as permissive for all to authenticated using ((EXISTS ( SELECT 1
   FROM ((user_church_access uca
     JOIN role_permissions rp ON ((rp.role = uca.role)))
     JOIN permissions p ON ((p.id = rp.permission_id)))
  WHERE ((uca.profile_id = auth.uid()) AND (uca.church_id = event_documents.church_id) AND (uca.status = 'ACTIVE'::text) AND (uca.deleted_at IS NULL) AND (rp.status = 'ACTIVE'::text) AND (rp.deleted_at IS NULL) AND (p.key = 'events.manage'::text) AND (p.status = 'ACTIVE'::text) AND (p.deleted_at IS NULL))))) with check ((EXISTS ( SELECT 1
   FROM ((user_church_access uca
     JOIN role_permissions rp ON ((rp.role = uca.role)))
     JOIN permissions p ON ((p.id = rp.permission_id)))
  WHERE ((uca.profile_id = auth.uid()) AND (uca.church_id = event_documents.church_id) AND (uca.status = 'ACTIVE'::text) AND (uca.deleted_at IS NULL) AND (rp.status = 'ACTIVE'::text) AND (rp.deleted_at IS NULL) AND (p.key = 'events.manage'::text) AND (p.status = 'ACTIVE'::text) AND (p.deleted_at IS NULL)))));
create policy "Church users can view event groups" on public.event_groups as permissive for select to authenticated using ((EXISTS ( SELECT 1
   FROM user_church_access uca
  WHERE ((uca.profile_id = auth.uid()) AND (uca.church_id = event_groups.church_id) AND (uca.status = 'ACTIVE'::text) AND (uca.deleted_at IS NULL)))));
create policy "Users with events manage permission can manage event groups" on public.event_groups as permissive for all to authenticated using ((EXISTS ( SELECT 1
   FROM ((user_church_access uca
     JOIN role_permissions rp ON ((rp.role = uca.role)))
     JOIN permissions p ON ((p.id = rp.permission_id)))
  WHERE ((uca.profile_id = auth.uid()) AND (uca.church_id = event_groups.church_id) AND (uca.status = 'ACTIVE'::text) AND (uca.deleted_at IS NULL) AND (rp.status = 'ACTIVE'::text) AND (rp.deleted_at IS NULL) AND (p.key = 'events.manage'::text) AND (p.status = 'ACTIVE'::text) AND (p.deleted_at IS NULL))))) with check ((EXISTS ( SELECT 1
   FROM ((user_church_access uca
     JOIN role_permissions rp ON ((rp.role = uca.role)))
     JOIN permissions p ON ((p.id = rp.permission_id)))
  WHERE ((uca.profile_id = auth.uid()) AND (uca.church_id = event_groups.church_id) AND (uca.status = 'ACTIVE'::text) AND (uca.deleted_at IS NULL) AND (rp.status = 'ACTIVE'::text) AND (rp.deleted_at IS NULL) AND (p.key = 'events.manage'::text) AND (p.status = 'ACTIVE'::text) AND (p.deleted_at IS NULL)))));
create policy "Church users can view event items" on public.event_items as permissive for select to authenticated using ((EXISTS ( SELECT 1
   FROM user_church_access uca
  WHERE ((uca.profile_id = auth.uid()) AND (uca.church_id = event_items.church_id) AND (uca.status = 'ACTIVE'::text) AND (uca.deleted_at IS NULL)))));
create policy "Users with events manage permission can manage event items" on public.event_items as permissive for all to authenticated using ((EXISTS ( SELECT 1
   FROM ((user_church_access uca
     JOIN role_permissions rp ON ((rp.role = uca.role)))
     JOIN permissions p ON ((p.id = rp.permission_id)))
  WHERE ((uca.profile_id = auth.uid()) AND (uca.church_id = event_items.church_id) AND (uca.status = 'ACTIVE'::text) AND (uca.deleted_at IS NULL) AND (rp.status = 'ACTIVE'::text) AND (rp.deleted_at IS NULL) AND (p.key = 'events.manage'::text) AND (p.status = 'ACTIVE'::text) AND (p.deleted_at IS NULL))))) with check ((EXISTS ( SELECT 1
   FROM ((user_church_access uca
     JOIN role_permissions rp ON ((rp.role = uca.role)))
     JOIN permissions p ON ((p.id = rp.permission_id)))
  WHERE ((uca.profile_id = auth.uid()) AND (uca.church_id = event_items.church_id) AND (uca.status = 'ACTIVE'::text) AND (uca.deleted_at IS NULL) AND (rp.status = 'ACTIVE'::text) AND (rp.deleted_at IS NULL) AND (p.key = 'events.manage'::text) AND (p.status = 'ACTIVE'::text) AND (p.deleted_at IS NULL)))));
create policy "Users with event or finance manage permission can manage event " on public.event_payments as permissive for all to authenticated using ((EXISTS ( SELECT 1
   FROM ((user_church_access uca
     JOIN role_permissions rp ON ((rp.role = uca.role)))
     JOIN permissions p ON ((p.id = rp.permission_id)))
  WHERE ((uca.profile_id = auth.uid()) AND (uca.church_id = event_payments.church_id) AND (uca.status = 'ACTIVE'::text) AND (uca.deleted_at IS NULL) AND (rp.status = 'ACTIVE'::text) AND (rp.deleted_at IS NULL) AND (p.key = ANY (ARRAY['events.manage'::text, 'finance.manage'::text])) AND (p.status = 'ACTIVE'::text) AND (p.deleted_at IS NULL))))) with check ((EXISTS ( SELECT 1
   FROM ((user_church_access uca
     JOIN role_permissions rp ON ((rp.role = uca.role)))
     JOIN permissions p ON ((p.id = rp.permission_id)))
  WHERE ((uca.profile_id = auth.uid()) AND (uca.church_id = event_payments.church_id) AND (uca.status = 'ACTIVE'::text) AND (uca.deleted_at IS NULL) AND (rp.status = 'ACTIVE'::text) AND (rp.deleted_at IS NULL) AND (p.key = ANY (ARRAY['events.manage'::text, 'finance.manage'::text])) AND (p.status = 'ACTIVE'::text) AND (p.deleted_at IS NULL)))));
create policy "Users with event or finance permission can view event payments" on public.event_payments as permissive for select to authenticated using ((EXISTS ( SELECT 1
   FROM ((user_church_access uca
     JOIN role_permissions rp ON ((rp.role = uca.role)))
     JOIN permissions p ON ((p.id = rp.permission_id)))
  WHERE ((uca.profile_id = auth.uid()) AND (uca.church_id = event_payments.church_id) AND (uca.status = 'ACTIVE'::text) AND (uca.deleted_at IS NULL) AND (rp.status = 'ACTIVE'::text) AND (rp.deleted_at IS NULL) AND (p.key = ANY (ARRAY['events.manage'::text, 'finance.view'::text, 'finance.manage'::text])) AND (p.status = 'ACTIVE'::text) AND (p.deleted_at IS NULL)))));
create policy "Church users can view event registration items" on public.event_registration_items as permissive for select to authenticated using ((EXISTS ( SELECT 1
   FROM user_church_access uca
  WHERE ((uca.profile_id = auth.uid()) AND (uca.church_id = event_registration_items.church_id) AND (uca.status = 'ACTIVE'::text) AND (uca.deleted_at IS NULL)))));
create policy "Users with events manage permission can manage event registrati" on public.event_registration_items as permissive for all to authenticated using ((EXISTS ( SELECT 1
   FROM ((user_church_access uca
     JOIN role_permissions rp ON ((rp.role = uca.role)))
     JOIN permissions p ON ((p.id = rp.permission_id)))
  WHERE ((uca.profile_id = auth.uid()) AND (uca.church_id = event_registration_items.church_id) AND (uca.status = 'ACTIVE'::text) AND (uca.deleted_at IS NULL) AND (rp.status = 'ACTIVE'::text) AND (rp.deleted_at IS NULL) AND (p.key = 'events.manage'::text) AND (p.status = 'ACTIVE'::text) AND (p.deleted_at IS NULL))))) with check ((EXISTS ( SELECT 1
   FROM ((user_church_access uca
     JOIN role_permissions rp ON ((rp.role = uca.role)))
     JOIN permissions p ON ((p.id = rp.permission_id)))
  WHERE ((uca.profile_id = auth.uid()) AND (uca.church_id = event_registration_items.church_id) AND (uca.status = 'ACTIVE'::text) AND (uca.deleted_at IS NULL) AND (rp.status = 'ACTIVE'::text) AND (rp.deleted_at IS NULL) AND (p.key = 'events.manage'::text) AND (p.status = 'ACTIVE'::text) AND (p.deleted_at IS NULL)))));
create policy "Church users can view event registrations" on public.event_registrations as permissive for select to authenticated using ((EXISTS ( SELECT 1
   FROM user_church_access uca
  WHERE ((uca.profile_id = auth.uid()) AND (uca.church_id = event_registrations.church_id) AND (uca.status = 'ACTIVE'::text) AND (uca.deleted_at IS NULL)))));
create policy "Users with events manage permission can manage event registrati" on public.event_registrations as permissive for all to authenticated using ((EXISTS ( SELECT 1
   FROM ((user_church_access uca
     JOIN role_permissions rp ON ((rp.role = uca.role)))
     JOIN permissions p ON ((p.id = rp.permission_id)))
  WHERE ((uca.profile_id = auth.uid()) AND (uca.church_id = event_registrations.church_id) AND (uca.status = 'ACTIVE'::text) AND (uca.deleted_at IS NULL) AND (rp.status = 'ACTIVE'::text) AND (rp.deleted_at IS NULL) AND (p.key = 'events.manage'::text) AND (p.status = 'ACTIVE'::text) AND (p.deleted_at IS NULL))))) with check ((EXISTS ( SELECT 1
   FROM ((user_church_access uca
     JOIN role_permissions rp ON ((rp.role = uca.role)))
     JOIN permissions p ON ((p.id = rp.permission_id)))
  WHERE ((uca.profile_id = auth.uid()) AND (uca.church_id = event_registrations.church_id) AND (uca.status = 'ACTIVE'::text) AND (uca.deleted_at IS NULL) AND (rp.status = 'ACTIVE'::text) AND (rp.deleted_at IS NULL) AND (p.key = 'events.manage'::text) AND (p.status = 'ACTIVE'::text) AND (p.deleted_at IS NULL)))));
create policy "Church users can view events" on public.events as permissive for select to authenticated using ((EXISTS ( SELECT 1
   FROM user_church_access uca
  WHERE ((uca.profile_id = auth.uid()) AND (uca.church_id = events.church_id) AND (uca.status = 'ACTIVE'::text) AND (uca.deleted_at IS NULL)))));
create policy "Users with events manage permission can create events" on public.events as permissive for insert to authenticated with check ((EXISTS ( SELECT 1
   FROM ((user_church_access uca
     JOIN role_permissions rp ON ((rp.role = uca.role)))
     JOIN permissions p ON ((p.id = rp.permission_id)))
  WHERE ((uca.profile_id = auth.uid()) AND (uca.church_id = events.church_id) AND (uca.status = 'ACTIVE'::text) AND (uca.deleted_at IS NULL) AND (rp.status = 'ACTIVE'::text) AND (rp.deleted_at IS NULL) AND (p.key = 'events.manage'::text) AND (p.status = 'ACTIVE'::text) AND (p.deleted_at IS NULL)))));
create policy "Users with events manage permission can update events" on public.events as permissive for update to authenticated using ((EXISTS ( SELECT 1
   FROM ((user_church_access uca
     JOIN role_permissions rp ON ((rp.role = uca.role)))
     JOIN permissions p ON ((p.id = rp.permission_id)))
  WHERE ((uca.profile_id = auth.uid()) AND (uca.church_id = events.church_id) AND (uca.status = 'ACTIVE'::text) AND (uca.deleted_at IS NULL) AND (rp.status = 'ACTIVE'::text) AND (rp.deleted_at IS NULL) AND (p.key = 'events.manage'::text) AND (p.status = 'ACTIVE'::text) AND (p.deleted_at IS NULL))))) with check ((EXISTS ( SELECT 1
   FROM ((user_church_access uca
     JOIN role_permissions rp ON ((rp.role = uca.role)))
     JOIN permissions p ON ((p.id = rp.permission_id)))
  WHERE ((uca.profile_id = auth.uid()) AND (uca.church_id = events.church_id) AND (uca.status = 'ACTIVE'::text) AND (uca.deleted_at IS NULL) AND (rp.status = 'ACTIVE'::text) AND (rp.deleted_at IS NULL) AND (p.key = 'events.manage'::text) AND (p.status = 'ACTIVE'::text) AND (p.deleted_at IS NULL)))));
create policy "Church users can view financial cashboxes" on public.financial_cashboxes as permissive for select to authenticated using (((status = 'ACTIVE'::text) AND (deleted_at IS NULL) AND (EXISTS ( SELECT 1
   FROM user_church_access uca
  WHERE ((uca.profile_id = auth.uid()) AND (uca.church_id = financial_cashboxes.church_id) AND (uca.status = 'ACTIVE'::text) AND (uca.deleted_at IS NULL))))));
create policy "Users with finance manage permission can manage financial cashb" on public.financial_cashboxes as permissive for all to authenticated using ((EXISTS ( SELECT 1
   FROM ((user_church_access uca
     JOIN role_permissions rp ON ((rp.role = uca.role)))
     JOIN permissions p ON ((p.id = rp.permission_id)))
  WHERE ((uca.profile_id = auth.uid()) AND (uca.church_id = financial_cashboxes.church_id) AND (uca.status = 'ACTIVE'::text) AND (uca.deleted_at IS NULL) AND (rp.status = 'ACTIVE'::text) AND (rp.deleted_at IS NULL) AND (p.key = 'finance.manage'::text) AND (p.status = 'ACTIVE'::text) AND (p.deleted_at IS NULL))))) with check ((EXISTS ( SELECT 1
   FROM ((user_church_access uca
     JOIN role_permissions rp ON ((rp.role = uca.role)))
     JOIN permissions p ON ((p.id = rp.permission_id)))
  WHERE ((uca.profile_id = auth.uid()) AND (uca.church_id = financial_cashboxes.church_id) AND (uca.status = 'ACTIVE'::text) AND (uca.deleted_at IS NULL) AND (rp.status = 'ACTIVE'::text) AND (rp.deleted_at IS NULL) AND (p.key = 'finance.manage'::text) AND (p.status = 'ACTIVE'::text) AND (p.deleted_at IS NULL)))));
create policy "Church users can view financial categories" on public.financial_categories as permissive for select to authenticated using (((status = 'ACTIVE'::text) AND (deleted_at IS NULL) AND (EXISTS ( SELECT 1
   FROM user_church_access uca
  WHERE ((uca.profile_id = auth.uid()) AND (uca.church_id = financial_categories.church_id) AND (uca.status = 'ACTIVE'::text) AND (uca.deleted_at IS NULL))))));
create policy "Users with finance manage permission can manage financial categ" on public.financial_categories as permissive for all to authenticated using ((EXISTS ( SELECT 1
   FROM ((user_church_access uca
     JOIN role_permissions rp ON ((rp.role = uca.role)))
     JOIN permissions p ON ((p.id = rp.permission_id)))
  WHERE ((uca.profile_id = auth.uid()) AND (uca.church_id = financial_categories.church_id) AND (uca.status = 'ACTIVE'::text) AND (uca.deleted_at IS NULL) AND (rp.status = 'ACTIVE'::text) AND (rp.deleted_at IS NULL) AND (p.key = 'finance.manage'::text) AND (p.status = 'ACTIVE'::text) AND (p.deleted_at IS NULL))))) with check ((EXISTS ( SELECT 1
   FROM ((user_church_access uca
     JOIN role_permissions rp ON ((rp.role = uca.role)))
     JOIN permissions p ON ((p.id = rp.permission_id)))
  WHERE ((uca.profile_id = auth.uid()) AND (uca.church_id = financial_categories.church_id) AND (uca.status = 'ACTIVE'::text) AND (uca.deleted_at IS NULL) AND (rp.status = 'ACTIVE'::text) AND (rp.deleted_at IS NULL) AND (p.key = 'finance.manage'::text) AND (p.status = 'ACTIVE'::text) AND (p.deleted_at IS NULL)))));
create policy "Church users can view financial departments" on public.financial_departments as permissive for select to authenticated using (((status = 'ACTIVE'::text) AND (deleted_at IS NULL) AND (EXISTS ( SELECT 1
   FROM user_church_access uca
  WHERE ((uca.profile_id = auth.uid()) AND (uca.church_id = financial_departments.church_id) AND (uca.status = 'ACTIVE'::text) AND (uca.deleted_at IS NULL))))));
create policy "Users with finance manage permission can manage financial depar" on public.financial_departments as permissive for all to authenticated using ((EXISTS ( SELECT 1
   FROM ((user_church_access uca
     JOIN role_permissions rp ON ((rp.role = uca.role)))
     JOIN permissions p ON ((p.id = rp.permission_id)))
  WHERE ((uca.profile_id = auth.uid()) AND (uca.church_id = financial_departments.church_id) AND (uca.status = 'ACTIVE'::text) AND (uca.deleted_at IS NULL) AND (rp.status = 'ACTIVE'::text) AND (rp.deleted_at IS NULL) AND (p.key = 'finance.manage'::text) AND (p.status = 'ACTIVE'::text) AND (p.deleted_at IS NULL))))) with check ((EXISTS ( SELECT 1
   FROM ((user_church_access uca
     JOIN role_permissions rp ON ((rp.role = uca.role)))
     JOIN permissions p ON ((p.id = rp.permission_id)))
  WHERE ((uca.profile_id = auth.uid()) AND (uca.church_id = financial_departments.church_id) AND (uca.status = 'ACTIVE'::text) AND (uca.deleted_at IS NULL) AND (rp.status = 'ACTIVE'::text) AND (rp.deleted_at IS NULL) AND (p.key = 'finance.manage'::text) AND (p.status = 'ACTIVE'::text) AND (p.deleted_at IS NULL)))));
create policy "Users with finance manage permission can manage financial docum" on public.financial_documents as permissive for all to authenticated using ((EXISTS ( SELECT 1
   FROM ((user_church_access uca
     JOIN role_permissions rp ON ((rp.role = uca.role)))
     JOIN permissions p ON ((p.id = rp.permission_id)))
  WHERE ((uca.profile_id = auth.uid()) AND (uca.church_id = financial_documents.church_id) AND (uca.status = 'ACTIVE'::text) AND (uca.deleted_at IS NULL) AND (rp.status = 'ACTIVE'::text) AND (rp.deleted_at IS NULL) AND (p.key = 'finance.manage'::text) AND (p.status = 'ACTIVE'::text) AND (p.deleted_at IS NULL))))) with check ((EXISTS ( SELECT 1
   FROM ((user_church_access uca
     JOIN role_permissions rp ON ((rp.role = uca.role)))
     JOIN permissions p ON ((p.id = rp.permission_id)))
  WHERE ((uca.profile_id = auth.uid()) AND (uca.church_id = financial_documents.church_id) AND (uca.status = 'ACTIVE'::text) AND (uca.deleted_at IS NULL) AND (rp.status = 'ACTIVE'::text) AND (rp.deleted_at IS NULL) AND (p.key = 'finance.manage'::text) AND (p.status = 'ACTIVE'::text) AND (p.deleted_at IS NULL)))));
create policy "Users with finance permission can view financial documents" on public.financial_documents as permissive for select to authenticated using (((deleted_at IS NULL) AND (status = 'ACTIVE'::text) AND (EXISTS ( SELECT 1
   FROM ((user_church_access uca
     JOIN role_permissions rp ON ((rp.role = uca.role)))
     JOIN permissions p ON ((p.id = rp.permission_id)))
  WHERE ((uca.profile_id = auth.uid()) AND (uca.church_id = financial_documents.church_id) AND (uca.status = 'ACTIVE'::text) AND (uca.deleted_at IS NULL) AND (rp.status = 'ACTIVE'::text) AND (rp.deleted_at IS NULL) AND (p.key = ANY (ARRAY['finance.view'::text, 'finance.manage'::text])) AND (p.status = 'ACTIVE'::text) AND (p.deleted_at IS NULL))))));
create policy "Church users can view financial payment methods" on public.financial_payment_methods as permissive for select to authenticated using (((status = 'ACTIVE'::text) AND (deleted_at IS NULL) AND (EXISTS ( SELECT 1
   FROM user_church_access uca
  WHERE ((uca.profile_id = auth.uid()) AND (uca.church_id = financial_payment_methods.church_id) AND (uca.status = 'ACTIVE'::text) AND (uca.deleted_at IS NULL))))));
create policy "Users with finance manage permission can manage financial payme" on public.financial_payment_methods as permissive for all to authenticated using ((EXISTS ( SELECT 1
   FROM ((user_church_access uca
     JOIN role_permissions rp ON ((rp.role = uca.role)))
     JOIN permissions p ON ((p.id = rp.permission_id)))
  WHERE ((uca.profile_id = auth.uid()) AND (uca.church_id = financial_payment_methods.church_id) AND (uca.status = 'ACTIVE'::text) AND (uca.deleted_at IS NULL) AND (rp.status = 'ACTIVE'::text) AND (rp.deleted_at IS NULL) AND (p.key = 'finance.manage'::text) AND (p.status = 'ACTIVE'::text) AND (p.deleted_at IS NULL))))) with check ((EXISTS ( SELECT 1
   FROM ((user_church_access uca
     JOIN role_permissions rp ON ((rp.role = uca.role)))
     JOIN permissions p ON ((p.id = rp.permission_id)))
  WHERE ((uca.profile_id = auth.uid()) AND (uca.church_id = financial_payment_methods.church_id) AND (uca.status = 'ACTIVE'::text) AND (uca.deleted_at IS NULL) AND (rp.status = 'ACTIVE'::text) AND (rp.deleted_at IS NULL) AND (p.key = 'finance.manage'::text) AND (p.status = 'ACTIVE'::text) AND (p.deleted_at IS NULL)))));
create policy "Users with finance manage permission can manage financial recei" on public.financial_receipts as permissive for all to authenticated using ((EXISTS ( SELECT 1
   FROM ((user_church_access uca
     JOIN role_permissions rp ON ((rp.role = uca.role)))
     JOIN permissions p ON ((p.id = rp.permission_id)))
  WHERE ((uca.profile_id = auth.uid()) AND (uca.church_id = financial_receipts.church_id) AND (uca.status = 'ACTIVE'::text) AND (uca.deleted_at IS NULL) AND (rp.status = 'ACTIVE'::text) AND (rp.deleted_at IS NULL) AND (p.key = 'finance.manage'::text) AND (p.status = 'ACTIVE'::text) AND (p.deleted_at IS NULL))))) with check ((EXISTS ( SELECT 1
   FROM ((user_church_access uca
     JOIN role_permissions rp ON ((rp.role = uca.role)))
     JOIN permissions p ON ((p.id = rp.permission_id)))
  WHERE ((uca.profile_id = auth.uid()) AND (uca.church_id = financial_receipts.church_id) AND (uca.status = 'ACTIVE'::text) AND (uca.deleted_at IS NULL) AND (rp.status = 'ACTIVE'::text) AND (rp.deleted_at IS NULL) AND (p.key = 'finance.manage'::text) AND (p.status = 'ACTIVE'::text) AND (p.deleted_at IS NULL)))));
create policy "Users with finance permission can view financial receipts" on public.financial_receipts as permissive for select to authenticated using (((deleted_at IS NULL) AND (EXISTS ( SELECT 1
   FROM ((user_church_access uca
     JOIN role_permissions rp ON ((rp.role = uca.role)))
     JOIN permissions p ON ((p.id = rp.permission_id)))
  WHERE ((uca.profile_id = auth.uid()) AND (uca.church_id = financial_receipts.church_id) AND (uca.status = 'ACTIVE'::text) AND (uca.deleted_at IS NULL) AND (rp.status = 'ACTIVE'::text) AND (rp.deleted_at IS NULL) AND (p.key = ANY (ARRAY['finance.view'::text, 'finance.manage'::text])) AND (p.status = 'ACTIVE'::text) AND (p.deleted_at IS NULL))))));
create policy "Users with finance manage permission can create financial trans" on public.financial_transactions as permissive for insert to authenticated with check ((EXISTS ( SELECT 1
   FROM ((user_church_access uca
     JOIN role_permissions rp ON ((rp.role = uca.role)))
     JOIN permissions p ON ((p.id = rp.permission_id)))
  WHERE ((uca.profile_id = auth.uid()) AND (uca.church_id = financial_transactions.church_id) AND (uca.status = 'ACTIVE'::text) AND (uca.deleted_at IS NULL) AND (rp.status = 'ACTIVE'::text) AND (rp.deleted_at IS NULL) AND (p.key = 'finance.manage'::text) AND (p.status = 'ACTIVE'::text) AND (p.deleted_at IS NULL)))));
create policy "Users with finance manage permission can update financial trans" on public.financial_transactions as permissive for update to authenticated using ((EXISTS ( SELECT 1
   FROM ((user_church_access uca
     JOIN role_permissions rp ON ((rp.role = uca.role)))
     JOIN permissions p ON ((p.id = rp.permission_id)))
  WHERE ((uca.profile_id = auth.uid()) AND (uca.church_id = financial_transactions.church_id) AND (uca.status = 'ACTIVE'::text) AND (uca.deleted_at IS NULL) AND (rp.status = 'ACTIVE'::text) AND (rp.deleted_at IS NULL) AND (p.key = 'finance.manage'::text) AND (p.status = 'ACTIVE'::text) AND (p.deleted_at IS NULL))))) with check ((EXISTS ( SELECT 1
   FROM ((user_church_access uca
     JOIN role_permissions rp ON ((rp.role = uca.role)))
     JOIN permissions p ON ((p.id = rp.permission_id)))
  WHERE ((uca.profile_id = auth.uid()) AND (uca.church_id = financial_transactions.church_id) AND (uca.status = 'ACTIVE'::text) AND (uca.deleted_at IS NULL) AND (rp.status = 'ACTIVE'::text) AND (rp.deleted_at IS NULL) AND (p.key = 'finance.manage'::text) AND (p.status = 'ACTIVE'::text) AND (p.deleted_at IS NULL)))));
create policy "Users with finance permission can view financial transactions" on public.financial_transactions as permissive for select to authenticated using (((deleted_at IS NULL) AND (EXISTS ( SELECT 1
   FROM ((user_church_access uca
     JOIN role_permissions rp ON ((rp.role = uca.role)))
     JOIN permissions p ON ((p.id = rp.permission_id)))
  WHERE ((uca.profile_id = auth.uid()) AND (uca.church_id = financial_transactions.church_id) AND (uca.status = 'ACTIVE'::text) AND (uca.deleted_at IS NULL) AND (rp.status = 'ACTIVE'::text) AND (rp.deleted_at IS NULL) AND (p.key = ANY (ARRAY['finance.view'::text, 'finance.manage'::text])) AND (p.status = 'ACTIVE'::text) AND (p.deleted_at IS NULL))))));
create policy member_documents_insert_scope on public.member_documents as permissive for insert to authenticated with check (((deleted_at IS NULL) AND ( SELECT has_permission(member_documents.church_id, 'members.manage_documents'::text) AS has_permission) AND (EXISTS ( SELECT 1
   FROM members member
  WHERE ((member.id = member_documents.member_id) AND (member.church_id = member_documents.church_id) AND ( SELECT can_access_member(member.church_id, member.id, member.congregation_id) AS can_access_member))))));
create policy member_documents_select_scope on public.member_documents as permissive for select to authenticated using (((EXISTS ( SELECT 1
   FROM members member
  WHERE ((member.id = member_documents.member_id) AND (member.church_id = member_documents.church_id) AND ( SELECT can_access_member(member.church_id, member.id, member.congregation_id) AS can_access_member)))) AND (((deleted_at IS NULL) AND (( SELECT has_permission(member_documents.church_id, 'members.view_full'::text) AS has_permission) OR ( SELECT has_permission(member_documents.church_id, 'members.manage_documents'::text) AS has_permission)) AND ((NOT is_sensitive) OR ( SELECT has_permission(member_documents.church_id, 'members.view_sensitive_documents'::text) AS has_permission))) OR ((deleted_at IS NOT NULL) AND ( SELECT has_permission(member_documents.church_id, 'members.manage_documents'::text) AS has_permission)))));
create policy member_documents_update_scope on public.member_documents as permissive for update to authenticated using (((deleted_at IS NULL) AND ( SELECT has_permission(member_documents.church_id, 'members.manage_documents'::text) AS has_permission) AND (EXISTS ( SELECT 1
   FROM members member
  WHERE ((member.id = member_documents.member_id) AND (member.church_id = member_documents.church_id) AND ( SELECT can_access_member(member.church_id, member.id, member.congregation_id) AS can_access_member)))))) with check ((( SELECT has_permission(member_documents.church_id, 'members.manage_documents'::text) AS has_permission) AND (EXISTS ( SELECT 1
   FROM members member
  WHERE ((member.id = member_documents.member_id) AND (member.church_id = member_documents.church_id) AND ( SELECT can_access_member(member.church_id, member.id, member.congregation_id) AS can_access_member))))));
create policy member_history_insert_scope on public.member_history as permissive for insert to authenticated with check (((deleted_at IS NULL) AND ( SELECT has_permission(member_history.church_id, 'member_history.create'::text) AS has_permission) AND ((NOT is_sensitive) OR ( SELECT has_permission(member_history.church_id, 'member_history.view_sensitive'::text) AS has_permission)) AND (EXISTS ( SELECT 1
   FROM members member
  WHERE ((member.id = member_history.member_id) AND (member.church_id = member_history.church_id) AND ( SELECT can_access_member(member.church_id, member.id, member.congregation_id) AS can_access_member))))));
create policy member_history_select_scope on public.member_history as permissive for select to authenticated using (((deleted_at IS NULL) AND ( SELECT has_permission(member_history.church_id, 'member_history.view'::text) AS has_permission) AND ((NOT is_sensitive) OR ( SELECT has_permission(member_history.church_id, 'member_history.view_sensitive'::text) AS has_permission)) AND (EXISTS ( SELECT 1
   FROM members member
  WHERE ((member.id = member_history.member_id) AND (member.church_id = member_history.church_id) AND ( SELECT can_access_member(member.church_id, member.id, member.congregation_id) AS can_access_member))))));
create policy member_ministries_insert_scope on public.member_ministries as permissive for insert to authenticated with check ((has_permission(church_id, 'ministries.manage'::text) AND (deleted_at IS NULL)));
create policy member_ministries_select_scope on public.member_ministries as permissive for select to authenticated using (((deleted_at IS NULL) AND has_permission(church_id, 'ministries.view'::text) AND (EXISTS ( SELECT 1
   FROM members m
  WHERE ((m.id = member_ministries.member_id) AND can_access_member(m.church_id, m.id, m.congregation_id))))));
create policy member_ministries_update_scope on public.member_ministries as permissive for update to authenticated using ((has_permission(church_id, 'ministries.manage'::text) AND (deleted_at IS NULL))) with check ((has_permission(church_id, 'ministries.manage'::text) AND (deleted_at IS NULL)));
create policy pastoral_notes_insert on public.member_pastoral_notes as permissive for insert to authenticated with check (((deleted_at IS NULL) AND ( SELECT has_permission(member_pastoral_notes.church_id, 'members.edit_pastoral_notes'::text) AS has_permission) AND (EXISTS ( SELECT 1
   FROM members member
  WHERE ((member.id = member_pastoral_notes.member_id) AND (member.church_id = member_pastoral_notes.church_id) AND ( SELECT can_access_member(member.church_id, member.id, member.congregation_id) AS can_access_member))))));
create policy pastoral_notes_select on public.member_pastoral_notes as permissive for select to authenticated using (((deleted_at IS NULL) AND ( SELECT has_permission(member_pastoral_notes.church_id, 'members.view_pastoral_notes'::text) AS has_permission) AND (EXISTS ( SELECT 1
   FROM members member
  WHERE ((member.id = member_pastoral_notes.member_id) AND (member.church_id = member_pastoral_notes.church_id) AND ( SELECT can_access_member(member.church_id, member.id, member.congregation_id) AS can_access_member))))));
create policy pastoral_notes_update on public.member_pastoral_notes as permissive for update to authenticated using (( SELECT has_permission(member_pastoral_notes.church_id, 'members.edit_pastoral_notes'::text) AS has_permission)) with check ((( SELECT has_permission(member_pastoral_notes.church_id, 'members.edit_pastoral_notes'::text) AS has_permission) AND (EXISTS ( SELECT 1
   FROM members member
  WHERE ((member.id = member_pastoral_notes.member_id) AND (member.church_id = member_pastoral_notes.church_id) AND ( SELECT can_access_member(member.church_id, member.id, member.congregation_id) AS can_access_member))))));
create policy member_roles_insert_scope on public.member_roles as permissive for insert to authenticated with check (((deleted_at IS NULL) AND ( SELECT has_permission(member_roles.church_id, 'member_roles.manage'::text) AS has_permission) AND (EXISTS ( SELECT 1
   FROM members member
  WHERE ((member.id = member_roles.member_id) AND (member.church_id = member_roles.church_id) AND ( SELECT can_access_member(member.church_id, member.id, member.congregation_id) AS can_access_member))))));
create policy member_roles_select_scope on public.member_roles as permissive for select to authenticated using (((deleted_at IS NULL) AND ( SELECT has_permission(member_roles.church_id, 'member_roles.view'::text) AS has_permission) AND (EXISTS ( SELECT 1
   FROM members member
  WHERE ((member.id = member_roles.member_id) AND (member.church_id = member_roles.church_id) AND ( SELECT can_access_member(member.church_id, member.id, member.congregation_id) AS can_access_member))))));
create policy member_roles_update_scope on public.member_roles as permissive for update to authenticated using (((deleted_at IS NULL) AND ( SELECT has_permission(member_roles.church_id, 'member_roles.manage'::text) AS has_permission))) with check ((( SELECT has_permission(member_roles.church_id, 'member_roles.manage'::text) AS has_permission) AND (EXISTS ( SELECT 1
   FROM members member
  WHERE ((member.id = member_roles.member_id) AND (member.church_id = member_roles.church_id) AND ( SELECT can_access_member(member.church_id, member.id, member.congregation_id) AS can_access_member))))));
create policy member_sensitive_insert on public.member_sensitive_identity as permissive for insert to authenticated with check (((deleted_at IS NULL) AND ( SELECT has_permission(member_sensitive_identity.church_id, 'members.manage_sensitive_identity'::text) AS has_permission) AND (EXISTS ( SELECT 1
   FROM members member
  WHERE ((member.id = member_sensitive_identity.member_id) AND (member.church_id = member_sensitive_identity.church_id) AND ( SELECT can_access_member(member.church_id, member.id, member.congregation_id) AS can_access_member))))));
create policy member_sensitive_select on public.member_sensitive_identity as permissive for select to authenticated using (((deleted_at IS NULL) AND ( SELECT has_permission(member_sensitive_identity.church_id, 'members.view_sensitive_identity'::text) AS has_permission) AND (EXISTS ( SELECT 1
   FROM members member
  WHERE ((member.id = member_sensitive_identity.member_id) AND (member.church_id = member_sensitive_identity.church_id) AND ( SELECT can_access_member(member.church_id, member.id, member.congregation_id) AS can_access_member))))));
create policy member_sensitive_update on public.member_sensitive_identity as permissive for update to authenticated using (( SELECT has_permission(member_sensitive_identity.church_id, 'members.manage_sensitive_identity'::text) AS has_permission)) with check ((( SELECT has_permission(member_sensitive_identity.church_id, 'members.manage_sensitive_identity'::text) AS has_permission) AND (EXISTS ( SELECT 1
   FROM members member
  WHERE ((member.id = member_sensitive_identity.member_id) AND (member.church_id = member_sensitive_identity.church_id) AND ( SELECT can_access_member(member.church_id, member.id, member.congregation_id) AS can_access_member))))));
create policy members_insert_scope on public.members as permissive for insert to authenticated with check (((deleted_at IS NULL) AND ( SELECT has_permission(members.church_id, 'members.create'::text) AS has_permission) AND ( SELECT can_access_congregation(members.church_id, members.congregation_id) AS can_access_congregation)));
create policy members_select_scope on public.members as permissive for select to authenticated using ((( SELECT can_access_member(members.church_id, members.id, members.congregation_id) AS can_access_member) AND (((deleted_at IS NULL) AND ( SELECT has_permission(members.church_id, 'members.view_basic'::text) AS has_permission)) OR ((deleted_at IS NOT NULL) AND ( SELECT has_permission(members.church_id, 'members.restore'::text) AS has_permission)))));
create policy members_update_scope on public.members as permissive for update to authenticated using (((deleted_at IS NULL) AND ( SELECT has_permission(members.church_id, 'members.update'::text) AS has_permission) AND ( SELECT can_access_member(members.church_id, members.id, members.congregation_id) AS can_access_member))) with check ((( SELECT has_permission(members.church_id, 'members.update'::text) AS has_permission) AND ( SELECT can_access_congregation(members.church_id, members.congregation_id) AS can_access_congregation)));
create policy ministries_insert_access on public.ministries as permissive for insert to authenticated with check ((has_permission(church_id, 'ministries.manage'::text) AND (deleted_at IS NULL)));
create policy ministries_select_access on public.ministries as permissive for select to authenticated using ((can_access_church(church_id) AND (deleted_at IS NULL)));
create policy ministries_update_access on public.ministries as permissive for update to authenticated using ((has_permission(church_id, 'ministries.manage'::text) AND (deleted_at IS NULL))) with check ((has_permission(church_id, 'ministries.manage'::text) AND (deleted_at IS NULL)));
create policy permissions_select_authenticated on public.permissions as permissive for select to authenticated using (((status = 'ACTIVE'::text) AND (deleted_at IS NULL)));
create policy profiles_select_authorized on public.profiles as permissive for select to authenticated using (((id = auth.uid()) OR (EXISTS ( SELECT 1
   FROM user_church_access target
  WHERE ((target.profile_id = profiles.id) AND (target.deleted_at IS NULL) AND has_permission(target.church_id, 'users.view'::text))))));
create policy profiles_update_self on public.profiles as permissive for update to authenticated using (((id = auth.uid()) AND (deleted_at IS NULL))) with check (((id = auth.uid()) AND (deleted_at IS NULL)));
create policy regions_insert on public.regions as permissive for insert to authenticated with check (((deleted_at IS NULL) AND ( SELECT has_permission(regions.church_id, 'regions.manage'::text) AS has_permission) AND ( SELECT private.is_church_admin(regions.church_id) AS is_church_admin)));
create policy regions_select_scope on public.regions as permissive for select to authenticated using (((deleted_at IS NULL) AND ( SELECT has_permission(regions.church_id, 'organization.view'::text) AS has_permission) AND ( SELECT can_access_region(regions.church_id, regions.id) AS can_access_region)));
create policy regions_update on public.regions as permissive for update to authenticated using (((deleted_at IS NULL) AND ( SELECT has_permission(regions.church_id, 'regions.manage'::text) AS has_permission) AND ( SELECT private.is_church_admin(regions.church_id) AS is_church_admin))) with check ((( SELECT has_permission(regions.church_id, 'regions.manage'::text) AS has_permission) AND ( SELECT private.is_church_admin(regions.church_id) AS is_church_admin)));
create policy "Users with finance manage permission can manage report deliveri" on public.report_deliveries as permissive for all to authenticated using ((EXISTS ( SELECT 1
   FROM ((user_church_access uca
     JOIN role_permissions rp ON ((rp.role = uca.role)))
     JOIN permissions p ON ((p.id = rp.permission_id)))
  WHERE ((uca.profile_id = auth.uid()) AND (uca.church_id = report_deliveries.church_id) AND (uca.status = 'ACTIVE'::text) AND (uca.deleted_at IS NULL) AND (rp.status = 'ACTIVE'::text) AND (rp.deleted_at IS NULL) AND (p.key = 'finance.manage'::text) AND (p.status = 'ACTIVE'::text) AND (p.deleted_at IS NULL))))) with check ((EXISTS ( SELECT 1
   FROM ((user_church_access uca
     JOIN role_permissions rp ON ((rp.role = uca.role)))
     JOIN permissions p ON ((p.id = rp.permission_id)))
  WHERE ((uca.profile_id = auth.uid()) AND (uca.church_id = report_deliveries.church_id) AND (uca.status = 'ACTIVE'::text) AND (uca.deleted_at IS NULL) AND (rp.status = 'ACTIVE'::text) AND (rp.deleted_at IS NULL) AND (p.key = 'finance.manage'::text) AND (p.status = 'ACTIVE'::text) AND (p.deleted_at IS NULL)))));
create policy "Users with finance permission can view report deliveries" on public.report_deliveries as permissive for select to authenticated using (((deleted_at IS NULL) AND (EXISTS ( SELECT 1
   FROM ((user_church_access uca
     JOIN role_permissions rp ON ((rp.role = uca.role)))
     JOIN permissions p ON ((p.id = rp.permission_id)))
  WHERE ((uca.profile_id = auth.uid()) AND (uca.church_id = report_deliveries.church_id) AND (uca.status = 'ACTIVE'::text) AND (uca.deleted_at IS NULL) AND (rp.status = 'ACTIVE'::text) AND (rp.deleted_at IS NULL) AND (p.key = ANY (ARRAY['finance.view'::text, 'finance.manage'::text])) AND (p.status = 'ACTIVE'::text) AND (p.deleted_at IS NULL))))));
create policy "Users with finance manage permission can manage report delivery" on public.report_delivery_items as permissive for all to authenticated using ((EXISTS ( SELECT 1
   FROM ((user_church_access uca
     JOIN role_permissions rp ON ((rp.role = uca.role)))
     JOIN permissions p ON ((p.id = rp.permission_id)))
  WHERE ((uca.profile_id = auth.uid()) AND (uca.church_id = report_delivery_items.church_id) AND (uca.status = 'ACTIVE'::text) AND (uca.deleted_at IS NULL) AND (rp.status = 'ACTIVE'::text) AND (rp.deleted_at IS NULL) AND (p.key = 'finance.manage'::text) AND (p.status = 'ACTIVE'::text) AND (p.deleted_at IS NULL))))) with check ((EXISTS ( SELECT 1
   FROM ((user_church_access uca
     JOIN role_permissions rp ON ((rp.role = uca.role)))
     JOIN permissions p ON ((p.id = rp.permission_id)))
  WHERE ((uca.profile_id = auth.uid()) AND (uca.church_id = report_delivery_items.church_id) AND (uca.status = 'ACTIVE'::text) AND (uca.deleted_at IS NULL) AND (rp.status = 'ACTIVE'::text) AND (rp.deleted_at IS NULL) AND (p.key = 'finance.manage'::text) AND (p.status = 'ACTIVE'::text) AND (p.deleted_at IS NULL)))));
create policy "Users with finance permission can view report delivery items" on public.report_delivery_items as permissive for select to authenticated using (((deleted_at IS NULL) AND (EXISTS ( SELECT 1
   FROM ((user_church_access uca
     JOIN role_permissions rp ON ((rp.role = uca.role)))
     JOIN permissions p ON ((p.id = rp.permission_id)))
  WHERE ((uca.profile_id = auth.uid()) AND (uca.church_id = report_delivery_items.church_id) AND (uca.status = 'ACTIVE'::text) AND (uca.deleted_at IS NULL) AND (rp.status = 'ACTIVE'::text) AND (rp.deleted_at IS NULL) AND (p.key = ANY (ARRAY['finance.view'::text, 'finance.manage'::text])) AND (p.status = 'ACTIVE'::text) AND (p.deleted_at IS NULL))))));
create policy "Users with finance manage permission can manage report delivery" on public.report_delivery_rules as permissive for all to authenticated using ((EXISTS ( SELECT 1
   FROM ((user_church_access uca
     JOIN role_permissions rp ON ((rp.role = uca.role)))
     JOIN permissions p ON ((p.id = rp.permission_id)))
  WHERE ((uca.profile_id = auth.uid()) AND (uca.church_id = report_delivery_rules.church_id) AND (uca.status = 'ACTIVE'::text) AND (uca.deleted_at IS NULL) AND (rp.status = 'ACTIVE'::text) AND (rp.deleted_at IS NULL) AND (p.key = 'finance.manage'::text) AND (p.status = 'ACTIVE'::text) AND (p.deleted_at IS NULL))))) with check ((EXISTS ( SELECT 1
   FROM ((user_church_access uca
     JOIN role_permissions rp ON ((rp.role = uca.role)))
     JOIN permissions p ON ((p.id = rp.permission_id)))
  WHERE ((uca.profile_id = auth.uid()) AND (uca.church_id = report_delivery_rules.church_id) AND (uca.status = 'ACTIVE'::text) AND (uca.deleted_at IS NULL) AND (rp.status = 'ACTIVE'::text) AND (rp.deleted_at IS NULL) AND (p.key = 'finance.manage'::text) AND (p.status = 'ACTIVE'::text) AND (p.deleted_at IS NULL)))));
create policy "Users with finance permission can view report delivery rules" on public.report_delivery_rules as permissive for select to authenticated using (((deleted_at IS NULL) AND (EXISTS ( SELECT 1
   FROM ((user_church_access uca
     JOIN role_permissions rp ON ((rp.role = uca.role)))
     JOIN permissions p ON ((p.id = rp.permission_id)))
  WHERE ((uca.profile_id = auth.uid()) AND (uca.church_id = report_delivery_rules.church_id) AND (uca.status = 'ACTIVE'::text) AND (uca.deleted_at IS NULL) AND (rp.status = 'ACTIVE'::text) AND (rp.deleted_at IS NULL) AND (p.key = ANY (ARRAY['finance.view'::text, 'finance.manage'::text])) AND (p.status = 'ACTIVE'::text) AND (p.deleted_at IS NULL))))));
create policy role_permissions_select_authenticated on public.role_permissions as permissive for select to authenticated using (((status = 'ACTIVE'::text) AND (deleted_at IS NULL)));
create policy roles_insert_access on public.roles as permissive for insert to authenticated with check (((deleted_at IS NULL) AND ( SELECT has_permission(roles.church_id, 'positions.manage'::text) AS has_permission) AND ( SELECT private.is_church_admin(roles.church_id) AS is_church_admin)));
create policy roles_select_access on public.roles as permissive for select to authenticated using (((deleted_at IS NULL) AND ( SELECT can_access_church(roles.church_id) AS can_access_church) AND (( SELECT has_permission(roles.church_id, 'organization.view'::text) AS has_permission) OR ( SELECT has_permission(roles.church_id, 'members.view_basic'::text) AS has_permission) OR ( SELECT has_permission(roles.church_id, 'member_roles.view'::text) AS has_permission))));
create policy roles_update_access on public.roles as permissive for update to authenticated using (((deleted_at IS NULL) AND ( SELECT has_permission(roles.church_id, 'positions.manage'::text) AS has_permission) AND ( SELECT private.is_church_admin(roles.church_id) AS is_church_admin))) with check ((( SELECT has_permission(roles.church_id, 'positions.manage'::text) AS has_permission) AND ( SELECT private.is_church_admin(roles.church_id) AS is_church_admin)));
create policy access_select_authorized on public.user_church_access as permissive for select to authenticated using (((profile_id = auth.uid()) OR has_permission(church_id, 'users.view'::text)));
create policy access_update_authorized on public.user_church_access as permissive for update to authenticated using (has_permission(church_id, 'users.update_access'::text)) with check (has_permission(church_id, 'users.update_access'::text));
create policy overrides_select_authorized on public.user_permission_overrides as permissive for select to authenticated using (((deleted_at IS NULL) AND (EXISTS ( SELECT 1
   FROM user_church_access a
  WHERE ((a.id = user_permission_overrides.access_id) AND ((a.profile_id = auth.uid()) OR has_permission(a.church_id, 'users.view'::text)))))));

-- Source: remote migration 20260808000731_trial_clone_privileges
grant usage on schema public to anon, authenticated, service_role;
revoke all on schema private from public, anon, authenticated;
grant usage on schema private to service_role;
revoke all on table public.accounts_payable from public, anon, authenticated, service_role;
revoke all on table public.app_settings from public, anon, authenticated, service_role;
revoke all on table public.audit_logs from public, anon, authenticated, service_role;
revoke all on table public.church_invitations from public, anon, authenticated, service_role;
revoke all on table public.churches from public, anon, authenticated, service_role;
revoke all on table public.congregation_documents from public, anon, authenticated, service_role;
revoke all on table public.congregations from public, anon, authenticated, service_role;
revoke all on table public.event_checkins from public, anon, authenticated, service_role;
revoke all on table public.event_congregation_quotas from public, anon, authenticated, service_role;
revoke all on table public.event_documents from public, anon, authenticated, service_role;
revoke all on table public.event_groups from public, anon, authenticated, service_role;
revoke all on table public.event_items from public, anon, authenticated, service_role;
revoke all on table public.event_payments from public, anon, authenticated, service_role;
revoke all on table public.event_registration_items from public, anon, authenticated, service_role;
revoke all on table public.event_registrations from public, anon, authenticated, service_role;
revoke all on table public.events from public, anon, authenticated, service_role;
revoke all on table public.financial_cashboxes from public, anon, authenticated, service_role;
revoke all on table public.financial_categories from public, anon, authenticated, service_role;
revoke all on table public.financial_departments from public, anon, authenticated, service_role;
revoke all on table public.financial_documents from public, anon, authenticated, service_role;
revoke all on table public.financial_payment_methods from public, anon, authenticated, service_role;
revoke all on table public.financial_receipts from public, anon, authenticated, service_role;
revoke all on table public.financial_transactions from public, anon, authenticated, service_role;
revoke all on table public.member_documents from public, anon, authenticated, service_role;
revoke all on table public.member_history from public, anon, authenticated, service_role;
revoke all on table public.member_ministries from public, anon, authenticated, service_role;
revoke all on table public.member_pastoral_notes from public, anon, authenticated, service_role;
revoke all on table public.member_roles from public, anon, authenticated, service_role;
revoke all on table public.member_sensitive_identity from public, anon, authenticated, service_role;
revoke all on table public.members from public, anon, authenticated, service_role;
revoke all on table public.ministries from public, anon, authenticated, service_role;
revoke all on table public.permissions from public, anon, authenticated, service_role;
revoke all on table public.profiles from public, anon, authenticated, service_role;
revoke all on table public.regions from public, anon, authenticated, service_role;
revoke all on table public.report_deliveries from public, anon, authenticated, service_role;
revoke all on table public.report_delivery_items from public, anon, authenticated, service_role;
revoke all on table public.report_delivery_rules from public, anon, authenticated, service_role;
revoke all on table public.role_permissions from public, anon, authenticated, service_role;
revoke all on table public.roles from public, anon, authenticated, service_role;
revoke all on table public.user_church_access from public, anon, authenticated, service_role;
revoke all on table public.user_permission_overrides from public, anon, authenticated, service_role;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.accounts_payable to anon;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.accounts_payable to authenticated;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.accounts_payable to service_role;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.app_settings to anon;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.app_settings to authenticated;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.app_settings to service_role;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.audit_logs to anon;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.audit_logs to authenticated;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.audit_logs to service_role;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.church_invitations to anon;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.church_invitations to authenticated;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.church_invitations to service_role;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.churches to anon;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.churches to authenticated;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.churches to service_role;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.congregation_documents to anon;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.congregation_documents to service_role;
grant INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.congregation_documents to authenticated;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.congregations to anon;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.congregations to service_role;
grant INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.congregations to authenticated;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.event_checkins to anon;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.event_checkins to authenticated;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.event_checkins to service_role;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.event_congregation_quotas to anon;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.event_congregation_quotas to authenticated;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.event_congregation_quotas to service_role;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.event_documents to anon;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.event_documents to authenticated;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.event_documents to service_role;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.event_groups to anon;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.event_groups to authenticated;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.event_groups to service_role;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.event_items to anon;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.event_items to authenticated;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.event_items to service_role;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.event_payments to anon;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.event_payments to authenticated;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.event_payments to service_role;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.event_registration_items to anon;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.event_registration_items to authenticated;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.event_registration_items to service_role;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.event_registrations to anon;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.event_registrations to authenticated;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.event_registrations to service_role;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.events to anon;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.events to authenticated;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.events to service_role;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.financial_cashboxes to anon;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.financial_cashboxes to authenticated;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.financial_cashboxes to service_role;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.financial_categories to anon;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.financial_categories to authenticated;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.financial_categories to service_role;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.financial_departments to anon;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.financial_departments to authenticated;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.financial_departments to service_role;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.financial_documents to anon;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.financial_documents to authenticated;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.financial_documents to service_role;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.financial_payment_methods to anon;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.financial_payment_methods to authenticated;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.financial_payment_methods to service_role;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.financial_receipts to anon;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.financial_receipts to authenticated;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.financial_receipts to service_role;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.financial_transactions to anon;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.financial_transactions to authenticated;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.financial_transactions to service_role;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.member_documents to authenticated;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.member_documents to service_role;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.member_history to authenticated;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.member_history to service_role;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.member_ministries to anon;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.member_ministries to authenticated;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.member_ministries to service_role;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.member_pastoral_notes to authenticated;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.member_pastoral_notes to service_role;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.member_roles to authenticated;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.member_roles to service_role;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.member_sensitive_identity to authenticated;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.member_sensitive_identity to service_role;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.members to authenticated;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.members to service_role;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.ministries to anon;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.ministries to authenticated;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.ministries to service_role;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.permissions to anon;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.permissions to authenticated;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.permissions to service_role;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE on table public.profiles to authenticated;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.profiles to anon;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.profiles to service_role;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.regions to anon;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.regions to service_role;
grant INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.regions to authenticated;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.report_deliveries to anon;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.report_deliveries to authenticated;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.report_deliveries to service_role;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.report_delivery_items to anon;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.report_delivery_items to authenticated;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.report_delivery_items to service_role;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.report_delivery_rules to anon;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.report_delivery_rules to authenticated;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.report_delivery_rules to service_role;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.role_permissions to anon;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.role_permissions to authenticated;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.role_permissions to service_role;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.roles to anon;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.roles to service_role;
grant INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.roles to authenticated;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.user_church_access to anon;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.user_church_access to authenticated;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.user_church_access to service_role;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.user_permission_overrides to anon;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.user_permission_overrides to authenticated;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.user_permission_overrides to service_role;
revoke all on function private.audit_congregation_document_mutation() from public, anon, authenticated, service_role;
revoke all on function private.audit_congregation_mutation() from public, anon, authenticated, service_role;
revoke all on function private.audit_region_mutation() from public, anon, authenticated, service_role;
revoke all on function private.audit_role_mutation() from public, anon, authenticated, service_role;
revoke all on function private.count_congregation_dependencies(p_congregation_id uuid) from public, anon, authenticated, service_role;
revoke all on function private.is_church_admin(p_church_id uuid) from public, anon, authenticated, service_role;
revoke all on function private.protect_congregation_document_mutation() from public, anon, authenticated, service_role;
revoke all on function private.protect_congregation_documents_dependency() from public, anon, authenticated, service_role;
revoke all on function private.protect_congregation_mutation() from public, anon, authenticated, service_role;
revoke all on function private.protect_region_mutation() from public, anon, authenticated, service_role;
revoke all on function private.protect_role_mutation() from public, anon, authenticated, service_role;
revoke all on function public.accept_church_invitation(p_token text) from public, anon, authenticated, service_role;
revoke all on function public.audit_app_settings_update() from public, anon, authenticated, service_role;
revoke all on function public.audit_institution_update() from public, anon, authenticated, service_role;
revoke all on function public.audit_member_mutation() from public, anon, authenticated, service_role;
revoke all on function public.audit_pastoral_note_mutation() from public, anon, authenticated, service_role;
revoke all on function public.audit_sensitive_member_mutation() from public, anon, authenticated, service_role;
revoke all on function public.can_access_church(p_church_id uuid) from public, anon, authenticated, service_role;
revoke all on function public.can_access_congregation(p_church_id uuid, p_congregation_id uuid) from public, anon, authenticated, service_role;
revoke all on function public.can_access_member(p_church_id uuid, p_member_id uuid, p_congregation_id uuid) from public, anon, authenticated, service_role;
revoke all on function public.can_access_region(p_church_id uuid, p_region_id uuid) from public, anon, authenticated, service_role;
revoke all on function public.cancel_church_invitation(p_invitation_id uuid) from public, anon, authenticated, service_role;
revoke all on function public.change_member_lifecycle(p_member_id uuid, p_action text, p_event_date date, p_reason text, p_target_congregation_id uuid, p_destination_church text, p_end_roles boolean, p_sensitive boolean) from public, anon, authenticated, service_role;
revoke all on function public.complete_church_onboarding(p_payload jsonb) from public, anon, authenticated, service_role;
revoke all on function public.create_church_invitation(p_church_id uuid, p_name text, p_email text, p_role text, p_scope text, p_region_id uuid, p_congregation_id uuid, p_ministry_id uuid, p_notes text, p_permission_overrides jsonb) from public, anon, authenticated, service_role;
revoke all on function public.create_member_atomic(p_church_id uuid, p_payload jsonb) from public, anon, authenticated, service_role;
revoke all on function public.enrich_member_role_history() from public, anon, authenticated, service_role;
revoke all on function public.get_member_stats(p_church_id uuid) from public, anon, authenticated, service_role;
revoke all on function public.get_my_access_context(p_preferred_church_id uuid) from public, anon, authenticated, service_role;
revoke all on function public.get_my_permissions(p_church_id uuid) from public, anon, authenticated, service_role;
revoke all on function public.handle_new_auth_user() from public, anon, authenticated, service_role;
revoke all on function public.handle_new_user() from public, anon, authenticated, service_role;
revoke all on function public.has_permission(p_church_id uuid, p_permission_key text) from public, anon, authenticated, service_role;
revoke all on function public.is_valid_cpf(p_value text) from public, anon, authenticated, service_role;
revoke all on function public.log_audit(p_church_id uuid, p_module text, p_action text, p_entity_type text, p_entity_id uuid, p_entity_label text, p_description text, p_old_values jsonb, p_new_values jsonb, p_metadata jsonb, p_severity text) from public, anon, authenticated, service_role;
revoke all on function public.manage_member_role(p_member_id uuid, p_operation text, p_role_id uuid, p_link_id uuid, p_start_date date, p_end_date date, p_notes text, p_is_primary boolean) from public, anon, authenticated, service_role;
revoke all on function public.normalize_member_role_history_language() from public, anon, authenticated, service_role;
revoke all on function public.protect_last_church_admin() from public, anon, authenticated, service_role;
revoke all on function public.renew_church_invitation(p_invitation_id uuid) from public, anon, authenticated, service_role;
revoke all on function public.safe_uuid(p_value text) from public, anon, authenticated, service_role;
revoke all on function public.set_access_permission_override(p_access_id uuid, p_permission_key text, p_effect text) from public, anon, authenticated, service_role;
revoke all on function public.set_updated_at() from public, anon, authenticated, service_role;
revoke all on function public.touch_updated_at() from public, anon, authenticated, service_role;
revoke all on function public.update_church_access(p_access_id uuid, p_role text, p_scope text, p_status text, p_region_id uuid, p_congregation_id uuid, p_ministry_id uuid, p_notes text) from public, anon, authenticated, service_role;
revoke all on function public.update_member_atomic(p_member_id uuid, p_expected_updated_at timestamp with time zone, p_payload jsonb) from public, anon, authenticated, service_role;
revoke all on function public.validate_access_target_tenant() from public, anon, authenticated, service_role;
revoke all on function public.validate_congregation_tenant() from public, anon, authenticated, service_role;
revoke all on function public.validate_member_tenant() from public, anon, authenticated, service_role;
grant EXECUTE on function private.is_church_admin(p_church_id uuid) to authenticated;
grant EXECUTE on function public.accept_church_invitation(p_token text) to authenticated;
grant EXECUTE on function public.accept_church_invitation(p_token text) to service_role;
grant EXECUTE on function public.audit_app_settings_update() to service_role;
grant EXECUTE on function public.audit_institution_update() to service_role;
grant EXECUTE on function public.audit_member_mutation() to service_role;
grant EXECUTE on function public.audit_pastoral_note_mutation() to service_role;
grant EXECUTE on function public.audit_sensitive_member_mutation() to service_role;
grant EXECUTE on function public.can_access_church(p_church_id uuid) to authenticated;
grant EXECUTE on function public.can_access_church(p_church_id uuid) to service_role;
grant EXECUTE on function public.can_access_congregation(p_church_id uuid, p_congregation_id uuid) to authenticated;
grant EXECUTE on function public.can_access_congregation(p_church_id uuid, p_congregation_id uuid) to service_role;
grant EXECUTE on function public.can_access_member(p_church_id uuid, p_member_id uuid, p_congregation_id uuid) to authenticated;
grant EXECUTE on function public.can_access_member(p_church_id uuid, p_member_id uuid, p_congregation_id uuid) to service_role;
grant EXECUTE on function public.can_access_region(p_church_id uuid, p_region_id uuid) to authenticated;
grant EXECUTE on function public.can_access_region(p_church_id uuid, p_region_id uuid) to service_role;
grant EXECUTE on function public.cancel_church_invitation(p_invitation_id uuid) to authenticated;
grant EXECUTE on function public.cancel_church_invitation(p_invitation_id uuid) to service_role;
grant EXECUTE on function public.change_member_lifecycle(p_member_id uuid, p_action text, p_event_date date, p_reason text, p_target_congregation_id uuid, p_destination_church text, p_end_roles boolean, p_sensitive boolean) to authenticated;
grant EXECUTE on function public.change_member_lifecycle(p_member_id uuid, p_action text, p_event_date date, p_reason text, p_target_congregation_id uuid, p_destination_church text, p_end_roles boolean, p_sensitive boolean) to service_role;
grant EXECUTE on function public.complete_church_onboarding(p_payload jsonb) to authenticated;
grant EXECUTE on function public.complete_church_onboarding(p_payload jsonb) to service_role;
grant EXECUTE on function public.create_church_invitation(p_church_id uuid, p_name text, p_email text, p_role text, p_scope text, p_region_id uuid, p_congregation_id uuid, p_ministry_id uuid, p_notes text, p_permission_overrides jsonb) to authenticated;
grant EXECUTE on function public.create_church_invitation(p_church_id uuid, p_name text, p_email text, p_role text, p_scope text, p_region_id uuid, p_congregation_id uuid, p_ministry_id uuid, p_notes text, p_permission_overrides jsonb) to service_role;
grant EXECUTE on function public.create_member_atomic(p_church_id uuid, p_payload jsonb) to authenticated;
grant EXECUTE on function public.create_member_atomic(p_church_id uuid, p_payload jsonb) to service_role;
grant EXECUTE on function public.enrich_member_role_history() to service_role;
grant EXECUTE on function public.get_member_stats(p_church_id uuid) to authenticated;
grant EXECUTE on function public.get_member_stats(p_church_id uuid) to service_role;
grant EXECUTE on function public.get_my_access_context(p_preferred_church_id uuid) to authenticated;
grant EXECUTE on function public.get_my_access_context(p_preferred_church_id uuid) to service_role;
grant EXECUTE on function public.get_my_permissions(p_church_id uuid) to authenticated;
grant EXECUTE on function public.get_my_permissions(p_church_id uuid) to service_role;
grant EXECUTE on function public.handle_new_auth_user() to service_role;
grant EXECUTE on function public.handle_new_user() to service_role;
grant EXECUTE on function public.has_permission(p_church_id uuid, p_permission_key text) to authenticated;
grant EXECUTE on function public.has_permission(p_church_id uuid, p_permission_key text) to service_role;
grant EXECUTE on function public.is_valid_cpf(p_value text) to authenticated;
grant EXECUTE on function public.is_valid_cpf(p_value text) to service_role;
grant EXECUTE on function public.log_audit(p_church_id uuid, p_module text, p_action text, p_entity_type text, p_entity_id uuid, p_entity_label text, p_description text, p_old_values jsonb, p_new_values jsonb, p_metadata jsonb, p_severity text) to authenticated;
grant EXECUTE on function public.log_audit(p_church_id uuid, p_module text, p_action text, p_entity_type text, p_entity_id uuid, p_entity_label text, p_description text, p_old_values jsonb, p_new_values jsonb, p_metadata jsonb, p_severity text) to service_role;
grant EXECUTE on function public.manage_member_role(p_member_id uuid, p_operation text, p_role_id uuid, p_link_id uuid, p_start_date date, p_end_date date, p_notes text, p_is_primary boolean) to authenticated;
grant EXECUTE on function public.manage_member_role(p_member_id uuid, p_operation text, p_role_id uuid, p_link_id uuid, p_start_date date, p_end_date date, p_notes text, p_is_primary boolean) to service_role;
grant EXECUTE on function public.normalize_member_role_history_language() to service_role;
grant EXECUTE on function public.protect_last_church_admin() to anon;
grant EXECUTE on function public.protect_last_church_admin() to authenticated;
grant EXECUTE on function public.protect_last_church_admin() to public;
grant EXECUTE on function public.protect_last_church_admin() to service_role;
grant EXECUTE on function public.renew_church_invitation(p_invitation_id uuid) to authenticated;
grant EXECUTE on function public.renew_church_invitation(p_invitation_id uuid) to service_role;
grant EXECUTE on function public.safe_uuid(p_value text) to anon;
grant EXECUTE on function public.safe_uuid(p_value text) to authenticated;
grant EXECUTE on function public.safe_uuid(p_value text) to public;
grant EXECUTE on function public.safe_uuid(p_value text) to service_role;
grant EXECUTE on function public.set_access_permission_override(p_access_id uuid, p_permission_key text, p_effect text) to authenticated;
grant EXECUTE on function public.set_access_permission_override(p_access_id uuid, p_permission_key text, p_effect text) to service_role;
grant EXECUTE on function public.set_updated_at() to anon;
grant EXECUTE on function public.set_updated_at() to authenticated;
grant EXECUTE on function public.set_updated_at() to public;
grant EXECUTE on function public.set_updated_at() to service_role;
grant EXECUTE on function public.touch_updated_at() to anon;
grant EXECUTE on function public.touch_updated_at() to authenticated;
grant EXECUTE on function public.touch_updated_at() to public;
grant EXECUTE on function public.touch_updated_at() to service_role;
grant EXECUTE on function public.update_church_access(p_access_id uuid, p_role text, p_scope text, p_status text, p_region_id uuid, p_congregation_id uuid, p_ministry_id uuid, p_notes text) to authenticated;
grant EXECUTE on function public.update_church_access(p_access_id uuid, p_role text, p_scope text, p_status text, p_region_id uuid, p_congregation_id uuid, p_ministry_id uuid, p_notes text) to service_role;
grant EXECUTE on function public.update_member_atomic(p_member_id uuid, p_expected_updated_at timestamp with time zone, p_payload jsonb) to authenticated;
grant EXECUTE on function public.update_member_atomic(p_member_id uuid, p_expected_updated_at timestamp with time zone, p_payload jsonb) to service_role;
grant EXECUTE on function public.validate_access_target_tenant() to anon;
grant EXECUTE on function public.validate_access_target_tenant() to authenticated;
grant EXECUTE on function public.validate_access_target_tenant() to public;
grant EXECUTE on function public.validate_access_target_tenant() to service_role;
grant EXECUTE on function public.validate_congregation_tenant() to anon;
grant EXECUTE on function public.validate_congregation_tenant() to authenticated;
grant EXECUTE on function public.validate_congregation_tenant() to public;
grant EXECUTE on function public.validate_congregation_tenant() to service_role;
grant EXECUTE on function public.validate_member_tenant() to anon;
grant EXECUTE on function public.validate_member_tenant() to authenticated;
grant EXECUTE on function public.validate_member_tenant() to public;
grant EXECUTE on function public.validate_member_tenant() to service_role;

-- Source: remote migration 20260808000838_trial_clone_storage_policies
create policy congregation_document_files_delete on storage.objects as permissive for delete to authenticated using (((bucket_id = 'congregation-documents'::text) AND (EXISTS ( SELECT 1
   FROM congregation_documents document
  WHERE ((document.storage_path = objects.name) AND (document.deleted_at IS NULL) AND ( SELECT has_permission(document.church_id, 'congregation_documents.manage'::text) AS has_permission)))) AND ( SELECT has_permission(safe_uuid((storage.foldername(objects.name))[1]), 'congregation_documents.manage'::text) AS has_permission) AND ( SELECT private.is_church_admin(safe_uuid((storage.foldername(objects.name))[1])) AS is_church_admin) AND ( SELECT can_access_congregation(safe_uuid((storage.foldername(objects.name))[1]), safe_uuid((storage.foldername(objects.name))[2])) AS can_access_congregation)));
create policy congregation_document_files_insert on storage.objects as permissive for insert to authenticated with check (((bucket_id = 'congregation-documents'::text) AND (safe_uuid((storage.foldername(name))[3]) IS NOT NULL) AND (EXISTS ( SELECT 1
   FROM congregation_documents document
  WHERE ((document.storage_path = objects.name) AND (document.church_id = safe_uuid((storage.foldername(objects.name))[1])) AND (document.congregation_id = safe_uuid((storage.foldername(objects.name))[2])) AND (document.id = safe_uuid((storage.foldername(objects.name))[3])) AND (document.deleted_at IS NULL) AND (((document.upload_status = 'PENDING'::text) AND (document.uploaded_by = ( SELECT auth.uid() AS uid))) OR (document.upload_status = 'ACTIVE'::text))))) AND ( SELECT has_permission(safe_uuid((storage.foldername(objects.name))[1]), 'congregation_documents.manage'::text) AS has_permission) AND ( SELECT private.is_church_admin(safe_uuid((storage.foldername(objects.name))[1])) AS is_church_admin) AND ( SELECT can_access_congregation(safe_uuid((storage.foldername(objects.name))[1]), safe_uuid((storage.foldername(objects.name))[2])) AS can_access_congregation)));
create policy congregation_document_files_select on storage.objects as permissive for select to authenticated using (((bucket_id = 'congregation-documents'::text) AND (EXISTS ( SELECT 1
   FROM congregation_documents document
  WHERE ((document.storage_path = objects.name) AND (document.church_id = safe_uuid((storage.foldername(objects.name))[1])) AND (document.congregation_id = safe_uuid((storage.foldername(objects.name))[2])) AND (document.id = safe_uuid((storage.foldername(objects.name))[3])) AND (document.deleted_at IS NULL) AND (((document.upload_status = 'ACTIVE'::text) AND (( SELECT has_permission(document.church_id, 'congregation_documents.view'::text) AS has_permission) OR ( SELECT has_permission(document.church_id, 'congregation_documents.manage'::text) AS has_permission))) OR ((document.upload_status = 'PENDING'::text) AND ( SELECT has_permission(document.church_id, 'congregation_documents.manage'::text) AS has_permission)))))) AND ( SELECT private.is_church_admin(safe_uuid((storage.foldername(objects.name))[1])) AS is_church_admin) AND ( SELECT can_access_congregation(safe_uuid((storage.foldername(objects.name))[1]), safe_uuid((storage.foldername(objects.name))[2])) AS can_access_congregation)));
create policy congregation_document_files_update on storage.objects as permissive for update to authenticated using (((bucket_id = 'congregation-documents'::text) AND (EXISTS ( SELECT 1
   FROM congregation_documents document
  WHERE ((document.storage_path = objects.name) AND (document.deleted_at IS NULL) AND ( SELECT has_permission(document.church_id, 'congregation_documents.manage'::text) AS has_permission)))) AND ( SELECT has_permission(safe_uuid((storage.foldername(objects.name))[1]), 'congregation_documents.manage'::text) AS has_permission) AND ( SELECT private.is_church_admin(safe_uuid((storage.foldername(objects.name))[1])) AS is_church_admin) AND ( SELECT can_access_congregation(safe_uuid((storage.foldername(objects.name))[1]), safe_uuid((storage.foldername(objects.name))[2])) AS can_access_congregation))) with check (((bucket_id = 'congregation-documents'::text) AND (safe_uuid((storage.foldername(name))[3]) IS NOT NULL) AND (EXISTS ( SELECT 1
   FROM congregation_documents document
  WHERE ((document.storage_path = objects.name) AND (document.deleted_at IS NULL) AND ( SELECT has_permission(document.church_id, 'congregation_documents.manage'::text) AS has_permission)))) AND ( SELECT has_permission(safe_uuid((storage.foldername(objects.name))[1]), 'congregation_documents.manage'::text) AS has_permission) AND ( SELECT private.is_church_admin(safe_uuid((storage.foldername(objects.name))[1])) AS is_church_admin) AND ( SELECT can_access_congregation(safe_uuid((storage.foldername(objects.name))[1]), safe_uuid((storage.foldername(objects.name))[2])) AS can_access_congregation)));
create policy member_files_delete on storage.objects as permissive for delete to authenticated using (((bucket_id = 'member-documents'::text) AND ( SELECT has_permission(safe_uuid((storage.foldername(objects.name))[1]), 'members.manage_documents'::text) AS has_permission) AND (EXISTS ( SELECT 1
   FROM members member
  WHERE ((member.church_id = safe_uuid((storage.foldername(objects.name))[1])) AND (member.id = safe_uuid((storage.foldername(objects.name))[2])) AND (member.deleted_at IS NULL) AND ( SELECT can_access_member(member.church_id, member.id, member.congregation_id) AS can_access_member))))));
create policy member_files_insert on storage.objects as permissive for insert to authenticated with check (((bucket_id = 'member-documents'::text) AND ( SELECT has_permission(safe_uuid((storage.foldername(objects.name))[1]), 'members.manage_documents'::text) AS has_permission) AND (EXISTS ( SELECT 1
   FROM members member
  WHERE ((member.church_id = safe_uuid((storage.foldername(objects.name))[1])) AND (member.id = safe_uuid((storage.foldername(objects.name))[2])) AND (member.deleted_at IS NULL) AND ( SELECT can_access_member(member.church_id, member.id, member.congregation_id) AS can_access_member))))));
create policy member_files_select on storage.objects as permissive for select to authenticated using (((bucket_id = 'member-documents'::text) AND (EXISTS ( SELECT 1
   FROM member_documents document
  WHERE ((document.storage_bucket = objects.bucket_id) AND (document.storage_path = objects.name) AND (document.deleted_at IS NULL))))));
create policy member_files_update on storage.objects as permissive for update to authenticated using (((bucket_id = 'member-documents'::text) AND ( SELECT has_permission(safe_uuid((storage.foldername(objects.name))[1]), 'members.manage_documents'::text) AS has_permission) AND (EXISTS ( SELECT 1
   FROM members member
  WHERE ((member.church_id = safe_uuid((storage.foldername(objects.name))[1])) AND (member.id = safe_uuid((storage.foldername(objects.name))[2])) AND (member.deleted_at IS NULL) AND ( SELECT can_access_member(member.church_id, member.id, member.congregation_id) AS can_access_member)))))) with check (((bucket_id = 'member-documents'::text) AND ( SELECT has_permission(safe_uuid((storage.foldername(objects.name))[1]), 'members.manage_documents'::text) AS has_permission)));

-- Source: remote migration 20260808000936_trial_clone_comments
comment on function public.get_my_access_context(p_preferred_church_id uuid) is 'Contexto autenticado consolidado por requisição. Respeita RLS e não deve ser armazenado em cache global.';

-- Compatibility state required by 202607310001 and removed by 20260805120000.
alter table public.members
  add column if not exists cpf text,
  add column if not exists rg text,
  add column if not exists issuing_agency text,
  add column if not exists pastoral_notes text;

-- Temporary pgcrypto compatibility required while replaying 202607310001.
create or replace function public.digest(p_data text, p_type text)
returns bytea language sql immutable parallel safe strict set search_path = ''
as $function$ select extensions.digest(p_data, p_type); $function$;

create or replace function public.gen_random_bytes(p_length integer)
returns bytea language sql volatile parallel safe strict set search_path = ''
as $function$ select extensions.gen_random_bytes(p_length); $function$;

revoke all on function public.digest(text, text) from public, anon, authenticated, service_role;
revoke all on function public.gen_random_bytes(integer) from public, anon, authenticated, service_role;
