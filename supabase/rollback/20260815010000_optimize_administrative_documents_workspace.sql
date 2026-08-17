-- Execute only during an explicit rollback after confirming that no deployed
-- application version still calls these RPCs.
drop function if exists public.record_administrative_document_cleanup_attempt(uuid, boolean, text);
drop function if exists public.claim_stale_administrative_document_cleanups(timestamptz, integer);
drop table if exists private.administrative_document_cleanup_queue;
drop function if exists public.get_administrative_document_references(uuid);
drop function if exists public.get_administrative_document_workspace_stats(uuid);
