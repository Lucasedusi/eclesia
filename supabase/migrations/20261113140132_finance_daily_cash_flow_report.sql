-- One read-only snapshot for a Cathedral closing, independent of the screen's filters and pagination.
create function public.get_finance_daily_cash_flow_report(p_church_id uuid, p_day date,
  p_box uuid default null, p_detail boolean default false, p_payments boolean default false)
returns jsonb language plpgsql stable security invoker set search_path = '' as $$
declare
  headquarters uuid[];
  unit_id uuid;
  result jsonb;
  mismatch boolean;
begin
  if auth.uid() is null or not private.can_manage_finance_reports(p_church_id) then
    raise exception 'FORBIDDEN' using errcode='42501';
  end if;
  select array_agg(id) into headquarters from public.congregations
    where church_id=p_church_id and is_headquarters and status='ACTIVE' and deleted_at is null;
  if cardinality(headquarters) is distinct from 1 then raise exception 'REPORT_CONFIGURATION_REQUIRED'; end if;
  unit_id := headquarters[1];
  if not private.can_access_finance_unit(p_church_id,unit_id,'finance.view') then
    raise exception 'FORBIDDEN' using errcode='42501';
  end if;
  if p_day is null or p_day not between date '2000-01-01' and date '2099-12-31'
     or p_detail is null or p_payments is null then raise exception 'INVALID_INPUT' using errcode='22023'; end if;
  if p_box is not null and not exists(select from public.financial_cashboxes where
      id=p_box and church_id=p_church_id and congregation_id=unit_id and deleted_at is null) then
    raise exception 'FORBIDDEN' using errcode='42501';
  end if;

  with boxes as materialized (
    select id,name,case when cashbox_type='BANK_ACCOUNT' then jsonb_build_object(
      'bankName',bank_name,'agency',agency,'accountNumber',account_number) end bank
    from public.financial_cashboxes where church_id=p_church_id and congregation_id=unit_id and deleted_at is null
  ), previous as (
    select cashbox_id,sum(amount)*100 cents from public.financial_ledger_entries
    where church_id=p_church_id and congregation_id=unit_id and deleted_at is null
      and financial_date<p_day and (p_box is null or cashbox_id=p_box)
    group by cashbox_id having sum(amount)<>0
  ), ledger as materialized (
    select id,cashbox_id,transaction_id,transfer_id,adjustment_id,entry_kind,amount,created_at
    from public.financial_ledger_entries where church_id=p_church_id and congregation_id=unit_id
      and financial_date=p_day and deleted_at is null and (p_box is null or cashbox_id=p_box)
  ), tx as materialized (
    select t.id,t.created_at,t.cashbox_id,t.transaction_type direction,t.amount*100 cents,t.category_id,
      coalesce(nullif(t.category_name,''),'Sem categoria') category,
      coalesce(nullif(t.person_name,''),nullif(t.beneficiary_name,''),nullif(t.description,''),
        case when t.contributor_kind='COLLECTIVE' then 'Contribuição coletiva' else 'Não informado' end) identity,
      t.description,coalesce(nullif(t.department_name,''),'Não informado') department,
      coalesce(m.name,'Não informado') method
    from public.financial_transactions t left join public.financial_payment_methods m
      on m.id=t.payment_method_id and m.church_id=t.church_id and m.deleted_at is null
    where t.church_id=p_church_id and t.congregation_id=unit_id and t.transaction_date=p_day
      and t.deleted_at is null and t.status='CONFIRMED' and (p_box is null or t.cashbox_id=p_box)
  ), transfers as (
    select t.id,t.created_at,leg.box,leg.label,leg.cents
    from public.financial_transfers t
    left join boxes src on src.id=t.source_cashbox_id left join boxes dst on dst.id=t.target_cashbox_id
    cross join lateral (values
      (t.source_cashbox_id,'Transferido para '||coalesce(dst.name,'Caixa de destino'),-100*t.amount),
      (t.target_cashbox_id,'Recebido de '||coalesce(src.name,'Caixa de origem'),100*t.amount)
    ) leg(box,label,cents)
    where t.church_id=p_church_id and t.congregation_id=unit_id and t.transaction_date=p_day
      and t.deleted_at is null and t.status='CONFIRMED' and (p_box is null or leg.box=p_box)
  ), other as materialized (
    select id,created_at,box,label,cents from transfers
    union all
    select l.id,l.created_at,l.cashbox_id,
      case when l.entry_kind='OPENING' then 'Abertura de caixa'
        else concat_ws(' · ','Ajuste de saldo',nullif(a.reason,'')) end,l.amount*100
    from ledger l left join public.financial_balance_adjustments a on a.id=l.adjustment_id
      and a.church_id=p_church_id and a.congregation_id=unit_id and a.deleted_at is null
    where l.entry_kind in ('OPENING','ADJUSTMENT')
  ), expected as (
    select id,cashbox_id, 'TRANSACTION' kind,case direction when 'INCOME' then cents else -cents end cents from tx
    union all select id,box,'TRANSFER',cents from transfers
  ), booked as (
    select coalesce(transaction_id,transfer_id) id,cashbox_id,
      case when transaction_id is not null then 'TRANSACTION' else 'TRANSFER' end kind,sum(amount)*100 cents
    from ledger where transaction_id is not null or transfer_id is not null
    group by 1,2,3 having sum(amount)<>0
  ), categories as (
    select cashbox_id,direction,category_id,min(category) category,count(*) qty,sum(cents) total,
      case when p_detail then jsonb_agg(jsonb_build_object('identity',identity,'description',description,
        'department',department,'method',method,'cents',cents) order by created_at,id) filter(where p_detail)
        else '[]'::jsonb end items
    from tx group by cashbox_id,direction,category_id
  ), box_categories as (
    select cashbox_id,jsonb_agg(jsonb_build_object('direction',direction,'name',category,'count',qty,
      'cents',total,'items',items) order by category,category_id,direction) categories,
      coalesce(sum(total) filter(where direction='INCOME'),0) income,
      coalesce(sum(total) filter(where direction='EXPENSE'),0) expense
    from categories group by cashbox_id
  ), box_other as (
    select box,jsonb_agg(jsonb_build_object('label',label,'cents',cents) order by created_at,id) movements,
      sum(cents) total from other group by box
  ), daily_net as (
    select cashbox_id,sum(amount)*100 total from ledger group by cashbox_id
  ), positions as (
    select b.id,b.name,b.bank,coalesce(p.cents,0) opening,coalesce(c.income,0) income,
      coalesce(c.expense,0) expense,coalesce(p.cents,0)+coalesce(n.total,0) closing,
      coalesce(o.total,0) other_total,coalesce(c.categories,'[]') categories,coalesce(o.movements,'[]') movements
    from boxes b left join previous p on p.cashbox_id=b.id left join daily_net n on n.cashbox_id=b.id
    left join box_categories c on c.cashbox_id=b.id left join box_other o on o.box=b.id
    where (p_box is null or b.id=p_box) and (p_box is not null or p.cents is not null
      or c.cashbox_id is not null or o.box is not null or n.total<>0)
  ), payments as (
    select method,coalesce(sum(cents) filter(where direction='INCOME'),0) income,
      coalesce(sum(cents) filter(where direction='EXPENSE'),0) expense from tx where p_payments group by method
  )
  select exists(select from expected full join booked using(id,cashbox_id,kind)
           where coalesce(expected.cents,0)<>coalesce(booked.cents,0))
      or exists(select from positions where closing<>opening+income-expense+other_total)
      or exists(select from (select cashbox_id from previous union select cashbox_id from tx
        union select box from other union select cashbox_id from daily_net where total<>0) used
        where not exists(select from boxes where id=used.cashbox_id)),
    jsonb_build_object('date',p_day,'box',p_box,'unitId',unit_id,'generatedAt',statement_timestamp(),
      'boxes',coalesce((select jsonb_agg(jsonb_build_object('id',id,'name',name,'bankDetails',bank,
        'opening',opening,'income',income,'expense',expense,'closing',closing,'categories',categories,
        'movements',movements) order by name,id) from positions),'[]'),
      'payments',coalesce((select jsonb_agg(to_jsonb(payments) order by method) from payments),'[]'))
    into mismatch,result;
  if mismatch then raise exception 'REPORT_RECONCILIATION_REQUIRED'; end if;
  return result;
end;
$$;
revoke all on function public.get_finance_daily_cash_flow_report(uuid,date,uuid,boolean,boolean) from public,anon;
grant execute on function public.get_finance_daily_cash_flow_report(uuid,date,uuid,boolean,boolean) to authenticated;
