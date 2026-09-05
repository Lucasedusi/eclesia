begin;

-- Caravanas passam a ser inscrições coletivas autônomas. O fluxo individual
-- permanece em event_registrations e não cria mais inscrições-filhas.

insert into public.permissions (key,name,description,module,action,is_sensitive,status)
select proposed.*
from (values
  ('events.groups.view','Visualizar caravanas','Consultar caravanas e seus totais','events','groups_view',true,'ACTIVE'),
  ('events.groups.manage','Gerenciar caravanas','Cadastrar, editar e cancelar caravanas','events','groups_manage',true,'ACTIVE'),
  ('events.payments.approve','Aprovar pagamentos de eventos','Aprovar ou rejeitar comprovantes de pagamentos','events','payments_approve',true,'ACTIVE')
) proposed(key,name,description,module,action,is_sensitive,status)
where not exists (select 1 from public.permissions permission where permission.key=proposed.key);

update public.permissions set status='ACTIVE',deleted_at=null,updated_at=now()
where key in ('events.groups.view','events.groups.manage','events.payments.approve');

with grants(role,permission_key) as (values
  ('ADMIN','events.groups.view'),('ADMIN','events.groups.manage'),('ADMIN','events.payments.approve'),
  ('SECRETARY','events.groups.view'),('SECRETARY','events.groups.manage'),('SECRETARY','events.payments.approve'),
  ('TREASURER','events.groups.view'),('TREASURER','events.payments.approve'),
  ('LEADER','events.groups.view'),('LEADER','events.groups.manage'),
  ('MINISTRY_LEADER','events.groups.view'),('MINISTRY_LEADER','events.groups.manage')
)
insert into public.role_permissions(role,permission_id,status)
select grants.role,permission.id,'ACTIVE'
from grants join public.permissions permission on permission.key=grants.permission_key
where not exists (
  select 1 from public.role_permissions existing
  where existing.role=grants.role and existing.permission_id=permission.id and existing.deleted_at is null
);

alter table public.events drop constraint if exists events_registration_mode_check;
alter table public.events drop constraint if exists events_registration_mode_v2_check;
alter table public.events drop constraint if exists event_registration_mode_check;
update public.events set registration_mode='MIXED' where registration_mode='GROUP';
alter table public.events add constraint events_registration_mode_check
  check (registration_mode in ('INDIVIDUAL','MIXED'));
alter table public.events add column if not exists caravan_sequence integer not null default 0;

-- O procedimento legado recebia nomes e criava inscrições-filhas. Ele fica
-- indisponível para todos os papéis de aplicação; o novo fluxo usa somente
-- create_event_caravan, que persiste a quantidade agregada.
revoke all on function public.create_event_group(uuid,jsonb,jsonb,text) from public,anon,authenticated,service_role;

create table if not exists public.event_payment_settings (
  id uuid primary key default gen_random_uuid(),
  church_id uuid not null references public.churches(id) on delete restrict,
  event_id uuid not null references public.events(id) on delete cascade,
  allow_participant_list boolean not null default true,
  allowed_file_types text[] not null default array['application/pdf','image/jpeg','image/png','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
  max_file_size bigint not null default 10485760,
  caravan_registration_item_id uuid references public.event_items(id) on delete restrict,
  pix_enabled boolean not null default false,
  pix_key text,
  pix_holder_name text,
  pix_qr_storage_bucket text,
  pix_qr_storage_path text,
  pix_qr_file_name text,
  cash_enabled boolean not null default false,
  whatsapp_number text,
  payment_instructions text,
  created_by uuid references public.profiles(id) on delete restrict,
  updated_by uuid references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  deleted_by uuid references public.profiles(id) on delete restrict,
  constraint event_payment_settings_event_unique unique(event_id),
  constraint event_payment_settings_valid_check check (
    max_file_size between 1 and 10485760
    and (not pix_enabled or (coalesce(btrim(pix_key),'')<>'' and coalesce(btrim(pix_holder_name),'')<>''))
    and (pix_enabled or cash_enabled or (pix_key is null and pix_holder_name is null))
  )
);

do $$ begin
  if not exists (select 1 from pg_constraint where conname='event_payment_settings_event_tenant_fkey') then
    alter table public.event_payment_settings add constraint event_payment_settings_event_tenant_fkey
      foreign key (church_id,event_id) references public.events(church_id,id) on delete cascade;
  end if;
  if not exists (select 1 from pg_constraint where conname='event_payment_settings_item_tenant_fkey') then
    alter table public.event_payment_settings add constraint event_payment_settings_item_tenant_fkey
      foreign key (church_id,event_id,caravan_registration_item_id)
      references public.event_items(church_id,event_id,id) on delete restrict;
  end if;
end $$;

create unique index if not exists event_payment_settings_tenant_key
  on public.event_payment_settings(church_id,event_id,id);
create index if not exists event_payment_settings_event_idx
  on public.event_payment_settings(event_id) where deleted_at is null;

alter table public.event_payment_settings enable row level security;
drop policy if exists event_payment_settings_select_scoped on public.event_payment_settings;
drop policy if exists event_payment_settings_insert_scoped on public.event_payment_settings;
drop policy if exists event_payment_settings_update_scoped on public.event_payment_settings;
create policy event_payment_settings_select_scoped on public.event_payment_settings for select to authenticated
using (deleted_at is null and (select private.can_access_event_id(event_id,'events.view')));
create policy event_payment_settings_insert_scoped on public.event_payment_settings for insert to authenticated
with check ((select private.can_access_event_id(event_id,'events.manage')));
create policy event_payment_settings_update_scoped on public.event_payment_settings for update to authenticated
using ((select private.can_access_event_id(event_id,'events.manage')))
with check ((select private.can_access_event_id(event_id,'events.manage')));
revoke all on table public.event_payment_settings from public,anon;
grant select,insert,update on table public.event_payment_settings to authenticated;
grant select,insert,update,delete on table public.event_payment_settings to service_role;

drop trigger if exists set_event_payment_settings_updated_at on public.event_payment_settings;
create trigger set_event_payment_settings_updated_at before update on public.event_payment_settings
for each row execute function public.set_updated_at();

create or replace function private.protect_event_payment_settings()
returns trigger language plpgsql security definer set search_path='' as $$
begin
  if tg_op='UPDATE' and (old.church_id is distinct from new.church_id or old.event_id is distinct from new.event_id) then
    raise exception 'EVENT_PAYMENT_SETTINGS_OWNER_LOCKED';
  end if;
  if tg_op='INSERT' then
    new.created_by:=coalesce(new.created_by,(select auth.uid()));
  else
    new.created_by:=old.created_by;
  end if;
  new.updated_by:=coalesce(new.updated_by,(select auth.uid()));
  return new;
end;$$;
drop trigger if exists protect_event_payment_settings on public.event_payment_settings;
create trigger protect_event_payment_settings before insert or update on public.event_payment_settings
for each row execute function private.protect_event_payment_settings();

create or replace function private.audit_event_payment_settings()
returns trigger language plpgsql security definer set search_path='' as $$
declare v_old jsonb;v_new jsonb;
begin
  v_old:=case when tg_op='INSERT' then null else jsonb_build_object('pixEnabled',old.pix_enabled,'cashEnabled',old.cash_enabled,'allowParticipantList',old.allow_participant_list,'mainItemId',old.caravan_registration_item_id,'hasQrCode',old.pix_qr_storage_path is not null,'hasWhatsapp',old.whatsapp_number is not null) end;
  v_new:=jsonb_build_object('pixEnabled',new.pix_enabled,'cashEnabled',new.cash_enabled,'allowParticipantList',new.allow_participant_list,'mainItemId',new.caravan_registration_item_id,'hasQrCode',new.pix_qr_storage_path is not null,'hasWhatsapp',new.whatsapp_number is not null);
  if tg_op='UPDATE' and v_old=v_new then return null;end if;
  perform public.log_audit(new.church_id,'EVENTS',case when tg_op='INSERT' then 'CREATE_CARAVAN_SETTINGS' else 'UPDATE_CARAVAN_SETTINGS' end,'EVENT_PAYMENT_SETTINGS',new.id,'Configuração coletiva','Configuração de caravanas atualizada',v_old,v_new,jsonb_build_object('event_id',new.event_id),'INFO');
  return null;
end;$$;
drop trigger if exists audit_event_payment_settings on public.event_payment_settings;
create trigger audit_event_payment_settings after insert or update on public.event_payment_settings
for each row execute function private.audit_event_payment_settings();

alter table public.event_groups
  add column if not exists group_number text,
  add column if not exists source text not null default 'INTERNAL',
  add column if not exists unspecified_count integer not null default 0,
  add column if not exists total_amount numeric(12,2) not null default 0,
  add column if not exists paid_amount numeric(12,2) not null default 0,
  add column if not exists payment_status text not null default 'PENDING',
  add column if not exists verification_token_hash text,
  add column if not exists verification_token_last4 text,
  add column if not exists confirmed_at timestamptz,
  add column if not exists cancelled_at timestamptz,
  add column if not exists cancelled_by uuid references public.profiles(id) on delete restrict,
  add column if not exists cancel_reason text,
  add column if not exists metadata jsonb not null default '{}'::jsonb;

-- Converte grupos antigos sem perder os nomes previamente informados. Os nomes
-- permanecem apenas no snapshot histórico; relatórios novos usam o agregado.
with ranked as (
  select id,event_id,row_number() over(partition by event_id order by created_at,id) sequence
  from public.event_groups
)
update public.event_groups event_group
set group_number='CAR-'||lpad(ranked.sequence::text,6,'0')
from ranked where ranked.id=event_group.id and event_group.group_number is null;

update public.events event
set caravan_sequence=coalesce((select max(substring(event_group.group_number from 5)::integer)
  from public.event_groups event_group where event_group.event_id=event.id),0);

with snapshots as (
  select registration.event_group_id,
    jsonb_agg(jsonb_build_object(
      'id',registration.id,'registrationNumber',registration.registration_number,
      'participantName',registration.participant_name,'participantGender',registration.participant_gender,
      'status',registration.status
    ) order by registration.registered_at,registration.id) participants,
    count(*)::integer total,
    count(*) filter(where registration.participant_gender='MALE')::integer male,
    count(*) filter(where registration.participant_gender='FEMALE')::integer female,
    count(*) filter(where registration.participant_gender is null or registration.participant_gender not in ('MALE','FEMALE'))::integer unspecified
  from public.event_registrations registration
  where registration.event_group_id is not null and registration.deleted_at is null
  group by registration.event_group_id
)
update public.event_groups event_group
set total_registrations=snapshots.total,male_count=snapshots.male,female_count=snapshots.female,
    unspecified_count=snapshots.unspecified,
    metadata=coalesce(event_group.metadata,'{}'::jsonb)||jsonb_build_object('legacyParticipantSnapshot',snapshots.participants,'convertedAt',now()),
    source=case when exists(select 1 from public.event_registrations registration where registration.event_group_id=event_group.id and registration.registration_source='PUBLIC') then 'PUBLIC' else 'INTERNAL' end,
    status=case when event_group.status='CANCELLED' then 'CANCELLED' else 'CONFIRMED' end,
    confirmed_at=case when event_group.status='CANCELLED' then event_group.confirmed_at else coalesce(event_group.confirmed_at,event_group.created_at) end
from snapshots where snapshots.event_group_id=event_group.id;

insert into public.event_registration_items(
  church_id,event_id,event_group_id,event_item_id,item_name,item_type,size,quantity,unit_price,metadata,created_by,updated_by
)
select registration_item.church_id,registration_item.event_id,registration.event_group_id,
  registration_item.event_item_id,registration_item.item_name,registration_item.item_type,registration_item.size,
  sum(registration_item.quantity)::integer,registration_item.unit_price,
  jsonb_build_object('convertedFromLegacyRegistrations',true),null,null
from public.event_registration_items registration_item
join public.event_registrations registration on registration.id=registration_item.event_registration_id
where registration.event_group_id is not null and registration_item.deleted_at is null and registration.deleted_at is null
group by registration_item.church_id,registration_item.event_id,registration.event_group_id,
  registration_item.event_item_id,registration_item.item_name,registration_item.item_type,registration_item.size,registration_item.unit_price;

update public.event_payments payment set event_group_id=registration.event_group_id,event_registration_id=null
from public.event_registrations registration
where payment.event_registration_id=registration.id and registration.event_group_id is not null;

update public.event_documents document set event_group_id=registration.event_group_id,event_registration_id=null
from public.event_registrations registration
where document.event_registration_id=registration.id and registration.event_group_id is not null;

update public.event_checkins checkin set status='CANCELLED',cancelled_at=coalesce(checkin.cancelled_at,now()),
  cancel_reason=coalesce(checkin.cancel_reason,'Convertido para controle coletivo de caravana')
from public.event_registrations registration
where checkin.event_registration_id=registration.id and registration.event_group_id is not null and checkin.status<>'CANCELLED';

update public.event_registration_items item set deleted_at=coalesce(item.deleted_at,now())
from public.event_registrations registration
where item.event_registration_id=registration.id and registration.event_group_id is not null and item.deleted_at is null;

update public.event_registrations set status='CANCELLED',cancelled_at=coalesce(cancelled_at,now()),
  cancel_reason=coalesce(cancel_reason,'Convertida para inscrição coletiva de caravana'),deleted_at=coalesce(deleted_at,now())
where event_group_id is not null and deleted_at is null;

-- Registros legados incompletos permanecem rastreáveis e cancelados, sem que
-- a migration invente participantes ou descarte documentos financeiros.
update public.event_groups set
  origin_church_name=coalesce(nullif(btrim(origin_church_name),''),'Origem não informada'),
  origin_city=coalesce(nullif(btrim(origin_city),''),'Cidade não informada'),
  origin_state=case when upper(btrim(origin_state))~'^[A-Z]{2}$' then upper(btrim(origin_state)) else 'NA' end,
  responsible_name=coalesce(nullif(btrim(responsible_name),''),'Responsável não informado'),
  responsible_phone=coalesce(nullif(btrim(responsible_phone),''),'Não informado'),
  pastor_name=coalesce(nullif(btrim(pastor_name),''),'Pastor(a) não informado'),
  total_registrations=greatest(total_registrations,male_count+female_count+unspecified_count),
  unspecified_count=greatest(total_registrations,male_count+female_count+unspecified_count)-male_count-female_count,
  status=case when greatest(total_registrations,male_count+female_count+unspecified_count)<=0 then 'CANCELLED' else status end,
  source=case when source in ('INTERNAL','PUBLIC') then source else 'INTERNAL' end;

alter table public.event_groups drop constraint if exists event_group_valid_check;
alter table public.event_groups add constraint event_group_valid_check check (
  coalesce(btrim(origin_church_name),'')<>'' and btrim(origin_city)<>'' and origin_state~'^[A-Z]{2}$'
  and btrim(responsible_name)<>'' and coalesce(btrim(responsible_phone),'')<>'' and coalesce(btrim(pastor_name),'')<>''
  and ((status='CONFIRMED' and total_registrations>0) or (status='CANCELLED' and total_registrations>=0))
  and male_count>=0 and female_count>=0 and unspecified_count>=0
  and total_registrations=male_count+female_count+unspecified_count
  and total_amount>=0 and paid_amount>=0
  and status in ('CONFIRMED','CANCELLED')
  and payment_status in ('NOT_REQUIRED','PENDING','PARTIAL','PAID','REFUNDED')
  and source in ('INTERNAL','PUBLIC')
);

create unique index if not exists event_groups_number_unique_idx on public.event_groups(event_id,group_number);
create unique index if not exists event_groups_verification_token_unique_idx on public.event_groups(verification_token_hash) where verification_token_hash is not null;
create index if not exists event_groups_filters_idx on public.event_groups(event_id,status,payment_status,source,origin_state,origin_city,created_at desc) where deleted_at is null;

alter table public.event_public_checkouts alter column registration_id drop not null;
alter table public.event_public_checkouts add column if not exists group_id uuid references public.event_groups(id) on delete cascade;
alter table public.event_public_checkouts
  add column if not exists checkout_type text not null default 'INDIVIDUAL',
  add column if not exists draft_payload jsonb not null default '{}'::jsonb;
alter table public.event_public_checkouts drop constraint if exists event_public_checkouts_status_check;
alter table public.event_public_checkouts add constraint event_public_checkouts_status_check check (
  status in ('DRAFT','AWAITING_PAYMENT','PROCESSING','COMPLETED','FAILED','EXPIRED','CANCELLED')
);
alter table public.event_public_checkouts drop constraint if exists event_public_checkouts_type_check;
alter table public.event_public_checkouts add constraint event_public_checkouts_type_check check (
  checkout_type in ('INDIVIDUAL','CARAVAN')
);
alter table public.event_public_checkouts drop constraint if exists event_public_checkouts_group_unique;
alter table public.event_public_checkouts add constraint event_public_checkouts_group_unique unique(group_id);
alter table public.event_public_checkouts drop constraint if exists event_public_checkouts_owner_xor_check;
alter table public.event_public_checkouts add constraint event_public_checkouts_owner_xor_check check (
  (status='DRAFT' and checkout_type='CARAVAN' and registration_id is null and group_id is null)
  or (status<>'DRAFT' and (registration_id is not null)::integer+(group_id is not null)::integer=1)
);
create index if not exists event_public_caravan_drafts_expiration_idx
  on public.event_public_checkouts(event_id,expires_at)
  where checkout_type='CARAVAN' and status='DRAFT';

drop policy if exists event_groups_select_scoped on public.event_groups;
drop policy if exists event_groups_insert_scoped on public.event_groups;
drop policy if exists event_groups_update_scoped on public.event_groups;
create policy event_groups_select_scoped on public.event_groups for select to authenticated
using (deleted_at is null and (select private.can_access_event_id(event_id,'events.groups.view')));
create policy event_groups_insert_scoped on public.event_groups for insert to authenticated
with check ((select private.can_access_event_id(event_id,'events.groups.manage')));
create policy event_groups_update_scoped on public.event_groups for update to authenticated
using ((select private.can_access_event_id(event_id,'events.groups.manage')))
with check ((select private.can_access_event_id(event_id,'events.groups.manage')));
revoke insert,update,delete on table public.event_groups from authenticated;
grant select on table public.event_groups to authenticated;

create or replace function private.recalculate_event_group(p_group_id uuid)
returns void language plpgsql security definer set search_path='' as $$
declare v_total numeric(12,2);v_paid numeric(12,2);v_had_refund boolean;
begin
  select coalesce(sum(total_price),0) into v_total from public.event_registration_items
  where event_group_id=p_group_id and deleted_at is null;
  select coalesce(sum(amount),0) into v_paid from public.event_payments
  where event_group_id=p_group_id and payment_status='CONFIRMED' and deleted_at is null;
  select exists(select 1 from public.event_payments
    where event_group_id=p_group_id and payment_status='REFUNDED' and deleted_at is null)
  into v_had_refund;
  update public.event_groups set total_amount=v_total,paid_amount=v_paid,
    payment_status=case when v_total<=0 then 'NOT_REQUIRED' when v_paid>=v_total then 'PAID'
      when v_paid>0 then 'PARTIAL' when v_had_refund then 'REFUNDED' else 'PENDING' end
  where id=p_group_id;
end;$$;

do $$ declare v_group_id uuid;begin
  for v_group_id in select id from public.event_groups where deleted_at is null loop
    perform private.recalculate_event_group(v_group_id);
  end loop;
end $$;

-- O limite do evento considera pessoas individuais e vagas coletivas. Também
-- bloqueia mudanças críticas quando qualquer um dos dois fluxos já foi usado.
create or replace function private.protect_event_configuration()
returns trigger language plpgsql security definer set search_path='' as $$
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
  if (
    exists(select 1 from public.event_registrations where event_id=old.id and deleted_at is null)
    or exists(select 1 from public.event_groups where event_id=old.id and deleted_at is null)
  ) and (
    old.church_id is distinct from new.church_id or old.event_scope is distinct from new.event_scope
    or old.region_id is distinct from new.region_id or old.congregation_id is distinct from new.congregation_id
    or old.ministry_id is distinct from new.ministry_id or old.registration_mode is distinct from new.registration_mode
    or old.quota_mode is distinct from new.quota_mode
  ) then raise exception 'EVENT_CRITICAL_CONFIGURATION_LOCKED'; end if;
  if new.capacity is not null and (old.capacity is null or new.capacity<old.capacity) then
    select
      (select count(*) from public.event_registrations registration
        where registration.event_id=old.id and registration.event_group_id is null
          and registration.status in ('PENDING','CONFIRMED','CHECKED_IN') and registration.deleted_at is null)
      +coalesce((select sum(event_group.total_registrations) from public.event_groups event_group
        where event_group.event_id=old.id and event_group.status='CONFIRMED' and event_group.deleted_at is null),0)
    into v_used;
    if new.capacity<v_used then raise exception 'EVENT_CAPACITY_BELOW_USAGE'; end if;
  end if;
  return new;
end;$$;

create or replace function private.apply_event_lifecycle_side_effects()
returns trigger language plpgsql security definer set search_path='' as $$
begin
  if old.status is distinct from new.status and new.status='CANCELLED' then
    update public.event_registrations set status='CANCELLED',cancelled_at=now(),cancelled_by=new.cancelled_by,
      cancel_reason='Evento cancelado: '||new.cancel_reason,updated_by=new.cancelled_by
    where event_id=new.id and status in ('PENDING','CONFIRMED','WAITLIST') and deleted_at is null;
    update public.event_groups set status='CANCELLED',cancelled_at=now(),cancelled_by=new.cancelled_by,
      cancel_reason='Evento cancelado: '||new.cancel_reason,updated_by=new.cancelled_by
    where event_id=new.id and status='CONFIRMED' and deleted_at is null;
    update public.event_checkins set status='CANCELLED',cancelled_at=now(),cancelled_by=new.cancelled_by,
      cancel_reason='Evento cancelado'
    where event_id=new.id and status='CHECKED_IN' and deleted_at is null;
  elsif old.status is distinct from new.status and new.status='FINISHED' then
    update public.event_registrations registration set status='NO_SHOW',updated_by=new.finished_by
    where registration.event_id=new.id and registration.status='CONFIRMED' and registration.deleted_at is null
      and not exists(select 1 from public.event_checkins checkin where checkin.event_registration_id=registration.id and checkin.status='CHECKED_IN' and checkin.deleted_at is null);
  end if;
  return null;
end;$$;

create or replace function private.validate_event_capacity_v2()
returns trigger language plpgsql security definer set search_path='' as $$
declare v_event public.events%rowtype;v_occupied integer;
begin
  select * into v_event from public.events where id=new.event_id and deleted_at is null for update;
  if not found then raise exception 'EVENT_NOT_FOUND'; end if;
  if v_event.registration_status<>'OPEN' or v_event.status not in ('PUBLISHED','IN_PROGRESS') then raise exception 'EVENT_REGISTRATION_CLOSED'; end if;
  if new.event_group_id is null and new.status in ('PENDING','CONFIRMED','CHECKED_IN') and new.deleted_at is null and v_event.capacity is not null then
    select (select count(*) from public.event_registrations registration where registration.event_id=new.event_id and registration.id is distinct from new.id and registration.event_group_id is null and registration.status in ('PENDING','CONFIRMED','CHECKED_IN') and registration.deleted_at is null)
      +coalesce((select sum(event_group.total_registrations) from public.event_groups event_group where event_group.event_id=new.event_id and event_group.status='CONFIRMED' and event_group.deleted_at is null),0)
    into v_occupied;
    if v_occupied>=v_event.capacity then raise exception 'EVENT_CAPACITY_FULL'; end if;
  end if;
  return new;
end;$$;

drop trigger if exists validate_event_registration_open on public.event_registrations;
create trigger validate_event_registration_open before insert on public.event_registrations
for each row execute function private.validate_event_capacity_v2();

create or replace function private.protect_event_item_limits()
returns trigger language plpgsql security definer set search_path='' as $$
declare v_used integer;
begin
  if new.available_quantity is not null then
    select (
      coalesce((select sum(item.quantity) from public.event_registration_items item join public.event_registrations registration on registration.id=item.event_registration_id where item.event_item_id=old.id and registration.status in ('PENDING','CONFIRMED','CHECKED_IN') and item.deleted_at is null and registration.deleted_at is null),0)
      +coalesce((select sum(item.quantity) from public.event_registration_items item join public.event_groups event_group on event_group.id=item.event_group_id where item.event_item_id=old.id and event_group.status='CONFIRMED' and item.deleted_at is null and event_group.deleted_at is null),0)
    )::integer into v_used;
    if new.available_quantity<v_used then raise exception 'EVENT_ITEM_STOCK_BELOW_USAGE';end if;
  end if;
  return new;
end;$$;

create or replace function private.validate_event_item_stock_v2()
returns trigger language plpgsql security definer set search_path='' as $$
declare v_catalog public.event_items%rowtype;v_used integer;v_owner_active boolean;
begin
  if new.deleted_at is not null then return new; end if;
  select * into v_catalog from public.event_items where id=new.event_item_id and event_id=new.event_id for update;
  if not found or not v_catalog.is_active or v_catalog.deleted_at is not null then raise exception 'EVENT_ITEM_NOT_AVAILABLE'; end if;
  if new.quantity<=0 then raise exception 'EVENT_ITEM_QUANTITY_INVALID'; end if;
  select (
    coalesce((select sum(item.quantity) from public.event_registration_items item join public.event_registrations registration on registration.id=item.event_registration_id where item.event_item_id=new.event_item_id and item.id is distinct from new.id and item.deleted_at is null and registration.status in ('PENDING','CONFIRMED','CHECKED_IN') and registration.deleted_at is null),0)
    +coalesce((select sum(item.quantity) from public.event_registration_items item join public.event_groups event_group on event_group.id=item.event_group_id where item.event_item_id=new.event_item_id and item.id is distinct from new.id and item.deleted_at is null and event_group.status='CONFIRMED' and event_group.deleted_at is null),0)
  )::integer into v_used;
  if v_catalog.available_quantity is not null and v_used+new.quantity>v_catalog.available_quantity then raise exception 'EVENT_ITEM_STOCK_EXCEEDED'; end if;
  return new;
end;$$;
drop trigger if exists validate_event_item_stock_v2 on public.event_registration_items;
create trigger validate_event_item_stock_v2 before insert or update of quantity,event_item_id,deleted_at on public.event_registration_items
for each row execute function private.validate_event_item_stock_v2();

create or replace function public.validate_event_caravan_draft(p_event_id uuid,p_payload jsonb,p_items jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare
  v_event public.events%rowtype;v_setting public.event_payment_settings%rowtype;v_item jsonb;
  v_catalog public.event_items%rowtype;v_total integer;v_male integer;v_female integer;
  v_individuals integer;v_caravans integer;v_quantity integer;v_used integer;v_amount numeric(12,2):=0;
begin
  if not (select private.is_service_request()) then raise exception 'EVENT_PUBLIC_ACCESS_DENIED';end if;
  select * into v_event from public.events where id=p_event_id and visibility='PUBLIC' and deleted_at is null;
  if not found then raise exception 'EVENT_NOT_FOUND';end if;
  if v_event.registration_status<>'OPEN' or v_event.status not in ('PUBLISHED','IN_PROGRESS') then raise exception 'EVENT_REGISTRATION_CLOSED';end if;
  if v_event.registration_mode<>'MIXED' then raise exception 'EVENT_CARAVAN_REGISTRATION_DISABLED';end if;
  v_total:=coalesce((p_payload->>'totalRegistrations')::integer,0);v_male:=coalesce((p_payload->>'maleCount')::integer,0);v_female:=coalesce((p_payload->>'femaleCount')::integer,0);
  if v_total<=0 or v_male<0 or v_female<0 or v_total<>v_male+v_female then raise exception 'EVENT_CARAVAN_TOTALS_INVALID';end if;
  if coalesce(btrim(p_payload->>'originChurchName'),'')='' or coalesce(btrim(p_payload->>'originCity'),'')=''
    or coalesce(btrim(p_payload->>'responsibleName'),'')='' or coalesce(btrim(p_payload->>'responsiblePhone'),'')=''
    or coalesce(btrim(p_payload->>'pastorName'),'')='' or coalesce(upper(btrim(p_payload->>'originState')),'')!~'^[A-Z]{2}$'
  then raise exception 'EVENT_CARAVAN_FIELDS_REQUIRED';end if;
  if jsonb_typeof(coalesce(p_items,'[]'::jsonb))<>'array' then raise exception 'EVENT_ITEMS_INVALID';end if;
  select * into v_setting from public.event_payment_settings where event_id=p_event_id and deleted_at is null;
  if not found or v_setting.caravan_registration_item_id is null then raise exception 'EVENT_CARAVAN_MAIN_ITEM_REQUIRED';end if;
  if not exists(select 1 from jsonb_array_elements(p_items) selected where (selected->>'itemId')::uuid=v_setting.caravan_registration_item_id and (selected->>'quantity')::integer=v_total) then raise exception 'EVENT_CARAVAN_MAIN_ITEM_INVALID';end if;
  if exists(select 1 from public.event_items catalog where catalog.event_id=p_event_id and catalog.is_required and catalog.is_active and catalog.deleted_at is null and not exists(select 1 from jsonb_array_elements(p_items) selected where (selected->>'itemId')::uuid=catalog.id)) then raise exception 'EVENT_REQUIRED_ITEMS_MISSING';end if;
  if (select count(*) from jsonb_array_elements(p_items))<>(select count(distinct selected->>'itemId') from jsonb_array_elements(p_items) selected) then raise exception 'EVENT_ITEMS_DUPLICATED';end if;
  select count(*) into v_individuals from public.event_registrations where event_id=p_event_id and event_group_id is null and status in ('PENDING','CONFIRMED','CHECKED_IN') and deleted_at is null;
  select coalesce(sum(total_registrations),0)::integer into v_caravans from public.event_groups where event_id=p_event_id and status='CONFIRMED' and deleted_at is null;
  if v_event.capacity is not null and v_individuals+v_caravans+v_total>v_event.capacity then raise exception 'EVENT_CAPACITY_FULL';end if;
  for v_item in select * from jsonb_array_elements(p_items) loop
    select * into v_catalog from public.event_items where id=(v_item->>'itemId')::uuid and event_id=p_event_id and is_active and deleted_at is null;
    if not found then raise exception 'EVENT_ITEM_NOT_AVAILABLE';end if;
    v_quantity:=coalesce((v_item->>'quantity')::integer,0);if v_quantity<=0 then raise exception 'EVENT_ITEM_QUANTITY_INVALID';end if;
    select (
      coalesce((select sum(item.quantity) from public.event_registration_items item join public.event_registrations registration on registration.id=item.event_registration_id where item.event_item_id=v_catalog.id and item.deleted_at is null and registration.status in ('PENDING','CONFIRMED','CHECKED_IN') and registration.deleted_at is null),0)
      +coalesce((select sum(item.quantity) from public.event_registration_items item join public.event_groups event_group on event_group.id=item.event_group_id where item.event_item_id=v_catalog.id and item.deleted_at is null and event_group.status='CONFIRMED' and event_group.deleted_at is null),0)
    )::integer into v_used;
    if v_catalog.available_quantity is not null and v_used+v_quantity>v_catalog.available_quantity then raise exception 'EVENT_ITEM_STOCK_EXCEEDED';end if;
    v_amount:=v_amount+(v_catalog.price*v_quantity);
  end loop;
  return jsonb_build_object('valid',true,'totalAmount',v_amount,'expiresAt',now()+interval '2 hours');
end;$$;

create or replace function public.create_event_caravan(
  p_event_id uuid,p_payload jsonb,p_items jsonb,p_idempotency_key text default null
) returns jsonb language plpgsql security definer set search_path='' as $$
declare
  v_event public.events%rowtype;v_group public.event_groups%rowtype;v_setting public.event_payment_settings%rowtype;
  v_item jsonb;v_catalog public.event_items%rowtype;v_actor uuid:=(select auth.uid());
  v_service boolean:=(select private.is_service_request());v_total_count integer;v_male integer;v_female integer;
  v_individuals integer;v_caravans integer;v_sequence integer;v_quantity integer;v_token text:=encode(extensions.gen_random_bytes(16),'hex');
begin
  select * into v_event from public.events where id=p_event_id and deleted_at is null for update;
  if not found then raise exception 'EVENT_NOT_FOUND'; end if;
  if v_service then
    if v_event.visibility<>'PUBLIC' then raise exception 'EVENT_PUBLIC_ACCESS_DENIED'; end if;
  elsif not (select private.can_access_event_id(p_event_id,'events.groups.manage')) then raise exception 'EVENT_ACCESS_DENIED'; end if;
  if v_event.registration_status<>'OPEN' or v_event.status not in ('PUBLISHED','IN_PROGRESS') then raise exception 'EVENT_REGISTRATION_CLOSED'; end if;
  if v_event.registration_mode<>'MIXED' then raise exception 'EVENT_CARAVAN_REGISTRATION_DISABLED'; end if;
  if p_idempotency_key is not null then
    select * into v_group from public.event_groups where event_id=p_event_id and idempotency_key=p_idempotency_key;
    if found then return jsonb_build_object('groupId',v_group.id,'groupNumber',v_group.group_number,'totalAmount',v_group.total_amount,'idempotentReplay',true); end if;
  end if;
  v_total_count:=coalesce((p_payload->>'totalRegistrations')::integer,0);
  v_male:=coalesce((p_payload->>'maleCount')::integer,0);v_female:=coalesce((p_payload->>'femaleCount')::integer,0);
  if v_total_count<=0 or v_male<0 or v_female<0 or v_total_count<>v_male+v_female then raise exception 'EVENT_CARAVAN_TOTALS_INVALID'; end if;
  if coalesce(btrim(p_payload->>'originChurchName'),'')='' or coalesce(btrim(p_payload->>'originCity'),'')=''
    or coalesce(btrim(p_payload->>'responsibleName'),'')='' or coalesce(btrim(p_payload->>'responsiblePhone'),'')=''
    or coalesce(btrim(p_payload->>'pastorName'),'')='' or coalesce(upper(btrim(p_payload->>'originState')),'')!~'^[A-Z]{2}$'
  then raise exception 'EVENT_CARAVAN_FIELDS_REQUIRED'; end if;
  select count(*) into v_individuals from public.event_registrations where event_id=p_event_id and event_group_id is null and status in ('PENDING','CONFIRMED','CHECKED_IN') and deleted_at is null;
  select coalesce(sum(total_registrations),0)::integer into v_caravans from public.event_groups where event_id=p_event_id and status='CONFIRMED' and deleted_at is null;
  if v_event.capacity is not null and v_individuals+v_caravans+v_total_count>v_event.capacity then raise exception 'EVENT_CAPACITY_FULL'; end if;
  if jsonb_typeof(coalesce(p_items,'[]'::jsonb))<>'array' then raise exception 'EVENT_ITEMS_INVALID'; end if;
  select * into v_setting from public.event_payment_settings where event_id=p_event_id and deleted_at is null;
  if not found or v_setting.caravan_registration_item_id is null then raise exception 'EVENT_CARAVAN_MAIN_ITEM_REQUIRED'; end if;
  if not exists(select 1 from jsonb_array_elements(p_items) selected where (selected->>'itemId')::uuid=v_setting.caravan_registration_item_id and (selected->>'quantity')::integer=v_total_count) then raise exception 'EVENT_CARAVAN_MAIN_ITEM_INVALID'; end if;
  if exists(select 1 from public.event_items catalog where catalog.event_id=p_event_id and catalog.is_required and catalog.is_active and catalog.deleted_at is null and not exists(select 1 from jsonb_array_elements(p_items) selected where (selected->>'itemId')::uuid=catalog.id)) then raise exception 'EVENT_REQUIRED_ITEMS_MISSING'; end if;
  if (select count(*) from jsonb_array_elements(p_items))<>(select count(distinct selected->>'itemId') from jsonb_array_elements(p_items) selected) then raise exception 'EVENT_ITEMS_DUPLICATED'; end if;
  update public.events set caravan_sequence=caravan_sequence+1 where id=p_event_id returning caravan_sequence into v_sequence;
  insert into public.event_groups(church_id,event_id,group_number,source,origin_church_name,origin_field_name,origin_city,origin_state,responsible_name,responsible_phone,responsible_email,pastor_name,pastor_phone,total_registrations,male_count,female_count,unspecified_count,status,payment_status,notes,idempotency_key,verification_token_hash,verification_token_last4,confirmed_at,metadata,created_by,updated_by)
  values(v_event.church_id,p_event_id,'CAR-'||lpad(v_sequence::text,6,'0'),case when v_service then 'PUBLIC' else 'INTERNAL' end,btrim(p_payload->>'originChurchName'),nullif(btrim(p_payload->>'originFieldName'),''),btrim(p_payload->>'originCity'),upper(btrim(p_payload->>'originState')),btrim(p_payload->>'responsibleName'),btrim(p_payload->>'responsiblePhone'),nullif(lower(btrim(p_payload->>'responsibleEmail')),''),btrim(p_payload->>'pastorName'),nullif(btrim(p_payload->>'pastorPhone'),''),v_total_count,v_male,v_female,0,'CONFIRMED','PENDING',nullif(btrim(p_payload->>'notes'),''),p_idempotency_key,encode(extensions.digest(v_token,'sha256'),'hex'),right(v_token,4),now(),coalesce(p_payload->'metadata','{}'::jsonb),v_actor,v_actor)
  returning * into v_group;
  for v_item in select * from jsonb_array_elements(p_items) loop
    select * into v_catalog from public.event_items where id=(v_item->>'itemId')::uuid and event_id=p_event_id and is_active and deleted_at is null for update;
    if not found then raise exception 'EVENT_ITEM_NOT_AVAILABLE'; end if;
    v_quantity:=coalesce((v_item->>'quantity')::integer,0);
    if v_quantity<=0 then raise exception 'EVENT_ITEM_QUANTITY_INVALID'; end if;
    insert into public.event_registration_items(church_id,event_id,event_group_id,event_item_id,item_name,item_type,size,quantity,unit_price,metadata,created_by,updated_by)
    values(v_event.church_id,p_event_id,v_group.id,v_catalog.id,v_catalog.name,v_catalog.item_type,nullif(v_item->>'size',''),v_quantity,v_catalog.price,coalesce(v_item->'metadata','{}'::jsonb),v_actor,v_actor);
  end loop;
  perform private.recalculate_event_group(v_group.id);
  select * into v_group from public.event_groups where id=v_group.id;
  perform public.log_audit(v_event.church_id,'EVENTS','CREATE_CARAVAN','EVENT_GROUP',v_group.id,v_group.group_number,'Caravana cadastrada',null,jsonb_build_object('event_id',p_event_id,'participants',v_total_count,'total_amount',v_group.total_amount,'source',v_group.source),'{}'::jsonb,'INFO');
  return jsonb_build_object('groupId',v_group.id,'groupNumber',v_group.group_number,'totalAmount',v_group.total_amount,'paymentStatus',v_group.payment_status,'verificationToken',v_token,'idempotentReplay',false);
exception when unique_violation then raise exception 'EVENT_CARAVAN_DUPLICATE'; end;$$;

create or replace function public.update_event_caravan(p_event_id uuid,p_group_id uuid,p_expected_updated_at timestamptz,p_payload jsonb,p_items jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_group public.event_groups%rowtype;v_event public.events%rowtype;v_setting public.event_payment_settings%rowtype;v_item jsonb;v_catalog public.event_items%rowtype;v_total integer;v_male integer;v_female integer;v_other integer;v_quantity integer;v_new_amount numeric(12,2):=0;v_confirmed_paid numeric(12,2):=0;v_actor uuid:=(select auth.uid());
begin
  if not (select private.can_access_event_id(p_event_id,'events.groups.manage')) then raise exception 'EVENT_ACCESS_DENIED'; end if;
  select * into v_event from public.events where id=p_event_id and deleted_at is null for update;
  select * into v_group from public.event_groups where id=p_group_id and event_id=p_event_id and status='CONFIRMED' and deleted_at is null for update;
  if not found then raise exception 'EVENT_CARAVAN_NOT_FOUND'; end if;
  if v_group.updated_at<>p_expected_updated_at then raise exception 'EVENT_CONCURRENT_UPDATE'; end if;
  v_total:=coalesce((p_payload->>'totalRegistrations')::integer,0);v_male:=coalesce((p_payload->>'maleCount')::integer,0);v_female:=coalesce((p_payload->>'femaleCount')::integer,0);
  if v_total<=0 or v_male<0 or v_female<0 or v_total<>v_male+v_female then raise exception 'EVENT_CARAVAN_TOTALS_INVALID'; end if;
  if coalesce(btrim(p_payload->>'originChurchName'),'')='' or coalesce(btrim(p_payload->>'originCity'),'')=''
    or coalesce(btrim(p_payload->>'responsibleName'),'')='' or coalesce(btrim(p_payload->>'responsiblePhone'),'')=''
    or coalesce(btrim(p_payload->>'pastorName'),'')='' or coalesce(upper(btrim(p_payload->>'originState')),'')!~'^[A-Z]{2}$'
  then raise exception 'EVENT_CARAVAN_FIELDS_REQUIRED'; end if;
  if jsonb_typeof(coalesce(p_items,'[]'::jsonb))<>'array' then raise exception 'EVENT_ITEMS_INVALID'; end if;
  select (select count(*) from public.event_registrations where event_id=p_event_id and event_group_id is null and status in ('PENDING','CONFIRMED','CHECKED_IN') and deleted_at is null)+coalesce((select sum(total_registrations) from public.event_groups where event_id=p_event_id and id<>p_group_id and status='CONFIRMED' and deleted_at is null),0) into v_other;
  if v_event.capacity is not null and v_other+v_total>v_event.capacity then raise exception 'EVENT_CAPACITY_FULL'; end if;
  select * into v_setting from public.event_payment_settings where event_id=p_event_id and deleted_at is null;
  if not found or v_setting.caravan_registration_item_id is null then raise exception 'EVENT_CARAVAN_MAIN_ITEM_REQUIRED'; end if;
  if not exists(select 1 from jsonb_array_elements(p_items) selected where (selected->>'itemId')::uuid=v_setting.caravan_registration_item_id and (selected->>'quantity')::integer=v_total) then raise exception 'EVENT_CARAVAN_MAIN_ITEM_INVALID'; end if;
  if exists(select 1 from public.event_items catalog where catalog.event_id=p_event_id and catalog.is_required and catalog.is_active and catalog.deleted_at is null and not exists(select 1 from jsonb_array_elements(p_items) selected where (selected->>'itemId')::uuid=catalog.id)) then raise exception 'EVENT_REQUIRED_ITEMS_MISSING'; end if;
  if (select count(*) from jsonb_array_elements(p_items))<>(select count(distinct selected->>'itemId') from jsonb_array_elements(p_items) selected) then raise exception 'EVENT_ITEMS_DUPLICATED'; end if;
  select coalesce(sum(amount),0) into v_confirmed_paid from public.event_payments
  where event_group_id=p_group_id and payment_status='CONFIRMED' and deleted_at is null;
  update public.event_registration_items set deleted_at=now(),deleted_by=v_actor,updated_by=v_actor where event_group_id=p_group_id and deleted_at is null;
  for v_item in select * from jsonb_array_elements(p_items) loop
    select * into v_catalog from public.event_items where id=(v_item->>'itemId')::uuid and event_id=p_event_id and is_active and deleted_at is null for update;
    if not found then raise exception 'EVENT_ITEM_NOT_AVAILABLE'; end if;v_quantity:=coalesce((v_item->>'quantity')::integer,0);
    if v_quantity<=0 then raise exception 'EVENT_ITEM_QUANTITY_INVALID'; end if;
    v_new_amount:=v_new_amount+(v_catalog.price*v_quantity);
    insert into public.event_registration_items(church_id,event_id,event_group_id,event_item_id,item_name,item_type,size,quantity,unit_price,metadata,created_by,updated_by)
    values(v_event.church_id,p_event_id,p_group_id,v_catalog.id,v_catalog.name,v_catalog.item_type,nullif(v_item->>'size',''),v_quantity,v_catalog.price,coalesce(v_item->'metadata','{}'::jsonb),v_actor,v_actor);
  end loop;
  if v_new_amount<v_confirmed_paid then raise exception 'EVENT_CARAVAN_TOTAL_BELOW_PAID'; end if;
  update public.event_groups set origin_church_name=btrim(p_payload->>'originChurchName'),origin_city=btrim(p_payload->>'originCity'),origin_state=upper(btrim(p_payload->>'originState')),responsible_name=btrim(p_payload->>'responsibleName'),responsible_phone=btrim(p_payload->>'responsiblePhone'),responsible_email=nullif(lower(btrim(p_payload->>'responsibleEmail')),''),pastor_name=btrim(p_payload->>'pastorName'),pastor_phone=nullif(btrim(p_payload->>'pastorPhone'),''),total_registrations=v_total,male_count=v_male,female_count=v_female,unspecified_count=0,notes=nullif(btrim(p_payload->>'notes'),''),updated_by=v_actor where id=p_group_id;
  perform private.recalculate_event_group(p_group_id);select * into v_group from public.event_groups where id=p_group_id;
  perform public.log_audit(v_event.church_id,'EVENTS','UPDATE_CARAVAN','EVENT_GROUP',v_group.id,v_group.group_number,'Caravana atualizada',null,jsonb_build_object('participants',v_total,'total_amount',v_group.total_amount),'{}'::jsonb,'INFO');
  return jsonb_build_object('groupId',v_group.id,'groupNumber',v_group.group_number,'totalAmount',v_group.total_amount,'paymentStatus',v_group.payment_status);
end;$$;

create or replace function public.cancel_event_caravan(p_event_id uuid,p_group_id uuid,p_reason text)
returns public.event_groups language plpgsql security definer set search_path='' as $$
declare v_group public.event_groups%rowtype;v_actor uuid:=(select auth.uid());
begin
  if not (select private.can_access_event_id(p_event_id,'events.groups.manage')) then raise exception 'EVENT_ACCESS_DENIED'; end if;
  if coalesce(btrim(p_reason),'')='' then raise exception 'EVENT_CARAVAN_CANCEL_REASON_REQUIRED'; end if;
  update public.event_groups set status='CANCELLED',cancelled_at=now(),cancelled_by=v_actor,cancel_reason=btrim(p_reason),updated_by=v_actor
  where id=p_group_id and event_id=p_event_id and status='CONFIRMED' and deleted_at is null returning * into v_group;
  if not found then raise exception 'EVENT_CARAVAN_NOT_FOUND'; end if;
  perform public.log_audit(v_group.church_id,'EVENTS','CANCEL_CARAVAN','EVENT_GROUP',v_group.id,v_group.group_number,'Caravana cancelada',null,jsonb_build_object('reason',p_reason),'{}'::jsonb,'WARNING');
  return v_group;
end;$$;

create or replace function public.record_event_caravan_payment(p_event_id uuid,p_group_id uuid,p_payload jsonb,p_idempotency_key text default null)
returns public.event_payments language plpgsql security definer set search_path='' as $$
declare v_group public.event_groups%rowtype;v_payment public.event_payments%rowtype;v_event public.events%rowtype;v_amount numeric(12,2);v_number integer;v_actor uuid:=(select auth.uid());v_service boolean:=(select private.is_service_request());v_status text;
begin
  select * into v_event from public.events where id=p_event_id and deleted_at is null;
  if v_service then null; elsif not (select private.can_access_event_id(p_event_id,'events.payments.manage')) then raise exception 'EVENT_ACCESS_DENIED'; end if;
  select * into v_group from public.event_groups where id=p_group_id and event_id=p_event_id and status='CONFIRMED' and deleted_at is null for update;
  if not found then raise exception 'EVENT_CARAVAN_NOT_FOUND'; end if;
  if p_idempotency_key is not null then select * into v_payment from public.event_payments where event_id=p_event_id and idempotency_key=p_idempotency_key;if found then return v_payment;end if;end if;
  v_amount:=(p_payload->>'amount')::numeric;v_status:=case when v_service then 'PENDING' else coalesce(nullif(p_payload->>'paymentStatus',''),'CONFIRMED') end;
  if v_amount<=0 or v_amount>greatest(v_group.total_amount-v_group.paid_amount,0) then raise exception 'EVENT_PAYMENT_EXCEEDS_BALANCE'; end if;
  if v_status not in ('PENDING','CONFIRMED') then raise exception 'EVENT_PAYMENT_STATUS_INVALID'; end if;
  select count(*)+1 into v_number from public.event_payments where event_id=p_event_id;
  insert into public.event_payments(church_id,event_id,event_group_id,payment_number,payment_method,payment_status,amount,paid_at,installment_number,installments_total,payer_name,idempotency_key,confirmed_by,notes,metadata,receipt_storage_path,receipt_file_name,receipt_mime_type,receipt_file_size,created_by,updated_by)
  values(v_event.church_id,p_event_id,p_group_id,upper(left(v_event.public_code,6))||'-P'||lpad(v_number::text,6,'0'),coalesce(nullif(p_payload->>'paymentMethod',''),'PIX'),v_status,v_amount,case when v_status='CONFIRMED' then coalesce(nullif(p_payload->>'paidAt','')::timestamptz,now()) end,1,1,coalesce(nullif(btrim(p_payload->>'payerName'),''),v_group.responsible_name),p_idempotency_key,case when v_status='CONFIRMED' then v_actor end,nullif(btrim(p_payload->>'notes'),''),coalesce(p_payload->'metadata','{}'::jsonb),nullif(p_payload->>'receiptPath',''),nullif(btrim(p_payload->>'receiptFileName'),''),nullif(p_payload->>'receiptMimeType',''),nullif(p_payload->>'receiptFileSize','')::bigint,v_actor,v_actor) returning * into v_payment;
  perform private.recalculate_event_group(p_group_id);
  perform public.log_audit(v_event.church_id,'EVENTS',case when v_status='PENDING' then 'SUBMIT_CARAVAN_PAYMENT' else 'RECORD_CARAVAN_PAYMENT' end,'EVENT_PAYMENT',v_payment.id,v_payment.payment_number,'Pagamento de caravana registrado',null,jsonb_build_object('group_id',p_group_id,'amount',v_amount,'status',v_status),'{}'::jsonb,'INFO');
  return v_payment;
end;$$;

-- Conclusão pública inteiramente transacional: a caravana, os itens, a lista,
-- o pagamento pendente e o checkout são confirmados juntos ou não são salvos.
create or replace function public.complete_event_public_caravan(
  p_event_id uuid,p_payload jsonb,p_items jsonb,p_idempotency_key text,p_session_token_hash text
) returns jsonb language plpgsql security definer set search_path='' as $$
declare
  v_checkout public.event_public_checkouts%rowtype;v_group public.event_groups%rowtype;
  v_payment public.event_payments%rowtype;v_created jsonb;v_group_id uuid;v_payment_id uuid;
  v_list_path text:=nullif(p_payload->>'listPath','');v_receipt_path text:=nullif(p_payload->>'paymentReceiptPath','');
  v_payment_amount numeric(12,2):=coalesce(nullif(p_payload->>'paymentAmount','')::numeric,0);
begin
  if not (select private.is_service_request()) then raise exception 'EVENT_PUBLIC_ACCESS_DENIED';end if;
  if coalesce(length(p_idempotency_key),0)<16 or coalesce(length(p_session_token_hash),0)<>64 then raise exception 'EVENT_CHECKOUT_INVALID';end if;

  select * into v_checkout from public.event_public_checkouts
  where event_id=p_event_id and idempotency_key=p_idempotency_key
    and access_token_hash=p_session_token_hash and checkout_type='CARAVAN' for update;
  if found then
    if v_checkout.status<>'COMPLETED' or v_checkout.group_id is null then raise exception 'EVENT_CHECKOUT_INVALID';end if;
    select * into v_group from public.event_groups where id=v_checkout.group_id;
    select * into v_payment from public.event_payments where event_group_id=v_group.id and idempotency_key=p_idempotency_key||':payment';
    return jsonb_build_object('groupId',v_group.id,'groupNumber',v_group.group_number,'totalAmount',v_group.total_amount,
      'paymentStatus',v_group.payment_status,'paymentId',v_payment.id,'verificationToken',null,'idempotentReplay',true);
  end if;

  select * into v_checkout from public.event_public_checkouts
  where event_id=p_event_id and access_token_hash=p_session_token_hash and checkout_type='CARAVAN' and status='DRAFT' for update;
  if not found then raise exception 'EVENT_CHECKOUT_NOT_FOUND';end if;
  if v_checkout.expires_at is not null and v_checkout.expires_at<=now() then
    update public.event_public_checkouts set status='EXPIRED',updated_at=now() where id=v_checkout.id;
    raise exception 'EVENT_CHECKOUT_EXPIRED';
  end if;

  v_created:=public.create_event_caravan(p_event_id,p_payload,p_items,p_idempotency_key);
  v_group_id:=(v_created->>'groupId')::uuid;

  if v_list_path is not null then
    insert into public.event_documents(church_id,event_id,event_group_id,document_type,title,file_name,storage_bucket,storage_path,mime_type,file_size,is_sensitive,status,upload_status,metadata)
    values(v_checkout.church_id,p_event_id,v_group_id,'CARAVAN_PARTICIPANT_LIST','Lista de participantes da caravana',
      btrim(p_payload->>'listFileName'),'event-documents',v_list_path,nullif(p_payload->>'listMimeType',''),
      nullif(p_payload->>'listFileSize','')::bigint,true,'ACTIVE','ACTIVE',jsonb_build_object('source','PUBLIC'));
    perform public.log_audit(v_checkout.church_id,'EVENTS','UPLOAD_CARAVAN_LIST','EVENT_GROUP',v_group_id,v_created->>'groupNumber','Lista da caravana vinculada',null,jsonb_build_object('event_id',p_event_id),'{}'::jsonb,'INFO');
  end if;

  if v_receipt_path is not null and v_payment_amount>0 then
    select * into v_payment from public.record_event_caravan_payment(p_event_id,v_group_id,
      jsonb_build_object('amount',v_payment_amount,'paymentMethod',coalesce(nullif(p_payload->>'paymentMethod',''),'PIX'),
        'payerName',p_payload->>'responsibleName','receiptPath',v_receipt_path,
        'receiptFileName',p_payload->>'paymentReceiptFileName','receiptMimeType',p_payload->>'paymentReceiptMimeType',
        'receiptFileSize',p_payload->>'paymentReceiptFileSize','metadata',jsonb_build_object('source','PUBLIC')),
      p_idempotency_key||':payment');
    v_payment_id:=v_payment.id;
  end if;

  update public.event_public_checkouts set group_id=v_group_id,registration_id=null,status='COMPLETED',
    payment_method=case when (v_created->>'totalAmount')::numeric<=0 then 'NOT_APPLICABLE' else coalesce(nullif(p_payload->>'paymentMethod',''),'NOT_APPLICABLE') end,
    completed_at=now(),expires_at=null,idempotency_key=p_idempotency_key,draft_payload='{}'::jsonb,updated_at=now()
  where id=v_checkout.id;

  return v_created||jsonb_build_object('paymentId',v_payment_id,'idempotentReplay',false);
end;$$;

create or replace function public.reissue_event_caravan_verification(p_event_id uuid,p_group_id uuid)
returns text language plpgsql security definer set search_path='' as $$
declare v_token text:=encode(extensions.gen_random_bytes(16),'hex');
begin
  if not (select private.can_access_event_id(p_event_id,'events.groups.manage')) then raise exception 'EVENT_ACCESS_DENIED';end if;
  update public.event_groups set verification_token_hash=encode(extensions.digest(v_token,'sha256'),'hex'),verification_token_last4=right(v_token,4),updated_by=(select auth.uid()) where id=p_group_id and event_id=p_event_id and deleted_at is null;
  if not found then raise exception 'EVENT_CARAVAN_NOT_FOUND';end if;return v_token;
end;$$;

create or replace function public.verify_event_caravan(p_token text)
returns jsonb language sql stable security definer set search_path='' as $$
  select jsonb_build_object('valid',true,'groupNumber',event_group.group_number,'eventName',event.name,'originChurchName',event_group.origin_church_name,'originCity',event_group.origin_city,'originState',event_group.origin_state,'responsibleName',event_group.responsible_name,'totalRegistrations',event_group.total_registrations,'status',event_group.status,'paymentStatus',event_group.payment_status,'updatedAt',event_group.updated_at)
  from public.event_groups event_group join public.events event on event.id=event_group.event_id
  where event_group.verification_token_hash=encode(extensions.digest(p_token,'sha256'),'hex') and event_group.deleted_at is null and event.deleted_at is null;
$$;

-- Pagamentos coletivos também recalculam a caravana ao aprovar/rejeitar/excluir.
create or replace function public.change_event_payment_status(p_payment_id uuid,p_status text,p_reason text default null)
returns public.event_payments language plpgsql security definer set search_path='' as $$
declare v_payment public.event_payments%rowtype;v_actor uuid:=(select auth.uid());v_status text:=upper(p_status);
begin
  select * into v_payment from public.event_payments where id=p_payment_id and deleted_at is null for update;
  if not found then raise exception 'EVENT_PAYMENT_NOT_FOUND';end if;
  if v_status='CONFIRMED' then
    if not (select private.can_access_event_id(v_payment.event_id,'events.payments.approve')) then raise exception 'EVENT_ACCESS_DENIED';end if;
  elsif not (select private.can_access_event_id(v_payment.event_id,'events.payments.manage')) then raise exception 'EVENT_ACCESS_DENIED';end if;
  if v_status not in ('CONFIRMED','FAILED','CANCELLED','REFUNDED') then raise exception 'EVENT_PAYMENT_STATUS_INVALID';end if;
  if v_status in ('FAILED','CANCELLED','REFUNDED') and coalesce(btrim(p_reason),'')='' then raise exception 'EVENT_PAYMENT_REASON_REQUIRED';end if;
  if v_status='REFUNDED' and v_payment.payment_status<>'CONFIRMED' then raise exception 'EVENT_PAYMENT_REFUND_INVALID';end if;
  update public.event_payments set payment_status=v_status,updated_by=v_actor,paid_at=case when v_status='CONFIRMED' then coalesce(paid_at,now()) else paid_at end,confirmed_by=case when v_status='CONFIRMED' then v_actor else confirmed_by end,failed_at=case when v_status='FAILED' then now() else failed_at end,failed_by=case when v_status='FAILED' then v_actor else failed_by end,failure_reason=case when v_status='FAILED' then btrim(p_reason) else failure_reason end,cancelled_at=case when v_status='CANCELLED' then now() else cancelled_at end,cancelled_by=case when v_status='CANCELLED' then v_actor else cancelled_by end,cancel_reason=case when v_status='CANCELLED' then btrim(p_reason) else cancel_reason end,refunded_at=case when v_status='REFUNDED' then now() else refunded_at end,refunded_by=case when v_status='REFUNDED' then v_actor else refunded_by end,refund_reason=case when v_status='REFUNDED' then btrim(p_reason) else refund_reason end where id=p_payment_id returning * into v_payment;
  if v_payment.event_registration_id is not null then perform private.recalculate_event_registration(v_payment.event_registration_id);end if;
  if v_payment.event_group_id is not null then perform private.recalculate_event_group(v_payment.event_group_id);end if;
  return v_payment;
end;$$;

create or replace function public.review_event_caravan_payment(p_payment_id uuid,p_status text,p_amount numeric,p_reason text default null)
returns public.event_payments language plpgsql security definer set search_path='' as $$
declare v_payment public.event_payments%rowtype;v_group public.event_groups%rowtype;v_actor uuid:=(select auth.uid());v_status text:=upper(p_status);
begin
  select * into v_payment from public.event_payments where id=p_payment_id and event_group_id is not null and payment_status='PENDING' and deleted_at is null for update;
  if not found then raise exception 'EVENT_PAYMENT_NOT_FOUND';end if;
  if not (select private.can_access_event_id(v_payment.event_id,'events.payments.approve')) then raise exception 'EVENT_ACCESS_DENIED';end if;
  select * into v_group from public.event_groups where id=v_payment.event_group_id and status='CONFIRMED' and deleted_at is null for update;
  if not found then raise exception 'EVENT_CARAVAN_NOT_FOUND';end if;
  if v_status not in ('CONFIRMED','FAILED') then raise exception 'EVENT_PAYMENT_STATUS_INVALID';end if;
  if v_status='CONFIRMED' and (p_amount is null or p_amount<=0 or p_amount>greatest(v_group.total_amount-v_group.paid_amount,0)) then raise exception 'EVENT_PAYMENT_EXCEEDS_BALANCE';end if;
  if v_status='FAILED' and coalesce(btrim(p_reason),'')='' then raise exception 'EVENT_PAYMENT_REASON_REQUIRED';end if;
  update public.event_payments set amount=case when v_status='CONFIRMED' then p_amount else amount end,payment_status=v_status,
    paid_at=case when v_status='CONFIRMED' then now() else paid_at end,confirmed_by=case when v_status='CONFIRMED' then v_actor else confirmed_by end,
    failed_at=case when v_status='FAILED' then now() else failed_at end,failed_by=case when v_status='FAILED' then v_actor else failed_by end,
    failure_reason=case when v_status='FAILED' then btrim(p_reason) else failure_reason end,
    notes=case when coalesce(btrim(p_reason),'')<>'' then concat_ws(E'\n',notes,btrim(p_reason)) else notes end,updated_by=v_actor
  where id=p_payment_id returning * into v_payment;
  perform private.recalculate_event_group(v_payment.event_group_id);
  perform public.log_audit(v_payment.church_id,'EVENTS',case when v_status='CONFIRMED' then 'APPROVE_CARAVAN_PAYMENT' else 'REJECT_CARAVAN_PAYMENT' end,'EVENT_PAYMENT',v_payment.id,v_payment.payment_number,'Comprovante de caravana analisado',null,jsonb_build_object('group_id',v_payment.event_group_id,'amount',v_payment.amount,'status',v_status,'reason',p_reason),'{}'::jsonb,case when v_status='FAILED' then 'WARNING' else 'INFO' end);
  return v_payment;
end;$$;

create or replace function public.delete_event_payment(p_event_id uuid,p_payment_id uuid)
returns text language plpgsql security definer set search_path='' as $$
declare v_payment public.event_payments%rowtype;v_actor uuid:=(select auth.uid());
begin
  select * into v_payment from public.event_payments where id=p_payment_id and event_id=p_event_id and deleted_at is null for update;
  if not found then raise exception 'EVENT_PAYMENT_NOT_FOUND';end if;
  if not (select private.can_access_event_id(p_event_id,'events.payments.manage')) then raise exception 'EVENT_ACCESS_DENIED';end if;
  update public.event_payments set deleted_at=now(),deleted_by=v_actor,updated_by=v_actor,cancelled_at=coalesce(cancelled_at,now()),cancelled_by=coalesce(cancelled_by,v_actor),cancel_reason=coalesce(nullif(cancel_reason,''),'Pagamento excluído pelo usuário') where id=p_payment_id;
  if v_payment.event_registration_id is not null then perform private.recalculate_event_registration(v_payment.event_registration_id);end if;
  if v_payment.event_group_id is not null then perform private.recalculate_event_group(v_payment.event_group_id);end if;
  perform public.log_audit(v_payment.church_id,'EVENTS','DELETE_PAYMENT','EVENT_PAYMENT',v_payment.id,v_payment.payment_number,'Pagamento excluído do histórico',null,jsonb_build_object('event_id',p_event_id,'registration_id',v_payment.event_registration_id,'group_id',v_payment.event_group_id,'amount',v_payment.amount),'{}'::jsonb,'WARNING');
  return v_payment.receipt_storage_path;
end;$$;

do $$ begin
  alter publication supabase_realtime add table public.event_groups;
exception when duplicate_object then null;end $$;
do $$ begin
  alter publication supabase_realtime add table public.event_documents;
exception when duplicate_object then null;end $$;
do $$ begin
  alter publication supabase_realtime add table public.event_payment_settings;
exception when duplicate_object then null;end $$;

revoke all on function public.create_event_caravan(uuid,jsonb,jsonb,text) from public,anon;
revoke all on function public.validate_event_caravan_draft(uuid,jsonb,jsonb) from public,anon,authenticated;
revoke all on function public.update_event_caravan(uuid,uuid,timestamptz,jsonb,jsonb) from public,anon;
revoke all on function public.cancel_event_caravan(uuid,uuid,text) from public,anon;
revoke all on function public.record_event_caravan_payment(uuid,uuid,jsonb,text) from public,anon;
revoke all on function public.complete_event_public_caravan(uuid,jsonb,jsonb,text,text) from public,anon,authenticated;
revoke all on function public.reissue_event_caravan_verification(uuid,uuid) from public,anon;
revoke all on function public.verify_event_caravan(text) from public,anon,authenticated;
revoke all on function public.change_event_payment_status(uuid,text,text) from public,anon;
revoke all on function public.review_event_caravan_payment(uuid,text,numeric,text) from public,anon;
revoke all on function public.delete_event_payment(uuid,uuid) from public,anon;
grant execute on function public.create_event_caravan(uuid,jsonb,jsonb,text) to authenticated,service_role;
grant execute on function public.validate_event_caravan_draft(uuid,jsonb,jsonb) to service_role;
grant execute on function public.update_event_caravan(uuid,uuid,timestamptz,jsonb,jsonb) to authenticated;
grant execute on function public.cancel_event_caravan(uuid,uuid,text) to authenticated;
grant execute on function public.record_event_caravan_payment(uuid,uuid,jsonb,text) to authenticated,service_role;
grant execute on function public.complete_event_public_caravan(uuid,jsonb,jsonb,text,text) to service_role;
grant execute on function public.reissue_event_caravan_verification(uuid,uuid) to authenticated;
grant execute on function public.verify_event_caravan(text) to service_role;
grant execute on function public.change_event_payment_status(uuid,text,text) to authenticated;
grant execute on function public.review_event_caravan_payment(uuid,text,numeric,text) to authenticated;
grant execute on function public.delete_event_payment(uuid,uuid) to authenticated;

commit;
