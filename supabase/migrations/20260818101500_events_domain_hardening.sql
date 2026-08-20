begin;

create unique index if not exists event_registrations_church_number_unique_idx
on public.event_registrations(church_id, registration_number)
where registration_number is not null;

do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'event_registration_source_check') then
    alter table public.event_registrations add constraint event_registration_source_check
      check (registration_source in ('INTERNAL','PUBLIC','GROUP','IMPORT'));
  end if;
end $$;

create or replace function private.validate_event_registration_row()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare v_event public.events%rowtype; v_member public.members%rowtype; v_region_id uuid;
begin
  select * into v_event from public.events where id = new.event_id;
  if not found or v_event.church_id <> new.church_id then raise exception 'EVENT_TENANT_MISMATCH'; end if;
  if new.participant_type = 'CHILD' and (coalesce(btrim(new.responsible_name),'') = '' or coalesce(btrim(new.responsible_phone),'') = '') then
    raise exception 'EVENT_CHILD_RESPONSIBLE_REQUIRED';
  end if;
  if new.registration_source = 'PUBLIC' and (new.consent_at is null or coalesce(new.consent_version,'') = '') then
    raise exception 'EVENT_PUBLIC_CONSENT_REQUIRED';
  end if;
  if new.member_id is not null then
    select * into v_member from public.members where id = new.member_id and church_id = new.church_id and deleted_at is null;
    if not found then raise exception 'EVENT_MEMBER_NOT_AVAILABLE'; end if;
    if v_event.event_scope = 'CONGREGATION' and v_member.congregation_id is distinct from v_event.congregation_id then
      raise exception 'EVENT_MEMBER_OUTSIDE_SCOPE';
    end if;
    if v_event.event_scope = 'REGION' then
      select region_id into v_region_id from public.congregations where id = v_member.congregation_id and deleted_at is null;
      if v_region_id is distinct from v_event.region_id then raise exception 'EVENT_MEMBER_OUTSIDE_SCOPE'; end if;
    end if;
  end if;
  if new.total_amount <= 0 and new.status = 'PENDING' then
    new.status := 'CONFIRMED'; new.confirmed_at := coalesce(new.confirmed_at, now());
    new.payment_status := 'NOT_REQUIRED'; new.reservation_expires_at := null;
  end if;
  return new;
end;
$$;

drop trigger if exists validate_event_registration_row on public.event_registrations;
create trigger validate_event_registration_row before insert or update of member_id, participant_type, responsible_name,
  responsible_phone, registration_source, consent_at, consent_version, total_amount, status
on public.event_registrations for each row execute function private.validate_event_registration_row();

create or replace function private.recalculate_event_registration(p_registration_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare v_paid numeric(12,2); v_total numeric(12,2);
begin
  select registration.total_amount into v_total from public.event_registrations registration
  where registration.id = p_registration_id for update;
  if not found then return; end if;
  select coalesce(sum(payment.amount),0) into v_paid from public.event_payments payment
  where payment.event_registration_id = p_registration_id and payment.payment_status = 'CONFIRMED' and payment.deleted_at is null;
  update public.event_registrations set paid_amount = least(v_paid,v_total),
    payment_status = case when v_total <= 0 then 'NOT_REQUIRED' when v_paid >= v_total then 'PAID' when v_paid > 0 then 'PARTIAL' else 'PENDING' end,
    status = case when status = 'PENDING' and (v_total <= 0 or v_paid >= v_total) then 'CONFIRMED' else status end,
    confirmed_at = case when status = 'PENDING' and (v_total <= 0 or v_paid >= v_total) then coalesce(confirmed_at,now()) else confirmed_at end,
    reservation_expires_at = case when v_total <= 0 or v_paid >= v_total then null else reservation_expires_at end
  where id = p_registration_id;
end;
$$;

create or replace function private.protect_event_configuration()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare v_used integer;
begin
  if old.status is distinct from new.status then
    if not (select private.can_access_event_values(old.church_id,old.event_scope,old.region_id,old.congregation_id,old.ministry_id,'events.publish')) then
      raise exception 'EVENT_PUBLISH_PERMISSION_REQUIRED';
    end if;
    if not (
      (old.status='DRAFT' and new.status='PUBLISHED') or
      (old.status in ('PUBLISHED','REGISTRATION_CLOSED') and new.status='REGISTRATION_OPEN') or
      (old.status='REGISTRATION_OPEN' and new.status='REGISTRATION_CLOSED') or
      (old.status in ('PUBLISHED','REGISTRATION_OPEN','REGISTRATION_CLOSED') and new.status='IN_PROGRESS') or
      (old.status='IN_PROGRESS' and new.status='FINISHED') or
      (old.status not in ('FINISHED','CANCELLED') and new.status='CANCELLED')
    ) then raise exception 'EVENT_TRANSITION_INVALID'; end if;
    if new.status='REGISTRATION_OPEN' and (
      new.starts_at <= now() or (new.registration_starts_at is not null and now() < new.registration_starts_at)
      or (new.registration_ends_at is not null and now() > new.registration_ends_at)
    ) then raise exception 'EVENT_REGISTRATION_WINDOW_INVALID'; end if;
    if new.status='CANCELLED' and coalesce(btrim(new.cancel_reason),'')='' then raise exception 'EVENT_CANCEL_REASON_REQUIRED'; end if;
  end if;
  if exists (select 1 from public.event_registrations where event_id=old.id and deleted_at is null) and (
    old.church_id is distinct from new.church_id or old.event_scope is distinct from new.event_scope
    or old.region_id is distinct from new.region_id or old.congregation_id is distinct from new.congregation_id
    or old.ministry_id is distinct from new.ministry_id or old.registration_mode is distinct from new.registration_mode
    or old.quota_mode is distinct from new.quota_mode
  ) then raise exception 'EVENT_CRITICAL_CONFIGURATION_LOCKED'; end if;
  if new.capacity is not null and (old.capacity is null or new.capacity < old.capacity) then
    select count(*) into v_used from public.event_registrations where event_id=old.id and status in ('PENDING','CONFIRMED','CHECKED_IN') and deleted_at is null;
    if new.capacity < v_used then raise exception 'EVENT_CAPACITY_BELOW_USAGE'; end if;
  end if;
  return new;
end;
$$;

drop trigger if exists protect_event_configuration on public.events;
create trigger protect_event_configuration before update on public.events
for each row execute function private.protect_event_configuration();

create or replace function private.apply_event_lifecycle_side_effects()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.status is distinct from new.status and new.status='CANCELLED' then
    update public.event_registrations set status='CANCELLED',cancelled_at=now(),cancelled_by=new.cancelled_by,
      cancel_reason='Evento cancelado: '||new.cancel_reason,updated_by=new.cancelled_by
    where event_id=new.id and status in ('PENDING','CONFIRMED','WAITLIST') and deleted_at is null;
    update public.event_checkins set status='CANCELLED',cancelled_at=now(),cancelled_by=new.cancelled_by,
      cancel_reason='Evento cancelado'
    where event_id=new.id and status='CHECKED_IN' and deleted_at is null;
  elsif old.status is distinct from new.status and new.status='FINISHED' then
    update public.event_registrations registration set status='NO_SHOW',updated_by=new.finished_by
    where registration.event_id=new.id and registration.status='CONFIRMED' and registration.deleted_at is null
      and not exists (select 1 from public.event_checkins checkin where checkin.event_registration_id=registration.id and checkin.status='CHECKED_IN' and checkin.deleted_at is null);
  end if;
  return null;
end;
$$;

drop trigger if exists apply_event_lifecycle_side_effects on public.events;
create trigger apply_event_lifecycle_side_effects after update of status on public.events
for each row execute function private.apply_event_lifecycle_side_effects();

create or replace function private.protect_event_item_limits()
returns trigger language plpgsql security definer set search_path='' as $$
declare v_used integer;
begin
  if new.available_quantity is not null then
    select coalesce(sum(item.quantity),0)::integer into v_used from public.event_registration_items item
    join public.event_registrations registration on registration.id=item.event_registration_id
    where item.event_item_id=old.id and registration.status in ('PENDING','CONFIRMED','CHECKED_IN')
      and item.deleted_at is null and registration.deleted_at is null;
    if new.available_quantity < v_used then raise exception 'EVENT_ITEM_STOCK_BELOW_USAGE'; end if;
  end if; return new;
end $$;
drop trigger if exists protect_event_item_limits on public.event_items;
create trigger protect_event_item_limits before update of available_quantity on public.event_items
for each row execute function private.protect_event_item_limits();

create or replace function private.protect_event_batch_limits()
returns trigger language plpgsql security definer set search_path='' as $$
declare v_used integer;
begin
  if new.capacity is not null then
    select count(*) into v_used from public.event_registrations where event_registration_batch_id=old.id
      and status in ('PENDING','CONFIRMED','CHECKED_IN') and deleted_at is null;
    if new.capacity < v_used then raise exception 'EVENT_BATCH_CAPACITY_BELOW_USAGE'; end if;
  end if; return new;
end $$;
drop trigger if exists protect_event_batch_limits on public.event_registration_batches;
create trigger protect_event_batch_limits before update of capacity on public.event_registration_batches
for each row execute function private.protect_event_batch_limits();

create or replace function public.change_event_deletion_state(p_event_id uuid,p_action text)
returns public.events
language plpgsql security definer set search_path='' as $$
declare v_event public.events%rowtype; v_actor uuid:=(select auth.uid());
begin
  select * into v_event from public.events where id=p_event_id for update;
  if not found then raise exception 'EVENT_NOT_FOUND'; end if;
  if not (select private.can_access_event_values(v_event.church_id,v_event.event_scope,v_event.region_id,v_event.congregation_id,v_event.ministry_id,'events.manage')) then raise exception 'EVENT_ACCESS_DENIED'; end if;
  if upper(p_action)='DELETE' then
    if v_event.status<>'DRAFT' or exists(select 1 from public.event_registrations where event_id=p_event_id)
      or exists(select 1 from public.event_payments where event_id=p_event_id)
      or exists(select 1 from public.event_checkins where event_id=p_event_id)
      or exists(select 1 from public.event_documents where event_id=p_event_id) then
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
end $$;

create or replace function public.cancel_event_group(p_group_id uuid,p_reason text)
returns public.event_groups
language plpgsql security definer set search_path='' as $$
declare v_group public.event_groups%rowtype; v_actor uuid:=(select auth.uid());
begin
  select * into v_group from public.event_groups where id=p_group_id and deleted_at is null for update;
  if not found then raise exception 'EVENT_GROUP_NOT_FOUND'; end if;
  if not (select private.can_access_event_id(v_group.event_id,'events.registrations.manage')) then raise exception 'EVENT_ACCESS_DENIED'; end if;
  if coalesce(btrim(p_reason),'')='' then raise exception 'EVENT_CANCEL_REASON_REQUIRED'; end if;
  update public.event_groups set status='CANCELLED',notes=concat_ws(E'\n',notes,'Cancelado: '||btrim(p_reason)),updated_by=v_actor where id=p_group_id returning * into v_group;
  update public.event_registrations set status='CANCELLED',cancelled_at=now(),cancelled_by=v_actor,cancel_reason='Grupo cancelado: '||btrim(p_reason),updated_by=v_actor
  where event_group_id=p_group_id and status in ('PENDING','CONFIRMED','WAITLIST') and deleted_at is null;
  update public.event_checkins set status='CANCELLED',cancelled_at=now(),cancelled_by=v_actor,cancel_reason='Grupo cancelado'
  where event_group_id=p_group_id and status='CHECKED_IN' and deleted_at is null;
  perform private.recalculate_event_group(p_group_id);
  return v_group;
end $$;

revoke all on function public.change_event_deletion_state(uuid,text) from public,anon;
revoke all on function public.cancel_event_group(uuid,text) from public,anon;
grant execute on function public.change_event_deletion_state(uuid,text) to authenticated;
grant execute on function public.cancel_event_group(uuid,text) to authenticated;

drop policy if exists events_select_scoped on public.events;
create policy events_select_scoped on public.events for select to authenticated using (
  (deleted_at is null and (select private.can_access_event_values(church_id,event_scope,region_id,congregation_id,ministry_id,'events.view')))
  or (deleted_at is not null and (select private.can_access_event_values(church_id,event_scope,region_id,congregation_id,ministry_id,'events.manage')))
);

commit;
