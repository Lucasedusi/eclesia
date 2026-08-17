-- Read-only checks for the linked Supabase project. Run before and after the
-- migration and attach the output to the deployment record.

-- New functions must remain SECURITY INVOKER (prosecdef = false).
select
  namespace.nspname as schema_name,
  procedure.proname as function_name,
  procedure.prosecdef as security_definer
from pg_proc procedure
join pg_namespace namespace on namespace.oid = procedure.pronamespace
where namespace.nspname = 'public'
  and procedure.proname in (
    'get_administrative_document_references',
    'get_administrative_document_workspace_stats'
  )
order by procedure.proname;

-- Cleanup functions must be SECURITY DEFINER and restricted to service_role.
select
  namespace.nspname as schema_name,
  procedure.proname as function_name,
  procedure.prosecdef as security_definer
from pg_proc procedure
join pg_namespace namespace on namespace.oid = procedure.pronamespace
where namespace.nspname = 'public'
  and procedure.proname in (
    'claim_stale_administrative_document_cleanups',
    'record_administrative_document_cleanup_attempt'
  )
order by procedure.proname;

-- Confirm explicit EXECUTE grants and absence of anon/PUBLIC grants.
select routine_name, grantee, privilege_type
from information_schema.routine_privileges
where routine_schema = 'public'
  and routine_name in (
    'get_administrative_document_references',
    'get_administrative_document_workspace_stats',
    'claim_stale_administrative_document_cleanups',
    'record_administrative_document_cleanup_attempt'
  )
order by routine_name, grantee;

-- Queue state is operational metadata only and must not be exposed to app roles.
select grantee, privilege_type
from information_schema.table_privileges
where table_schema = 'private'
  and table_name = 'administrative_document_cleanup_queue'
order by grantee, privilege_type;

-- Confirm RLS remains enabled on every table read by the RPCs.
select relname as table_name, relrowsecurity as rls_enabled
from pg_class
where oid in (
  'public.administrative_documents'::regclass,
  'public.document_categories'::regclass,
  'public.document_folders'::regclass,
  'public.document_tags'::regclass,
  'public.user_church_access'::regclass,
  'public.profiles'::regclass
)
order by relname;

-- Foreign keys whose leading columns have no supporting index.
select
  constraint_table.relname as table_name,
  constraint_record.conname as constraint_name,
  pg_get_constraintdef(constraint_record.oid) as constraint_definition
from pg_constraint constraint_record
join pg_class constraint_table on constraint_table.oid = constraint_record.conrelid
join pg_namespace namespace on namespace.oid = constraint_table.relnamespace
where constraint_record.contype = 'f'
  and namespace.nspname = 'public'
  and not exists (
    select 1
    from pg_index index_record
    where index_record.indrelid = constraint_record.conrelid
      and index_record.indisvalid
      and index_record.indkey::smallint[] @> constraint_record.conkey
  )
order by constraint_table.relname, constraint_record.conname;

-- Index usage for the affected modules. Interpret only after representative traffic.
select
  schemaname,
  relname as table_name,
  indexrelname as index_name,
  idx_scan,
  pg_size_pretty(pg_relation_size(indexrelid)) as index_size
from pg_stat_user_indexes
where schemaname = 'public'
  and relname in (
    'administrative_documents', 'document_categories', 'document_folders',
    'document_tags', 'members', 'member_sensitive_identity',
    'user_church_access', 'user_permission_overrides'
  )
order by relname, idx_scan desc;

-- Run Supabase Security and Performance Advisors in the Dashboard or MCP after
-- these checks. EXPLAIN (ANALYZE, BUFFERS) requires real tenant parameters and
-- must be executed only against a safe representative environment.
