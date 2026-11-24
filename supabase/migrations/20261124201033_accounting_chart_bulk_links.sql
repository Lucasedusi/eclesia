begin;

-- Accounting metadata is visible only through authorized accounting RPCs.
create table private.accounting_chart (
  church_id uuid not null references public.churches(id),
  code text not null check (code ~ '^[0-9]{1,32}$'),
  classification text not null check (length(classification) <= 100 and classification ~ '^[0-9]+([.][0-9]+)*$'),
  name text not null check (length(trim(name)) between 1 and 250),
  primary key(church_id, code)
);
create table private.accounting_category_links (
  church_id uuid not null,
  category_id uuid not null,
  direction text not null check (direction in ('INCOME','EXPENSE','REVIEW')),
  code text not null check (code ~ '^[0-9]{1,32}$'),
  primary key(church_id,category_id,direction),
  foreign key(church_id,category_id) references public.financial_categories(church_id,id)
);
alter table private.accounting_chart enable row level security;
alter table private.accounting_category_links enable row level security;
revoke all on private.accounting_chart, private.accounting_category_links from public,anon,authenticated;

-- Preserve the direction of existing single-use links. A dual-use category
-- keeps its former code as a review hint until the administrator chooses a side.
lock table public.financial_categories in share row exclusive mode;
insert into private.accounting_category_links(church_id,category_id,direction,code)
select church_id,id,case when category_type in ('INCOME','EXPENSE') then category_type else 'REVIEW' end,accounting_code
from public.financial_categories where accounting_code is not null;
-- Keep the previous column for API compatibility, with all values now private.
update public.financial_categories set accounting_code=null where accounting_code is not null;

create function private.accounting_catalog_categories(p_church uuid) returns jsonb
language sql stable security definer set search_path='' as $$
 select coalesce(jsonb_agg(jsonb_build_object('id',c.id,'name',c.name,'direction',c.category_type,'code',l.code)
   order by c.name,c.id),'[]') from public.financial_categories c
 left join private.accounting_category_links l on (l.church_id,l.category_id,l.direction)=(c.church_id,c.id,c.category_type)
 where c.church_id=p_church and c.deleted_at is null and exists(select from private.accounting_units(p_church))
$$;
revoke all on function private.accounting_catalog_categories(uuid) from public,anon,authenticated;
grant execute on function private.accounting_catalog_categories(uuid) to authenticated;

create or replace function public.finance_accounting_catalog(p_church uuid) returns jsonb
language sql stable security invoker set search_path='' as $$
 with units as materialized (select * from private.accounting_units(p_church))
 select jsonb_build_object(
 'units',coalesce((select jsonb_agg(to_jsonb(u) order by u.name,u.id) from units u),'[]'),
 'boxes',coalesce((select jsonb_agg(jsonb_build_object('id',b.id,'unit',b.congregation_id,'name',b.name,'code',b.accounting_code) order by b.name,b.id)
   from public.financial_cashboxes b join units u on u.id=b.congregation_id where b.church_id=p_church and b.deleted_at is null),'[]'),
 'categories',private.accounting_catalog_categories(p_church))
$$;

create function private.accounting_plan_state(p_church uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare result jsonb;
begin
 if not private.can_manage_finance_reports(p_church,true) or not exists(select from private.accounting_units(p_church))
 then raise exception 'FORBIDDEN' using errcode='42501'; end if;
 select jsonb_build_object(
 'accounts',coalesce((select jsonb_agg(jsonb_build_object('classification',classification,'name',name,'code',code) order by classification,code)
  from private.accounting_chart where church_id=p_church),'[]'),
 'categories',coalesce((select jsonb_agg(jsonb_build_object('id',c.id,'name',c.name,'direction',c.category_type,
   'income',i.code,'expense',e.code,'legacy',r.code) order by c.name,c.id)
   from public.financial_categories c
   left join private.accounting_category_links i on (i.church_id,i.category_id,i.direction)=(c.church_id,c.id,'INCOME')
   left join private.accounting_category_links e on (e.church_id,e.category_id,e.direction)=(c.church_id,c.id,'EXPENSE')
   left join private.accounting_category_links r on (r.church_id,r.category_id,r.direction)=(c.church_id,c.id,'REVIEW')
   where c.church_id=p_church and c.deleted_at is null),'[]')) into result;
 return result || jsonb_build_object('revision',md5(result::text));
end $$;
create function public.finance_accounting_plan(p_church uuid) returns jsonb
language sql stable security invoker set search_path='' as $$ select private.accounting_plan_state(p_church) $$;

create function private.is_posting_account(p_church uuid,p_code text) returns boolean
language sql stable security invoker set search_path='' as $$
 select exists(select from private.accounting_chart a where a.church_id=p_church and a.code=p_code
 and not exists(select from private.accounting_chart child where child.church_id=a.church_id
 and starts_with(child.classification,a.classification||'.')))
$$;
revoke all on function private.is_posting_account(uuid,text) from public,anon,authenticated;

create function private.apply_accounting_plan(p_church uuid,p_revision text,p_accounts jsonb,p_links jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare
 state jsonb; unit uuid; item record; category public.financial_categories; previous text;
begin
 if not private.can_manage_finance_reports(p_church,true) or not exists(select from private.accounting_units(p_church))
 then raise exception 'FORBIDDEN' using errcode='42501'; end if;
 -- Share the lock with financial category creation and individual code edits.
 perform pg_advisory_xact_lock(hashtextextended(p_church::text,0));
 state:=private.accounting_plan_state(p_church);
 if state->>'revision' is distinct from p_revision then raise exception 'CONFLICT'; end if;
 if jsonb_typeof(p_accounts) is distinct from 'array' or jsonb_typeof(p_links) is distinct from 'array'
 or jsonb_array_length(p_accounts)>4000 or jsonb_array_length(p_links)>2000 then raise exception 'INVALID_INPUT'; end if;
 if exists(select from jsonb_to_recordset(p_accounts) a(code text) group by code having count(*)>1)
 or exists(select from jsonb_to_recordset(p_links) a(category uuid,name text,direction text)
    group by coalesce(a.category::text,lower(trim(a.name))),a.direction having count(*)>1) then raise exception 'INVALID_INPUT'; end if;
 insert into private.accounting_chart(church_id,code,classification,name)
 select p_church,code,classification,trim(name) from jsonb_to_recordset(p_accounts) a(code text,classification text,name text)
 on conflict(church_id,code) do update set classification=excluded.classification,name=excluded.name
 where (accounting_chart.classification,accounting_chart.name) is distinct from (excluded.classification,excluded.name);

 select id into unit from private.accounting_units(p_church) order by id limit 1;
 for item in select * from jsonb_to_recordset(p_links) a(category uuid,name text,direction text,code text)
 loop
  if item.direction is null or item.direction not in ('INCOME','EXPENSE') or
     (item.code is not null and not private.is_posting_account(p_church,item.code)) then raise exception 'INVALID_INPUT'; end if;
  if item.category is null then
   if item.code is null or exists(select from public.financial_categories where church_id=p_church and deleted_at is null and lower(name)=lower(trim(item.name))) then raise exception 'CONFLICT'; end if;
   item.category:=(public.save_finance_catalog(p_church,jsonb_build_object('entity','CATEGORY','congregationId',unit,'name',item.name,'direction',item.direction))->>'id')::uuid;
  end if;
  select * into category from public.financial_categories where church_id=p_church and id=item.category and deleted_at is null for update;
  if not found or category.category_type not in (item.direction,'BOTH') then raise exception 'INVALID_INPUT'; end if;
  select code into previous from private.accounting_category_links where church_id=p_church and category_id=item.category and direction=item.direction;
  if item.code is null then
   delete from private.accounting_category_links where church_id=p_church and category_id=item.category and direction=item.direction;
  else
   insert into private.accounting_category_links values(p_church,item.category,item.direction,item.code)
   on conflict(church_id,category_id,direction) do update set code=excluded.code;
  end if;
  delete from private.accounting_category_links r where r.church_id=p_church and r.category_id=item.category
   and r.direction='REVIEW' and (r.code=item.code or
    (select count(*) from private.accounting_category_links l where l.church_id=p_church and l.category_id=item.category and l.direction<>'REVIEW')=2);
  if previous is distinct from item.code then
   perform public.log_audit(p_church,'finance','SET_ACCOUNTING_CODE','CATEGORY',item.category,null,null,null,
    jsonb_build_object('direction',item.direction,'previous',previous,'code',item.code),null,'INFO');
  end if;
 end loop;
 if exists(select from private.accounting_category_links l
   join private.accounting_chart a on a.church_id=l.church_id and a.code=l.code
   join public.financial_categories c on c.church_id=l.church_id and c.id=l.category_id
   where l.church_id=p_church and l.direction<>'REVIEW' and c.deleted_at is null and exists(
    select from private.accounting_chart child where child.church_id=a.church_id and starts_with(child.classification,a.classification||'.')))
 then raise exception 'ACCOUNTING_PLAN_GROUP'; end if;
 if jsonb_array_length(p_accounts)>0 then
  perform public.log_audit(p_church,'finance','IMPORT_ACCOUNTING_CHART','CHURCH',p_church,null,null,null,
    jsonb_build_object('accounts',jsonb_array_length(p_accounts)),null,'INFO');
 end if;
 return private.accounting_plan_state(p_church);
end $$;
create function public.apply_finance_accounting_plan(p_church uuid,p_revision text,p_accounts jsonb,p_links jsonb) returns jsonb
language sql security invoker set search_path='' as $$ select private.apply_accounting_plan(p_church,p_revision,p_accounts,p_links) $$;

do $$
declare f regprocedure;
begin
 foreach f in array array['public.finance_accounting_plan(uuid)'::regprocedure,'private.accounting_plan_state(uuid)'::regprocedure,
 'public.apply_finance_accounting_plan(uuid,text,jsonb,jsonb)'::regprocedure,'private.apply_accounting_plan(uuid,text,jsonb,jsonb)'::regprocedure] loop
  execute format('revoke all on function %s from public,anon,authenticated',f);
  execute format('grant execute on function %s to authenticated',f);
 end loop;
end $$;

create or replace function private.set_accounting_code(p_church uuid,p_kind text,p_id uuid,p_code text,p_previous text) returns void
language plpgsql security definer set search_path='' as $$
declare old_code text; movement text;
begin
 if not private.can_manage_finance_reports(p_church,true) then raise insufficient_privilege; end if;
 perform pg_advisory_xact_lock(hashtextextended(p_church::text,0));
 if p_code is not null and p_code !~ '^[0-9]{1,32}$' then raise exception 'INVALID_INPUT'; end if;
 if p_kind='CASHBOX' then
  select accounting_code into old_code from public.financial_cashboxes where church_id=p_church and id=p_id and deleted_at is null for update;
 elsif p_kind='CATEGORY' then
  select category_type into movement from public.financial_categories where church_id=p_church and id=p_id and deleted_at is null for update;
 else raise exception 'INVALID_INPUT';
 end if;
 if not found then raise exception 'INVALID_INPUT'; end if;
 if p_kind='CATEGORY' then
  select code into old_code from private.accounting_category_links where church_id=p_church and category_id=p_id and direction=movement;
  if movement='BOTH' then raise exception 'CONFIGURATION_REQUIRED'; end if;
  if p_code is not null and exists(select from private.accounting_chart where church_id=p_church)
   and not private.is_posting_account(p_church,p_code) then raise exception 'INVALID_INPUT'; end if;
 end if;
 if old_code is not distinct from p_code then return; end if;
 if old_code is distinct from p_previous then raise exception 'CONFLICT'; end if;
 if p_kind='CASHBOX' then
  update public.financial_cashboxes set accounting_code=p_code where church_id=p_church and id=p_id;
 else
  if p_code is null then
   delete from private.accounting_category_links where church_id=p_church and category_id=p_id and direction=movement;
  else
   insert into private.accounting_category_links values(p_church,p_id,movement,p_code)
   on conflict(church_id,category_id,direction) do update set code=excluded.code;
  end if;
 end if;
 perform public.log_audit(p_church,'finance','SET_ACCOUNTING_CODE',p_kind,p_id,null,null,null,jsonb_build_object('previous',old_code,'code',p_code),null,'INFO');
end $$;

create or replace function private.accounting_snapshot(p_church uuid,p_filters jsonb) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare
 u uuid := (p_filters->>'unit')::uuid; b uuid := (p_filters->>'box')::uuid;
 d1 date := (p_filters->>'start')::date; d2 date := (p_filters->>'end')::date;
 dir text := p_filters->>'direction'; allowed uuid[]; result jsonb;
begin
 select array_agg(id) into allowed from private.accounting_units(p_church) where u is null or id=u;
 if allowed is null then raise exception 'FORBIDDEN' using errcode='42501'; end if;
 if d1 is null or d2 is null or d1>d2 or dir is null or dir not in ('ALL','INCOME','EXPENSE') then raise exception 'INVALID_INPUT'; end if;
 if b is not null and not exists(select from public.financial_cashboxes where church_id=p_church and congregation_id=any(allowed) and id=b and deleted_at is null)
 then raise exception 'FORBIDDEN' using errcode='42501'; end if;

 with source as materialized (
 select t.id,t.revision,t.transaction_date date,t.transaction_type direction,(t.amount*100)::bigint cents,
  c.name unit,box.name box,coalesce(t.category_name,cat.name) category,
  case when t.transaction_type='INCOME' then box.accounting_code else mapping.code end debit,
  case when t.transaction_type='INCOME' then mapping.code else box.accounting_code end credit,
  coalesce(t.document_number,t.transaction_number,'') document,
  coalesce(nullif(trim(t.description),''),t.category_name,cat.name,'') memo,
  case when t.contributor_congregation_id is not null then t.person_name end payer,
  case when box.accounting_code is null then 'Código do caixa ou conta' end box_issue,
  case when mapping.code is null then 'Código da categoria' end category_issue,
  exists(select from private.finance_accounting_items i where i.church_id=t.church_id and i.transaction_id=t.id) exported
 from public.financial_transactions t join public.congregations c on c.church_id=t.church_id and c.id=t.congregation_id
 left join public.financial_cashboxes box on box.church_id=t.church_id and box.congregation_id=t.congregation_id and box.id=t.cashbox_id and box.deleted_at is null
 left join public.financial_categories cat on cat.church_id=t.church_id and cat.id=t.category_id and cat.deleted_at is null
 left join private.accounting_category_links mapping on mapping.church_id=cat.church_id and mapping.category_id=cat.id and mapping.direction=t.transaction_type
 where t.church_id=p_church and t.congregation_id=any(allowed) and t.deleted_at is null and t.status='CONFIRMED'
 and t.transaction_date between d1 and d2 and (b is null or t.cashbox_id=b) and (dir='ALL' or t.transaction_type=dir)
 ), special as (
 select t.transaction_date date,'Transferência' kind,t.id from public.financial_transfers t
 where t.church_id=p_church and t.congregation_id=any(allowed) and t.deleted_at is null and t.status='CONFIRMED'
 and t.transaction_date between d1 and d2 and (b is null or b in(t.source_cashbox_id,t.target_cashbox_id))
 union all
 select l.financial_date,'Ajuste de saldo',l.id from public.financial_ledger_entries l
 where l.church_id=p_church and l.congregation_id=any(allowed) and l.entry_kind='ADJUSTMENT' and l.deleted_at is null
 and l.financial_date between d1 and d2 and (b is null or l.cashbox_id=b)
 )
 select jsonb_build_object(
 'rows',coalesce(jsonb_agg(to_jsonb(s) order by s.date,s.id),'[]'),
 'fingerprint',md5(coalesce(jsonb_agg(to_jsonb(s)-'exported' order by s.date,s.id)::text,'[]')),
 'total',count(*),'previous',count(*) filter(where exported),
 'missing',count(*) filter(where box_issue is not null or category_issue is not null),
 'income',coalesce(sum(cents) filter(where direction='INCOME'),0),'expense',coalesce(sum(cents) filter(where direction='EXPENSE'),0),
 'special',coalesce((select jsonb_agg(to_jsonb(x) order by date,kind) from (select date,kind,count(*) quantity from special group by date,kind)x),'[]')
 ) into result from source s;
 return result;
end $$;

commit;
