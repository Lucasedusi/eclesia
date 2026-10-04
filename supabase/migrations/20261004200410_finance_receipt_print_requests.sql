create or replace function private.finance_refresh_receipt(p_church uuid,p_unit uuid,p_tx uuid,p_attendance uuid) returns uuid
language plpgsql security definer set search_path='' as $$
declare rid uuid:=gen_random_uuid(); previous public.financial_receipts; rows jsonb; total numeric; v_person text; v_date date; v_method text; v_direction text; unit_name text; rev integer; num text;
begin
 select * into previous from public.financial_receipts where church_id=p_church and congregation_id=p_unit and deleted_at is null
 and ((p_attendance is not null and attendance_id=p_attendance) or (p_attendance is null and financial_transaction_id=p_tx)) order by revision desc,created_at desc limit 1 for update;
 select jsonb_agg(jsonb_build_object('transactionId',t.id,'categoryName',t.category_name,'departmentName',t.department_name,'classificationName',t.classification_name,'amountCents',t.amount*100) order by t.created_at,t.id),sum(t.amount)
 into rows,total from public.financial_transactions t where t.church_id=p_church and t.congregation_id=p_unit and t.status='CONFIRMED' and t.deleted_at is null
 and ((p_attendance is not null and t.attendance_id=p_attendance) or (p_attendance is null and t.id=p_tx));
 if rows is null then
  update public.financial_receipts set receipt_status='CANCELLED',cancelled_at=now(),cancelled_by=auth.uid(),cancel_reason='Lançamentos cancelados',updated_at=now() where id=previous.id and church_id=p_church;
  return previous.id;
 end if;
 select coalesce(t.person_name,t.beneficiary_name),t.transaction_date,pm.name,t.transaction_type into v_person,v_date,v_method,v_direction from public.financial_transactions t join public.financial_payment_methods pm on pm.church_id=t.church_id and pm.id=t.payment_method_id
 where t.church_id=p_church and t.status='CONFIRMED' and t.deleted_at is null and ((p_attendance is not null and t.attendance_id=p_attendance) or (p_attendance is null and t.id=p_tx)) order by t.id limit 1;
 select name into unit_name from public.congregations where church_id=p_church and id=p_unit;
 rev:=coalesce(previous.revision,0)+1;num:='FIN-'||upper(replace(rid::text,'-',''));
 if previous.id is not null then update public.financial_receipts set receipt_status='SUPERSEDED',updated_at=now() where church_id=p_church and id=previous.id; end if;
 insert into public.financial_receipts(id,church_id,congregation_id,financial_transaction_id,attendance_id,receipt_number,revision,supersedes_id,person_name,amount,created_by,receipt_type,snapshot)
 values(rid,p_church,p_unit,case when p_attendance is null then p_tx end,p_attendance,num,rev,previous.id,v_person,total,auth.uid(),v_direction,
 jsonb_build_object('direction',v_direction,'id',rid,'number',num,'revision',rev,'congregationName',unit_name,'personName',v_person,'date',v_date,'paymentMethodName',v_method,'totalCents',total*100,'items',rows));
 insert into public.financial_receipt_items(church_id,congregation_id,receipt_id,transaction_id,category_name,department_name,classification_name,amount,sort_order,created_by)
 select p_church,p_unit,rid,(i->>'transactionId')::uuid,i->>'categoryName',i->>'departmentName',i->>'classificationName',(i->>'amountCents')::numeric/100,ordinality::integer,auth.uid() from jsonb_array_elements(rows) with ordinality x(i,ordinality);
 return rid;
end $$;


-- Printing records a browser request only; the receipt content and money are unchanged.
create function public.record_finance_print_request(p_church_id uuid,p_receipt_id uuid)
returns void language plpgsql security definer set search_path='' as $$
declare r public.financial_receipts;
begin
 select * into r from public.financial_receipts where church_id=p_church_id and id=p_receipt_id and deleted_at is null for update;
 if r.id is null or not private.can_access_finance_unit(p_church_id,r.congregation_id,'finance.view') then raise exception 'FORBIDDEN';end if;
 if r.snapshot is null then raise exception 'LEGACY_DATA_REQUIRES_REVIEW';end if;
 update public.financial_receipts set print_count=print_count+1,printed_at=now(),printed_by=auth.uid(),updated_at=now() where church_id=p_church_id and id=p_receipt_id;
end;$$;
revoke all on function public.record_finance_print_request(uuid,uuid) from public,anon;
grant execute on function public.record_finance_print_request(uuid,uuid) to authenticated;
