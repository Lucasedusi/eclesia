-- Read the Cathedral's balances and one page of movements from the same snapshot.
create function public.get_finance_daily_cash_flow(p_church_id uuid, p_filters jsonb)
returns jsonb language plpgsql stable security invoker set search_path = '' as $$
declare
  headquarters uuid[];
  unit_id uuid;
  day date;
  box uuid := null;
  department uuid;
  category uuid;
  method uuid;
  direction text;
  term text;
  requested_page integer;
  result jsonb;
  consistent boolean;
begin
  if not private.can_manage_finance_reports(p_church_id) then
    raise exception 'FORBIDDEN' using errcode='42501';
  end if;
  select array_agg(id) into headquarters from public.congregations
  where church_id=p_church_id and is_headquarters and status='ACTIVE' and deleted_at is null;
  if cardinality(headquarters) is distinct from 1 then raise exception 'CONFIGURATION_REQUIRED'; end if;
  unit_id := headquarters[1];
  if not private.can_access_finance_unit(p_church_id,unit_id,'finance.view') then
    raise exception 'FORBIDDEN' using errcode='42501';
  end if;
  if jsonb_typeof(p_filters) is distinct from 'object'
     or coalesce(p_filters->>'date','') !~ '^20[0-9]{2}-[0-9]{2}-[0-9]{2}$'
     or exists (select from jsonb_object_keys(p_filters) k where k not in
         ('date','box','direction','search','department','category','method','page')) then
    raise exception 'INVALID_INPUT' using errcode='22023';
  end if;
  day := (p_filters->>'date')::date;
  box := (p_filters->>'box')::uuid;
  department := (p_filters->>'department')::uuid;
  category := (p_filters->>'category')::uuid;
  method := (p_filters->>'method')::uuid;
  direction := coalesce(p_filters->>'direction','ALL');
  term := lower(trim(coalesce(p_filters->>'search','')));
  requested_page := coalesce((p_filters->>'page')::integer,1);
  if direction not in ('ALL','INCOME','EXPENSE') or length(term)>160 or requested_page not between 1 and 100000 then
    raise exception 'INVALID_INPUT' using errcode='22023';
  end if;
  if box is not null and not exists(select from public.financial_cashboxes
      where church_id=p_church_id and congregation_id=unit_id and id=box and deleted_at is null) then
    raise exception 'FORBIDDEN' using errcode='42501';
  end if;

  with boxes as materialized (
    select id,name,status from public.financial_cashboxes
    where church_id=p_church_id and congregation_id=unit_id and deleted_at is null
  ), methods as materialized (
    select id,name from public.financial_payment_methods where church_id=p_church_id and deleted_at is null
  ), ledger_today as materialized (
    select id, cashbox_id, transaction_id, adjustment_id, entry_kind, amount, created_at
    from public.financial_ledger_entries
    where church_id=p_church_id and congregation_id=unit_id and deleted_at is null
      and financial_date=day and (box is null or cashbox_id=box)
  ), previous_balance as (
    select coalesce(sum(amount),0) amount from public.financial_ledger_entries
    where church_id=p_church_id and congregation_id=unit_id and deleted_at is null
      and financial_date<day and (box is null or cashbox_id=box)
  ), transactions as materialized (
    select t.id,t.created_at,t.transaction_type kind,t.cashbox_id,t.department_id,t.category_id,t.payment_method_id,
      coalesce(t.category_name,'Sem categoria') title,
      coalesce(t.person_name,t.beneficiary_name,t.description) detail,t.description,
      coalesce(b.name,'Caixa não disponível') box_name,m.name method_name,t.department_name,
      case when t.transaction_type='INCOME' then t.amount else -t.amount end amount
    from public.financial_transactions t
    left join boxes b on b.id=t.cashbox_id
    left join methods m on m.id=t.payment_method_id
    where t.church_id=p_church_id and t.congregation_id=unit_id and t.deleted_at is null
      and t.transaction_date=day and t.status='CONFIRMED' and (box is null or t.cashbox_id=box)
  ), movements as materialized (
    select id,created_at,kind,title,detail,description,box_name,method_name,department_name,
      department_id,category_id,payment_method_id,amount, false neutral from transactions
    union all
    select t.id,t.created_at,'TRANSFER','Transferência interna',t.description,t.description,
      concat_ws(' → ',coalesce(s.name,'Caixa de origem'),coalesce(d.name,'Caixa de destino')),
      null,null,null,null,null, case when box=t.source_cashbox_id then -t.amount else t.amount end,box is null
    from public.financial_transfers t
    left join boxes s on s.id=t.source_cashbox_id left join boxes d on d.id=t.target_cashbox_id
    where t.church_id=p_church_id and t.congregation_id=unit_id and t.deleted_at is null
      and t.transaction_date=day and t.status='CONFIRMED' and (box is null or box in (t.source_cashbox_id,t.target_cashbox_id))
    union all
    select l.id,l.created_at,l.entry_kind,case l.entry_kind when 'OPENING' then 'Saldo de abertura' else 'Ajuste de saldo' end,
      a.reason,a.reason,coalesce(b.name,'Caixa não disponível'),null,null,null,null,null,l.amount,false
    from ledger_today l left join boxes b on b.id=l.cashbox_id
    left join public.financial_balance_adjustments a on a.church_id=p_church_id and a.congregation_id=unit_id and a.id=l.adjustment_id and a.deleted_at is null
    where l.entry_kind in ('OPENING','ADJUSTMENT')
  ), filtered as materialized (
    select * from movements where (direction='ALL' or kind=direction)
      and (department is null or department_id=department)
      and (category is null or category_id=category) and (method is null or payment_method_id=method)
      and (term='' or strpos(lower(concat_ws(' ',title,detail,description,box_name,method_name,department_name)),term)>0)
  ), pagination as (
    select count(*) total, least(requested_page,greatest(1,(count(*)+19)/20)) page from filtered
  ), items as (
    select * from filtered order by created_at desc,id,kind
    limit 20 offset (select (page-1)*20 from pagination)
  ), daily_net as (
    select coalesce(sum(amount),0) amount from ledger_today
  ), transaction_net as (
    select transaction_id,cashbox_id,sum(amount) amount from ledger_today where transaction_id is not null
    group by transaction_id,cashbox_id having sum(amount)<>0
  )
  select not exists (
    select from transactions t full join transaction_net l on t.id=l.transaction_id and t.cashbox_id=l.cashbox_id
    where coalesce(t.amount,0)<>coalesce(l.amount,0)
  ) and daily_net.amount=(select coalesce(sum(amount) filter(where not neutral),0) from movements),
  jsonb_build_object(
    'date',day,'box',box,'summary',jsonb_build_object(
      'opening',previous_balance.amount*100,'closing',(previous_balance.amount+daily_net.amount)*100,
      'income',(select coalesce(sum(amount),0)*100 from transactions where kind='INCOME'),
      'expense',(select -coalesce(sum(amount),0)*100 from transactions where kind='EXPENSE')),
    'cashboxes',(select coalesce(jsonb_agg(jsonb_build_object('id',id,'name',name,'status',status) order by name,id),'[]') from boxes),
    'departments',(select coalesce(jsonb_agg(jsonb_build_object('id',id,'name',name) order by name,id),'[]') from public.financial_departments
      where church_id=p_church_id and (congregation_id is null or congregation_id=unit_id) and deleted_at is null),
    'categories',(select coalesce(jsonb_agg(jsonb_build_object('id',id,'name',name) order by name,id),'[]') from public.financial_categories where church_id=p_church_id and deleted_at is null),
    'methods',(select coalesce(jsonb_agg(jsonb_build_object('id',id,'name',name) order by name,id),'[]') from methods),
    'total',pagination.total,'page',pagination.page,
    'items',(select coalesce(jsonb_agg(jsonb_build_object(
      'id',id,'kind',kind,'title',title,'detail',detail,'boxName',box_name,'methodName',method_name,
      'departmentName',department_name,'amount',abs(amount)*100,
      'sign',case when neutral then 'NEUTRAL' when amount<0 then 'MINUS' else 'PLUS' end
    ) order by created_at desc,id,kind),'[]') from items)
  ) into consistent,result from previous_balance cross join daily_net cross join pagination;
  if not consistent then raise exception 'REPORT_RECONCILIATION_REQUIRED'; end if;
  return result;
end;
$$;
revoke all on function public.get_finance_daily_cash_flow(uuid,jsonb) from public,anon;
grant execute on function public.get_finance_daily_cash_flow(uuid,jsonb) to authenticated;
