begin;

insert into public.permissions(key,name,description,module,action,is_sensitive,status)
values ('finance.accounting.export','Consultar e exportar contabilidade','Conferir lançamentos e gerar lotes Alterdata nas congregações autorizadas.','finance','export',true,'ACTIVE');
insert into public.role_permissions(role,permission_id,status)
select 'ADMIN',id,'ACTIVE' from public.permissions where key='finance.accounting.export' and deleted_at is null;

alter table public.financial_cashboxes add column accounting_code text check (accounting_code ~ '^[0-9]{1,32}$');
alter table public.financial_categories add column accounting_code text check (accounting_code ~ '^[0-9]{1,32}$');

create table private.finance_accounting_batches (
 id uuid primary key default gen_random_uuid(),
 church_id uuid not null references public.churches(id),
 congregation_id uuid not null, cashbox_id uuid not null,
 date_from date not null, date_to date not null, direction text not null,
 created_at timestamptz not null default now(), created_by uuid not null references public.profiles(id),
 actor_name text not null, confirmed_at timestamptz, confirmed_by uuid references public.profiles(id),
 income_cents bigint not null, expense_cents bigint not null, row_count integer not null,
 fingerprint text not null, unique(church_id,id),
 unique(church_id,cashbox_id,date_from,date_to,direction,fingerprint),
 foreign key(church_id,congregation_id) references public.congregations(church_id,id),
 foreign key(church_id,cashbox_id) references public.financial_cashboxes(church_id,id)
);
create index accounting_batches_scope on private.finance_accounting_batches(church_id,congregation_id,created_at desc);
create index accounting_batches_actor on private.finance_accounting_batches(created_by);
create index accounting_batches_confirmer on private.finance_accounting_batches(confirmed_by) where confirmed_by is not null;
create table private.finance_accounting_items (
 church_id uuid not null, batch_id uuid not null, transaction_id uuid not null, revision integer not null,
 primary key(church_id,batch_id,transaction_id),
 foreign key(church_id,batch_id) references private.finance_accounting_batches(church_id,id),
 foreign key(church_id,transaction_id) references public.financial_transactions(church_id,id)
);
create index accounting_items_transaction on private.finance_accounting_items(church_id,transaction_id);

alter table private.finance_accounting_batches enable row level security;
alter table private.finance_accounting_items enable row level security;
revoke all on private.finance_accounting_batches, private.finance_accounting_items from public, anon, authenticated;

create function private.accounting_units(p_church uuid)
returns table(id uuid,name text) language sql stable security definer set search_path='' as $$
 select c.id,c.name from public.congregations c where c.church_id=p_church and c.deleted_at is null
 and c.status='ACTIVE' and exists(select from public.profiles p where p.id=(select auth.uid()) and p.status='ACTIVE' and p.deleted_at is null)
 and private.can_access_finance_unit(p_church,c.id,'finance.view')
 and private.can_access_finance_unit(p_church,c.id,'finance.accounting.export')
$$;

create function public.finance_accounting_catalog(p_church uuid) returns jsonb
language sql stable security invoker set search_path='' as $$
 with units as materialized (select * from private.accounting_units(p_church))
 select jsonb_build_object(
 'units',coalesce((select jsonb_agg(to_jsonb(u) order by u.name,u.id) from units u),'[]'),
 'boxes',coalesce((select jsonb_agg(jsonb_build_object('id',b.id,'unit',b.congregation_id,'name',b.name,'code',b.accounting_code) order by b.name,b.id)
   from public.financial_cashboxes b join units u on u.id=b.congregation_id where b.church_id=p_church and b.deleted_at is null),'[]'),
 'categories',coalesce((select jsonb_agg(jsonb_build_object('id',c.id,'name',c.name,'direction',c.category_type,'code',c.accounting_code) order by c.name,c.id)
   from public.financial_categories c where exists(select from units) and c.church_id=p_church and c.deleted_at is null),'[]'))
$$;

create function private.set_accounting_code(p_church uuid,p_kind text,p_id uuid,p_code text,p_previous text) returns void
language plpgsql security definer set search_path='' as $$
declare old_code text;
begin
 if not private.can_manage_finance_reports(p_church,true) then raise insufficient_privilege; end if;
 if p_code is not null and p_code !~ '^[0-9]{1,32}$' then raise exception 'INVALID_INPUT'; end if;
 if p_kind='CASHBOX' then
  select accounting_code into old_code from public.financial_cashboxes where church_id=p_church and id=p_id and deleted_at is null for update;
 elsif p_kind='CATEGORY' then
  select accounting_code into old_code from public.financial_categories where church_id=p_church and id=p_id and deleted_at is null for update;
 else raise exception 'INVALID_INPUT';
 end if;
 if not found then raise exception 'INVALID_INPUT'; end if;
 if old_code is not distinct from p_code then return; end if;
 if old_code is distinct from p_previous then raise exception 'CONFLICT'; end if;
 if p_kind='CASHBOX' then
  update public.financial_cashboxes set accounting_code=p_code where church_id=p_church and id=p_id;
 else
  update public.financial_categories set accounting_code=p_code where church_id=p_church and id=p_id;
 end if;
 perform public.log_audit(p_church,'finance','SET_ACCOUNTING_CODE',p_kind,p_id,null,null,null,jsonb_build_object('previous',old_code,'code',p_code),null,'INFO');
end $$;
create function public.set_finance_accounting_code(p_church uuid,p_kind text,p_id uuid,p_code text,p_previous text) returns void
language sql security invoker set search_path='' as $$ select private.set_accounting_code(p_church,p_kind,p_id,p_code,p_previous) $$;

-- Normalize line breaks in free text and protect spreadsheet readers from formulas.
create function private.accounting_csv_field(value text) returns text
language sql immutable strict set search_path='' as $$
 select case when v ~ '[;"]' then '"'||replace(v,'"','""')||'"' else v end
 from (select case when t ~ '^[[:space:]]*[=+@-]' then ''''||t else t end v
       from (select regexp_replace(value,'[[:cntrl:]]+',' ','g') t) normalized) escaped
$$;

create function private.accounting_snapshot(p_church uuid,p_filters jsonb) returns jsonb
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
  case when t.transaction_type='INCOME' then box.accounting_code else cat.accounting_code end debit,
  case when t.transaction_type='INCOME' then cat.accounting_code else box.accounting_code end credit,
  coalesce(t.document_number,t.transaction_number,'') document,
  coalesce(nullif(trim(t.description),''),t.category_name,cat.name,'') memo,
  case when t.contributor_congregation_id is not null then t.person_name end payer,
  case when box.accounting_code is null then 'Código do caixa ou conta' end box_issue,
  case when cat.accounting_code is null then 'Código da categoria' end category_issue,
  exists(select from private.finance_accounting_items i where i.church_id=t.church_id and i.transaction_id=t.id) exported
 from public.financial_transactions t join public.congregations c on c.church_id=t.church_id and c.id=t.congregation_id
 left join public.financial_cashboxes box on box.church_id=t.church_id and box.congregation_id=t.congregation_id and box.id=t.cashbox_id and box.deleted_at is null
 left join public.financial_categories cat on cat.church_id=t.church_id and cat.id=t.category_id and cat.deleted_at is null
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

create function public.preview_finance_accounting(p_church uuid,p_filters jsonb,p_page integer) returns jsonb
language plpgsql stable security invoker set search_path='' as $$
declare snap jsonb; page_no integer;
begin
 snap:=private.accounting_snapshot(p_church,p_filters);
 page_no:=least(greatest(p_page,1),greatest(1,ceil((snap->>'total')::numeric/50)::int));
 return (snap-'rows')||jsonb_build_object('page',page_no,'rows',coalesce((select jsonb_agg(r order by n) from jsonb_array_elements(snap->'rows') with ordinality a(r,n) where n between (page_no::bigint-1)*50+1 and page_no::bigint*50),'[]'));
end $$;

create function private.generate_accounting_batch(p_church uuid,p_filters jsonb,p_fingerprint text,p_repeat boolean) returns jsonb
language plpgsql security definer set search_path='' as $$
declare
 u uuid := (p_filters->>'unit')::uuid; b uuid := (p_filters->>'box')::uuid;
 snap jsonb; batch uuid; csv_bytes bytea; actor text;
 header constant text := 'LANCAMENTO_AUTOMATICO;CONTA_DEBITO;CONTA_CREDITO;DATA;VALOR;CODIGO_HISTORICO;COMPLEMENTO_HISTORICO;CENTRO_CUSTO_DEBITO;CENTRO_CUSTO_CREDITO;NUMERO_DOCUMENTO';
begin
 if u is null or b is null then raise exception 'INVALID_INPUT'; end if;
 if not exists(select from private.accounting_units(p_church) where id=u) then raise insufficient_privilege; end if;
 perform pg_advisory_xact_lock(hashtextextended(p_church::text||b::text,0));
 snap:=private.accounting_snapshot(p_church,p_filters);
 if snap->>'fingerprint' is distinct from p_fingerprint then raise exception 'CONFLICT'; end if;
 if (snap->>'total')::int=0 or (snap->>'missing')::int>0 or jsonb_array_length(snap->'special')>0 then raise exception 'CONFIGURATION_REQUIRED'; end if;
 if (snap->>'previous')::int>0 and p_repeat is not true then raise exception 'ACCOUNTING_REPEAT'; end if;
 begin
  select convert_to(header||chr(10)||string_agg(concat_ws(';','',r->>'debit',r->>'credit',r->>'date',
      replace(((r->>'cents')::numeric/100)::numeric(14,2)::text,'.',','),'',private.accounting_csv_field(r->>'memo'),'','',private.accounting_csv_field(r->>'document')),chr(10) order by n)||chr(10),'WIN1252') into csv_bytes
  from jsonb_array_elements(snap->'rows') with ordinality a(r,n);
 exception when untranslatable_character then raise exception 'ACCOUNTING_ENCODING'; end;
 select coalesce(display_name,full_name,'Usuário') into actor from public.profiles where id=auth.uid() and deleted_at is null;
 insert into private.finance_accounting_batches(church_id,congregation_id,cashbox_id,date_from,date_to,direction,created_by,actor_name,income_cents,expense_cents,row_count,fingerprint)
 values(p_church,u,b,(p_filters->>'start')::date,(p_filters->>'end')::date,p_filters->>'direction',auth.uid(),actor,(snap->>'income')::bigint,(snap->>'expense')::bigint,(snap->>'total')::integer,p_fingerprint)
 on conflict do nothing returning id into batch;
 if batch is not null then
  insert into private.finance_accounting_items(church_id,batch_id,transaction_id,revision)
  select p_church,batch,(r->>'id')::uuid,(r->>'revision')::int from jsonb_array_elements(snap->'rows') r;
 else
  select id into strict batch from private.finance_accounting_batches where church_id=p_church and cashbox_id=b and date_from=(p_filters->>'start')::date and date_to=(p_filters->>'end')::date and direction=p_filters->>'direction' and fingerprint=p_fingerprint;
 end if;
 return jsonb_build_object('id',batch,'file',encode(csv_bytes,'base64'));
end $$;
create function public.generate_finance_accounting(p_church uuid,p_filters jsonb,p_fingerprint text,p_repeat boolean) returns jsonb
language sql security invoker set search_path='' as $$ select private.generate_accounting_batch(p_church,p_filters,p_fingerprint,p_repeat) $$;

create function private.accounting_history(p_church uuid,p_unit uuid,p_box uuid,p_page integer) returns jsonb
language sql stable security definer set search_path='' as $$
 with allowed as materialized (select id from private.accounting_units(p_church) where p_unit is null or id=p_unit),
 batches as (select b.* from private.finance_accounting_batches b join allowed a on a.id=b.congregation_id
 where b.church_id=p_church and (p_box is null or b.cashbox_id=p_box)),
 page as (select * from batches order by created_at desc,id limit 20 offset (greatest(p_page,1)::bigint-1)*20)
 select jsonb_build_object('total',(select count(*) from batches),'items',coalesce(jsonb_agg(jsonb_build_object(
 'id',b.id,'created',b.created_at,'actor',b.actor_name,'confirmed',b.confirmed_at,'start',b.date_from,'end',b.date_to,'direction',b.direction,
 'unit',b.congregation_id,'box',b.cashbox_id,'count',b.row_count,'income',b.income_cents,'expense',b.expense_cents,
 'changed',(select count(*) from private.finance_accounting_items i left join public.financial_transactions t on t.church_id=i.church_id and t.id=i.transaction_id
 where i.church_id=p_church and i.batch_id=b.id and (t.id is null or t.revision<>i.revision or t.status<>'CONFIRMED' or t.deleted_at is not null))) order by b.created_at desc,b.id),'[]'))
 from page b
$$;
create function public.finance_accounting_history(p_church uuid,p_unit uuid,p_box uuid,p_page integer) returns jsonb
language sql stable security invoker set search_path='' as $$ select private.accounting_history(p_church,p_unit,p_box,p_page) $$;
create function private.confirm_accounting_import(p_church uuid,p_batch uuid) returns void
language plpgsql security definer set search_path='' as $$
begin
 update private.finance_accounting_batches set confirmed_at=coalesce(confirmed_at,now()),confirmed_by=coalesce(confirmed_by,auth.uid())
 where church_id=p_church and id=p_batch and congregation_id in(select id from private.accounting_units(p_church));
 if not found then raise insufficient_privilege; end if;
end $$;
create function public.confirm_finance_accounting_import(p_church uuid,p_batch uuid) returns void
language sql security invoker set search_path='' as $$ select private.confirm_accounting_import(p_church,p_batch) $$;

do $$
declare f regprocedure;
begin
 foreach f in array array[
 'private.accounting_units(uuid)'::regprocedure,'private.set_accounting_code(uuid,text,uuid,text,text)'::regprocedure,
 'private.accounting_snapshot(uuid,jsonb)'::regprocedure,'private.generate_accounting_batch(uuid,jsonb,text,boolean)'::regprocedure,
 'private.accounting_history(uuid,uuid,uuid,integer)'::regprocedure,'private.confirm_accounting_import(uuid,uuid)'::regprocedure,
 'public.finance_accounting_catalog(uuid)'::regprocedure,'public.set_finance_accounting_code(uuid,text,uuid,text,text)'::regprocedure,
 'public.preview_finance_accounting(uuid,jsonb,integer)'::regprocedure,'public.generate_finance_accounting(uuid,jsonb,text,boolean)'::regprocedure,
 'public.finance_accounting_history(uuid,uuid,uuid,integer)'::regprocedure,'public.confirm_finance_accounting_import(uuid,uuid)'::regprocedure] loop
 execute format('revoke all on function %s from public,anon,authenticated',f);
 execute format('grant execute on function %s to authenticated',f);
 end loop;
end $$;
revoke all on function private.accounting_csv_field(text) from public,anon,authenticated;
commit;
