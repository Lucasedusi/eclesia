begin;

create or replace function private.normalize_event_registration_payment_method()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.total_amount > 0 then
    if new.preferred_payment_method is null
      or new.preferred_payment_method not in ('PIX','CASH','CREDIT_CARD','DEBIT_CARD','BANK_TRANSFER','BANK_SLIP','OTHER') then
      new.preferred_payment_method := 'PIX';
    end if;
  else
    new.preferred_payment_method := 'NOT_APPLICABLE';
  end if;
  return new;
end;
$$;

revoke all on function private.normalize_event_registration_payment_method() from public, anon, authenticated, service_role;

drop trigger if exists normalize_event_registration_payment_method on public.event_registrations;
create trigger normalize_event_registration_payment_method
before insert or update of total_amount, preferred_payment_method on public.event_registrations
for each row execute function private.normalize_event_registration_payment_method();

update public.event_registrations
set preferred_payment_method = case when total_amount > 0 then 'PIX' else 'NOT_APPLICABLE' end
where (total_amount > 0 and (
    preferred_payment_method is null
    or preferred_payment_method not in ('PIX','CASH','CREDIT_CARD','DEBIT_CARD','BANK_TRANSFER','BANK_SLIP','OTHER')
  ))
  or (total_amount <= 0 and preferred_payment_method is distinct from 'NOT_APPLICABLE');

alter table public.event_registrations
  drop constraint if exists event_registration_payment_method_matches_total_check;
alter table public.event_registrations
  add constraint event_registration_payment_method_matches_total_check check (
    (total_amount > 0 and preferred_payment_method in ('PIX','CASH','CREDIT_CARD','DEBIT_CARD','BANK_TRANSFER','BANK_SLIP','OTHER'))
    or (total_amount <= 0 and preferred_payment_method = 'NOT_APPLICABLE')
  );

update public.event_payments
set payment_method = 'PIX'
where payment_method = 'NOT_APPLICABLE';

alter table public.event_payments
  drop constraint if exists event_payment_method_valid_check;
alter table public.event_payments
  add constraint event_payment_method_valid_check check (
    payment_method in ('PIX','CASH','CREDIT_CARD','DEBIT_CARD','BANK_TRANSFER','BANK_SLIP','OTHER')
  );

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
  v_payment_method text;
  v_approve_pending boolean;
  v_actor uuid := (select auth.uid());
begin
  select * into v_event
  from public.events
  where id = p_event_id and deleted_at is null
  for update;
  if not found then raise exception 'EVENT_NOT_FOUND'; end if;

  v_approve_pending := coalesce((p_payload->>'approvePending')::boolean, false);
  if v_approve_pending then
    if not (select private.can_access_event_id(p_event_id, 'events.payments.approve')) then
      raise exception 'EVENT_ACCESS_DENIED';
    end if;
  elsif not (select private.can_access_event_id(p_event_id, 'events.payments.manage')) then
    raise exception 'EVENT_ACCESS_DENIED';
  end if;

  if p_idempotency_key is not null then
    select * into v_payment
    from public.event_payments
    where event_id = p_event_id and idempotency_key = p_idempotency_key;
    if found then return v_payment; end if;
  end if;

  if v_approve_pending then
    select * into v_payment
    from public.event_payments
    where event_id = p_event_id
      and event_registration_id = p_registration_id
      and payment_status = 'PENDING'
      and deleted_at is null
    order by created_at desc
    limit 1
    for update;

    if found then
      select * into v_registration
      from public.event_registrations
      where id = p_registration_id
        and event_id = p_event_id
        and status not in ('CANCELLED','EXPIRED')
        and deleted_at is null
      for update;
      if not found then raise exception 'EVENT_REGISTRATION_NOT_FOUND'; end if;
      if v_registration.remaining_amount <= 0 then raise exception 'EVENT_PAYMENT_ALREADY_SETTLED'; end if;
      if v_payment.amount <= 0 or v_payment.amount > v_registration.remaining_amount then
        raise exception 'EVENT_PAYMENT_EXCEEDS_BALANCE';
      end if;

      v_amount := v_payment.amount;
      v_payment_method := upper(coalesce(
        nullif(btrim(p_payload->>'paymentMethod'), ''),
        nullif(btrim(v_registration.preferred_payment_method), ''),
        'PIX'
      ));
      if v_payment_method = 'NOT_APPLICABLE' then v_payment_method := 'PIX'; end if;
      if v_payment_method not in ('PIX','CASH','CREDIT_CARD','DEBIT_CARD','BANK_TRANSFER','BANK_SLIP','OTHER') then
        raise exception 'EVENT_PAYMENT_METHOD_INVALID';
      end if;

      update public.event_payments
      set payment_method = v_payment_method,
          payment_status = 'CONFIRMED',
          paid_at = coalesce(paid_at, now()),
          confirmed_by = v_actor,
          updated_by = v_actor
      where id = v_payment.id
      returning * into v_payment;

      update public.event_registrations
      set preferred_payment_method = v_payment_method,
          updated_by = v_actor
      where id = p_registration_id;

      perform private.recalculate_event_registration(p_registration_id);
      perform public.log_audit(
        v_event.church_id, 'EVENTS', 'APPROVE_PAYMENT', 'EVENT_PAYMENT',
        v_payment.id, v_payment.payment_number, 'Pagamento pendente aprovado manualmente', null,
        jsonb_build_object('event_id', p_event_id, 'registration_id', p_registration_id, 'amount', v_amount),
        '{}'::jsonb, 'INFO'
      );
      return v_payment;
    end if;

    if not (select private.can_access_event_id(p_event_id, 'events.payments.manage')) then
      raise exception 'EVENT_ACCESS_DENIED';
    end if;
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

  v_payment_method := upper(coalesce(
    nullif(btrim(p_payload->>'paymentMethod'), ''),
    nullif(btrim(v_registration.preferred_payment_method), ''),
    'PIX'
  ));
  if v_payment_method = 'NOT_APPLICABLE' then v_payment_method := 'PIX'; end if;
  if v_payment_method not in ('PIX','CASH','CREDIT_CARD','DEBIT_CARD','BANK_TRANSFER','BANK_SLIP','OTHER') then
    raise exception 'EVENT_PAYMENT_METHOD_INVALID';
  end if;

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
    v_payment_method, 'CONFIRMED', v_amount, now(), 1, 1,
    v_registration.participant_name, p_idempotency_key, v_actor,
    nullif(p_payload->>'receiptPath', ''), nullif(btrim(p_payload->>'receiptFileName'), ''),
    nullif(p_payload->>'receiptMimeType', ''), nullif(p_payload->>'receiptFileSize', '')::bigint,
    v_actor, v_actor
  ) returning * into v_payment;

  if v_registration.preferred_payment_method is null
    or v_registration.preferred_payment_method = 'NOT_APPLICABLE' then
    update public.event_registrations
    set preferred_payment_method = v_payment_method,
        updated_by = v_actor
    where id = p_registration_id;
  end if;

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

revoke all on function public.record_event_registration_payment(uuid, uuid, jsonb, text) from public, anon;
grant execute on function public.record_event_registration_payment(uuid, uuid, jsonb, text) to authenticated;

commit;
