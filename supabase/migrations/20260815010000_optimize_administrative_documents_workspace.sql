-- Consolidates the read-only Documentos workspace queries and moves stale
-- Storage cleanup to a durable, retryable queue. Read RPCs remain SECURITY
-- INVOKER; cleanup RPCs are restricted to service_role.

create or replace function public.get_administrative_document_workspace_stats(
  p_church_id uuid
)
returns table (
  active_count bigint,
  archived_count bigint,
  deleted_count bigint,
  active_category_count bigint,
  active_folder_count bigint
)
language sql
stable
security invoker
set search_path = ''
as $$
  with authorized as (
    select
      (select private.is_church_admin(p_church_id))
      and (
        (select public.has_permission(p_church_id, 'documents.view'))
        or (select public.has_permission(p_church_id, 'documents.manage'))
      ) as allowed
  ), document_counts as (
    select
      count(*) filter (
        where document.deleted_at is null
          and document.status = 'ACTIVE'
          and folder.status = 'ACTIVE'
          and category.status = 'ACTIVE'
      ) as active_count,
      count(*) filter (
        where document.deleted_at is null
          and (
            document.status = 'ARCHIVED'
            or folder.status = 'ARCHIVED'
            or category.status = 'ARCHIVED'
          )
      ) as archived_count,
      count(*) filter (where document.deleted_at is not null) as deleted_count
    from public.administrative_documents document
    join public.document_folders folder
      on folder.id = document.folder_id
     and folder.church_id = document.church_id
     and folder.deleted_at is null
    join public.document_categories category
      on category.id = folder.category_id
     and category.church_id = folder.church_id
     and category.deleted_at is null
    where document.church_id = p_church_id
      and document.upload_status = 'ACTIVE'
      and (select allowed from authorized)
  )
  select
    document_counts.active_count,
    document_counts.archived_count,
    document_counts.deleted_count,
    (
      select count(*)
      from public.document_categories category
      where category.church_id = p_church_id
        and category.status = 'ACTIVE'
        and category.deleted_at is null
        and (select allowed from authorized)
    ) as active_category_count,
    (
      select count(*)
      from public.document_folders folder
      where folder.church_id = p_church_id
        and folder.status = 'ACTIVE'
        and folder.deleted_at is null
        and (select allowed from authorized)
    ) as active_folder_count
  from document_counts;
$$;

create or replace function public.get_administrative_document_references(
  p_church_id uuid
)
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  with authorized as (
    select
      (select private.is_church_admin(p_church_id))
      and (
        (select public.has_permission(p_church_id, 'documents.view'))
        or (select public.has_permission(p_church_id, 'documents.manage'))
      ) as allowed
  )
  select jsonb_build_object(
    'categories', coalesce((
      select jsonb_agg(to_jsonb(category) order by category.name)
      from (
        select id, name, description, color, icon, status, archived_at,
          deleted_at, created_at, updated_at
        from public.document_categories
        where church_id = p_church_id
          and (select allowed from authorized)
      ) category
    ), '[]'::jsonb),
    'folders', coalesce((
      select jsonb_agg(to_jsonb(folder) order by folder.name)
      from (
        select id, category_id, name, description, physical_location, status,
          archived_at, deleted_at, created_at, updated_at
        from public.document_folders
        where church_id = p_church_id
          and (select allowed from authorized)
      ) folder
    ), '[]'::jsonb),
    'tags', coalesce((
      select jsonb_agg(to_jsonb(tag) order by tag.name)
      from (
        select id, name
        from public.document_tags
        where church_id = p_church_id
          and deleted_at is null
          and (select allowed from authorized)
      ) tag
    ), '[]'::jsonb),
    'uploaders', coalesce((
      select jsonb_agg(
        jsonb_build_object('id', uploader.profile_id, 'name', uploader.name)
        order by uploader.name
      )
      from (
        select distinct on (access.profile_id)
          access.profile_id,
          coalesce(profile.display_name, profile.full_name, profile.email, 'Usuário') as name
        from public.user_church_access access
        join public.profiles profile on profile.id = access.profile_id
        where access.church_id = p_church_id
          and access.status = 'ACTIVE'
          and access.deleted_at is null
          and (select allowed from authorized)
        order by access.profile_id, access.accepted_at desc nulls last
      ) uploader
    ), '[]'::jsonb)
  );
$$;

create table if not exists private.administrative_document_cleanup_queue (
  id uuid primary key default gen_random_uuid(),
  document_id uuid,
  cleanup_kind text not null,
  storage_bucket text not null,
  storage_path text not null,
  status text not null default 'PENDING',
  attempts integer not null default 0,
  last_error_code text,
  locked_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint administrative_document_cleanup_kind_check
    check (cleanup_kind in ('UPLOAD', 'REPLACEMENT')),
  constraint administrative_document_cleanup_status_check
    check (status in ('PENDING', 'PROCESSING', 'COMPLETED')),
  constraint administrative_document_cleanup_attempts_check check (attempts >= 0),
  constraint administrative_document_cleanup_bucket_check
    check (storage_bucket = 'administrative-documents'),
  constraint administrative_document_cleanup_path_not_blank_check
    check (btrim(storage_path) <> ''),
  constraint administrative_document_cleanup_state_pair_check check (
    (status = 'PENDING' and completed_at is null and locked_at is null)
    or (status = 'PROCESSING' and completed_at is null and locked_at is not null)
    or (status = 'COMPLETED' and completed_at is not null and locked_at is null)
  ),
  constraint administrative_document_cleanup_unique unique (cleanup_kind, storage_path)
);

create index if not exists administrative_document_cleanup_pending_idx
  on private.administrative_document_cleanup_queue (status, created_at, id)
  where status in ('PENDING', 'PROCESSING');

create or replace function public.claim_stale_administrative_document_cleanups(
  p_cutoff timestamptz,
  p_limit integer default 250
)
returns table (
  queue_id uuid,
  storage_bucket text,
  storage_path text
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_document record;
  v_limit integer := least(greatest(coalesce(p_limit, 250), 1), 500);
  v_previous_subject text := current_setting('request.jwt.claim.sub', true);
begin
  if p_cutoff is null or p_cutoff >= now() then
    raise exception 'INVALID_CLEANUP_CUTOFF' using errcode = '22023';
  end if;

  -- Release abandoned leases. Repeating a Storage remove is safe and lets a
  -- later invocation finish an attempt whose HTTP process was interrupted.
  update private.administrative_document_cleanup_queue
  set status = 'PENDING', locked_at = null, updated_at = now()
  where status = 'PROCESSING'
    and locked_at < now() - interval '15 minutes';

  -- Persist the path before removing its metadata reference. The existing
  -- mutation trigger still runs with the original uploader as audit actor.
  for v_document in
    select document.id, document.uploaded_by as actor_id,
      document.storage_bucket, document.storage_path
    from public.administrative_documents document
    where document.upload_status = 'PENDING'
      and document.deleted_at is null
      and document.uploaded_at < p_cutoff
    order by document.uploaded_at, document.id
    limit v_limit
    for update skip locked
  loop
    insert into private.administrative_document_cleanup_queue (
      document_id, cleanup_kind, storage_bucket, storage_path
    ) values (
      v_document.id, 'UPLOAD', v_document.storage_bucket, v_document.storage_path
    ) on conflict (cleanup_kind, storage_path) do nothing;

    perform pg_catalog.set_config(
      'request.jwt.claim.sub', v_document.actor_id::text, true
    );
    update public.administrative_documents
    set deleted_at = now(), deleted_by = v_document.actor_id,
      updated_by = v_document.actor_id
    where id = v_document.id
      and upload_status = 'PENDING'
      and deleted_at is null
      and uploaded_at < p_cutoff;
  end loop;

  for v_document in
    select document.id,
      coalesce(document.pending_by, document.uploaded_by) as actor_id,
      document.storage_bucket,
      document.pending_storage_path as storage_path
    from public.administrative_documents document
    where document.upload_status = 'ACTIVE'
      and document.pending_storage_path is not null
      and document.pending_started_at < p_cutoff
    order by document.pending_started_at, document.id
    limit v_limit
    for update skip locked
  loop
    insert into private.administrative_document_cleanup_queue (
      document_id, cleanup_kind, storage_bucket, storage_path
    ) values (
      v_document.id, 'REPLACEMENT', v_document.storage_bucket, v_document.storage_path
    ) on conflict (cleanup_kind, storage_path) do nothing;

    perform pg_catalog.set_config(
      'request.jwt.claim.sub', v_document.actor_id::text, true
    );
    update public.administrative_documents
    set pending_storage_path = null,
      pending_original_file_name = null,
      pending_mime_type = null,
      pending_file_extension = null,
      pending_file_size = null,
      pending_started_at = null,
      pending_by = null,
      updated_by = v_document.actor_id
    where id = v_document.id
      and upload_status = 'ACTIVE'
      and pending_storage_path = v_document.storage_path
      and pending_started_at < p_cutoff;
  end loop;

  perform pg_catalog.set_config(
    'request.jwt.claim.sub', coalesce(v_previous_subject, ''), true
  );

  return query
  with candidates as (
    select queue.id
    from private.administrative_document_cleanup_queue queue
    where queue.status = 'PENDING'
    order by queue.created_at, queue.id
    limit v_limit
    for update skip locked
  ), claimed as (
    update private.administrative_document_cleanup_queue queue
    set status = 'PROCESSING', locked_at = now(), updated_at = now()
    from candidates
    where queue.id = candidates.id
    returning queue.id, queue.storage_bucket, queue.storage_path
  )
  select claimed.id, claimed.storage_bucket, claimed.storage_path
  from claimed;
end;
$$;

create or replace function public.record_administrative_document_cleanup_attempt(
  p_queue_id uuid,
  p_succeeded boolean,
  p_error_code text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_queue_id is null or p_succeeded is null then
    raise exception 'INVALID_CLEANUP_RESULT' using errcode = '22023';
  end if;

  update private.administrative_document_cleanup_queue
  set status = case when p_succeeded then 'COMPLETED' else 'PENDING' end,
    attempts = attempts + 1,
    last_error_code = case
      when p_succeeded then null
      else left(coalesce(nullif(btrim(p_error_code), ''), 'STORAGE_REMOVE_FAILED'), 80)
    end,
    locked_at = null,
    completed_at = case when p_succeeded then now() else null end,
    updated_at = now()
  where id = p_queue_id
    and status = 'PROCESSING';

  if not found then
    raise exception 'CLEANUP_QUEUE_ITEM_NOT_CLAIMED' using errcode = 'P0002';
  end if;
end;
$$;

revoke all on function public.get_administrative_document_workspace_stats(uuid) from public;
revoke all on function public.get_administrative_document_workspace_stats(uuid) from anon;
grant execute on function public.get_administrative_document_workspace_stats(uuid) to authenticated;

revoke all on function public.get_administrative_document_references(uuid) from public;
revoke all on function public.get_administrative_document_references(uuid) from anon;
grant execute on function public.get_administrative_document_references(uuid) to authenticated;

revoke all on table private.administrative_document_cleanup_queue
  from public, anon, authenticated;

revoke all on function public.claim_stale_administrative_document_cleanups(timestamptz, integer)
  from public, anon, authenticated;
grant execute on function public.claim_stale_administrative_document_cleanups(timestamptz, integer)
  to service_role;

revoke all on function public.record_administrative_document_cleanup_attempt(uuid, boolean, text)
  from public, anon, authenticated;
grant execute on function public.record_administrative_document_cleanup_attempt(uuid, boolean, text)
  to service_role;

comment on function public.get_administrative_document_workspace_stats(uuid) is
  'Returns Documentos counters in one RLS-protected SECURITY INVOKER call.';
comment on function public.get_administrative_document_references(uuid) is
  'Returns Documentos categories, folders, tags and active uploaders in one RLS-protected SECURITY INVOKER call.';
comment on table private.administrative_document_cleanup_queue is
  'Durable queue for retrying stale administrative document Storage cleanup without retaining PII.';
comment on function public.claim_stale_administrative_document_cleanups(timestamptz, integer) is
  'Transitions stale metadata atomically, leases durable cleanup items and is executable only by service_role.';
comment on function public.record_administrative_document_cleanup_attempt(uuid, boolean, text) is
  'Completes or releases a leased cleanup item for retry; executable only by service_role.';
