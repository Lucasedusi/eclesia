-- Read-only category reporting. Existing transactions, snapshots and ledger remain unchanged.
create or replace function public.get_finance_category_report(p_church_id uuid, p_unit uuid, p_options jsonb)
returns jsonb language plpgsql stable security invoker set search_path = '' as $$
declare
  start_date date; end_date date; box uuid; ids uuid[]; direction text; presentation text;
  result jsonb; mismatch boolean; row_count bigint;
begin
  if auth.uid() is null or not private.can_access_finance_unit(p_church_id,p_unit,'finance.view') then
    raise exception 'FORBIDDEN' using errcode='42501';
  end if;
  if p_options is null or jsonb_typeof(p_options)<>'object'
    or coalesce(p_options->>'type','')<>'CATEGORY'
    or coalesce(p_options->>'dateFrom','') !~ '^20[0-9]{2}-(0[1-9]|1[0-2])-(0[1-9]|[12][0-9]|3[01])$'
    or coalesce(p_options->>'dateTo','') !~ '^20[0-9]{2}-(0[1-9]|1[0-2])-(0[1-9]|[12][0-9]|3[01])$'
    or coalesce(p_options->>'direction','') not in ('INCOME','EXPENSE')
    or coalesce(p_options->>'presentation','') not in ('SUMMARY','DETAILED')
    or jsonb_typeof(p_options->'categoryIds') is distinct from 'array'
    or exists(select 1 from jsonb_object_keys(p_options) k where k not in ('type','dateFrom','dateTo','direction','presentation','categoryIds','cashboxId')) then
    raise exception 'INVALID_INPUT' using errcode='22023';
  end if;
  if jsonb_array_length(p_options->'categoryIds') not between 1 and 50
    or exists(select 1 from jsonb_array_elements(p_options->'categoryIds') v where jsonb_typeof(v)<>'string') then
    raise exception 'INVALID_INPUT' using errcode='22023';
  end if;
  begin
    start_date:=(p_options->>'dateFrom')::date; end_date:=(p_options->>'dateTo')::date;
    box:=(p_options->>'cashboxId')::uuid;
    select array_agg(value::uuid) into ids from jsonb_array_elements_text(p_options->'categoryIds');
  exception when invalid_text_representation or datetime_field_overflow or invalid_datetime_format then
    raise exception 'INVALID_INPUT' using errcode='22023';
  end;
  if start_date>end_date or (select count(distinct id) from unnest(ids) id)<>cardinality(ids) then
    raise exception 'INVALID_INPUT' using errcode='22023';
  end if;
  direction:=p_options->>'direction'; presentation:=p_options->>'presentation';
  if (select count(*) from public.financial_categories where church_id=p_church_id and id=any(ids) and category_type in (direction,'BOTH') and deleted_at is null)<>cardinality(ids)
    or (box is not null and not exists(select 1 from public.financial_cashboxes where church_id=p_church_id and congregation_id=p_unit and id=box and deleted_at is null)) then
    raise exception 'FORBIDDEN' using errcode='42501';
  end if;
  with tx as materialized (
    select t.id,t.category_id,t.transaction_date,t.amount,t.description,coalesce(t.person_name,t.beneficiary_name) person_name,
      t.cashbox_id,t.classification_name,coalesce(b.name,'Caixa não disponível') cashbox_name
    from public.financial_transactions t
    left join public.financial_cashboxes b on b.church_id=t.church_id and b.congregation_id=t.congregation_id and b.id=t.cashbox_id and b.deleted_at is null
    where t.church_id=p_church_id and t.congregation_id=p_unit and t.deleted_at is null and t.status='CONFIRMED'
      and t.transaction_type=direction and t.category_id=any(ids)
      and t.transaction_date>=start_date and t.transaction_date<=end_date and (box is null or t.cashbox_id=box)
  ), ledger as (
    select l.transaction_id,l.cashbox_id,l.financial_date,sum(l.amount) amount
    from public.financial_ledger_entries l join tx t on t.id=l.transaction_id
    where l.church_id=p_church_id and l.congregation_id=p_unit and l.deleted_at is null
    group by l.transaction_id,l.cashbox_id,l.financial_date having sum(l.amount)<>0
  ), checked as (
    select exists(select 1 from tx t full join ledger l on l.transaction_id=t.id and l.cashbox_id=t.cashbox_id and l.financial_date=t.transaction_date
      where coalesce(t.amount*case when direction='INCOME' then 1 else -1 end,0)<>coalesce(l.amount,0)) bad
  ), totals as materialized (
    select c.id,c.name,c.status,coalesce(sum(t.amount),0)*100 amount,count(t.id) n
    from public.financial_categories c left join tx t on t.category_id=c.id
    where c.church_id=p_church_id and c.id=any(ids) and c.deleted_at is null
    group by c.id,c.name,c.status
  )
  select (select bad from checked),(select count(*) from tx),
    case when presentation='DETAILED' and (select count(*) from tx)>10000 then null else
    jsonb_build_object('type','CATEGORY','dateFrom',start_date,'dateTo',end_date,'direction',direction,'presentation',presentation,
      'categoryIds',to_jsonb(ids),'cashboxId',box,
      'cashboxName',(select name from public.financial_cashboxes where church_id=p_church_id and congregation_id=p_unit and id=box and deleted_at is null),
      'generatedAt',statement_timestamp(),'totalCents',(select coalesce(sum(amount),0) from totals),'count',(select count(*) from tx),
      'categories',(select jsonb_agg(jsonb_build_object('id',id,'name',name,'status',status,'amountCents',amount,'count',n) order by name,id) from totals),
      'rows',case when presentation='SUMMARY' then '[]'::jsonb else
        (select coalesce(jsonb_agg(jsonb_build_object('id',id,'categoryId',category_id,'date',transaction_date,'amountCents',amount*100,
          'description',description,'personName',person_name,'cashboxId',cashbox_id,'cashboxName',cashbox_name,'classificationName',classification_name)
          order by category_id,transaction_date,id),'[]') from tx) end)
    end into mismatch,row_count,result;
  if mismatch then raise exception 'REPORT_RECONCILIATION_REQUIRED'; end if;
  if presentation='DETAILED' and row_count>10000 then raise exception 'REPORT_TOO_LARGE'; end if;
  return result;
end; $$;
revoke all on function public.get_finance_category_report(uuid,uuid,jsonb) from public,anon;
grant execute on function public.get_finance_category_report(uuid,uuid,jsonb) to authenticated;
