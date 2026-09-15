create index if not exists event_registrations_member_event_history_idx
  on public.event_registrations (church_id, member_id, event_id)
  where member_id is not null
    and event_group_id is null
    and deleted_at is null;
