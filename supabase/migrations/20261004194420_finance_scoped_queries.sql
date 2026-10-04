-- Read-only projections retain authenticated RLS, and never use present-day balances for a past month.
create function public.get_finance_overview(p_church_id uuid,p_unit uuid,p_month text)
returns jsonb language plpgsql stable security invoker set search_path='' as $$
declare start_date date;end_date date;result jsonb;
begin
 if not private.can_access_finance_unit(p_church_id,p_unit,'finance.view') then raise exception 'FORBIDDEN';end if;
 if p_month is null or p_month!~'^20[0-9]{2}-(0[1-9]|1[0-2])$' then raise exception 'INVALID_INPUT';end if;
 start_date:=(p_month||'-01')::date;end_date:=(start_date+interval '1 month')::date;
 with ledger as materialized(select amount,financial_date,entry_kind from public.financial_ledger_entries where church_id=p_church_id and congregation_id=p_unit and deleted_at is null and financial_date<end_date),
 tx as materialized(select amount,transaction_date,transaction_type,category_id,category_name from public.financial_transactions where church_id=p_church_id and congregation_id=p_unit and deleted_at is null and status='CONFIRMED' and transaction_date>=start_date and transaction_date<end_date)
 select jsonb_build_object(
 'openingCents',(select coalesce(sum(amount),0)*100 from ledger where financial_date<start_date),
 'openingMovementCents',(select coalesce(sum(amount),0)*100 from ledger where financial_date>=start_date and entry_kind='OPENING'),
 'adjustmentCents',(select coalesce(sum(amount),0)*100 from ledger where financial_date>=start_date and entry_kind='ADJUSTMENT'),
 'closingCents',(select coalesce(sum(amount),0)*100 from ledger),
 'incomeCents',(select coalesce(sum(amount),0)*100 from tx where transaction_type='INCOME'),
 'expenseCents',(select coalesce(sum(amount),0)*100 from tx where transaction_type='EXPENSE'),
 'dailySeries',(select coalesce(jsonb_agg(jsonb_build_object('date',d.day::date,'incomeCents',coalesce(t.inc,0),'expenseCents',coalesce(t.exp,0)) order by d.day),'[]') from pg_catalog.generate_series(start_date::timestamp,(end_date-1)::timestamp,interval '1 day') d(day) left join (select transaction_date,sum(amount*100) filter(where transaction_type='INCOME') inc,sum(amount*100) filter(where transaction_type='EXPENSE') exp from tx group by transaction_date) t on t.transaction_date=d.day::date),
 'categorySeries',(select coalesce(jsonb_agg(jsonb_build_object('id',t.category_id,'name',t.name,'direction',t.transaction_type,'amountCents',t.amount) order by t.amount desc),'[]') from (select category_id,max(coalesce(category_name,'Sem categoria')) name,transaction_type,sum(amount)*100 amount from tx group by category_id,transaction_type)t)
 ) into result;
 return result;
end;$$;
revoke all on function public.get_finance_overview(uuid,uuid,text) from public,anon;
grant execute on function public.get_finance_overview(uuid,uuid,text) to authenticated;

create function public.list_finance_transactions(p_church_id uuid,p_unit uuid,p_filters jsonb)
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
