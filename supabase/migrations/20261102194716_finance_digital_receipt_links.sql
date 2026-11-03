-- Public links carry an opaque token; only its SHA-256 hash is persisted.
alter table public.financial_receipts
  add constraint financial_receipts_church_unit_id_key unique (church_id, congregation_id, id);

create table public.financial_receipt_links (
  id uuid primary key default gen_random_uuid(),
  church_id uuid not null,
  congregation_id uuid not null,
  receipt_id uuid not null,
  token_hash text not null unique check (token_hash ~ '^[a-f0-9]{64}$'),
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '30 days'),
  revoked_at timestamptz,
  deleted_at timestamptz,
  window_started_at timestamptz not null default now(),
  window_reads integer not null default 0 check (window_reads >= 0),
  foreign key (church_id, congregation_id, receipt_id)
    references public.financial_receipts(church_id, congregation_id, id),
  check (expires_at > created_at and expires_at <= created_at + interval '30 days')
);
create index financial_receipt_links_receipt_idx
  on public.financial_receipt_links(church_id, congregation_id, receipt_id, created_at desc);
create index financial_receipt_links_creator_idx on public.financial_receipt_links(created_by);
alter table public.financial_receipt_links enable row level security;
revoke all on public.financial_receipt_links from public, anon, authenticated, service_role;
grant select, update on public.financial_receipt_links to service_role;

create function public.issue_finance_receipt_link(p_church_id uuid, p_receipt_id uuid, p_token_hash text)
returns timestamptz language plpgsql security definer set search_path = '' as $$
declare r public.financial_receipts; expiry timestamptz;
begin
  if auth.uid() is null then raise exception 'FORBIDDEN'; end if;
  if p_token_hash is null or p_token_hash !~ '^[a-f0-9]{64}$' then raise exception 'INVALID_INPUT'; end if;
  select * into r from public.financial_receipts
    where church_id = p_church_id and id = p_receipt_id and deleted_at is null
      and private.can_access_finance_unit(church_id, congregation_id, 'finance.view')
    for update;
  if r.id is null then raise exception 'FORBIDDEN'; end if;
  if r.receipt_status not in ('ISSUED', 'PRINTED', 'REPRINTED') or r.snapshot is null then
    raise exception 'RECEIPT_UNAVAILABLE';
  end if;
  if (select count(*) from public.financial_receipt_links
      where church_id = r.church_id and congregation_id = r.congregation_id and receipt_id = r.id
        and created_at > now() - interval '10 minutes') >= 20 then
    raise exception 'RECEIPT_LINK_LIMIT';
  end if;
  insert into public.financial_receipt_links(church_id, congregation_id, receipt_id, token_hash, created_by)
    values (r.church_id, r.congregation_id, r.id, p_token_hash, auth.uid())
    returning expires_at into expiry;
  return expiry;
end;
$$;
revoke all on function public.issue_finance_receipt_link(uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.issue_finance_receipt_link(uuid, uuid, text) to authenticated;

-- Atomic shared read budget, only callable by the narrowly scoped server flow.
create function public.consume_finance_receipt_link(p_token_hash text)
returns table(church_id uuid, congregation_id uuid, receipt_id uuid)
language sql security invoker set search_path = '' as $$
  update public.financial_receipt_links l
  set window_reads = case when l.window_started_at <= now() - interval '10 minutes' then 1 else l.window_reads + 1 end,
      window_started_at = case when l.window_started_at <= now() - interval '10 minutes' then now() else l.window_started_at end
  where l.token_hash = p_token_hash and l.expires_at > now() and l.revoked_at is null and l.deleted_at is null
    and (l.window_started_at <= now() - interval '10 minutes' or l.window_reads < 60)
    and exists (select 1 from public.financial_receipts r
      where r.church_id = l.church_id and r.congregation_id = l.congregation_id and r.id = l.receipt_id
        and r.deleted_at is null and r.receipt_status in ('ISSUED', 'PRINTED', 'REPRINTED'))
  returning l.church_id, l.congregation_id, l.receipt_id;
$$;
revoke all on function public.consume_finance_receipt_link(text) from public, anon, authenticated;
grant execute on function public.consume_finance_receipt_link(text) to service_role;
