-- Add per-cashbox synthetic aggregates without changing the analytic projection.
-- Keep consolidated categories for compatibility with the previously deployed app.
-- No persisted financial data is modified.
create or replace function public.get_finance_report(p_church_id uuid, p_unit uuid, p_options jsonb)
returns jsonb language plpgsql stable security invoker set search_path='' as $$
declare
 start_date date; end_date date; box uuid; report_type text; result jsonb; mismatch boolean; row_count bigint;
begin
 if auth.uid() is null or not private.can_access_finance_unit(p_church_id,p_unit,'finance.view') then
  raise exception 'FORBIDDEN' using errcode='42501';
 end if;
 if p_options is null or jsonb_typeof(p_options)<>'object'
  or coalesce(p_options->>'month','') !~ '^20[0-9]{2}-(0[1-9]|1[0-2])$'
  or coalesce(p_options->>'type','') not in ('ANALYTIC','SYNTHETIC')
  or exists(select 1 from jsonb_object_keys(p_options) k where k not in ('type','month','cashboxId')) then
  raise exception 'INVALID_INPUT' using errcode='22023';
 end if;
 begin box:=(p_options->>'cashboxId')::uuid; exception when invalid_text_representation then raise exception 'INVALID_INPUT' using errcode='22023';end;
 if box is not null and not exists(select 1 from public.financial_cashboxes where church_id=p_church_id and congregation_id=p_unit and id=box and deleted_at is null) then raise exception 'FORBIDDEN' using errcode='42501';end if;
 start_date:=((p_options->>'month')||'-01')::date; end_date:=(start_date+interval '1 month')::date; report_type:=p_options->>'type';
 with
 report_boxes as materialized (select * from public.financial_cashboxes where church_id=p_church_id and congregation_id=p_unit and deleted_at is null),
 report_methods as materialized (select * from public.financial_payment_methods where church_id=p_church_id and deleted_at is null),
 ledger as materialized (
  select id,cashbox_id,transaction_id,transfer_id,adjustment_id,entry_kind,amount,financial_date from public.financial_ledger_entries where church_id=p_church_id and congregation_id=p_unit and deleted_at is null and financial_date<end_date and (box is null or cashbox_id=box)
 ),
 tx as materialized (
  select t.id,t.transaction_date,t.transaction_type,t.amount,t.category_id,t.category_name,t.tithe_classification_id,t.classification_name,t.person_name,t.beneficiary_name,t.description,t.document_number,t.department_name,t.department_id,t.cashbox_id, coalesce(b.name,'Caixa não disponível') box_name, coalesce(pm.name,'Não informado') method_name
  from public.financial_transactions t
  left join report_boxes b on b.church_id=t.church_id and b.congregation_id=t.congregation_id and b.id=t.cashbox_id and b.deleted_at is null
  left join report_methods pm on pm.church_id=t.church_id and pm.id=t.payment_method_id and pm.deleted_at is null
  where t.church_id=p_church_id and t.congregation_id=p_unit and t.deleted_at is null and t.status='CONFIRMED'
   and t.transaction_date>=start_date and t.transaction_date<end_date and (box is null or t.cashbox_id=box)
 ),
 tx_ledger as (
  select transaction_id,cashbox_id,financial_date,sum(amount) amount from ledger where transaction_id is not null and financial_date>=start_date group by transaction_id,cashbox_id,financial_date having sum(amount)<>0
 ),
 checked as (
  select exists(select 1 from tx t full join tx_ledger l on l.transaction_id=t.id and l.cashbox_id=t.cashbox_id and l.financial_date=t.transaction_date
   where coalesce(t.amount*case when t.transaction_type='INCOME' then 1 else -1 end,0)<>coalesce(l.amount,0)) bad
 ),
 category_totals as materialized (
  select category_id,coalesce(category_name,'Sem categoria') name,tithe_classification_id,classification_name,transaction_type,sum(amount)*100 amount,count(*) n
  from tx group by category_id,category_name,tithe_classification_id,classification_name,transaction_type
 ),
 cashbox_category_totals as materialized (
  select cashbox_id,category_id,coalesce(category_name,'Sem categoria') name,tithe_classification_id,classification_name,transaction_type,sum(amount)*100 amount,count(*) n
  from tx where report_type='SYNTHETIC' group by cashbox_id,category_id,category_name,tithe_classification_id,classification_name,transaction_type
 ),
 department_totals as (
  select department_id,coalesce(department_name,'Sem departamento') name,
   coalesce(sum(amount) filter(where transaction_type='INCOME'),0)*100 inc,coalesce(sum(amount) filter(where transaction_type='EXPENSE'),0)*100 exp
  from tx group by department_id,department_name
 ),
 box_ids as (select cashbox_id id from ledger union select cashbox_id from tx),
 box_totals as materialized (
  select ids.id,coalesce(b.name,'Caixa não disponível') name,
   case when b.cashbox_type='BANK_ACCOUNT' then jsonb_build_object('bankName',b.bank_name,'agency',b.agency,'accountNumber',b.account_number) else null end bank_details,
   coalesce(l.opening,0)*100 opening,coalesce(l.opening_movement,0)*100 opening_movement,coalesce(l.adjustment,0)*100 adjustment,coalesce(l.transfer_net,0)*100 transfer_net,coalesce(l.closing,0)*100 closing,
   coalesce(t.inc,0)*100 inc,coalesce(t.exp,0)*100 exp,coalesce(t.n,0) n
  from box_ids ids
  left join report_boxes b on b.church_id=p_church_id and b.congregation_id=p_unit and b.id=ids.id and b.deleted_at is null
  left join (select cashbox_id,sum(amount) filter(where financial_date<start_date) opening,
   sum(amount) filter(where financial_date>=start_date and entry_kind='OPENING') opening_movement,
   sum(amount) filter(where financial_date>=start_date and entry_kind='ADJUSTMENT') adjustment,
   sum(amount) filter(where financial_date>=start_date and transfer_id is not null) transfer_net,sum(amount) closing from ledger group by cashbox_id) l on l.cashbox_id=ids.id
  left join (select cashbox_id,sum(amount) filter(where transaction_type='INCOME') inc,sum(amount) filter(where transaction_type='EXPENSE') exp,count(*) n from tx group by cashbox_id) t on t.cashbox_id=ids.id
 ),
 movements as materialized (
  select l.id,l.financial_date date,l.entry_kind kind,
   concat(case when l.entry_kind='OPENING' then 'Saldo de abertura · ' else 'Ajuste de saldo · ' end,coalesce(b.name,'Caixa não disponível'),case when a.reason is not null then ' · '||a.reason else '' end) description,l.amount*100 amount
  from ledger l left join report_boxes b on b.church_id=p_church_id and b.congregation_id=p_unit and b.id=l.cashbox_id and b.deleted_at is null
  left join public.financial_balance_adjustments a on a.church_id=p_church_id and a.congregation_id=p_unit and a.id=l.adjustment_id and a.deleted_at is null
  where l.financial_date>=start_date and l.entry_kind in ('OPENING','ADJUSTMENT')
  union all
  select t.id,t.transaction_date,'TRANSFER',concat(coalesce(s.name,'Caixa de origem'),' → ',coalesce(d.name,'Caixa de destino')),
   t.amount*100*case when box=t.source_cashbox_id then -1 else 1 end
  from public.financial_transfers t
  left join report_boxes s on s.church_id=p_church_id and s.congregation_id=p_unit and s.id=t.source_cashbox_id and s.deleted_at is null
  left join report_boxes d on d.church_id=p_church_id and d.congregation_id=p_unit and d.id=t.target_cashbox_id and d.deleted_at is null
  where t.church_id=p_church_id and t.congregation_id=p_unit and t.deleted_at is null and t.status='CONFIRMED' and t.transaction_date>=start_date and t.transaction_date<end_date and (box is null or box in(t.source_cashbox_id,t.target_cashbox_id))
 ),
 sizes as (select (case when report_type='ANALYTIC' then (select count(*) from tx) else (select count(*) from cashbox_category_totals) end)+(select count(*) from movements)+(select count(*) from department_totals)+(select count(*) from box_totals) n)
 select (select bad from checked) or exists(select 1 from box_totals where opening+inc-exp+opening_movement+adjustment+transfer_net<>closing),
 (select n from sizes),
 case when (select n from sizes)>10000 then null else
 jsonb_build_object('type',report_type,'month',p_options->>'month','generatedAt',statement_timestamp(),'cashboxId',box,
 'cashboxName',(select name from report_boxes where church_id=p_church_id and congregation_id=p_unit and id=box and deleted_at is null),
 'summary',(select jsonb_build_object('openingCents',coalesce(sum(opening),0),'incomeCents',coalesce(sum(inc),0),'expenseCents',coalesce(sum(exp),0),'openingMovementCents',coalesce(sum(opening_movement),0),'adjustmentCents',coalesce(sum(adjustment),0),'transferNetCents',coalesce(sum(transfer_net),0),'closingCents',coalesce(sum(closing),0),'count',coalesce(sum(n),0)) from box_totals),
 'departments',(select coalesce(jsonb_agg(jsonb_build_object('id',coalesce(department_id::text,'missing'),'name',name,'incomeCents',inc,'expenseCents',exp) order by name,department_id),'[]') from department_totals),
 'cashboxes',(select coalesce(jsonb_agg(jsonb_build_object('id',id,'name',name,'openingCents',opening,'incomeCents',inc,'expenseCents',exp,'openingMovementCents',opening_movement,'adjustmentCents',adjustment,'transferNetCents',transfer_net,'closingCents',closing,'count',n) || jsonb_build_object('bankDetails',bank_details) order by name,id),'[]') from box_totals),
 'movements',(select coalesce(jsonb_agg(jsonb_build_object('id',id,'date',date,'kind',kind,'description',description,'amountCents',amount) order by date,id),'[]') from movements)) ||
 case when report_type='ANALYTIC' then jsonb_build_object('rows',(select coalesce(jsonb_agg(jsonb_build_object(
  'id',id,'date',transaction_date,'direction',transaction_type,'amountCents',amount*100,
  'categoryId',coalesce(category_id::text,'missing'),'categoryName',coalesce(category_name,'Sem categoria'),
  'classificationId',tithe_classification_id,'classificationName',classification_name,
  'personName',coalesce(person_name,beneficiary_name),'description',description,'documentNumber',document_number,
  'departmentName',coalesce(department_name,'Sem departamento'),'cashboxId',cashbox_id,'cashboxName',box_name,'paymentMethodName',method_name
 ) order by transaction_type,category_name,category_id,transaction_date,id),'[]') from tx))
 else jsonb_build_object('categories',(select coalesce(jsonb_agg(jsonb_build_object('categoryId',coalesce(category_id::text,'missing'),'categoryName',name,'classificationId',tithe_classification_id,'classificationName',classification_name,'direction',transaction_type,'amountCents',amount,'count',n) order by transaction_type,name,category_id,classification_name),'[]') from category_totals), 'cashboxCategories',(select coalesce(jsonb_agg(jsonb_build_object('cashboxId',cashbox_id,'categoryId',coalesce(category_id::text,'missing'),'categoryName',name,'classificationId',tithe_classification_id,'classificationName',classification_name,'direction',transaction_type,'amountCents',amount,'count',n) order by cashbox_id,transaction_type,name,category_id,classification_name,tithe_classification_id),'[]') from cashbox_category_totals)) end end
 into mismatch,row_count,result;
 if mismatch then raise exception 'REPORT_RECONCILIATION_REQUIRED';end if;
 if row_count>10000 then raise exception 'REPORT_TOO_LARGE';end if;
 return result;
end;$$;
revoke all on function public.get_finance_report(uuid,uuid,jsonb) from public,anon;
grant execute on function public.get_finance_report(uuid,uuid,jsonb) to authenticated;
