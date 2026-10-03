-- Composite tenant keys preserve existing rows; new references cannot cross tenants.
do $$ declare t text; begin
 foreach t in array array['financial_departments','financial_categories','financial_payment_methods','financial_cashboxes','financial_transactions','financial_receipts','report_deliveries','report_delivery_rules'] loop
  execute format('create unique index if not exists %I on public.%I(church_id,id)',t||'_finance_tenant_id',t);
 end loop;
end $$;
alter table public.financial_cashboxes add column opening_date date;
alter table public.financial_cashboxes add constraint finance_cashbox_unit_fk foreign key(church_id,congregation_id) references public.congregations(church_id,id) not valid;
alter table public.financial_categories add constraint finance_category_department_fk foreign key(church_id,department_id) references public.financial_departments(church_id,id) not valid;
alter table public.financial_categories add constraint finance_category_parent_fk foreign key(church_id,parent_id) references public.financial_categories(church_id,id) not valid;

create table public.financial_department_base_versions (id uuid primary key default gen_random_uuid(), church_id uuid not null references public.churches(id),
 created_by uuid references public.profiles(id), created_at timestamptz not null default now(), updated_at timestamptz not null default now(), deleted_at timestamptz,
 unique(church_id,id),
department_id uuid not null, effective_month date not null check(extract(day from effective_month)=1), revision integer not null check(revision>0), participates_in_base boolean not null, reason text,
 foreign key(church_id,department_id) references public.financial_departments(church_id,id), unique(church_id,department_id,effective_month,revision));
alter table public.financial_department_base_versions enable row level security;
revoke all on public.financial_department_base_versions from public,anon,authenticated;
grant select on public.financial_department_base_versions to authenticated;
create policy finance_scoped_read on public.financial_department_base_versions for select to authenticated using(deleted_at is null and private.can_read_finance_catalog(church_id));

create table public.financial_tithe_classifications (id uuid primary key default gen_random_uuid(), church_id uuid not null references public.churches(id),
 created_by uuid references public.profiles(id), created_at timestamptz not null default now(), updated_at timestamptz not null default now(), deleted_at timestamptz,
 unique(church_id,id),
name text not null check(length(trim(name)) between 1 and 120), role_id uuid, status text not null default 'ACTIVE' check(status in ('ACTIVE','INACTIVE')), foreign key(church_id,role_id) references public.roles(church_id,id));
alter table public.financial_tithe_classifications enable row level security;
revoke all on public.financial_tithe_classifications from public,anon,authenticated;
grant select on public.financial_tithe_classifications to authenticated;
create policy finance_scoped_read on public.financial_tithe_classifications for select to authenticated using(deleted_at is null and private.can_read_finance_catalog(church_id));

create table public.financial_cashbox_payment_methods (id uuid primary key default gen_random_uuid(), church_id uuid not null references public.churches(id),
 created_by uuid references public.profiles(id), created_at timestamptz not null default now(), updated_at timestamptz not null default now(), deleted_at timestamptz,
 unique(church_id,id),
cashbox_id uuid not null,payment_method_id uuid not null,
 foreign key(church_id,cashbox_id) references public.financial_cashboxes(church_id,id), foreign key(church_id,payment_method_id) references public.financial_payment_methods(church_id,id), unique(church_id,cashbox_id,payment_method_id));
alter table public.financial_cashbox_payment_methods enable row level security;
revoke all on public.financial_cashbox_payment_methods from public,anon,authenticated;
grant select on public.financial_cashbox_payment_methods to authenticated;
create policy finance_scoped_read on public.financial_cashbox_payment_methods for select to authenticated using(deleted_at is null and exists(select 1 from public.financial_cashboxes b where b.id=cashbox_id and b.church_id=financial_cashbox_payment_methods.church_id and private.can_access_finance_unit(b.church_id,b.congregation_id,'finance.view')));

create table public.financial_operations (id uuid primary key default gen_random_uuid(), church_id uuid not null references public.churches(id),
 created_by uuid references public.profiles(id), created_at timestamptz not null default now(), updated_at timestamptz not null default now(), deleted_at timestamptz,
 unique(church_id,id),
operation_key uuid not null, kind text not null, payload_hash text not null, result jsonb, congregation_id uuid not null,
 foreign key(church_id,congregation_id) references public.congregations(church_id,id), unique(church_id,created_by,operation_key));
alter table public.financial_operations enable row level security;
revoke all on public.financial_operations from public,anon,authenticated;
grant select on public.financial_operations to authenticated;
create policy finance_scoped_read on public.financial_operations for select to authenticated using(deleted_at is null and created_by=(select auth.uid()) and private.can_access_finance_unit(church_id,congregation_id,'finance.view'));

create table public.financial_attendances (id uuid primary key default gen_random_uuid(), church_id uuid not null references public.churches(id),
 created_by uuid references public.profiles(id), created_at timestamptz not null default now(), updated_at timestamptz not null default now(), deleted_at timestamptz,
 unique(church_id,id),
congregation_id uuid not null,member_id uuid,person_name text,contributor_kind text not null check(contributor_kind in ('MEMBER','UNREGISTERED','COLLECTIVE')),
 cashbox_id uuid not null,payment_method_id uuid not null,transaction_date date not null,revision integer not null default 1,
 status text not null default 'CONFIRMED' check(status in ('CONFIRMED','CANCELLED')),cancel_reason text,
 foreign key(church_id,congregation_id) references public.congregations(church_id,id), foreign key(church_id,member_id) references public.members(church_id,id),
 foreign key(church_id,cashbox_id,payment_method_id) references public.financial_cashbox_payment_methods(church_id,cashbox_id,payment_method_id));
alter table public.financial_attendances enable row level security;
revoke all on public.financial_attendances from public,anon,authenticated;
grant select on public.financial_attendances to authenticated;
create policy finance_scoped_read on public.financial_attendances for select to authenticated using(deleted_at is null and private.can_access_finance_unit(church_id,congregation_id,'finance.view'));

create table public.financial_transfers (id uuid primary key default gen_random_uuid(), church_id uuid not null references public.churches(id),
 created_by uuid references public.profiles(id), created_at timestamptz not null default now(), updated_at timestamptz not null default now(), deleted_at timestamptz,
 unique(church_id,id),
congregation_id uuid not null,source_cashbox_id uuid not null,target_cashbox_id uuid not null, amount numeric(12,2) not null check(amount>0),transaction_date date not null,description text,
 revision integer not null default 1,status text not null default 'CONFIRMED' check(status in ('CONFIRMED','CANCELLED')),cancel_reason text,check(source_cashbox_id<>target_cashbox_id),
 foreign key(church_id,congregation_id) references public.congregations(church_id,id), foreign key(church_id,source_cashbox_id) references public.financial_cashboxes(church_id,id), foreign key(church_id,target_cashbox_id) references public.financial_cashboxes(church_id,id));
alter table public.financial_transfers enable row level security;
revoke all on public.financial_transfers from public,anon,authenticated;
grant select on public.financial_transfers to authenticated;
create policy finance_scoped_read on public.financial_transfers for select to authenticated using(deleted_at is null and private.can_access_finance_unit(church_id,congregation_id,'finance.view'));

create table public.financial_balance_adjustments (id uuid primary key default gen_random_uuid(), church_id uuid not null references public.churches(id),
 created_by uuid references public.profiles(id), created_at timestamptz not null default now(), updated_at timestamptz not null default now(), deleted_at timestamptz,
 unique(church_id,id),
congregation_id uuid not null,cashbox_id uuid not null,amount numeric(12,2) not null check(amount<>0),transaction_date date not null,reason text not null check(length(trim(reason)) between 5 and 1000),
 foreign key(church_id,congregation_id) references public.congregations(church_id,id),foreign key(church_id,cashbox_id) references public.financial_cashboxes(church_id,id));
alter table public.financial_balance_adjustments enable row level security;
revoke all on public.financial_balance_adjustments from public,anon,authenticated;
grant select on public.financial_balance_adjustments to authenticated;
create policy finance_scoped_read on public.financial_balance_adjustments for select to authenticated using(deleted_at is null and private.can_access_finance_unit(church_id,congregation_id,'finance.view'));

create table public.financial_ledger_entries (id uuid primary key default gen_random_uuid(), church_id uuid not null references public.churches(id),
 created_by uuid references public.profiles(id), created_at timestamptz not null default now(), updated_at timestamptz not null default now(), deleted_at timestamptz,
 unique(church_id,id),
congregation_id uuid not null,cashbox_id uuid not null,transaction_id uuid,transfer_id uuid,adjustment_id uuid,operation_id uuid,
 entry_kind text not null check(entry_kind in ('OPENING','TRANSACTION','REVERSAL','TRANSFER','ADJUSTMENT')),amount numeric(12,2) not null,financial_date date not null,reverses_entry_id uuid,source_revision integer not null default 1,
 foreign key(church_id,congregation_id) references public.congregations(church_id,id), foreign key(church_id,cashbox_id) references public.financial_cashboxes(church_id,id),
 foreign key(church_id,transaction_id) references public.financial_transactions(church_id,id),foreign key(church_id,transfer_id) references public.financial_transfers(church_id,id),
 foreign key(church_id,adjustment_id) references public.financial_balance_adjustments(church_id,id),foreign key(church_id,operation_id) references public.financial_operations(church_id,id),
 foreign key(church_id,reverses_entry_id) references public.financial_ledger_entries(church_id,id),unique(reverses_entry_id));
alter table public.financial_ledger_entries enable row level security;
revoke all on public.financial_ledger_entries from public,anon,authenticated;
grant select on public.financial_ledger_entries to authenticated;
create policy finance_scoped_read on public.financial_ledger_entries for select to authenticated using(deleted_at is null and private.can_access_finance_unit(church_id,congregation_id,'finance.view'));

create table public.financial_transaction_revisions (id uuid primary key default gen_random_uuid(), church_id uuid not null references public.churches(id),
 created_by uuid references public.profiles(id), created_at timestamptz not null default now(), updated_at timestamptz not null default now(), deleted_at timestamptz,
 unique(church_id,id),
congregation_id uuid not null, transaction_id uuid,transfer_id uuid,revision integer not null,reason text not null,previous_values jsonb,new_values jsonb not null,
 foreign key(church_id,congregation_id) references public.congregations(church_id,id), foreign key(church_id,transaction_id) references public.financial_transactions(church_id,id), foreign key(church_id,transfer_id) references public.financial_transfers(church_id,id),
 check(num_nonnulls(transaction_id,transfer_id)=1),unique(transaction_id,revision),unique(transfer_id,revision));
alter table public.financial_transaction_revisions enable row level security;
revoke all on public.financial_transaction_revisions from public,anon,authenticated;
grant select on public.financial_transaction_revisions to authenticated;
create policy finance_scoped_read on public.financial_transaction_revisions for select to authenticated using(deleted_at is null and private.can_access_finance_unit(church_id,congregation_id,'finance.view'));

create table public.financial_period_revisions (id uuid primary key default gen_random_uuid(), church_id uuid not null references public.churches(id),
 created_by uuid references public.profiles(id), created_at timestamptz not null default now(), updated_at timestamptz not null default now(), deleted_at timestamptz,
 unique(church_id,id),
congregation_id uuid not null,month date not null check(extract(day from month)=1),revision bigint not null default 1,
 foreign key(church_id,congregation_id) references public.congregations(church_id,id),unique(church_id,congregation_id,month));
alter table public.financial_period_revisions enable row level security;
revoke all on public.financial_period_revisions from public,anon,authenticated;
grant select on public.financial_period_revisions to authenticated;
create policy finance_scoped_read on public.financial_period_revisions for select to authenticated using(deleted_at is null and private.can_access_finance_unit(church_id,congregation_id,'finance.view'));

create table public.report_delivery_rule_sets (id uuid primary key default gen_random_uuid(), church_id uuid not null references public.churches(id),
 created_by uuid references public.profiles(id), created_at timestamptz not null default now(), updated_at timestamptz not null default now(), deleted_at timestamptz,
 unique(church_id,id),
congregation_id uuid not null,effective_month date not null check(extract(day from effective_month)=1),revision integer not null,reason text,items jsonb not null check(jsonb_typeof(items)='array'),
 foreign key(church_id,congregation_id) references public.congregations(church_id,id),unique(church_id,congregation_id,effective_month,revision));
alter table public.report_delivery_rule_sets enable row level security;
revoke all on public.report_delivery_rule_sets from public,anon,authenticated;
grant select on public.report_delivery_rule_sets to authenticated;
create policy finance_scoped_read on public.report_delivery_rule_sets for select to authenticated using(deleted_at is null and private.can_access_finance_unit(church_id,congregation_id,'finance.view'));

create table public.report_delivery_versions (id uuid primary key default gen_random_uuid(), church_id uuid not null references public.churches(id),
 created_by uuid references public.profiles(id), created_at timestamptz not null default now(), updated_at timestamptz not null default now(), deleted_at timestamptz,
 unique(church_id,id),
congregation_id uuid not null,report_delivery_id uuid not null,rule_set_id uuid not null,month date not null,revision integer not null,source_revision bigint not null,configuration_hash text not null,snapshot jsonb not null,
 foreign key(church_id,congregation_id) references public.congregations(church_id,id),foreign key(church_id,report_delivery_id) references public.report_deliveries(church_id,id),foreign key(church_id,rule_set_id) references public.report_delivery_rule_sets(church_id,id),unique(report_delivery_id,revision));
alter table public.report_delivery_versions enable row level security;
revoke all on public.report_delivery_versions from public,anon,authenticated;
grant select on public.report_delivery_versions to authenticated;
create policy finance_scoped_read on public.report_delivery_versions for select to authenticated using(deleted_at is null and private.can_access_finance_unit(church_id,congregation_id,'finance.view'));

create table public.financial_receipt_items (id uuid primary key default gen_random_uuid(), church_id uuid not null references public.churches(id),
 created_by uuid references public.profiles(id), created_at timestamptz not null default now(), updated_at timestamptz not null default now(), deleted_at timestamptz,
 unique(church_id,id),
congregation_id uuid not null,receipt_id uuid not null,transaction_id uuid not null,category_name text not null,department_name text not null,classification_name text,amount numeric(12,2) not null check(amount>0),sort_order integer not null,
 foreign key(church_id,congregation_id) references public.congregations(church_id,id),foreign key(church_id,receipt_id) references public.financial_receipts(church_id,id),foreign key(church_id,transaction_id) references public.financial_transactions(church_id,id),unique(receipt_id,transaction_id));
alter table public.financial_receipt_items enable row level security;
revoke all on public.financial_receipt_items from public,anon,authenticated;
grant select on public.financial_receipt_items to authenticated;
create policy finance_scoped_read on public.financial_receipt_items for select to authenticated using(deleted_at is null and private.can_access_finance_unit(church_id,congregation_id,'finance.view'));

create unique index finance_classification_active_name on public.financial_tithe_classifications(church_id,lower(name)) where deleted_at is null;
create index finance_ledger_unit_date on public.financial_ledger_entries(church_id,congregation_id,financial_date,id);
create index finance_ledger_box_date on public.financial_ledger_entries(church_id,cashbox_id,financial_date);
create index finance_ledger_transaction on public.financial_ledger_entries(church_id,transaction_id,source_revision);
create index finance_ledger_transfer on public.financial_ledger_entries(church_id,transfer_id,source_revision);
create unique index finance_ledger_opening on public.financial_ledger_entries(church_id,cashbox_id) where entry_kind='OPENING';
create index finance_attendance_unit_date on public.financial_attendances(church_id,congregation_id,transaction_date);
create index finance_transfer_unit_date on public.financial_transfers(church_id,congregation_id,transaction_date);
create index finance_adjustment_unit_date on public.financial_balance_adjustments(church_id,congregation_id,transaction_date);
create index finance_revision_unit on public.financial_transaction_revisions(church_id,congregation_id,created_at);
create index finance_rule_set_effective on public.report_delivery_rule_sets(church_id,congregation_id,effective_month desc,revision desc);
create index finance_statement_month on public.report_delivery_versions(church_id,congregation_id,month desc,revision desc);

alter table public.financial_transactions add column revision integer not null default 1,
 add column attendance_id uuid,add column tithe_classification_id uuid,add column classification_name text,
 add column beneficiary_name text,add column contributor_kind text,add column category_name text,add column department_name text;
alter table public.financial_transactions add constraint finance_tx_unit foreign key(church_id,congregation_id) references public.congregations(church_id,id) not valid,
 add constraint finance_tx_member foreign key(church_id,member_id) references public.members(church_id,id) not valid,
 add constraint finance_tx_category foreign key(church_id,category_id) references public.financial_categories(church_id,id) not valid,
 add constraint finance_tx_department foreign key(church_id,department_id) references public.financial_departments(church_id,id) not valid,
 add constraint finance_tx_box_method foreign key(church_id,cashbox_id,payment_method_id) references public.financial_cashbox_payment_methods(church_id,cashbox_id,payment_method_id) not valid,
 add constraint finance_tx_attendance foreign key(church_id,attendance_id) references public.financial_attendances(church_id,id),
 add constraint finance_tx_classification foreign key(church_id,tithe_classification_id) references public.financial_tithe_classifications(church_id,id);
create index finance_transaction_unit_date on public.financial_transactions(church_id,congregation_id,transaction_date desc,id) where deleted_at is null;
create index finance_transaction_attendance on public.financial_transactions(church_id,attendance_id);
alter table public.financial_receipts alter column financial_transaction_id drop not null;
alter table public.financial_receipts add column attendance_id uuid,add column revision integer not null default 1,add column supersedes_id uuid,add column snapshot jsonb;
alter table public.financial_receipts drop constraint financial_receipts_status_check;
alter table public.financial_receipts add constraint financial_receipts_status_check check(receipt_status in ('ISSUED','PRINTED','REPRINTED','CANCELLED','SUPERSEDED')),
 add constraint finance_receipt_origin check(num_nonnulls(financial_transaction_id,attendance_id)=1),
 add constraint finance_receipt_attendance foreign key(church_id,attendance_id) references public.financial_attendances(church_id,id),
 add constraint finance_receipt_transaction foreign key(church_id,financial_transaction_id) references public.financial_transactions(church_id,id) not valid,
 add constraint finance_receipt_previous foreign key(church_id,supersedes_id) references public.financial_receipts(church_id,id);
create index finance_receipt_attendance on public.financial_receipts(church_id,attendance_id);
alter table public.report_delivery_rules add column rule_set_id uuid,
 add constraint finance_rule_set foreign key(church_id,rule_set_id) references public.report_delivery_rule_sets(church_id,id);
alter table public.report_delivery_items add column version_id uuid,
 add constraint finance_report_version foreign key(church_id,version_id) references public.report_delivery_versions(church_id,id);

create function private.finance_immutable() returns trigger language plpgsql set search_path='' as $$
begin raise exception 'IMMUTABLE_FINANCIAL_HISTORY' using errcode='23514'; end; $$;
revoke all on function private.finance_immutable() from public,anon,authenticated;
create trigger immutable_finance_ledger before update or delete on public.financial_ledger_entries for each row execute function private.finance_immutable();
create trigger immutable_finance_revisions before update or delete on public.financial_transaction_revisions for each row execute function private.finance_immutable();
create trigger immutable_finance_department_versions before update or delete on public.financial_department_base_versions for each row execute function private.finance_immutable();
create trigger immutable_finance_rule_sets before update or delete on public.report_delivery_rule_sets for each row execute function private.finance_immutable();
create trigger immutable_finance_statement_versions before update or delete on public.report_delivery_versions for each row execute function private.finance_immutable();
create trigger immutable_finance_receipt_items before update or delete on public.financial_receipt_items for each row execute function private.finance_immutable();

create function private.finance_ledger_effect() returns trigger language plpgsql security definer set search_path='' as $$
declare b public.financial_cashboxes; begin
 select * into b from public.financial_cashboxes where church_id=new.church_id and id=new.cashbox_id for update;
 if b.congregation_id is distinct from new.congregation_id or b.opening_date is null or new.financial_date<b.opening_date then raise exception 'INVALID_INPUT' using errcode='22023'; end if;
 update public.financial_cashboxes set current_balance=current_balance+new.amount,updated_at=now() where church_id=new.church_id and id=new.cashbox_id;
 insert into public.financial_period_revisions(church_id,congregation_id,month,revision,created_by)
 values(new.church_id,new.congregation_id,date_trunc('month',new.financial_date)::date,1,new.created_by)
 on conflict(church_id,congregation_id,month) do update set revision=public.financial_period_revisions.revision+1,updated_at=now();
 return new;
end $$;
revoke all on function private.finance_ledger_effect() from public,anon,authenticated;
create trigger project_finance_ledger after insert on public.financial_ledger_entries for each row execute function private.finance_ledger_effect();
