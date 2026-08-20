begin;

-- Checkout público individual e conciliação Pix. As tabelas permanecem no
-- schema public para uso pelo PostgREST com service_role, mas sem qualquer
-- permissão para anon/authenticated e com RLS habilitado.
alter table public.event_registrations
  add column if not exists credential_version integer not null default 1;

alter table public.event_registrations
  drop constraint if exists event_registration_preferred_payment_method_check;
alter table public.event_registrations
  add constraint event_registration_preferred_payment_method_check
  check (preferred_payment_method is null or preferred_payment_method in (
    'PIX','CASH','CREDIT_CARD','DEBIT_CARD','BANK_TRANSFER','BANK_SLIP','OTHER','NOT_APPLICABLE'
  ));

alter table public.event_payments
  add column if not exists provider text not null default 'MANUAL',
  add column if not exists provider_payment_id text,
  add column if not exists provider_status text,
  add column if not exists provider_status_updated_at timestamptz,
  add column if not exists expires_at timestamptz,
  add column if not exists external_reference text,
  add column if not exists payment_channel text not null default 'INTERNAL_MANUAL';

alter table public.event_payments
  drop constraint if exists event_payment_provider_check;
alter table public.event_payments
  add constraint event_payment_provider_check check (
    provider in ('MANUAL','MERCADO_PAGO')
    and payment_channel in ('INTERNAL_MANUAL','ONLINE_PIX')
  );

create unique index if not exists event_payments_provider_payment_unique_idx
  on public.event_payments(provider, provider_payment_id)
  where provider_payment_id is not null;
create unique index if not exists event_payments_idempotency_global_unique_idx
  on public.event_payments(idempotency_key)
  where idempotency_key is not null;

create table if not exists public.event_public_checkouts (
  id uuid primary key default gen_random_uuid(),
  church_id uuid not null references public.churches(id) on delete cascade,
  event_id uuid not null references public.events(id) on delete cascade,
  registration_id uuid not null references public.event_registrations(id) on delete cascade,
  access_token_hash text not null,
  status text not null default 'AWAITING_PAYMENT',
  payment_method text not null,
  expires_at timestamptz,
  completed_at timestamptz,
  idempotency_key text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint event_public_checkouts_status_check check (
    status in ('AWAITING_PAYMENT','PROCESSING','COMPLETED','FAILED','EXPIRED','CANCELLED')
  ),
  constraint event_public_checkouts_payment_method_check check (
    payment_method in ('PIX','CASH','DEBIT_CARD','CREDIT_CARD','NOT_APPLICABLE')
  ),
  constraint event_public_checkouts_registration_unique unique (registration_id),
  constraint event_public_checkouts_access_token_unique unique (access_token_hash),
  constraint event_public_checkouts_idempotency_unique unique (event_id, idempotency_key)
);

create index if not exists event_public_checkouts_expiration_idx
  on public.event_public_checkouts(expires_at, status)
  where status in ('AWAITING_PAYMENT','PROCESSING') and expires_at is not null;

create table if not exists public.event_payment_webhook_events (
  id uuid primary key default gen_random_uuid(),
  provider text not null default 'MERCADO_PAGO',
  provider_event_id text not null,
  provider_payment_id text,
  event_id uuid references public.events(id) on delete set null,
  processing_status text not null default 'PROCESSING',
  payload jsonb not null default '{}'::jsonb,
  received_at timestamptz not null default now(),
  processed_at timestamptz,
  constraint event_payment_webhook_provider_check check (provider in ('MERCADO_PAGO')),
  constraint event_payment_webhook_status_check check (
    processing_status in ('PROCESSING','PROCESSED','IGNORED','FAILED')
  ),
  constraint event_payment_webhook_event_unique unique (provider, provider_event_id)
);

alter table public.event_public_checkouts enable row level security;
alter table public.event_payment_webhook_events enable row level security;

revoke all on table public.event_public_checkouts from public, anon, authenticated;
revoke all on table public.event_payment_webhook_events from public, anon, authenticated;
grant select, insert, update, delete on table public.event_public_checkouts to service_role;
grant select, insert, update, delete on table public.event_payment_webhook_events to service_role;

create or replace function public.start_event_public_checkout(
  p_event_id uuid,
  p_payload jsonb,
  p_idempotency_key text,
  p_access_token_hash text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_created jsonb;
  v_registration public.event_registrations%rowtype;
  v_checkout public.event_public_checkouts%rowtype;
  v_method text;
begin
  if not (select private.is_service_request()) then
    raise exception 'EVENT_PUBLIC_ACCESS_DENIED';
  end if;
  if coalesce(length(p_idempotency_key), 0) < 16
    or coalesce(length(p_access_token_hash), 0) <> 64 then
    raise exception 'EVENT_CHECKOUT_INVALID';
  end if;

  select * into v_checkout
  from public.event_public_checkouts
  where event_id = p_event_id and idempotency_key = p_idempotency_key;
  if found then
    select * into v_registration
    from public.event_registrations where id = v_checkout.registration_id;
    return jsonb_build_object(
      'checkoutId', v_checkout.id,
      'registrationId', v_registration.id,
      'registrationNumber', v_registration.registration_number,
      'registrationStatus', v_registration.status,
      'paymentStatus', v_registration.payment_status,
      'paymentMethod', v_checkout.payment_method,
      'totalAmount', v_registration.total_amount,
      'expiresAt', v_checkout.expires_at,
      'idempotentReplay', true
    );
  end if;

  v_created := public.create_event_registration(p_event_id, p_payload, p_idempotency_key);
  select * into v_registration
  from public.event_registrations
  where id = (v_created->>'registrationId')::uuid
  for update;
  if not found then raise exception 'EVENT_REGISTRATION_NOT_FOUND'; end if;

  v_method := case
    when v_registration.total_amount <= 0 then 'NOT_APPLICABLE'
    else coalesce(nullif(v_registration.preferred_payment_method, ''), 'PIX')
  end;
  if v_method not in ('PIX','CASH','DEBIT_CARD','CREDIT_CARD','NOT_APPLICABLE') then
    raise exception 'EVENT_PAYMENT_METHOD_INVALID';
  end if;

  update public.event_registrations
  set preferred_payment_method = v_method,
      status = case when total_amount <= 0 then 'CONFIRMED' else 'PENDING' end,
      payment_status = case when total_amount <= 0 then 'NOT_REQUIRED' else 'PENDING' end,
      confirmed_at = case when total_amount <= 0 then coalesce(confirmed_at, now()) else null end,
      reservation_expires_at = case when total_amount > 0 and v_method = 'PIX' then now() + interval '30 minutes' else null end,
      qr_token_hash = null,
      qr_token_last4 = null,
      updated_at = now()
  where id = v_registration.id
  returning * into v_registration;

  insert into public.event_public_checkouts (
    church_id, event_id, registration_id, access_token_hash, status,
    payment_method, expires_at, completed_at, idempotency_key
  ) values (
    v_registration.church_id, p_event_id, v_registration.id, p_access_token_hash,
    case when v_registration.total_amount <= 0 then 'COMPLETED' else 'AWAITING_PAYMENT' end,
    v_method,
    case when v_registration.total_amount > 0 and v_method = 'PIX' then v_registration.reservation_expires_at else null end,
    case when v_registration.total_amount <= 0 then now() else null end,
    p_idempotency_key
  ) returning * into v_checkout;

  return jsonb_build_object(
    'checkoutId', v_checkout.id,
    'registrationId', v_registration.id,
    'registrationNumber', v_registration.registration_number,
    'registrationStatus', v_registration.status,
    'paymentStatus', v_registration.payment_status,
    'paymentMethod', v_checkout.payment_method,
    'totalAmount', v_registration.total_amount,
    'expiresAt', v_checkout.expires_at,
    'idempotentReplay', false
  );
end;
$$;

create or replace function public.attach_event_pix_payment(
  p_checkout_id uuid,
  p_provider_payment_id text,
  p_provider_status text,
  p_amount numeric,
  p_expires_at timestamptz,
  p_external_reference text,
  p_idempotency_key text
)
returns public.event_payments
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_checkout public.event_public_checkouts%rowtype;
  v_registration public.event_registrations%rowtype;
  v_payment public.event_payments%rowtype;
  v_sequence integer;
begin
  if not (select private.is_service_request()) then raise exception 'EVENT_PUBLIC_ACCESS_DENIED'; end if;

  select * into v_checkout from public.event_public_checkouts
  where id = p_checkout_id for update;
  if not found or v_checkout.payment_method <> 'PIX' then raise exception 'EVENT_CHECKOUT_INVALID'; end if;

  select * into v_registration from public.event_registrations
  where id = v_checkout.registration_id and deleted_at is null for update;
  if not found then raise exception 'EVENT_REGISTRATION_NOT_FOUND'; end if;
  if round(p_amount, 2) <> round(v_registration.total_amount, 2) or p_amount <= 0 then
    raise exception 'EVENT_PAYMENT_AMOUNT_INVALID';
  end if;

  select * into v_payment from public.event_payments
  where idempotency_key = p_idempotency_key;
  if found then return v_payment; end if;

  select count(*) + 1 into v_sequence from public.event_payments where event_id = v_checkout.event_id;
  insert into public.event_payments (
    church_id, event_id, event_registration_id, payment_number,
    payment_method, payment_status, amount, payer_name,
    transaction_reference, idempotency_key, metadata,
    provider, provider_payment_id, provider_status, provider_status_updated_at,
    expires_at, external_reference, payment_channel
  ) values (
    v_checkout.church_id, v_checkout.event_id, v_registration.id,
    upper(left(v_registration.registration_number, 6)) || '-PX' || lpad(v_sequence::text, 6, '0'),
    'PIX', 'PENDING', p_amount, v_registration.participant_name,
    p_provider_payment_id, p_idempotency_key, '{}'::jsonb,
    'MERCADO_PAGO', p_provider_payment_id, p_provider_status, now(),
    p_expires_at, p_external_reference, 'ONLINE_PIX'
  ) returning * into v_payment;

  update public.event_public_checkouts
  set status = 'PROCESSING', expires_at = p_expires_at, updated_at = now()
  where id = v_checkout.id;
  update public.event_registrations
  set status = 'PENDING', payment_status = 'PENDING', reservation_expires_at = p_expires_at,
      cancelled_at = null, cancel_reason = null, updated_at = now()
  where id = v_registration.id;
  return v_payment;
end;
$$;

create or replace function public.apply_event_provider_payment(
  p_provider_payment_id text,
  p_provider_status text,
  p_normalized_status text,
  p_paid_at timestamptz default null,
  p_metadata jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_payment public.event_payments%rowtype;
  v_registration public.event_registrations%rowtype;
  v_checkout public.event_public_checkouts%rowtype;
  v_payment_status text;
begin
  if not (select private.is_service_request()) then raise exception 'EVENT_PUBLIC_ACCESS_DENIED'; end if;
  if p_normalized_status not in ('PENDING','CONFIRMED','FAILED','CANCELLED','REFUNDED','EXPIRED') then
    raise exception 'EVENT_PAYMENT_STATUS_INVALID';
  end if;

  select * into v_payment from public.event_payments
  where provider = 'MERCADO_PAGO' and provider_payment_id = p_provider_payment_id
  for update;
  if not found then raise exception 'EVENT_PAYMENT_NOT_FOUND'; end if;
  select * into v_registration from public.event_registrations
  where id = v_payment.event_registration_id for update;
  select * into v_checkout from public.event_public_checkouts
  where registration_id = v_registration.id for update;

  -- Notificações atrasadas nunca regridem uma cobrança já confirmada.
  if v_payment.payment_status = 'CONFIRMED' and p_normalized_status <> 'REFUNDED' then
    return jsonb_build_object('paymentId', v_payment.id, 'registrationId', v_registration.id, 'status', 'CONFIRMED');
  end if;

  v_payment_status := case
    when p_normalized_status = 'CONFIRMED' then 'CONFIRMED'
    when p_normalized_status = 'REFUNDED' then 'REFUNDED'
    when p_normalized_status in ('CANCELLED','EXPIRED') then 'CANCELLED'
    when p_normalized_status = 'FAILED' then 'FAILED'
    else 'PENDING'
  end;

  update public.event_payments
  set payment_status = v_payment_status,
      provider_status = p_provider_status,
      provider_status_updated_at = now(),
      paid_at = case when p_normalized_status = 'CONFIRMED' then coalesce(p_paid_at, now()) else paid_at end,
      failed_at = case when p_normalized_status = 'FAILED' then now() else failed_at end,
      cancelled_at = case when p_normalized_status in ('CANCELLED','EXPIRED') then now() else cancelled_at end,
      refunded_at = case when p_normalized_status = 'REFUNDED' then now() else refunded_at end,
      metadata = coalesce(metadata, '{}'::jsonb) || coalesce(p_metadata, '{}'::jsonb),
      updated_at = now()
  where id = v_payment.id
  returning * into v_payment;

  if p_normalized_status = 'CONFIRMED' then
    update public.event_registrations
    set paid_amount = total_amount, payment_status = 'PAID', status = 'CONFIRMED',
        confirmed_at = coalesce(confirmed_at, coalesce(p_paid_at, now())),
        reservation_expires_at = null, updated_at = now()
    where id = v_registration.id returning * into v_registration;
    update public.event_public_checkouts
    set status = 'COMPLETED', completed_at = coalesce(completed_at, now()), expires_at = null, updated_at = now()
    where id = v_checkout.id returning * into v_checkout;
  elsif p_normalized_status = 'REFUNDED' then
    update public.event_registrations
    set paid_amount = 0, payment_status = 'REFUNDED', status = 'CANCELLED',
        cancelled_at = coalesce(cancelled_at, now()), cancel_reason = 'Pagamento estornado',
        qr_token_hash = null, qr_token_last4 = null,
        credential_version = credential_version + 1, updated_at = now()
    where id = v_registration.id returning * into v_registration;
    update public.event_public_checkouts set status = 'CANCELLED', updated_at = now()
    where id = v_checkout.id returning * into v_checkout;
  elsif p_normalized_status = 'EXPIRED' then
    update public.event_registrations
    set status = 'EXPIRED', payment_status = 'CANCELLED', reservation_expires_at = null, updated_at = now()
    where id = v_registration.id and status = 'PENDING' returning * into v_registration;
    update public.event_public_checkouts set status = 'EXPIRED', updated_at = now()
    where id = v_checkout.id returning * into v_checkout;
  elsif p_normalized_status in ('FAILED','CANCELLED') then
    update public.event_public_checkouts set status = 'FAILED', updated_at = now()
    where id = v_checkout.id returning * into v_checkout;
  end if;

  return jsonb_build_object(
    'paymentId', v_payment.id,
    'registrationId', v_registration.id,
    'status', p_normalized_status,
    'registrationStatus', v_registration.status
  );
end;
$$;

-- Pagamentos manuais registrados no workspace também confirmam a inscrição
-- quando quitam integralmente o valor devido.
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

  select coalesce(sum(payment.amount), 0) into v_paid
  from public.event_payments payment
  where payment.event_registration_id = p_registration_id
    and payment.payment_status = 'CONFIRMED'
    and payment.deleted_at is null;

  update public.event_registrations
  set paid_amount = least(v_paid, v_total),
      payment_status = case
        when v_total <= 0 then 'NOT_REQUIRED'
        when v_paid >= v_total then 'PAID'
        when v_paid > 0 then 'PARTIAL'
        else 'PENDING'
      end,
      status = case
        when status in ('CANCELLED','EXPIRED','CHECKED_IN','NO_SHOW') then status
        when v_total <= 0 or v_paid >= v_total then 'CONFIRMED'
        else 'PENDING'
      end,
      confirmed_at = case
        when (v_total <= 0 or v_paid >= v_total) and confirmed_at is null then now()
        else confirmed_at
      end,
      reservation_expires_at = case when v_total <= 0 or v_paid >= v_total then null else reservation_expires_at end,
      updated_at = now()
  where id = p_registration_id;
end;
$$;

revoke all on function public.start_event_public_checkout(uuid, jsonb, text, text) from public, anon, authenticated;
revoke all on function public.attach_event_pix_payment(uuid, text, text, numeric, timestamptz, text, text) from public, anon, authenticated;
revoke all on function public.apply_event_provider_payment(text, text, text, timestamptz, jsonb) from public, anon, authenticated;
grant execute on function public.start_event_public_checkout(uuid, jsonb, text, text) to service_role;
grant execute on function public.attach_event_pix_payment(uuid, text, text, numeric, timestamptz, text, text) to service_role;
grant execute on function public.apply_event_provider_payment(text, text, text, timestamptz, jsonb) to service_role;

commit;
