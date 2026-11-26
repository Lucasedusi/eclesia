begin;

create table public.congregation_utility_accounts (
  church_id uuid not null,
  congregation_id uuid not null,
  energy_unit varchar(64),
  water_account varchar(64),
  primary key (church_id, congregation_id),
  foreign key (church_id, congregation_id) references public.congregations(church_id, id) on delete cascade
);

alter table public.congregation_utility_accounts enable row level security;
revoke all on public.congregation_utility_accounts from public, anon, authenticated;
grant select, insert, update (energy_unit, water_account) on public.congregation_utility_accounts to authenticated;

create policy utility_accounts_read on public.congregation_utility_accounts for select to authenticated
using (
  (select public.has_permission(church_id, 'organization.view'))
  and (select public.can_access_congregation(church_id, congregation_id))
  and exists (select 1 from public.congregations c
    where c.church_id = congregation_utility_accounts.church_id
      and c.id = congregation_utility_accounts.congregation_id and c.deleted_at is null)
);

create policy utility_accounts_insert on public.congregation_utility_accounts for insert to authenticated
with check ((select private.is_church_admin(church_id))
  and (select public.has_permission(church_id, 'organization.view'))
  and (select public.has_permission(church_id, 'congregations.manage'))
  and exists (select 1 from public.congregations c
    where c.church_id = congregation_utility_accounts.church_id
      and c.id = congregation_utility_accounts.congregation_id and c.deleted_at is null));

create policy utility_accounts_update on public.congregation_utility_accounts for update to authenticated
using ((select private.is_church_admin(church_id))
  and (select public.has_permission(church_id, 'organization.view'))
  and (select public.has_permission(church_id, 'congregations.manage'))
  and exists (select 1 from public.congregations c
    where c.church_id = congregation_utility_accounts.church_id
      and c.id = congregation_utility_accounts.congregation_id and c.deleted_at is null))
with check ((select private.is_church_admin(church_id))
  and (select public.has_permission(church_id, 'organization.view'))
  and (select public.has_permission(church_id, 'congregations.manage'))
  and exists (select 1 from public.congregations c
    where c.church_id = congregation_utility_accounts.church_id
      and c.id = congregation_utility_accounts.congregation_id and c.deleted_at is null));

-- Direct writes through the authenticated Data API follow the same audit trail.
create function private.audit_congregation_utility_accounts()
returns trigger language plpgsql security invoker set search_path = '' as $$
begin
  if tg_op = 'INSERT' and new.energy_unit is null and new.water_account is null then return new; end if;
  if tg_op = 'UPDATE' and (new.energy_unit, new.water_account) is not distinct from
      (old.energy_unit, old.water_account) then return new; end if;
  perform public.log_audit(
    p_church_id => new.church_id, p_module => 'organization', p_action => 'CONGREGATION_UTILITIES_UPDATED',
    p_entity_type => 'congregation', p_entity_id => new.congregation_id,
    p_description => 'Contas de consumo da Congregação atualizadas.'
  );
  return new;
end;
$$;
revoke all on function private.audit_congregation_utility_accounts() from public, anon, authenticated;
create trigger audit_congregation_utility_accounts after insert or update on public.congregation_utility_accounts
for each row execute function private.audit_congregation_utility_accounts();

-- Save the administrative form and its restricted identifiers in the same transaction.
create or replace function public.save_congregation_registration(
  p_church_id uuid, p_details jsonb, p_energy text, p_water text, p_id uuid default null
) returns uuid language plpgsql security invoker set search_path = '' as $$
declare
  details public.congregations := jsonb_populate_record(null::public.congregations, p_details);
  saved_id uuid;
begin
  if not private.is_church_admin(p_church_id)
    or not public.has_permission(p_church_id, 'organization.view')
    or not public.has_permission(p_church_id, 'congregations.manage') then
    raise insufficient_privilege;
  end if;
  if p_id is null then
    -- The scoped SELECT policy can see the congregation after the INSERT completes.
    saved_id := gen_random_uuid();
    insert into public.congregations (
      id, church_id, region_id, name, code, pastor_name, pastor_spouse_name, phone, whatsapp, email, zip_code,
      address, number, complement, district, city, state, country, notes, display_order, status
    ) values (
      saved_id, p_church_id, details.region_id, details.name, details.code, details.pastor_name, details.pastor_spouse_name, details.phone,
      details.whatsapp, details.email, details.zip_code, details.address, details.number, details.complement,
      details.district, details.city, details.state, details.country, details.notes, details.display_order, details.status
    );
  else
    update public.congregations set
      region_id = details.region_id,
      name = details.name,
      code = details.code,
      pastor_name = details.pastor_name,
      pastor_spouse_name = details.pastor_spouse_name,
      phone = details.phone,
      whatsapp = details.whatsapp,
      email = details.email,
      zip_code = details.zip_code,
      address = details.address,
      number = details.number,
      complement = details.complement,
      district = details.district,
      city = details.city,
      state = details.state,
      country = details.country,
      notes = details.notes,
      display_order = details.display_order,
      status = details.status
    where church_id = p_church_id and id = p_id and deleted_at is null
    returning id into saved_id;
    if saved_id is null then return null; end if;
  end if;

  insert into public.congregation_utility_accounts (church_id, congregation_id, energy_unit, water_account)
  values (p_church_id, saved_id, nullif(btrim(p_energy), ''), nullif(btrim(p_water), ''))
  on conflict (church_id, congregation_id) do update
    set energy_unit = excluded.energy_unit, water_account = excluded.water_account;
  return saved_id;
end;
$$;
revoke all on function public.save_congregation_registration(uuid,jsonb,text,text,uuid) from public, anon;
grant execute on function public.save_congregation_registration(uuid,jsonb,text,text,uuid) to authenticated;

notify pgrst, 'reload schema';
commit;
