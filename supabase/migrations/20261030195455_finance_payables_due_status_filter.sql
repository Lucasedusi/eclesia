-- Optional due-date filter, evaluated before pagination. Existing callers retain the same behavior.
create or replace function public.query_finance_payables(p_church_id uuid,p_options jsonb) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare unit uuid; first_day date; last_day date; current_day date:=(now() at time zone 'America/Sao_Paulo')::date;
 due_status text:=coalesce(p_options->>'dueStatus','ALL');
 st text:=coalesce(p_options->>'status','PENDING'); needle text:=btrim(coalesce(p_options->>'search','')); cat uuid; pg integer:=coalesce((p_options->>'page')::int,1);
 result jsonb; total bigint; pending_total bigint; paid_total bigint;
begin
 unit:=private.finance_payables_headquarters(p_church_id);
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
end $$;
revoke all on function public.query_finance_payables(uuid,jsonb) from public,anon;
grant execute on function public.query_finance_payables(uuid,jsonb) to authenticated;

