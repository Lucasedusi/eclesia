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
  'canDelete',private.bank_import_removable(p_church,p_batch,null),
  'reconciliation',b.reconciliation,'reconciliationReason',b.reconciliation_reason,'balances',b.balances)
 from public.finance_bank_import_batches b join public.financial_cashboxes c on c.church_id=b.church_id and c.id=b.cashbox_id
 left join items i on i.batch_id=b.id left join health h on h.item_id=i.id
 where b.church_id=p_church and b.id=p_batch and b.deleted_at is null group by b.id,c.name;
$$;

create or replace function public.list_finance_bank_imports(p_church_id uuid,p_unit uuid,p_cashbox uuid default null,p_page integer default 1)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare pages integer; current_page integer;
begin
 if not private.bank_import_access(p_church_id,p_unit) then raise exception 'FORBIDDEN' using errcode='42501'; end if;
 if p_page is null or p_page not between 1 and 10000 then raise exception 'INVALID_INPUT'; end if;
 select greatest(1,ceil(count(*)/20.0)::int) into pages from public.finance_bank_import_batches
 where church_id=p_church_id and congregation_id=p_unit and deleted_at is null and (p_cashbox is null or cashbox_id=p_cashbox);
 current_page:=least(p_page,pages);
 return jsonb_build_object('batches',coalesce((select jsonb_agg(private.bank_import_batch_dto(p_church_id,b.id) order by b.created_at desc,b.id) from
  (select id,created_at from public.finance_bank_import_batches where church_id=p_church_id and congregation_id=p_unit and deleted_at is null and (p_cashbox is null or cashbox_id=p_cashbox) order by created_at desc,id limit 20 offset (current_page-1)*20) b),'[]'::jsonb),
  'page',current_page,'pageCount',pages);
end $$;
