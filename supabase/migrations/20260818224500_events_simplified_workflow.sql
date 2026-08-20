begin;

-- Remodelagem do módulo de Eventos: fluxo simples, sem lotes, espera ou parcelamento.
alter table public.event_registrations
  add column if not exists preferred_payment_method text;

alter table public.event_payments
  add column if not exists receipt_file_name text,
  add column if not exists receipt_mime_type text,
  add column if not exists receipt_file_size bigint;

alter table public.event_registrations
  drop constraint if exists event_registration_preferred_payment_method_check;
alter table public.event_registrations
  add constraint event_registration_preferred_payment_method_check
  check (preferred_payment_method is null or preferred_payment_method in (
    'PIX','CASH','CREDIT_CARD','DEBIT_CARD','BANK_TRANSFER','BANK_SLIP','OTHER'
  ));

alter table public.event_payments
  drop constraint if exists event_payment_receipt_metadata_check;
alter table public.event_payments
  add constraint event_payment_receipt_metadata_check check (
    (receipt_storage_path is null and receipt_file_name is null and receipt_mime_type is null and receipt_file_size is null)
    or (
      receipt_storage_path is not null
      and coalesce(btrim(receipt_file_name),'') <> ''
      and receipt_mime_type in ('application/pdf','image/jpeg','image/png','image/webp')
      and receipt_file_size between 1 and 10485760
    )
  );

-- Remove a unicidade artificial de parcela, permitindo pagamentos parciais sucessivos.
drop index if exists public.event_payments_registration_installment_unique_idx;
drop index if exists public.event_payments_group_installment_unique_idx;

-- Mantém apenas unicidade para inscrições efetivamente ativas.
drop index if exists public.event_registrations_event_member_unique_idx;
drop index if exists public.event_registrations_member_active_unique_idx;
create unique index event_registrations_member_active_unique_idx
  on public.event_registrations(event_id, member_id)
  where member_id is not null and status in ('PENDING','CONFIRMED','CHECKED_IN') and deleted_at is null;

-- Normaliza os eventos já existentes sem disparar a trava de configuração histórica.
alter table public.events disable trigger protect_event_configuration;
update public.events
set allow_waitlist = false,
    quota_mode = 'NONE',
    uses_registration_batches = false,
    allow_installments = false,
    max_installments = 1,
    updated_at = now()
where allow_waitlist
   or quota_mode <> 'NONE'
   or uses_registration_batches
   or allow_installments
   or max_installments <> 1;
alter table public.events enable trigger protect_event_configuration;

update public.event_registration_batches
set is_active = false, updated_at = now()
where is_active;

update public.event_city_quotas
set deleted_at = coalesce(deleted_at, now()), updated_at = now()
where deleted_at is null;

update public.event_registrations
set status = case when total_amount <= paid_amount then 'CONFIRMED' else 'PENDING' end,
    confirmed_at = case when total_amount <= paid_amount then coalesce(confirmed_at, now()) else confirmed_at end,
    reservation_expires_at = null,
    updated_at = now()
where status = 'WAITLIST' and deleted_at is null;

alter table public.events drop constraint if exists events_simplified_commerce_check;
alter table public.events add constraint events_simplified_commerce_check check (
  allow_waitlist = false
  and quota_mode = 'NONE'
  and uses_registration_batches = false
  and allow_installments = false
  and max_installments = 1
);

alter table public.event_registrations drop constraint if exists event_registration_status_v2_check;
alter table public.event_registrations add constraint event_registration_status_v2_check
  check (status in ('PENDING','CONFIRMED','CANCELLED','EXPIRED','CHECKED_IN','NO_SHOW'));

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
  v_member public.members%rowtype;
  v_congregation public.congregations%rowtype;
  v_item jsonb;
  v_catalog_item public.event_items%rowtype;
  v_actor uuid := (select auth.uid());
  v_service boolean := (select private.is_service_request());
  v_active_count integer;
  v_item_used integer;
  v_sequence integer;
  v_total numeric(12,2) := 0;
  v_quantity integer;
  v_token text := encode(extensions.gen_random_bytes(24), 'hex');
  v_member_id uuid := nullif(p_payload->>'memberId', '')::uuid;
  v_congregation_id uuid := nullif(p_payload->>'congregationId', '')::uuid;
  v_items jsonb := coalesce(p_payload->'items', '[]'::jsonb);
  v_name text := nullif(btrim(p_payload->>'participantName'), '');
  v_gender text := nullif(p_payload->>'participantGender', '');
  v_phone text := nullif(btrim(p_payload->>'participantPhone'), '');
  v_participant_type text := case when nullif(p_payload->>'memberId', '') is null then 'VISITOR' else 'MEMBER' end;
  v_payment_method text := coalesce(nullif(p_payload->>'preferredPaymentMethod', ''), 'PIX');
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
        'paymentStatus', v_registration.payment_status,
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

  if v_member_id is not null then
    select * into v_member
    from public.members
    where id = v_member_id
      and church_id = v_event.church_id
      and member_status = 'ACTIVE'
      and deleted_at is null;
    if not found then raise exception 'EVENT_MEMBER_NOT_AVAILABLE'; end if;
    v_name := v_member.full_name;
    v_gender := v_member.gender;
    v_phone := nullif(btrim(v_member.whatsapp), '');
    v_congregation_id := v_member.congregation_id;
    v_participant_type := 'MEMBER';
  else
    v_participant_type := 'VISITOR';
  end if;

  if v_name is null then raise exception 'PARTICIPANT_NAME_REQUIRED'; end if;
  if v_payment_method not in ('PIX','CASH','CREDIT_CARD','DEBIT_CARD','BANK_TRANSFER','BANK_SLIP','OTHER') then
    raise exception 'EVENT_PAYMENT_METHOD_INVALID';
  end if;

  if v_congregation_id is not null then
    select * into v_congregation
    from public.congregations
    where id = v_congregation_id and church_id = v_event.church_id and deleted_at is null;
    if not found then raise exception 'EVENT_CONGREGATION_NOT_AVAILABLE'; end if;
  end if;

  if v_member_id is not null and exists (
    select 1 from public.event_registrations
    where event_id = p_event_id and member_id = v_member_id
      and status in ('PENDING','CONFIRMED','CHECKED_IN') and deleted_at is null
  ) then raise exception 'EVENT_REGISTRATION_DUPLICATE_MEMBER'; end if;

  select count(*) into v_active_count
  from public.event_registrations
  where event_id = p_event_id
    and status in ('PENDING','CONFIRMED','CHECKED_IN')
    and deleted_at is null;
  if v_event.capacity is not null and v_active_count >= v_event.capacity then
    raise exception 'EVENT_CAPACITY_FULL';
  end if;

  if jsonb_typeof(v_items) <> 'array' then raise exception 'EVENT_ITEMS_INVALID'; end if;
  if exists (
    select 1 from public.event_items required_item
    where required_item.event_id = p_event_id
      and required_item.is_required
      and required_item.is_active
      and required_item.deleted_at is null
      and not exists (
        select 1 from jsonb_array_elements(v_items) selected
        where nullif(selected->>'itemId', '')::uuid = required_item.id
      )
  ) then raise exception 'EVENT_REQUIRED_ITEM_MISSING'; end if;

  for v_item in select * from jsonb_array_elements(v_items)
  loop
    select * into v_catalog_item
    from public.event_items
    where id = nullif(v_item->>'itemId', '')::uuid
      and event_id = p_event_id
      and is_active
      and deleted_at is null
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
    join public.event_registrations registration on registration.id = registration_item.event_registration_id
    where registration_item.event_item_id = v_catalog_item.id
      and registration_item.deleted_at is null
      and registration.status in ('PENDING','CONFIRMED','CHECKED_IN')
      and registration.deleted_at is null;
    if v_catalog_item.available_quantity is not null and v_item_used + v_quantity > v_catalog_item.available_quantity then
      raise exception 'EVENT_ITEM_STOCK_EXCEEDED';
    end if;
    v_total := v_total + round(v_catalog_item.price * v_quantity, 2);
  end loop;

  update public.events
  set registration_sequence = registration_sequence + 1
  where id = p_event_id
  returning registration_sequence into v_sequence;

  insert into public.event_registrations (
    church_id, event_id, event_group_id, event_registration_batch_id, member_id, congregation_id,
    registration_number, registration_source, participant_type, participant_name,
    participant_gender, participant_phone, consent_version, consent_at,
    status, payment_status, total_amount, paid_amount, preferred_payment_method,
    qr_token_hash, qr_token_last4, reservation_expires_at, idempotency_key,
    metadata, created_by, updated_by
  ) values (
    v_event.church_id, p_event_id, nullif(p_payload->>'eventGroupId', '')::uuid, null,
    v_member_id, v_congregation_id,
    upper(left(coalesce(v_event.public_code, 'EVT'), 6)) || '-' || lpad(v_sequence::text, 6, '0'),
    coalesce(p_payload->>'registrationSource', case when v_service then 'PUBLIC' else 'INTERNAL' end),
    v_participant_type, v_name, v_gender, v_phone,
    nullif(p_payload->>'consentVersion', ''),
    case when coalesce((p_payload->>'consentAccepted')::boolean, false) then now() else null end,
    'PENDING', case when v_total <= 0 then 'NOT_REQUIRED' else 'PENDING' end,
    v_total, 0, v_payment_method,
    encode(extensions.digest(v_token, 'sha256'), 'hex'), right(v_token, 4), null,
    p_idempotency_key, coalesce(p_payload->'metadata', '{}'::jsonb), v_actor, v_actor
  ) returning * into v_registration;

  for v_item in select * from jsonb_array_elements(v_items)
  loop
    select * into v_catalog_item
    from public.event_items
    where id = (v_item->>'itemId')::uuid and event_id = p_event_id;
    v_quantity := coalesce((v_item->>'quantity')::integer, 1);
    insert into public.event_registration_items (
      church_id, event_id, event_registration_id, event_item_id,
      item_name, item_type, size, quantity, unit_price, metadata, created_by, updated_by
    ) values (
      v_event.church_id, p_event_id, v_registration.id, v_catalog_item.id,
      v_catalog_item.name, v_catalog_item.item_type, nullif(v_item->>'size', ''),
      v_quantity, v_catalog_item.price, coalesce(v_item->'metadata', '{}'::jsonb), v_actor, v_actor
    );
  end loop;

  if v_registration.event_group_id is not null then
    perform private.recalculate_event_group(v_registration.event_group_id);
  end if;

  perform public.log_audit(
    v_event.church_id, 'EVENTS', 'CREATE_REGISTRATION', 'EVENT_REGISTRATION',
    v_registration.id, v_registration.registration_number, 'Inscrição criada', null,
    jsonb_build_object('event_id', p_event_id, 'status', v_registration.status, 'total_amount', v_total),
    '{}'::jsonb, 'INFO'
  );

  return jsonb_build_object(
    'registrationId', v_registration.id,
    'registrationNumber', v_registration.registration_number,
    'status', v_registration.status,
    'paymentStatus', v_registration.payment_status,
    'totalAmount', v_registration.total_amount,
    'qrToken', v_token,
    'idempotentReplay', false
  );
exception
  when unique_violation then
    raise exception 'EVENT_REGISTRATION_DUPLICATE';
end;
$$;

create or replace function public.record_event_registration_payment(
  p_event_id uuid,
  p_registration_id uuid,
  p_payload jsonb,
  p_idempotency_key text default null
)
returns public.event_payments
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_event public.events%rowtype;
  v_registration public.event_registrations%rowtype;
  v_payment public.event_payments%rowtype;
  v_amount numeric(12,2);
  v_number integer;
  v_actor uuid := (select auth.uid());
begin
  select * into v_event
  from public.events
  where id = p_event_id and deleted_at is null
  for update;
  if not found then raise exception 'EVENT_NOT_FOUND'; end if;
  if not (select private.can_access_event_id(p_event_id, 'events.payments.manage')) then
    raise exception 'EVENT_ACCESS_DENIED';
  end if;

  if p_idempotency_key is not null then
    select * into v_payment
    from public.event_payments
    where event_id = p_event_id and idempotency_key = p_idempotency_key;
    if found then return v_payment; end if;
  end if;

  select * into v_registration
  from public.event_registrations
  where id = p_registration_id
    and event_id = p_event_id
    and status not in ('CANCELLED','EXPIRED')
    and deleted_at is null
  for update;
  if not found then raise exception 'EVENT_REGISTRATION_NOT_FOUND'; end if;
  if v_registration.remaining_amount <= 0 then raise exception 'EVENT_PAYMENT_ALREADY_SETTLED'; end if;

  v_amount := (p_payload->>'amount')::numeric;
  if v_amount <= 0 then raise exception 'EVENT_PAYMENT_AMOUNT_INVALID'; end if;
  if v_amount > v_registration.remaining_amount then raise exception 'EVENT_PAYMENT_EXCEEDS_BALANCE'; end if;

  select count(*) + 1 into v_number
  from public.event_payments
  where event_id = p_event_id;

  insert into public.event_payments (
    church_id, event_id, event_registration_id, event_group_id, payment_number,
    payment_method, payment_status, amount, paid_at, installment_number, installments_total,
    payer_name, idempotency_key, confirmed_by,
    receipt_storage_path, receipt_file_name, receipt_mime_type, receipt_file_size,
    created_by, updated_by
  ) values (
    v_event.church_id, p_event_id, p_registration_id, null,
    upper(left(v_event.public_code, 6)) || '-P' || lpad(v_number::text, 6, '0'),
    coalesce(v_registration.preferred_payment_method, 'PIX'), 'CONFIRMED', v_amount, now(), 1, 1,
    v_registration.participant_name, p_idempotency_key, v_actor,
    nullif(p_payload->>'receiptPath', ''), nullif(btrim(p_payload->>'receiptFileName'), ''),
    nullif(p_payload->>'receiptMimeType', ''), nullif(p_payload->>'receiptFileSize', '')::bigint,
    v_actor, v_actor
  ) returning * into v_payment;

  perform private.recalculate_event_registration(p_registration_id);
  perform public.log_audit(
    v_event.church_id, 'EVENTS', 'RECORD_PAYMENT', 'EVENT_PAYMENT',
    v_payment.id, v_payment.payment_number, 'Pagamento de inscrição registrado', null,
    jsonb_build_object('event_id', p_event_id, 'registration_id', p_registration_id, 'amount', v_amount),
    '{}'::jsonb, 'INFO'
  );
  return v_payment;
end;
$$;

revoke all on function public.create_event_registration(uuid, jsonb, text) from public, anon;
grant execute on function public.create_event_registration(uuid, jsonb, text) to authenticated, service_role;
revoke all on function public.record_event_registration_payment(uuid, uuid, jsonb, text) from public, anon;
grant execute on function public.record_event_registration_payment(uuid, uuid, jsonb, text) to authenticated;

-- O mesmo bucket privado recebe documentos e comprovantes, com permissões específicas por pasta.
drop policy if exists event_documents_storage_select on storage.objects;
create policy event_documents_storage_select on storage.objects
for select to authenticated
using (
  bucket_id = 'event-documents'
  and (storage.foldername(name))[2] = 'events'
  and (
    (select private.can_access_event_id(((storage.foldername(name))[3])::uuid, 'events.documents.view'))
    or (
      (storage.foldername(name))[4] = 'payment-receipts'
      and (select private.can_access_event_id(((storage.foldername(name))[3])::uuid, 'events.payments.view'))
    )
  )
);

drop policy if exists event_documents_storage_insert on storage.objects;
create policy event_documents_storage_insert on storage.objects
for insert to authenticated
with check (
  bucket_id = 'event-documents'
  and (storage.foldername(name))[2] = 'events'
  and (
    (select private.can_access_event_id(((storage.foldername(name))[3])::uuid, 'events.documents.manage'))
    or (
      (storage.foldername(name))[4] = 'payment-receipts'
      and (select private.can_access_event_id(((storage.foldername(name))[3])::uuid, 'events.payments.manage'))
    )
  )
);

drop policy if exists event_documents_storage_update on storage.objects;
create policy event_documents_storage_update on storage.objects
for update to authenticated
using (
  bucket_id = 'event-documents'
  and (
    (select private.can_access_event_id(((storage.foldername(name))[3])::uuid, 'events.documents.manage'))
    or (
      (storage.foldername(name))[4] = 'payment-receipts'
      and (select private.can_access_event_id(((storage.foldername(name))[3])::uuid, 'events.payments.manage'))
    )
  )
)
with check (
  bucket_id = 'event-documents'
  and (
    (select private.can_access_event_id(((storage.foldername(name))[3])::uuid, 'events.documents.manage'))
    or (
      (storage.foldername(name))[4] = 'payment-receipts'
      and (select private.can_access_event_id(((storage.foldername(name))[3])::uuid, 'events.payments.manage'))
    )
  )
);

drop policy if exists event_documents_storage_delete on storage.objects;
create policy event_documents_storage_delete on storage.objects
for delete to authenticated
using (
  bucket_id = 'event-documents'
  and (
    (select private.can_access_event_id(((storage.foldername(name))[3])::uuid, 'events.documents.manage'))
    or (
      (storage.foldername(name))[4] = 'payment-receipts'
      and (select private.can_access_event_id(((storage.foldername(name))[3])::uuid, 'events.payments.manage'))
    )
  )
);

commit;
