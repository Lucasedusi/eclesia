-- Read-only diagnostics; counts only, no personal/financial row contents.
select 'cashboxes_without_unit' issue,count(*) from public.financial_cashboxes where congregation_id is null and deleted_at is null
union all select 'transactions_without_unit',count(*) from public.financial_transactions where congregation_id is null and deleted_at is null
union all select 'transactions_cross_tenant_box',count(*) from public.financial_transactions t join public.financial_cashboxes b on b.id=t.cashbox_id where b.church_id<>t.church_id or b.congregation_id is distinct from t.congregation_id
union all select 'transactions_cross_tenant_member',count(*) from public.financial_transactions t join public.members m on m.id=t.member_id where m.church_id<>t.church_id
union all select 'cashboxes_with_unreconciled_balance',count(*) from public.financial_cashboxes where current_balance<>0 or opening_balance<>0
union all select 'receipts_without_source',count(*) from public.financial_receipts where financial_transaction_id is null
union all select 'duplicate_active_department_names',count(*) from (select church_id,lower(name) from public.financial_departments where deleted_at is null group by church_id,lower(name) having count(*)>1) d;
