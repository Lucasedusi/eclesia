-- Payer/payee identification. No reclassification or rewrite of historical rows.
-- The accounting congregation_id is independent of contributor_congregation_id.
alter table public.financial_transactions
 add column contributor_congregation_id uuid,
 add constraint financial_transactions_contributor_congregation_fk foreign key(church_id,contributor_congregation_id) references public.congregations(church_id,id),
 add constraint financial_transactions_contributor_congregation_check check (
   (contributor_kind = 'CONGREGATION' and contributor_congregation_id is not null)
   or (contributor_kind is distinct from 'CONGREGATION' and contributor_congregation_id is null));
alter table public.financial_attendances
 add column contributor_congregation_id uuid,
 drop constraint financial_attendances_contributor_kind_check,
 add constraint financial_attendances_contributor_kind_check check(contributor_kind in ('MEMBER','UNREGISTERED','COLLECTIVE','CONGREGATION','ORGANIZATION')),
 add constraint financial_attendances_contributor_congregation_fk foreign key(church_id,contributor_congregation_id) references public.congregations(church_id,id),
 add constraint financial_attendances_contributor_congregation_check check (
   (contributor_kind = 'CONGREGATION' and contributor_congregation_id is not null)
   or (contributor_kind <> 'CONGREGATION' and contributor_congregation_id is null));
create index financial_transactions_contributor_congregation_idx on public.financial_transactions(church_id,contributor_congregation_id,congregation_id,transaction_date) where contributor_congregation_id is not null;
create index financial_attendances_contributor_congregation_idx on public.financial_attendances(church_id,contributor_congregation_id) where contributor_congregation_id is not null;

-- Minimal directory for finance identification/filtering, not access to the other unit's finances.
create function public.lookup_finance_congregations(p_church_id uuid,p_unit uuid,p_query text) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare term text:=trim(p_query); result jsonb;
begin
 if auth.uid() is null or not private.can_access_finance_unit(p_church_id,p_unit,'finance.view') then raise exception 'FORBIDDEN' using errcode='42501'; end if;
 if coalesce(length(term),0) not between 2 and 160 then raise exception 'INVALID_INPUT' using errcode='22023'; end if;
 select coalesce(jsonb_agg(jsonb_build_object('id',v.id,'name',v.name) order by v.name,v.id),'[]') into result from (
   select c.id,c.name from public.congregations c
   where c.church_id=p_church_id and c.status='ACTIVE' and c.deleted_at is null
   and extensions.unaccent(c.name) ilike '%'||replace(replace(replace(extensions.unaccent(term),'!','!!'),'%','!%'),'_','!_')||'%' escape '!'
   order by c.name,c.id limit 20
 ) v;
 return result;
end $$;
revoke all on function public.lookup_finance_congregations(uuid,uuid,text) from public,anon;
grant execute on function public.lookup_finance_congregations(uuid,uuid,text) to authenticated;

create or replace function private.finance_validate_entry(p_church uuid,p_unit uuid,p jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare b public.financial_cashboxes; pm public.financial_payment_methods; cat public.financial_categories; dep public.financial_departments;
 classification public.financial_tithe_classifications; item jsonb; items jsonb:='[]'; person text; member uuid; contributor_congregation uuid; kind text:=p#>>'{contributor,kind}'; d date;
begin
 d:=private.finance_date(p->>'date');
 if coalesce(p->>'direction','') not in ('INCOME','EXPENSE') or coalesce(kind,'') not in ('MEMBER','UNREGISTERED','COLLECTIVE','CONGREGATION','ORGANIZATION') or jsonb_typeof(p->'items') is distinct from 'array' or jsonb_array_length(p->'items') not between 1 and 50 then raise exception 'INVALID_INPUT' using errcode='22023'; end if;
 select * into b from public.financial_cashboxes where church_id=p_church and congregation_id=p_unit and id=(p->>'cashboxId')::uuid and status='ACTIVE' and deleted_at is null;
 if b.id is null then raise exception 'INACTIVE_REFERENCE'; end if;
 if b.opening_date is null then raise exception 'LEGACY_DATA_REQUIRES_REVIEW'; end if;
 if d<b.opening_date then raise exception 'INVALID_INPUT' using errcode='22023'; end if;
 select m.* into pm from public.financial_payment_methods m join public.financial_cashbox_payment_methods l on l.church_id=m.church_id and l.payment_method_id=m.id
 where m.church_id=p_church and m.id=(p->>'paymentMethodId')::uuid and l.cashbox_id=b.id and l.deleted_at is null and m.deleted_at is null and m.status='ACTIVE';
 if pm.id is null or ((b.cashbox_type='CASH') is distinct from (pm.method_type='CASH')) then raise exception 'INACTIVE_REFERENCE'; end if;
 if pm.requires_reference and coalesce(length(trim(p->>'paymentReference')),0)=0 then raise exception 'INVALID_INPUT' using errcode='22023'; end if;
 if kind='MEMBER' then
  if not private.can_access_finance_unit(p_church,p_unit,'finance.contributors.lookup') then raise exception 'FORBIDDEN' using errcode='42501'; end if;
  member:=(p#>>'{contributor,memberId}')::uuid;
  select full_name into person from public.members where church_id=p_church and id=member and deleted_at is null;
  if person is null then raise exception 'INACTIVE_REFERENCE'; end if;
 elsif kind='CONGREGATION' then
  contributor_congregation:=(p#>>'{contributor,congregationId}')::uuid;
  select name into person from public.congregations where church_id=p_church and id=contributor_congregation and status='ACTIVE' and deleted_at is null;
  if person is null then raise exception 'INACTIVE_REFERENCE'; end if;
 elsif kind in ('UNREGISTERED','ORGANIZATION') then
  person:=trim(p#>>'{contributor,name}');
  if coalesce(length(person),0) not between 2 and 160 then raise exception 'INVALID_INPUT' using errcode='22023'; end if;
 end if;
 for item in select value from jsonb_array_elements(p->'items') loop
  perform private.finance_amount(item->'amountCents');
  select * into cat from public.financial_categories where church_id=p_church and id=(item->>'categoryId')::uuid and status='ACTIVE' and deleted_at is null;
  select * into dep from public.financial_departments where church_id=p_church and id=(item->>'departmentId')::uuid and status='ACTIVE' and deleted_at is null and (congregation_id is null or congregation_id=p_unit);
  if cat.id is null or dep.id is null then raise exception 'INACTIVE_REFERENCE'; end if;
  if cat.category_type not in ('BOTH',p->>'direction') or ((cat.is_tithe or cat.requires_member) and kind not in ('MEMBER','UNREGISTERED')) then raise exception 'INVALID_INPUT' using errcode='22023'; end if;
  classification:=null;
  if item->>'titheClassificationId' is not null then
   select * into classification from public.financial_tithe_classifications where church_id=p_church and id=(item->>'titheClassificationId')::uuid and status='ACTIVE' and deleted_at is null;
   if classification.id is null then raise exception 'INACTIVE_REFERENCE'; end if;
  end if;
  if cat.is_tithe and (classification.id is null or p->>'direction'<>'INCOME') then raise exception 'INVALID_INPUT' using errcode='22023'; end if;
  if coalesce(length(item->>'description'),0)>1000 or coalesce(length(item->>'notes'),0)>1000 or coalesce(length(item->>'documentNumber'),0)>80 then raise exception 'INVALID_INPUT' using errcode='22023'; end if;
  items:=items||jsonb_build_array(item||jsonb_build_object('categoryName',cat.name,'departmentName',dep.name,'classificationName',classification.name));
 end loop;
 if coalesce(length(p->>'beneficiaryName'),0)>160 or coalesce(length(p->>'paymentReference'),0)>160 then raise exception 'INVALID_INPUT' using errcode='22023'; end if;
 if pm.requires_receipt_upload and coalesce(jsonb_array_length(p->'documentIds'),0)=0 then raise exception 'INVALID_INPUT' using errcode='22023'; end if;
 return p||jsonb_build_object('items',items,'personName',person,'memberId',member,'contributorKind',kind,'contributorCongregationId',contributor_congregation,'beneficiaryName',case when p->>'direction'='EXPENSE' then coalesce(person,p->>'beneficiaryName') else null end,'paymentMethodName',pm.name);
end $$;

create or replace function private.finance_write_item_with_source(p_church uuid,p_unit uuid,p_operation uuid,p jsonb,p_item jsonb,p_attendance uuid,p_existing uuid default null,p_reason text default null,p_source_type text default 'MANUAL') returns uuid
language plpgsql security definer set search_path='' as $$
declare ident uuid:=coalesce(p_existing,gen_random_uuid()); old_tx public.financial_transactions; new_tx public.financial_transactions; d date:=(p->>'date')::date;
begin
 if p_existing is not null then select * into old_tx from public.financial_transactions where church_id=p_church and id=p_existing for update; end if;
 insert into public.financial_transactions(id,church_id,congregation_id,member_id,department_id,cashbox_id,payment_method_id,category_id,transaction_type,person_name,is_unregistered_person,description,amount,transaction_date,reference_month,reference_year,document_number,notes,created_by,confirmed_by,confirmed_at,attendance_id,tithe_classification_id,classification_name,beneficiary_name,contributor_kind,category_name,department_name,generate_receipt,payment_reference,source_type,contributor_congregation_id)
 values(ident,p_church,p_unit,(p->>'memberId')::uuid,(p_item->>'departmentId')::uuid,(p->>'cashboxId')::uuid,(p->>'paymentMethodId')::uuid,(p_item->>'categoryId')::uuid,p->>'direction',p->>'personName',p->>'contributorKind'='UNREGISTERED',p_item->>'description',private.finance_amount(p_item->'amountCents'),d,extract(month from d),extract(year from d),p_item->>'documentNumber',p_item->>'notes',auth.uid(),auth.uid(),now(),p_attendance,(p_item->>'titheClassificationId')::uuid,p_item->>'classificationName',p->>'beneficiaryName',p->>'contributorKind',p_item->>'categoryName',p_item->>'departmentName',coalesce((p->>'issueReceipt')::boolean,false),p->>'paymentReference',p_source_type,(p->>'contributorCongregationId')::uuid)
 on conflict(id) do update set contributor_congregation_id=excluded.contributor_congregation_id,member_id=excluded.member_id,department_id=excluded.department_id,cashbox_id=excluded.cashbox_id,payment_method_id=excluded.payment_method_id,category_id=excluded.category_id,transaction_type=excluded.transaction_type,person_name=excluded.person_name,is_unregistered_person=excluded.is_unregistered_person,description=excluded.description,amount=excluded.amount,transaction_date=excluded.transaction_date,reference_month=excluded.reference_month,reference_year=excluded.reference_year,document_number=excluded.document_number,notes=excluded.notes,tithe_classification_id=excluded.tithe_classification_id,classification_name=excluded.classification_name,beneficiary_name=excluded.beneficiary_name,contributor_kind=excluded.contributor_kind,category_name=excluded.category_name,department_name=excluded.department_name,payment_reference=excluded.payment_reference,revision=public.financial_transactions.revision+1,updated_at=now()
 returning * into new_tx;
 insert into public.financial_ledger_entries(church_id,congregation_id,cashbox_id,transaction_id,operation_id,entry_kind,amount,financial_date,source_revision,created_by)
 values(p_church,p_unit,new_tx.cashbox_id,ident,p_operation,'TRANSACTION',new_tx.amount*case when new_tx.transaction_type='INCOME' then 1 else -1 end,d,new_tx.revision,auth.uid());
 insert into public.financial_transaction_revisions(church_id,congregation_id,transaction_id,revision,reason,previous_values,new_values,created_by)
 values(p_church,p_unit,ident,new_tx.revision,coalesce(p_reason,'Lançamento registrado'),case when p_existing is null then null else to_jsonb(old_tx) end,to_jsonb(new_tx),auth.uid());
 return ident;
end $$;

create or replace function private.finance_write_item(p_church uuid,p_unit uuid,p_operation uuid,p jsonb,p_item jsonb,p_attendance uuid,p_existing uuid default null,p_reason text default null) returns uuid
language plpgsql security definer set search_path='' as $$
declare source text;
begin
 if p_existing is not null then
  select source_type into source from public.financial_transactions where church_id=p_church and congregation_id=p_unit and id=p_existing;
 end if;
 return private.finance_write_item_with_source(p_church,p_unit,p_operation,p,p_item,p_attendance,p_existing,p_reason,coalesce(source,'MANUAL'));
end $$;

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

create or replace function public.list_finance_transactions(p_church_id uuid,p_unit uuid,p_filters jsonb)
returns jsonb language plpgsql stable security invoker set search_path='' as $$
declare start_date date;end_date date;page_number integer;search_text text;result jsonb;
begin
 if not private.can_access_finance_unit(p_church_id,p_unit,'finance.view') then raise exception 'FORBIDDEN';end if;
 if jsonb_typeof(p_filters) is distinct from 'object' or coalesce(p_filters->>'month','')!~'^20[0-9]{2}-(0[1-9]|1[0-2])$' then raise exception 'INVALID_INPUT';end if;
 page_number:=coalesce((p_filters->>'page')::integer,1);if page_number<1 or page_number>100000 then raise exception 'INVALID_INPUT';end if;
 if coalesce(p_filters->>'direction','ALL') not in ('ALL','INCOME','EXPENSE') or coalesce(p_filters->>'status','ALL') not in ('ALL','CONFIRMED','CANCELLED') then raise exception 'INVALID_INPUT';end if;
 if p_filters ? 'dateFrom' or p_filters ? 'dateTo' then
  if jsonb_typeof(p_filters->'dateFrom') is distinct from 'string'
     or jsonb_typeof(p_filters->'dateTo') is distinct from 'string'
     or (p_filters->>'dateFrom') !~ '^20[0-9]{2}-(0[1-9]|1[0-2])-(0[1-9]|[12][0-9]|3[01])$'
     or (p_filters->>'dateTo') !~ '^20[0-9]{2}-(0[1-9]|1[0-2])-(0[1-9]|[12][0-9]|3[01])$'
  then raise exception 'INVALID_INPUT' using errcode='22023'; end if;
  start_date := (p_filters->>'dateFrom')::date;
  end_date := (p_filters->>'dateTo')::date;
  if start_date > end_date then raise exception 'INVALID_INPUT' using errcode='22023'; end if;
  -- Keep an exclusive query bound while accepting an inclusive civil end date.
  end_date := end_date + 1;
 else
  start_date:=((p_filters->>'month')||'-01')::date;
  end_date:=(start_date+interval '1 month')::date;
 end if;
 search_text:=trim(coalesce(p_filters->>'search',''));if length(search_text)>160 then raise exception 'INVALID_INPUT';end if;
 with filtered as materialized(
 select t.* from public.financial_transactions t where t.church_id=p_church_id and t.congregation_id=p_unit and t.deleted_at is null and t.transaction_date>=start_date and t.transaction_date<end_date
 and (coalesce(p_filters->>'direction','ALL')='ALL' or t.transaction_type=p_filters->>'direction')
 and (coalesce(p_filters->>'status','ALL')='ALL' or t.status=p_filters->>'status')
 and (nullif(p_filters->>'departmentId','') is null or t.department_id=(p_filters->>'departmentId')::uuid)
 and (nullif(p_filters->>'categoryId','') is null or t.category_id=(p_filters->>'categoryId')::uuid)
 and (nullif(p_filters->>'cashboxId','') is null or t.cashbox_id=(p_filters->>'cashboxId')::uuid)
 and (nullif(p_filters->>'paymentMethodId','') is null or t.payment_method_id=(p_filters->>'paymentMethodId')::uuid)
 and (nullif(p_filters->>'titheClassificationId','') is null or t.tithe_classification_id=(p_filters->>'titheClassificationId')::uuid)
 and (nullif(p_filters->>'contributorCongregationId','') is null or t.contributor_congregation_id=(p_filters->>'contributorCongregationId')::uuid)
 and (nullif(p_filters->>'memberId','') is null or t.member_id=(p_filters->>'memberId')::uuid)
 and (search_text='' or position(lower(search_text) in lower(concat_ws(' ',t.person_name,t.beneficiary_name,t.description,t.document_number,t.transaction_number)))>0)
 ), paged as (select * from filtered order by transaction_date desc,id desc limit 20 offset (page_number-1)*20)
 select jsonb_build_object('contributorCongregationId',nullif(p_filters->>'contributorCongregationId',''),'dateFrom',start_date,'dateTo',end_date-1,'page',page_number,'pageCount',greatest(1,(select ceil(count(*)/20.0)::integer from filtered)),
 'totalCount',(select count(*) from filtered),
 'filteredIncomeCents',(select coalesce(sum(amount),0)*100 from filtered where status='CONFIRMED' and transaction_type='INCOME'),
 'filteredExpenseCents',(select coalesce(sum(amount),0)*100 from filtered where status='CONFIRMED' and transaction_type='EXPENSE'),
 'items',(select coalesce(jsonb_agg(jsonb_build_object('id',t.id,'date',t.transaction_date,'direction',t.transaction_type,'amountCents',t.amount*100,'status',t.status,'revision',t.revision,'contributorCongregationId',t.contributor_congregation_id,'contributorKind',t.contributor_kind,'personName',t.person_name,'beneficiaryName',t.beneficiary_name,'categoryName',t.category_name,'departmentName',t.department_name,'classificationName',t.classification_name,'description',t.description,'documentNumber',t.document_number,'attendanceId',t.attendance_id,'cashboxId',t.cashbox_id,'paymentMethodId',t.payment_method_id) order by t.transaction_date desc,t.id desc),'[]') from paged t)
 ) into result;return result;
end;$$;
revoke all on function public.list_finance_transactions(uuid,uuid,jsonb) from public,anon;
grant execute on function public.list_finance_transactions(uuid,uuid,jsonb) to authenticated;

-- Existing RPC grants, RLS and audit protections are preserved.
revoke all on function private.finance_validate_entry(uuid,uuid,jsonb), private.finance_write_item(uuid,uuid,uuid,jsonb,jsonb,uuid,uuid,text), private.finance_write_item_with_source(uuid,uuid,uuid,jsonb,jsonb,uuid,uuid,text,text), private.execute_finance_command_core(uuid,jsonb,text) from public,anon,authenticated;
notify pgrst, 'reload schema';
