begin;

-- ---------------------------------------------------------------------------
-- Evolução do módulo de Eventos: inscrições manuais, formulário configurável,
-- edição transacional de inscrições e despesas próprias do evento.
-- ---------------------------------------------------------------------------

insert into public.permissions (
  key, name, description, module, action, is_sensitive, status
)
select proposed.*
from (values
  ('events.expenses.view', 'Visualizar despesas de eventos', 'Consultar despesas e comprovantes do evento', 'events', 'expenses_view', true, 'ACTIVE'),
  ('events.expenses.manage', 'Gerenciar despesas de eventos', 'Cadastrar, editar e excluir despesas do evento', 'events', 'expenses_manage', true, 'ACTIVE')
) as proposed(key, name, description, module, action, is_sensitive, status)
where not exists (
  select 1 from public.permissions permission where permission.key = proposed.key
);

update public.permissions
set status = 'ACTIVE', deleted_at = null, updated_at = now()
where key in ('events.expenses.view', 'events.expenses.manage');

with grants(role, permission_key) as (values
  ('ADMIN', 'events.expenses.view'), ('ADMIN', 'events.expenses.manage'),
  ('SECRETARY', 'events.expenses.view'), ('SECRETARY', 'events.expenses.manage'),
  ('TREASURER', 'events.expenses.view'), ('TREASURER', 'events.expenses.manage')
)
insert into public.role_permissions(role, permission_id, status)
select grants.role, permission.id, 'ACTIVE'
from grants
join public.permissions permission on permission.key = grants.permission_key
where not exists (
  select 1 from public.role_permissions existing
  where existing.role = grants.role
    and existing.permission_id = permission.id
    and existing.deleted_at is null
);

with grants(role, permission_key) as (values
  ('ADMIN', 'events.expenses.view'), ('ADMIN', 'events.expenses.manage'),
  ('SECRETARY', 'events.expenses.view'), ('SECRETARY', 'events.expenses.manage'),
  ('TREASURER', 'events.expenses.view'), ('TREASURER', 'events.expenses.manage')
)
update public.role_permissions role_permission
set status = 'ACTIVE', deleted_at = null, updated_at = now()
from grants
join public.permissions permission on permission.key = grants.permission_key
where role_permission.role = grants.role
  and role_permission.permission_id = permission.id;

-- ---------------------------------------------------------------------------
-- Situação das inscrições independente do ciclo de vida do evento.
-- ---------------------------------------------------------------------------

alter table public.events
  add column if not exists registration_status text not null default 'CLOSED',
  add column if not exists registrations_opened_at timestamptz,
  add column if not exists registrations_opened_by uuid references public.profiles(id) on delete restrict,
  add column if not exists registrations_closed_at timestamptz,
  add column if not exists registrations_closed_by uuid references public.profiles(id) on delete restrict;

alter table public.events disable trigger protect_event_configuration;
update public.events
set registration_status = case when status = 'REGISTRATION_OPEN' then 'OPEN' else 'CLOSED' end,
    registrations_opened_at = case when status = 'REGISTRATION_OPEN' then coalesce(published_at, updated_at, created_at) else registrations_opened_at end,
    registrations_closed_at = case when status = 'REGISTRATION_CLOSED' then coalesce(updated_at, created_at) else registrations_closed_at end,
    status = case when status in ('REGISTRATION_OPEN', 'REGISTRATION_CLOSED') then 'PUBLISHED' else status end,
    registration_starts_at = null,
    registration_ends_at = null
where status in ('REGISTRATION_OPEN', 'REGISTRATION_CLOSED')
   or registration_starts_at is not null
   or registration_ends_at is not null;
alter table public.events enable trigger protect_event_configuration;

alter table public.events drop constraint if exists events_status_v2_check;
alter table public.events add constraint events_status_v3_check
  check (status in ('DRAFT','PUBLISHED','IN_PROGRESS','FINISHED','CANCELLED'));
alter table public.events drop constraint if exists events_dates_v2_check;
alter table public.events add constraint events_dates_v3_check
  check (ends_at is null or ends_at >= starts_at);
alter table public.events drop constraint if exists events_registration_status_check;
alter table public.events add constraint events_registration_status_check
  check (registration_status in ('OPEN','CLOSED'));

-- As colunas antigas permanecem fisicamente por compatibilidade histórica,
-- mas não podem voltar a influenciar regras ou receber novos valores.
create or replace function private.clear_legacy_event_registration_dates()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  new.registration_starts_at := null;
  new.registration_ends_at := null;
  return new;
end;
$$;

drop trigger if exists clear_legacy_event_registration_dates on public.events;
create trigger clear_legacy_event_registration_dates
before insert or update of registration_starts_at, registration_ends_at on public.events
for each row execute function private.clear_legacy_event_registration_dates();

-- ---------------------------------------------------------------------------
-- Formulário configurável e respostas históricas.
-- ---------------------------------------------------------------------------

create table if not exists public.event_registration_fields (
  id uuid primary key default gen_random_uuid(),
  church_id uuid not null references public.churches(id) on delete restrict,
  event_id uuid not null references public.events(id) on delete cascade,
  field_key text not null,
  field_kind text not null default 'CUSTOM',
  label text not null,
  help_text text,
  field_type text not null default 'SHORT_TEXT',
  visibility text not null default 'OPTIONAL',
  options jsonb not null default '[]'::jsonb,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  system_locked boolean not null default false,
  created_by uuid references public.profiles(id) on delete restrict,
  updated_by uuid references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  deleted_by uuid references public.profiles(id) on delete restrict,
  constraint event_registration_fields_kind_check check (field_kind in ('STANDARD','CUSTOM')),
  constraint event_registration_fields_type_check check (field_type in ('SHORT_TEXT','LONG_TEXT','DATE','NUMBER','SINGLE_SELECT','BOOLEAN')),
  constraint event_registration_fields_visibility_check check (visibility in ('HIDDEN','OPTIONAL','REQUIRED')),
  constraint event_registration_fields_label_check check (char_length(btrim(label)) between 2 and 150),
  constraint event_registration_fields_key_check check (field_key ~ '^[a-z][a-z0-9_]{1,79}$'),
  constraint event_registration_fields_options_check check (
    (field_type = 'SINGLE_SELECT' and jsonb_typeof(options) = 'array' and jsonb_array_length(options) between 1 and 50)
    or (field_type <> 'SINGLE_SELECT' and options = '[]'::jsonb)
  )
);

create unique index if not exists event_registration_fields_event_key_unique_idx
  on public.event_registration_fields(event_id, field_key)
  where deleted_at is null;
create index if not exists event_registration_fields_event_order_idx
  on public.event_registration_fields(event_id, is_active, sort_order, id)
  where deleted_at is null;

create table if not exists public.event_registration_field_values (
  id uuid primary key default gen_random_uuid(),
  church_id uuid not null references public.churches(id) on delete restrict,
  event_id uuid not null references public.events(id) on delete cascade,
  event_registration_id uuid not null references public.event_registrations(id) on delete cascade,
  event_registration_field_id uuid not null references public.event_registration_fields(id) on delete restrict,
  value jsonb not null,
  field_key_snapshot text not null,
  label_snapshot text not null,
  field_type_snapshot text not null,
  created_by uuid references public.profiles(id) on delete restrict,
  updated_by uuid references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  deleted_by uuid references public.profiles(id) on delete restrict
);

create unique index if not exists event_registration_field_values_registration_field_unique_idx
  on public.event_registration_field_values(event_registration_id, event_registration_field_id)
  where deleted_at is null;
create index if not exists event_registration_field_values_event_idx
  on public.event_registration_field_values(event_id, event_registration_id)
  where deleted_at is null;

create or replace function private.seed_event_registration_fields()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.event_registration_fields (
    church_id, event_id, field_key, field_kind, label, field_type, visibility, options,
    sort_order, is_active, system_locked, created_by, updated_by
  ) values
    (new.church_id,new.id,'participant_name','STANDARD','Nome completo','SHORT_TEXT','REQUIRED','[]'::jsonb,10,true,true,new.created_by,new.updated_by),
    (new.church_id,new.id,'participant_gender','STANDARD','Sexo','SINGLE_SELECT','REQUIRED','["MALE","FEMALE"]'::jsonb,20,true,false,new.created_by,new.updated_by),
    (new.church_id,new.id,'participant_phone','STANDARD','Telefone','SHORT_TEXT','REQUIRED','[]'::jsonb,30,true,false,new.created_by,new.updated_by),
    (new.church_id,new.id,'participant_email','STANDARD','E-mail','SHORT_TEXT','HIDDEN','[]'::jsonb,40,false,false,new.created_by,new.updated_by),
    (new.church_id,new.id,'participant_document','STANDARD','Documento','SHORT_TEXT','HIDDEN','[]'::jsonb,50,false,false,new.created_by,new.updated_by),
    (new.church_id,new.id,'participant_birth_date','STANDARD','Data de nascimento','DATE','HIDDEN','[]'::jsonb,60,false,false,new.created_by,new.updated_by),
    (new.church_id,new.id,'region_id','STANDARD','Regional','SINGLE_SELECT','OPTIONAL','["REFERENCE"]'::jsonb,70,true,false,new.created_by,new.updated_by),
    (new.church_id,new.id,'congregation_id','STANDARD','Congregação','SINGLE_SELECT','OPTIONAL','["REFERENCE"]'::jsonb,80,true,false,new.created_by,new.updated_by),
    (new.church_id,new.id,'participant_role_id','STANDARD','Cargo','SINGLE_SELECT','OPTIONAL','["REFERENCE"]'::jsonb,90,true,false,new.created_by,new.updated_by),
    (new.church_id,new.id,'participant_city','STANDARD','Cidade','SHORT_TEXT','HIDDEN','[]'::jsonb,100,false,false,new.created_by,new.updated_by),
    (new.church_id,new.id,'participant_state','STANDARD','UF','SHORT_TEXT','HIDDEN','[]'::jsonb,110,false,false,new.created_by,new.updated_by),
    (new.church_id,new.id,'responsible_name','STANDARD','Nome do responsável','SHORT_TEXT','HIDDEN','[]'::jsonb,120,false,false,new.created_by,new.updated_by),
    (new.church_id,new.id,'responsible_phone','STANDARD','Telefone do responsável','SHORT_TEXT','HIDDEN','[]'::jsonb,130,false,false,new.created_by,new.updated_by),
    (new.church_id,new.id,'preferred_payment_method','STANDARD','Forma de pagamento','SINGLE_SELECT','OPTIONAL','["REFERENCE"]'::jsonb,140,true,true,new.created_by,new.updated_by),
    (new.church_id,new.id,'items','STANDARD','Itens do evento','SINGLE_SELECT','OPTIONAL','["REFERENCE"]'::jsonb,150,true,true,new.created_by,new.updated_by)
  on conflict do nothing;
  return new;
end;
$$;

drop trigger if exists seed_event_registration_fields on public.events;
create trigger seed_event_registration_fields
after insert on public.events for each row execute function private.seed_event_registration_fields();

insert into public.event_registration_fields (
  church_id,event_id,field_key,field_kind,label,field_type,visibility,options,
  sort_order,is_active,system_locked,created_by,updated_by
)
select event.church_id,event.id,defaults.field_key,'STANDARD',defaults.label,
  defaults.field_type,defaults.visibility,defaults.options,defaults.sort_order,
  defaults.visibility <> 'HIDDEN',defaults.system_locked,event.created_by,event.updated_by
from public.events event
cross join (values
  ('participant_name','Nome completo','SHORT_TEXT','REQUIRED','[]'::jsonb,10,true),
  ('participant_gender','Sexo','SINGLE_SELECT','REQUIRED','["MALE","FEMALE"]'::jsonb,20,false),
  ('participant_phone','Telefone','SHORT_TEXT','REQUIRED','[]'::jsonb,30,false),
  ('participant_email','E-mail','SHORT_TEXT','HIDDEN','[]'::jsonb,40,false),
  ('participant_document','Documento','SHORT_TEXT','HIDDEN','[]'::jsonb,50,false),
  ('participant_birth_date','Data de nascimento','DATE','HIDDEN','[]'::jsonb,60,false),
  ('region_id','Regional','SINGLE_SELECT','OPTIONAL','["REFERENCE"]'::jsonb,70,false),
  ('congregation_id','Congregação','SINGLE_SELECT','OPTIONAL','["REFERENCE"]'::jsonb,80,false),
  ('participant_role_id','Cargo','SINGLE_SELECT','OPTIONAL','["REFERENCE"]'::jsonb,90,false),
  ('participant_city','Cidade','SHORT_TEXT','HIDDEN','[]'::jsonb,100,false),
  ('participant_state','UF','SHORT_TEXT','HIDDEN','[]'::jsonb,110,false),
  ('responsible_name','Nome do responsável','SHORT_TEXT','HIDDEN','[]'::jsonb,120,false),
  ('responsible_phone','Telefone do responsável','SHORT_TEXT','HIDDEN','[]'::jsonb,130,false),
  ('preferred_payment_method','Forma de pagamento','SINGLE_SELECT','OPTIONAL','["REFERENCE"]'::jsonb,140,true),
  ('items','Itens do evento','SINGLE_SELECT','OPTIONAL','["REFERENCE"]'::jsonb,150,true)
) as defaults(field_key,label,field_type,visibility,options,sort_order,system_locked)
where event.deleted_at is null
on conflict do nothing;

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

drop trigger if exists protect_event_registration_field on public.event_registration_fields;
create trigger protect_event_registration_field
before insert or update or delete on public.event_registration_fields
for each row execute function private.protect_event_registration_field();

-- ---------------------------------------------------------------------------
-- Despesas e comprovantes privados.
-- ---------------------------------------------------------------------------

create table if not exists public.event_expenses (
  id uuid primary key default gen_random_uuid(),
  church_id uuid not null references public.churches(id) on delete restrict,
  event_id uuid not null references public.events(id) on delete cascade,
  name text not null,
  expense_date date not null,
  amount numeric(12,2) not null,
  receipt_storage_bucket text,
  receipt_storage_path text,
  receipt_file_name text,
  receipt_mime_type text,
  receipt_file_size bigint,
  upload_status text not null default 'NONE',
  notes text,
  created_by uuid references public.profiles(id) on delete restrict,
  updated_by uuid references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  deleted_by uuid references public.profiles(id) on delete restrict,
  constraint event_expenses_name_check check (char_length(btrim(name)) between 2 and 150),
  constraint event_expenses_amount_check check (amount > 0),
  constraint event_expenses_upload_status_check check (upload_status in ('NONE','PENDING','ACTIVE','FAILED')),
  constraint event_expenses_receipt_check check (
    (upload_status = 'NONE' and receipt_storage_path is null and receipt_file_name is null and receipt_mime_type is null and receipt_file_size is null)
    or (
      upload_status in ('PENDING','ACTIVE','FAILED')
      and receipt_storage_bucket = 'event-documents'
      and receipt_storage_path is not null
      and coalesce(btrim(receipt_file_name),'') <> ''
      and receipt_mime_type in ('application/pdf','image/jpeg','image/png','image/webp')
      and receipt_file_size between 1 and 10485760
    )
  )
);

create index if not exists event_expenses_event_date_idx
  on public.event_expenses(event_id, expense_date desc, id)
  where deleted_at is null;
create index if not exists event_expenses_church_event_idx
  on public.event_expenses(church_id, event_id)
  where deleted_at is null;

-- ---------------------------------------------------------------------------
-- Regras manuais de ciclo de vida e edição atômica de inscrições.
-- ---------------------------------------------------------------------------

create or replace function private.protect_event_configuration()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare v_used integer;
begin
  if old.status is distinct from new.status or old.registration_status is distinct from new.registration_status then
    if not (select private.can_access_event_values(old.church_id,old.event_scope,old.region_id,old.congregation_id,old.ministry_id,'events.publish')) then
      raise exception 'EVENT_PUBLISH_PERMISSION_REQUIRED';
    end if;
    if old.status is distinct from new.status and not (
      (old.status='DRAFT' and new.status='PUBLISHED') or
      (old.status='PUBLISHED' and new.status='IN_PROGRESS') or
      (old.status='IN_PROGRESS' and new.status='FINISHED') or
      (old.status not in ('FINISHED','CANCELLED') and new.status='CANCELLED')
    ) then raise exception 'EVENT_TRANSITION_INVALID'; end if;
    if new.status in ('FINISHED','CANCELLED') and new.registration_status='OPEN' then
      raise exception 'EVENT_REGISTRATIONS_MUST_BE_CLOSED';
    end if;
    if old.registration_status is distinct from new.registration_status and new.status in ('DRAFT','FINISHED','CANCELLED') then
      raise exception 'EVENT_REGISTRATION_STATE_INVALID';
    end if;
    if new.status='CANCELLED' and coalesce(btrim(new.cancel_reason),'')='' then
      raise exception 'EVENT_CANCEL_REASON_REQUIRED';
    end if;
  end if;
  if exists (select 1 from public.event_registrations where event_id=old.id and deleted_at is null) and (
    old.church_id is distinct from new.church_id or old.event_scope is distinct from new.event_scope
    or old.region_id is distinct from new.region_id or old.congregation_id is distinct from new.congregation_id
    or old.ministry_id is distinct from new.ministry_id or old.registration_mode is distinct from new.registration_mode
    or old.quota_mode is distinct from new.quota_mode
  ) then raise exception 'EVENT_CRITICAL_CONFIGURATION_LOCKED'; end if;
  if new.capacity is not null and (old.capacity is null or new.capacity < old.capacity) then
    select count(*) into v_used from public.event_registrations
    where event_id=old.id and status in ('PENDING','CONFIRMED','CHECKED_IN') and deleted_at is null;
    if new.capacity < v_used then raise exception 'EVENT_CAPACITY_BELOW_USAGE'; end if;
  end if;
  return new;
end;
$$;

drop trigger if exists protect_event_configuration on public.events;
create trigger protect_event_configuration before update on public.events
for each row execute function private.protect_event_configuration();

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
  v_old_status text;
  v_old_registration_status text;
  v_actor uuid := (select auth.uid());
begin
  select * into v_event from public.events
  where id=p_event_id and deleted_at is null for update;
  if not found then raise exception 'EVENT_NOT_FOUND'; end if;
  if not (select private.can_access_event_id(p_event_id,'events.publish')) then
    raise exception 'EVENT_ACCESS_DENIED';
  end if;
  p_action := upper(p_action);
  v_old_status := v_event.status;
  v_old_registration_status := v_event.registration_status;

  if p_action='PUBLISH' then
    if v_event.status <> 'DRAFT' then raise exception 'EVENT_TRANSITION_INVALID'; end if;
    if btrim(v_event.name)='' or v_event.starts_at is null
      or (v_event.visibility='PUBLIC' and coalesce(btrim(v_event.slug),'')='') then
      raise exception 'EVENT_NOT_READY_TO_PUBLISH';
    end if;
    update public.events set status='PUBLISHED',published_at=now(),published_by=v_actor,updated_by=v_actor
    where id=p_event_id returning * into v_event;
  elsif p_action in ('OPEN_REGISTRATION','REOPEN_REGISTRATION') then
    if v_event.status not in ('PUBLISHED','IN_PROGRESS') or v_event.registration_status='OPEN' then
      raise exception 'EVENT_TRANSITION_INVALID';
    end if;
    update public.events set registration_status='OPEN',registrations_opened_at=now(),registrations_opened_by=v_actor,
      registrations_closed_at=null,registrations_closed_by=null,updated_by=v_actor
    where id=p_event_id returning * into v_event;
  elsif p_action='CLOSE_REGISTRATION' then
    if v_event.registration_status <> 'OPEN' then raise exception 'EVENT_TRANSITION_INVALID'; end if;
    update public.events set registration_status='CLOSED',registrations_closed_at=now(),registrations_closed_by=v_actor,updated_by=v_actor
    where id=p_event_id returning * into v_event;
  elsif p_action='START' then
    if v_event.status <> 'PUBLISHED' then raise exception 'EVENT_TRANSITION_INVALID'; end if;
    update public.events set status='IN_PROGRESS',updated_by=v_actor where id=p_event_id returning * into v_event;
  elsif p_action='FINISH' then
    if v_event.status <> 'IN_PROGRESS' then raise exception 'EVENT_TRANSITION_INVALID'; end if;
    if v_event.registration_status='OPEN' then raise exception 'EVENT_REGISTRATIONS_MUST_BE_CLOSED'; end if;
    update public.events set status='FINISHED',finished_at=now(),finished_by=v_actor,updated_by=v_actor
    where id=p_event_id returning * into v_event;
  elsif p_action='CANCEL' then
    if v_event.status in ('FINISHED','CANCELLED') then raise exception 'EVENT_TRANSITION_INVALID'; end if;
    if v_event.registration_status='OPEN' then raise exception 'EVENT_REGISTRATIONS_MUST_BE_CLOSED'; end if;
    if coalesce(btrim(p_reason),'')='' then raise exception 'EVENT_CANCEL_REASON_REQUIRED'; end if;
    update public.events set status='CANCELLED',cancelled_at=now(),cancelled_by=v_actor,
      cancel_reason=btrim(p_reason),updated_by=v_actor where id=p_event_id returning * into v_event;
  else
    raise exception 'EVENT_ACTION_INVALID';
  end if;

  perform public.log_audit(
    v_event.church_id,'EVENTS',p_action,'EVENT',v_event.id,v_event.name,
    'Situação do evento ou das inscrições alterada',
    jsonb_build_object('status',v_old_status,'registration_status',v_old_registration_status),
    jsonb_build_object('status',v_event.status,'registration_status',v_event.registration_status,'reason',p_reason),
    '{}'::jsonb,case when p_action='CANCEL' then 'WARNING' else 'INFO' end
  );
  return v_event;
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
    select event.id,event.status,event.registration_status,event.starts_at
    from public.events event
    where event.church_id=p_church_id and event.deleted_at is null
      and (select private.can_access_event_values(
        event.church_id,event.event_scope,event.region_id,event.congregation_id,event.ministry_id,'events.view'
      ))
  )
  select jsonb_build_object(
    'total',count(*),
    'draft',count(*) filter (where status='DRAFT'),
    'open',count(*) filter (where registration_status='OPEN'),
    'upcoming',count(*) filter (where starts_at>=now() and status not in ('FINISHED','CANCELLED')),
    'finished',count(*) filter (where status='FINISHED'),
    'cancelled',count(*) filter (where status='CANCELLED')
  ) from allowed_events;
$$;

create or replace function public.update_event_registration(
  p_event_id uuid,
  p_registration_id uuid,
  p_expected_updated_at timestamptz,
  p_payload jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_event public.events%rowtype;
  v_registration public.event_registrations%rowtype;
  v_before jsonb;
  v_actor uuid := (select auth.uid());
  v_item jsonb;
  v_field jsonb;
  v_catalog_item public.event_items%rowtype;
  v_total numeric(12,2):=0;
  v_quantity integer;
  v_used integer;
  v_items jsonb:=coalesce(p_payload->'items','[]'::jsonb);
  v_fields jsonb:=coalesce(p_payload->'customFields','{}'::jsonb);
begin
  select * into v_event from public.events where id=p_event_id and deleted_at is null for update;
  if not found then raise exception 'EVENT_NOT_FOUND'; end if;
  if not (select private.can_access_event_id(p_event_id,'events.registrations.manage')) then
    raise exception 'EVENT_ACCESS_DENIED';
  end if;
  select * into v_registration from public.event_registrations
  where id=p_registration_id and event_id=p_event_id and deleted_at is null for update;
  if not found then raise exception 'EVENT_REGISTRATION_NOT_FOUND'; end if;
  if v_registration.status='CANCELLED' then raise exception 'EVENT_REGISTRATION_READ_ONLY'; end if;
  if v_registration.updated_at is distinct from p_expected_updated_at then raise exception 'EVENT_REGISTRATION_CONFLICT'; end if;
  v_before:=to_jsonb(v_registration);

  if v_registration.status='CHECKED_IN' then
    v_items:=coalesce((select jsonb_agg(jsonb_build_object('itemId',item.event_item_id,'quantity',item.quantity,'size',item.size))
      from public.event_registration_items item
      where item.event_registration_id=p_registration_id and item.deleted_at is null),'[]'::jsonb);
  end if;
  if jsonb_typeof(v_items)<>'array' then raise exception 'EVENT_ITEMS_INVALID'; end if;

  for v_item in select * from jsonb_array_elements(v_items)
  loop
    select * into v_catalog_item from public.event_items
    where id=nullif(v_item->>'itemId','')::uuid and event_id=p_event_id and is_active and deleted_at is null for update;
    if not found then raise exception 'EVENT_ITEM_NOT_AVAILABLE'; end if;
    v_quantity:=coalesce((v_item->>'quantity')::integer,1);
    if v_quantity<greatest(v_catalog_item.min_quantity,1)
      or (v_catalog_item.max_quantity is not null and v_quantity>v_catalog_item.max_quantity)
      or (not v_catalog_item.allow_quantity and v_quantity<>1) then raise exception 'EVENT_ITEM_QUANTITY_INVALID'; end if;
    select coalesce(sum(item.quantity),0)::integer into v_used
    from public.event_registration_items item
    join public.event_registrations registration on registration.id=item.event_registration_id
    where item.event_item_id=v_catalog_item.id and item.event_registration_id<>p_registration_id
      and item.deleted_at is null and registration.deleted_at is null
      and registration.status in ('PENDING','CONFIRMED','CHECKED_IN');
    if v_catalog_item.available_quantity is not null and v_used+v_quantity>v_catalog_item.available_quantity then
      raise exception 'EVENT_ITEM_STOCK_EXCEEDED';
    end if;
    v_total:=v_total+round(v_catalog_item.price*v_quantity,2);
  end loop;
  if v_total<v_registration.paid_amount then raise exception 'EVENT_TOTAL_BELOW_CONFIRMED_PAYMENTS'; end if;

  update public.event_registrations set
    congregation_id=nullif(p_payload->>'congregationId','')::uuid,
    participant_name=coalesce(nullif(btrim(p_payload->>'participantName'),''),participant_name),
    participant_document=nullif(btrim(p_payload->>'participantDocument'),''),
    participant_document_normalized=nullif(regexp_replace(coalesce(p_payload->>'participantDocument',''),'\\D','','g'),''),
    participant_birth_date=nullif(p_payload->>'participantBirthDate','')::date,
    participant_gender=nullif(p_payload->>'participantGender',''),
    participant_phone=nullif(btrim(p_payload->>'participantPhone'),''),
    participant_email=nullif(btrim(p_payload->>'participantEmail'),''),
    participant_city=nullif(btrim(p_payload->>'participantCity'),''),
    participant_state=nullif(upper(btrim(p_payload->>'participantState')),''),
    responsible_name=nullif(btrim(p_payload->>'responsibleName'),''),
    responsible_phone=nullif(btrim(p_payload->>'responsiblePhone'),''),
    preferred_payment_method=nullif(p_payload->>'preferredPaymentMethod',''),
    total_amount=v_total,
    metadata=coalesce(metadata,'{}'::jsonb)||jsonb_build_object(
      'participantRoleId',nullif(p_payload->>'participantRoleId',''),
      'participantRoleName',nullif(p_payload->>'participantRoleName','')
    ),
    updated_by=v_actor
  where id=p_registration_id returning * into v_registration;

  update public.event_registration_items set deleted_at=now(),deleted_by=v_actor,updated_by=v_actor
  where event_registration_id=p_registration_id and deleted_at is null;
  for v_item in select * from jsonb_array_elements(v_items)
  loop
    select * into v_catalog_item from public.event_items where id=(v_item->>'itemId')::uuid and event_id=p_event_id;
    v_quantity:=coalesce((v_item->>'quantity')::integer,1);
    insert into public.event_registration_items(
      church_id,event_id,event_registration_id,event_item_id,item_name,item_type,size,quantity,unit_price,metadata,created_by,updated_by
    ) values (
      v_event.church_id,p_event_id,p_registration_id,v_catalog_item.id,v_catalog_item.name,v_catalog_item.item_type,
      nullif(v_item->>'size',''),v_quantity,v_catalog_item.price,coalesce(v_item->'metadata','{}'::jsonb),v_actor,v_actor
    );
  end loop;

  for v_field in
    select jsonb_build_object('id',field.id,'key',field.field_key,'label',field.label,'type',field.field_type,
      'required',field.visibility='REQUIRED','value',v_fields -> (field.field_key))
    from public.event_registration_fields field
    where field.event_id=p_event_id and field.field_kind='CUSTOM' and field.is_active and field.deleted_at is null
  loop
    if (v_field->>'required')::boolean and (v_field->'value' is null or v_field->'value'='null'::jsonb or v_field->'value'='""'::jsonb) then
      raise exception 'EVENT_REQUIRED_FIELD_MISSING';
    end if;
    if v_field->'value' is not null and v_field->'value'<>'null'::jsonb and v_field->'value'<>'""'::jsonb then
      insert into public.event_registration_field_values(
        church_id,event_id,event_registration_id,event_registration_field_id,value,field_key_snapshot,label_snapshot,field_type_snapshot,created_by,updated_by
      ) values (
        v_event.church_id,p_event_id,p_registration_id,(v_field->>'id')::uuid,v_field->'value',v_field->>'key',v_field->>'label',v_field->>'type',v_actor,v_actor
      ) on conflict (event_registration_id,event_registration_field_id) where deleted_at is null
      do update set value=excluded.value,label_snapshot=excluded.label_snapshot,updated_by=v_actor,deleted_at=null,deleted_by=null;
    else
      update public.event_registration_field_values set deleted_at=now(),deleted_by=v_actor,updated_by=v_actor
      where event_registration_id=p_registration_id and event_registration_field_id=(v_field->>'id')::uuid and deleted_at is null;
    end if;
  end loop;

  perform private.recalculate_event_registration(p_registration_id);
  select * into v_registration from public.event_registrations where id=p_registration_id;
  perform public.log_audit(v_event.church_id,'EVENTS','UPDATE_REGISTRATION','EVENT_REGISTRATION',
    v_registration.id,v_registration.registration_number,'Inscrição atualizada',
    v_before - array['qr_token_hash','metadata'],to_jsonb(v_registration)-array['qr_token_hash','metadata'],
    jsonb_build_object('event_id',p_event_id),'INFO');
  return jsonb_build_object('registrationId',v_registration.id,'updatedAt',v_registration.updated_at,'totalAmount',v_registration.total_amount);
end;
$$;

create or replace function public.create_event_registration_v3(
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
  v_member public.members%rowtype;
  v_congregation public.congregations%rowtype;
  v_item jsonb;
  v_field record;
  v_catalog_item public.event_items%rowtype;
  v_actor uuid := (select auth.uid());
  v_service boolean := (select private.is_service_request());
  v_active_count integer;
  v_item_used integer;
  v_sequence integer;
  v_total numeric(12,2) := 0;
  v_quantity integer;
  v_token text := encode(extensions.gen_random_bytes(24),'hex');
  v_member_id uuid := nullif(p_payload->>'memberId','')::uuid;
  v_congregation_id uuid := nullif(p_payload->>'congregationId','')::uuid;
  v_items jsonb := coalesce(p_payload->'items','[]'::jsonb);
  v_custom_fields jsonb := coalesce(p_payload->'customFields','{}'::jsonb);
  v_name text := nullif(btrim(p_payload->>'participantName'),'');
  v_gender text := nullif(p_payload->>'participantGender','');
  v_phone text := nullif(btrim(p_payload->>'participantPhone'),'');
  v_participant_type text := case when nullif(p_payload->>'memberId','') is null then 'VISITOR' else 'MEMBER' end;
  v_payment_method text := coalesce(nullif(p_payload->>'preferredPaymentMethod',''),'PIX');
begin
  select * into v_event from public.events where id=p_event_id and deleted_at is null for update;
  if not found then raise exception 'EVENT_NOT_FOUND'; end if;
  if v_service then
    if coalesce(p_payload->>'registrationSource','PUBLIC') not in ('PUBLIC','GROUP') or v_event.visibility<>'PUBLIC' then
      raise exception 'EVENT_PUBLIC_ACCESS_DENIED';
    end if;
  elsif not (select private.can_access_event_id(p_event_id,'events.registrations.manage')) then
    raise exception 'EVENT_ACCESS_DENIED';
  end if;
  if v_event.registration_status<>'OPEN' or v_event.status not in ('PUBLISHED','IN_PROGRESS') then
    raise exception 'EVENT_REGISTRATION_CLOSED';
  end if;

  if p_idempotency_key is not null then
    select * into v_registration from public.event_registrations
    where event_id=p_event_id and idempotency_key=p_idempotency_key;
    if found then
      return jsonb_build_object('registrationId',v_registration.id,'registrationNumber',v_registration.registration_number,
        'status',v_registration.status,'paymentStatus',v_registration.payment_status,'totalAmount',v_registration.total_amount,'idempotentReplay',true);
    end if;
  end if;

  if v_member_id is not null then
    select * into v_member from public.members
    where id=v_member_id and church_id=v_event.church_id and member_status='ACTIVE' and deleted_at is null;
    if not found then raise exception 'EVENT_MEMBER_NOT_AVAILABLE'; end if;
    v_name:=v_member.full_name;
    v_gender:=v_member.gender;
    v_phone:=nullif(btrim(v_member.whatsapp),'');
    v_congregation_id:=v_member.congregation_id;
    v_participant_type:='MEMBER';
  end if;
  if v_name is null then raise exception 'PARTICIPANT_NAME_REQUIRED'; end if;
  if v_payment_method not in ('PIX','CASH','CREDIT_CARD','DEBIT_CARD','BANK_TRANSFER','BANK_SLIP','OTHER','NOT_APPLICABLE') then
    raise exception 'EVENT_PAYMENT_METHOD_INVALID';
  end if;
  if v_congregation_id is not null then
    select * into v_congregation from public.congregations
    where id=v_congregation_id and church_id=v_event.church_id and deleted_at is null;
    if not found then raise exception 'EVENT_CONGREGATION_NOT_AVAILABLE'; end if;
  end if;
  if v_member_id is not null and exists (
    select 1 from public.event_registrations where event_id=p_event_id and member_id=v_member_id
      and status in ('PENDING','CONFIRMED','CHECKED_IN') and deleted_at is null
  ) then raise exception 'EVENT_REGISTRATION_DUPLICATE_MEMBER'; end if;
  if nullif(regexp_replace(coalesce(p_payload->>'participantDocument',''),'\\D','','g'),'') is not null and exists (
    select 1 from public.event_registrations registration
    where registration.event_id=p_event_id and registration.participant_document_normalized=
      nullif(regexp_replace(coalesce(p_payload->>'participantDocument',''),'\\D','','g'),'')
      and registration.status in ('PENDING','CONFIRMED','CHECKED_IN') and registration.deleted_at is null
  ) then raise exception 'EVENT_REGISTRATION_DUPLICATE_DOCUMENT'; end if;

  select count(*) into v_active_count from public.event_registrations
  where event_id=p_event_id and status in ('PENDING','CONFIRMED','CHECKED_IN') and deleted_at is null;
  if v_event.capacity is not null and v_active_count>=v_event.capacity then raise exception 'EVENT_CAPACITY_FULL'; end if;
  if jsonb_typeof(v_items)<>'array' then raise exception 'EVENT_ITEMS_INVALID'; end if;
  if exists (
    select 1 from public.event_items required_item
    where required_item.event_id=p_event_id and required_item.is_required and required_item.is_active and required_item.deleted_at is null
      and not exists (select 1 from jsonb_array_elements(v_items) selected where nullif(selected->>'itemId','')::uuid=required_item.id)
  ) then raise exception 'EVENT_REQUIRED_ITEM_MISSING'; end if;

  for v_item in select * from jsonb_array_elements(v_items)
  loop
    select * into v_catalog_item from public.event_items
    where id=nullif(v_item->>'itemId','')::uuid and event_id=p_event_id and is_active and deleted_at is null for update;
    if not found then raise exception 'EVENT_ITEM_NOT_AVAILABLE'; end if;
    v_quantity:=coalesce((v_item->>'quantity')::integer,1);
    if v_quantity<greatest(v_catalog_item.min_quantity,1)
      or (v_catalog_item.max_quantity is not null and v_quantity>v_catalog_item.max_quantity)
      or (not v_catalog_item.allow_quantity and v_quantity<>1) then raise exception 'EVENT_ITEM_QUANTITY_INVALID'; end if;
    select coalesce(sum(registration_item.quantity),0)::integer into v_item_used
    from public.event_registration_items registration_item
    join public.event_registrations registration on registration.id=registration_item.event_registration_id
    where registration_item.event_item_id=v_catalog_item.id and registration_item.deleted_at is null
      and registration.status in ('PENDING','CONFIRMED','CHECKED_IN') and registration.deleted_at is null;
    if v_catalog_item.available_quantity is not null and v_item_used+v_quantity>v_catalog_item.available_quantity then
      raise exception 'EVENT_ITEM_STOCK_EXCEEDED';
    end if;
    v_total:=v_total+round(v_catalog_item.price*v_quantity,2);
  end loop;

  for v_field in
    select field.id,field.field_key,field.label,field.field_type,field.visibility
    from public.event_registration_fields field
    where field.event_id=p_event_id and field.field_kind='CUSTOM' and field.is_active and field.deleted_at is null
  loop
    if v_field.visibility='REQUIRED' and (
      not (v_custom_fields ? v_field.field_key) or v_custom_fields -> (v_field.field_key) is null
      or v_custom_fields -> (v_field.field_key)='null'::jsonb or v_custom_fields -> (v_field.field_key)='""'::jsonb
    ) then raise exception 'EVENT_REQUIRED_FIELD_MISSING'; end if;
  end loop;

  update public.events set registration_sequence=registration_sequence+1
  where id=p_event_id returning registration_sequence into v_sequence;
  insert into public.event_registrations(
    church_id,event_id,event_group_id,event_registration_batch_id,member_id,congregation_id,
    registration_number,registration_source,participant_type,participant_name,participant_document,
    participant_document_normalized,participant_birth_date,participant_gender,participant_phone,participant_email,
    participant_city,participant_state,responsible_name,responsible_phone,consent_version,consent_at,
    status,payment_status,total_amount,paid_amount,preferred_payment_method,qr_token_hash,qr_token_last4,
    reservation_expires_at,idempotency_key,metadata,created_by,updated_by
  ) values (
    v_event.church_id,p_event_id,nullif(p_payload->>'eventGroupId','')::uuid,null,v_member_id,v_congregation_id,
    upper(left(coalesce(v_event.public_code,'EVT'),6))||'-'||lpad(v_sequence::text,6,'0'),
    coalesce(p_payload->>'registrationSource',case when v_service then 'PUBLIC' else 'INTERNAL' end),
    v_participant_type,v_name,nullif(btrim(p_payload->>'participantDocument'),''),
    nullif(regexp_replace(coalesce(p_payload->>'participantDocument',''),'\\D','','g'),''),
    nullif(p_payload->>'participantBirthDate','')::date,v_gender,v_phone,nullif(btrim(p_payload->>'participantEmail'),''),
    nullif(btrim(p_payload->>'participantCity'),''),nullif(upper(btrim(p_payload->>'participantState')),''),
    nullif(btrim(p_payload->>'responsibleName'),''),nullif(btrim(p_payload->>'responsiblePhone'),''),
    nullif(p_payload->>'consentVersion',''),case when coalesce((p_payload->>'consentAccepted')::boolean,false) then now() else null end,
    'PENDING',case when v_total<=0 then 'NOT_REQUIRED' else 'PENDING' end,v_total,0,v_payment_method,
    encode(extensions.digest(v_token,'sha256'),'hex'),right(v_token,4),null,p_idempotency_key,
    coalesce(p_payload->'metadata','{}'::jsonb),v_actor,v_actor
  ) returning * into v_registration;

  for v_item in select * from jsonb_array_elements(v_items)
  loop
    select * into v_catalog_item from public.event_items where id=(v_item->>'itemId')::uuid and event_id=p_event_id;
    v_quantity:=coalesce((v_item->>'quantity')::integer,1);
    insert into public.event_registration_items(
      church_id,event_id,event_registration_id,event_item_id,item_name,item_type,size,quantity,unit_price,metadata,created_by,updated_by
    ) values (
      v_event.church_id,p_event_id,v_registration.id,v_catalog_item.id,v_catalog_item.name,v_catalog_item.item_type,
      nullif(v_item->>'size',''),v_quantity,v_catalog_item.price,coalesce(v_item->'metadata','{}'::jsonb),v_actor,v_actor
    );
  end loop;
  for v_field in
    select field.id,field.field_key,field.label,field.field_type
    from public.event_registration_fields field
    where field.event_id=p_event_id and field.field_kind='CUSTOM' and field.is_active and field.deleted_at is null
      and v_custom_fields ? field.field_key and v_custom_fields -> (field.field_key) is not null
      and v_custom_fields -> (field.field_key)<>'null'::jsonb and v_custom_fields -> (field.field_key)<>'""'::jsonb
  loop
    insert into public.event_registration_field_values(
      church_id,event_id,event_registration_id,event_registration_field_id,value,field_key_snapshot,label_snapshot,field_type_snapshot,created_by,updated_by
    ) values (
      v_event.church_id,p_event_id,v_registration.id,v_field.id,v_custom_fields -> (v_field.field_key),
      v_field.field_key,v_field.label,v_field.field_type,v_actor,v_actor
    );
  end loop;
  if v_registration.event_group_id is not null then perform private.recalculate_event_group(v_registration.event_group_id); end if;
  perform public.log_audit(v_event.church_id,'EVENTS','CREATE_REGISTRATION','EVENT_REGISTRATION',
    v_registration.id,v_registration.registration_number,'Inscrição criada',null,
    jsonb_build_object('event_id',p_event_id,'status',v_registration.status,'total_amount',v_total),'{}'::jsonb,'INFO');
  return jsonb_build_object('registrationId',v_registration.id,'registrationNumber',v_registration.registration_number,
    'status',v_registration.status,'paymentStatus',v_registration.payment_status,'totalAmount',v_registration.total_amount,
    'qrToken',v_token,'idempotentReplay',false);
exception when unique_violation then raise exception 'EVENT_REGISTRATION_DUPLICATE';
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
  v_event public.events%rowtype;
  v_group public.event_groups%rowtype;
  v_participant jsonb;
  v_created jsonb;
  v_results jsonb := '[]'::jsonb;
  v_actor uuid := (select auth.uid());
  v_service boolean := (select private.is_service_request());
  v_participant_key text;
begin
  select * into v_event from public.events where id=p_event_id and deleted_at is null for update;
  if not found then raise exception 'EVENT_NOT_FOUND'; end if;
  if v_service then
    if v_event.visibility<>'PUBLIC' then raise exception 'EVENT_PUBLIC_ACCESS_DENIED'; end if;
  elsif not (select private.can_access_event_id(p_event_id,'events.registrations.manage')) then
    raise exception 'EVENT_ACCESS_DENIED';
  end if;
  if v_event.registration_status<>'OPEN' or v_event.status not in ('PUBLISHED','IN_PROGRESS') then
    raise exception 'EVENT_REGISTRATION_CLOSED';
  end if;
  if v_event.registration_mode not in ('GROUP','MIXED') then raise exception 'EVENT_GROUP_REGISTRATION_DISABLED'; end if;
  if jsonb_typeof(p_participants)<>'array' or jsonb_array_length(p_participants)=0 then raise exception 'EVENT_GROUP_PARTICIPANTS_REQUIRED'; end if;
  if p_idempotency_key is not null then
    select * into v_group from public.event_groups where event_id=p_event_id and idempotency_key=p_idempotency_key;
    if found then return jsonb_build_object('groupId',v_group.id,'idempotentReplay',true); end if;
  end if;
  insert into public.event_groups(
    church_id,event_id,origin_church_name,origin_field_name,origin_city,origin_state,
    responsible_name,responsible_phone,responsible_email,pastor_name,pastor_phone,
    status,notes,idempotency_key,created_by,updated_by
  ) values (
    v_event.church_id,p_event_id,nullif(btrim(p_payload->>'originChurchName'),''),nullif(btrim(p_payload->>'originFieldName'),''),
    btrim(p_payload->>'originCity'),upper(coalesce(nullif(btrim(p_payload->>'originState'),''),'GO')),
    btrim(p_payload->>'responsibleName'),nullif(btrim(p_payload->>'responsiblePhone'),''),nullif(lower(btrim(p_payload->>'responsibleEmail')),''),
    nullif(btrim(p_payload->>'pastorName'),''),nullif(btrim(p_payload->>'pastorPhone'),''),'PENDING',
    nullif(btrim(p_payload->>'notes'),''),p_idempotency_key,v_actor,v_actor
  ) returning * into v_group;
  for v_participant in select * from jsonb_array_elements(p_participants)
  loop
    v_participant_key:=case when p_idempotency_key is null then null else p_idempotency_key||':'||coalesce(v_participant->>'clientKey',md5(v_participant::text)) end;
    v_created:=public.create_event_registration_v3(p_event_id,v_participant||jsonb_build_object(
      'eventGroupId',v_group.id,'registrationSource','GROUP',
      'participantCity',coalesce(v_participant->>'participantCity',v_group.origin_city),
      'participantState',coalesce(v_participant->>'participantState',v_group.origin_state)
    ),v_participant_key);
    v_results:=v_results||jsonb_build_array(v_created);
  end loop;
  perform private.recalculate_event_group(v_group.id);
  return jsonb_build_object('groupId',v_group.id,'registrations',v_results,'idempotentReplay',false);
end;
$$;

revoke all on function public.change_event_lifecycle(uuid,text,text) from public,anon;
revoke all on function public.get_event_stats(uuid) from public,anon;
revoke all on function public.update_event_registration(uuid,uuid,timestamptz,jsonb) from public,anon;
revoke all on function public.create_event_registration_v3(uuid,jsonb,text) from public,anon;
revoke all on function public.create_event_group(uuid,jsonb,jsonb,text) from public,anon;
grant execute on function public.change_event_lifecycle(uuid,text,text) to authenticated;
grant execute on function public.get_event_stats(uuid) to authenticated;
grant execute on function public.update_event_registration(uuid,uuid,timestamptz,jsonb) to authenticated;
grant execute on function public.create_event_registration_v3(uuid,jsonb,text) to authenticated,service_role;
grant execute on function public.create_event_group(uuid,jsonb,jsonb,text) to authenticated,service_role;

-- A função vigente de criação continua responsável por estoque, capacidade e
-- idempotência. A checagem abaixo garante que somente eventos manualmente
-- abertos aceitem qualquer inserção, inclusive fluxos futuros.
create or replace function private.validate_event_registration_open()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare v_event public.events%rowtype;
begin
  select * into v_event from public.events where id=new.event_id and deleted_at is null;
  if not found then raise exception 'EVENT_NOT_FOUND'; end if;
  if v_event.registration_status<>'OPEN' or v_event.status not in ('PUBLISHED','IN_PROGRESS') then
    raise exception 'EVENT_REGISTRATION_CLOSED';
  end if;
  return new;
end;
$$;

drop trigger if exists validate_event_registration_open on public.event_registrations;
create trigger validate_event_registration_open
before insert on public.event_registrations
for each row execute function private.validate_event_registration_open();

create or replace function private.validate_event_configured_standard_fields()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if exists (select 1 from public.event_registration_fields where event_id=new.event_id and field_key='participant_gender' and visibility='REQUIRED' and is_active and deleted_at is null)
    and new.participant_gender is null then raise exception 'EVENT_REQUIRED_FIELD_MISSING'; end if;
  if exists (select 1 from public.event_registration_fields where event_id=new.event_id and field_key='participant_phone' and visibility='REQUIRED' and is_active and deleted_at is null)
    and coalesce(btrim(new.participant_phone),'')='' then raise exception 'EVENT_REQUIRED_FIELD_MISSING'; end if;
  if exists (select 1 from public.event_registration_fields where event_id=new.event_id and field_key='participant_email' and visibility='REQUIRED' and is_active and deleted_at is null)
    and coalesce(btrim(new.participant_email),'')='' then raise exception 'EVENT_REQUIRED_FIELD_MISSING'; end if;
  if exists (select 1 from public.event_registration_fields where event_id=new.event_id and field_key='participant_document' and visibility='REQUIRED' and is_active and deleted_at is null)
    and coalesce(btrim(new.participant_document),'')='' then raise exception 'EVENT_REQUIRED_FIELD_MISSING'; end if;
  if exists (select 1 from public.event_registration_fields where event_id=new.event_id and field_key='participant_birth_date' and visibility='REQUIRED' and is_active and deleted_at is null)
    and new.participant_birth_date is null then raise exception 'EVENT_REQUIRED_FIELD_MISSING'; end if;
  if exists (select 1 from public.event_registration_fields where event_id=new.event_id and field_key='congregation_id' and visibility='REQUIRED' and is_active and deleted_at is null)
    and new.congregation_id is null then raise exception 'EVENT_REQUIRED_FIELD_MISSING'; end if;
  if exists (select 1 from public.event_registration_fields where event_id=new.event_id and field_key='region_id' and visibility='REQUIRED' and is_active and deleted_at is null)
    and not exists (select 1 from public.congregations congregation where congregation.id=new.congregation_id and congregation.region_id is not null and congregation.deleted_at is null)
    then raise exception 'EVENT_REQUIRED_FIELD_MISSING'; end if;
  if exists (select 1 from public.event_registration_fields where event_id=new.event_id and field_key='participant_role_id' and visibility='REQUIRED' and is_active and deleted_at is null)
    and coalesce(new.metadata->>'participantRoleId','')='' then raise exception 'EVENT_REQUIRED_FIELD_MISSING'; end if;
  if exists (select 1 from public.event_registration_fields where event_id=new.event_id and field_key='participant_city' and visibility='REQUIRED' and is_active and deleted_at is null)
    and coalesce(btrim(new.participant_city),'')='' then raise exception 'EVENT_REQUIRED_FIELD_MISSING'; end if;
  if exists (select 1 from public.event_registration_fields where event_id=new.event_id and field_key='participant_state' and visibility='REQUIRED' and is_active and deleted_at is null)
    and coalesce(btrim(new.participant_state),'')='' then raise exception 'EVENT_REQUIRED_FIELD_MISSING'; end if;
  if exists (select 1 from public.event_registration_fields where event_id=new.event_id and field_key='responsible_name' and visibility='REQUIRED' and is_active and deleted_at is null)
    and coalesce(btrim(new.responsible_name),'')='' then raise exception 'EVENT_REQUIRED_FIELD_MISSING'; end if;
  if exists (select 1 from public.event_registration_fields where event_id=new.event_id and field_key='responsible_phone' and visibility='REQUIRED' and is_active and deleted_at is null)
    and coalesce(btrim(new.responsible_phone),'')='' then raise exception 'EVENT_REQUIRED_FIELD_MISSING'; end if;
  return new;
end;
$$;

drop trigger if exists validate_event_configured_standard_fields on public.event_registrations;
create trigger validate_event_configured_standard_fields
before insert or update of participant_gender,participant_phone,participant_email,participant_document,
  participant_birth_date,congregation_id,participant_city,participant_state,responsible_name,responsible_phone,metadata
on public.event_registrations for each row execute function private.validate_event_configured_standard_fields();

create or replace function public.change_event_deletion_state(p_event_id uuid,p_action text)
returns public.events
language plpgsql
security definer
set search_path=''
as $$
declare v_event public.events%rowtype; v_actor uuid:=(select auth.uid());
begin
  select * into v_event from public.events where id=p_event_id for update;
  if not found then raise exception 'EVENT_NOT_FOUND'; end if;
  if not (select private.can_access_event_values(v_event.church_id,v_event.event_scope,v_event.region_id,v_event.congregation_id,v_event.ministry_id,'events.manage')) then raise exception 'EVENT_ACCESS_DENIED'; end if;
  if upper(p_action)='DELETE' then
    if v_event.status<>'DRAFT'
      or exists(select 1 from public.event_registrations where event_id=p_event_id)
      or exists(select 1 from public.event_payments where event_id=p_event_id)
      or exists(select 1 from public.event_checkins where event_id=p_event_id)
      or exists(select 1 from public.event_documents where event_id=p_event_id)
      or exists(select 1 from public.event_expenses where event_id=p_event_id and deleted_at is null) then
      raise exception 'EVENT_DELETE_NOT_ALLOWED';
    end if;
    update public.events set deleted_at=now(),deleted_by=v_actor,updated_by=v_actor where id=p_event_id returning * into v_event;
  elsif upper(p_action)='RESTORE' then
    update public.events set deleted_at=null,deleted_by=null,updated_by=v_actor where id=p_event_id returning * into v_event;
  else raise exception 'EVENT_DELETE_ACTION_INVALID'; end if;
  perform public.log_audit(v_event.church_id,'EVENTS',upper(p_action),'EVENT',v_event.id,v_event.name,
    case when upper(p_action)='DELETE' then 'Evento enviado para a lixeira' else 'Evento restaurado da lixeira' end,
    null,jsonb_build_object('deleted_at',v_event.deleted_at),'{}'::jsonb,'WARNING');
  return v_event;
end;
$$;

-- ---------------------------------------------------------------------------
-- RLS, grants e Storage.
-- ---------------------------------------------------------------------------

do $$
declare v_table text; v_policy record;
begin
  foreach v_table in array array['event_registration_fields','event_registration_field_values','event_expenses']
  loop
    execute format('alter table public.%I enable row level security',v_table);
    for v_policy in select policyname from pg_policies where schemaname='public' and tablename=v_table
    loop execute format('drop policy if exists %I on public.%I',v_policy.policyname,v_table); end loop;
    execute format('revoke all on table public.%I from anon',v_table);
    execute format('revoke all on table public.%I from authenticated',v_table);
    execute format('grant select,insert,update on table public.%I to authenticated',v_table);
    execute format('grant all on table public.%I to service_role',v_table);
  end loop;
end $$;

create policy event_registration_fields_select_scoped on public.event_registration_fields for select to authenticated
using (deleted_at is null and (select private.can_access_event_id(event_id,'events.view')));
create policy event_registration_fields_insert_scoped on public.event_registration_fields for insert to authenticated
with check ((select private.can_access_event_id(event_id,'events.manage')));
create policy event_registration_fields_update_scoped on public.event_registration_fields for update to authenticated
using ((select private.can_access_event_id(event_id,'events.manage')))
with check ((select private.can_access_event_id(event_id,'events.manage')));

create policy event_registration_field_values_select_scoped on public.event_registration_field_values for select to authenticated
using (deleted_at is null and (select private.can_access_event_id(event_id,'events.registrations.view')));
create policy event_registration_field_values_insert_scoped on public.event_registration_field_values for insert to authenticated
with check ((select private.can_access_event_id(event_id,'events.registrations.manage')));
create policy event_registration_field_values_update_scoped on public.event_registration_field_values for update to authenticated
using ((select private.can_access_event_id(event_id,'events.registrations.manage')))
with check ((select private.can_access_event_id(event_id,'events.registrations.manage')));

create policy event_expenses_select_scoped on public.event_expenses for select to authenticated
using (deleted_at is null and (select private.can_access_event_id(event_id,'events.expenses.view')));
create policy event_expenses_insert_scoped on public.event_expenses for insert to authenticated
with check ((select private.can_access_event_id(event_id,'events.expenses.manage')));
create policy event_expenses_update_scoped on public.event_expenses for update to authenticated
using ((select private.can_access_event_id(event_id,'events.expenses.manage')))
with check ((select private.can_access_event_id(event_id,'events.expenses.manage')));

drop policy if exists event_documents_storage_select on storage.objects;
create policy event_documents_storage_select on storage.objects for select to authenticated
using (
  bucket_id='event-documents' and (storage.foldername(name))[2]='events' and (
    ((storage.foldername(name))[4]='documents' and (select private.can_access_event_id(((storage.foldername(name))[3])::uuid,'events.documents.view')))
    or ((storage.foldername(name))[4]='payment-receipts' and (select private.can_access_event_id(((storage.foldername(name))[3])::uuid,'events.payments.view')))
    or ((storage.foldername(name))[4]='expenses' and (select private.can_access_event_id(((storage.foldername(name))[3])::uuid,'events.expenses.view')))
  )
);
drop policy if exists event_documents_storage_insert on storage.objects;
create policy event_documents_storage_insert on storage.objects for insert to authenticated
with check (
  bucket_id='event-documents' and (storage.foldername(name))[2]='events' and (
    ((storage.foldername(name))[4]='documents' and (select private.can_access_event_id(((storage.foldername(name))[3])::uuid,'events.documents.manage')))
    or ((storage.foldername(name))[4]='payment-receipts' and (select private.can_access_event_id(((storage.foldername(name))[3])::uuid,'events.payments.manage')))
    or ((storage.foldername(name))[4]='expenses' and (select private.can_access_event_id(((storage.foldername(name))[3])::uuid,'events.expenses.manage')))
  )
);
drop policy if exists event_documents_storage_update on storage.objects;
create policy event_documents_storage_update on storage.objects for update to authenticated
using (
  bucket_id='event-documents' and (storage.foldername(name))[2]='events' and (
    ((storage.foldername(name))[4]='documents' and (select private.can_access_event_id(((storage.foldername(name))[3])::uuid,'events.documents.manage')))
    or ((storage.foldername(name))[4]='payment-receipts' and (select private.can_access_event_id(((storage.foldername(name))[3])::uuid,'events.payments.manage')))
    or ((storage.foldername(name))[4]='expenses' and (select private.can_access_event_id(((storage.foldername(name))[3])::uuid,'events.expenses.manage')))
  )
) with check (
  bucket_id='event-documents' and (storage.foldername(name))[2]='events' and (
    ((storage.foldername(name))[4]='documents' and (select private.can_access_event_id(((storage.foldername(name))[3])::uuid,'events.documents.manage')))
    or ((storage.foldername(name))[4]='payment-receipts' and (select private.can_access_event_id(((storage.foldername(name))[3])::uuid,'events.payments.manage')))
    or ((storage.foldername(name))[4]='expenses' and (select private.can_access_event_id(((storage.foldername(name))[3])::uuid,'events.expenses.manage')))
  )
);
drop policy if exists event_documents_storage_delete on storage.objects;
create policy event_documents_storage_delete on storage.objects for delete to authenticated
using (
  bucket_id='event-documents' and (storage.foldername(name))[2]='events' and (
    ((storage.foldername(name))[4]='documents' and (select private.can_access_event_id(((storage.foldername(name))[3])::uuid,'events.documents.manage')))
    or ((storage.foldername(name))[4]='payment-receipts' and (select private.can_access_event_id(((storage.foldername(name))[3])::uuid,'events.payments.manage')))
    or ((storage.foldername(name))[4]='expenses' and (select private.can_access_event_id(((storage.foldername(name))[3])::uuid,'events.expenses.manage')))
  )
);

-- Atualização automática de datas e auditoria das novas tabelas.
do $$ declare v_table text;
begin
  foreach v_table in array array['event_registration_fields','event_registration_field_values','event_expenses']
  loop
    execute format('drop trigger if exists set_%I_updated_at on public.%I',v_table,v_table);
    execute format('create trigger set_%I_updated_at before update on public.%I for each row execute function public.set_updated_at()',v_table,v_table);
    execute format('drop trigger if exists audit_%I_domain_change on public.%I',v_table,v_table);
    execute format('create trigger audit_%I_domain_change after insert or update or delete on public.%I for each row execute function private.audit_event_domain_change()',v_table,v_table);
  end loop;
end $$;

commit;
