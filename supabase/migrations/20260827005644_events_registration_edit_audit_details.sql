-- Complementa a auditoria da edição com o retrato dos itens, respostas
-- personalizadas e metadados funcionais antes e depois da operação atômica.

create or replace function public.update_event_registration(
  p_event_id uuid,
  p_registration_id uuid,
  p_expected_updated_at timestamptz,
  p_payload jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_before jsonb;
  v_after jsonb;
  v_result jsonb;
  v_event public.events%rowtype;
  v_registration public.event_registrations%rowtype;
begin
  perform private.assert_event_custom_fields_payload(p_event_id, coalesce(p_payload->'customFields','{}'::jsonb));

  select * into v_event from public.events where id=p_event_id and deleted_at is null;
  select * into v_registration from public.event_registrations
    where id=p_registration_id and event_id=p_event_id and deleted_at is null;
  v_before := jsonb_build_object(
    'registration',to_jsonb(v_registration)-array['qr_token_hash'],
    'items',coalesce((select jsonb_agg(jsonb_build_object(
      'itemId',item.event_item_id,'name',item.item_name,'quantity',item.quantity,
      'unitPrice',item.unit_price,'totalPrice',item.total_price
    ) order by item.item_name) from public.event_registration_items item
      where item.event_registration_id=p_registration_id and item.deleted_at is null),'[]'::jsonb),
    'customFields',coalesce((select jsonb_object_agg(value.field_key_snapshot,value.value)
      from public.event_registration_field_values value
      where value.event_registration_id=p_registration_id and value.deleted_at is null),'{}'::jsonb)
  );

  v_result := public.update_event_registration_unvalidated(
    p_event_id,p_registration_id,p_expected_updated_at,p_payload
  );

  select * into v_registration from public.event_registrations where id=p_registration_id;
  v_after := jsonb_build_object(
    'registration',to_jsonb(v_registration)-array['qr_token_hash'],
    'items',coalesce((select jsonb_agg(jsonb_build_object(
      'itemId',item.event_item_id,'name',item.item_name,'quantity',item.quantity,
      'unitPrice',item.unit_price,'totalPrice',item.total_price
    ) order by item.item_name) from public.event_registration_items item
      where item.event_registration_id=p_registration_id and item.deleted_at is null),'[]'::jsonb),
    'customFields',coalesce((select jsonb_object_agg(value.field_key_snapshot,value.value)
      from public.event_registration_field_values value
      where value.event_registration_id=p_registration_id and value.deleted_at is null),'{}'::jsonb)
  );

  perform public.log_audit(
    v_event.church_id,'EVENTS','UPDATE_REGISTRATION_DETAILS','EVENT_REGISTRATION',
    p_registration_id,v_registration.registration_number,
    'Dados, respostas e itens da inscrição atualizados',v_before,v_after,
    jsonb_build_object('event_id',p_event_id,'financialImpact',jsonb_build_object(
      'previousTotal',v_before#>'{registration,total_amount}',
      'newTotal',v_after#>'{registration,total_amount}',
      'paidAmount',v_after#>'{registration,paid_amount}'
    )),'INFO'
  );
  return v_result;
end;
$$;

revoke all on function public.update_event_registration(uuid,uuid,timestamptz,jsonb) from public, anon;
grant execute on function public.update_event_registration(uuid,uuid,timestamptz,jsonb) to authenticated;
