-- Month/day is independent of birth year and preserves February 29.
alter table public.members
  add column birthday_mmdd smallint generated always as
    ((extract(month from birth_date)::int * 100 + extract(day from birth_date)::int)::smallint) stored;

create index members_active_birthday_calendar_idx
  on public.members (church_id, birthday_mmdd, full_name, id)
  where deleted_at is null and birthday_mmdd is not null
    and member_status = 'ACTIVE' and member_type in ('MEMBER', 'CHILD');
