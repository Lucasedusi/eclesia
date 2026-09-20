begin;

alter table public.event_payment_settings
  add column if not exists individual_pix_mode text not null default 'AUTOMATIC',
  add column if not exists individual_pix_key text,
  add column if not exists individual_pix_holder_name text,
  add column if not exists individual_pix_qr_storage_bucket text,
  add column if not exists individual_pix_qr_storage_path text,
  add column if not exists individual_pix_qr_file_name text,
  add column if not exists individual_cash_enabled boolean not null default false,
  add column if not exists individual_card_enabled boolean not null default false,
  add column if not exists individual_whatsapp_number text,
  add column if not exists individual_payment_instructions text;

alter table public.event_payment_settings
  drop constraint if exists event_payment_settings_individual_valid_check;
alter table public.event_payment_settings
  add constraint event_payment_settings_individual_valid_check check (
    individual_pix_mode in ('DISABLED','STATIC','AUTOMATIC')
    and (
      individual_pix_mode <> 'STATIC'
      or (
        coalesce(btrim(individual_pix_key),'') <> ''
        and coalesce(btrim(individual_pix_holder_name),'') <> ''
      )
    )
    and (
      not (individual_cash_enabled or individual_card_enabled)
      or coalesce(regexp_replace(individual_whatsapp_number, '[^0-9]', '', 'g'),'') <> ''
    )
  );

-- Todo evento precisa de uma linha de configuração para que o checkout
-- consiga validar a forma escolhida sem depender de defaults no cliente.
insert into public.event_payment_settings (
  church_id,event_id,individual_pix_mode,created_by,updated_by
)
select event.church_id,event.id,'AUTOMATIC',event.created_by,event.updated_by
from public.events event
where event.deleted_at is null
  and not exists (
    select 1 from public.event_payment_settings settings
    where settings.event_id=event.id and settings.deleted_at is null
  );

alter table public.event_public_checkouts
  add column if not exists payment_flow text not null default 'NOT_APPLICABLE';

update public.event_public_checkouts
set payment_flow=case
  when payment_method='PIX' then 'AUTOMATIC_PIX'
  when payment_method='NOT_APPLICABLE' then 'NOT_APPLICABLE'
  else 'MANUAL'
end
where payment_flow='NOT_APPLICABLE' and payment_method<>'NOT_APPLICABLE';

alter table public.event_public_checkouts
  drop constraint if exists event_public_checkouts_payment_flow_check;
alter table public.event_public_checkouts
  add constraint event_public_checkouts_payment_flow_check check (
    payment_flow in ('NOT_APPLICABLE','AUTOMATIC_PIX','STATIC_PIX','MANUAL')
    and (
      (payment_method='NOT_APPLICABLE' and payment_flow='NOT_APPLICABLE')
      or (payment_method='PIX' and payment_flow in ('AUTOMATIC_PIX','STATIC_PIX'))
      or (payment_method in ('CASH','DEBIT_CARD','CREDIT_CARD') and payment_flow='MANUAL')
    )
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
  if v_method not in ('PIX','CASH','DEBIT_CARD','CREDIT_CARD','NOT_APPLICABLE') then
    raise exception 'EVENT_PAYMENT_METHOD_INVALID';
  end if;

  if v_method='NOT_APPLICABLE' then
    v_flow:='NOT_APPLICABLE';
  else
    select * into v_settings
    from public.event_payment_settings
    where event_id=p_event_id and deleted_at is null;
    if not found then raise exception 'EVENT_PAYMENT_SETTINGS_NOT_FOUND'; end if;

    v_flow:=case
      when v_method='PIX' and v_settings.individual_pix_mode='AUTOMATIC' then 'AUTOMATIC_PIX'
      when v_method='PIX' and v_settings.individual_pix_mode='STATIC' then 'STATIC_PIX'
      when v_method='CASH' and v_settings.individual_cash_enabled then 'MANUAL'
      when v_method in ('DEBIT_CARD','CREDIT_CARD') and v_settings.individual_card_enabled then 'MANUAL'
      else null
    end;
    if v_flow is null then raise exception 'EVENT_PAYMENT_METHOD_DISABLED'; end if;
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
    payment_method, payment_flow, expires_at, completed_at, idempotency_key
  ) values (
    v_registration.church_id, p_event_id, v_registration.id, p_access_token_hash,
    case when v_registration.total_amount <= 0 then 'COMPLETED' else 'AWAITING_PAYMENT' end,
    v_method, v_flow,
    case when v_registration.total_amount > 0 and v_flow = 'AUTOMATIC_PIX' then v_registration.reservation_expires_at else null end,
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
    'paymentFlow', v_checkout.payment_flow,
    'totalAmount', v_registration.total_amount,
    'expiresAt', v_checkout.expires_at,
    'idempotentReplay', false
  );
end;
$$;

revoke all on function public.start_event_public_checkout(uuid,jsonb,text,text)
  from public,anon,authenticated;
grant execute on function public.start_event_public_checkout(uuid,jsonb,text,text)
  to service_role;

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

create or replace function private.audit_event_payment_settings()
returns trigger language plpgsql security definer set search_path='' as $$
declare v_old jsonb;v_new jsonb;
begin
  v_old:=case when tg_op='INSERT' then null else jsonb_build_object(
    'caravanPixEnabled',old.pix_enabled,'caravanCashEnabled',old.cash_enabled,
    'allowParticipantList',old.allow_participant_list,'mainItemId',old.caravan_registration_item_id,
    'hasCaravanQrCode',old.pix_qr_storage_path is not null,'hasCaravanWhatsapp',old.whatsapp_number is not null,
    'individualPixMode',old.individual_pix_mode,'individualCashEnabled',old.individual_cash_enabled,
    'individualCardEnabled',old.individual_card_enabled,'hasIndividualQrCode',old.individual_pix_qr_storage_path is not null,
    'hasIndividualWhatsapp',old.individual_whatsapp_number is not null
  ) end;
  v_new:=jsonb_build_object(
    'caravanPixEnabled',new.pix_enabled,'caravanCashEnabled',new.cash_enabled,
    'allowParticipantList',new.allow_participant_list,'mainItemId',new.caravan_registration_item_id,
    'hasCaravanQrCode',new.pix_qr_storage_path is not null,'hasCaravanWhatsapp',new.whatsapp_number is not null,
    'individualPixMode',new.individual_pix_mode,'individualCashEnabled',new.individual_cash_enabled,
    'individualCardEnabled',new.individual_card_enabled,'hasIndividualQrCode',new.individual_pix_qr_storage_path is not null,
    'hasIndividualWhatsapp',new.individual_whatsapp_number is not null
  );
  if tg_op='UPDATE' and v_old=v_new then return null;end if;
  perform public.log_audit(new.church_id,'EVENTS',case when tg_op='INSERT' then 'CREATE_PAYMENT_SETTINGS' else 'UPDATE_PAYMENT_SETTINGS' end,'EVENT_PAYMENT_SETTINGS',new.id,'Configuração de pagamentos','Configuração de pagamentos do evento atualizada',v_old,v_new,jsonb_build_object('event_id',new.event_id),'INFO');
  return null;
end;$$;

commit;
