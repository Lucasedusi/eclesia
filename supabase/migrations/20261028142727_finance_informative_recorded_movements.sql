-- Explicit category mapping; no inference from labels and no changes to transactions.
alter table public.financial_categories
  add column informative_role text not null default 'NONE',
  add constraint financial_categories_informative_role_check check (
    informative_role = 'NONE' or
    (not is_tithe and (
      (informative_role = 'TRANSFER' and category_type in ('INCOME','BOTH')) or
      (informative_role = 'PREBEND' and category_type in ('EXPENSE','BOTH'))
    ))
  );
comment on column public.financial_categories.informative_role is
  'Explicit classification for recorded informative reports. Applies to historical confirmed entries; independent of category name and active status.';
create index financial_transactions_informative_period
  on public.financial_transactions(church_id,congregation_id,transaction_date,category_id)
  where deleted_at is null and status='CONFIRMED';

-- RPC serializes settings with financial commands using one church advisory lock.
create or replace function public.save_finance_catalog(p_church_id uuid,p_payload jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare
 unit uuid:=(p_payload->>'congregationId')::uuid; ident uuid:=(p_payload->>'id')::uuid;
 entity text:=p_payload->>'entity'; label text:=trim(p_payload->>'name'); state text:=coalesce(p_payload->>'status','ACTIVE');
 tab text; old_record jsonb; effective date; rev integer; box public.financial_cashboxes; m record;
 opening numeric; method_ids uuid[]; v_reason text:=trim(p_payload->>'reason');
begin
 if not private.can_access_finance_unit(p_church_id,unit,'finance.settings.manage') then raise exception 'FORBIDDEN' using errcode='42501'; end if;
 perform pg_advisory_xact_lock(hashtextextended(p_church_id::text,0));
 if label is null or length(label) not between 1 and 120 or state not in ('ACTIVE','INACTIVE') then raise exception 'INVALID_INPUT' using errcode='22023'; end if;
 tab:=case entity when 'DEPARTMENT' then 'financial_departments' when 'CATEGORY' then 'financial_categories' when 'CLASSIFICATION' then 'financial_tithe_classifications' when 'PAYMENT_METHOD' then 'financial_payment_methods' when 'CASHBOX' then 'financial_cashboxes' end;
 if tab is null then raise exception 'INVALID_INPUT' using errcode='22023'; end if;
 if ident is not null then
  execute format('select to_jsonb(t) from public.%I t where church_id=$1 and id=$2 and deleted_at is null for update',tab) into old_record using p_church_id,ident;
  if old_record is null then raise exception 'FORBIDDEN' using errcode='42501'; end if;
  if entity='CASHBOX' and (old_record->>'congregation_id')::uuid is distinct from unit then raise exception 'FORBIDDEN' using errcode='42501'; end if;
  if entity='DEPARTMENT' and old_record->>'congregation_id' is not null then raise exception 'LEGACY_DATA_REQUIRES_REVIEW'; end if;
 else ident:=gen_random_uuid(); end if;
 if entity='DEPARTMENT' then
  if coalesce(p_payload->>'effectiveMonth','') !~ '^20[0-9]{2}-(0[1-9]|1[0-2])$' or jsonb_typeof(p_payload->'participatesInBase') is distinct from 'boolean' then raise exception 'INVALID_INPUT' using errcode='22023'; end if;
  effective:=(p_payload->>'effectiveMonth'||'-01')::date;
  if effective<date_trunc('month',now() at time zone 'America/Sao_Paulo')::date and coalesce(length(v_reason),0)<5 then raise exception 'INVALID_INPUT' using errcode='22023'; end if;
  insert into public.financial_departments(id,church_id,name,status,created_by) values(ident,p_church_id,label,state,auth.uid())
  on conflict(id) do update set name=excluded.name,status=excluded.status,updated_at=now();
  select coalesce(max(revision),0)+1 into rev from public.financial_department_base_versions where church_id=p_church_id and department_id=ident and effective_month=effective;
  insert into public.financial_department_base_versions(church_id,department_id,effective_month,revision,participates_in_base,reason,created_by)
  values(p_church_id,ident,effective,rev,(p_payload->>'participatesInBase')::boolean,v_reason,auth.uid());
 elsif entity='CATEGORY' then
  if coalesce(p_payload->>'informativeRole',old_record->>'informative_role','NONE') not in ('NONE','TRANSFER','PREBEND') then raise exception 'INVALID_INPUT' using errcode='22023'; end if;
  if coalesce(p_payload->>'direction','') not in ('INCOME','EXPENSE','BOTH') or (coalesce((p_payload->>'isTithe')::boolean,false) and p_payload->>'direction'<>'INCOME') then raise exception 'INVALID_INPUT' using errcode='22023'; end if;
  if p_payload->>'departmentId' is not null and not exists(select 1 from public.financial_departments where church_id=p_church_id and id=(p_payload->>'departmentId')::uuid and congregation_id is null and status='ACTIVE' and deleted_at is null) then raise exception 'INACTIVE_REFERENCE'; end if;
  insert into public.financial_categories(id,church_id,name,status,category_type,department_id,is_tithe,is_offering,requires_member,informative_role,created_by)
  values(ident,p_church_id,label,state,p_payload->>'direction',(p_payload->>'departmentId')::uuid,coalesce((p_payload->>'isTithe')::boolean,false),coalesce((p_payload->>'isOffering')::boolean,false),coalesce((p_payload->>'requiresPerson')::boolean,false),coalesce(p_payload->>'informativeRole',old_record->>'informative_role','NONE'),auth.uid())
  on conflict(id) do update set name=excluded.name,status=excluded.status,category_type=excluded.category_type,department_id=excluded.department_id,is_tithe=excluded.is_tithe,is_offering=excluded.is_offering,requires_member=excluded.requires_member,informative_role=excluded.informative_role,updated_at=now();
 elsif entity='CLASSIFICATION' then
  if p_payload->>'roleId' is not null and not exists(select 1 from public.roles where church_id=p_church_id and id=(p_payload->>'roleId')::uuid and deleted_at is null and status='ACTIVE') then raise exception 'INACTIVE_REFERENCE'; end if;
  insert into public.financial_tithe_classifications(id,church_id,name,status,role_id,created_by) values(ident,p_church_id,label,state,(p_payload->>'roleId')::uuid,auth.uid())
  on conflict(id) do update set name=excluded.name,status=excluded.status,role_id=excluded.role_id,updated_at=now();
 elsif entity='PAYMENT_METHOD' then
  if coalesce(p_payload->>'kind','') not in ('CASH','PIX','DEBIT_CARD','CREDIT_CARD','BANK_TRANSFER','BANK_SLIP','CHECK','OTHER') then raise exception 'INVALID_INPUT' using errcode='22023'; end if;
  if exists(select 1 from public.financial_cashbox_payment_methods l join public.financial_cashboxes b on b.church_id=l.church_id and b.id=l.cashbox_id where l.church_id=p_church_id and l.payment_method_id=ident and l.deleted_at is null and ((b.cashbox_type='CASH') is distinct from (p_payload->>'kind'='CASH'))) then raise exception 'INVALID_INPUT' using errcode='22023'; end if;
  insert into public.financial_payment_methods(id,church_id,name,status,method_type,created_by) values(ident,p_church_id,label,state,p_payload->>'kind',auth.uid())
  on conflict(id) do update set name=excluded.name,status=excluded.status,method_type=excluded.method_type,updated_at=now();
 elsif entity='CASHBOX' then
  if coalesce(p_payload->>'kind','') not in ('CASH','BANK_ACCOUNT') or jsonb_typeof(p_payload->'paymentMethodIds') is distinct from 'array' or jsonb_array_length(p_payload->'paymentMethodIds') not between 1 and 30 then raise exception 'INVALID_INPUT' using errcode='22023'; end if;
  select array_agg(value::uuid) into method_ids from jsonb_array_elements_text(p_payload->'paymentMethodIds');
  if exists(select 1 from unnest(method_ids) x where not exists(select 1 from public.financial_payment_methods pm where pm.church_id=p_church_id and pm.id=x and pm.status='ACTIVE' and pm.deleted_at is null and ((pm.method_type='CASH')=(p_payload->>'kind'='CASH')))) then raise exception 'INACTIVE_REFERENCE'; end if;
  if old_record is not null then
   if old_record->>'opening_date' is null then raise exception 'LEGACY_DATA_REQUIRES_REVIEW'; end if;
   if state='INACTIVE' and (old_record->>'current_balance')::numeric<>0 then raise exception 'CONFLICT'; end if;
   if p_payload->>'openingDate' is not null and (p_payload->>'openingDate')::date is distinct from (old_record->>'opening_date')::date then raise exception 'INVALID_INPUT' using errcode='22023'; end if;
   if p_payload->>'openingCents' is not null and (p_payload->>'openingCents')::numeric is distinct from (old_record->>'opening_balance')::numeric*100 then raise exception 'INVALID_INPUT' using errcode='22023'; end if;
   update public.financial_cashboxes set name=label,status=state,cashbox_type=p_payload->>'kind',bank_name=p_payload->>'bankName',agency=p_payload->>'agency',account_number=p_payload->>'accountNumber',updated_at=now() where church_id=p_church_id and id=ident;
  else
   opening:=(p_payload->>'openingCents')::numeric;
   if opening is null or opening<>trunc(opening) or abs(opening)>999999999999 or coalesce(p_payload->>'openingDate','') !~ '^20[0-9]{2}-[0-9]{2}-[0-9]{2}$' or (state='INACTIVE' and opening<>0) then raise exception 'INVALID_INPUT' using errcode='22023'; end if;
   insert into public.financial_cashboxes(id,church_id,congregation_id,name,status,cashbox_type,opening_balance,opening_date,current_balance,bank_name,agency,account_number,created_by)
   values(ident,p_church_id,unit,label,state,p_payload->>'kind',opening/100,(p_payload->>'openingDate')::date,0,p_payload->>'bankName',p_payload->>'agency',p_payload->>'accountNumber',auth.uid());
   insert into public.financial_ledger_entries(church_id,congregation_id,cashbox_id,entry_kind,amount,financial_date,created_by)
   values(p_church_id,unit,ident,'OPENING',opening/100,(p_payload->>'openingDate')::date,auth.uid());
  end if;
  update public.financial_cashbox_payment_methods set deleted_at=now() where church_id=p_church_id and cashbox_id=ident and deleted_at is null;
  insert into public.financial_cashbox_payment_methods(church_id,cashbox_id,payment_method_id,created_by)
  select p_church_id,ident,x,auth.uid() from (select distinct unnest(method_ids) x) u
  on conflict(church_id,cashbox_id,payment_method_id) do update set deleted_at=null,updated_at=now();
 end if;
 perform public.log_audit(p_church_id,'finance',case when old_record is null then 'CREATE_CATALOG' else 'UPDATE_CATALOG' end,tab,ident,label,null,null,jsonb_build_object('status',state) || case when entity='CATEGORY' then jsonb_build_object('previousInformativeRole',old_record->>'informative_role','informativeRole',coalesce(p_payload->>'informativeRole',old_record->>'informative_role','NONE')) else '{}'::jsonb end,null,'INFO');
 return jsonb_build_object('id',ident);
end $$;
revoke all on function public.save_finance_catalog(uuid,jsonb) from public,anon;
grant execute on function public.save_finance_catalog(uuid,jsonb) to authenticated;

-- Centralize authorization and configuration, including for an empty ranking.
create function private.finance_informative_configuration(p_church uuid,p_prebend boolean,p_transfer boolean)
returns uuid language plpgsql stable security invoker set search_path='' as $$
declare headquarters uuid; n integer;
begin
  if not private.can_manage_finance_reports(p_church) then raise exception 'FORBIDDEN' using errcode='42501'; end if;
  if (p_prebend and not exists(select 1 from public.financial_categories where church_id=p_church and deleted_at is null and informative_role='PREBEND'))
    or (p_transfer and not exists(select 1 from public.financial_categories where church_id=p_church and deleted_at is null and informative_role='TRANSFER')) then
    raise exception 'REPORT_CONFIGURATION_REQUIRED';
  end if;
  if p_transfer then
    select count(*) into n from public.congregations where church_id=p_church and deleted_at is null and is_headquarters;
    if n<>1 then raise exception 'REPORT_CONFIGURATION_REQUIRED'; end if;
    select id into headquarters from public.congregations where church_id=p_church and deleted_at is null and is_headquarters;
    if not private.can_access_finance_unit(p_church,headquarters,'finance.view') then raise exception 'FORBIDDEN' using errcode='42501'; end if;
  end if;
  return headquarters;
end $$;
revoke all on function private.finance_informative_configuration(uuid,boolean,boolean) from public,anon;
grant execute on function private.finance_informative_configuration(uuid,boolean,boolean) to authenticated;

-- Cathedral receipts grouped by financial month and paying congregation.
-- Null, removed and self-references are reported as unidentified, never guessed by name.
create function private.finance_informative_receipts(p_church uuid,p_start date,p_end date)
returns table(month date,congregation_id uuid,amount_cents numeric)
language plpgsql stable security invoker set search_path='' as $$
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
    group by 1,2;
end $$;
revoke all on function private.finance_informative_receipts(uuid,date,date) from public,anon;
grant execute on function private.finance_informative_receipts(uuid,date,date) to authenticated;

create or replace function public.get_finance_informative_report(p_church_id uuid, p_unit uuid, p_options jsonb)
returns jsonb language plpgsql stable security invoker set search_path = '' as $$
declare
  first_month date; last_month date; current_month date;
  report jsonb; recorded jsonb; transfer_cents numeric; prebend_cents numeric; receipts jsonb:='[]';
  months jsonb := '[]'::jsonb; include_prebend boolean; include_transfer boolean;
begin
  if auth.uid() is null or not private.can_manage_finance_reports(p_church_id)
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
$$;
revoke all on function public.get_finance_informative_report(uuid,uuid,jsonb) from public, anon;
grant execute on function public.get_finance_informative_report(uuid,uuid,jsonb) to authenticated;

create or replace function public.get_finance_ranking_report(p_church_id uuid,p_options jsonb)
returns jsonb language plpgsql stable security invoker set search_path='' as $$
declare u record; result jsonb:='[]'; first_month date; last_month date; n integer; opts jsonb; review jsonb;
begin
 if not private.can_manage_finance_reports(p_church_id) then raise exception 'FORBIDDEN' using errcode='42501'; end if;
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
end $$;
revoke all on function public.get_finance_ranking_report(uuid,jsonb) from public,anon;
grant execute on function public.get_finance_ranking_report(uuid,jsonb) to authenticated;

