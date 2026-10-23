-- Count links requiring renewed review in the batch history as well as the queue.
create or replace function private.bank_import_batch_dto(p_church uuid,p_batch uuid) returns jsonb
 language sql stable security invoker set search_path='' as $$
 select jsonb_build_object('id',b.id,'cashboxId',b.cashbox_id,'cashboxName',c.name,'fileName',b.file_name,'createdAt',b.created_at,
  'dateFrom',min(i.transaction_date),'dateTo',max(i.transaction_date),'total',count(i.id),'pending',count(i.id) filter(where i.status='PENDING' or (i.status in ('POSTED','LINKED','DUPLICATE') and (private.bank_import_health(i.church_id,i.id)->>'stale')::boolean)),
  'incomeCents',coalesce(sum(i.amount_cents) filter(where i.amount_cents>0),0),'expenseCents',coalesce(-sum(i.amount_cents) filter(where i.amount_cents<0),0),
  'reconciliation',b.reconciliation,'reconciliationReason',b.reconciliation_reason,'balances',b.balances)
 from public.finance_bank_import_batches b join public.financial_cashboxes c on c.church_id=b.church_id and c.id=b.cashbox_id
 left join public.finance_bank_import_items i on i.church_id=b.church_id and i.batch_id=b.id and i.deleted_at is null
 where b.church_id=p_church and b.id=p_batch and b.deleted_at is null group by b.id,c.name;
$$;

create or replace function private.bank_import_item_dto(p_church uuid,p_item uuid) returns jsonb
 language sql stable security invoker set search_path='' as $$
 select jsonb_build_object('id',i.id,'batchId',i.batch_id,'rowNumber',i.row_number,'date',i.transaction_date,'amountCents',i.amount_cents,
  'sourceDate',i.source_date,'sourceValue',i.source_value,'document',i.document,'history',i.history,'complement',i.complement,'issue',i.issue,'fingerprint',i.fingerprint,
  'possibleDuplicate',exists(select 1 from public.finance_bank_import_items other where other.church_id=i.church_id and other.cashbox_id=i.cashbox_id and other.batch_id<>i.batch_id and other.fingerprint=i.fingerprint and other.deleted_at is null),'status',i.status,'revision',i.revision,'draft',i.draft,'reason',i.reason,'canonicalId',i.canonical_id,'result',coalesce(c.result,i.result),
  'historyEvents',coalesce((select jsonb_agg(jsonb_build_object('action',e.action,'reason',e.reason,'at',e.created_at,'actor',e.actor_name) order by e.created_at,e.revision)
   from public.finance_bank_import_events e where e.church_id=i.church_id and e.item_id=i.id),'[]'::jsonb)) ||
  case when i.status in ('POSTED','LINKED','DUPLICATE') then private.bank_import_health(i.church_id,i.id) else '{"stale":false,"changed":false,"cancelled":false}'::jsonb end
 from public.finance_bank_import_items i left join public.finance_bank_import_items c on c.church_id=i.church_id and c.id=i.canonical_id and c.deleted_at is null
 where i.church_id=p_church and i.id=p_item and i.deleted_at is null;
$$;

create or replace function public.finance_bank_import_candidates(p_church_id uuid,p_unit uuid,p_item uuid,p_query text default '') returns jsonb
 language plpgsql stable security invoker set search_path='' as $$
declare i public.finance_bank_import_items; found_rows jsonb;
begin
 if not private.bank_import_access(p_church_id,p_unit) then raise exception 'FORBIDDEN' using errcode='42501'; end if;
 select * into i from public.finance_bank_import_items where church_id=p_church_id and congregation_id=p_unit and id=p_item and deleted_at is null;
 if i.id is null then raise exception 'FORBIDDEN' using errcode='42501'; end if;
 if p_query is null or length(p_query)>100 then raise exception 'INVALID_INPUT'; end if;
 select coalesce(jsonb_agg(to_jsonb(c) order by strong desc,kind,id),'[]'::jsonb) into found_rows from (
  select * from (
   select 'ITEM'::text kind,t.id,concat('Linha ',t.row_number,' · ',b.file_name) label,t.transaction_date date,t.amount_cents "amountCents",
    t.fingerprint=i.fingerprint and t.batch_id<>i.batch_id strong,
    t.status in ('POSTED','LINKED') and t.transaction_date=i.transaction_date and t.amount_cents=i.amount_cents and not (private.bank_import_health(p_church_id,t.id)->>'stale')::boolean compatible,t.status
   from public.finance_bank_import_items t join public.finance_bank_import_batches b on b.church_id=t.church_id and b.id=t.batch_id and b.deleted_at is null
   where t.church_id=p_church_id and t.congregation_id=p_unit and t.cashbox_id=i.cashbox_id and t.id<>i.id and t.deleted_at is null
    and (t.fingerprint=i.fingerprint or (t.transaction_date=i.transaction_date and t.amount_cents=i.amount_cents))
   union all
   select 'TRANSACTION',t.id,concat_ws(' · ',coalesce(t.category_name,'Lançamento'),case when private.can_access_finance_unit(p_church_id,p_unit,'finance.contributors.lookup') then coalesce(t.person_name,t.beneficiary_name) end,nullif(t.description,'')),t.transaction_date,(t.amount*100)::bigint*case when t.transaction_type='INCOME' then 1 else -1 end,false,
    not exists(select 1 from public.finance_bank_import_links l where l.church_id=p_church_id and l.transaction_id=t.id and l.deleted_at is null),t.status::text
   from public.financial_transactions t where t.church_id=p_church_id and t.congregation_id=p_unit and t.cashbox_id=i.cashbox_id and t.deleted_at is null and t.status='CONFIRMED' and t.attendance_id is null
    and t.transaction_date=i.transaction_date and t.amount*100=abs(i.amount_cents) and (t.transaction_type='INCOME')=(i.amount_cents>0)
   union all
   select 'ATTENDANCE',t.attendance_id,'Atendimento · '||count(*)||' categorias',min(t.transaction_date),(sum(t.amount)*100)::bigint,false,
    not bool_or(exists(select 1 from public.finance_bank_import_links l where l.church_id=p_church_id and l.transaction_id=t.id and l.deleted_at is null)),'CONFIRMED'
   from public.financial_transactions t where t.church_id=p_church_id and t.congregation_id=p_unit and t.deleted_at is null and t.status='CONFIRMED' and t.attendance_id is not null and i.amount_cents>0
   group by t.attendance_id having bool_and(t.cashbox_id=i.cashbox_id and t.transaction_date=i.transaction_date and t.transaction_type='INCOME') and sum(t.amount)*100=i.amount_cents
   union all
   select 'TRANSFER',t.id,coalesce(nullif(t.description,''),'Transferência interna'),t.transaction_date,(t.amount*100)::bigint*case when i.amount_cents>0 then 1 else -1 end,false,
    not exists(select 1 from public.finance_bank_import_links l where l.church_id=p_church_id and l.transfer_id=t.id and l.cashbox_id=i.cashbox_id and l.deleted_at is null),t.status
   from public.financial_transfers t where t.church_id=p_church_id and t.congregation_id=p_unit and t.deleted_at is null and t.status='CONFIRMED'
    and private.can_access_finance_unit(p_church_id,p_unit,'finance.transfers.manage') and t.transaction_date=i.transaction_date and t.amount*100=abs(i.amount_cents)
    and case when i.amount_cents>0 then t.target_cashbox_id=i.cashbox_id else t.source_cashbox_id=i.cashbox_id end
  ) options where p_query='' or strong or strpos(lower(label),lower(p_query))>0 order by strong desc,kind,id limit 50
 ) c;
 return found_rows;
end $$;
