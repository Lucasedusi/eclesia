begin;

insert into public.role_permissions(role,permission_id,status)
select 'ACCOUNTANT', id, 'ACTIVE' from public.permissions where key='finance.view' and deleted_at is null;

CREATE OR REPLACE FUNCTION public.get_my_permissions(p_church_id uuid)
 RETURNS TABLE(permission_key text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  with active_access as (
    select a.id, a.role
    from public.user_church_access a
    join public.profiles pr on pr.id = a.profile_id
    join public.churches ch on ch.id = a.church_id
    where a.profile_id = auth.uid() and a.church_id = p_church_id
      and a.status = 'ACTIVE' and a.deleted_at is null
      and pr.status = 'ACTIVE' and pr.deleted_at is null
      and ch.status = 'ACTIVE' and ch.deleted_at is null
  ), inherited as (
    select aa.id as access_id, p.id as permission_id, p.key
    from active_access aa
    join public.role_permissions rp on rp.role = aa.role and rp.status = 'ACTIVE' and rp.deleted_at is null
    join public.permissions p on p.id = rp.permission_id and p.status = 'ACTIVE' and p.deleted_at is null
    where (aa.role <> 'ACCOUNTANT' or p.key in ('finance.view','finance.accounting.export')) and not exists (
      select 1 from public.user_permission_overrides o
      where o.access_id = aa.id and o.permission_id = p.id
        and o.effect = 'DENY' and o.deleted_at is null
    )
  ), allowed as (
    select aa.id as access_id, p.id as permission_id, p.key
    from active_access aa
    join public.user_permission_overrides o on o.access_id = aa.id and o.effect = 'ALLOW' and o.deleted_at is null
    join public.permissions p on p.id = o.permission_id and p.status = 'ACTIVE' and p.deleted_at is null
    where aa.role <> 'ACCOUNTANT'
  )
  select distinct key from (select key from inherited union all select key from allowed) effective;
$function$;

CREATE OR REPLACE FUNCTION private.access_has_permission(p_access_id uuid, p_permission_key text)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select exists (
    select 1
    from public.user_church_access access
    join public.profiles profile on profile.id = access.profile_id
    join public.permissions permission on permission.key = p_permission_key
      and permission.status = 'ACTIVE' and permission.deleted_at is null
    where (access.role <> 'ACCOUNTANT' or (p_permission_key in ('finance.view','finance.accounting.export')
      and exists(select from public.congregations assigned where assigned.church_id=access.church_id
        and assigned.id=access.congregation_id and assigned.status='ACTIVE' and assigned.deleted_at is null)))
      and access.id = p_access_id
      and access.profile_id = (select auth.uid())
      and access.status = 'ACTIVE' and access.deleted_at is null
      and profile.status = 'ACTIVE' and profile.deleted_at is null
      and (
        exists (
          select 1
          from public.user_permission_overrides permission_override
          where access.role <> 'ACCOUNTANT' and permission_override.access_id = access.id
            and permission_override.permission_id = permission.id
            and permission_override.effect = 'ALLOW'
            and permission_override.deleted_at is null
        )
        or (
          exists (
            select 1
            from public.role_permissions role_permission
            where role_permission.role = access.role
              and role_permission.permission_id = permission.id
              and role_permission.status = 'ACTIVE'
              and role_permission.deleted_at is null
          )
          and not exists (
            select 1
            from public.user_permission_overrides permission_override
            where permission_override.access_id = access.id
              and permission_override.permission_id = permission.id
              and permission_override.effect = 'DENY'
              and permission_override.deleted_at is null
          )
        )
      )
  );
$function$;

create function private.accountant_reads(p_church uuid,p_unit uuid default null) returns boolean
language sql stable security definer set search_path='' as $$
 select exists(select from public.user_church_access a
   join public.churches ch on ch.id=a.church_id and ch.status='ACTIVE' and ch.deleted_at is null
   join public.congregations c on c.church_id=a.church_id and c.id=a.congregation_id and c.status='ACTIVE' and c.deleted_at is null
   where a.church_id=p_church and a.profile_id=(select auth.uid()) and a.role='ACCOUNTANT'
   and a.access_scope='CONGREGATION' and a.status='ACTIVE' and a.deleted_at is null
   and (p_unit is null or c.id=p_unit) and private.access_has_permission(a.id,'finance.view'));
$$;
create function private.can_read_finance_reports(p_church uuid) returns boolean
language sql stable security invoker set search_path='' as $$
 select private.can_manage_finance_reports(p_church) or private.accountant_reads(p_church);
$$;
revoke all on function private.accountant_reads(uuid,uuid),private.can_read_finance_reports(uuid) from public,anon,authenticated;
grant execute on function private.accountant_reads(uuid,uuid),private.can_read_finance_reports(uuid) to authenticated;

alter policy congregations_select_scope on public.congregations using (deleted_at is null and (
 ((select public.has_permission(church_id,'organization.view')) and (select public.can_access_congregation(church_id,id)))
 or private.accountant_reads(church_id,id)));
alter policy admin_read on public.finance_delivery_deadlines using (deleted_at is null and private.can_read_finance_reports(church_id));
alter policy admin_read on public.finance_delivery_events using (deleted_at is null and private.can_read_finance_reports(church_id)
 and private.can_access_finance_unit(church_id,congregation_id,'finance.view'));
alter policy admin_read on private.finance_delivery_transfer_events using (
 (private.can_manage_finance_reports(church_id) and private.can_access_finance_unit(church_id,payer_id,'finance.view')
 and private.can_access_finance_unit(church_id,headquarters_id,'finance.view')) or private.accountant_reads(church_id,payer_id));


CREATE OR REPLACE FUNCTION public.list_finance_deliveries(p_church_id uuid, p_month text, p_include_inactive boolean)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE
 SET search_path TO ''
AS $function$
declare m date; due date; rows jsonb; rules jsonb;
begin
 if not private.can_read_finance_reports(p_church_id) then raise exception 'FORBIDDEN' using errcode='42501'; end if;
 if coalesce(p_month,'') !~ '^20[0-9]{2}-(0[1-9]|1[0-2])$' then raise exception 'INVALID_INPUT' using errcode='22023';end if;
 m:=(p_month||'-01')::date;
 if p_include_inactive is null then raise exception 'INVALID_INPUT' using errcode='22023'; end if;
 due:=private.finance_delivery_due_date(p_church_id,m);
 select coalesce(jsonb_agg(jsonb_build_object('id',c.id,'name',c.name,'status',c.status,
 'deliveryDate',(d.delivered_at at time zone 'America/Sao_Paulo')::date,
 'revision',coalesce(ev.revision,0),'history',coalesce(ev.history,'[]'::jsonb)) order by c.name,c.id),'[]') into rows
 from public.congregations c
 left join lateral (select id,delivered_at from public.report_deliveries where church_id=p_church_id and congregation_id=c.id and reference_year=extract(year from m) and reference_month=extract(month from m) and deleted_at is null and status<>'CANCELLED' order by created_at,id limit 1) d on true
 left join lateral (select max(e.revision) revision,jsonb_agg(jsonb_build_object('action',e.action,'deliveryDate',e.delivery_date,'dueDate',e.due_date,'reason',e.reason,'revision',e.revision,'createdAt',e.created_at,'actor',coalesce(p.display_name,p.full_name,'Administrador')) order by e.revision desc) history
 from public.finance_delivery_events e left join public.profiles p on p.id=e.created_by
 where e.church_id=p_church_id and e.congregation_id=c.id and e.report_delivery_id=d.id and e.deleted_at is null) ev on true
 where c.church_id=p_church_id and c.deleted_at is null and not c.is_headquarters
 and (c.status='ACTIVE' or p_include_inactive) and private.can_access_finance_unit(p_church_id,c.id,'finance.view');
 select coalesce(jsonb_agg(jsonb_build_object('effectiveMonth',to_char(effective_month,'YYYY-MM'),'day',due_day,'revision',revision) order by effective_month desc,revision desc),'[]') into rules
 from public.finance_delivery_deadlines where church_id=p_church_id and deleted_at is null;
 return jsonb_build_object('month',p_month,'includeInactive',p_include_inactive,'dueDate',due,'today',(now() at time zone 'America/Sao_Paulo')::date,'rows',rows,'rules',rules,'generatedAt',statement_timestamp());
end $function$;

CREATE OR REPLACE FUNCTION public.get_finance_daily_cash_flow(p_church_id uuid, p_filters jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE
 SET search_path TO ''
AS $function$
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
  if not private.can_read_finance_reports(p_church_id) then
    raise exception 'FORBIDDEN' using errcode='42501';
  end if;
  select array_agg(id) into headquarters from public.congregations
  where church_id=p_church_id and is_headquarters and status='ACTIVE' and deleted_at is null;
  if private.accountant_reads(p_church_id) and coalesce(cardinality(headquarters),0)=0 then raise insufficient_privilege; end if;
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
$function$;

CREATE OR REPLACE FUNCTION public.get_finance_daily_report_for_boxes(p_church_id uuid, p_day date, p_boxes uuid[] DEFAULT NULL::uuid[], p_detail boolean DEFAULT false, p_payments boolean DEFAULT false)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE
 SET search_path TO ''
AS $function$
declare
  headquarters uuid[];
  unit_id uuid;
  result jsonb;
  mismatch boolean;
begin
  if auth.uid() is null or not private.can_read_finance_reports(p_church_id) then
    raise exception 'FORBIDDEN' using errcode='42501';
  end if;
  select array_agg(id) into headquarters from public.congregations
    where church_id=p_church_id and is_headquarters and status='ACTIVE' and deleted_at is null;
  if private.accountant_reads(p_church_id) and coalesce(cardinality(headquarters),0)=0 then raise insufficient_privilege; end if;
  if cardinality(headquarters) is distinct from 1 then raise exception 'REPORT_CONFIGURATION_REQUIRED'; end if;
  unit_id := headquarters[1];
  if not private.can_access_finance_unit(p_church_id,unit_id,'finance.view') then
    raise exception 'FORBIDDEN' using errcode='42501';
  end if;
  if p_day is null or p_day not between date '2000-01-01' and date '2099-12-31'
     or p_detail is null or p_payments is null then raise exception 'INVALID_INPUT' using errcode='22023'; end if;
  if p_boxes is not null and (cardinality(p_boxes)=0 or cardinality(p_boxes) <>
      (select count(distinct id) from unnest(p_boxes) id)) then
    raise exception 'INVALID_INPUT' using errcode='22023';
  end if;
  if p_boxes is not null and cardinality(p_boxes) <> (select count(*) from public.financial_cashboxes
      where id=any(p_boxes) and church_id=p_church_id and congregation_id=unit_id and deleted_at is null) then
    raise exception 'FORBIDDEN' using errcode='42501';
  end if;

  with boxes as materialized (
    select id,name,case when cashbox_type='BANK_ACCOUNT' then jsonb_build_object(
      'bankName',bank_name,'agency',agency,'accountNumber',account_number) end bank
    from public.financial_cashboxes where church_id=p_church_id and congregation_id=unit_id and deleted_at is null
  ), previous as (
    select cashbox_id,sum(amount)*100 cents from public.financial_ledger_entries
    where church_id=p_church_id and congregation_id=unit_id and deleted_at is null
      and financial_date<p_day and (p_boxes is null or cashbox_id=any(p_boxes))
    group by cashbox_id having sum(amount)<>0
  ), ledger as materialized (
    select id,cashbox_id,transaction_id,transfer_id,adjustment_id,entry_kind,amount,created_at
    from public.financial_ledger_entries where church_id=p_church_id and congregation_id=unit_id
      and financial_date=p_day and deleted_at is null and (p_boxes is null or cashbox_id=any(p_boxes))
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
      and t.deleted_at is null and t.status='CONFIRMED' and (p_boxes is null or t.cashbox_id=any(p_boxes))
  ), transfers as (
    select t.id,t.created_at,leg.box,leg.label,leg.cents
    from public.financial_transfers t
    left join boxes src on src.id=t.source_cashbox_id left join boxes dst on dst.id=t.target_cashbox_id
    cross join lateral (values
      (t.source_cashbox_id,'Transferido para '||coalesce(dst.name,'Caixa de destino'),-100*t.amount),
      (t.target_cashbox_id,'Recebido de '||coalesce(src.name,'Caixa de origem'),100*t.amount)
    ) leg(box,label,cents)
    where t.church_id=p_church_id and t.congregation_id=unit_id and t.transaction_date=p_day
      and t.deleted_at is null and t.status='CONFIRMED' and (p_boxes is null or leg.box=any(p_boxes))
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
    where (p_boxes is null or b.id=any(p_boxes)) and (p_boxes is not null or p.cents is not null
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
    jsonb_build_object('date',p_day,'box',case when cardinality(p_boxes)=1 then p_boxes[1] end,'unitId',unit_id,'generatedAt',statement_timestamp(),
      'boxes',coalesce((select jsonb_agg(jsonb_build_object('id',id,'name',name,'bankDetails',bank,
        'opening',opening,'income',income,'expense',expense,'closing',closing,'categories',categories,
        'movements',movements) order by name,id) from positions),'[]'),
      'payments',coalesce((select jsonb_agg(to_jsonb(payments) order by method) from payments),'[]'))
    into mismatch,result;
  if mismatch then raise exception 'REPORT_RECONCILIATION_REQUIRED'; end if;
  return result;
end;
$function$;

CREATE OR REPLACE FUNCTION public.get_finance_informative_report(p_church_id uuid, p_unit uuid, p_options jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE
 SET search_path TO ''
AS $function$
declare
  first_month date; last_month date; current_month date;
  report jsonb; recorded jsonb; transfer_cents numeric; prebend_cents numeric; receipts jsonb:='[]';
  months jsonb := '[]'::jsonb; include_prebend boolean; include_transfer boolean;
begin
  if auth.uid() is null or not private.can_read_finance_reports(p_church_id)
    or not private.can_access_finance_unit(p_church_id,p_unit,'finance.view') then
    raise exception 'FORBIDDEN' using errcode='42501';
  end if;
  if p_options is null or jsonb_typeof(p_options) <> 'object'
    or p_options->>'type' is distinct from 'INFORMATIVE'
    or coalesce(p_options->>'startMonth','') !~ '^20[0-9]{2}-(0[1-9]|1[0-2])$'
    or coalesce(p_options->>'endMonth','') !~ '^20[0-9]{2}-(0[1-9]|1[0-2])$'
    or jsonb_typeof(p_options->'includePrebend') is distinct from 'boolean'
    or jsonb_typeof(p_options->'includeTransfer') is distinct from 'boolean'
    or exists(select 1 from jsonb_object_keys(p_options) k where k not in ('type','startMonth','endMonth','includePrebend','includeTransfer')) then
    raise exception 'INVALID_INPUT' using errcode='22023';
  end if;
  first_month := ((p_options->>'startMonth')||'-01')::date;
  last_month := ((p_options->>'endMonth')||'-01')::date;
  if last_month < first_month or last_month >= first_month + interval '60 months' then
    raise exception 'INVALID_INPUT' using errcode='22023';
  end if;
  include_prebend := (p_options->>'includePrebend')::boolean;
  include_transfer := (p_options->>'includeTransfer')::boolean;
  perform private.finance_informative_configuration(p_church_id,include_prebend,include_transfer);
  if include_transfer then
    select coalesce(jsonb_agg(to_jsonb(r)),'[]') into receipts
      from private.finance_informative_receipts(p_church_id,first_month,(last_month+interval '1 month')::date) r
      where r.congregation_id=p_unit;
  end if;
  current_month := first_month;
  while current_month <= last_month loop
    report := public.get_finance_report(p_church_id,p_unit,jsonb_build_object('type','SYNTHETIC','month',to_char(current_month,'YYYY-MM')));
    prebend_cents:=null; transfer_cents:=null;
    if include_prebend then
      select coalesce(sum(t.amount)*100,0) into prebend_cents
      from public.financial_transactions t
      join public.financial_categories cat on cat.church_id=t.church_id and cat.id=t.category_id and cat.deleted_at is null and cat.informative_role='PREBEND'
      where t.church_id=p_church_id and t.congregation_id=p_unit and t.deleted_at is null and t.status='CONFIRMED'
        and t.transaction_type='EXPENSE' and t.transaction_date>=current_month and t.transaction_date<current_month+interval '1 month';
    end if;
    if include_transfer then
      select coalesce(sum((r->>'amount_cents')::numeric),0) into transfer_cents from jsonb_array_elements(receipts) r where (r->>'month')::date=current_month;
    end if;
    recorded:=jsonb_build_object('grossPrebendCents',prebend_cents,'transferCents',transfer_cents);
    months:=months||jsonb_build_array(jsonb_build_object('month',to_char(current_month,'YYYY-MM'),'summary',report->'summary','recorded',recorded));
    current_month := (current_month + interval '1 month')::date;
  end loop;
  return p_options || jsonb_build_object('source','TRANSACTIONS','generatedAt',statement_timestamp(),'months',months);
end;
$function$;

CREATE OR REPLACE FUNCTION public.get_finance_ranking_report(p_church_id uuid, p_options jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE
 SET search_path TO ''
AS $function$
declare u record; result jsonb:='[]'; first_month date; last_month date; n integer; opts jsonb; review jsonb;
begin
 if not private.can_read_finance_reports(p_church_id) then raise exception 'FORBIDDEN' using errcode='42501'; end if;
 if p_options is null or jsonb_typeof(p_options)<>'object' or p_options->>'type' is distinct from 'RANKING'
 or jsonb_typeof(p_options->'includeInactive') is distinct from 'boolean' then raise exception 'INVALID_INPUT' using errcode='22023'; end if;
 opts:=(p_options-'includeInactive')||'{"type":"INFORMATIVE"}';
 if coalesce(opts->>'startMonth','') !~ '^20[0-9]{2}-(0[1-9]|1[0-2])$' or coalesce(opts->>'endMonth','') !~ '^20[0-9]{2}-(0[1-9]|1[0-2])$' then raise exception 'INVALID_INPUT' using errcode='22023';end if;
 first_month:=((opts->>'startMonth')||'-01')::date;last_month:=((opts->>'endMonth')||'-01')::date;
 if last_month<first_month or last_month>=first_month+interval '60 months'
 or jsonb_typeof(opts->'includePrebend') is distinct from 'boolean'
 or jsonb_typeof(opts->'includeTransfer') is distinct from 'boolean'
 or exists(select 1 from jsonb_object_keys(opts) k where k not in ('type','startMonth','endMonth','includePrebend','includeTransfer'))
 then raise exception 'INVALID_INPUT' using errcode='22023'; end if;
 perform private.finance_informative_configuration(p_church_id,(opts->>'includePrebend')::boolean,(opts->>'includeTransfer')::boolean);
 select count(*) into n from public.congregations where church_id=p_church_id and deleted_at is null
 and (status='ACTIVE' or (p_options->>'includeInactive')::boolean) and private.can_access_finance_unit(p_church_id,id,'finance.view');
 -- Never silently truncate units or months; bound the work for a single synchronous PDF.
 if n*((extract(year from age(last_month,first_month))*12)+extract(month from age(last_month,first_month))+1)>3000 then raise exception 'REPORT_TOO_LARGE'; end if;
 for u in select id,name,status,is_headquarters from public.congregations where church_id=p_church_id and deleted_at is null
 and (status='ACTIVE' or (p_options->>'includeInactive')::boolean) and private.can_access_finance_unit(p_church_id,id,'finance.view') order by name,id loop
 result:=result||jsonb_build_array(jsonb_build_object('id',u.id,'name',u.name,'status',u.status,'isHeadquarters',u.is_headquarters,
 'report',public.get_finance_informative_report(p_church_id,u.id,opts)));
 end loop;
 if (opts->>'includeTransfer')::boolean then
   select jsonb_build_object('receivedCents',coalesce(sum(r.amount_cents),0),
     'unidentifiedCents',coalesce(sum(r.amount_cents) filter(where r.congregation_id is null),0),
     'outsideReportCents',coalesce(sum(r.amount_cents) filter(where r.congregation_id is not null and not exists(select 1 from jsonb_array_elements(result) unit where (unit->>'id')::uuid=r.congregation_id)),0))
   into review from private.finance_informative_receipts(p_church_id,first_month,(last_month+interval '1 month')::date) r;
 end if;
 return p_options||jsonb_build_object('source','TRANSACTIONS','generatedAt',statement_timestamp(),'units',result,'transferReview',review);
end $function$;

CREATE OR REPLACE FUNCTION private.finance_informative_configuration(p_church uuid, p_prebend boolean, p_transfer boolean)
 RETURNS uuid
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare headquarters uuid; n integer;
begin
  if not private.can_read_finance_reports(p_church) then raise exception 'FORBIDDEN' using errcode='42501'; end if;
  if (p_prebend and not exists(select 1 from public.financial_categories where church_id=p_church and deleted_at is null and informative_role='PREBEND'))
    or (p_transfer and not exists(select 1 from public.financial_categories where church_id=p_church and deleted_at is null and informative_role='TRANSFER')) then
    raise exception 'REPORT_CONFIGURATION_REQUIRED';
  end if;
  if p_transfer then
    select count(*) into n from public.congregations where church_id=p_church and deleted_at is null and is_headquarters;
    if n<>1 then raise exception 'REPORT_CONFIGURATION_REQUIRED'; end if;
    select id into headquarters from public.congregations where church_id=p_church and deleted_at is null and is_headquarters;
    if not private.accountant_reads(p_church) and not private.can_access_finance_unit(p_church,headquarters,'finance.view') then raise exception 'FORBIDDEN' using errcode='42501'; end if;
  end if;
  return headquarters;
end $function$;

CREATE OR REPLACE FUNCTION private.finance_informative_receipts(p_church uuid, p_start date, p_end date)
 RETURNS TABLE(month date, congregation_id uuid, amount_cents numeric)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare headquarters uuid;
begin
  headquarters:=private.finance_informative_configuration(p_church,false,true);
  if p_start is null or p_end is null or p_end<=p_start or p_end>p_start+interval '60 months' then raise exception 'INVALID_INPUT' using errcode='22023'; end if;
  return query
    select date_trunc('month',t.transaction_date)::date, payer.id, sum(t.amount)*100
    from public.financial_transactions t
    join public.financial_categories cat on cat.church_id=t.church_id and cat.id=t.category_id and cat.deleted_at is null and cat.informative_role='TRANSFER'
    left join public.congregations payer on payer.church_id=t.church_id and payer.id=t.contributor_congregation_id and payer.deleted_at is null and payer.id<>headquarters
    where t.church_id=p_church and t.congregation_id=headquarters and t.deleted_at is null and t.status='CONFIRMED'
      and t.transaction_type='INCOME' and t.transaction_date>=p_start and t.transaction_date<p_end
    and (private.can_manage_finance_reports(p_church) or (payer.id is not null and private.accountant_reads(p_church,payer.id)))
    group by 1,2;
end $function$;

CREATE OR REPLACE FUNCTION private.readable_payables_headquarters(p_church uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare ids uuid[];
begin
 if not private.can_manage_payables(p_church) and not exists (
   select from public.congregations c where c.church_id=p_church and c.is_headquarters and private.accountant_reads(p_church,c.id)
 ) then raise exception 'FORBIDDEN' using errcode='42501'; end if;
 select array_agg(id) into ids from public.congregations where church_id=p_church and is_headquarters and status='ACTIVE' and deleted_at is null;
 if coalesce(cardinality(ids),0)<>1 then raise exception 'CONFIGURATION_REQUIRED'; end if;
 return ids[1];
end $function$;

revoke all on function private.readable_payables_headquarters(uuid) from public,anon,authenticated;

CREATE OR REPLACE FUNCTION public.query_finance_payables(p_church_id uuid, p_options jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare unit uuid; first_day date; last_day date; current_day date:=(now() at time zone 'America/Sao_Paulo')::date;
 due_status text:=coalesce(p_options->>'dueStatus','ALL');
 st text:=coalesce(p_options->>'status','PENDING'); needle text:=btrim(coalesce(p_options->>'search','')); cat uuid; pg integer:=coalesce((p_options->>'page')::int,1);
 result jsonb; total bigint; pending_total bigint; paid_total bigint;
begin
 unit:=private.readable_payables_headquarters(p_church_id);
 if jsonb_typeof(p_options)<>'object' or p_options - array['month','status','search','categoryId','dateFrom','dateTo','page','dueStatus'] <> '{}'::jsonb
 or due_status not in ('ALL','OVERDUE','TODAY','UPCOMING')
 or coalesce(p_options->>'month','')!~'^20[0-9]{2}-(0[1-9]|1[0-2])$' or st not in ('PENDING','PAID','ALL') or pg<1 or pg>100000 or length(needle)>120 then raise exception 'INVALID_INPUT'; end if;
 first_day:=(p_options->>'month'||'-01')::date; last_day:=(first_day+interval '1 month - 1 day')::date;
 if p_options ? 'dateFrom' or p_options ? 'dateTo' then
 if coalesce(p_options->>'dateFrom','')!~'^20[0-9]{2}-[0-9]{2}-[0-9]{2}$' or coalesce(p_options->>'dateTo','')!~'^20[0-9]{2}-[0-9]{2}-[0-9]{2}$' then raise exception 'INVALID_INPUT'; end if;
 first_day:=(p_options->>'dateFrom')::date; last_day:=(p_options->>'dateTo')::date;
 end if;
 if first_day>last_day then raise exception 'INVALID_INPUT'; end if;
 cat:=(p_options->>'categoryId')::uuid;
 select count(*) filter(where status='PENDING'),count(*) filter(where status='PAID'),
 count(*) filter(where (st='ALL' or status=st) and (st<>'PENDING' or due_status='ALL' or (due_status='OVERDUE' and due_date<current_day) or (due_status='TODAY' and due_date=current_day) or (due_status='UPCOMING' and due_date>current_day))) into pending_total,paid_total,total
 from public.accounts_payable where church_id=p_church_id and congregation_id=unit and is_checklist and deleted_at is null
 and due_date between first_day and last_day and (cat is null or category_id=cat) and strpos(lower(description),lower(needle))>0;
 pg:=least(pg,greatest(1,ceil(total/20.0)::int));
 select jsonb_build_object('churchId',p_church_id,'headquartersId',unit,'headquartersName',(select name from public.congregations where id=unit and church_id=p_church_id),
 'today',current_day,'start',first_day,'end',last_day,'page',pg,'count',total,'pendingCount',pending_total,'paidCount',paid_total,
 'items',coalesce((select jsonb_agg(private.payable_json(a) order by a.due_date,a.id) from (
 select a.* from public.accounts_payable a where church_id=p_church_id and congregation_id=unit and is_checklist and deleted_at is null
 and due_date between first_day and last_day and (st='ALL' or status=st) and (st<>'PENDING' or due_status='ALL' or (due_status='OVERDUE' and due_date<current_day) or (due_status='TODAY' and due_date=current_day) or (due_status='UPCOMING' and due_date>current_day)) and (cat is null or category_id=cat)
 and strpos(lower(description),lower(needle))>0 order by due_date,id limit 20 offset (pg-1)*20) a),'[]'::jsonb),
 'previousOverdue',(select jsonb_build_object('count',count(*),'firstDate',min(due_date),'lastDate',max(due_date)) from public.accounts_payable
 where church_id=p_church_id and congregation_id=unit and is_checklist and deleted_at is null and status='PENDING' and due_date<first_day and due_date<current_day),
 'summary',(select jsonb_build_object('overdue',count(*) filter(where due_date<current_day),'today',count(*) filter(where due_date=current_day),
 'upcoming',count(*) filter(where due_date>current_day and due_date<=current_day+7)) from public.accounts_payable
 where church_id=p_church_id and congregation_id=unit and is_checklist and deleted_at is null and status='PENDING')) into result;
 return result;
exception when invalid_text_representation or datetime_field_overflow or invalid_datetime_format or numeric_value_out_of_range then raise exception 'INVALID_INPUT';
end $function$;

CREATE OR REPLACE FUNCTION public.get_finance_payable(p_church_id uuid, p_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare unit uuid; a public.accounts_payable;
begin
 unit:=private.readable_payables_headquarters(p_church_id);
 select * into a from public.accounts_payable where church_id=p_church_id and congregation_id=unit and id=p_id and is_checklist;
 if not found then raise exception 'FORBIDDEN' using errcode='42501'; end if;
 return jsonb_build_object('item',private.payable_json(a),'history',coalesce((select jsonb_agg(jsonb_build_object('id',e.id,'action',e.action,'at',e.occurred_at,
 'actorName',e.actor_name,'reason',e.reason,'before',e.before_values,'after',e.after_values) order by e.occurred_at,e.id)
 from private.finance_payable_events e where e.church_id=p_church_id and e.payable_id=p_id),'[]'::jsonb));
end $function$;

CREATE OR REPLACE FUNCTION private.confirm_accounting_import(p_church uuid, p_batch uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
 if exists(select from public.user_church_access a where a.profile_id=(select auth.uid()) and a.church_id=p_church and a.role='ACCOUNTANT' and a.status='ACTIVE' and a.deleted_at is null) then raise insufficient_privilege; end if;
 update private.finance_accounting_batches set confirmed_at=coalesce(confirmed_at,now()),confirmed_by=coalesce(confirmed_by,auth.uid())
 where church_id=p_church and id=p_batch and congregation_id in(select id from private.accounting_units(p_church));
 if not found then raise insufficient_privilege; end if;
end $function$;

-- One invitation carries the entire approved scope. Existing single-unit invitations remain valid.
alter table public.church_invitations add constraint church_invitations_church_id_id_key unique(church_id,id);
create table public.accountant_invitation_units (
 church_id uuid not null, invitation_id uuid not null, congregation_id uuid not null,
 id bigint generated always as identity primary key,
 unique(church_id,invitation_id,congregation_id),
 foreign key(church_id,invitation_id) references public.church_invitations(church_id,id) on delete cascade,
 foreign key(church_id,congregation_id) references public.congregations(church_id,id)
);
create index accountant_invitation_unit_congregation on public.accountant_invitation_units(church_id,congregation_id);
alter table public.accountant_invitation_units enable row level security;
revoke all on public.accountant_invitation_units from public,anon,authenticated;
grant select on public.accountant_invitation_units to authenticated;
create policy users_read on public.accountant_invitation_units for select to authenticated
using ((select public.has_permission(church_id,'users.view')));

create function private.validate_accountant_units(p_church uuid,p_units uuid[]) returns void
language plpgsql stable security invoker set search_path='' as $$
begin
 if coalesce(cardinality(p_units),0)=0 or cardinality(p_units)<>(select count(*) from public.congregations c
    where c.church_id=p_church and c.id=any(p_units) and c.status='ACTIVE' and c.deleted_at is null)
 then raise exception 'Selecione congregações ativas desta igreja.' using errcode='22023'; end if;
end $$;
revoke all on function private.validate_accountant_units(uuid,uuid[]) from public,anon,authenticated;

create function private.invite_finance_accountant(p_church uuid,p_name text,p_email text,p_units uuid[],p_notes text) returns text
language plpgsql security definer set search_path='' as $$
declare token text; invitation uuid;
begin
 if not public.has_permission(p_church,'users.invite') then raise insufficient_privilege; end if;
 perform private.validate_accountant_units(p_church,p_units);
 if exists(select from unnest(p_units) u where not public.can_access_congregation(p_church,u))
 then raise insufficient_privilege; end if;
 token:=public.create_church_invitation(p_church,p_name,p_email,'ACCOUNTANT','CONGREGATION',null,p_units[1],null,p_notes);
 select id into strict invitation from public.church_invitations where church_id=p_church and token_hash=encode(extensions.digest(token,'sha256'),'hex');
 insert into public.accountant_invitation_units(church_id,invitation_id,congregation_id) select p_church,invitation,u from unnest(p_units) u;
 return token;
end $$;
create function public.invite_finance_accountant(p_church uuid,p_name text,p_email text,p_units uuid[],p_notes text) returns text
language sql security invoker set search_path='' as $$ select private.invite_finance_accountant(p_church,p_name,p_email,p_units,p_notes) $$;

create function private.accept_accountant_units() returns trigger
language plpgsql security definer set search_path='' as $$
declare units uuid[];
begin
 if new.accepted_by is distinct from (select auth.uid()) or not exists(
  select from public.user_church_access a where a.church_id=new.church_id and a.id=new.access_id and a.profile_id=new.accepted_by
    and a.role='ACCOUNTANT' and a.congregation_id=new.congregation_id and a.status='ACTIVE' and a.deleted_at is null
 ) then raise insufficient_privilege; end if;
 select array_agg(congregation_id) into units from public.accountant_invitation_units
 where church_id=new.church_id and invitation_id=new.id;
 perform private.validate_accountant_units(new.church_id,coalesce(units,array[new.congregation_id]));
 insert into public.user_church_access(church_id,profile_id,role,access_scope,congregation_id,status,invited_by,invited_at,accepted_at,notes)
 select new.church_id,new.accepted_by,'ACCOUNTANT','CONGREGATION',u,'ACTIVE',new.invited_by,new.invited_at,new.accepted_at,new.notes
 from unnest(units) u where u<>new.congregation_id and not exists(
   select from public.user_church_access a where a.church_id=new.church_id and a.profile_id=new.accepted_by and a.congregation_id=u
   and a.role='ACCOUNTANT' and a.status='ACTIVE' and a.deleted_at is null);
 return new;
end $$;
revoke all on function private.accept_accountant_units() from public,anon,authenticated;
create trigger accept_accountant_units after update of status on public.church_invitations for each row
 when (old.status='PENDING' and new.status='ACCEPTED' and new.role='ACCOUNTANT') execute function private.accept_accountant_units();

create function private.update_accountant_scope(p_church uuid,p_access uuid,p_expected uuid[],p_units uuid[],
 p_role text,p_scope text,p_target uuid,p_status text,p_notes text) returns void
language plpgsql security definer set search_path='' as $$
declare a public.user_church_access; current_ids uuid[]; keeper uuid; u uuid; member_id uuid; retained uuid[]:=array[]::uuid[];
begin
 if not public.has_permission(p_church,'users.update_access') then raise insufficient_privilege; end if;
 select * into strict a from public.user_church_access where church_id=p_church and id=p_access and deleted_at is null;
 perform 1 from public.profiles where id=a.profile_id for update;
 select * into strict a from public.user_church_access where church_id=p_church and id=p_access and deleted_at is null for update;
 if p_role<>'ACCOUNTANT' and a.role<>'ACCOUNTANT' then raise insufficient_privilege; end if;
 select array_agg(id order by id) into current_ids from public.user_church_access
 where church_id=p_church and profile_id=a.profile_id and deleted_at is null and (id=a.id or (a.role='ACCOUNTANT' and role=a.role and status=a.status));
 if current_ids is distinct from (select array_agg(x order by x) from unnest(p_expected) x) then raise exception 'CONFLICT'; end if;
 if exists(select from public.user_church_access r where r.church_id=p_church and r.id=any(current_ids)
     and r.role='ACCOUNTANT' and not public.can_access_congregation(p_church,r.congregation_id))
 then raise insufficient_privilege; end if;
 if p_role='ACCOUNTANT' then
   if exists(select from unnest(p_units) u_id where not public.can_access_congregation(p_church,u_id))
   then raise insufficient_privilege; end if;
   perform private.validate_accountant_units(p_church,p_units);
   select coalesce(array_agg(id),'{}') into retained from public.user_church_access
    where church_id=p_church and id=any(current_ids) and congregation_id=any(p_units);
 end if;
 keeper:=case when a.id=any(retained) or cardinality(retained)=0 then a.id else retained[1] end;
 update public.user_church_access set status='INACTIVE',deleted_at=now() where church_id=p_church and id=any(current_ids) and id<>keeper and not(id=any(retained));
 if p_role='ACCOUNTANT' then
   select congregation_id into u from public.user_church_access where church_id=p_church and id=keeper;
   if u is null or not(u=any(p_units)) then u:=p_units[1]; end if;
   perform public.update_church_access(keeper,'ACCOUNTANT','CONGREGATION',p_status,null,u,null,p_notes);
   foreach u in array p_units loop
     select id into member_id from public.user_church_access where church_id=p_church and id=any(current_ids) and congregation_id=u and deleted_at is null;
     if member_id is null then
       insert into public.user_church_access(church_id,profile_id,role,access_scope,congregation_id,status,accepted_at,invited_by,notes)
       values(p_church,a.profile_id,'ACCOUNTANT','CONGREGATION',u,p_status,now(),auth.uid(),p_notes);
     elsif member_id<>keeper then
       perform public.update_church_access(member_id,'ACCOUNTANT','CONGREGATION',p_status,null,u,null,p_notes);
     end if;
   end loop;
 else
   perform public.update_church_access(keeper,p_role,p_scope,p_status,case when p_scope='REGION' then p_target end,
     case when p_scope='CONGREGATION' then p_target end,case when p_scope='MINISTRY' then p_target end,p_notes);
 end if;
 perform public.log_audit(p_church,'users','ACCOUNTANT_SCOPE_UPDATED','user_church_access',keeper,null,
 'Congregações do acesso financeiro atualizadas.',null,jsonb_build_object('units',p_units,'status',p_status),null,'INFO');
end $$;
create function public.update_accountant_scope(p_church uuid,p_access uuid,p_expected uuid[],p_units uuid[],
 p_role text,p_scope text,p_target uuid,p_status text,p_notes text) returns void
language sql security invoker set search_path='' as $$
 select private.update_accountant_scope(p_church,p_access,p_expected,p_units,p_role,p_scope,p_target,p_status,p_notes)
$$;
revoke all on function public.invite_finance_accountant(uuid,text,text,uuid[],text),private.invite_finance_accountant(uuid,text,text,uuid[],text),
public.update_accountant_scope(uuid,uuid,uuid[],uuid[],text,text,uuid,text,text),private.update_accountant_scope(uuid,uuid,uuid[],uuid[],text,text,uuid,text,text) from public,anon,authenticated;
grant execute on function public.invite_finance_accountant(uuid,text,text,uuid[],text),private.invite_finance_accountant(uuid,text,text,uuid[],text),
public.update_accountant_scope(uuid,uuid,uuid[],uuid[],text,text,uuid,text,text),private.update_accountant_scope(uuid,uuid,uuid[],uuid[],text,text,uuid,text,text) to authenticated;
commit;
