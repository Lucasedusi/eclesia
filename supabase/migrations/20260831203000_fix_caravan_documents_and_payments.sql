-- Corrige documentos privados e pagamentos opcionais das inscrições por caravana.

alter table public.event_documents
  drop constraint if exists event_documents_type_check;
alter table public.event_documents
  add constraint event_documents_type_check check (document_type in (
    'BANNER','PAYMENT_RECEIPT','REGISTRATION_RECEIPT','GROUP_LIST',
    'CARAVAN_PARTICIPANT_LIST','AUTHORIZATION','SPREADSHEET','CONTRACT',
    'REPORT','ADMINISTRATIVE','OTHER'
  ));

-- Uma lista de caravana pertence ao domínio de caravanas; os demais documentos
-- continuam protegidos pelas permissões próprias do acervo de documentos.
drop policy if exists event_documents_select_scoped on public.event_documents;
create policy event_documents_select_scoped on public.event_documents for select to authenticated
using (
  deleted_at is null and (
    (document_type in ('GROUP_LIST','CARAVAN_PARTICIPANT_LIST')
      and (select private.can_access_event_id(event_id,'events.groups.view')))
    or
    (document_type not in ('GROUP_LIST','CARAVAN_PARTICIPANT_LIST')
      and (select private.can_access_event_id(event_id,'events.documents.view')))
  )
);

drop policy if exists event_documents_insert_scoped on public.event_documents;
create policy event_documents_insert_scoped on public.event_documents for insert to authenticated
with check (
  (document_type in ('GROUP_LIST','CARAVAN_PARTICIPANT_LIST')
    and (select private.can_access_event_id(event_id,'events.groups.manage')))
  or
  (document_type not in ('GROUP_LIST','CARAVAN_PARTICIPANT_LIST')
    and (select private.can_access_event_id(event_id,'events.documents.manage')))
);

drop policy if exists event_documents_update_scoped on public.event_documents;
create policy event_documents_update_scoped on public.event_documents for update to authenticated
using (
  (document_type in ('GROUP_LIST','CARAVAN_PARTICIPANT_LIST')
    and (select private.can_access_event_id(event_id,'events.groups.manage')))
  or
  (document_type not in ('GROUP_LIST','CARAVAN_PARTICIPANT_LIST')
    and (select private.can_access_event_id(event_id,'events.documents.manage')))
)
with check (
  (document_type in ('GROUP_LIST','CARAVAN_PARTICIPANT_LIST')
    and (select private.can_access_event_id(event_id,'events.groups.manage')))
  or
  (document_type not in ('GROUP_LIST','CARAVAN_PARTICIPANT_LIST')
    and (select private.can_access_event_id(event_id,'events.documents.manage')))
);

drop policy if exists event_documents_storage_select on storage.objects;
create policy event_documents_storage_select on storage.objects for select to authenticated
using (
  bucket_id='event-documents' and (storage.foldername(name))[2]='events' and (
    ((storage.foldername(name))[4]='documents' and (select private.can_access_event_id(((storage.foldername(name))[3])::uuid,'events.documents.view')))
    or ((storage.foldername(name))[4]='payment-receipts' and (select private.can_access_event_id(((storage.foldername(name))[3])::uuid,'events.payments.view')))
    or ((storage.foldername(name))[4]='expenses' and (select private.can_access_event_id(((storage.foldername(name))[3])::uuid,'events.expenses.view')))
    or ((storage.foldername(name))[4] in ('caravans','public-caravans') and (select private.can_access_event_id(((storage.foldername(name))[3])::uuid,'events.groups.view')))
  )
);

drop policy if exists event_documents_storage_insert on storage.objects;
create policy event_documents_storage_insert on storage.objects for insert to authenticated
with check (
  bucket_id='event-documents' and (storage.foldername(name))[2]='events' and (
    ((storage.foldername(name))[4]='documents' and (select private.can_access_event_id(((storage.foldername(name))[3])::uuid,'events.documents.manage')))
    or ((storage.foldername(name))[4]='payment-receipts' and (select private.can_access_event_id(((storage.foldername(name))[3])::uuid,'events.payments.manage')))
    or ((storage.foldername(name))[4]='expenses' and (select private.can_access_event_id(((storage.foldername(name))[3])::uuid,'events.expenses.manage')))
    or ((storage.foldername(name))[4] in ('caravans','public-caravans') and (select private.can_access_event_id(((storage.foldername(name))[3])::uuid,'events.groups.manage')))
  )
);

drop policy if exists event_documents_storage_update on storage.objects;
create policy event_documents_storage_update on storage.objects for update to authenticated
using (
  bucket_id='event-documents' and (storage.foldername(name))[2]='events' and (
    ((storage.foldername(name))[4]='documents' and (select private.can_access_event_id(((storage.foldername(name))[3])::uuid,'events.documents.manage')))
    or ((storage.foldername(name))[4]='payment-receipts' and (select private.can_access_event_id(((storage.foldername(name))[3])::uuid,'events.payments.manage')))
    or ((storage.foldername(name))[4]='expenses' and (select private.can_access_event_id(((storage.foldername(name))[3])::uuid,'events.expenses.manage')))
    or ((storage.foldername(name))[4] in ('caravans','public-caravans') and (select private.can_access_event_id(((storage.foldername(name))[3])::uuid,'events.groups.manage')))
  )
)
with check (
  bucket_id='event-documents' and (storage.foldername(name))[2]='events' and (
    ((storage.foldername(name))[4]='documents' and (select private.can_access_event_id(((storage.foldername(name))[3])::uuid,'events.documents.manage')))
    or ((storage.foldername(name))[4]='payment-receipts' and (select private.can_access_event_id(((storage.foldername(name))[3])::uuid,'events.payments.manage')))
    or ((storage.foldername(name))[4]='expenses' and (select private.can_access_event_id(((storage.foldername(name))[3])::uuid,'events.expenses.manage')))
    or ((storage.foldername(name))[4] in ('caravans','public-caravans') and (select private.can_access_event_id(((storage.foldername(name))[3])::uuid,'events.groups.manage')))
  )
);

drop policy if exists event_documents_storage_delete on storage.objects;
create policy event_documents_storage_delete on storage.objects for delete to authenticated
using (
  bucket_id='event-documents' and (storage.foldername(name))[2]='events' and (
    ((storage.foldername(name))[4]='documents' and (select private.can_access_event_id(((storage.foldername(name))[3])::uuid,'events.documents.manage')))
    or ((storage.foldername(name))[4]='payment-receipts' and (select private.can_access_event_id(((storage.foldername(name))[3])::uuid,'events.payments.manage')))
    or ((storage.foldername(name))[4]='expenses' and (select private.can_access_event_id(((storage.foldername(name))[3])::uuid,'events.expenses.manage')))
    or ((storage.foldername(name))[4] in ('caravans','public-caravans') and (select private.can_access_event_id(((storage.foldername(name))[3])::uuid,'events.groups.manage')))
  )
);

create or replace function public.record_event_caravan_payment(p_event_id uuid,p_group_id uuid,p_payload jsonb,p_idempotency_key text default null)
returns public.event_payments language plpgsql security definer set search_path='' as $$
declare
  v_group public.event_groups%rowtype;v_payment public.event_payments%rowtype;v_event public.events%rowtype;
  v_amount numeric(12,2);v_number integer;v_actor uuid:=(select auth.uid());
  v_service boolean:=(select private.is_service_request());v_status text;v_receipt_path text;
begin
  select * into v_event from public.events where id=p_event_id and deleted_at is null;
  if v_service then null; elsif not (select private.can_access_event_id(p_event_id,'events.payments.manage')) then raise exception 'EVENT_ACCESS_DENIED'; end if;
  select * into v_group from public.event_groups where id=p_group_id and event_id=p_event_id and status='CONFIRMED' and deleted_at is null for update;
  if not found then raise exception 'EVENT_CARAVAN_NOT_FOUND'; end if;
  if p_idempotency_key is not null then
    select * into v_payment from public.event_payments where event_id=p_event_id and idempotency_key=p_idempotency_key;
    if found then return v_payment;end if;
  end if;
  v_amount:=(p_payload->>'amount')::numeric;
  v_status:=case when v_service then 'PENDING' else coalesce(nullif(p_payload->>'paymentStatus',''),'CONFIRMED') end;
  v_receipt_path:=nullif(btrim(p_payload->>'receiptPath'),'');
  if v_amount<=0 or v_amount>greatest(v_group.total_amount-v_group.paid_amount,0) then raise exception 'EVENT_PAYMENT_EXCEEDS_BALANCE'; end if;
  if v_status not in ('PENDING','CONFIRMED') then raise exception 'EVENT_PAYMENT_STATUS_INVALID'; end if;
  select count(*)+1 into v_number from public.event_payments where event_id=p_event_id;
  insert into public.event_payments(
    church_id,event_id,event_group_id,payment_number,payment_method,payment_status,amount,paid_at,
    installment_number,installments_total,payer_name,idempotency_key,confirmed_by,notes,metadata,
    receipt_storage_path,receipt_file_name,receipt_mime_type,receipt_file_size,created_by,updated_by
  ) values(
    v_event.church_id,p_event_id,p_group_id,upper(left(v_event.public_code,6))||'-P'||lpad(v_number::text,6,'0'),
    coalesce(nullif(p_payload->>'paymentMethod',''),'PIX'),v_status,v_amount,
    case when v_status='CONFIRMED' then coalesce(nullif(p_payload->>'paidAt','')::timestamptz,now()) end,
    1,1,coalesce(nullif(btrim(p_payload->>'payerName'),''),v_group.responsible_name),p_idempotency_key,
    case when v_status='CONFIRMED' then v_actor end,nullif(btrim(p_payload->>'notes'),''),coalesce(p_payload->'metadata','{}'::jsonb),
    v_receipt_path,
    case when v_receipt_path is null then null else nullif(btrim(p_payload->>'receiptFileName'),'') end,
    case when v_receipt_path is null then null else nullif(p_payload->>'receiptMimeType','') end,
    case when v_receipt_path is null then null else nullif(nullif(p_payload->>'receiptFileSize',''),'0')::bigint end,
    v_actor,v_actor
  ) returning * into v_payment;
  perform private.recalculate_event_group(p_group_id);
  perform public.log_audit(v_event.church_id,'EVENTS',case when v_status='PENDING' then 'SUBMIT_CARAVAN_PAYMENT' else 'RECORD_CARAVAN_PAYMENT' end,'EVENT_PAYMENT',v_payment.id,v_payment.payment_number,'Pagamento de caravana registrado',null,jsonb_build_object('group_id',p_group_id,'amount',v_amount,'status',v_status),'{}'::jsonb,'INFO');
  return v_payment;
end;$$;

revoke all on function public.record_event_caravan_payment(uuid,uuid,jsonb,text) from public,anon;
grant execute on function public.record_event_caravan_payment(uuid,uuid,jsonb,text) to authenticated,service_role;
