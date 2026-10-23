-- Read an entire page under RLS instead of restarting scope checks for every DTO.
-- Keep the authenticated invoker, tenant predicates, grants and timeout unchanged.
create function private.bank_import_health_set(p_church uuid,p_items uuid[])
returns table(item_id uuid,stale boolean,changed boolean,cancelled boolean)
language sql stable security invoker set search_path='' as $$
 with requested as materialized (
  select i.* from public.finance_bank_import_items i
  where i.church_id=p_church and i.id=any(p_items) and i.deleted_at is null
 ), resolved as materialized (
  select r.id item_id,
   case when r.status='DUPLICATE' then c.id else r.id end id,
   case when r.status='DUPLICATE' then c.status else r.status end status,
   case when r.status='DUPLICATE' then c.congregation_id else r.congregation_id end congregation_id,
   case when r.status='DUPLICATE' then c.cashbox_id else r.cashbox_id end cashbox_id,
   case when r.status='DUPLICATE' then c.transaction_date else r.transaction_date end transaction_date,
   case when r.status='DUPLICATE' then c.amount_cents else r.amount_cents end amount_cents
  from requested r left join public.finance_bank_import_items c
   on r.status='DUPLICATE' and c.church_id=p_church and c.id=r.canonical_id and c.deleted_at is null
 ), linked as materialized (
  select r.item_id,l.id link_id,
   t.status='CONFIRMED' and t.deleted_at is null and t.cashbox_id=r.cashbox_id
    and t.transaction_date=r.transaction_date and t.congregation_id=r.congregation_id
    and (t.transaction_type='INCOME')=(r.amount_cents>0) as ok,
   t.id is null or t.status='CANCELLED' or t.deleted_at is not null as gone,
   (t.amount*100)::bigint*case when t.transaction_type='INCOME' then 1 else -1 end cents,
   t.revision<>l.finance_revision revised
  from resolved r join public.finance_bank_import_links l
   on l.church_id=p_church and l.item_id=r.id and l.deleted_at is null and l.transaction_id is not null
  left join public.financial_transactions t on t.church_id=p_church and t.id=l.transaction_id
  where r.status in ('POSTED','LINKED')
  union all
  select r.item_id,l.id,
   t.status='CONFIRMED' and t.deleted_at is null and t.transaction_date=r.transaction_date
    and t.congregation_id=r.congregation_id
    and case when r.amount_cents>0 then t.target_cashbox_id=r.cashbox_id else t.source_cashbox_id=r.cashbox_id end,
   t.id is null or t.status='CANCELLED' or t.deleted_at is not null,
   (t.amount*100)::bigint*case when r.amount_cents>0 then 1 else -1 end,t.revision<>l.finance_revision
  from resolved r join public.finance_bank_import_links l
   on l.church_id=p_church and l.item_id=r.id and l.deleted_at is null and l.transfer_id is not null
  left join public.financial_transfers t on t.church_id=p_church and t.id=l.transfer_id
  where r.status in ('POSTED','LINKED')
 )
 select r.item_id,
  count(l.link_id)=0 or count(l.link_id) filter(where l.ok)<>count(l.link_id)
   or sum(l.cents) is distinct from r.amount_cents,
  coalesce(bool_or(l.revised),false),
  count(l.link_id)>0 and count(l.link_id) filter(where l.gone)=count(l.link_id)
 from resolved r left join linked l on l.item_id=r.item_id
 group by r.item_id,r.amount_cents;
$$;
revoke all on function private.bank_import_health_set(uuid,uuid[]) from public,anon;
grant execute on function private.bank_import_health_set(uuid,uuid[]) to authenticated;

create or replace function public.get_finance_bank_import(p_church_id uuid,p_unit uuid,p_batch uuid,p_filters jsonb default '{}') returns jsonb
language plpgsql stable security invoker set search_path='' as $$
declare
 page integer:=coalesce((p_filters->>'page')::int,1);
 state text:=coalesce(p_filters->>'status','PENDING');
 direction text:=coalesce(p_filters->>'direction','ALL');
 query text:=coalesce(p_filters->>'query','');
 batch public.finance_bank_import_batches; response jsonb;
begin
 if not private.bank_import_access(p_church_id,p_unit) then raise exception 'FORBIDDEN' using errcode='42501'; end if;
 select * into batch from public.finance_bank_import_batches
 where church_id=p_church_id and congregation_id=p_unit and id=p_batch and deleted_at is null;
 if batch.id is null then raise exception 'FORBIDDEN' using errcode='42501'; end if;
 if page not between 1 and 10000 or state not in ('PENDING','COMPLETED','IGNORED','ALL')
  or direction not in ('INCOME','EXPENSE','ALL') or length(query)>100 then raise exception 'INVALID_INPUT'; end if;
 with source_items as materialized (
  select i.* from public.finance_bank_import_items i
  where i.church_id=p_church_id and i.congregation_id=p_unit and i.batch_id=p_batch and i.deleted_at is null
 ), health as materialized (
  select h.* from private.bank_import_health_set(p_church_id,
   array(select id from source_items where status in ('POSTED','LINKED','DUPLICATE'))) h
 ), inspected as materialized (
  select i.*,coalesce(h.stale,false) stale,coalesce(h.changed,false) changed,coalesce(h.cancelled,false) cancelled
  from source_items i left join health h on h.item_id=i.id
 ), filtered as materialized (
  select i.* from inspected i
  where (state='ALL' or (state='PENDING' and (i.status='PENDING' or i.stale))
   or (state='COMPLETED' and i.status in ('POSTED','LINKED','DUPLICATE') and not i.stale)
   or (state='IGNORED' and i.status='IGNORED'))
  and (direction='ALL' or (direction='INCOME' and i.amount_cents>0) or (direction='EXPENSE' and i.amount_cents<0))
  and (query='' or strpos(lower(concat_ws(' ',i.document,i.history,i.complement)),lower(query))>0)
 ), page_items as materialized (
  select * from filtered order by row_number limit 50 offset (page-1)*50
 ), summary as (
  select min(transaction_date) date_from,max(transaction_date) date_to,count(*) total,
   count(*) filter(where status='PENDING' or stale) pending,
   count(*) filter(where status in ('POSTED','LINKED','DUPLICATE') and not stale) completed,
   count(*) filter(where status='IGNORED') ignored,
   coalesce(sum(amount_cents) filter(where amount_cents>0),0) income_cents,
   coalesce(-sum(amount_cents) filter(where amount_cents<0),0) expense_cents
  from inspected
 )
 select jsonb_build_object(
  'batch',jsonb_build_object('id',batch.id,'cashboxId',batch.cashbox_id,
   'cashboxName',(select name from public.financial_cashboxes where church_id=p_church_id and congregation_id=p_unit and id=batch.cashbox_id),
   'fileName',batch.file_name,'createdAt',batch.created_at,'dateFrom',s.date_from,'dateTo',s.date_to,
   'total',s.total,'pending',s.pending,'incomeCents',s.income_cents,'expenseCents',s.expense_cents,
   'reconciliation',batch.reconciliation,'reconciliationReason',batch.reconciliation_reason,'balances',batch.balances),
  'counts',jsonb_build_object('pending',s.pending,'completed',s.completed,'ignored',s.ignored,'total',s.total),
  'page',page,'pageCount',greatest(1,(select ceil(count(*)/50.0) from filtered)),
  'items',coalesce((select jsonb_agg(jsonb_build_object(
   'id',i.id,'batchId',i.batch_id,'rowNumber',i.row_number,'date',i.transaction_date,'amountCents',i.amount_cents,
   'sourceDate',i.source_date,'sourceValue',i.source_value,'document',i.document,'history',i.history,
   'complement',i.complement,'issue',i.issue,'fingerprint',i.fingerprint,
   'possibleDuplicate',exists(select 1 from public.finance_bank_import_items other
    where other.church_id=p_church_id and other.congregation_id=p_unit and other.cashbox_id=i.cashbox_id
    and other.batch_id<>i.batch_id and other.fingerprint=i.fingerprint and other.deleted_at is null),
   'status',i.status,'revision',i.revision,'draft',i.draft,'reason',i.reason,'canonicalId',i.canonical_id,
   'result',coalesce(c.result,i.result),'stale',i.stale,'changed',i.changed,'cancelled',i.cancelled,
   'historyEvents',coalesce((select jsonb_agg(jsonb_build_object('action',e.action,'reason',e.reason,'at',e.created_at,'actor',e.actor_name) order by e.created_at,e.revision)
    from public.finance_bank_import_events e where e.church_id=p_church_id and e.congregation_id=p_unit and e.item_id=i.id),'[]'::jsonb)
  ) order by i.row_number) from page_items i left join public.finance_bank_import_items c
   on c.church_id=p_church_id and c.congregation_id=p_unit and c.id=i.canonical_id and c.deleted_at is null),'[]'::jsonb)
 ) into response from summary s;
 return response;
end $$;

-- History also summarizes a batch in one health query as items are completed.
create or replace function private.bank_import_batch_dto(p_church uuid,p_batch uuid) returns jsonb
language sql stable security invoker set search_path='' as $$
 with items as materialized (
  select i.* from public.finance_bank_import_items i
  where i.church_id=p_church and i.batch_id=p_batch and i.deleted_at is null
 ), health as materialized (
  select h.* from private.bank_import_health_set(p_church,
   array(select id from items where status in ('POSTED','LINKED','DUPLICATE'))) h
 )
 select jsonb_build_object('id',b.id,'cashboxId',b.cashbox_id,'cashboxName',c.name,'fileName',b.file_name,'createdAt',b.created_at,
  'dateFrom',min(i.transaction_date),'dateTo',max(i.transaction_date),'total',count(i.id),
  'pending',count(i.id) filter(where i.status='PENDING' or coalesce(h.stale,false)),
  'incomeCents',coalesce(sum(i.amount_cents) filter(where i.amount_cents>0),0),
  'expenseCents',coalesce(-sum(i.amount_cents) filter(where i.amount_cents<0),0),
  'reconciliation',b.reconciliation,'reconciliationReason',b.reconciliation_reason,'balances',b.balances)
 from public.finance_bank_import_batches b join public.financial_cashboxes c on c.church_id=b.church_id and c.id=b.cashbox_id
 left join items i on i.batch_id=b.id left join health h on h.item_id=i.id
 where b.church_id=p_church and b.id=p_batch and b.deleted_at is null group by b.id,c.name;
$$;
