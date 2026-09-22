begin;

do $$
begin
  if (
    select count(*)
    from public.permissions
    where key = 'members.credentials.issue'
      and status = 'ACTIVE'
      and deleted_at is null
  ) <> 1 then
    raise exception 'credential permission missing or duplicated';
  end if;

  if (
    select count(*)
    from public.role_permissions role_permission
    join public.permissions permission on permission.id = role_permission.permission_id
    where permission.key = 'members.credentials.issue'
      and role_permission.role in ('ADMIN', 'SECRETARY')
      and role_permission.status = 'ACTIVE'
      and role_permission.deleted_at is null
  ) <> 2 then
    raise exception 'credential default grants missing';
  end if;
end;
$$;

rollback;
