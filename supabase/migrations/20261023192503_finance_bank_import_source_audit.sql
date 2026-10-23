-- Set the trusted source before immutable financial audit rows are inserted.
create function private.finance_write_item_with_source(p_church uuid,p_unit uuid,p_operation uuid,p jsonb,p_item jsonb,p_attendance uuid,p_existing uuid default null,p_reason text default null,p_source_type text default 'MANUAL') returns uuid
language plpgsql security definer set search_path='' as $$
declare ident uuid:=coalesce(p_existing,gen_random_uuid()); old_tx public.financial_transactions; new_tx public.financial_transactions; d date:=(p->>'date')::date;
begin
 if p_existing is not null then select * into old_tx from public.financial_transactions where church_id=p_church and id=p_existing for update; end if;
 insert into public.financial_transactions(id,church_id,congregation_id,member_id,department_id,cashbox_id,payment_method_id,category_id,transaction_type,person_name,is_unregistered_person,description,amount,transaction_date,reference_month,reference_year,document_number,notes,created_by,confirmed_by,confirmed_at,attendance_id,tithe_classification_id,classification_name,beneficiary_name,contributor_kind,category_name,department_name,generate_receipt,payment_reference,source_type)
 values(ident,p_church,p_unit,(p->>'memberId')::uuid,(p_item->>'departmentId')::uuid,(p->>'cashboxId')::uuid,(p->>'paymentMethodId')::uuid,(p_item->>'categoryId')::uuid,p->>'direction',p->>'personName',p->>'contributorKind'='UNREGISTERED',p_item->>'description',private.finance_amount(p_item->'amountCents'),d,extract(month from d),extract(year from d),p_item->>'documentNumber',p_item->>'notes',auth.uid(),auth.uid(),now(),p_attendance,(p_item->>'titheClassificationId')::uuid,p_item->>'classificationName',p->>'beneficiaryName',p->>'contributorKind',p_item->>'categoryName',p_item->>'departmentName',coalesce((p->>'issueReceipt')::boolean,false),p->>'paymentReference',p_source_type)
 on conflict(id) do update set member_id=excluded.member_id,department_id=excluded.department_id,cashbox_id=excluded.cashbox_id,payment_method_id=excluded.payment_method_id,category_id=excluded.category_id,transaction_type=excluded.transaction_type,person_name=excluded.person_name,is_unregistered_person=excluded.is_unregistered_person,description=excluded.description,amount=excluded.amount,transaction_date=excluded.transaction_date,reference_month=excluded.reference_month,reference_year=excluded.reference_year,document_number=excluded.document_number,notes=excluded.notes,tithe_classification_id=excluded.tithe_classification_id,classification_name=excluded.classification_name,beneficiary_name=excluded.beneficiary_name,contributor_kind=excluded.contributor_kind,category_name=excluded.category_name,department_name=excluded.department_name,payment_reference=excluded.payment_reference,revision=public.financial_transactions.revision+1,updated_at=now()
 returning * into new_tx;
 insert into public.financial_ledger_entries(church_id,congregation_id,cashbox_id,transaction_id,operation_id,entry_kind,amount,financial_date,source_revision,created_by)
 values(p_church,p_unit,new_tx.cashbox_id,ident,p_operation,'TRANSACTION',new_tx.amount*case when new_tx.transaction_type='INCOME' then 1 else -1 end,d,new_tx.revision,auth.uid());
 insert into public.financial_transaction_revisions(church_id,congregation_id,transaction_id,revision,reason,previous_values,new_values,created_by)
 values(p_church,p_unit,ident,new_tx.revision,coalesce(p_reason,'Lançamento registrado'),case when p_existing is null then null else to_jsonb(old_tx) end,to_jsonb(new_tx),auth.uid());
 return ident;
end $$;

create function private.execute_finance_command_core(p_church_id uuid,p_payload jsonb,p_source_type text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare
 unit uuid:=(p_payload->>'congregationId')::uuid; kind text:=p_payload->>'kind'; key uuid:=(p_payload->>'operationKey')::uuid;
 permission text; op public.financial_operations; payload_hash text; v_result jsonb;
 entry jsonb; item jsonb; ident uuid; attendance uuid; transfer uuid; receipt uuid; ids uuid[]:='{}';rev integer:=1;
 old_tx public.financial_transactions; old_transfer public.financial_transfers; new_transfer public.financial_transfers; old_attendance public.financial_attendances;
 expected integer:=(p_payload->>'expectedRevision')::integer; reason text:=trim(p_payload->>'reason'); d date; signed_amount numeric; box uuid;
begin
 if p_source_type not in ('MANUAL','IMPORT') then raise exception 'INVALID_INPUT'; end if;
 permission:=case kind when 'RECORD' then 'finance.transactions.create' when 'CORRECT_TRANSACTION' then 'finance.transactions.update'
 when 'CANCEL_TRANSACTION' then 'finance.transactions.cancel' when 'CANCEL_ATTENDANCE' then 'finance.transactions.cancel'
 when 'TRANSFER' then 'finance.transfers.manage' when 'CORRECT_TRANSFER' then 'finance.transfers.manage' when 'CANCEL_TRANSFER' then 'finance.transfers.manage'
 when 'ADJUST_BALANCE' then 'finance.settings.manage' end;
 if permission is null or key is null then raise exception 'INVALID_INPUT' using errcode='22023'; end if;
 if not private.can_access_finance_unit(p_church_id,unit,permission) then raise exception 'FORBIDDEN' using errcode='42501'; end if;
 perform pg_advisory_xact_lock(hashtextextended(p_church_id::text,0));
 payload_hash:=encode(extensions.digest(p_payload::text,'sha256'),'hex');
 select * into op from public.financial_operations where church_id=p_church_id and created_by=auth.uid() and operation_key=key for update;
 if op.id is not null then
  if op.payload_hash<>payload_hash then raise exception 'IDEMPOTENCY_CONFLICT'; end if;
  return op.result||jsonb_build_object('replayed',true);
 end if;
 if kind in ('CORRECT_TRANSACTION','CANCEL_TRANSACTION','CANCEL_ATTENDANCE','CORRECT_TRANSFER','CANCEL_TRANSFER','ADJUST_BALANCE') and coalesce(length(reason),0) not between 5 and 1000 then raise exception 'INVALID_INPUT' using errcode='22023'; end if;
 if kind like 'CORRECT_%' or kind like 'CANCEL_%' then
  if expected is null or expected<1 or p_payload->>'id' is null then raise exception 'INVALID_INPUT' using errcode='22023'; end if;
 end if;
 insert into public.financial_operations(church_id,congregation_id,created_by,operation_key,kind,payload_hash) values(p_church_id,unit,auth.uid(),key,kind,payload_hash) returning * into op;
 if kind='RECORD' then
  if coalesce(p_payload->>'mode','') not in ('SINGLE','ATTENDANCE') or (p_payload->>'mode'='SINGLE' and jsonb_array_length(p_payload->'items')<>1) or (p_payload->>'mode'='ATTENDANCE' and p_payload->>'direction'<>'INCOME') then raise exception 'INVALID_INPUT' using errcode='22023'; end if;
  entry:=private.finance_validate_entry(p_church_id,unit,p_payload);
  if (select sum((v->>'amountCents')::numeric) from jsonb_array_elements(entry->'items') v)>999999999999 then raise exception 'INVALID_INPUT' using errcode='22023'; end if;
  if p_payload->>'mode'='ATTENDANCE' then
   insert into public.financial_attendances(church_id,congregation_id,member_id,person_name,contributor_kind,cashbox_id,payment_method_id,transaction_date,created_by)
   values(p_church_id,unit,(entry->>'memberId')::uuid,entry->>'personName',entry->>'contributorKind',(entry->>'cashboxId')::uuid,(entry->>'paymentMethodId')::uuid,(entry->>'date')::date,auth.uid()) returning id into attendance;
  end if;
  for item in select value from jsonb_array_elements(entry->'items') loop
   ident:=private.finance_write_item_with_source(p_church_id,unit,op.id,entry,item,attendance,null,null,p_source_type);ids:=array_append(ids,ident);
  end loop;
  perform private.finance_attach_documents(p_church_id,unit,p_payload->'documentIds',ids[1]);
  if attendance is not null or coalesce((p_payload->>'issueReceipt')::boolean,false) then receipt:=private.finance_refresh_receipt(p_church_id,unit,ids[1],attendance);end if;
 elsif kind in ('CORRECT_TRANSACTION','CANCEL_TRANSACTION') then
  select * into old_tx from public.financial_transactions where church_id=p_church_id and congregation_id=unit and id=(p_payload->>'id')::uuid and deleted_at is null for update;
  if old_tx.id is null then raise exception 'FORBIDDEN' using errcode='42501'; end if;
  if old_tx.revision<>expected or old_tx.status<>'CONFIRMED' then raise exception 'CONFLICT'; end if;
  if old_tx.contributor_kind is null or not exists(select 1 from public.financial_ledger_entries where church_id=p_church_id and transaction_id=old_tx.id) then raise exception 'LEGACY_DATA_REQUIRES_REVIEW'; end if;
  attendance:=old_tx.attendance_id;ids:=array[old_tx.id];
  if kind='CORRECT_TRANSACTION' then
   entry:=private.finance_validate_entry(p_church_id,unit,(p_payload->'replacement')||jsonb_build_object('items',jsonb_build_array(p_payload#>'{replacement,item}')));
   -- Group identity and payment belong to the attendance; item corrections retain them.
   if attendance is not null and ((entry->>'memberId')::uuid is distinct from old_tx.member_id or entry->>'personName' is distinct from old_tx.person_name or entry->>'contributorKind' is distinct from old_tx.contributor_kind or entry->>'direction'<>'INCOME' or (entry->>'date')::date<>old_tx.transaction_date or (entry->>'cashboxId')::uuid<>old_tx.cashbox_id or (entry->>'paymentMethodId')::uuid<>old_tx.payment_method_id) then raise exception 'INVALID_INPUT' using errcode='22023'; end if;
   perform private.finance_reverse(p_church_id,unit,op.id,old_tx.id,null,old_tx.revision);
   perform private.finance_write_item(p_church_id,unit,op.id,entry,entry#>'{items,0}',attendance,old_tx.id,reason);
   perform private.finance_attach_documents(p_church_id,unit,entry->'documentIds',old_tx.id);
   rev:=old_tx.revision+1;
  else rev:=private.finance_cancel_transaction(p_church_id,unit,old_tx.id,op.id,reason); end if;
  if attendance is not null then
   update public.financial_attendances set revision=revision+1,updated_at=now(),status=case when exists(select 1 from public.financial_transactions where church_id=p_church_id and attendance_id=attendance and status='CONFIRMED' and deleted_at is null) then 'CONFIRMED' else 'CANCELLED' end where church_id=p_church_id and id=attendance;
  end if;
  if exists(select 1 from public.financial_receipts where church_id=p_church_id and ((attendance is not null and attendance_id=attendance) or (attendance is null and financial_transaction_id=old_tx.id))) then receipt:=private.finance_refresh_receipt(p_church_id,unit,old_tx.id,attendance); end if;
 elsif kind='CANCEL_ATTENDANCE' then
  attendance:=(p_payload->>'id')::uuid;
  select * into old_attendance from public.financial_attendances where church_id=p_church_id and congregation_id=unit and id=attendance and deleted_at is null for update;
  if old_attendance.id is null then raise exception 'FORBIDDEN' using errcode='42501';end if;
  if old_attendance.revision<>expected or old_attendance.status<>'CONFIRMED' then raise exception 'CONFLICT';end if;
  for old_tx in select * from public.financial_transactions where church_id=p_church_id and attendance_id=attendance and status='CONFIRMED' and deleted_at is null order by id for update loop
   perform private.finance_cancel_transaction(p_church_id,unit,old_tx.id,op.id,reason);ids:=array_append(ids,old_tx.id);
  end loop;
  update public.financial_attendances set status='CANCELLED',revision=revision+1,cancel_reason=reason,updated_at=now() where church_id=p_church_id and id=attendance returning revision into rev;
  receipt:=private.finance_refresh_receipt(p_church_id,unit,null,attendance);
 elsif kind in ('TRANSFER','CORRECT_TRANSFER','CANCEL_TRANSFER') then
  if kind='TRANSFER' then transfer:=gen_random_uuid();entry:=p_payload;
  else
   select * into old_transfer from public.financial_transfers where church_id=p_church_id and congregation_id=unit and id=(p_payload->>'id')::uuid and deleted_at is null for update;
   if old_transfer.id is null then raise exception 'FORBIDDEN' using errcode='42501';end if;
   if old_transfer.revision<>expected or old_transfer.status<>'CONFIRMED' then raise exception 'CONFLICT';end if;
   transfer:=old_transfer.id;rev:=old_transfer.revision+1;entry:=p_payload->'replacement';
   perform private.finance_reverse(p_church_id,unit,op.id,null,transfer,old_transfer.revision);
  end if;
  if kind='CANCEL_TRANSFER' then
   update public.financial_transfers set status='CANCELLED',revision=rev,cancel_reason=reason,updated_at=now() where church_id=p_church_id and id=transfer returning * into new_transfer;
  else
   perform private.finance_validate_transfer(p_church_id,unit,entry);
   insert into public.financial_transfers(id,church_id,congregation_id,source_cashbox_id,target_cashbox_id,amount,transaction_date,description,revision,created_by)
   values(transfer,p_church_id,unit,(entry->>'sourceCashboxId')::uuid,(entry->>'targetCashboxId')::uuid,private.finance_amount(entry->'amountCents'),(entry->>'date')::date,entry->>'description',rev,auth.uid())
   on conflict(id) do update set source_cashbox_id=excluded.source_cashbox_id,target_cashbox_id=excluded.target_cashbox_id,amount=excluded.amount,transaction_date=excluded.transaction_date,description=excluded.description,revision=excluded.revision,updated_at=now() returning * into new_transfer;
   insert into public.financial_ledger_entries(church_id,congregation_id,cashbox_id,transfer_id,operation_id,entry_kind,amount,financial_date,source_revision,created_by)
   values(p_church_id,unit,new_transfer.source_cashbox_id,transfer,op.id,'TRANSFER',-new_transfer.amount,new_transfer.transaction_date,rev,auth.uid()),
         (p_church_id,unit,new_transfer.target_cashbox_id,transfer,op.id,'TRANSFER',new_transfer.amount,new_transfer.transaction_date,rev,auth.uid());
  end if;
  insert into public.financial_transaction_revisions(church_id,congregation_id,transfer_id,revision,reason,previous_values,new_values,created_by)
  values(p_church_id,unit,transfer,rev,coalesce(reason,'Transferência registrada'),case when old_transfer.id is null then null else to_jsonb(old_transfer) end,to_jsonb(new_transfer),auth.uid());
 elsif kind='ADJUST_BALANCE' then
  d:=private.finance_date(p_payload->>'date');signed_amount:=private.finance_amount(p_payload->'amountCents',true);box:=(p_payload->>'cashboxId')::uuid;
  if not exists(select 1 from public.financial_cashboxes where church_id=p_church_id and congregation_id=unit and id=box and deleted_at is null and status='ACTIVE' and opening_date<=d) then raise exception 'INACTIVE_REFERENCE';end if;
  insert into public.financial_balance_adjustments(church_id,congregation_id,cashbox_id,amount,transaction_date,reason,created_by) values(p_church_id,unit,box,signed_amount,d,reason,auth.uid()) returning id into ident;
  insert into public.financial_ledger_entries(church_id,congregation_id,cashbox_id,adjustment_id,operation_id,entry_kind,amount,financial_date,created_by) values(p_church_id,unit,box,ident,op.id,'ADJUSTMENT',signed_amount,d,auth.uid());
 end if;
 v_result:=jsonb_build_object('operationId',op.id,'transactionIds',to_jsonb(ids),'attendanceId',attendance,'transferId',transfer,'receiptId',receipt,'revision',rev,'replayed',false);
 update public.financial_operations set result=v_result,updated_at=now() where id=op.id;
 return v_result;
end $$;

create or replace function public.execute_finance_command(p_church_id uuid,p_payload jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
begin return private.execute_finance_command_core(p_church_id,p_payload,'MANUAL'); end $$;

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
  command_result:=private.execute_finance_command_core(p_church_id,command,'IMPORT');
  select array_agg(value::uuid) into ids from jsonb_array_elements_text(command_result->'transactionIds');
  transfer:=(command_result->>'transferId')::uuid;
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

revoke all on function private.finance_write_item_with_source(uuid,uuid,uuid,jsonb,jsonb,uuid,uuid,text,text),private.execute_finance_command_core(uuid,jsonb,text) from public,anon,authenticated;
