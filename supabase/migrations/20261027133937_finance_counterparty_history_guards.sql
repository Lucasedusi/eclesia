-- Null-safe identity invariant, including privileged maintenance of legacy rows.
alter table public.financial_transactions drop constraint financial_transactions_contributor_congregation_check;
alter table public.financial_transactions add constraint financial_transactions_contributor_congregation_check
 check ((contributor_kind is not distinct from 'CONGREGATION') = (contributor_congregation_id is not null));

create or replace function private.execute_finance_command_core(p_church_id uuid,p_payload jsonb,p_source_type text) returns jsonb
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
   insert into public.financial_attendances(church_id,congregation_id,member_id,person_name,contributor_kind,contributor_congregation_id,cashbox_id,payment_method_id,transaction_date,created_by)
   values(p_church_id,unit,(entry->>'memberId')::uuid,entry->>'personName',entry->>'contributorKind',(entry->>'contributorCongregationId')::uuid,(entry->>'cashboxId')::uuid,(entry->>'paymentMethodId')::uuid,(entry->>'date')::date,auth.uid()) returning id into attendance;
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
   -- Renaming a linked congregation must not prevent correction of the group's items
   -- or rewrite the name on its historical receipt. The ID check below still forbids reassignment.
   if attendance is not null and old_tx.contributor_kind='CONGREGATION'
      and entry->>'contributorKind'='CONGREGATION'
      and (entry->>'contributorCongregationId')::uuid=old_tx.contributor_congregation_id then
     entry:=jsonb_set(entry,'{personName}',to_jsonb(old_tx.person_name));
   end if;
   -- Group identity and payment belong to the attendance; item corrections retain them.
   if attendance is not null and ((entry->>'contributorCongregationId')::uuid is distinct from old_tx.contributor_congregation_id or (entry->>'memberId')::uuid is distinct from old_tx.member_id or entry->>'personName' is distinct from old_tx.person_name or entry->>'contributorKind' is distinct from old_tx.contributor_kind or entry->>'direction'<>'INCOME' or (entry->>'date')::date<>old_tx.transaction_date or (entry->>'cashboxId')::uuid<>old_tx.cashbox_id or (entry->>'paymentMethodId')::uuid<>old_tx.payment_method_id) then raise exception 'INVALID_INPUT' using errcode='22023'; end if;
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
revoke all on function private.execute_finance_command_core(uuid,jsonb,text) from public,anon,authenticated;
