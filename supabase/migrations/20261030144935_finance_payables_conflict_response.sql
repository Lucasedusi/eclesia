-- A stale revision is a business conflict, not a retryable serialization failure.
-- P0001 avoids PostgREST transaction retries and returns the safe CONFLICT message.
create or replace function public.execute_finance_payable(p_church_id uuid,p_command jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare unit uuid; actor uuid:=auth.uid(); actor_name text; req uuid; kind text; old_request private.finance_payable_requests;
 a public.accounts_payable; original public.accounts_payable; before_data jsonb; v jsonb; entry jsonb; row_id uuid; rev integer;
 paid date; source_month date; target_month date; created integer:=0; skipped integer:=0; result jsonb; allowed text[];
begin
 unit:=private.finance_payables_headquarters(p_church_id);
 if jsonb_typeof(p_command)<>'object' or octet_length(p_command::text)>131072 then raise exception 'INVALID_INPUT'; end if;
 req:=(p_command->>'requestId')::uuid; kind:=p_command->>'kind';
 if req is null or kind is null or kind not in ('CREATE','UPDATE','PAY','REOPEN','DELETE','COPY') then raise exception 'INVALID_INPUT'; end if;
 allowed:=case kind when 'CREATE' then array['kind','requestId','values'] when 'UPDATE' then array['kind','requestId','id','revision','values']
 when 'PAY' then array['kind','requestId','id','revision','paidDate'] when 'REOPEN' then array['kind','requestId','id','revision','reason']
 when 'DELETE' then array['kind','requestId','id','revision'] else array['kind','requestId','sourceMonth','items'] end;
 if p_command-allowed<>'{}'::jsonb then raise exception 'INVALID_INPUT'; end if;
 perform pg_advisory_xact_lock(hashtextextended(p_church_id::text||actor::text||req::text,0));
 select * into old_request from private.finance_payable_requests where church_id=p_church_id and actor_id=actor and request_id=req;
 if found then
 if old_request.command<>p_command then raise exception 'IDEMPOTENCY_CONFLICT'; end if;
 return old_request.result;
 end if;
 select coalesce(full_name,'Administrador') into actor_name from public.profiles where id=actor;
 if kind='COPY' then
 if coalesce(p_command->>'sourceMonth','')!~'^20[0-9]{2}-(0[1-9]|1[0-2])$' or jsonb_typeof(p_command->'items') is distinct from 'array'
 then raise exception 'INVALID_INPUT'; end if;
 if jsonb_array_length(p_command->'items') not between 1 and 100 then raise exception 'INVALID_INPUT'; end if;
 if (select count(distinct x->>'sourceId') from jsonb_array_elements(p_command->'items') x)<>jsonb_array_length(p_command->'items') then raise exception 'INVALID_INPUT'; end if;
 source_month:=(p_command->>'sourceMonth'||'-01')::date; target_month:=(source_month+interval '1 month')::date;
 -- Serialize copies of a source, in stable order, including across different request ids.
 for entry in select x from jsonb_array_elements(p_command->'items') x order by x->>'sourceId' loop
 if entry-array['sourceId','revision','categoryId','amountCents','dueDate']<>'{}'::jsonb then raise exception 'INVALID_INPUT'; end if;
 select * into original from public.accounts_payable where church_id=p_church_id and congregation_id=unit and id=(entry->>'sourceId')::uuid
 and is_checklist and deleted_at is null for update;
 if not found then raise exception 'FORBIDDEN' using errcode='42501'; end if;
 if original.due_date<source_month or original.due_date>=target_month then raise exception 'INVALID_INPUT'; end if;
 if exists(select 1 from public.accounts_payable where church_id=p_church_id and copied_from_id=original.id and copied_for_month=target_month and is_checklist) then skipped:=skipped+1; continue; end if;
 if original.revision is distinct from (entry->>'revision')::integer then raise exception 'CONFLICT'; end if;
 v:=jsonb_build_object('name',original.description,'notes',coalesce(original.notes,''),'categoryId',entry->'categoryId','amountCents',entry->'amountCents','dueDate',entry->'dueDate');
 perform private.validate_payable_values(p_church_id,v);
 if (v->>'dueDate')::date<target_month or (v->>'dueDate')::date>=(target_month+interval '1 month')::date then raise exception 'INVALID_INPUT'; end if;
 insert into public.accounts_payable(church_id,congregation_id,is_checklist,description,category_id,due_date,amount,notes,created_by,copied_from_id,copied_for_month)
 values(p_church_id,unit,true,v->>'name',(v->>'categoryId')::uuid,(v->>'dueDate')::date,(v->>'amountCents')::numeric/100,v->>'notes',actor,original.id,target_month) returning * into a;
 insert into private.finance_payable_events(church_id,payable_id,action,actor_id,actor_name,after_values)
 values(p_church_id,a.id,'COPY',actor,actor_name,private.payable_json(a)); created:=created+1;
 end loop;
 result:=jsonb_build_object('created',created,'skipped',skipped);
 else
 if kind='CREATE' then
 v:=p_command->'values'; perform private.validate_payable_values(p_church_id,v);
 insert into public.accounts_payable(church_id,congregation_id,is_checklist,description,category_id,due_date,amount,notes,created_by)
 values(p_church_id,unit,true,btrim(v->>'name'),(v->>'categoryId')::uuid,(v->>'dueDate')::date,(v->>'amountCents')::numeric/100,coalesce(v->>'notes',''),actor) returning * into a;
 else
 row_id:=(p_command->>'id')::uuid; rev:=(p_command->>'revision')::integer;
 select * into a from public.accounts_payable where church_id=p_church_id and congregation_id=unit and id=row_id and is_checklist and deleted_at is null for update;
 if not found then raise exception 'FORBIDDEN' using errcode='42501'; end if;
 if rev is distinct from a.revision then raise exception 'CONFLICT'; end if;
 before_data:=private.payable_json(a);
 if (kind='REOPEN' and a.status<>'PAID') or (kind<>'REOPEN' and a.status<>'PENDING') then raise exception 'CONFLICT'; end if;
 if kind='UPDATE' then
 v:=p_command->'values'; perform private.validate_payable_values(p_church_id,v);
 update public.accounts_payable set description=btrim(v->>'name'),category_id=(v->>'categoryId')::uuid,due_date=(v->>'dueDate')::date,
 amount=(v->>'amountCents')::numeric/100,notes=coalesce(v->>'notes',''),revision=revision+1 where church_id=p_church_id and id=row_id returning * into a;
 elsif kind='PAY' then
 if coalesce(p_command->>'paidDate','')!~'^20[0-9]{2}-[0-9]{2}-[0-9]{2}$' then raise exception 'INVALID_INPUT'; end if;
 paid:=(p_command->>'paidDate')::date;
 if paid>(now() at time zone 'America/Sao_Paulo')::date then raise exception 'INVALID_INPUT'; end if;
 update public.accounts_payable set status='PAID',paid_date=paid,paid_at=now(),paid_by=actor,revision=revision+1 where church_id=p_church_id and id=row_id returning * into a;
 elsif kind='REOPEN' then
 if coalesce(length(btrim(p_command->>'reason')),0) not between 5 and 1000 then raise exception 'INVALID_INPUT'; end if;
 update public.accounts_payable set status='PENDING',paid_date=null,paid_at=null,paid_by=null,revision=revision+1 where church_id=p_church_id and id=row_id returning * into a;
 elsif kind='DELETE' then
 update public.accounts_payable set deleted_at=now(),revision=revision+1 where church_id=p_church_id and id=row_id returning * into a;
 end if;
 end if;
 insert into private.finance_payable_events(church_id,payable_id,action,actor_id,actor_name,reason,before_values,after_values)
 values(p_church_id,a.id,kind,actor,actor_name,case when kind='REOPEN' then btrim(p_command->>'reason') end,before_data,private.payable_json(a));
 result:=jsonb_build_object('id',a.id);
 end if;
 insert into private.finance_payable_requests(church_id,actor_id,request_id,command,result) values(p_church_id,actor,req,p_command,result);
 return result;
exception when invalid_text_representation or datetime_field_overflow or invalid_datetime_format or numeric_value_out_of_range or not_null_violation then raise exception 'INVALID_INPUT';
end $$;
revoke all on function public.execute_finance_payable(uuid,jsonb) from public,anon;
grant execute on function public.execute_finance_payable(uuid,jsonb) to authenticated;
