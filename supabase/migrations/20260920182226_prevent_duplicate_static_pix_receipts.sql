begin;

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
  v_receipt_path text:=nullif(p_payload->>'receiptPath','');
  v_expected_prefix text;
begin
  if not (select private.is_service_request()) then
    raise exception 'EVENT_PUBLIC_ACCESS_DENIED';
  end if;
  if coalesce(length(p_idempotency_key),0)<16 or v_receipt_path is null then
    raise exception 'EVENT_STATIC_PIX_RECEIPT_INVALID';
  end if;

  select * into v_event
  from public.events
  where id=p_event_id and deleted_at is null
  for update;
  if not found then raise exception 'EVENT_NOT_FOUND'; end if;

  select * into v_checkout
  from public.event_public_checkouts
  where id=p_checkout_id and event_id=p_event_id and checkout_type='INDIVIDUAL'
    and payment_method='PIX' and payment_flow='STATIC_PIX'
    and status='AWAITING_PAYMENT'
  for update;
  if not found then raise exception 'EVENT_CHECKOUT_INVALID'; end if;

  select * into v_registration
  from public.event_registrations
  where id=v_checkout.registration_id and event_id=p_event_id
    and status='PENDING' and payment_status='PENDING' and deleted_at is null
  for update;
  if not found or v_registration.remaining_amount<=0 then
    raise exception 'EVENT_REGISTRATION_NOT_FOUND';
  end if;

  select * into v_payment
  from public.event_payments
  where event_id=p_event_id and idempotency_key=p_idempotency_key;
  if found then return v_payment; end if;

  select * into v_payment
  from public.event_payments
  where event_id=p_event_id
    and event_registration_id=v_registration.id
    and payment_method='PIX'
    and payment_status='PENDING'
    and payment_channel='INTERNAL_MANUAL'
    and metadata->>'paymentFlow'='STATIC_PIX'
    and deleted_at is null
  order by created_at
  limit 1;
  if found then return v_payment; end if;

  v_expected_prefix:=v_event.church_id::text||'/events/'||p_event_id::text||
    '/public-individuals/'||p_checkout_id::text||'/static-pix/';
  if left(v_receipt_path,length(v_expected_prefix))<>v_expected_prefix then
    raise exception 'EVENT_STATIC_PIX_RECEIPT_INVALID';
  end if;

  select count(*)+1 into v_number
  from public.event_payments
  where event_id=p_event_id;

  insert into public.event_payments (
    church_id,event_id,event_registration_id,event_group_id,payment_number,
    payment_method,payment_status,amount,installment_number,installments_total,
    payer_name,idempotency_key,metadata,receipt_storage_path,receipt_file_name,
    receipt_mime_type,receipt_file_size,payment_channel,created_by,updated_by
  ) values (
    v_event.church_id,p_event_id,v_registration.id,null,
    upper(left(v_event.public_code,6))||'-P'||lpad(v_number::text,6,'0'),
    'PIX','PENDING',v_registration.remaining_amount,1,1,
    v_registration.participant_name,p_idempotency_key,
    jsonb_build_object('source','PUBLIC','paymentFlow','STATIC_PIX','checkoutId',p_checkout_id),
    v_receipt_path,nullif(btrim(p_payload->>'receiptFileName'),''),
    nullif(p_payload->>'receiptMimeType',''),nullif(p_payload->>'receiptFileSize','')::bigint,
    'INTERNAL_MANUAL',null,null
  ) returning * into v_payment;

  perform public.log_audit(
    v_event.church_id,'EVENTS','SUBMIT_STATIC_PIX_RECEIPT','EVENT_PAYMENT',
    v_payment.id,v_payment.payment_number,'Comprovante de Pix estático enviado',null,
    jsonb_build_object('event_id',p_event_id,'registration_id',v_registration.id,'amount',v_payment.amount),
    '{}'::jsonb,'INFO'
  );
  return v_payment;
end;
$$;

revoke all on function public.submit_event_public_static_pix_receipt(uuid,uuid,jsonb,text)
  from public,anon,authenticated;
grant execute on function public.submit_event_public_static_pix_receipt(uuid,uuid,jsonb,text)
  to service_role;

commit;
