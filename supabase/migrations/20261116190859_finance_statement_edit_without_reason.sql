-- Editing rules always creates an audited revision. Copying keeps its destination-specific reason policy.
create or replace function public.save_finance_statement_rules(p_church_id uuid,p_payload jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare unit uuid:=(p_payload->>'congregationId')::uuid;effective date;rule jsonb;gross_count integer:=0;needs_gross boolean:=false;rev integer;ident uuid;reason text:=trim(p_payload->>'retroactiveReason');
begin
 if not private.can_access_finance_unit(p_church_id,unit,'finance.settings.manage') then raise exception 'FORBIDDEN' using errcode='42501';end if;
 perform pg_advisory_xact_lock(hashtextextended(p_church_id::text,0));effective:=private.finance_month(p_payload->>'effectiveMonth');
 if jsonb_typeof(p_payload->'items') is distinct from 'array' or jsonb_array_length(p_payload->'items') not between 1 and 40 then raise exception 'INVALID_INPUT' using errcode='22023';end if;
 for rule in select value from jsonb_array_elements(p_payload->'items') loop
  if coalesce(length(trim(rule->>'name')),0) not between 1 and 120 or coalesce(rule->>'role','') not in ('DISTRIBUTION','GROSS_PREBEND','PREBEND_DEDUCTION') or coalesce(rule->>'calculation','') not in ('ELIGIBLE_INCOME_PERCENT','GROSS_PREBEND_PERCENT','FIXED') then raise exception 'INVALID_INPUT' using errcode='22023';end if;
  if rule->>'role'='GROSS_PREBEND' and (not rule ? 'capCents' or rule->'capCents'='null'::jsonb) then raise exception 'PREBEND_CAP_REQUIRED';end if;
  if rule ? 'capCents' and (rule->>'role'<>'GROSS_PREBEND' or jsonb_typeof(rule->'capCents') is distinct from 'number' or (rule->>'capCents')::numeric not between 0 and 999999999999 or (rule->>'capCents')::numeric<>trunc((rule->>'capCents')::numeric)) then raise exception 'INVALID_INPUT' using errcode='22023';end if;
  if rule->>'role'='GROSS_PREBEND' then
   gross_count:=gross_count+1;if rule->>'destination' is distinct from 'LOCAL_PASTOR' or rule->>'calculation'='GROSS_PREBEND_PERCENT' then raise exception 'INVALID_INPUT' using errcode='22023';end if;
  elsif rule->>'destination' is distinct from 'CATHEDRAL' then raise exception 'INVALID_INPUT' using errcode='22023';end if;
  if rule->>'role'='PREBEND_DEDUCTION' or rule->>'calculation'='GROSS_PREBEND_PERCENT' then needs_gross:=true;end if;
  if rule->>'calculation'='FIXED' then
   if jsonb_typeof(rule->'amountCents') is distinct from 'number' or (rule->>'amountCents')::numeric not between 0 and 999999999999 or (rule->>'amountCents')::numeric<>trunc((rule->>'amountCents')::numeric) then raise exception 'INVALID_INPUT' using errcode='22023';end if;
  else
   if coalesce(rule->>'percentage','') !~ '^[0-9]{1,3}(\.[0-9]{1,4})?$' or (rule->>'percentage')::numeric not between 0 and 100 then raise exception 'INVALID_INPUT' using errcode='22023';end if;
  end if;
 end loop;
 if gross_count>1 or (needs_gross and gross_count<>1) then raise exception 'INVALID_INPUT' using errcode='22023';end if;
 select coalesce(max(revision),0)+1 into rev from public.report_delivery_rule_sets where church_id=p_church_id and congregation_id=unit and effective_month=effective;
 insert into public.report_delivery_rule_sets(church_id,congregation_id,effective_month,revision,reason,items,created_by) values(p_church_id,unit,effective,rev,reason,p_payload->'items',auth.uid()) returning id into ident;
 insert into public.report_delivery_rules(church_id,congregation_id,rule_set_id,name,rule_type,rule_nature,calculation_base,percentage_value,fixed_amount,affects_pastoral_prebend,deducts_from_pastoral_prebend,generate_central_income,generate_congregation_expense,effective_from,created_by,sort_order,metadata)
 select p_church_id,unit,ident,item->>'name',case when item->>'calculation'='FIXED' then 'FIXED_AMOUNT' else 'PERCENTAGE' end,
 case item->>'role' when 'GROSS_PREBEND' then 'PASTORAL_PAYMENT' when 'PREBEND_DEDUCTION' then 'DEDUCTION' else 'TRANSFER' end,
 case item->>'calculation' when 'FIXED' then 'NONE' when 'GROSS_PREBEND_PERCENT' then 'PASTORAL_PREBEND' else 'TOTAL_INCOME' end,
 (item->>'percentage')::numeric,(item->>'amountCents')::numeric/100,item->>'role'='GROSS_PREBEND',item->>'role'='PREBEND_DEDUCTION',false,false,effective,auth.uid(),ordinality::integer,jsonb_build_object('destination',item->>'destination','role',item->>'role','descriptive_only',true)
 from jsonb_array_elements(p_payload->'items') with ordinality x(item,ordinality);
 return jsonb_build_object('ruleSetId',ident,'revision',rev);
end $$;


revoke all on function public.save_finance_statement_rules(uuid,jsonb) from public,anon;
grant execute on function public.save_finance_statement_rules(uuid,jsonb) to authenticated;

create or replace function public.copy_finance_statement_rules(
 p_church_id uuid, p_from uuid, p_to uuid, p_month text, p_reason text default null
) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
 effective date;
 items jsonb;
begin
 if not private.can_access_finance_unit(p_church_id,p_from,'finance.settings.manage')
    or not private.can_access_finance_unit(p_church_id,p_to,'finance.settings.manage') then
  raise exception 'FORBIDDEN' using errcode='42501';
 end if;
 perform pg_advisory_xact_lock(hashtextextended(p_church_id::text,0));
 effective := private.finance_month(p_month);
 select r.items into items from public.report_delivery_rule_sets r
 where r.church_id=p_church_id and r.congregation_id=p_from and r.effective_month<=effective
 order by r.effective_month desc,r.revision desc limit 1;
 if items is null then raise exception 'CONFIGURATION_REQUIRED'; end if;

 if coalesce(length(trim(p_reason)),0)<5 and (
  effective < date_trunc('month',now() at time zone 'America/Sao_Paulo')::date or exists (
   select 1 from public.report_delivery_versions v
   where v.church_id=p_church_id and v.congregation_id=p_to and v.deleted_at is null and v.month>=effective
  )
 ) then
  raise exception 'STATEMENT_REASON_REQUIRED' using errcode='22023';
 end if;
 return public.save_finance_statement_rules(p_church_id,jsonb_build_object(
  'congregationId',p_to,'effectiveMonth',p_month,'items',items,'retroactiveReason',p_reason
 ));
end $$;
revoke all on function public.copy_finance_statement_rules(uuid,uuid,uuid,text,text) from public,anon;
grant execute on function public.copy_finance_statement_rules(uuid,uuid,uuid,text,text) to authenticated;
