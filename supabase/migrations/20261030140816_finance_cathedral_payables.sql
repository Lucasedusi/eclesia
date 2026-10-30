-- Cathedral-only checklist. Legacy rows are preserved and never assigned by inference.
insert into public.permissions(key,name,module,action,is_sensitive,status)
values('finance.payables.manage','Gerenciar contas a pagar da Catedral','finance','payables.manage',true,'ACTIVE') on conflict do nothing;
insert into public.role_permissions(role,permission_id,status)
select 'ADMIN',id,'ACTIVE' from public.permissions where key='finance.payables.manage' and deleted_at is null on conflict do nothing;

alter table public.accounts_payable
 add column is_checklist boolean not null default false,
 add column revision integer not null default 1,
 add column paid_date date,
 add column copied_from_id uuid,
 add column copied_for_month date,
 alter column amount drop not null,
 alter column amount drop default;
alter table public.accounts_payable add constraint accounts_payable_church_id_unique unique(church_id,id);
alter table public.accounts_payable add constraint accounts_payable_checklist_valid check (not is_checklist or (
 congregation_id is not null and category_id is not null and revision>0 and length(btrim(description)) between 1 and 120
 and (amount is null or amount>0) and status in ('PENDING','PAID')
 and ((status='PAID' and paid_date is not null and paid_at is not null and paid_by is not null)
   or (status='PENDING' and paid_date is null and paid_at is null and paid_by is null))
 and financial_transaction_id is null
 and ((copied_from_id is null and copied_for_month is null) or (copied_from_id is not null and copied_for_month is not null))
));
-- NOT VALID preserves legacy data for a separate review; new/changed rows are checked.
alter table public.accounts_payable add constraint payable_unit_tenant foreign key(church_id,congregation_id) references public.congregations(church_id,id) not valid;
alter table public.accounts_payable add constraint payable_category_tenant foreign key(church_id,category_id) references public.financial_categories(church_id,id) not valid;
alter table public.accounts_payable add constraint payable_copy_tenant foreign key(church_id,copied_from_id) references public.accounts_payable(church_id,id) not valid;
create unique index payable_copy_once on public.accounts_payable(church_id,copied_from_id,copied_for_month) where is_checklist and copied_from_id is not null;
create index payable_due_list on public.accounts_payable(church_id,congregation_id,due_date,id) where is_checklist and deleted_at is null;

create table private.finance_payable_events (
 id uuid primary key default gen_random_uuid(), church_id uuid not null references public.churches(id), payable_id uuid not null,
 action text not null check(action in ('CREATE','UPDATE','PAY','REOPEN','DELETE','COPY')),
 actor_id uuid not null references public.profiles(id), actor_name text not null, occurred_at timestamptz not null default now(),
 reason text, before_values jsonb, after_values jsonb not null,
 foreign key(church_id,payable_id) references public.accounts_payable(church_id,id)
);
create index payable_events_history on private.finance_payable_events(church_id,payable_id,occurred_at,id);
create index payable_events_actor on private.finance_payable_events(actor_id);
alter table private.finance_payable_events enable row level security;
revoke all on private.finance_payable_events from public,anon,authenticated;
create table private.finance_payable_requests (
 church_id uuid not null references public.churches(id), actor_id uuid not null references public.profiles(id), request_id uuid not null,
 command jsonb not null, result jsonb not null, created_at timestamptz not null default now(), primary key(church_id,actor_id,request_id)
);
create index payable_requests_actor on private.finance_payable_requests(actor_id);
alter table private.finance_payable_requests enable row level security;
revoke all on private.finance_payable_requests from public,anon,authenticated;

create function private.can_manage_payables(p_church uuid) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.user_church_access a
 join public.profiles p on p.id=a.profile_id and p.status='ACTIVE' and p.deleted_at is null
 join public.churches ch on ch.id=a.church_id and ch.status='ACTIVE' and ch.deleted_at is null
 where a.church_id=p_church and a.profile_id=(select auth.uid()) and a.status='ACTIVE' and a.deleted_at is null
 and a.role='ADMIN' and a.access_scope='CHURCH' and private.access_has_permission(a.id,'finance.payables.manage'));
$$;
revoke all on function private.can_manage_payables(uuid) from public,anon;
grant execute on function private.can_manage_payables(uuid) to authenticated;
create function private.finance_payables_headquarters(p_church uuid) returns uuid language plpgsql stable security definer set search_path='' as $$
declare ids uuid[];
begin
 if not private.can_manage_payables(p_church) then raise exception 'FORBIDDEN' using errcode='42501'; end if;
 select array_agg(id) into ids from public.congregations where church_id=p_church and is_headquarters and status='ACTIVE' and deleted_at is null;
 if coalesce(cardinality(ids),0)<>1 then raise exception 'CONFIGURATION_REQUIRED'; end if;
 return ids[1];
end $$;
revoke all on function private.finance_payables_headquarters(uuid) from public,anon;
grant execute on function private.finance_payables_headquarters(uuid) to authenticated;

do $$ declare pol record; begin
 for pol in select policyname from pg_policies where schemaname='public' and tablename='accounts_payable' loop
 execute format('drop policy %I on public.accounts_payable',pol.policyname); end loop;
end $$;
revoke all on public.accounts_payable from public,anon,authenticated;
grant select on public.accounts_payable to authenticated;
create policy cathedral_payable_read on public.accounts_payable for select to authenticated using (
 is_checklist and deleted_at is null and private.can_manage_payables(church_id)
 and exists(select 1 from public.congregations c where c.church_id=accounts_payable.church_id and c.id=accounts_payable.congregation_id and c.is_headquarters and c.status='ACTIVE' and c.deleted_at is null)
);
-- Related legacy documents must not make a payable readable through broader finance access.
create policy payable_document_restriction on public.financial_documents as restrictive for select to authenticated using (
 accounts_payable_id is null or exists(select 1 from public.accounts_payable a where a.church_id=financial_documents.church_id and a.id=accounts_payable_id)
);

create function private.payable_json(a public.accounts_payable) returns jsonb language sql stable set search_path='' as $$
 select jsonb_build_object('id',a.id,'name',a.description,'categoryId',a.category_id,
 'categoryName',coalesce((select name from public.financial_categories where church_id=a.church_id and id=a.category_id),'Categoria indisponível'),
 'dueDate',a.due_date,'amountCents',case when a.amount is null then null else (a.amount*100)::bigint end,'notes',coalesce(a.notes,''),
 'status',a.status,'paidDate',a.paid_date,'revision',a.revision,
 'copiedNextMonth',exists(select 1 from public.accounts_payable x where x.church_id=a.church_id and x.copied_from_id=a.id
 and x.copied_for_month=(date_trunc('month',a.due_date)+interval '1 month')::date and x.is_checklist));
$$;
revoke all on function private.payable_json(public.accounts_payable) from public,anon,authenticated;

create function public.query_finance_payables(p_church_id uuid,p_options jsonb) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare unit uuid; first_day date; last_day date; current_day date:=(now() at time zone 'America/Sao_Paulo')::date;
 st text:=coalesce(p_options->>'status','PENDING'); needle text:=btrim(coalesce(p_options->>'search','')); cat uuid; pg integer:=coalesce((p_options->>'page')::int,1);
 result jsonb; total bigint; pending_total bigint; paid_total bigint;
begin
 unit:=private.finance_payables_headquarters(p_church_id);
 if jsonb_typeof(p_options)<>'object' or p_options - array['month','status','search','categoryId','dateFrom','dateTo','page'] <> '{}'::jsonb
 or coalesce(p_options->>'month','')!~'^20[0-9]{2}-(0[1-9]|1[0-2])$' or st not in ('PENDING','PAID','ALL') or pg<1 or pg>100000 or length(needle)>120 then raise exception 'INVALID_INPUT'; end if;
 first_day:=(p_options->>'month'||'-01')::date; last_day:=(first_day+interval '1 month - 1 day')::date;
 if p_options ? 'dateFrom' or p_options ? 'dateTo' then
 if coalesce(p_options->>'dateFrom','')!~'^20[0-9]{2}-[0-9]{2}-[0-9]{2}$' or coalesce(p_options->>'dateTo','')!~'^20[0-9]{2}-[0-9]{2}-[0-9]{2}$' then raise exception 'INVALID_INPUT'; end if;
 first_day:=(p_options->>'dateFrom')::date; last_day:=(p_options->>'dateTo')::date;
 end if;
 if first_day>last_day then raise exception 'INVALID_INPUT'; end if;
 cat:=(p_options->>'categoryId')::uuid;
 select count(*) filter(where status='PENDING'),count(*) filter(where status='PAID') into pending_total,paid_total
 from public.accounts_payable where church_id=p_church_id and congregation_id=unit and is_checklist and deleted_at is null
 and due_date between first_day and last_day and (cat is null or category_id=cat) and strpos(lower(description),lower(needle))>0;
 total:=case st when 'PENDING' then pending_total when 'PAID' then paid_total else pending_total+paid_total end;
 pg:=least(pg,greatest(1,ceil(total/20.0)::int));
 select jsonb_build_object('churchId',p_church_id,'headquartersId',unit,'headquartersName',(select name from public.congregations where id=unit and church_id=p_church_id),
 'today',current_day,'start',first_day,'end',last_day,'page',pg,'count',total,'pendingCount',pending_total,'paidCount',paid_total,
 'items',coalesce((select jsonb_agg(private.payable_json(a) order by a.due_date,a.id) from (
 select a.* from public.accounts_payable a where church_id=p_church_id and congregation_id=unit and is_checklist and deleted_at is null
 and due_date between first_day and last_day and (st='ALL' or status=st) and (cat is null or category_id=cat)
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

create function public.get_finance_payable(p_church_id uuid,p_id uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare unit uuid; a public.accounts_payable;
begin
 unit:=private.finance_payables_headquarters(p_church_id);
 select * into a from public.accounts_payable where church_id=p_church_id and congregation_id=unit and id=p_id and is_checklist;
 if not found then raise exception 'FORBIDDEN' using errcode='42501'; end if;
 return jsonb_build_object('item',private.payable_json(a),'history',coalesce((select jsonb_agg(jsonb_build_object('id',e.id,'action',e.action,'at',e.occurred_at,
 'actorName',e.actor_name,'reason',e.reason,'before',e.before_values,'after',e.after_values) order by e.occurred_at,e.id)
 from private.finance_payable_events e where e.church_id=p_church_id and e.payable_id=p_id),'[]'::jsonb));
end $$;
revoke all on function public.get_finance_payable(uuid,uuid) from public,anon;
grant execute on function public.get_finance_payable(uuid,uuid) to authenticated;

create function private.validate_payable_values(p_church uuid,v jsonb) returns void language plpgsql set search_path='' as $$
declare cents numeric;
begin
 if jsonb_typeof(v)<>'object' or v-array['name','categoryId','dueDate','amountCents','notes']<>'{}'::jsonb
 or coalesce(length(btrim(v->>'name')),0) not between 1 and 120 or length(coalesce(v->>'notes',''))>1000
 or coalesce(v->>'dueDate','')!~'^20[0-9]{2}-[0-9]{2}-[0-9]{2}$' or not (v ? 'amountCents') then raise exception 'INVALID_INPUT'; end if;
 perform (v->>'dueDate')::date;
 if v->>'amountCents' is not null then
 if jsonb_typeof(v->'amountCents')<>'number' then raise exception 'INVALID_INPUT'; end if;
 cents:=(v->>'amountCents')::numeric;
 if cents<>trunc(cents) or cents<1 or cents>999999999999 then raise exception 'INVALID_INPUT'; end if;
 end if;
 if not exists(select 1 from public.financial_categories where church_id=p_church and id=(v->>'categoryId')::uuid
 and category_type in ('EXPENSE','BOTH') and status='ACTIVE' and deleted_at is null) then raise exception 'INACTIVE_REFERENCE'; end if;
end $$;
revoke all on function private.validate_payable_values(uuid,jsonb) from public,anon,authenticated;

create function public.execute_finance_payable(p_church_id uuid,p_command jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
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
 if original.revision is distinct from (entry->>'revision')::integer then raise exception 'CONFLICT' using errcode='40001'; end if;
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
 if rev is distinct from a.revision then raise exception 'CONFLICT' using errcode='40001'; end if;
 before_data:=private.payable_json(a);
 if (kind='REOPEN' and a.status<>'PAID') or (kind<>'REOPEN' and a.status<>'PENDING') then raise exception 'CONFLICT' using errcode='40001'; end if;
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
