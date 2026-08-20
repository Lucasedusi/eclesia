alter table public.event_payments
  add column if not exists failed_at timestamptz,
  add column if not exists failed_by uuid references public.profiles(id) on delete restrict,
  add column if not exists failure_reason text;

alter table public.event_payments drop constraint if exists event_payment_valid_v2_check;
alter table public.event_payments add constraint event_payment_valid_v2_check check (
  amount > 0 and installment_number > 0 and installments_total > 0
  and installment_number <= installments_total
  and payment_status in ('PENDING','CONFIRMED','FAILED','CANCELLED','REFUNDED')
);

create or replace function public.change_event_payment_status(
  p_payment_id uuid,
  p_status text,
  p_reason text default null
)
returns public.event_payments
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_payment public.event_payments%rowtype;
  v_actor uuid := (select auth.uid());
  v_status text := upper(p_status);
begin
  select * into v_payment
  from public.event_payments
  where id = p_payment_id and deleted_at is null
  for update;
  if not found then raise exception 'EVENT_PAYMENT_NOT_FOUND'; end if;
  if not (select private.can_access_event_id(v_payment.event_id, 'events.payments.manage')) then
    raise exception 'EVENT_ACCESS_DENIED';
  end if;
  if v_status not in ('CONFIRMED','FAILED','CANCELLED','REFUNDED') then
    raise exception 'EVENT_PAYMENT_STATUS_INVALID';
  end if;
  if v_status in ('FAILED','CANCELLED','REFUNDED') and coalesce(btrim(p_reason), '') = '' then
    raise exception 'EVENT_PAYMENT_REASON_REQUIRED';
  end if;
  if v_status = 'REFUNDED' and v_payment.payment_status <> 'CONFIRMED' then
    raise exception 'EVENT_PAYMENT_REFUND_INVALID';
  end if;

  update public.event_payments set
    payment_status = v_status,
    updated_by = v_actor,
    paid_at = case when v_status = 'CONFIRMED' then coalesce(paid_at, now()) else paid_at end,
    confirmed_by = case when v_status = 'CONFIRMED' then v_actor else confirmed_by end,
    failed_at = case when v_status = 'FAILED' then now() else failed_at end,
    failed_by = case when v_status = 'FAILED' then v_actor else failed_by end,
    failure_reason = case when v_status = 'FAILED' then btrim(p_reason) else failure_reason end,
    cancelled_at = case when v_status = 'CANCELLED' then now() else cancelled_at end,
    cancelled_by = case when v_status = 'CANCELLED' then v_actor else cancelled_by end,
    cancel_reason = case when v_status = 'CANCELLED' then btrim(p_reason) else cancel_reason end,
    refunded_at = case when v_status = 'REFUNDED' then now() else refunded_at end,
    refunded_by = case when v_status = 'REFUNDED' then v_actor else refunded_by end,
    refund_reason = case when v_status = 'REFUNDED' then btrim(p_reason) else refund_reason end
  where id = p_payment_id
  returning * into v_payment;

  if v_payment.event_registration_id is not null then
    perform private.recalculate_event_registration(v_payment.event_registration_id);
  end if;
  return v_payment;
end;
$$;

revoke all on function public.change_event_payment_status(uuid, text, text) from public, anon;
grant execute on function public.change_event_payment_status(uuid, text, text) to authenticated;

create index if not exists event_payments_failed_by_idx on public.event_payments(failed_by) where failed_by is not null;
