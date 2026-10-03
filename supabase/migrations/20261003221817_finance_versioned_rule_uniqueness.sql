-- Legacy uniqueness remains for legacy records. New uniqueness is per immutable version.
drop index public.report_delivery_items_unique_idx;
create unique index report_delivery_items_unique_idx on public.report_delivery_items(report_delivery_id,lower(rule_name)) where deleted_at is null and version_id is null;
create unique index finance_report_items_version_name on public.report_delivery_items(church_id,version_id,lower(rule_name)) where version_id is not null;
drop index public.report_delivery_rules_unique_idx;
create unique index report_delivery_rules_unique_idx on public.report_delivery_rules(church_id,coalesce(congregation_id,'00000000-0000-0000-0000-000000000000'::uuid),lower(name),effective_from) where deleted_at is null and rule_set_id is null;
create unique index finance_rules_version_name on public.report_delivery_rules(church_id,rule_set_id,lower(name)) where rule_set_id is not null;
