-- Statements describe allocations; these functions never create financial movements.
alter table public.report_deliveries drop constraint report_deliveries_amounts_check;
alter table public.report_deliveries add constraint report_deliveries_amounts_check check(total_income>=0 and total_expense>=0 and gross_amount>=0 and total_central_income>=0 and total_congregation_expense>=0 and pastoral_prebend_amount>=0 and pastoral_prebend_tithe_amount>=0 and net_pastoral_prebend_amount>=0);
create function private.finance_month(p_month text) returns date language plpgsql immutable set search_path='' as $$
begin if coalesce(p_month,'') !~ '^20[0-9]{2}-(0[1-9]|1[0-2])$' then raise exception 'INVALID_INPUT' using errcode='22023';end if;return (p_month||'-01')::date;end $$;
create function private.finance_configuration_revision_guard() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if (new.effective_month<date_trunc('month',now() at time zone 'America/Sao_Paulo')::date or exists(select 1 from public.report_delivery_versions where church_id=new.church_id and month>=new.effective_month)) and coalesce(length(trim(new.reason)),0)<5 then raise exception 'INVALID_INPUT' using errcode='22023';end if;
 return new;
end $$;
create trigger finance_department_revision_reason before insert on public.financial_department_base_versions for each row execute function private.finance_configuration_revision_guard();

create function public.save_finance_statement_rules(p_church_id uuid,p_payload jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare unit uuid:=(p_payload->>'congregationId')::uuid;effective date;rule jsonb;gross_count integer:=0;needs_gross boolean:=false;rev integer;ident uuid;reason text:=trim(p_payload->>'retroactiveReason');
begin
 if not private.can_access_finance_unit(p_church_id,unit,'finance.settings.manage') then raise exception 'FORBIDDEN' using errcode='42501';end if;
 perform pg_advisory_xact_lock(hashtextextended(p_church_id::text,0));effective:=private.finance_month(p_payload->>'effectiveMonth');
 if (effective<date_trunc('month',now() at time zone 'America/Sao_Paulo')::date or exists(select 1 from public.report_delivery_versions where church_id=p_church_id and congregation_id=unit and month>=effective)) and coalesce(length(reason),0)<5 then raise exception 'INVALID_INPUT' using errcode='22023';end if;
 if jsonb_typeof(p_payload->'items') is distinct from 'array' or jsonb_array_length(p_payload->'items') not between 1 and 40 then raise exception 'INVALID_INPUT' using errcode='22023';end if;
 for rule in select value from jsonb_array_elements(p_payload->'items') loop
  if coalesce(length(trim(rule->>'name')),0) not between 1 and 120 or coalesce(rule->>'role','') not in ('DISTRIBUTION','GROSS_PREBEND','PREBEND_DEDUCTION') or coalesce(rule->>'calculation','') not in ('ELIGIBLE_INCOME_PERCENT','GROSS_PREBEND_PERCENT','FIXED') then raise exception 'INVALID_INPUT' using errcode='22023';end if;
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
create function public.copy_finance_statement_rules(p_church_id uuid,p_from uuid,p_to uuid,p_month text,p_reason text default null) returns jsonb
language plpgsql security definer set search_path='' as $$
declare items jsonb;begin
 if not private.can_access_finance_unit(p_church_id,p_from,'finance.settings.manage') or not private.can_access_finance_unit(p_church_id,p_to,'finance.settings.manage') then raise exception 'FORBIDDEN' using errcode='42501';end if;
 perform pg_advisory_xact_lock(hashtextextended(p_church_id::text,0));
 select r.items into items from public.report_delivery_rule_sets r where church_id=p_church_id and congregation_id=p_from and effective_month<=private.finance_month(p_month) order by effective_month desc,revision desc limit 1;
 if items is null then raise exception 'CONFIGURATION_REQUIRED';end if;
 return public.save_finance_statement_rules(p_church_id,jsonb_build_object('congregationId',p_to,'effectiveMonth',p_month,'items',items,'retroactiveReason',p_reason));
end $$;

create function private.finance_statement_state(p_church uuid,p_unit uuid,p_month date) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare rules public.report_delivery_rule_sets;deps jsonb; sources jsonb;income numeric;eligible numeric;expense numeric;source_revision bigint;fingerprint text;
begin
 select * into rules from public.report_delivery_rule_sets where church_id=p_church and congregation_id=p_unit and effective_month<=p_month order by effective_month desc,revision desc limit 1;
 if rules.id is null then raise exception 'CONFIGURATION_REQUIRED';end if;
 if exists(select 1 from public.financial_transactions where church_id=p_church and congregation_id=p_unit and transaction_date>=p_month and transaction_date<p_month+interval '1 month' and status='CONFIRMED' and deleted_at is null and (department_id is null or contributor_kind is null)) then raise exception 'LEGACY_DATA_REQUIRES_REVIEW';end if;
 select coalesce(jsonb_agg(jsonb_build_object('id',d.id,'name',d.name,'participatesInBase',coalesce(v.participates_in_base,false),'versionId',v.id,'incomeCents',coalesce(t.amount,0)*100) order by d.name,d.id),'[]') into deps
 from public.financial_departments d
 left join lateral(select id,participates_in_base from public.financial_department_base_versions where church_id=p_church and department_id=d.id and effective_month<=p_month order by effective_month desc,revision desc limit 1) v on true
 left join lateral(select sum(amount) amount from public.financial_transactions where church_id=p_church and congregation_id=p_unit and department_id=d.id and transaction_type='INCOME' and transaction_date>=p_month and transaction_date<p_month+interval '1 month' and status='CONFIRMED' and deleted_at is null) t on true
 where d.church_id=p_church and (d.congregation_id is null or d.congregation_id=p_unit) and (d.deleted_at is null or t.amount is not null);
 if exists(select 1 from jsonb_array_elements(deps) v where v->>'versionId' is null and (v->>'incomeCents')::numeric>0) then raise exception 'CONFIGURATION_REQUIRED';end if;
 select coalesce(sum((v->>'incomeCents')::numeric),0),coalesce(sum((v->>'incomeCents')::numeric) filter(where (v->>'participatesInBase')::boolean),0) into income,eligible from jsonb_array_elements(deps) v;
 select coalesce(sum(amount*100) filter(where transaction_type='EXPENSE'),0),coalesce(jsonb_agg(jsonb_build_object('id',id,'revision',revision) order by id),'[]') into expense,sources from public.financial_transactions where church_id=p_church and congregation_id=p_unit and transaction_date>=p_month and transaction_date<p_month+interval '1 month' and status='CONFIRMED' and deleted_at is null;
 select revision into source_revision from public.financial_period_revisions where church_id=p_church and congregation_id=p_unit and month=p_month;
 select encode(extensions.digest(jsonb_build_object('ruleSetId',rules.id,'departments',(select jsonb_agg(jsonb_build_object('id',v->>'id','versionId',v->>'versionId') order by v->>'id') from jsonb_array_elements(deps) v))::text,'sha256'),'hex') into fingerprint;
 return jsonb_build_object('ruleSetId',rules.id,'rules',rules.items,'departments',deps,'sources',sources,'totalIncomeCents',income,'eligibleIncomeCents',eligible,'excludedIncomeCents',income-eligible,'expenseCents',expense,'sourceRevision',coalesce(source_revision,0),'configurationHash',fingerprint);
end $$;

create function public.get_finance_statement(p_church_id uuid,p_version_id uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare v public.report_delivery_versions;state jsonb;begin
 select * into v from public.report_delivery_versions where church_id=p_church_id and id=p_version_id and deleted_at is null;
 if v.id is null or not private.can_access_finance_unit(p_church_id,v.congregation_id,'finance.view') then raise exception 'FORBIDDEN' using errcode='42501';end if;
 state:=private.finance_statement_state(p_church_id,v.congregation_id,v.month);
 return v.snapshot||jsonb_build_object('stale',v.source_revision<>(state->>'sourceRevision')::bigint or v.configuration_hash<>state->>'configurationHash');
end $$;

create function public.generate_finance_statement(p_church_id uuid,p_unit uuid,p_month text,p_operation_key uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare m date;state jsonb;rule jsonb;calculated jsonb:='[]';gross numeric:=0;deduction numeric:=0;cathedral numeric:=0;amount numeric;base numeric;net numeric;distribution numeric;remaining numeric;
 report uuid;version uuid:=gen_random_uuid();rev integer;unit_name text;snapshot jsonb;key_hash text;previous public.financial_operations;op uuid;
begin
 if not private.can_access_finance_unit(p_church_id,p_unit,'finance.statements.generate') then raise exception 'FORBIDDEN' using errcode='42501';end if;
 m:=private.finance_month(p_month);if p_operation_key is null then raise exception 'INVALID_INPUT' using errcode='22023';end if;
 perform pg_advisory_xact_lock(hashtextextended(p_church_id::text,0));
 key_hash:=encode(extensions.digest(jsonb_build_object('kind','STATEMENT','unit',p_unit,'month',p_month)::text,'sha256'),'hex');
 select * into previous from public.financial_operations where church_id=p_church_id and created_by=auth.uid() and operation_key=p_operation_key;
 if previous.id is not null then
  if previous.payload_hash<>key_hash then raise exception 'IDEMPOTENCY_CONFLICT';end if;
  return public.get_finance_statement(p_church_id,(previous.result->>'versionId')::uuid);
 end if;
 state:=private.finance_statement_state(p_church_id,p_unit,m);
 for rule in select value from jsonb_array_elements(state->'rules') where value->>'role'='GROSS_PREBEND' loop
  gross:=case when rule->>'calculation'='FIXED' then (rule->>'amountCents')::numeric else round((state->>'eligibleIncomeCents')::numeric*(rule->>'percentage')::numeric/100) end;
 end loop;
 for rule in select value from jsonb_array_elements(state->'rules') loop
  base:=case rule->>'calculation' when 'ELIGIBLE_INCOME_PERCENT' then (state->>'eligibleIncomeCents')::numeric when 'GROSS_PREBEND_PERCENT' then gross else 0 end;
  amount:=case when rule->>'calculation'='FIXED' then (rule->>'amountCents')::numeric else round(base*(rule->>'percentage')::numeric/100) end;
  calculated:=calculated||jsonb_build_array(rule||jsonb_build_object('baseCents',base,'calculatedCents',amount));
  if rule->>'role'='PREBEND_DEDUCTION' then deduction:=deduction+amount;end if;
  if rule->>'destination'='CATHEDRAL' then cathedral:=cathedral+amount;end if;
 end loop;
 net:=gross-deduction;if net<0 then raise exception 'INVALID_INPUT' using errcode='22023';end if;
 distribution:=cathedral+net;remaining:=(state->>'eligibleIncomeCents')::numeric-distribution;
 if greatest(abs(distribution),abs(remaining),(state->>'totalIncomeCents')::numeric)>9007199254740991 then raise exception 'INVALID_INPUT' using errcode='22023';end if;
 select id into report from public.report_deliveries where church_id=p_church_id and congregation_id=p_unit and reference_month=extract(month from m) and reference_year=extract(year from m) and deleted_at is null order by created_at,id limit 1;
 if report is null then
  insert into public.report_deliveries(church_id,congregation_id,reference_month,reference_year,period_start,period_end,status,created_by,metadata)
  values(p_church_id,p_unit,extract(month from m),extract(year from m),m,(m+interval '1 month-1 day')::date,'CALCULATED',auth.uid(),jsonb_build_object('descriptive_only',true,'can_generate_financial_transactions',false)) returning id into report;
 end if;
 select coalesce(max(revision),0)+1 into rev from public.report_delivery_versions where church_id=p_church_id and report_delivery_id=report;
 select name into unit_name from public.congregations where church_id=p_church_id and id=p_unit;
 snapshot:=(state-'rules')||jsonb_build_object('id',version,'month',p_month,'revision',rev,'createdAt',now(),'congregationName',unit_name,'stale',false,'items',calculated,'grossPrebendCents',gross,'prebendDeductionCents',deduction,'netPastorCents',net,'cathedralTotalCents',cathedral,'distributionTotalCents',distribution,'remainderCents',remaining);
 insert into public.report_delivery_versions(id,church_id,congregation_id,report_delivery_id,rule_set_id,month,revision,source_revision,configuration_hash,snapshot,created_by)
 values(version,p_church_id,p_unit,report,(state->>'ruleSetId')::uuid,m,rev,(state->>'sourceRevision')::bigint,state->>'configurationHash',snapshot,auth.uid());
 insert into public.report_delivery_items(church_id,congregation_id,report_delivery_id,version_id,rule_name,rule_type,rule_nature,calculation_base,base_amount,percentage_value,fixed_amount,calculated_amount,generate_central_income,generate_congregation_expense,sort_order,created_by,metadata)
 select p_church_id,p_unit,report,version,item->>'name',case when item->>'calculation'='FIXED' then 'FIXED_AMOUNT' else 'PERCENTAGE' end,
 case item->>'role' when 'GROSS_PREBEND' then 'PASTORAL_PAYMENT' when 'PREBEND_DEDUCTION' then 'DEDUCTION' else 'TRANSFER' end,
 case item->>'calculation' when 'FIXED' then 'NONE' when 'GROSS_PREBEND_PERCENT' then 'PASTORAL_PREBEND' else 'TOTAL_INCOME' end,
 (item->>'baseCents')::numeric/100,(item->>'percentage')::numeric,(item->>'amountCents')::numeric/100,(item->>'calculatedCents')::numeric/100,false,false,ordinality::integer,auth.uid(),jsonb_build_object('destination',item->>'destination','role',item->>'role','descriptive_only',true)
 from jsonb_array_elements(calculated) with ordinality x(item,ordinality);
 insert into public.financial_operations(church_id,congregation_id,operation_key,kind,payload_hash,result,created_by) values(p_church_id,p_unit,p_operation_key,'STATEMENT',key_hash,jsonb_build_object('versionId',version),auth.uid());
 return snapshot;
end $$;
revoke all on function private.finance_month(text),private.finance_configuration_revision_guard(),private.finance_statement_state(uuid,uuid,date) from public,anon,authenticated;
revoke all on function public.save_finance_statement_rules(uuid,jsonb),public.copy_finance_statement_rules(uuid,uuid,uuid,text,text),public.get_finance_statement(uuid,uuid),public.generate_finance_statement(uuid,uuid,text,uuid) from public,anon;
grant execute on function public.save_finance_statement_rules(uuid,jsonb),public.copy_finance_statement_rules(uuid,uuid,uuid,text,text),public.get_finance_statement(uuid,uuid),public.generate_finance_statement(uuid,uuid,text,uuid) to authenticated;
