-- RPC serializes settings with financial commands using one church advisory lock.
create function public.save_finance_catalog(p_church_id uuid,p_payload jsonb) returns jsonb
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
  if coalesce(p_payload->>'direction','') not in ('INCOME','EXPENSE','BOTH') or (coalesce((p_payload->>'isTithe')::boolean,false) and p_payload->>'direction'<>'INCOME') then raise exception 'INVALID_INPUT' using errcode='22023'; end if;
  if p_payload->>'departmentId' is not null and not exists(select 1 from public.financial_departments where church_id=p_church_id and id=(p_payload->>'departmentId')::uuid and congregation_id is null and status='ACTIVE' and deleted_at is null) then raise exception 'INACTIVE_REFERENCE'; end if;
  insert into public.financial_categories(id,church_id,name,status,category_type,department_id,is_tithe,is_offering,requires_member,created_by)
  values(ident,p_church_id,label,state,p_payload->>'direction',(p_payload->>'departmentId')::uuid,coalesce((p_payload->>'isTithe')::boolean,false),coalesce((p_payload->>'isOffering')::boolean,false),coalesce((p_payload->>'requiresPerson')::boolean,false),auth.uid())
  on conflict(id) do update set name=excluded.name,status=excluded.status,category_type=excluded.category_type,department_id=excluded.department_id,is_tithe=excluded.is_tithe,is_offering=excluded.is_offering,requires_member=excluded.requires_member,updated_at=now();
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
 perform public.log_audit(p_church_id,'finance',case when old_record is null then 'CREATE_CATALOG' else 'UPDATE_CATALOG' end,tab,ident,label,null,null,jsonb_build_object('status',state),null,'INFO');
 return jsonb_build_object('id',ident);
end $$;
revoke all on function public.save_finance_catalog(uuid,jsonb) from public,anon;
grant execute on function public.save_finance_catalog(uuid,jsonb) to authenticated;
