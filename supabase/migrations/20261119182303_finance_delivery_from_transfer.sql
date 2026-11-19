-- Keep the manual delivery and its optimistic revision independent from the
-- receipts that support it. Reversing either source can then reveal the other.
create table private.finance_delivery_transfer_events (
  id bigint generated always as identity primary key,
  church_id uuid not null,
  transaction_id uuid not null,
  headquarters_id uuid not null,
  payer_id uuid not null,
  report_month date not null,
  movement_date date not null,
  included boolean not null,
  actor_id uuid references public.profiles(id),
  recorded_at timestamptz not null default statement_timestamp(),
  foreign key (church_id,transaction_id) references public.financial_transactions(church_id,id),
  foreign key (church_id,headquarters_id) references public.congregations(church_id,id),
  foreign key (church_id,payer_id) references public.congregations(church_id,id),
  check (payer_id <> headquarters_id and extract(day from report_month) = 1
         and movement_date >= (report_month + interval '1 month')::date)
);
create index finance_delivery_transfer_transaction on private.finance_delivery_transfer_events(church_id,transaction_id,id desc);
create index finance_delivery_transfer_month on private.finance_delivery_transfer_events(church_id,report_month,payer_id);
create index finance_delivery_transfer_payer on private.finance_delivery_transfer_events(church_id,payer_id);
create index finance_delivery_transfer_headquarters on private.finance_delivery_transfer_events(church_id,headquarters_id);
create index finance_delivery_transfer_actor on private.finance_delivery_transfer_events(actor_id);
alter table private.finance_delivery_transfer_events enable row level security;
revoke all on private.finance_delivery_transfer_events from public,anon,authenticated;
grant select on private.finance_delivery_transfer_events to authenticated;
create policy admin_read on private.finance_delivery_transfer_events for select to authenticated using (
  private.can_manage_finance_reports(church_id)
  and private.can_access_finance_unit(church_id,payer_id,'finance.view')
  and private.can_access_finance_unit(church_id,headquarters_id,'finance.view')
);
create trigger immutable_delivery_transfer_events before update or delete on private.finance_delivery_transfer_events
  for each row execute function private.finance_immutable();

-- Invoked in the same transaction and under the privileges of the existing
-- finance writer. Category roles are evaluated when posting or correcting.
create function private.track_finance_delivery_transfer() returns trigger
language plpgsql security invoker set search_path='' as $$
declare
  prior private.finance_delivery_transfer_events;
  report_month date;
  eligible boolean := false;
begin
  if new.created_at < tg_argv[0]::timestamptz then return null; end if;
  if tg_op='UPDATE' then
    if old.contributor_congregation_id is null and new.contributor_congregation_id is null then return null; end if;
    select * into prior from private.finance_delivery_transfer_events e
      where e.church_id=new.church_id and e.transaction_id=new.id order by e.id desc limit 1;
  end if;

  if new.deleted_at is null and new.status='CONFIRMED' and new.transaction_type='INCOME'
     and new.contributor_congregation_id is not null and new.contributor_congregation_id<>new.congregation_id
     and new.reference_year between 2000 and 2099 and new.reference_month between 1 and 12 then
    report_month := make_date(new.reference_year,new.reference_month,1);
    eligible := new.transaction_date >= (report_month + interval '1 month')::date
      and exists (select from public.financial_categories cat where cat.church_id=new.church_id
        and cat.id=new.category_id and cat.deleted_at is null and cat.informative_role='TRANSFER')
      and exists (select from public.congregations c where c.church_id=new.church_id
        and c.id=new.congregation_id and c.is_headquarters and c.deleted_at is null)
      and exists (select from public.congregations c where c.church_id=new.church_id
        and c.id=new.contributor_congregation_id and not c.is_headquarters and c.deleted_at is null);
  end if;

  if prior.included then
    if eligible and (prior.payer_id,prior.report_month,prior.headquarters_id) =
                    (new.contributor_congregation_id,report_month,new.congregation_id) then
      if prior.movement_date=new.transaction_date then return null; end if;
    else
      insert into private.finance_delivery_transfer_events
        (church_id,transaction_id,headquarters_id,payer_id,report_month,movement_date,included,actor_id)
        values (prior.church_id,prior.transaction_id,prior.headquarters_id,prior.payer_id,
                prior.report_month,prior.movement_date,false,auth.uid());
    end if;
  end if;
  if eligible then
    insert into private.finance_delivery_transfer_events
      (church_id,transaction_id,headquarters_id,payer_id,report_month,movement_date,included,actor_id)
      values (new.church_id,new.id,new.congregation_id,new.contributor_congregation_id,
              report_month,new.transaction_date,true,auth.uid());
  end if;
  return null;
end $$;
revoke all on function private.track_finance_delivery_transfer() from public,anon,authenticated;

-- Created-at is assigned by the finance writer. Historical entries need review
-- before retroactive use, including when an older transaction is later edited.
do $$ begin
  execute format('create trigger track_finance_delivery_transfer after insert or update of
    contributor_congregation_id, congregation_id, category_id, transaction_type, status,
    deleted_at, transaction_date, reference_month, reference_year on public.financial_transactions
    for each row execute function private.track_finance_delivery_transfer(%L)',now());
end $$;

create function public.list_finance_deliveries_with_transfers(p_church_id uuid,p_month text,p_include_inactive boolean)
returns jsonb language plpgsql stable security invoker set search_path='' as $$
declare
  base jsonb;
  rows jsonb;
begin
  -- The manual projection enforces administrative access and the authorized
  -- congregation set, and is shared by both versions during rollout.
  base := public.list_finance_deliveries(p_church_id,p_month,p_include_inactive);
  with events as materialized (
    select e.*, coalesce(p.display_name,p.full_name,'Sistema') actor
    from private.finance_delivery_transfer_events e
    left join public.profiles p on p.id=e.actor_id
    where e.church_id=p_church_id and e.report_month=(p_month||'-01')::date
  ), latest as (
    select distinct on (payer_id,transaction_id) * from events order by payer_id,transaction_id,id desc
  ), first_receipt as (
    select distinct on (payer_id) * from latest
    where included and movement_date <= (base->>'today')::date
    order by payer_id,movement_date,transaction_id
  ), history as (
    select payer_id,jsonb_agg(jsonb_build_object('eventId',id::text,'id',transaction_id,'unit',headquarters_id,
      'date',movement_date,'included',included,'actor',actor,'createdAt',recorded_at) order by id desc) items
    from events group by payer_id
  )
  select coalesce(jsonb_agg(r || jsonb_build_object(
    'deliveryDate',coalesce(r->>'deliveryDate',f.movement_date::text),
    'source',case when r->>'deliveryDate' is not null then 'MANUAL' when f.id is not null then 'TRANSFER' end,
    'transfer',case when f.id is not null then jsonb_build_object('id',f.transaction_id,'unit',f.headquarters_id,'date',f.movement_date) end,
    'transferHistory',coalesce(h.items,'[]'::jsonb)
  ) order by ord),'[]'::jsonb) into rows
  from jsonb_array_elements(base->'rows') with ordinality as b(r,ord)
  left join first_receipt f on f.payer_id=(r->>'id')::uuid
  left join history h on h.payer_id=(r->>'id')::uuid;
  return jsonb_set(base,'{rows}',rows);
end $$;
revoke all on function public.list_finance_deliveries_with_transfers(uuid,text,boolean) from public,anon;
grant execute on function public.list_finance_deliveries_with_transfers(uuid,text,boolean) to authenticated;
