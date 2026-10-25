-- Keep financial history immutable; removing review data never cancels money.
create function private.bank_import_removable(p_church uuid,p_batch uuid,p_item uuid default null)
returns boolean language sql stable security invoker set search_path='' as $$
 select not exists (
  select 1 from public.finance_bank_import_items i
  where i.church_id=p_church and i.batch_id=p_batch and (p_item is null or i.id=p_item)
   and (i.status not in ('PENDING','IGNORED') or i.result is not null or i.canonical_id is not null
    or exists(select 1 from public.finance_bank_import_events e where e.church_id=p_church and e.item_id=i.id and e.action in ('POST','LINK','DUPLICATE'))
    or exists(select 1 from public.finance_bank_import_links l where l.church_id=p_church and l.item_id=i.id)
    or exists(select 1 from public.finance_bank_import_items other where other.church_id=p_church and other.canonical_id=i.id))
 );
$$;
revoke all on function private.bank_import_removable(uuid,uuid,uuid) from public,anon;
grant execute on function private.bank_import_removable(uuid,uuid,uuid) to authenticated;

-- Same church lock as posting/importing prevents delete-versus-post races.
-- SECURITY DEFINER: clients intentionally have no direct mutation grants.
create function public.manage_finance_bank_import(p_church_id uuid,p_unit uuid,p_batch uuid,p_item uuid,p_revision integer,p_operation_key uuid,p_action text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare b public.finance_bank_import_batches; i public.finance_bank_import_items;
 op public.finance_bank_import_operations; digest text; response jsonb; actor text;
begin
 if auth.uid() is null or not private.bank_import_access(p_church_id,p_unit) then raise exception 'FORBIDDEN' using errcode='42501'; end if;
 if p_operation_key is null or p_batch is null or p_action is null or p_action not in ('DELETE_BATCH','DELETE_ITEM','RESTORE_ITEM')
  or (p_action='DELETE_BATCH' and (p_item is not null or p_revision is not null))
  or (p_action<>'DELETE_BATCH' and (p_item is null or p_revision is null or p_revision<1)) then raise exception 'INVALID_INPUT' using errcode='22023'; end if;
 perform pg_advisory_xact_lock(hashtextextended(p_church_id::text,0));
 select * into b from public.finance_bank_import_batches where church_id=p_church_id and congregation_id=p_unit and id=p_batch for update;
 if b.id is null then raise exception 'FORBIDDEN' using errcode='42501'; end if;
 digest:=encode(extensions.digest(jsonb_build_array(p_unit,p_batch,p_item,p_revision,p_action)::text,'sha256'),'hex');
 select * into op from public.finance_bank_import_operations where church_id=p_church_id and created_by=auth.uid() and operation_key=p_operation_key;
 if op.id is not null then
  if op.payload_hash<>digest then raise exception 'IDEMPOTENCY_CONFLICT'; end if;
  return op.result||jsonb_build_object('replayed',true);
 end if;
 if b.deleted_at is not null then raise exception 'BANK_IMPORT_STATE'; end if;
 if p_action='DELETE_BATCH' then
  select * into i from public.finance_bank_import_items where church_id=p_church_id and batch_id=p_batch order by row_number limit 1;
 else
  select * into i from public.finance_bank_import_items where church_id=p_church_id and congregation_id=p_unit and batch_id=p_batch and id=p_item for update;
 end if;
 if i.id is null then raise exception 'FORBIDDEN' using errcode='42501'; end if;
 if p_action<>'DELETE_BATCH' and i.revision<>p_revision then raise exception 'BANK_IMPORT_CONFLICT'; end if;
 if not private.bank_import_removable(p_church_id,p_batch,p_item) then raise exception 'BANK_IMPORT_DELETE_BLOCKED'; end if;
 if (p_action='DELETE_ITEM' and i.deleted_at is not null) or (p_action='RESTORE_ITEM' and i.deleted_at is null) then raise exception 'BANK_IMPORT_STATE'; end if;
 select full_name into actor from public.profiles where id=auth.uid();
 if p_action='DELETE_BATCH' then
  update public.finance_bank_import_batches set deleted_at=now(),updated_at=now() where church_id=p_church_id and id=p_batch;
  with changed as (
   update public.finance_bank_import_items set deleted_at=now(),updated_at=now(),revision=revision+1
   where church_id=p_church_id and batch_id=p_batch and deleted_at is null returning id,revision
  ) insert into public.finance_bank_import_events(church_id,congregation_id,item_id,action,revision,reason,created_by,actor_name)
   select p_church_id,p_unit,id,p_action,revision,'Importação excluída antes de qualquer registro financeiro',auth.uid(),coalesce(actor,'Usuário') from changed;
 else
  update public.finance_bank_import_items set deleted_at=case when p_action='DELETE_ITEM' then now() else null end,updated_at=now(),revision=revision+1
   where church_id=p_church_id and id=p_item;
  insert into public.finance_bank_import_events(church_id,congregation_id,item_id,action,revision,reason,created_by,actor_name)
   values(p_church_id,p_unit,p_item,p_action,i.revision+1,case when p_action='DELETE_ITEM' then 'Item removido da conferência' else 'Item recuperado para conferência' end,auth.uid(),coalesce(actor,'Usuário'));
 end if;
 response:=jsonb_build_object('batchId',p_batch,'itemId',p_item,'deleted',p_action<>'RESTORE_ITEM','replayed',false);
 insert into public.finance_bank_import_operations(church_id,congregation_id,item_id,operation_key,payload_hash,result,created_by)
 values(p_church_id,p_unit,i.id,p_operation_key,digest,response,auth.uid());
 return response;
end $$;
revoke all on function public.manage_finance_bank_import(uuid,uuid,uuid,uuid,integer,uuid,text) from public,anon;
grant execute on function public.manage_finance_bank_import(uuid,uuid,uuid,uuid,integer,uuid,text) to authenticated;

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
 if page not between 1 and 10000 or state not in ('PENDING','COMPLETED','IGNORED','ALL','DELETED')
  or direction not in ('INCOME','EXPENSE','ALL') or length(query)>100 then raise exception 'INVALID_INPUT'; end if;
 with source_items as materialized (
  select i.* from public.finance_bank_import_items i
  where i.church_id=p_church_id and i.congregation_id=p_unit and i.batch_id=p_batch
 ), health as materialized (
  select h.* from private.bank_import_health_set(p_church_id,
   array(select id from source_items where status in ('POSTED','LINKED','DUPLICATE'))) h
 ), inspected as materialized (
  select i.*,coalesce(h.stale,false) stale,coalesce(h.changed,false) changed,coalesce(h.cancelled,false) cancelled
  from source_items i left join health h on h.item_id=i.id
 ), filtered as materialized (
  select i.* from inspected i
  where ((state='DELETED' and i.deleted_at is not null) or (state<>'DELETED' and i.deleted_at is null))
  and (state in ('ALL','DELETED') or (state='PENDING' and (i.status='PENDING' or i.stale))
   or (state='COMPLETED' and i.status in ('POSTED','LINKED','DUPLICATE') and not i.stale)
   or (state='IGNORED' and i.status='IGNORED'))
  and (direction='ALL' or (direction='INCOME' and i.amount_cents>0) or (direction='EXPENSE' and i.amount_cents<0))
  and (query='' or strpos(lower(concat_ws(' ',i.document,i.history,i.complement)),lower(query))>0)
 ), page_items as materialized (
  select * from filtered order by row_number limit 50 offset (least(page,greatest(1,(select ceil(count(*)/50.0)::int from filtered)))-1)*50
 ), summary as (
  select min(transaction_date) date_from,max(transaction_date) date_to,count(*) total,
   count(*) filter(where status='PENDING' or stale) pending,
   count(*) filter(where status in ('POSTED','LINKED','DUPLICATE') and not stale) completed,
   count(*) filter(where status='IGNORED') ignored,
   coalesce(sum(amount_cents) filter(where amount_cents>0),0) income_cents,
   coalesce(-sum(amount_cents) filter(where amount_cents<0),0) expense_cents
  from inspected where deleted_at is null
 )
 select jsonb_build_object(
  'batch',jsonb_build_object('id',batch.id,'cashboxId',batch.cashbox_id,
   'cashboxName',(select name from public.financial_cashboxes where church_id=p_church_id and congregation_id=p_unit and id=batch.cashbox_id),
   'fileName',batch.file_name,'createdAt',batch.created_at,'dateFrom',s.date_from,'dateTo',s.date_to,
   'total',s.total,'pending',s.pending,'incomeCents',s.income_cents,'expenseCents',s.expense_cents,
   'canDelete',private.bank_import_removable(p_church_id,p_batch,null),
   'reconciliation',batch.reconciliation,'reconciliationReason',batch.reconciliation_reason,'balances',batch.balances),
  'counts',jsonb_build_object('pending',s.pending,'completed',s.completed,'ignored',s.ignored,'total',s.total),
  'page',least(page,greatest(1,(select ceil(count(*)/50.0)::int from filtered))),'pageCount',greatest(1,(select ceil(count(*)/50.0) from filtered)),
  'items',coalesce((select jsonb_agg(jsonb_build_object(
   'id',i.id,'batchId',i.batch_id,'rowNumber',i.row_number,'date',i.transaction_date,'amountCents',i.amount_cents,
   'sourceDate',i.source_date,'sourceValue',i.source_value,'document',i.document,'history',i.history,
   'complement',i.complement,'issue',i.issue,'fingerprint',i.fingerprint,
   'possibleDuplicate',exists(select 1 from public.finance_bank_import_items other
    where other.church_id=p_church_id and other.congregation_id=p_unit and other.cashbox_id=i.cashbox_id
    and other.batch_id<>i.batch_id and other.fingerprint=i.fingerprint and other.deleted_at is null),
   'deleted',i.deleted_at is not null,
   'canDelete',i.status in ('PENDING','IGNORED') and i.result is null and i.canonical_id is null
    and not exists(select 1 from public.finance_bank_import_events e where e.church_id=p_church_id and e.item_id=i.id and e.action in ('POST','LINK','DUPLICATE'))
    and not exists(select 1 from public.finance_bank_import_links l where l.church_id=p_church_id and l.item_id=i.id)
    and not exists(select 1 from public.finance_bank_import_items other where other.church_id=p_church_id and other.canonical_id=i.id),
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
  where i.church_id=p_church and i.batch_id=p_batch
 ), health as materialized (
  select h.* from private.bank_import_health_set(p_church,
   array(select id from items where status in ('POSTED','LINKED','DUPLICATE'))) h
 )
 select jsonb_build_object('id',b.id,'cashboxId',b.cashbox_id,'cashboxName',c.name,'fileName',b.file_name,'createdAt',b.created_at,
  'dateFrom',min(i.transaction_date),'dateTo',max(i.transaction_date),'total',count(i.id),
  'pending',count(i.id) filter(where i.status='PENDING' or coalesce(h.stale,false)),
  'incomeCents',coalesce(sum(i.amount_cents) filter(where i.amount_cents>0),0),
  'expenseCents',coalesce(-sum(i.amount_cents) filter(where i.amount_cents<0),0),
  'canDelete',private.bank_import_removable(p_church,p_batch,null),
  'reconciliation',b.reconciliation,'reconciliationReason',b.reconciliation_reason,'balances',b.balances)
 from public.finance_bank_import_batches b join public.financial_cashboxes c on c.church_id=b.church_id and c.id=b.cashbox_id
 left join items i on i.batch_id=b.id left join health h on h.item_id=i.id
 where b.church_id=p_church and b.id=p_batch and b.deleted_at is null group by b.id,c.name;
$$;
