begin;

create or replace function public.delete_event_payment(
  p_event_id uuid,
  p_payment_id uuid
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_payment public.event_payments%rowtype;
  v_actor uuid := (select auth.uid());
begin
  if v_actor is null then raise exception 'EVENT_ACCESS_DENIED'; end if;

  select * into v_payment
  from public.event_payments
  where id = p_payment_id
    and event_id = p_event_id
    and deleted_at is null
  for update;

  if not found then raise exception 'EVENT_PAYMENT_NOT_FOUND'; end if;
  if not (select private.can_access_event_id(p_event_id, 'events.payments.manage')) then
    raise exception 'EVENT_ACCESS_DENIED';
  end if;

  update public.event_payments set
    deleted_at = now(),
    deleted_by = v_actor,
    updated_by = v_actor,
    cancelled_at = coalesce(cancelled_at, now()),
    cancelled_by = coalesce(cancelled_by, v_actor),
    cancel_reason = coalesce(nullif(cancel_reason, ''), 'Pagamento excluído pelo usuário')
  where id = p_payment_id;

  if v_payment.event_registration_id is not null then
    perform private.recalculate_event_registration(v_payment.event_registration_id);
  end if;

  perform public.log_audit(
    v_payment.church_id, 'EVENTS', 'DELETE_PAYMENT', 'EVENT_PAYMENT',
    v_payment.id, v_payment.payment_number, 'Pagamento excluído do histórico da inscrição', null,
    jsonb_build_object('event_id', p_event_id, 'registration_id', v_payment.event_registration_id, 'amount', v_payment.amount),
    '{}'::jsonb, 'WARNING'
  );

  return v_payment.receipt_storage_path;
end;
$$;

revoke all on function public.delete_event_payment(uuid, uuid) from public, anon;
grant execute on function public.delete_event_payment(uuid, uuid) to authenticated;

commit;
