-- Read-only verification of generated dates, index and the existing RLS boundary.
do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'members'
      and column_name = 'birthday_mmdd' and is_generated = 'ALWAYS'
  ) or to_regclass('public.members_active_birthday_calendar_idx') is null then
    raise exception 'Missing member birthday calendar';
  end if;
  if exists (
    select 1 from public.members where birthday_mmdd is distinct from
      (extract(month from birth_date) * 100 + extract(day from birth_date))
  ) then
    raise exception 'Inconsistent birthday date';
  end if;
  if has_column_privilege('anon', 'public.members', 'birthday_mmdd', 'SELECT')
     or not has_column_privilege('authenticated', 'public.members', 'birthday_mmdd', 'SELECT')
     or not (select relrowsecurity from pg_class where oid = 'public.members'::regclass) then
    raise exception 'Unexpected birthday access grants or RLS';
  end if;
end $$;
