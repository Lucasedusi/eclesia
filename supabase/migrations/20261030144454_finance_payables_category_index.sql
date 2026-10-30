-- Cover the tenant-aware category relationship reported by local Advisors.
create index payable_category_tenant_idx on public.accounts_payable(church_id,category_id);
