-- Use the existing financial cashbox column name. Original migration remains immutable.
create or replace function public.prepare_finance_bank_import(p_church_id uuid,p_unit uuid,p_cashbox uuid,p_file_hash text,p_file_name text,p_data jsonb) returns jsonb
 language plpgsql security definer set search_path='' as $$
declare b uuid; r jsonb; d date; cents bigint; problem text;
begin
 if not private.bank_import_access(p_church_id,p_unit) then raise exception 'FORBIDDEN' using errcode='42501'; end if;
 if p_file_hash is null or p_file_hash !~ '^[a-f0-9]{64}$' or coalesce(length(p_file_name),0) not between 1 and 180
  or p_data->>'parserVersion' is distinct from 'SICOOB_XLSX_V1' or jsonb_typeof(p_data->'rows') is distinct from 'array'
  or jsonb_array_length(p_data->'rows') not between 1 and 5000 or octet_length(p_data::text)>24000000
  or jsonb_typeof(p_data->'balances') is distinct from 'array' or jsonb_array_length(p_data->'balances')>5000
  or coalesce(p_data->>'reconciliation','') not in ('MATCHED','MISMATCH','UNAVAILABLE') then raise exception 'INVALID_INPUT' using errcode='22023'; end if;
 perform pg_advisory_xact_lock(hashtextextended(p_church_id::text,0));
 if not exists(select 1 from public.financial_cashboxes where church_id=p_church_id and congregation_id=p_unit and id=p_cashbox and cashbox_type='BANK_ACCOUNT' and status='ACTIVE' and deleted_at is null) then raise exception 'INACTIVE_REFERENCE'; end if;
 select id into b from public.finance_bank_import_batches where church_id=p_church_id and cashbox_id=p_cashbox and file_hash=p_file_hash and deleted_at is null;
 if b is not null then return jsonb_build_object('id',b,'replayed',true); end if;
 insert into public.finance_bank_import_batches(church_id,congregation_id,cashbox_id,file_hash,file_name,parser_version,balances,reconciliation,created_by)
 values(p_church_id,p_unit,p_cashbox,p_file_hash,p_file_name,p_data->>'parserVersion',p_data->'balances',p_data->>'reconciliation',auth.uid()) returning id into b;
 for r in select value from jsonb_array_elements(p_data->'rows') loop
  problem:=nullif(r->>'issue',''); d:=(r->>'date')::date;
  if r->>'amountCents' is not null and (r->>'amountCents') !~ '^-?[0-9]+$' then raise exception 'INVALID_INPUT' using errcode='22023'; end if;
  cents:=(r->>'amountCents')::bigint;
  if length(problem)>1000 then raise exception 'INVALID_INPUT' using errcode='22023'; end if;
  insert into public.finance_bank_import_items(church_id,congregation_id,cashbox_id,batch_id,row_number,transaction_date,amount_cents,source_date,source_value,document,history,complement,issue,fingerprint,created_by)
  values(p_church_id,p_unit,p_cashbox,b,(r->>'rowNumber')::integer,d,cents,coalesce(r->>'sourceDate',''),coalesce(r->>'sourceValue',''),coalesce(r->>'document',''),coalesce(r->>'history',''),coalesce(r->>'complement',''),problem,
   private.bank_import_fingerprint(d,cents,r->>'document',r->>'history',r->>'complement'),auth.uid());
 end loop;
 return jsonb_build_object('id',b,'replayed',false);
end $$;

create or replace function public.finance_bank_import_item(p_church_id uuid,p_unit uuid,p_item uuid,p_revision integer,p_operation_key uuid,p_action text,p_payload jsonb) returns jsonb
 language plpgsql security definer set search_path='' as $$
declare i public.finance_bank_import_items; b public.finance_bank_import_batches; target public.finance_bank_import_items;
 op public.finance_bank_import_operations; payload_hash text; reason text:=trim(p_payload->>'reason'); command jsonb; command_result jsonb; response jsonb;
 ids uuid[]; transfer uuid; attendance uuid; total bigint; n integer; target_kind text; target_id uuid; actor text; event_reason text;
begin
 if not private.bank_import_access(p_church_id,p_unit) then raise exception 'FORBIDDEN' using errcode='42501'; end if;
 if p_operation_key is null or p_revision is null or p_revision<1 or p_action is null or p_action not in ('SAVE_DRAFT','POST','LINK','DUPLICATE','IGNORE','RESTORE','REOPEN','UNLINK')
  or jsonb_typeof(p_payload) is distinct from 'object' or octet_length(p_payload::text)>100000 then raise exception 'INVALID_INPUT' using errcode='22023'; end if;
 perform pg_advisory_xact_lock(hashtextextended(p_church_id::text,0));
 select * into i from public.finance_bank_import_items where church_id=p_church_id and congregation_id=p_unit and id=p_item and deleted_at is null for update;
 if i.id is null then raise exception 'FORBIDDEN' using errcode='42501'; end if;
 payload_hash:=encode(extensions.digest(jsonb_build_array(p_unit,p_item,p_revision,p_action,p_payload)::text,'sha256'),'hex');
 select * into op from public.finance_bank_import_operations where church_id=p_church_id and created_by=auth.uid() and operation_key=p_operation_key;
 if op.id is not null then
  if op.payload_hash<>payload_hash then raise exception 'IDEMPOTENCY_CONFLICT'; end if;
  return op.result||jsonb_build_object('replayed',true);
 end if;
 if i.revision<>p_revision then raise exception 'BANK_IMPORT_CONFLICT'; end if;
 select * into b from public.finance_bank_import_batches where church_id=p_church_id and id=i.batch_id and deleted_at is null;
 if b.id is null then raise exception 'FORBIDDEN' using errcode='42501'; end if;
 if p_action in ('IGNORE','RESTORE','REOPEN','UNLINK','DUPLICATE') and coalesce(length(reason),0) not between 5 and 1000 then raise exception 'INVALID_INPUT' using errcode='22023'; end if;
 if (p_action in ('SAVE_DRAFT','POST','LINK','DUPLICATE','IGNORE') and i.status<>'PENDING') or (p_action='RESTORE' and i.status<>'IGNORED')
  or (p_action='REOPEN' and (i.status<>'POSTED' or not (private.bank_import_health(p_church_id,i.id)->>'cancelled')::boolean))
  or (p_action='UNLINK' and i.status not in ('LINKED','DUPLICATE')) then raise exception 'BANK_IMPORT_STATE'; end if;
 if p_action in ('POST','LINK','DUPLICATE') and (i.issue is not null or i.transaction_date is null or i.amount_cents is null) then raise exception 'BANK_IMPORT_INVALID_ROW'; end if;
 if p_action in ('POST','LINK') then
  if not exists(select 1 from public.financial_cashboxes where church_id=p_church_id and congregation_id=p_unit and id=i.cashbox_id and cashbox_type='BANK_ACCOUNT' and status='ACTIVE' and deleted_at is null and opening_date<=i.transaction_date) then raise exception 'INACTIVE_REFERENCE'; end if;
  if exists(select 1 from public.finance_bank_import_items where church_id=p_church_id and cashbox_id=i.cashbox_id and fingerprint=i.fingerprint and id<>i.id and batch_id<>i.batch_id and deleted_at is null)
   and coalesce(length(trim(p_payload->>'duplicateReason')),0) not between 5 and 1000 then raise exception 'BANK_IMPORT_DUPLICATE_REVIEW'; end if;
  if b.reconciliation='MISMATCH' and b.reconciliation_reason is null then
   if coalesce(length(trim(p_payload->>'reconciliationReason')),0) not between 5 and 1000 then raise exception 'BANK_IMPORT_RECONCILIATION'; end if;
   update public.finance_bank_import_batches set reconciliation_reason=trim(p_payload->>'reconciliationReason'),updated_at=now() where church_id=p_church_id and id=b.id;
  end if;
 end if;
 if p_action='SAVE_DRAFT' then
  if jsonb_typeof(p_payload->'state') is distinct from 'object' or jsonb_typeof(p_payload->'extra') is distinct from 'array' or jsonb_array_length(p_payload->'extra')>49 then raise exception 'INVALID_INPUT'; end if;
  update public.finance_bank_import_items set draft=p_payload where church_id=p_church_id and id=i.id;
 elsif p_action='POST' then
  command:=p_payload->'command';
  if command->>'kind' is null or command->>'kind' not in ('RECORD','TRANSFER') then raise exception 'INVALID_INPUT'; end if;
  if command->>'kind'='RECORD' then
   select sum((v->>'amountCents')::numeric),count(*) into total,n from jsonb_array_elements(command->'items') v;
   if (command->>'date')::date is distinct from i.transaction_date or (command->>'cashboxId')::uuid is distinct from i.cashbox_id
    or command->>'direction' is distinct from (case when i.amount_cents>0 then 'INCOME' else 'EXPENSE' end)
    or total is distinct from abs(i.amount_cents) or n not between 1 and 50 or (i.amount_cents<0 and (n<>1 or command->>'mode'<>'SINGLE')) then raise exception 'BANK_IMPORT_SOURCE_MISMATCH'; end if;
   command:=command||jsonb_build_object('date',i.transaction_date,'cashboxId',i.cashbox_id,'direction',case when i.amount_cents>0 then 'INCOME' else 'EXPENSE' end);
  else
   if not private.can_access_finance_unit(p_church_id,p_unit,'finance.transfers.manage') then raise exception 'FORBIDDEN' using errcode='42501'; end if;
   if (command->>'date')::date is distinct from i.transaction_date or (command->>'amountCents')::numeric is distinct from abs(i.amount_cents)
    or (command->>case when i.amount_cents>0 then 'targetCashboxId' else 'sourceCashboxId' end)::uuid is distinct from i.cashbox_id then raise exception 'BANK_IMPORT_SOURCE_MISMATCH'; end if;
   command:=command||jsonb_build_object('date',i.transaction_date,'amountCents',abs(i.amount_cents),case when i.amount_cents>0 then 'targetCashboxId' else 'sourceCashboxId' end,i.cashbox_id);
  end if;
  command:=command||jsonb_build_object('congregationId',p_unit,'operationKey',gen_random_uuid());
  command_result:=public.execute_finance_command(p_church_id,command);
  select array_agg(value::uuid) into ids from jsonb_array_elements_text(command_result->'transactionIds');
  transfer:=(command_result->>'transferId')::uuid;
  update public.financial_transactions set source_type='IMPORT' where church_id=p_church_id and id=any(ids);
  update public.financial_transaction_revisions set new_values=jsonb_set(new_values,'{source_type}','"IMPORT"') where church_id=p_church_id and transaction_id=any(ids) and revision=1;
 elsif p_action='LINK' then
  target_kind:=p_payload->>'targetKind'; target_id:=(p_payload->>'targetId')::uuid;
  if target_kind is null or target_kind not in ('TRANSACTION','ATTENDANCE','TRANSFER') or target_id is null then raise exception 'INVALID_INPUT'; end if;
  if target_kind='TRANSFER' then
   if not private.can_access_finance_unit(p_church_id,p_unit,'finance.transfers.manage') then raise exception 'FORBIDDEN' using errcode='42501'; end if;
   select id into transfer from public.financial_transfers where church_id=p_church_id and congregation_id=p_unit and id=target_id and deleted_at is null and status='CONFIRMED'
    and transaction_date=i.transaction_date and amount*100=abs(i.amount_cents) and case when i.amount_cents>0 then target_cashbox_id=i.cashbox_id else source_cashbox_id=i.cashbox_id end;
   if transfer is null then raise exception 'BANK_IMPORT_TARGET_MISMATCH'; end if;
  elsif target_kind='TRANSACTION' then
   select array[id] into ids from public.financial_transactions where church_id=p_church_id and congregation_id=p_unit and id=target_id and deleted_at is null and status='CONFIRMED' and attendance_id is null
    and transaction_date=i.transaction_date and cashbox_id=i.cashbox_id and amount*100=abs(i.amount_cents) and (transaction_type='INCOME')=(i.amount_cents>0);
   if ids is null then raise exception 'BANK_IMPORT_TARGET_MISMATCH'; end if;
  else
   attendance:=target_id;
   if i.amount_cents<0 or not exists(select 1 from public.financial_attendances where church_id=p_church_id and congregation_id=p_unit and id=attendance and deleted_at is null and status='CONFIRMED') then raise exception 'BANK_IMPORT_TARGET_MISMATCH'; end if;
   select array_agg(id),sum(amount*100),count(*) filter(where transaction_date<>i.transaction_date or cashbox_id<>i.cashbox_id or transaction_type<>'INCOME')
    into ids,total,n from public.financial_transactions where church_id=p_church_id and congregation_id=p_unit and attendance_id=attendance and deleted_at is null and status='CONFIRMED';
   if ids is null or total is distinct from i.amount_cents or n<>0 then raise exception 'BANK_IMPORT_TARGET_MISMATCH'; end if;
  end if;
  command_result:=jsonb_build_object('transactionIds',coalesce(to_jsonb(ids),'[]'::jsonb),'attendanceId',attendance,'transferId',transfer,'receiptId',null);
 elsif p_action='DUPLICATE' then
  select * into target from public.finance_bank_import_items where church_id=p_church_id and congregation_id=p_unit and cashbox_id=i.cashbox_id and id=(p_payload->>'targetId')::uuid and deleted_at is null;
  if target.id is null or target.id=i.id or target.status not in ('POSTED','LINKED') or target.transaction_date is distinct from i.transaction_date or target.amount_cents is distinct from i.amount_cents
   or (private.bank_import_health(p_church_id,target.id)->>'stale')::boolean then raise exception 'BANK_IMPORT_TARGET_MISMATCH'; end if;
  update public.finance_bank_import_items set status='DUPLICATE',canonical_id=target.id,result=null,draft='{}',reason=reason where church_id=p_church_id and id=i.id;
 elsif p_action='IGNORE' then
  update public.finance_bank_import_items set status='IGNORED',reason=reason where church_id=p_church_id and id=i.id;
 elsif p_action in ('RESTORE','REOPEN','UNLINK') then
  update public.finance_bank_import_links set deleted_at=now() where church_id=p_church_id and item_id=i.id and deleted_at is null;
  update public.finance_bank_import_items set status='PENDING',canonical_id=null,result=null,reason=reason where church_id=p_church_id and id=i.id;
 end if;
 if p_action in ('POST','LINK') then
  if exists(select 1 from public.finance_bank_import_links where church_id=p_church_id and deleted_at is null and (transaction_id=any(ids) or (transfer_id=transfer and cashbox_id=i.cashbox_id))) then raise exception 'BANK_IMPORT_TARGET_USED'; end if;
  insert into public.finance_bank_import_links(church_id,congregation_id,cashbox_id,item_id,transaction_id,finance_revision)
   select p_church_id,p_unit,i.cashbox_id,i.id,id,revision from public.financial_transactions where church_id=p_church_id and id=any(ids);
  insert into public.finance_bank_import_links(church_id,congregation_id,cashbox_id,item_id,transfer_id,finance_revision)
   select p_church_id,p_unit,i.cashbox_id,i.id,id,revision from public.financial_transfers where church_id=p_church_id and id=transfer;
  update public.finance_bank_import_items set status=case when p_action='POST' then 'POSTED' else 'LINKED' end,result=command_result,draft='{}' where church_id=p_church_id and id=i.id;
 end if;
 update public.finance_bank_import_items set revision=revision+1,updated_at=now() where church_id=p_church_id and id=i.id;
 select coalesce(display_name,full_name,'Usuário') into actor from public.profiles where id=auth.uid();
 event_reason:=nullif(concat_ws(E'\n',reason,nullif(p_payload->>'duplicateReason',''),nullif(p_payload->>'reconciliationReason','')),'');
 insert into public.finance_bank_import_events(church_id,congregation_id,item_id,action,revision,reason,created_by,actor_name)
 values(p_church_id,p_unit,i.id,p_action,i.revision+1,event_reason,auth.uid(),coalesce(actor,'Usuário'));
 response:=private.bank_import_item_dto(p_church_id,i.id)||jsonb_build_object('replayed',false);
 insert into public.finance_bank_import_operations(church_id,congregation_id,item_id,operation_key,payload_hash,result,created_by)
 values(p_church_id,p_unit,i.id,p_operation_key,payload_hash,response,auth.uid());
 return response;
end $$;
