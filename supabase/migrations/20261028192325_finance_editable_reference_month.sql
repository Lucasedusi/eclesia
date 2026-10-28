-- Informational reference only. Movement date still drives ledger, balances and reports.
-- No backfill, data rewrite, public API signature or permission changes.
-- All callers are permission/tenant checked in execute_finance_command_core.
create or replace function private.finance_write_item_with_source(p_church uuid,p_unit uuid,p_operation uuid,p jsonb,p_item jsonb,p_attendance uuid,p_existing uuid default null,p_reason text default null,p_source_type text default 'MANUAL') returns uuid
language plpgsql security definer set search_path='' as $$
declare ident uuid:=coalesce(p_existing,gen_random_uuid()); old_tx public.financial_transactions; new_tx public.financial_transactions; d date:=(p->>'date')::date; reference_date date;
begin
 if p_existing is not null then select * into old_tx from public.financial_transactions where church_id=p_church and congregation_id=p_unit and id=p_existing for update; end if;
 -- Old callers may omit the month. Preserve an existing reference on correction.
 -- Explicit null/empty/invalid values must fail even through a direct RPC call.
 if p ? 'referenceMonth' then
  reference_date:=private.finance_month(p->>'referenceMonth');
 elsif old_tx.reference_year is not null and old_tx.reference_month is not null then
  reference_date:=make_date(old_tx.reference_year,old_tx.reference_month,1);
 else
  reference_date:=date_trunc('month',d)::date;
 end if;
 insert into public.financial_transactions(id,church_id,congregation_id,member_id,department_id,cashbox_id,payment_method_id,category_id,transaction_type,person_name,is_unregistered_person,description,amount,transaction_date,reference_month,reference_year,document_number,notes,created_by,confirmed_by,confirmed_at,attendance_id,tithe_classification_id,classification_name,beneficiary_name,contributor_kind,category_name,department_name,generate_receipt,payment_reference,source_type,contributor_congregation_id)
 values(ident,p_church,p_unit,(p->>'memberId')::uuid,(p_item->>'departmentId')::uuid,(p->>'cashboxId')::uuid,(p->>'paymentMethodId')::uuid,(p_item->>'categoryId')::uuid,p->>'direction',p->>'personName',p->>'contributorKind'='UNREGISTERED',p_item->>'description',private.finance_amount(p_item->'amountCents'),d,extract(month from reference_date),extract(year from reference_date),p_item->>'documentNumber',p_item->>'notes',auth.uid(),auth.uid(),now(),p_attendance,(p_item->>'titheClassificationId')::uuid,p_item->>'classificationName',p->>'beneficiaryName',p->>'contributorKind',p_item->>'categoryName',p_item->>'departmentName',coalesce((p->>'issueReceipt')::boolean,false),p->>'paymentReference',p_source_type,(p->>'contributorCongregationId')::uuid)
 on conflict(id) do update set contributor_congregation_id=excluded.contributor_congregation_id,member_id=excluded.member_id,department_id=excluded.department_id,cashbox_id=excluded.cashbox_id,payment_method_id=excluded.payment_method_id,category_id=excluded.category_id,transaction_type=excluded.transaction_type,person_name=excluded.person_name,is_unregistered_person=excluded.is_unregistered_person,description=excluded.description,amount=excluded.amount,transaction_date=excluded.transaction_date,reference_month=excluded.reference_month,reference_year=excluded.reference_year,document_number=excluded.document_number,notes=excluded.notes,tithe_classification_id=excluded.tithe_classification_id,classification_name=excluded.classification_name,beneficiary_name=excluded.beneficiary_name,contributor_kind=excluded.contributor_kind,category_name=excluded.category_name,department_name=excluded.department_name,payment_reference=excluded.payment_reference,revision=public.financial_transactions.revision+1,updated_at=now()
 returning * into new_tx;
 insert into public.financial_ledger_entries(church_id,congregation_id,cashbox_id,transaction_id,operation_id,entry_kind,amount,financial_date,source_revision,created_by)
 values(p_church,p_unit,new_tx.cashbox_id,ident,p_operation,'TRANSACTION',new_tx.amount*case when new_tx.transaction_type='INCOME' then 1 else -1 end,d,new_tx.revision,auth.uid());
 insert into public.financial_transaction_revisions(church_id,congregation_id,transaction_id,revision,reason,previous_values,new_values,created_by)
 values(p_church,p_unit,ident,new_tx.revision,coalesce(p_reason,'Lançamento registrado'),case when p_existing is null then null else to_jsonb(old_tx) end,to_jsonb(new_tx),auth.uid());
 return ident;
end $$;

revoke all on function private.finance_write_item_with_source(uuid,uuid,uuid,jsonb,jsonb,uuid,uuid,text,text) from public,anon,authenticated;
