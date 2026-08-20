begin;

create table if not exists private.event_public_submission_limits (
  event_id uuid not null references public.events(id) on delete cascade,
  key_hash text not null,
  window_started_at timestamptz not null default now(),
  request_count integer not null default 0,
  blocked_until timestamptz,
  updated_at timestamptz not null default now(),
  primary key (event_id, key_hash),
  constraint event_public_submission_limits_count_check check (request_count >= 0)
);

create index if not exists event_public_submission_limits_cleanup_idx
on private.event_public_submission_limits(updated_at);

create or replace function public.consume_event_public_limit(
  p_event_id uuid,
  p_key_hash text,
  p_limit integer default 8,
  p_window_seconds integer default 600
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare v_limit private.event_public_submission_limits%rowtype;
begin
  if not (select private.is_service_request()) then raise exception 'SERVICE_ROLE_REQUIRED'; end if;
  if p_key_hash is null or length(p_key_hash) < 32 or p_limit < 1 or p_window_seconds < 60 then
    raise exception 'RATE_LIMIT_INPUT_INVALID';
  end if;
  insert into private.event_public_submission_limits(event_id, key_hash, request_count)
  values (p_event_id, p_key_hash, 0)
  on conflict (event_id, key_hash) do nothing;
  select * into v_limit from private.event_public_submission_limits
  where event_id = p_event_id and key_hash = p_key_hash for update;
  if v_limit.blocked_until is not null and v_limit.blocked_until > now() then return false; end if;
  if v_limit.window_started_at < now() - make_interval(secs => p_window_seconds) then
    update private.event_public_submission_limits set window_started_at = now(), request_count = 1,
      blocked_until = null, updated_at = now() where event_id = p_event_id and key_hash = p_key_hash;
    return true;
  end if;
  if v_limit.request_count >= p_limit then
    update private.event_public_submission_limits set blocked_until = now() + interval '15 minutes', updated_at = now()
    where event_id = p_event_id and key_hash = p_key_hash;
    return false;
  end if;
  update private.event_public_submission_limits set request_count = request_count + 1, updated_at = now()
  where event_id = p_event_id and key_hash = p_key_hash;
  return true;
end;
$$;

revoke all on function public.consume_event_public_limit(uuid, text, integer, integer) from public, anon, authenticated;
grant execute on function public.consume_event_public_limit(uuid, text, integer, integer) to service_role;
revoke all on table private.event_public_submission_limits from public, anon, authenticated;
grant all on table private.event_public_submission_limits to service_role;

commit;
