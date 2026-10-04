-- Correct the monthly inclusive end date; keep prior migration immutable.
create or replace function public.generate_finance_statement(p_church_id uuid,p_unit uuid,p_month text,p_operation_key uuid) returns jsonb
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
  values(p_church_id,p_unit,extract(month from m),extract(year from m),m,(m+interval '1 month'-interval '1 day')::date,'CALCULATED',auth.uid(),jsonb_build_object('descriptive_only',true,'can_generate_financial_transactions',false)) returning id into report;
 end if;
 select coalesce(max(revision),0)+1 into rev from public.report_delivery_versions where church_id=p_church_id and report_delivery_id=report;
 select name into unit_name from public.congregations where church_id=p_church_id and id=p_unit;
 snapshot:=(state-'rules')||jsonb_build_object('id',version,'month',p_month,'revision',rev,'createdAt',now(),'createdBy',auth.uid(),'createdByName',(select coalesce(display_name,full_name,'Usuário') from public.profiles where id=auth.uid()),'congregationName',unit_name,'stale',false,'items',calculated,'grossPrebendCents',gross,'prebendDeductionCents',deduction,'netPastorCents',net,'cathedralTotalCents',cathedral,'distributionTotalCents',distribution,'remainderCents',remaining);
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

create function public.list_finance_statements(p_church_id uuid,p_unit uuid,p_month text) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare state jsonb; m date;
begin
 if not private.can_access_finance_unit(p_church_id,p_unit,'finance.view') then raise exception 'FORBIDDEN';end if;
 if coalesce(p_month,'')!~'^20[0-9]{2}-(0[1-9]|1[0-2])$' then raise exception 'INVALID_INPUT';end if;
 m:=(p_month||'-01')::date;
 if not exists(select 1 from public.report_delivery_versions where church_id=p_church_id and congregation_id=p_unit and month=m and deleted_at is null) then return '[]'::jsonb;end if;
 state:=private.finance_statement_state(p_church_id,p_unit,m);
 return (select coalesce(jsonb_agg(jsonb_build_object('id',v.id,'revision',v.revision,'createdAt',v.created_at,'createdBy',v.created_by,'createdByName',coalesce(v.snapshot->>'createdByName','Responsável registrado'),'stale',v.source_revision<>(state->>'sourceRevision')::bigint or v.configuration_hash<>state->>'configurationHash','superseded',v.revision<latest.revision) order by v.revision desc),'[]') from public.report_delivery_versions v cross join (select max(revision) revision from public.report_delivery_versions where church_id=p_church_id and congregation_id=p_unit and month=m and deleted_at is null) latest where v.church_id=p_church_id and v.congregation_id=p_unit and v.month=m and v.deleted_at is null);
end;$$;
revoke all on function public.list_finance_statements(uuid,uuid,text) from public,anon;
grant execute on function public.list_finance_statements(uuid,uuid,text) to authenticated;
