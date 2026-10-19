-- Inclusive transaction date ranges. Monthly callers remain compatible.
-- No data rewrites; preserve the existing invoker, scope checks, RLS and grants.
create or replace function public.list_finance_transactions(p_church_id uuid,p_unit uuid,p_filters jsonb)
returns jsonb language plpgsql stable security invoker set search_path='' as $$
declare start_date date;end_date date;page_number integer;search_text text;result jsonb;
begin
 if not private.can_access_finance_unit(p_church_id,p_unit,'finance.view') then raise exception 'FORBIDDEN';end if;
 if jsonb_typeof(p_filters) is distinct from 'object' or coalesce(p_filters->>'month','')!~'^20[0-9]{2}-(0[1-9]|1[0-2])$' then raise exception 'INVALID_INPUT';end if;
 page_number:=coalesce((p_filters->>'page')::integer,1);if page_number<1 or page_number>100000 then raise exception 'INVALID_INPUT';end if;
 if coalesce(p_filters->>'direction','ALL') not in ('ALL','INCOME','EXPENSE') or coalesce(p_filters->>'status','ALL') not in ('ALL','CONFIRMED','CANCELLED') then raise exception 'INVALID_INPUT';end if;
 if p_filters ? 'dateFrom' or p_filters ? 'dateTo' then
  if jsonb_typeof(p_filters->'dateFrom') is distinct from 'string'
     or jsonb_typeof(p_filters->'dateTo') is distinct from 'string'
     or (p_filters->>'dateFrom') !~ '^20[0-9]{2}-(0[1-9]|1[0-2])-(0[1-9]|[12][0-9]|3[01])$'
     or (p_filters->>'dateTo') !~ '^20[0-9]{2}-(0[1-9]|1[0-2])-(0[1-9]|[12][0-9]|3[01])$'
  then raise exception 'INVALID_INPUT' using errcode='22023'; end if;
  start_date := (p_filters->>'dateFrom')::date;
  end_date := (p_filters->>'dateTo')::date;
  if start_date > end_date then raise exception 'INVALID_INPUT' using errcode='22023'; end if;
  -- Keep an exclusive query bound while accepting an inclusive civil end date.
  end_date := end_date + 1;
 else
  start_date:=((p_filters->>'month')||'-01')::date;
  end_date:=(start_date+interval '1 month')::date;
 end if;
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
 select jsonb_build_object('dateFrom',start_date,'dateTo',end_date-1,'page',page_number,'pageCount',greatest(1,(select ceil(count(*)/20.0)::integer from filtered)),
 'totalCount',(select count(*) from filtered),
 'filteredIncomeCents',(select coalesce(sum(amount),0)*100 from filtered where status='CONFIRMED' and transaction_type='INCOME'),
 'filteredExpenseCents',(select coalesce(sum(amount),0)*100 from filtered where status='CONFIRMED' and transaction_type='EXPENSE'),
 'items',(select coalesce(jsonb_agg(jsonb_build_object('id',t.id,'date',t.transaction_date,'direction',t.transaction_type,'amountCents',t.amount*100,'status',t.status,'revision',t.revision,'personName',t.person_name,'beneficiaryName',t.beneficiary_name,'categoryName',t.category_name,'departmentName',t.department_name,'classificationName',t.classification_name,'description',t.description,'documentNumber',t.document_number,'attendanceId',t.attendance_id,'cashboxId',t.cashbox_id,'paymentMethodId',t.payment_method_id) order by t.transaction_date desc,t.id desc),'[]') from paged t)
 ) into result;return result;
end;$$;
revoke all on function public.list_finance_transactions(uuid,uuid,jsonb) from public,anon;
grant execute on function public.list_finance_transactions(uuid,uuid,jsonb) to authenticated;
