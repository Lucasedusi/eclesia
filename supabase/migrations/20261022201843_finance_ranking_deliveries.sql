-- Administrative reports use the same active ADMIN/CHURCH access for role and permission.
create or replace function private.can_manage_finance_reports(p_church uuid, p_settings boolean default false)
returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.user_church_access a
 join public.profiles p on p.id=a.profile_id and p.status='ACTIVE' and p.deleted_at is null
 join public.churches c on c.id=a.church_id and c.status='ACTIVE' and c.deleted_at is null
 where a.profile_id=(select auth.uid()) and a.church_id=p_church and a.role='ADMIN'
 and a.access_scope='CHURCH' and a.status='ACTIVE' and a.deleted_at is null
 and private.access_has_permission(a.id,'finance.view')
 and (not p_settings or private.access_has_permission(a.id,'finance.settings.manage')));
$$;
revoke all on function private.can_manage_finance_reports(uuid,boolean) from public,anon;
grant execute on function private.can_manage_finance_reports(uuid,boolean) to authenticated;

create or replace function public.get_finance_ranking_report(p_church_id uuid,p_options jsonb)
returns jsonb language plpgsql stable security invoker set search_path='' as $$
declare u record; result jsonb:='[]'; first_month date; last_month date; n integer; opts jsonb;
begin
 if not private.can_manage_finance_reports(p_church_id) then raise exception 'FORBIDDEN' using errcode='42501'; end if;
 if p_options is null or jsonb_typeof(p_options)<>'object' or p_options->>'type' is distinct from 'RANKING'
 or jsonb_typeof(p_options->'includeInactive') is distinct from 'boolean' then raise exception 'INVALID_INPUT' using errcode='22023'; end if;
 opts:=(p_options-'includeInactive')||'{"type":"INFORMATIVE"}';
 if coalesce(opts->>'startMonth','') !~ '^20[0-9]{2}-(0[1-9]|1[0-2])$' or coalesce(opts->>'endMonth','') !~ '^20[0-9]{2}-(0[1-9]|1[0-2])$' then raise exception 'INVALID_INPUT' using errcode='22023';end if;
 first_month:=((opts->>'startMonth')||'-01')::date;last_month:=((opts->>'endMonth')||'-01')::date;
 if last_month<first_month or last_month>=first_month+interval '60 months'
 or jsonb_typeof(opts->'includePrebend') is distinct from 'boolean'
 or jsonb_typeof(opts->'includeTransfer') is distinct from 'boolean'
 or exists(select 1 from jsonb_object_keys(opts) k where k not in ('type','startMonth','endMonth','includePrebend','includeTransfer'))
 then raise exception 'INVALID_INPUT' using errcode='22023'; end if;
 select count(*) into n from public.congregations where church_id=p_church_id and deleted_at is null
 and (status='ACTIVE' or (p_options->>'includeInactive')::boolean) and private.can_access_finance_unit(p_church_id,id,'finance.view');
 -- Never silently truncate units or months; bound the work for a single synchronous PDF.
 if n*((extract(year from age(last_month,first_month))*12)+extract(month from age(last_month,first_month))+1)>3000 then raise exception 'REPORT_TOO_LARGE'; end if;
 for u in select id,name,status,is_headquarters from public.congregations where church_id=p_church_id and deleted_at is null
 and (status='ACTIVE' or (p_options->>'includeInactive')::boolean) and private.can_access_finance_unit(p_church_id,id,'finance.view') order by name,id loop
 result:=result||jsonb_build_array(jsonb_build_object('id',u.id,'name',u.name,'status',u.status,'isHeadquarters',u.is_headquarters,
 'report',public.get_finance_informative_report(p_church_id,u.id,opts)));
 end loop;
 return p_options||jsonb_build_object('generatedAt',statement_timestamp(),'units',result);
end $$;
revoke all on function public.get_finance_ranking_report(uuid,jsonb) from public,anon;
grant execute on function public.get_finance_ranking_report(uuid,jsonb) to authenticated;

-- Append-only policy versions and delivery events. No direct client writes.
create table public.finance_delivery_deadlines (
 id uuid primary key default gen_random_uuid(), church_id uuid not null references public.churches(id),
 effective_month date not null check(extract(day from effective_month)=1), due_day integer not null check(due_day between 1 and 31),
 revision integer not null check(revision>0), operation_key uuid not null, payload jsonb not null,
 created_by uuid not null references public.profiles(id), created_at timestamptz not null default now(), deleted_at timestamptz,
 unique(church_id,revision), unique(church_id,created_by,operation_key)
);
create index finance_delivery_deadlines_actor on public.finance_delivery_deadlines(created_by);
create index finance_delivery_deadlines_effective on public.finance_delivery_deadlines(church_id,effective_month desc,revision desc);
create table public.finance_delivery_events (
 id uuid primary key default gen_random_uuid(), church_id uuid not null references public.churches(id), congregation_id uuid not null,
 report_delivery_id uuid not null, reference_month date not null check(extract(day from reference_month)=1),
 action text not null check(action in ('RECEIVE','CORRECT','UNDO')), delivery_date date,
 due_date date not null, revision integer not null check(revision>0), reason text not null default '',
 operation_key uuid not null, payload jsonb not null, created_by uuid not null references public.profiles(id),
 created_at timestamptz not null default now(), deleted_at timestamptz,
 foreign key(church_id,congregation_id) references public.congregations(church_id,id),
 foreign key(church_id,report_delivery_id) references public.report_deliveries(church_id,id),
 unique(church_id,report_delivery_id,revision), unique(church_id,created_by,operation_key),
 check((action='UNDO')=(delivery_date is null)), check(action='RECEIVE' or length(trim(reason))>=5)
);
create index finance_delivery_events_actor on public.finance_delivery_events(created_by);
create index finance_delivery_events_month on public.finance_delivery_events(church_id,congregation_id,reference_month,revision desc);
create trigger immutable_finance_delivery_events before update or delete on public.finance_delivery_events for each row execute function private.finance_immutable();
create trigger immutable_finance_delivery_deadlines before update or delete on public.finance_delivery_deadlines for each row execute function private.finance_immutable();
alter table public.finance_delivery_deadlines enable row level security;
alter table public.finance_delivery_events enable row level security;
revoke all on public.finance_delivery_deadlines,public.finance_delivery_events from public,anon,authenticated;
grant select on public.finance_delivery_deadlines,public.finance_delivery_events to authenticated;
create policy admin_read on public.finance_delivery_deadlines for select to authenticated using(deleted_at is null and private.can_manage_finance_reports(church_id));
create policy admin_read on public.finance_delivery_events for select to authenticated using(deleted_at is null and private.can_manage_finance_reports(church_id) and private.can_access_finance_unit(church_id,congregation_id,'finance.view'));

create or replace function private.finance_delivery_due_date(p_church uuid,p_month date) returns date
language sql stable security invoker set search_path='' as $$
 select (p_month+interval '1 month')::date + least(
 coalesce((select due_day from public.finance_delivery_deadlines where church_id=p_church and deleted_at is null and effective_month<=p_month order by effective_month desc,revision desc limit 1),8),
 extract(day from p_month+interval '2 months'-interval '1 day')::int)-1;
$$;
revoke all on function private.finance_delivery_due_date(uuid,date) from public,anon;
grant execute on function private.finance_delivery_due_date(uuid,date) to authenticated;

create or replace function public.list_finance_deliveries(p_church_id uuid,p_month text,p_include_inactive boolean)
returns jsonb language plpgsql stable security invoker set search_path='' as $$
declare m date; due date; rows jsonb; rules jsonb;
begin
 if not private.can_manage_finance_reports(p_church_id) then raise exception 'FORBIDDEN' using errcode='42501'; end if;
 if coalesce(p_month,'') !~ '^20[0-9]{2}-(0[1-9]|1[0-2])$' then raise exception 'INVALID_INPUT' using errcode='22023';end if;
 m:=(p_month||'-01')::date;
 if p_include_inactive is null then raise exception 'INVALID_INPUT' using errcode='22023'; end if;
 due:=private.finance_delivery_due_date(p_church_id,m);
 select coalesce(jsonb_agg(jsonb_build_object('id',c.id,'name',c.name,'status',c.status,
 'deliveryDate',(d.delivered_at at time zone 'America/Sao_Paulo')::date,
 'revision',coalesce(ev.revision,0),'history',coalesce(ev.history,'[]'::jsonb)) order by c.name,c.id),'[]') into rows
 from public.congregations c
 left join lateral (select id,delivered_at from public.report_deliveries where church_id=p_church_id and congregation_id=c.id and reference_year=extract(year from m) and reference_month=extract(month from m) and deleted_at is null and status<>'CANCELLED' order by created_at,id limit 1) d on true
 left join lateral (select max(e.revision) revision,jsonb_agg(jsonb_build_object('action',e.action,'deliveryDate',e.delivery_date,'dueDate',e.due_date,'reason',e.reason,'revision',e.revision,'createdAt',e.created_at,'actor',coalesce(p.display_name,p.full_name,'Administrador')) order by e.revision desc) history
 from public.finance_delivery_events e left join public.profiles p on p.id=e.created_by
 where e.church_id=p_church_id and e.congregation_id=c.id and e.report_delivery_id=d.id and e.deleted_at is null) ev on true
 where c.church_id=p_church_id and c.deleted_at is null and not c.is_headquarters
 and (c.status='ACTIVE' or p_include_inactive) and private.can_access_finance_unit(p_church_id,c.id,'finance.view');
 select coalesce(jsonb_agg(jsonb_build_object('effectiveMonth',to_char(effective_month,'YYYY-MM'),'day',due_day,'revision',revision) order by effective_month desc,revision desc),'[]') into rules
 from public.finance_delivery_deadlines where church_id=p_church_id and deleted_at is null;
 return jsonb_build_object('month',p_month,'includeInactive',p_include_inactive,'dueDate',due,'today',(now() at time zone 'America/Sao_Paulo')::date,'rows',rows,'rules',rules,'generatedAt',statement_timestamp());
end $$;
revoke all on function public.list_finance_deliveries(uuid,text,boolean) from public,anon;
grant execute on function public.list_finance_deliveries(uuid,text,boolean) to authenticated;

-- Definer is required because finance domain tables intentionally deny direct writes.
-- The same church lock as statement generation prevents duplicate monthly parents.
create or replace function public.record_finance_delivery(p_church_id uuid,p_payload jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare u uuid; m date; d date; op uuid; expected integer; act text; reason text; parent public.report_deliveries;
 previous public.finance_delivery_events; rev integer; due date;
begin
 if not private.can_manage_finance_reports(p_church_id) then raise exception 'FORBIDDEN' using errcode='42501'; end if;
 if p_payload is null or jsonb_typeof(p_payload)<>'object' or exists(select 1 from jsonb_object_keys(p_payload) k where k not in ('congregationId','month','deliveryDate','action','reason','expectedRevision','operationKey')) then raise exception 'INVALID_INPUT' using errcode='22023'; end if;
 u:=(p_payload->>'congregationId')::uuid;m:=private.finance_month(p_payload->>'month');op:=(p_payload->>'operationKey')::uuid;
 expected:=(p_payload->>'expectedRevision')::integer;act:=p_payload->>'action';reason:=trim(coalesce(p_payload->>'reason',''));
 if op is null or expected is null or expected<0 or act is null or act not in ('RECEIVE','CORRECT','UNDO') or length(reason)>500 then raise exception 'INVALID_INPUT' using errcode='22023'; end if;
 if not exists(select 1 from public.congregations where id=u and church_id=p_church_id and deleted_at is null and not is_headquarters)
 or not private.can_access_finance_unit(p_church_id,u,'finance.view') then raise exception 'FORBIDDEN' using errcode='42501'; end if;
 if act='UNDO' then
 if p_payload->'deliveryDate' is distinct from 'null'::jsonb then raise exception 'INVALID_INPUT' using errcode='22023';end if;
 else
 if coalesce(p_payload->>'deliveryDate','') !~ '^20[0-9]{2}-(0[1-9]|1[0-2])-(0[1-9]|[12][0-9]|3[01])$' then raise exception 'INVALID_INPUT' using errcode='22023';end if;
 d:=(p_payload->>'deliveryDate')::date;
 if d<(m+interval '1 month')::date or d>(now() at time zone 'America/Sao_Paulo')::date then raise exception 'INVALID_INPUT' using errcode='22023';end if;
 end if;
 if act<>'RECEIVE' and length(reason)<5 then raise exception 'INVALID_INPUT' using errcode='22023'; end if;
 perform pg_advisory_xact_lock(hashtextextended(p_church_id::text,0));
 select * into previous from public.finance_delivery_events where church_id=p_church_id and created_by=auth.uid() and operation_key=op;
 if previous.id is not null then
 if previous.payload<>p_payload then raise exception 'IDEMPOTENCY_CONFLICT'; end if;
 return jsonb_build_object('revision',previous.revision);end if;
 select * into parent from public.report_deliveries where church_id=p_church_id and congregation_id=u and reference_year=extract(year from m) and reference_month=extract(month from m) and deleted_at is null and status<>'CANCELLED' order by created_at,id limit 1 for update;
 select coalesce(max(revision),0) into rev from public.finance_delivery_events where church_id=p_church_id and report_delivery_id=parent.id;
 if rev<>expected or (act='RECEIVE' and parent.delivered_at is not null) or (act<>'RECEIVE' and parent.delivered_at is null) then raise exception 'CONFLICT'; end if;
 if parent.id is null then
 insert into public.report_deliveries(church_id,congregation_id,reference_month,reference_year,period_start,period_end,status,created_by,metadata)
 values(p_church_id,u,extract(month from m),extract(year from m),m,(m+interval '1 month'-interval '1 day')::date,'DRAFT',auth.uid(),jsonb_build_object('descriptive_only',true,'can_generate_financial_transactions',false)) returning * into parent;
 end if;
 due:=private.finance_delivery_due_date(p_church_id,m);
 update public.report_deliveries set delivered_at=case when d is null then null else (d+time '12:00') at time zone 'America/Sao_Paulo' end,
 delivered_by=case when d is null then null else auth.uid() end,
 status=case when d is not null then 'DELIVERED' when exists(select 1 from public.report_delivery_versions where church_id=p_church_id and report_delivery_id=parent.id and deleted_at is null) then 'CALCULATED' else 'DRAFT' end,updated_at=now()
 where church_id=p_church_id and id=parent.id;
 insert into public.finance_delivery_events(church_id,congregation_id,report_delivery_id,reference_month,action,delivery_date,due_date,revision,reason,operation_key,payload,created_by)
 values(p_church_id,u,parent.id,m,act,d,due,rev+1,reason,op,p_payload,auth.uid());
 perform public.log_audit(p_church_id,'finance','REPORT_DELIVERY_'||act,'report_deliveries',parent.id,null,null,null,jsonb_build_object('month',to_char(m,'YYYY-MM'),'deliveryDate',d,'revision',rev+1),null,'INFO');
 return jsonb_build_object('revision',rev+1);
end $$;
revoke all on function public.record_finance_delivery(uuid,jsonb) from public,anon;
grant execute on function public.record_finance_delivery(uuid,jsonb) to authenticated;

create or replace function public.save_finance_delivery_deadline(p_church_id uuid,p_payload jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare m date; day integer; expected integer; rev integer; op uuid; previous public.finance_delivery_deadlines;
begin
 if not private.can_manage_finance_reports(p_church_id,true) then raise exception 'FORBIDDEN' using errcode='42501';end if;
 if p_payload is null or jsonb_typeof(p_payload)<>'object' or exists(select 1 from jsonb_object_keys(p_payload) k where k not in ('effectiveMonth','day','expectedRevision','operationKey')) then raise exception 'INVALID_INPUT' using errcode='22023';end if;
 m:=private.finance_month(p_payload->>'effectiveMonth');day:=(p_payload->>'day')::integer;expected:=(p_payload->>'expectedRevision')::integer;op:=(p_payload->>'operationKey')::uuid;
 if day is null or day not between 1 and 31 or expected is null or expected<0 or op is null then raise exception 'INVALID_INPUT' using errcode='22023';end if;
 perform pg_advisory_xact_lock(hashtextextended(p_church_id::text,0));
 select * into previous from public.finance_delivery_deadlines where church_id=p_church_id and created_by=auth.uid() and operation_key=op;
 if previous.id is not null then if previous.payload<>p_payload then raise exception 'IDEMPOTENCY_CONFLICT';end if;return jsonb_build_object('revision',previous.revision);end if;
 if m<date_trunc('month',now() at time zone 'America/Sao_Paulo')::date then raise exception 'INVALID_INPUT' using errcode='22023';end if;
 select coalesce(max(revision),0) into rev from public.finance_delivery_deadlines where church_id=p_church_id;
 if rev<>expected then raise exception 'CONFLICT';end if;
 insert into public.finance_delivery_deadlines(church_id,effective_month,due_day,revision,operation_key,payload,created_by) values(p_church_id,m,day,rev+1,op,p_payload,auth.uid());
 perform public.log_audit(p_church_id,'finance','REPORT_DELIVERY_DEADLINE','finance_delivery_deadlines',null,null,null,null,jsonb_build_object('effectiveMonth',to_char(m,'YYYY-MM'),'day',day,'revision',rev+1),null,'INFO');
 return jsonb_build_object('revision',rev+1);
end $$;
revoke all on function public.save_finance_delivery_deadline(uuid,jsonb) from public,anon;
grant execute on function public.save_finance_delivery_deadline(uuid,jsonb) to authenticated;
