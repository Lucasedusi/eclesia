begin;

-- Preserve the payment choices exposed by the legacy individual checkout. Before
-- the per-event flags existed, a configured shared WhatsApp enabled cash and both
-- card choices for individual registrations.
update public.event_payment_settings settings
set individual_cash_enabled = true,
    individual_card_enabled = true,
    individual_whatsapp_number = settings.whatsapp_number,
    individual_payment_instructions = coalesce(
      settings.individual_payment_instructions,
      settings.payment_instructions
    ),
    updated_at = now()
from public.events event
where event.id = settings.event_id
  and event.requires_payment
  and event.registration_mode in ('INDIVIDUAL', 'MIXED')
  and nullif(regexp_replace(settings.whatsapp_number, '[^0-9]', '', 'g'), '') is not null
  and settings.individual_pix_mode = 'AUTOMATIC'
  and not settings.individual_cash_enabled
  and not settings.individual_card_enabled
  and settings.individual_whatsapp_number is null;

alter table public.event_public_checkouts
  drop constraint if exists event_public_checkouts_payment_flow_check;

-- The previous migration inferred an individual flow from payment_method for all
-- historical rows. Caravan checkouts keep their own legacy method and do not use
-- the individual payment-flow state machine.
update public.event_public_checkouts
set payment_flow = 'NOT_APPLICABLE',
    updated_at = now()
where checkout_type = 'CARAVAN'
  and payment_flow <> 'NOT_APPLICABLE';

alter table public.event_public_checkouts
  add constraint event_public_checkouts_payment_flow_check check (
    (checkout_type = 'CARAVAN' and payment_flow = 'NOT_APPLICABLE')
    or
    (checkout_type = 'INDIVIDUAL' and (
      (payment_method = 'NOT_APPLICABLE' and payment_flow = 'NOT_APPLICABLE')
      or (payment_method = 'PIX' and payment_flow in ('AUTOMATIC_PIX', 'STATIC_PIX'))
      or (payment_method in ('CASH', 'DEBIT_CARD', 'CREDIT_CARD') and payment_flow = 'MANUAL')
    ))
  );

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
  v_settings public.event_payment_settings%rowtype;
  v_method text;
  v_flow text;
  v_draft_payload jsonb := '{}'::jsonb;
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
      'paymentFlow', v_checkout.payment_flow,
      'totalAmount', v_registration.total_amount,
      'expiresAt', v_checkout.expires_at,
      'idempotentReplay', true
    );
  end if;

  v_created := public.create_event_registration_v3(p_event_id, p_payload, p_idempotency_key);
  select * into v_registration
  from public.event_registrations
  where id = (v_created->>'registrationId')::uuid
  for update;
  if not found then raise exception 'EVENT_REGISTRATION_NOT_FOUND'; end if;

  v_method := case
    when v_registration.total_amount <= 0 then 'NOT_APPLICABLE'
    else coalesce(nullif(v_registration.preferred_payment_method, ''), 'PIX')
  end;
  if v_method not in ('PIX', 'CASH', 'DEBIT_CARD', 'CREDIT_CARD', 'NOT_APPLICABLE') then
    raise exception 'EVENT_PAYMENT_METHOD_INVALID';
  end if;

  if v_method = 'NOT_APPLICABLE' then
    v_flow := 'NOT_APPLICABLE';
  else
    select * into v_settings
    from public.event_payment_settings
    where event_id = p_event_id and deleted_at is null;
    if not found then raise exception 'EVENT_PAYMENT_SETTINGS_NOT_FOUND'; end if;

    v_flow := case
      when v_method = 'PIX' and v_settings.individual_pix_mode = 'AUTOMATIC' then 'AUTOMATIC_PIX'
      when v_method = 'PIX' and v_settings.individual_pix_mode = 'STATIC' then 'STATIC_PIX'
      when v_method = 'CASH' and v_settings.individual_cash_enabled then 'MANUAL'
      when v_method in ('DEBIT_CARD', 'CREDIT_CARD') and v_settings.individual_card_enabled then 'MANUAL'
      else null
    end;
    if v_flow is null then raise exception 'EVENT_PAYMENT_METHOD_DISABLED'; end if;

    v_draft_payload := case
      when v_flow = 'STATIC_PIX' then jsonb_build_object(
        'paymentSnapshot', jsonb_build_object(
          'version', 1,
          'flow', 'STATIC_PIX',
          'pixKey', coalesce(v_settings.individual_pix_key, ''),
          'pixHolderName', coalesce(v_settings.individual_pix_holder_name, ''),
          'pixQrStorageBucket', v_settings.individual_pix_qr_storage_bucket,
          'pixQrStoragePath', v_settings.individual_pix_qr_storage_path,
          'paymentInstructions', coalesce(v_settings.individual_payment_instructions, '')
        )
      )
      when v_flow = 'MANUAL' then jsonb_build_object(
        'paymentSnapshot', jsonb_build_object(
          'version', 1,
          'flow', 'MANUAL',
          'whatsappNumber', coalesce(v_settings.individual_whatsapp_number, ''),
          'paymentInstructions', coalesce(v_settings.individual_payment_instructions, '')
        )
      )
      else '{}'::jsonb
    end;
  end if;

  update public.event_registrations
  set preferred_payment_method = v_method,
      status = case when total_amount <= 0 then 'CONFIRMED' else 'PENDING' end,
      payment_status = case when total_amount <= 0 then 'NOT_REQUIRED' else 'PENDING' end,
      confirmed_at = case when total_amount <= 0 then coalesce(confirmed_at, now()) else null end,
      reservation_expires_at = case when total_amount > 0 and v_flow = 'AUTOMATIC_PIX' then now() + interval '30 minutes' else null end,
      qr_token_hash = null,
      qr_token_last4 = null,
      updated_at = now()
  where id = v_registration.id
  returning * into v_registration;

  insert into public.event_public_checkouts (
    church_id, event_id, registration_id, access_token_hash, status,
    payment_method, payment_flow, expires_at, completed_at, idempotency_key,
    draft_payload
  ) values (
    v_registration.church_id, p_event_id, v_registration.id, p_access_token_hash,
    case when v_registration.total_amount <= 0 then 'COMPLETED' else 'AWAITING_PAYMENT' end,
    v_method, v_flow,
    case when v_registration.total_amount > 0 and v_flow = 'AUTOMATIC_PIX' then v_registration.reservation_expires_at else null end,
    case when v_registration.total_amount <= 0 then now() else null end,
    p_idempotency_key,
    v_draft_payload
  ) returning * into v_checkout;

  return jsonb_build_object(
    'checkoutId', v_checkout.id,
    'registrationId', v_registration.id,
    'registrationNumber', v_registration.registration_number,
    'registrationStatus', v_registration.status,
    'paymentStatus', v_registration.payment_status,
    'paymentMethod', v_checkout.payment_method,
    'paymentFlow', v_checkout.payment_flow,
    'totalAmount', v_registration.total_amount,
    'expiresAt', v_checkout.expires_at,
    'idempotentReplay', false
  );
end;
$$;

revoke all on function public.start_event_public_checkout(uuid, jsonb, text, text)
  from public, anon, authenticated;
grant execute on function public.start_event_public_checkout(uuid, jsonb, text, text)
  to service_role;

-- Pending checkouts created before this migration receive the best available
-- snapshot so later configuration changes do not invalidate their instructions.
update public.event_public_checkouts checkout
set draft_payload = jsonb_set(
      coalesce(checkout.draft_payload, '{}'::jsonb),
      '{paymentSnapshot}',
      case
        when checkout.payment_flow = 'STATIC_PIX' then jsonb_build_object(
          'version', 1,
          'flow', 'STATIC_PIX',
          'pixKey', coalesce(settings.individual_pix_key, ''),
          'pixHolderName', coalesce(settings.individual_pix_holder_name, ''),
          'pixQrStorageBucket', settings.individual_pix_qr_storage_bucket,
          'pixQrStoragePath', settings.individual_pix_qr_storage_path,
          'paymentInstructions', coalesce(settings.individual_payment_instructions, '')
        )
        else jsonb_build_object(
          'version', 1,
          'flow', 'MANUAL',
          'whatsappNumber', coalesce(settings.individual_whatsapp_number, ''),
          'paymentInstructions', coalesce(settings.individual_payment_instructions, '')
        )
      end,
      true
    ),
    updated_at = now()
from public.event_payment_settings settings
where checkout.event_id = settings.event_id
  and checkout.checkout_type = 'INDIVIDUAL'
  and checkout.payment_flow in ('STATIC_PIX', 'MANUAL')
  and checkout.status in ('AWAITING_PAYMENT', 'PROCESSING')
  and not (coalesce(checkout.draft_payload, '{}'::jsonb) ? 'paymentSnapshot');

create or replace function public.submit_event_public_static_pix_receipt(
  p_event_id uuid,
  p_checkout_id uuid,
  p_payload jsonb,
  p_idempotency_key text
)
returns public.event_payments
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_event public.events%rowtype;
  v_checkout public.event_public_checkouts%rowtype;
  v_registration public.event_registrations%rowtype;
  v_payment public.event_payments%rowtype;
  v_number integer;
  v_receipt_path text := nullif(p_payload->>'receiptPath', '');
  v_expected_prefix text;
  v_receipt_suffix text;
  v_receipt_file_name text;
begin
  if not (select private.is_service_request()) then
    raise exception 'EVENT_PUBLIC_ACCESS_DENIED';
  end if;
  if coalesce(length(p_idempotency_key), 0) < 16 or v_receipt_path is null then
    raise exception 'EVENT_STATIC_PIX_RECEIPT_INVALID';
  end if;

  select * into v_event
  from public.events
  where id = p_event_id and deleted_at is null
  for update;
  if not found then raise exception 'EVENT_NOT_FOUND'; end if;

  select * into v_checkout
  from public.event_public_checkouts
  where id = p_checkout_id and event_id = p_event_id and checkout_type = 'INDIVIDUAL'
    and payment_method = 'PIX' and payment_flow = 'STATIC_PIX'
    and status = 'AWAITING_PAYMENT'
  for update;
  if not found then raise exception 'EVENT_CHECKOUT_INVALID'; end if;

  select * into v_registration
  from public.event_registrations
  where id = v_checkout.registration_id and event_id = p_event_id
    and status = 'PENDING' and payment_status = 'PENDING' and deleted_at is null
  for update;
  if not found or v_registration.remaining_amount <= 0 then
    raise exception 'EVENT_REGISTRATION_NOT_FOUND';
  end if;

  v_expected_prefix := v_event.church_id::text || '/events/' || p_event_id::text ||
    '/public-individuals/' || p_checkout_id::text || '/static-pix/';
  if left(v_receipt_path, length(v_expected_prefix)) <> v_expected_prefix then
    raise exception 'EVENT_STATIC_PIX_RECEIPT_INVALID';
  end if;
  v_receipt_suffix := substring(v_receipt_path from length(v_expected_prefix) + 1);
  v_receipt_file_name := split_part(v_receipt_suffix, '/', 2);
  if v_receipt_suffix !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/[a-z0-9._-]{1,180}$'
    or v_receipt_file_name in ('.', '..') then
    raise exception 'EVENT_STATIC_PIX_RECEIPT_INVALID';
  end if;

  select * into v_payment
  from public.event_payments
  where event_id = p_event_id and idempotency_key = p_idempotency_key;
  if found then return v_payment; end if;

  select * into v_payment
  from public.event_payments
  where event_id = p_event_id
    and event_registration_id = v_registration.id
    and payment_method = 'PIX'
    and payment_status = 'PENDING'
    and payment_channel = 'INTERNAL_MANUAL'
    and metadata->>'paymentFlow' = 'STATIC_PIX'
    and deleted_at is null
  order by created_at
  limit 1;
  if found then return v_payment; end if;

  select count(*) + 1 into v_number
  from public.event_payments
  where event_id = p_event_id;

  insert into public.event_payments (
    church_id, event_id, event_registration_id, event_group_id, payment_number,
    payment_method, payment_status, amount, installment_number, installments_total,
    payer_name, idempotency_key, metadata, receipt_storage_path, receipt_file_name,
    receipt_mime_type, receipt_file_size, payment_channel, created_by, updated_by
  ) values (
    v_event.church_id, p_event_id, v_registration.id, null,
    upper(left(v_event.public_code, 6)) || '-P' || lpad(v_number::text, 6, '0'),
    'PIX', 'PENDING', v_registration.remaining_amount, 1, 1,
    v_registration.participant_name, p_idempotency_key,
    jsonb_build_object('source', 'PUBLIC', 'paymentFlow', 'STATIC_PIX', 'checkoutId', p_checkout_id),
    v_receipt_path, nullif(btrim(p_payload->>'receiptFileName'), ''),
    nullif(p_payload->>'receiptMimeType', ''), nullif(p_payload->>'receiptFileSize', '')::bigint,
    'INTERNAL_MANUAL', null, null
  ) returning * into v_payment;

  perform public.log_audit(
    v_event.church_id, 'EVENTS', 'SUBMIT_STATIC_PIX_RECEIPT', 'EVENT_PAYMENT',
    v_payment.id, v_payment.payment_number, 'Comprovante de Pix estático enviado', null,
    jsonb_build_object('event_id', p_event_id, 'registration_id', v_registration.id, 'amount', v_payment.amount),
    '{}'::jsonb, 'INFO'
  );
  return v_payment;
end;
$$;

revoke all on function public.submit_event_public_static_pix_receipt(uuid, uuid, jsonb, text)
  from public, anon, authenticated;
grant execute on function public.submit_event_public_static_pix_receipt(uuid, uuid, jsonb, text)
  to service_role;

create or replace function private.can_access_event_static_receipt(p_object_name text)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_folders text[] := storage.foldername(p_object_name);
  v_event_id uuid;
  v_checkout_id uuid;
begin
  if array_length(v_folders, 1) <> 7
    or v_folders[2] <> 'events'
    or v_folders[4] <> 'public-individuals'
    or v_folders[6] <> 'static-pix'
    or v_folders[1] !~* '^[0-9a-f-]{36}$'
    or v_folders[3] !~* '^[0-9a-f-]{36}$'
    or v_folders[5] !~* '^[0-9a-f-]{36}$'
    or v_folders[7] !~* '^[0-9a-f-]{36}$' then
    return false;
  end if;

  v_event_id := v_folders[3]::uuid;
  v_checkout_id := v_folders[5]::uuid;
  return exists (
    select 1
    from public.events event
    join public.event_public_checkouts checkout
      on checkout.id = v_checkout_id
      and checkout.event_id = event.id
      and checkout.checkout_type = 'INDIVIDUAL'
      and checkout.payment_flow = 'STATIC_PIX'
    join public.event_payments payment
      on payment.event_registration_id = checkout.registration_id
      and payment.event_id = event.id
      and payment.receipt_storage_path = p_object_name
      and payment.deleted_at is null
    where event.id = v_event_id
      and event.church_id::text = v_folders[1]
      and event.deleted_at is null
      and (select private.can_access_event_id(event.id, 'events.payments.view'))
  );
exception when invalid_text_representation then
  return false;
end;
$$;

revoke all on function private.can_access_event_static_receipt(text)
  from public, anon;
grant execute on function private.can_access_event_static_receipt(text)
  to authenticated, service_role;

drop policy if exists event_documents_storage_select on storage.objects;
create policy event_documents_storage_select on storage.objects for select to authenticated
using (
  bucket_id = 'event-documents' and (storage.foldername(name))[2] = 'events' and (
    ((storage.foldername(name))[4] = 'documents' and (select private.can_access_event_id(((storage.foldername(name))[3])::uuid, 'events.documents.view')))
    or ((storage.foldername(name))[4] = 'payment-receipts' and (select private.can_access_event_id(((storage.foldername(name))[3])::uuid, 'events.payments.view')))
    or ((storage.foldername(name))[4] = 'public-individuals' and (select private.can_access_event_static_receipt(name)))
    or ((storage.foldername(name))[4] = 'expenses' and (select private.can_access_event_id(((storage.foldername(name))[3])::uuid, 'events.expenses.view')))
    or ((storage.foldername(name))[4] in ('caravans', 'public-caravans') and (select private.can_access_event_id(((storage.foldername(name))[3])::uuid, 'events.groups.view')))
  )
);

commit;
