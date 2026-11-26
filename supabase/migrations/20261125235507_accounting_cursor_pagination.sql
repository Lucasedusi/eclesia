-- Match the two account filters and the chronological cursor (UUID breaks date ties).
create index finance_accounting_box_seek on public.financial_transactions(church_id,cashbox_id,transaction_date,id)
 where status='CONFIRMED' and deleted_at is null;
create index finance_accounting_date_seek on public.financial_transactions(church_id,transaction_date,id)
 where status='CONFIRMED' and deleted_at is null;
create index accounting_history_box_seek on private.finance_accounting_batches(church_id,cashbox_id,created_at desc,id desc);
create index accounting_history_date_seek on private.finance_accounting_batches(church_id,created_at desc,id desc);

create view private.accounting_lines with (security_invoker=true) as
select t.church_id,t.congregation_id,t.cashbox_id,t.id,t.revision,t.transaction_date date,t.transaction_type direction,(t.amount*100)::bigint cents,
  c.name unit,box.name box,coalesce(t.category_name,cat.name) category,
  case when t.transaction_type='INCOME' then box.accounting_code else mapping.code end debit,
  case when t.transaction_type='INCOME' then mapping.code else box.accounting_code end credit,
  coalesce(t.document_number,t.transaction_number,'') document,
  private.accounting_memo(t.transaction_type='INCOME' and
    coalesce(cat.is_tithe,t.tithe_classification_id is not null or t.classification_name is not null),
    case when t.contributor_kind in ('MEMBER','UNREGISTERED') then t.person_name end,
    t.description,coalesce(t.category_name,cat.name)) memo,
  case when t.transaction_type='INCOME' and coalesce(cat.is_tithe,true) then t.classification_name end classification,
  case when t.contributor_congregation_id is not null then t.person_name end payer,
  case when box.accounting_code is null then 'Código do caixa ou conta' end box_issue,
  case when mapping.code is null then 'Código da categoria' end category_issue,
  exists(select from private.finance_accounting_items i where i.church_id=t.church_id and i.transaction_id=t.id) exported
 from public.financial_transactions t join public.congregations c on c.church_id=t.church_id and c.id=t.congregation_id
 left join public.financial_cashboxes box on box.church_id=t.church_id and box.congregation_id=t.congregation_id and box.id=t.cashbox_id and box.deleted_at is null
 left join public.financial_categories cat on cat.church_id=t.church_id and cat.id=t.category_id and cat.deleted_at is null
 left join private.accounting_category_links mapping on mapping.church_id=cat.church_id and mapping.category_id=cat.id and mapping.direction=t.transaction_type
 where t.deleted_at is null and t.status='CONFIRMED';
revoke all on private.accounting_lines from public,anon,authenticated;

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
 select id,revision,date,direction,cents,unit,box,category,debit,credit,document,memo,classification,payer,box_issue,category_issue,exported
 from private.accounting_lines
 where church_id=p_church and congregation_id=any(allowed) and date between d1 and d2
 and (b is null or cashbox_id=b) and (dir='ALL' or direction=dir)
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
 'fingerprint',md5(coalesce(jsonb_agg(to_jsonb(s)-'exported'-'classification' order by s.date,s.id)::text,'[]')),
 'total',count(*),'previous',count(*) filter(where exported),
 'missing',count(*) filter(where box_issue is not null or category_issue is not null),
 'income',coalesce(sum(cents) filter(where direction='INCOME'),0),'expense',coalesce(sum(cents) filter(where direction='EXPENSE'),0),
 'special',coalesce((select jsonb_agg(to_jsonb(x) order by date,kind) from (select date,kind,count(*) quantity from special group by date,kind)x),'[]')
 ) into result from source s;
 return result;
end $$;

create or replace function private.generate_accounting_batch(p_church uuid,p_filters jsonb,p_fingerprint text,p_repeat boolean) returns jsonb
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
 -- Accept the compact preview signature while retaining the original batch identity for retries.
 if snap->>'fingerprint' is distinct from p_fingerprint then
   if p_fingerprint is distinct from (select md5(coalesce(string_agg(md5((r-'exported'-'classification')::text),'' order by n),''))
       from jsonb_array_elements(snap->'rows') with ordinality e(r,n)) then raise exception 'CONFLICT'; end if;
   p_fingerprint:=snap->>'fingerprint';
 end if;
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

-- The summary and first page share one snapshot. Subsequent cursor requests only read page rows.
create function private.accounting_page(p_church uuid,p_filters jsonb,p_after jsonb,p_summary boolean,p_legacy_page integer)
returns jsonb language plpgsql stable security definer set search_path='' set plan_cache_mode=force_custom_plan as $$
declare
 u uuid := (p_filters->>'unit')::uuid; b uuid := (p_filters->>'box')::uuid;
 d1 date := (p_filters->>'start')::date; d2 date := (p_filters->>'end')::date;
 dir text := p_filters->>'direction'; allowed uuid[]; result jsonb := '{}'::jsonb;
 anchor_date date := (p_after->>'date')::date;
 anchor_id uuid := (p_after->>'id')::uuid;
 page_no integer := 1;
 page_rows jsonb;
 more boolean;
begin
 select array_agg(id) into allowed from private.accounting_units(p_church) where u is null or id=u;
 if allowed is null then raise exception 'FORBIDDEN' using errcode='42501'; end if;
 if d1 is null or d2 is null or d1>d2 or dir is null or dir not in ('ALL','INCOME','EXPENSE') then raise exception 'INVALID_INPUT'; end if;
 if b is not null and not exists(select from public.financial_cashboxes where church_id=p_church and congregation_id=any(allowed) and id=b and deleted_at is null)
 then raise exception 'FORBIDDEN' using errcode='42501'; end if;


 if p_after is not null and (anchor_date is null or anchor_id is null) then raise exception 'INVALID_INPUT' using errcode='22023'; end if;
 if p_summary or p_legacy_page is not null then
   with source as not materialized (
     select id,revision,date,direction,cents,unit,box,category,debit,credit,document,memo,classification,payer,box_issue,category_issue,exported
     from private.accounting_lines
 where church_id=p_church and congregation_id=any(allowed) and date between d1 and d2
 and (b is null or cashbox_id=b) and (dir='ALL' or direction=dir)
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
     'opening',(select coalesce(sum(l.amount),0)*100 from public.financial_ledger_entries l
        where l.church_id=p_church and l.congregation_id=any(allowed) and l.deleted_at is null
        and l.financial_date<d1 and (b is null or l.cashbox_id=b)),
     'total',count(*),'previous',count(*) filter(where exported),
     'missing',count(*) filter(where box_issue is not null or category_issue is not null),
     'income',coalesce(sum(cents) filter(where direction='INCOME'),0),'expense',coalesce(sum(cents) filter(where direction='EXPENSE'),0),
     'fingerprint',case when p_legacy_page is not null or (b is not null and u is not null) then md5(coalesce(string_agg(
       md5((to_jsonb(s)-'exported'-'classification')::text),'' order by date,id) filter (where p_legacy_page is not null or (b is not null and u is not null)),'')) end,
     'special',coalesce((select jsonb_agg(to_jsonb(x) order by date,kind)
       from (select date,kind,count(*) quantity from special group by date,kind)x),'[]')
   ) into result from source s;
   if p_legacy_page is not null then
     page_no:=least(greatest(p_legacy_page,1),greatest(1,ceil((result->>'total')::numeric/50)::integer));
   end if;
 end if;

 -- Seek on the transaction index before joining names, category codes or previous exports.
 with candidates as materialized (
   select t.id,t.transaction_date from public.financial_transactions t
   where t.church_id=p_church and t.congregation_id=any(allowed) and t.deleted_at is null and t.status='CONFIRMED'
     and t.transaction_date between d1 and d2 and (b is null or t.cashbox_id=b) and (dir='ALL' or t.transaction_type=dir)
     and (p_after is null or (t.transaction_date,t.id)>(anchor_date,anchor_id))
   order by t.transaction_date,t.id limit 51 offset (page_no::bigint-1)*50
 ), shown as (select * from candidates order by transaction_date,id limit 50)
 select coalesce(jsonb_agg(case when p_legacy_page is not null then to_jsonb(l)-'church_id'-'congregation_id'-'cashbox_id'
   else jsonb_build_object('id',l.id,'date',l.date,'unit',l.unit,'box',l.box,'category',l.category,
     'classification',l.classification,'payer',l.payer,'direction',l.direction,'cents',l.cents,'debit',l.debit,
     'credit',l.credit,'box_issue',l.box_issue,'category_issue',l.category_issue) end order by l.date,l.id),'[]'),
   (select count(*)>50 from candidates)
 into page_rows,more from shown s join private.accounting_lines l on l.church_id=p_church and l.id=s.id;
 return result||jsonb_build_object('rows',page_rows,'page',page_no,'hasMore',more);
end $$;
revoke all on function private.accounting_page(uuid,jsonb,jsonb,boolean,integer) from public,anon,authenticated;
grant execute on function private.accounting_page(uuid,jsonb,jsonb,boolean,integer) to authenticated;

create function public.finance_accounting_page(p_church uuid,p_filters jsonb,p_summary boolean,p_after jsonb default null)
returns jsonb language sql stable security invoker set search_path='' as $$
 select private.accounting_page(p_church,p_filters,p_after,p_summary,null)
$$;
create or replace function public.preview_finance_accounting(p_church uuid,p_filters jsonb,p_page integer)
returns jsonb language sql stable security invoker set search_path='' as $$
 select private.accounting_page(p_church,p_filters,null,true,coalesce(p_page,1))
$$;

create function private.accounting_batch_page(p_church uuid,p_unit uuid,p_box uuid,p_after jsonb)
returns jsonb language plpgsql stable security definer set search_path='' set plan_cache_mode=force_custom_plan as $$
declare
 stamp timestamptz := (p_after->>'date')::timestamptz;
 anchor uuid := (p_after->>'id')::uuid;
 result jsonb;
begin
 if p_after is not null and (stamp is null or anchor is null) then raise exception 'INVALID_INPUT' using errcode='22023'; end if;
 with allowed as materialized (select id from private.accounting_units(p_church) where p_unit is null or id=p_unit),
 candidates as materialized (
   select b.* from private.finance_accounting_batches b
   where b.church_id=p_church and b.congregation_id in (select id from allowed) and (p_box is null or b.cashbox_id=p_box)
   and (p_after is null or (b.created_at,b.id)<(stamp,anchor))
   order by b.created_at desc,b.id desc limit 21
 ), page as (select * from candidates order by created_at desc,id desc limit 20)
 select jsonb_build_object('hasMore',(select count(*)>20 from candidates),'items',coalesce(jsonb_agg(
 jsonb_build_object(
 'id',b.id,'created',b.created_at,'actor',b.actor_name,'confirmed',b.confirmed_at,'start',b.date_from,'end',b.date_to,'direction',b.direction,
 'unit',b.congregation_id,'box',b.cashbox_id,'count',b.row_count,'income',b.income_cents,'expense',b.expense_cents,
 'changed',(select count(*) from private.finance_accounting_items i left join public.financial_transactions t on t.church_id=i.church_id and t.id=i.transaction_id
 where i.church_id=p_church and i.batch_id=b.id and (t.id is null or t.revision<>i.revision or t.status<>'CONFIRMED' or t.deleted_at is not null))) order by b.created_at desc,b.id desc),'[]')) into result from page b;
 return result;
end $$;
create function public.finance_accounting_batch_page(p_church uuid,p_unit uuid,p_box uuid,p_after jsonb default null)
returns jsonb language sql stable security invoker set search_path='' as $$
 select private.accounting_batch_page(p_church,p_unit,p_box,p_after)
$$;
revoke all on function private.accounting_batch_page(uuid,uuid,uuid,jsonb),
 public.finance_accounting_batch_page(uuid,uuid,uuid,jsonb),public.finance_accounting_page(uuid,jsonb,boolean,jsonb) from public,anon,authenticated;
grant execute on function private.accounting_batch_page(uuid,uuid,uuid,jsonb),
 public.finance_accounting_batch_page(uuid,uuid,uuid,jsonb),public.finance_accounting_page(uuid,jsonb,boolean,jsonb) to authenticated;
