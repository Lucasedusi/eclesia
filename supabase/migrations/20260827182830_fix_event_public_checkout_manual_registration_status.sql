begin;

-- O checkout público precisa usar a mesma regra de inscrições manuais e a
-- mesma validação de campos personalizados utilizada pelo cadastro interno.
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

revoke all on function public.start_event_public_checkout(uuid, jsonb, text, text)
  from public, anon, authenticated;
grant execute on function public.start_event_public_checkout(uuid, jsonb, text, text)
  to service_role;

commit;
