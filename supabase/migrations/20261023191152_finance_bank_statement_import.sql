-- Bank statements are private review data. Only the atomic RPCs below can write.
create table public.finance_bank_import_batches (
 id uuid primary key default gen_random_uuid(), church_id uuid not null references public.churches(id),
 congregation_id uuid not null, cashbox_id uuid not null, file_hash text not null check(file_hash ~ '^[a-f0-9]{64}$'),
 file_name text not null check(length(file_name) between 1 and 180), parser_version text not null check(parser_version='SICOOB_XLSX_V1'),
 balances jsonb not null default '[]', reconciliation text not null check(reconciliation in ('MATCHED','MISMATCH','UNAVAILABLE')),
 reconciliation_reason text, created_by uuid not null references public.profiles(id),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(), deleted_at timestamptz,
 unique(church_id,id), unique(church_id,congregation_id,cashbox_id,id),
 foreign key(church_id,congregation_id) references public.congregations(church_id,id),
 foreign key(church_id,cashbox_id) references public.financial_cashboxes(church_id,id)
);
create unique index finance_bank_import_file on public.finance_bank_import_batches(church_id,cashbox_id,file_hash) where deleted_at is null;
create index finance_bank_import_unit on public.finance_bank_import_batches(church_id,congregation_id,created_at desc) where deleted_at is null;
create table public.finance_bank_import_items (
 id uuid primary key default gen_random_uuid(), church_id uuid not null references public.churches(id),
 congregation_id uuid not null, cashbox_id uuid not null, batch_id uuid not null, row_number integer not null check(row_number between 1 and 5200),
 transaction_date date, amount_cents bigint check(abs(amount_cents) between 1 and 999999999999),
 source_date text not null default '', source_value text not null default '', document text not null default '',
 history text not null default '', complement text not null default '', issue text,
 fingerprint text not null, status text not null default 'PENDING' check(status in ('PENDING','POSTED','LINKED','IGNORED','DUPLICATE')),
 revision integer not null default 1 check(revision>0), draft jsonb not null default '{}', reason text, canonical_id uuid, result jsonb,
 created_by uuid not null references public.profiles(id), created_at timestamptz not null default now(), updated_at timestamptz not null default now(), deleted_at timestamptz,
 unique(church_id,id), unique(church_id,congregation_id,cashbox_id,id), unique(church_id,batch_id,row_number),
 foreign key(church_id,congregation_id,cashbox_id,batch_id) references public.finance_bank_import_batches(church_id,congregation_id,cashbox_id,id),
 foreign key(church_id,congregation_id,cashbox_id,canonical_id) references public.finance_bank_import_items(church_id,congregation_id,cashbox_id,id),
 check(canonical_id is null or canonical_id<>id), check((status='DUPLICATE')=(canonical_id is not null)),
 check(issue is not null or (transaction_date is not null and amount_cents is not null)),
 check(length(source_date)<=6000 and length(source_value)<=6000 and length(document)<=6000 and length(history)<=6000 and length(complement)<=6000)
);
create index finance_bank_import_queue on public.finance_bank_import_items(church_id,batch_id,status,row_number) where deleted_at is null;
create index finance_bank_import_fingerprint on public.finance_bank_import_items(church_id,cashbox_id,fingerprint) where deleted_at is null;
create index finance_bank_import_canonical on public.finance_bank_import_items(church_id,canonical_id) where canonical_id is not null;
create table public.finance_bank_import_links (
 id uuid primary key default gen_random_uuid(), church_id uuid not null references public.churches(id), congregation_id uuid not null,
 cashbox_id uuid not null, item_id uuid not null, transaction_id uuid, transfer_id uuid, finance_revision integer not null,
 created_at timestamptz not null default now(), deleted_at timestamptz,
 foreign key(church_id,congregation_id,cashbox_id,item_id) references public.finance_bank_import_items(church_id,congregation_id,cashbox_id,id),
 foreign key(church_id,transaction_id) references public.financial_transactions(church_id,id),
 foreign key(church_id,transfer_id) references public.financial_transfers(church_id,id),
 check(num_nonnulls(transaction_id,transfer_id)=1)
);
create unique index finance_bank_import_transaction on public.finance_bank_import_links(church_id,transaction_id) where deleted_at is null and transaction_id is not null;
create unique index finance_bank_import_transfer_side on public.finance_bank_import_links(church_id,transfer_id,cashbox_id) where deleted_at is null and transfer_id is not null;
create index finance_bank_import_link_item on public.finance_bank_import_links(church_id,item_id);
create table public.finance_bank_import_events (
 id uuid primary key default gen_random_uuid(), church_id uuid not null references public.churches(id), congregation_id uuid not null,
 item_id uuid not null, action text not null, revision integer not null, reason text,
 created_by uuid not null references public.profiles(id), actor_name text not null, created_at timestamptz not null default now(),
 foreign key(church_id,item_id) references public.finance_bank_import_items(church_id,id)
);
create index finance_bank_import_event_item on public.finance_bank_import_events(church_id,item_id,created_at);
create table public.finance_bank_import_operations (
 id uuid primary key default gen_random_uuid(), church_id uuid not null references public.churches(id), congregation_id uuid not null,
 item_id uuid not null, operation_key uuid not null, payload_hash text not null, result jsonb not null,
 created_by uuid not null references public.profiles(id), created_at timestamptz not null default now(),
 unique(church_id,created_by,operation_key), foreign key(church_id,item_id) references public.finance_bank_import_items(church_id,id)
);
create index finance_bank_import_operation_item on public.finance_bank_import_operations(church_id,item_id);
-- Invoker helper: authorization remains attached to the same operational scope.
create function private.bank_import_access(p_church uuid,p_unit uuid) returns boolean
 language sql stable security invoker set search_path='' as $$
 select private.can_access_finance_unit(p_church,p_unit,'finance.view') and private.can_access_finance_unit(p_church,p_unit,'finance.transactions.create');
$$;
revoke all on function private.bank_import_access(uuid,uuid) from public,anon;
grant execute on function private.bank_import_access(uuid,uuid) to authenticated;
do $$ declare t text; begin
 foreach t in array array['finance_bank_import_batches','finance_bank_import_items','finance_bank_import_links','finance_bank_import_events','finance_bank_import_operations'] loop
  execute format('alter table public.%I enable row level security',t);
  execute format('revoke all on public.%I from public,anon,authenticated',t);
  if t<>'finance_bank_import_operations' then
   execute format('grant select on public.%I to authenticated',t);
   execute format('create policy bank_import_read on public.%I for select to authenticated using (private.bank_import_access(church_id,congregation_id))',t);
  end if;
 end loop;
end $$;

create function private.bank_import_fingerprint(p_date date,p_cents bigint,p_document text,p_history text,p_complement text) returns text
 language sql immutable security invoker set search_path='' as $$
 select encode(extensions.digest(jsonb_build_array(p_date,p_cents,
  upper(regexp_replace(trim(coalesce(p_document,'')),'\s+',' ','g')),
  upper(regexp_replace(trim(coalesce(p_history,'')),'\s+',' ','g')),
  upper(regexp_replace(trim(coalesce(p_complement,'')),'\s+',' ','g')))::text,'sha256'),'hex');
$$;
revoke all on function private.bank_import_fingerprint(date,bigint,text,text,text) from public,anon,authenticated;

-- SECURITY DEFINER is necessary: clients have no direct INSERT/UPDATE grants.
create function public.prepare_finance_bank_import(p_church_id uuid,p_unit uuid,p_cashbox uuid,p_file_hash text,p_file_name text,p_data jsonb) returns jsonb
 language plpgsql security definer set search_path='' as $$
declare b uuid; r jsonb; d date; cents bigint; problem text;
begin
 if not private.bank_import_access(p_church_id,p_unit) then raise exception 'FORBIDDEN' using errcode='42501'; end if;
 if p_file_hash is null or p_file_hash !~ '^[a-f0-9]{64}$' or coalesce(length(p_file_name),0) not between 1 and 180
  or p_data->>'parserVersion' is distinct from 'SICOOB_XLSX_V1' or jsonb_typeof(p_data->'rows') is distinct from 'array'
  or jsonb_array_length(p_data->'rows') not between 1 and 5000 or octet_length(p_data::text)>24000000
  or jsonb_typeof(p_data->'balances') is distinct from 'array' or jsonb_array_length(p_data->'balances')>5000
  or coalesce(p_data->>'reconciliation','') not in ('MATCHED','MISMATCH','UNAVAILABLE') then raise exception 'INVALID_INPUT' using errcode='22023'; end if;
 perform pg_advisory_xact_lock(hashtextextended(p_church_id::text,0));
 if not exists(select 1 from public.financial_cashboxes where church_id=p_church_id and congregation_id=p_unit and id=p_cashbox and kind='BANK_ACCOUNT' and status='ACTIVE' and deleted_at is null) then raise exception 'INACTIVE_REFERENCE'; end if;
 select id into b from public.finance_bank_import_batches where church_id=p_church_id and cashbox_id=p_cashbox and file_hash=p_file_hash and deleted_at is null;
 if b is not null then return jsonb_build_object('id',b,'replayed',true); end if;
 insert into public.finance_bank_import_batches(church_id,congregation_id,cashbox_id,file_hash,file_name,parser_version,balances,reconciliation,created_by)
 values(p_church_id,p_unit,p_cashbox,p_file_hash,p_file_name,p_data->>'parserVersion',p_data->'balances',p_data->>'reconciliation',auth.uid()) returning id into b;
 for r in select value from jsonb_array_elements(p_data->'rows') loop
  problem:=nullif(r->>'issue',''); d:=(r->>'date')::date;
  if r->>'amountCents' is not null and (r->>'amountCents') !~ '^-?[0-9]+$' then raise exception 'INVALID_INPUT' using errcode='22023'; end if;
  cents:=(r->>'amountCents')::bigint;
  if length(problem)>1000 then raise exception 'INVALID_INPUT' using errcode='22023'; end if;
  insert into public.finance_bank_import_items(church_id,congregation_id,cashbox_id,batch_id,row_number,transaction_date,amount_cents,source_date,source_value,document,history,complement,issue,fingerprint,created_by)
  values(p_church_id,p_unit,p_cashbox,b,(r->>'rowNumber')::integer,d,cents,coalesce(r->>'sourceDate',''),coalesce(r->>'sourceValue',''),coalesce(r->>'document',''),coalesce(r->>'history',''),coalesce(r->>'complement',''),problem,
   private.bank_import_fingerprint(d,cents,r->>'document',r->>'history',r->>'complement'),auth.uid());
 end loop;
 return jsonb_build_object('id',b,'replayed',false);
end $$;

-- Health is computed against the current ledger; a later correction never posts again.
create function private.bank_import_health(p_church uuid,p_item uuid) returns jsonb
 language plpgsql stable security invoker set search_path='' as $$
declare i public.finance_bank_import_items; linked integer; valid integer; cancelled integer; total bigint; changed boolean;
begin
 select * into i from public.finance_bank_import_items where church_id=p_church and id=p_item and deleted_at is null;
 if i.status='DUPLICATE' then select * into i from public.finance_bank_import_items where church_id=p_church and id=i.canonical_id and deleted_at is null; end if;
 if i.id is null or i.status not in ('POSTED','LINKED') then return jsonb_build_object('stale',true,'changed',false,'cancelled',false); end if;
 select count(*),count(*) filter(where ok),count(*) filter(where gone),sum(cents),coalesce(bool_or(revised),false)
 into linked,valid,cancelled,total,changed from (
  select t.status='CONFIRMED' and t.deleted_at is null and t.cashbox_id=i.cashbox_id and t.transaction_date=i.transaction_date and t.congregation_id=i.congregation_id and (t.transaction_type='INCOME')=(i.amount_cents>0) as ok,
   t.id is null or t.status='CANCELLED' or t.deleted_at is not null as gone,
   (t.amount*100)::bigint*case when t.transaction_type='INCOME' then 1 else -1 end as cents, t.revision<>l.finance_revision as revised
  from public.finance_bank_import_links l left join public.financial_transactions t on t.church_id=l.church_id and t.id=l.transaction_id
  where l.church_id=p_church and l.item_id=i.id and l.deleted_at is null and l.transaction_id is not null
  union all
  select t.status='CONFIRMED' and t.deleted_at is null and t.transaction_date=i.transaction_date and t.congregation_id=i.congregation_id and
   case when i.amount_cents>0 then t.target_cashbox_id=i.cashbox_id else t.source_cashbox_id=i.cashbox_id end,
   t.id is null or t.status='CANCELLED' or t.deleted_at is not null,(t.amount*100)::bigint*case when i.amount_cents>0 then 1 else -1 end,t.revision<>l.finance_revision
  from public.finance_bank_import_links l left join public.financial_transfers t on t.church_id=l.church_id and t.id=l.transfer_id
  where l.church_id=p_church and l.item_id=i.id and l.deleted_at is null and l.transfer_id is not null
 ) health;
 return jsonb_build_object('stale',linked=0 or valid<>linked or total is distinct from i.amount_cents,'changed',changed,'cancelled',linked>0 and cancelled=linked);
end $$;
create function private.bank_import_batch_dto(p_church uuid,p_batch uuid) returns jsonb
 language sql stable security invoker set search_path='' as $$
 select jsonb_build_object('id',b.id,'cashboxId',b.cashbox_id,'cashboxName',c.name,'fileName',b.file_name,'createdAt',b.created_at,
  'dateFrom',min(i.transaction_date),'dateTo',max(i.transaction_date),'total',count(i.id),'pending',count(i.id) filter(where i.status='PENDING'),
  'incomeCents',coalesce(sum(i.amount_cents) filter(where i.amount_cents>0),0),'expenseCents',coalesce(-sum(i.amount_cents) filter(where i.amount_cents<0),0),
  'reconciliation',b.reconciliation,'reconciliationReason',b.reconciliation_reason,'balances',b.balances)
 from public.finance_bank_import_batches b join public.financial_cashboxes c on c.church_id=b.church_id and c.id=b.cashbox_id
 left join public.finance_bank_import_items i on i.church_id=b.church_id and i.batch_id=b.id and i.deleted_at is null
 where b.church_id=p_church and b.id=p_batch and b.deleted_at is null group by b.id,c.name;
$$;
create function private.bank_import_item_dto(p_church uuid,p_item uuid) returns jsonb
 language sql stable security invoker set search_path='' as $$
 select jsonb_build_object('id',i.id,'batchId',i.batch_id,'rowNumber',i.row_number,'date',i.transaction_date,'amountCents',i.amount_cents,
  'sourceDate',i.source_date,'sourceValue',i.source_value,'document',i.document,'history',i.history,'complement',i.complement,'issue',i.issue,'fingerprint',i.fingerprint,
  'status',i.status,'revision',i.revision,'draft',i.draft,'reason',i.reason,'canonicalId',i.canonical_id,'result',coalesce(c.result,i.result),
  'historyEvents',coalesce((select jsonb_agg(jsonb_build_object('action',e.action,'reason',e.reason,'at',e.created_at,'actor',e.actor_name) order by e.created_at,e.revision)
   from public.finance_bank_import_events e where e.church_id=i.church_id and e.item_id=i.id),'[]'::jsonb)) ||
  case when i.status in ('POSTED','LINKED','DUPLICATE') then private.bank_import_health(i.church_id,i.id) else '{"stale":false,"changed":false,"cancelled":false}'::jsonb end
 from public.finance_bank_import_items i left join public.finance_bank_import_items c on c.church_id=i.church_id and c.id=i.canonical_id and c.deleted_at is null
 where i.church_id=p_church and i.id=p_item and i.deleted_at is null;
$$;
create function public.list_finance_bank_imports(p_church_id uuid,p_unit uuid,p_cashbox uuid default null,p_page integer default 1) returns jsonb
 language plpgsql stable security invoker set search_path='' as $$
begin
 if not private.bank_import_access(p_church_id,p_unit) then raise exception 'FORBIDDEN' using errcode='42501'; end if;
 if p_page is null or p_page not between 1 and 10000 then raise exception 'INVALID_INPUT'; end if;
 return jsonb_build_object('batches',coalesce((select jsonb_agg(private.bank_import_batch_dto(p_church_id,b.id) order by b.created_at desc,b.id) from
  (select id,created_at from public.finance_bank_import_batches where church_id=p_church_id and congregation_id=p_unit and deleted_at is null and (p_cashbox is null or cashbox_id=p_cashbox) order by created_at desc,id limit 20 offset (p_page-1)*20) b),'[]'::jsonb),
  'page',p_page,'pageCount',greatest(1,(select ceil(count(*)/20.0) from public.finance_bank_import_batches where church_id=p_church_id and congregation_id=p_unit and deleted_at is null and (p_cashbox is null or cashbox_id=p_cashbox))));
end $$;
create function public.get_finance_bank_import(p_church_id uuid,p_unit uuid,p_batch uuid,p_filters jsonb default '{}') returns jsonb
 language plpgsql stable security invoker set search_path='' as $$
declare page integer:=coalesce((p_filters->>'page')::int,1); state text:=coalesce(p_filters->>'status','PENDING'); direction text:=coalesce(p_filters->>'direction','ALL'); query text:=coalesce(p_filters->>'query',''); ids uuid[]; counts jsonb;
begin
 if not private.bank_import_access(p_church_id,p_unit) or not exists(select 1 from public.finance_bank_import_batches where church_id=p_church_id and congregation_id=p_unit and id=p_batch and deleted_at is null) then raise exception 'FORBIDDEN' using errcode='42501'; end if;
 if page not between 1 and 10000 or state not in ('PENDING','COMPLETED','IGNORED','ALL') or direction not in ('INCOME','EXPENSE','ALL') or length(query)>100 then raise exception 'INVALID_INPUT'; end if;
 select jsonb_build_object('pending',count(*) filter(where status='PENDING' or (status in ('POSTED','LINKED','DUPLICATE') and (private.bank_import_health(church_id,id)->>'stale')::boolean)),
  'completed',count(*) filter(where status in ('POSTED','LINKED','DUPLICATE') and not (private.bank_import_health(church_id,id)->>'stale')::boolean),
  'ignored',count(*) filter(where status='IGNORED'),'total',count(*)) into counts
 from public.finance_bank_import_items where church_id=p_church_id and batch_id=p_batch and deleted_at is null;
 select array_agg(id order by row_number) into ids from public.finance_bank_import_items i where church_id=p_church_id and batch_id=p_batch and deleted_at is null
 and (state='ALL' or (state='PENDING' and (status='PENDING' or (status in ('POSTED','LINKED','DUPLICATE') and (private.bank_import_health(church_id,id)->>'stale')::boolean)))
  or (state='COMPLETED' and status in ('POSTED','LINKED','DUPLICATE') and not (private.bank_import_health(church_id,id)->>'stale')::boolean) or (state='IGNORED' and status='IGNORED'))
 and (direction='ALL' or (direction='INCOME' and amount_cents>0) or (direction='EXPENSE' and amount_cents<0))
 and (query='' or strpos(lower(concat_ws(' ',document,history,complement)),lower(query))>0);
 return jsonb_build_object('batch',private.bank_import_batch_dto(p_church_id,p_batch),'counts',counts,'page',page,'pageCount',greatest(1,ceil(coalesce(array_length(ids,1),0)/50.0)),
  'items',coalesce((select jsonb_agg(private.bank_import_item_dto(p_church_id,id) order by pos) from unnest(ids) with ordinality t(id,pos) where pos between (page-1)*50+1 and page*50),'[]'::jsonb));
end $$;

-- Serialize with the financial command's church lock BEFORE taking an item lock.
-- Wrapper idempotency survives another actor finishing the item and lost responses.
create function public.finance_bank_import_item(p_church_id uuid,p_unit uuid,p_item uuid,p_revision integer,p_operation_key uuid,p_action text,p_payload jsonb) returns jsonb
 language plpgsql security definer set search_path='' as $$
declare i public.finance_bank_import_items; b public.finance_bank_import_batches; target public.finance_bank_import_items;
 op public.finance_bank_import_operations; payload_hash text; reason text:=trim(p_payload->>'reason'); command jsonb; command_result jsonb; response jsonb;
 ids uuid[]; transfer uuid; attendance uuid; total bigint; n integer; target_kind text; target_id uuid; actor text; event_reason text;
begin
 if not private.bank_import_access(p_church_id,p_unit) then raise exception 'FORBIDDEN' using errcode='42501'; end if;
 if p_operation_key is null or p_revision is null or p_revision<1 or p_action is null or p_action not in ('SAVE_DRAFT','POST','LINK','DUPLICATE','IGNORE','RESTORE','REOPEN','UNLINK')
  or jsonb_typeof(p_payload) is distinct from 'object' or octet_length(p_payload::text)>100000 then raise exception 'INVALID_INPUT' using errcode='22023'; end if;
 perform pg_advisory_xact_lock(hashtextextended(p_church_id::text,0));
 select * into i from public.finance_bank_import_items where church_id=p_church_id and congregation_id=p_unit and id=p_item and deleted_at is null for update;
 if i.id is null then raise exception 'FORBIDDEN' using errcode='42501'; end if;
 payload_hash:=encode(extensions.digest(jsonb_build_array(p_unit,p_item,p_revision,p_action,p_payload)::text,'sha256'),'hex');
 select * into op from public.finance_bank_import_operations where church_id=p_church_id and created_by=auth.uid() and operation_key=p_operation_key;
 if op.id is not null then
  if op.payload_hash<>payload_hash then raise exception 'IDEMPOTENCY_CONFLICT'; end if;
  return op.result||jsonb_build_object('replayed',true);
 end if;
 if i.revision<>p_revision then raise exception 'BANK_IMPORT_CONFLICT'; end if;
 select * into b from public.finance_bank_import_batches where church_id=p_church_id and id=i.batch_id and deleted_at is null;
 if b.id is null then raise exception 'FORBIDDEN' using errcode='42501'; end if;
 if p_action in ('IGNORE','RESTORE','REOPEN','UNLINK','DUPLICATE') and coalesce(length(reason),0) not between 5 and 1000 then raise exception 'INVALID_INPUT' using errcode='22023'; end if;
 if (p_action in ('SAVE_DRAFT','POST','LINK','DUPLICATE','IGNORE') and i.status<>'PENDING') or (p_action='RESTORE' and i.status<>'IGNORED')
  or (p_action='REOPEN' and (i.status<>'POSTED' or not (private.bank_import_health(p_church_id,i.id)->>'cancelled')::boolean))
  or (p_action='UNLINK' and i.status not in ('LINKED','DUPLICATE')) then raise exception 'BANK_IMPORT_STATE'; end if;
 if p_action in ('POST','LINK','DUPLICATE') and (i.issue is not null or i.transaction_date is null or i.amount_cents is null) then raise exception 'BANK_IMPORT_INVALID_ROW'; end if;
 if p_action in ('POST','LINK') then
  if not exists(select 1 from public.financial_cashboxes where church_id=p_church_id and congregation_id=p_unit and id=i.cashbox_id and kind='BANK_ACCOUNT' and status='ACTIVE' and deleted_at is null and opening_date<=i.transaction_date) then raise exception 'INACTIVE_REFERENCE'; end if;
  if exists(select 1 from public.finance_bank_import_items where church_id=p_church_id and cashbox_id=i.cashbox_id and fingerprint=i.fingerprint and id<>i.id and batch_id<>i.batch_id and deleted_at is null)
   and coalesce(length(trim(p_payload->>'duplicateReason')),0) not between 5 and 1000 then raise exception 'BANK_IMPORT_DUPLICATE_REVIEW'; end if;
  if b.reconciliation='MISMATCH' and b.reconciliation_reason is null then
   if coalesce(length(trim(p_payload->>'reconciliationReason')),0) not between 5 and 1000 then raise exception 'BANK_IMPORT_RECONCILIATION'; end if;
   update public.finance_bank_import_batches set reconciliation_reason=trim(p_payload->>'reconciliationReason'),updated_at=now() where church_id=p_church_id and id=b.id;
  end if;
 end if;
 if p_action='SAVE_DRAFT' then
  if jsonb_typeof(p_payload->'state') is distinct from 'object' or jsonb_typeof(p_payload->'extra') is distinct from 'array' or jsonb_array_length(p_payload->'extra')>49 then raise exception 'INVALID_INPUT'; end if;
  update public.finance_bank_import_items set draft=p_payload where church_id=p_church_id and id=i.id;
 elsif p_action='POST' then
  command:=p_payload->'command';
  if command->>'kind' is null or command->>'kind' not in ('RECORD','TRANSFER') then raise exception 'INVALID_INPUT'; end if;
  if command->>'kind'='RECORD' then
   select sum((v->>'amountCents')::numeric),count(*) into total,n from jsonb_array_elements(command->'items') v;
   if (command->>'date')::date is distinct from i.transaction_date or (command->>'cashboxId')::uuid is distinct from i.cashbox_id
    or command->>'direction' is distinct from (case when i.amount_cents>0 then 'INCOME' else 'EXPENSE' end)
    or total is distinct from abs(i.amount_cents) or n not between 1 and 50 or (i.amount_cents<0 and (n<>1 or command->>'mode'<>'SINGLE')) then raise exception 'BANK_IMPORT_SOURCE_MISMATCH'; end if;
   command:=command||jsonb_build_object('date',i.transaction_date,'cashboxId',i.cashbox_id,'direction',case when i.amount_cents>0 then 'INCOME' else 'EXPENSE' end);
  else
   if not private.can_access_finance_unit(p_church_id,p_unit,'finance.transfers.manage') then raise exception 'FORBIDDEN' using errcode='42501'; end if;
   if (command->>'date')::date is distinct from i.transaction_date or (command->>'amountCents')::numeric is distinct from abs(i.amount_cents)
    or (command->>case when i.amount_cents>0 then 'targetCashboxId' else 'sourceCashboxId' end)::uuid is distinct from i.cashbox_id then raise exception 'BANK_IMPORT_SOURCE_MISMATCH'; end if;
   command:=command||jsonb_build_object('date',i.transaction_date,'amountCents',abs(i.amount_cents),case when i.amount_cents>0 then 'targetCashboxId' else 'sourceCashboxId' end,i.cashbox_id);
  end if;
  command:=command||jsonb_build_object('congregationId',p_unit,'operationKey',gen_random_uuid());
  command_result:=public.execute_finance_command(p_church_id,command);
  select array_agg(value::uuid) into ids from jsonb_array_elements_text(command_result->'transactionIds');
  transfer:=(command_result->>'transferId')::uuid;
  update public.financial_transactions set source_type='IMPORT' where church_id=p_church_id and id=any(ids);
  update public.financial_transaction_revisions set new_values=jsonb_set(new_values,'{source_type}','"IMPORT"') where church_id=p_church_id and transaction_id=any(ids) and revision=1;
 elsif p_action='LINK' then
  target_kind:=p_payload->>'targetKind'; target_id:=(p_payload->>'targetId')::uuid;
  if target_kind is null or target_kind not in ('TRANSACTION','ATTENDANCE','TRANSFER') or target_id is null then raise exception 'INVALID_INPUT'; end if;
  if target_kind='TRANSFER' then
   if not private.can_access_finance_unit(p_church_id,p_unit,'finance.transfers.manage') then raise exception 'FORBIDDEN' using errcode='42501'; end if;
   select id into transfer from public.financial_transfers where church_id=p_church_id and congregation_id=p_unit and id=target_id and deleted_at is null and status='CONFIRMED'
    and transaction_date=i.transaction_date and amount*100=abs(i.amount_cents) and case when i.amount_cents>0 then target_cashbox_id=i.cashbox_id else source_cashbox_id=i.cashbox_id end;
   if transfer is null then raise exception 'BANK_IMPORT_TARGET_MISMATCH'; end if;
  elsif target_kind='TRANSACTION' then
   select array[id] into ids from public.financial_transactions where church_id=p_church_id and congregation_id=p_unit and id=target_id and deleted_at is null and status='CONFIRMED' and attendance_id is null
    and transaction_date=i.transaction_date and cashbox_id=i.cashbox_id and amount*100=abs(i.amount_cents) and (transaction_type='INCOME')=(i.amount_cents>0);
   if ids is null then raise exception 'BANK_IMPORT_TARGET_MISMATCH'; end if;
  else
   attendance:=target_id;
   if i.amount_cents<0 or not exists(select 1 from public.financial_attendances where church_id=p_church_id and congregation_id=p_unit and id=attendance and deleted_at is null and status='CONFIRMED') then raise exception 'BANK_IMPORT_TARGET_MISMATCH'; end if;
   select array_agg(id),sum(amount*100),count(*) filter(where transaction_date<>i.transaction_date or cashbox_id<>i.cashbox_id or transaction_type<>'INCOME')
    into ids,total,n from public.financial_transactions where church_id=p_church_id and congregation_id=p_unit and attendance_id=attendance and deleted_at is null and status='CONFIRMED';
   if ids is null or total is distinct from i.amount_cents or n<>0 then raise exception 'BANK_IMPORT_TARGET_MISMATCH'; end if;
  end if;
  command_result:=jsonb_build_object('transactionIds',coalesce(to_jsonb(ids),'[]'::jsonb),'attendanceId',attendance,'transferId',transfer,'receiptId',null);
 elsif p_action='DUPLICATE' then
  select * into target from public.finance_bank_import_items where church_id=p_church_id and congregation_id=p_unit and cashbox_id=i.cashbox_id and id=(p_payload->>'targetId')::uuid and deleted_at is null;
  if target.id is null or target.id=i.id or target.status not in ('POSTED','LINKED') or target.transaction_date is distinct from i.transaction_date or target.amount_cents is distinct from i.amount_cents
   or (private.bank_import_health(p_church_id,target.id)->>'stale')::boolean then raise exception 'BANK_IMPORT_TARGET_MISMATCH'; end if;
  update public.finance_bank_import_items set status='DUPLICATE',canonical_id=target.id,result=null,draft='{}',reason=reason where church_id=p_church_id and id=i.id;
 elsif p_action='IGNORE' then
  update public.finance_bank_import_items set status='IGNORED',reason=reason where church_id=p_church_id and id=i.id;
 elsif p_action in ('RESTORE','REOPEN','UNLINK') then
  update public.finance_bank_import_links set deleted_at=now() where church_id=p_church_id and item_id=i.id and deleted_at is null;
  update public.finance_bank_import_items set status='PENDING',canonical_id=null,result=null,reason=reason where church_id=p_church_id and id=i.id;
 end if;
 if p_action in ('POST','LINK') then
  if exists(select 1 from public.finance_bank_import_links where church_id=p_church_id and deleted_at is null and (transaction_id=any(ids) or (transfer_id=transfer and cashbox_id=i.cashbox_id))) then raise exception 'BANK_IMPORT_TARGET_USED'; end if;
  insert into public.finance_bank_import_links(church_id,congregation_id,cashbox_id,item_id,transaction_id,finance_revision)
   select p_church_id,p_unit,i.cashbox_id,i.id,id,revision from public.financial_transactions where church_id=p_church_id and id=any(ids);
  insert into public.finance_bank_import_links(church_id,congregation_id,cashbox_id,item_id,transfer_id,finance_revision)
   select p_church_id,p_unit,i.cashbox_id,i.id,id,revision from public.financial_transfers where church_id=p_church_id and id=transfer;
  update public.finance_bank_import_items set status=case when p_action='POST' then 'POSTED' else 'LINKED' end,result=command_result,draft='{}' where church_id=p_church_id and id=i.id;
 end if;
 update public.finance_bank_import_items set revision=revision+1,updated_at=now() where church_id=p_church_id and id=i.id;
 select coalesce(display_name,full_name,'Usuário') into actor from public.profiles where id=auth.uid();
 event_reason:=nullif(concat_ws(E'\n',reason,nullif(p_payload->>'duplicateReason',''),nullif(p_payload->>'reconciliationReason','')),'');
 insert into public.finance_bank_import_events(church_id,congregation_id,item_id,action,revision,reason,created_by,actor_name)
 values(p_church_id,p_unit,i.id,p_action,i.revision+1,event_reason,auth.uid(),coalesce(actor,'Usuário'));
 response:=private.bank_import_item_dto(p_church_id,i.id)||jsonb_build_object('replayed',false);
 insert into public.finance_bank_import_operations(church_id,congregation_id,item_id,operation_key,payload_hash,result,created_by)
 values(p_church_id,p_unit,i.id,p_operation_key,payload_hash,response,auth.uid());
 return response;
end $$;

create function public.finance_bank_import_candidates(p_church_id uuid,p_unit uuid,p_item uuid,p_query text default '') returns jsonb
 language plpgsql stable security invoker set search_path='' as $$
declare i public.finance_bank_import_items; found_rows jsonb;
begin
 if not private.bank_import_access(p_church_id,p_unit) then raise exception 'FORBIDDEN' using errcode='42501'; end if;
 select * into i from public.finance_bank_import_items where church_id=p_church_id and congregation_id=p_unit and id=p_item and deleted_at is null;
 if i.id is null then raise exception 'FORBIDDEN' using errcode='42501'; end if;
 if p_query is null or length(p_query)>100 then raise exception 'INVALID_INPUT'; end if;
 select coalesce(jsonb_agg(to_jsonb(c) order by strong desc,kind,id),'[]'::jsonb) into found_rows from (
  select * from (
   select 'ITEM'::text kind,t.id,concat('Linha ',t.row_number,' · ',b.file_name) label,t.transaction_date date,t.amount_cents "amountCents",
    t.fingerprint=i.fingerprint and t.batch_id<>i.batch_id strong,
    t.status in ('POSTED','LINKED') and t.transaction_date=i.transaction_date and t.amount_cents=i.amount_cents and not (private.bank_import_health(p_church_id,t.id)->>'stale')::boolean compatible,t.status
   from public.finance_bank_import_items t join public.finance_bank_import_batches b on b.church_id=t.church_id and b.id=t.batch_id and b.deleted_at is null
   where t.church_id=p_church_id and t.congregation_id=p_unit and t.cashbox_id=i.cashbox_id and t.id<>i.id and t.deleted_at is null
    and (t.fingerprint=i.fingerprint or (t.transaction_date=i.transaction_date and t.amount_cents=i.amount_cents))
   union all
   select 'TRANSACTION',t.id,coalesce(t.category_name,'Lançamento')||coalesce(' · '||nullif(t.description,''),''),t.transaction_date,(t.amount*100)::bigint*case when t.transaction_type='INCOME' then 1 else -1 end,false,
    not exists(select 1 from public.finance_bank_import_links l where l.church_id=p_church_id and l.transaction_id=t.id and l.deleted_at is null),t.status::text
   from public.financial_transactions t where t.church_id=p_church_id and t.congregation_id=p_unit and t.cashbox_id=i.cashbox_id and t.deleted_at is null and t.status='CONFIRMED' and t.attendance_id is null
    and t.transaction_date=i.transaction_date and t.amount*100=abs(i.amount_cents) and (t.transaction_type='INCOME')=(i.amount_cents>0)
   union all
   select 'ATTENDANCE',t.attendance_id,'Atendimento · '||count(*)||' categorias',min(t.transaction_date),(sum(t.amount)*100)::bigint,false,
    not bool_or(exists(select 1 from public.finance_bank_import_links l where l.church_id=p_church_id and l.transaction_id=t.id and l.deleted_at is null)),'CONFIRMED'
   from public.financial_transactions t where t.church_id=p_church_id and t.congregation_id=p_unit and t.deleted_at is null and t.status='CONFIRMED' and t.attendance_id is not null and i.amount_cents>0
   group by t.attendance_id having bool_and(t.cashbox_id=i.cashbox_id and t.transaction_date=i.transaction_date and t.transaction_type='INCOME') and sum(t.amount)*100=i.amount_cents
   union all
   select 'TRANSFER',t.id,coalesce(nullif(t.description,''),'Transferência interna'),t.transaction_date,(t.amount*100)::bigint*case when i.amount_cents>0 then 1 else -1 end,false,
    not exists(select 1 from public.finance_bank_import_links l where l.church_id=p_church_id and l.transfer_id=t.id and l.cashbox_id=i.cashbox_id and l.deleted_at is null),t.status
   from public.financial_transfers t where t.church_id=p_church_id and t.congregation_id=p_unit and t.deleted_at is null and t.status='CONFIRMED'
    and private.can_access_finance_unit(p_church_id,p_unit,'finance.transfers.manage') and t.transaction_date=i.transaction_date and t.amount*100=abs(i.amount_cents)
    and case when i.amount_cents>0 then t.target_cashbox_id=i.cashbox_id else t.source_cashbox_id=i.cashbox_id end
  ) options where p_query='' or strong or strpos(lower(label),lower(p_query))>0 order by strong desc,kind,id limit 50
 ) c;
 return found_rows;
end $$;

-- Private projections are invokers and can only see rows allowed by RLS.
revoke all on function private.bank_import_health(uuid,uuid),private.bank_import_batch_dto(uuid,uuid),private.bank_import_item_dto(uuid,uuid) from public,anon;
grant execute on function private.bank_import_health(uuid,uuid),private.bank_import_batch_dto(uuid,uuid),private.bank_import_item_dto(uuid,uuid) to authenticated;
revoke all on function public.prepare_finance_bank_import(uuid,uuid,uuid,text,text,jsonb),public.list_finance_bank_imports(uuid,uuid,uuid,integer),
 public.get_finance_bank_import(uuid,uuid,uuid,jsonb),public.finance_bank_import_item(uuid,uuid,uuid,integer,uuid,text,jsonb),public.finance_bank_import_candidates(uuid,uuid,uuid,text) from public,anon;
grant execute on function public.prepare_finance_bank_import(uuid,uuid,uuid,text,text,jsonb),public.list_finance_bank_imports(uuid,uuid,uuid,integer),
 public.get_finance_bank_import(uuid,uuid,uuid,jsonb),public.finance_bank_import_item(uuid,uuid,uuid,integer,uuid,text,jsonb),public.finance_bank_import_candidates(uuid,uuid,uuid,text) to authenticated;
