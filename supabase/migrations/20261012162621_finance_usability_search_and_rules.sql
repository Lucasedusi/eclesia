-- Additive UI support. No updates to stored names, ledger or preserved statements.
create extension if not exists unaccent with schema extensions;

create or replace function public.lookup_finance_contributors(p_church_id uuid,p_unit uuid,p_kind text,p_value text) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare term text:=trim(p_value);result jsonb;begin
 if not private.can_access_finance_unit(p_church_id,p_unit,'finance.contributors.lookup') then raise exception 'FORBIDDEN' using errcode='42501';end if;
 if p_kind not in ('NAME','CPF','MEMBER_CODE','CREDENTIAL') or coalesce(length(term),0)>250 or (p_kind in ('NAME','MEMBER_CODE') and length(term)<3) or (p_kind='CPF' and (term !~ '^[0-9]{11}$' or not public.is_valid_cpf(term))) or (p_kind='CREDENTIAL' and term !~ '^[a-f0-9]{64}$') then raise exception 'INVALID_INPUT' using errcode='22023';end if;
 select coalesce(jsonb_agg(v.item order by v.name,v.id),'[]') into result from (
 select m.id,m.full_name name,jsonb_build_object('id',m.id,'name',m.full_name,'memberCode',m.member_code,'congregationName',c.name,'suggestedClassificationId',suggestion.id) item
 from public.members m join public.congregations c on c.church_id=m.church_id and c.id=m.congregation_id and c.deleted_at is null
 left join lateral(select fc.id from public.member_roles mr join public.financial_tithe_classifications fc on fc.church_id=mr.church_id and fc.role_id=mr.role_id and fc.status='ACTIVE' and fc.deleted_at is null
 where mr.church_id=p_church_id and mr.member_id=m.id and mr.status='ACTIVE' and mr.deleted_at is null and (mr.start_date is null or mr.start_date<=current_date) and (mr.end_date is null or mr.end_date>=current_date)
 order by mr.is_primary desc,mr.created_at desc,fc.id limit 1) suggestion on true
 where m.church_id=p_church_id and m.deleted_at is null and m.member_status='ACTIVE' and (
 (p_kind='NAME' and extensions.unaccent(m.full_name) ilike '%'||replace(replace(replace(extensions.unaccent(term),'!','!!'),'%','!%'),'_','!_')||'%' escape '!')
 or (p_kind='MEMBER_CODE' and lower(m.member_code)=lower(term))
 or (p_kind='CPF' and exists(select 1 from public.member_sensitive_identity s where s.church_id=p_church_id and s.member_id=m.id and s.cpf=term and s.deleted_at is null))
 or (p_kind='CREDENTIAL' and m.member_type='MEMBER' and exists(select 1 from public.member_credential_tokens t where t.church_id=p_church_id and t.member_id=m.id and t.token_hash=term and t.status='ACTIVE' and t.issued_at is not null)))
 order by m.full_name,m.id limit 20) v;
 return result;
end $$;
revoke all on function public.lookup_finance_contributors(uuid,uuid,text,text) from public,anon;
grant execute on function public.lookup_finance_contributors(uuid,uuid,text,text) to authenticated;


create or replace function public.list_finance_transactions(p_church_id uuid,p_unit uuid,p_filters jsonb)
returns jsonb language plpgsql stable security invoker set search_path='' as $$
declare start_date date;end_date date;page_number integer;search_text text;result jsonb;
begin
 if not private.can_access_finance_unit(p_church_id,p_unit,'finance.view') then raise exception 'FORBIDDEN';end if;
 if jsonb_typeof(p_filters)<>'object' or coalesce(p_filters->>'month','')!~'^20[0-9]{2}-(0[1-9]|1[0-2])$' then raise exception 'INVALID_INPUT';end if;
 page_number:=coalesce((p_filters->>'page')::integer,1);if page_number<1 or page_number>100000 then raise exception 'INVALID_INPUT';end if;
 if coalesce(p_filters->>'direction','ALL') not in ('ALL','INCOME','EXPENSE') or coalesce(p_filters->>'status','ALL') not in ('ALL','CONFIRMED','CANCELLED') then raise exception 'INVALID_INPUT';end if;
 start_date:=((p_filters->>'month')||'-01')::date;end_date:=(start_date+interval '1 month')::date;
 search_text:=trim(coalesce(p_filters->>'search',''));if length(search_text)>160 then raise exception 'INVALID_INPUT';end if;
 with filtered as materialized(
 select t.* from public.financial_transactions t where t.church_id=p_church_id and t.congregation_id=p_unit and t.deleted_at is null and t.transaction_date>=start_date and t.transaction_date<end_date
 and (coalesce(p_filters->>'direction','ALL')='ALL' or t.transaction_type=p_filters->>'direction')
 and (coalesce(p_filters->>'status','ALL')='ALL' or t.status=p_filters->>'status')
 and (nullif(p_filters->>'departmentId','') is null or t.department_id=(p_filters->>'departmentId')::uuid)
 and (nullif(p_filters->>'categoryId','') is null or t.category_id=(p_filters->>'categoryId')::uuid)
 and (nullif(p_filters->>'cashboxId','') is null or t.cashbox_id=(p_filters->>'cashboxId')::uuid)
 and (nullif(p_filters->>'paymentMethodId','') is null or t.payment_method_id=(p_filters->>'paymentMethodId')::uuid)
 and (nullif(p_filters->>'titheClassificationId','') is null or t.tithe_classification_id=(p_filters->>'titheClassificationId')::uuid)
 and (nullif(p_filters->>'memberId','') is null or t.member_id=(p_filters->>'memberId')::uuid)
 and (search_text='' or position(lower(search_text) in lower(concat_ws(' ',t.person_name,t.beneficiary_name,t.description,t.document_number,t.transaction_number)))>0)
 ), paged as (select * from filtered order by transaction_date desc,id desc limit 20 offset (page_number-1)*20)
 select jsonb_build_object('page',page_number,'pageCount',greatest(1,(select ceil(count(*)/20.0)::integer from filtered)),
 'totalCount',(select count(*) from filtered),
 'filteredIncomeCents',(select coalesce(sum(amount),0)*100 from filtered where status='CONFIRMED' and transaction_type='INCOME'),
 'filteredExpenseCents',(select coalesce(sum(amount),0)*100 from filtered where status='CONFIRMED' and transaction_type='EXPENSE'),
 'items',(select coalesce(jsonb_agg(jsonb_build_object('id',t.id,'date',t.transaction_date,'direction',t.transaction_type,'amountCents',t.amount*100,'status',t.status,'revision',t.revision,'personName',t.person_name,'beneficiaryName',t.beneficiary_name,'categoryName',t.category_name,'departmentName',t.department_name,'classificationName',t.classification_name,'description',t.description,'documentNumber',t.document_number,'attendanceId',t.attendance_id,'cashboxId',t.cashbox_id,'paymentMethodId',t.payment_method_id) order by t.transaction_date desc,t.id desc),'[]') from paged t)
 ) into result;return result;
end;$$;
revoke all on function public.list_finance_transactions(uuid,uuid,jsonb) from public,anon;
grant execute on function public.list_finance_transactions(uuid,uuid,jsonb) to authenticated;

-- Monthly gross prebend ceiling; configured per unit and rule version. No legacy data rewrite.
create or replace function public.save_finance_statement_rules(p_church_id uuid,p_payload jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare unit uuid:=(p_payload->>'congregationId')::uuid;effective date;rule jsonb;gross_count integer:=0;needs_gross boolean:=false;rev integer;ident uuid;reason text:=trim(p_payload->>'retroactiveReason');
begin
 if not private.can_access_finance_unit(p_church_id,unit,'finance.settings.manage') then raise exception 'FORBIDDEN' using errcode='42501';end if;
 perform pg_advisory_xact_lock(hashtextextended(p_church_id::text,0));effective:=private.finance_month(p_payload->>'effectiveMonth');
 if (effective<date_trunc('month',now() at time zone 'America/Sao_Paulo')::date or exists(select 1 from public.report_delivery_versions where church_id=p_church_id and congregation_id=unit and deleted_at is null and month>=effective)) and coalesce(length(reason),0)<5 then raise exception 'STATEMENT_REASON_REQUIRED' using errcode='22023';end if;
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
