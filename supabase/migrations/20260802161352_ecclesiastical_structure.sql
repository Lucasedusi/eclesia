-- Eclesias — Estrutura Eclesiástica (Regionais, Congregações e Cargos)
-- Evolui a modelagem existente sem recriar Regionais, Congregações ou Cargos.

begin;

create schema if not exists private;
revoke all on schema private from public, anon;
grant usage on schema private to authenticated;

-- ---------------------------------------------------------------------------
-- Colunas, catálogo de permissões e integridade básica
-- ---------------------------------------------------------------------------

alter table public.regions
  add column if not exists display_order integer not null default 0;

alter table public.congregations
  add column if not exists display_order integer not null default 0;

alter table public.roles
  add column if not exists female_name text,
  add column if not exists abbreviation text,
  add column if not exists female_abbreviation text,
  add column if not exists display_order integer not null default 0,
  add column if not exists created_by uuid references public.profiles(id) on delete set null,
  add column if not exists updated_by uuid references public.profiles(id) on delete set null;

-- Preserva a hierarquia legada de roles.level como ordem inicial do catálogo.
update public.roles
set display_order = greatest(coalesce(level, 0), 0)
where display_order = 0 and coalesce(level, 0) > 0;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'regions_display_order_check'
      and conrelid = 'public.regions'::regclass
  ) then
    alter table public.regions
      add constraint regions_display_order_check check (display_order >= 0);
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'regions_name_not_blank_check'
      and conrelid = 'public.regions'::regclass
  ) then
    alter table public.regions
      add constraint regions_name_not_blank_check check (btrim(name) <> '');
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'congregations_display_order_check'
      and conrelid = 'public.congregations'::regclass
  ) then
    alter table public.congregations
      add constraint congregations_display_order_check check (display_order >= 0);
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'congregations_name_not_blank_check'
      and conrelid = 'public.congregations'::regclass
  ) then
    alter table public.congregations
      add constraint congregations_name_not_blank_check check (btrim(name) <> '');
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'roles_display_order_check'
      and conrelid = 'public.roles'::regclass
  ) then
    alter table public.roles
      add constraint roles_display_order_check check (display_order >= 0);
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'roles_name_not_blank_check'
      and conrelid = 'public.roles'::regclass
  ) then
    alter table public.roles
      add constraint roles_name_not_blank_check check (btrim(name) <> '');
  end if;
end $$;

create unique index if not exists regions_church_name_active_unique_idx
  on public.regions (church_id, lower(btrim(name)))
  where deleted_at is null;

create unique index if not exists congregations_church_name_active_unique_idx
  on public.congregations (church_id, lower(btrim(name)))
  where deleted_at is null;

create unique index if not exists congregations_church_code_active_unique_idx
  on public.congregations (church_id, upper(btrim(code)))
  where code is not null and btrim(code) <> '' and deleted_at is null;

create unique index if not exists roles_church_name_trimmed_active_unique_idx
  on public.roles (church_id, lower(btrim(name)))
  where deleted_at is null;

create index if not exists regions_church_status_order_active_idx
  on public.regions (church_id, status, display_order, name, id)
  where deleted_at is null;

create index if not exists congregations_church_status_order_active_idx
  on public.congregations (church_id, status, display_order, name, id)
  where deleted_at is null;

create index if not exists congregations_church_region_active_idx
  on public.congregations (church_id, region_id)
  where deleted_at is null;

create index if not exists roles_church_status_order_active_idx
  on public.roles (church_id, status, display_order, name, id)
  where deleted_at is null;

insert into public.permissions (
  key, name, description, module, action, is_sensitive, status
) values (
  'positions.manage',
  'Gerenciar cargos eclesiásticos',
  'Criar e alterar o catálogo de cargos eclesiásticos',
  'organization',
  'manage',
  true,
  'ACTIVE'
)
on conflict do nothing;

update public.permissions
set status = 'ACTIVE', deleted_at = null, updated_at = now()
where key = 'positions.manage';

insert into public.role_permissions (role, permission_id, status)
select 'ADMIN', p.id, 'ACTIVE'
from public.permissions p
where p.key = 'positions.manage' and p.deleted_at is null
  and not exists (
    select 1
    from public.role_permissions rp
    where rp.role = 'ADMIN'
      and rp.permission_id = p.id
      and rp.deleted_at is null
  );

-- ---------------------------------------------------------------------------
-- Autorização por papel e escopo
-- ---------------------------------------------------------------------------

create or replace function private.is_church_admin(p_church_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.user_church_access access
    join public.profiles profile on profile.id = access.profile_id
    join public.churches church on church.id = access.church_id
    where access.profile_id = (select auth.uid())
      and access.church_id = p_church_id
      and access.role = 'ADMIN'
      and access.access_scope = 'CHURCH'
      and access.status = 'ACTIVE'
      and access.deleted_at is null
      and profile.status = 'ACTIVE'
      and profile.deleted_at is null
      and church.status = 'ACTIVE'
      and church.deleted_at is null
  );
$$;

revoke all on function private.is_church_admin(uuid) from public, anon;
grant execute on function private.is_church_admin(uuid) to authenticated;

-- organization.view autoriza o módulo, mas esta função mantém o recorte do escopo.
create or replace function public.can_access_region(
  p_church_id uuid,
  p_region_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.user_church_access access
    where access.profile_id = (select auth.uid())
      and access.church_id = p_church_id
      and access.status = 'ACTIVE'
      and access.deleted_at is null
      and (
        access.access_scope = 'CHURCH'
        or (access.access_scope = 'REGION' and access.region_id = p_region_id)
        or (
          access.access_scope = 'CONGREGATION'
          and exists (
            select 1
            from public.congregations congregation
            where congregation.id = access.congregation_id
              and congregation.church_id = p_church_id
              and congregation.region_id = p_region_id
              and congregation.deleted_at is null
          )
        )
      )
  );
$$;

-- Permissões administrativas não podem ser concedidas individualmente a papéis comuns.
create or replace function public.set_access_permission_override(
  p_access_id uuid,
  p_permission_key text,
  p_effect text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_church_id uuid;
  v_permission_id uuid;
  v_target_role text;
begin
  select church_id, role
  into v_church_id, v_target_role
  from public.user_church_access
  where id = p_access_id and deleted_at is null;

  if v_church_id is null
    or not public.has_permission(v_church_id, 'users.manage_permissions') then
    raise exception 'Acesso negado';
  end if;

  select id into v_permission_id
  from public.permissions
  where key = p_permission_key and status = 'ACTIVE' and deleted_at is null;

  if v_permission_id is null then
    raise exception 'Permissão inválida';
  end if;

  if upper(p_effect) = 'ALLOW'
    and p_permission_key in ('regions.manage', 'congregations.manage', 'positions.manage')
    and v_target_role <> 'ADMIN' then
    raise exception 'Esta permissão é exclusiva de Administradores';
  end if;

  if upper(p_effect) = 'ALLOW'
    and not public.has_permission(v_church_id, p_permission_key) then
    raise exception 'Não é permitido conceder uma permissão que você não possui';
  end if;

  if upper(p_effect) = 'INHERIT' then
    update public.user_permission_overrides
    set deleted_at = now(), updated_at = now()
    where access_id = p_access_id
      and permission_id = v_permission_id
      and deleted_at is null;
  elsif upper(p_effect) in ('ALLOW', 'DENY') then
    insert into public.user_permission_overrides (
      access_id, permission_id, effect, created_by
    ) values (
      p_access_id, v_permission_id, upper(p_effect), auth.uid()
    )
    on conflict (access_id, permission_id) where deleted_at is null
    do update set
      effect = excluded.effect,
      created_by = auth.uid(),
      updated_at = now();
  else
    raise exception 'Efeito inválido';
  end if;

  perform public.log_audit(
    v_church_id,
    'users',
    'PERMISSION_OVERRIDE_UPDATED',
    'user_church_access',
    p_access_id,
    p_permission_key,
    'Permissão personalizada alterada.',
    null,
    jsonb_build_object('permission', p_permission_key, 'effect', upper(p_effect)),
    null,
    'WARNING'
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- Regras de domínio e proteção de dependências
-- ---------------------------------------------------------------------------

create or replace function private.count_congregation_dependencies(
  p_congregation_id uuid
)
returns integer
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_table text;
  v_count integer;
  v_total integer := 0;
  v_tables text[] := array[
    'user_church_access',
    'church_invitations',
    'members',
    'member_history',
    'member_roles',
    'ministries',
    'member_ministries',
    'events',
    'event_congregation_quotas',
    'event_registrations',
    'financial_departments',
    'financial_cashboxes',
    'financial_transactions',
    'financial_receipts',
    'financial_documents',
    'accounts_payable',
    'report_delivery_rules',
    'report_deliveries',
    'report_delivery_items'
  ];
begin
  foreach v_table in array v_tables loop
    if exists (
      select 1
      from information_schema.columns
      where table_schema = 'public'
        and table_name = v_table
        and column_name = 'congregation_id'
    ) then
      execute format(
        'select count(*)::integer from public.%I where congregation_id = $1',
        v_table
      ) into v_count using p_congregation_id;
      v_total := v_total + coalesce(v_count, 0);
    end if;
  end loop;

  return v_total;
end;
$$;

revoke all on function private.count_congregation_dependencies(uuid)
  from public, anon, authenticated;

create or replace function private.protect_region_mutation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_linked integer;
  v_active integer;
begin
  new.name := btrim(new.name);
  new.description := nullif(btrim(new.description), '');
  new.coordinator_name := nullif(btrim(new.coordinator_name), '');
  new.coordinator_phone := nullif(btrim(new.coordinator_phone), '');

  if tg_op = 'UPDATE' and new.church_id <> old.church_id then
    raise exception 'Não é permitido alterar a igreja de uma Regional';
  end if;

  if tg_op = 'UPDATE' and new.deleted_at is distinct from old.deleted_at
    and new.deleted_at is not null then
    select count(*)::integer into v_linked
    from public.congregations congregation
    where congregation.region_id = old.id
      and congregation.deleted_at is null;

    if v_linked > 0 then
      raise exception 'A Regional possui % Congregação(ões) vinculada(s)', v_linked;
    end if;
  end if;

  if tg_op = 'UPDATE' and old.status = 'ACTIVE' and new.status = 'INACTIVE' then
    select count(*)::integer into v_active
    from public.congregations congregation
    where congregation.region_id = old.id
      and congregation.status = 'ACTIVE'
      and congregation.deleted_at is null;

    if v_active > 0 then
      raise exception 'A Regional possui % Congregação(ões) ativa(s)', v_active;
    end if;
  end if;

  return new;
end;
$$;

create or replace function private.protect_congregation_mutation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_dependencies integer;
begin
  new.name := btrim(new.name);
  new.code := nullif(upper(btrim(new.code)), '');
  new.pastor_name := nullif(btrim(new.pastor_name), '');
  new.pastor_spouse_name := nullif(btrim(new.pastor_spouse_name), '');
  new.phone := nullif(btrim(new.phone), '');
  new.whatsapp := nullif(btrim(new.whatsapp), '');
  new.email := nullif(lower(btrim(new.email)), '');
  new.zip_code := nullif(btrim(new.zip_code), '');
  new.address := nullif(btrim(new.address), '');
  new.number := nullif(btrim(new.number), '');
  new.complement := nullif(btrim(new.complement), '');
  new.district := nullif(btrim(new.district), '');
  new.city := nullif(btrim(new.city), '');
  new.state := nullif(upper(btrim(new.state)), '');
  new.country := coalesce(nullif(btrim(new.country), ''), 'Brasil');
  new.notes := nullif(btrim(new.notes), '');

  if tg_op = 'UPDATE' and new.church_id <> old.church_id then
    raise exception 'Não é permitido alterar a igreja de uma Congregação';
  end if;

  if tg_op = 'UPDATE' and new.is_headquarters is distinct from old.is_headquarters then
    raise exception 'Não é permitido alterar a identificação da Congregação Sede';
  end if;

  if new.is_headquarters then
    if new.status <> 'ACTIVE' or new.deleted_at is not null then
      raise exception 'A Congregação Sede não pode ser inativada ou excluída';
    end if;

    if tg_op = 'INSERT' and exists (
      select 1
      from public.congregations headquarters
      where headquarters.church_id = new.church_id
        and headquarters.is_headquarters = true
        and headquarters.deleted_at is null
    ) then
      raise exception 'A igreja já possui uma Congregação Sede';
    end if;
  elsif new.region_id is null then
    raise exception 'Selecione uma Regional para a Congregação';
  end if;

  if new.region_id is not null and not exists (
    select 1
    from public.regions region
    where region.id = new.region_id
      and region.church_id = new.church_id
      and region.status = 'ACTIVE'
      and region.deleted_at is null
  ) then
    raise exception 'A Regional deve estar ativa e pertencer à mesma igreja';
  end if;

  if tg_op = 'UPDATE' and new.deleted_at is distinct from old.deleted_at
    and new.deleted_at is not null then
    if old.is_headquarters then
      raise exception 'A Congregação Sede não pode ser excluída';
    end if;

    v_dependencies := private.count_congregation_dependencies(old.id);
    if v_dependencies > 0 then
      raise exception 'A Congregação possui % dependência(s) e deve ser apenas inativada', v_dependencies;
    end if;
  end if;

  return new;
end;
$$;

create or replace function private.protect_role_mutation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  new.name := btrim(new.name);
  new.female_name := nullif(btrim(new.female_name), '');
  new.abbreviation := nullif(btrim(new.abbreviation), '');
  new.female_abbreviation := nullif(btrim(new.female_abbreviation), '');
  new.description := nullif(btrim(new.description), '');
  new.level := new.display_order;

  if tg_op = 'INSERT' then
    new.created_by := coalesce(new.created_by, auth.uid());
  else
    if new.church_id <> old.church_id then
      raise exception 'Não é permitido alterar a igreja de um Cargo';
    end if;

    if new.deleted_at is distinct from old.deleted_at
      and new.deleted_at is not null
      and exists (
        select 1 from public.member_roles member_role
        where member_role.role_id = old.id
      ) then
      raise exception 'O Cargo possui vínculos com membros e deve ser apenas inativado';
    end if;
  end if;

  new.updated_by := auth.uid();
  return new;
end;
$$;

drop trigger if exists protect_regions_organization_mutation on public.regions;
create trigger protect_regions_organization_mutation
before insert or update on public.regions
for each row execute function private.protect_region_mutation();

drop trigger if exists protect_congregations_organization_mutation on public.congregations;
create trigger protect_congregations_organization_mutation
before insert or update on public.congregations
for each row execute function private.protect_congregation_mutation();

drop trigger if exists protect_roles_organization_mutation on public.roles;
create trigger protect_roles_organization_mutation
before insert or update on public.roles
for each row execute function private.protect_role_mutation();

revoke all on function private.protect_region_mutation()
  from public, anon, authenticated;
revoke all on function private.protect_congregation_mutation()
  from public, anon, authenticated;
revoke all on function private.protect_role_mutation()
  from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Auditoria automática das alterações administrativas
-- ---------------------------------------------------------------------------

create or replace function private.audit_region_mutation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_action text;
  v_description text;
begin
  if tg_op = 'INSERT' then
    v_action := 'REGION_CREATED';
    v_description := 'Regional cadastrada.';
  elsif new.deleted_at is distinct from old.deleted_at and new.deleted_at is not null then
    v_action := 'REGION_ARCHIVED';
    v_description := 'Regional excluída logicamente.';
  elsif new.status is distinct from old.status then
    v_action := 'REGION_STATUS_CHANGED';
    v_description := 'Situação da Regional alterada.';
  else
    v_action := 'REGION_UPDATED';
    v_description := 'Dados da Regional alterados.';
  end if;

  perform public.log_audit(
    new.church_id, 'organization', v_action, 'region', new.id, new.name,
    v_description,
    case when tg_op = 'UPDATE' then jsonb_build_object(
      'name', old.name,
      'coordinator_name', old.coordinator_name,
      'status', old.status,
      'display_order', old.display_order
    ) else null end,
    jsonb_build_object(
      'name', new.name,
      'coordinator_name', new.coordinator_name,
      'status', new.status,
      'display_order', new.display_order
    ),
    null,
    case when v_action in ('REGION_ARCHIVED', 'REGION_STATUS_CHANGED') then 'WARNING' else 'INFO' end
  );

  return new;
end;
$$;

create or replace function private.audit_congregation_mutation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_action text;
  v_description text;
begin
  if tg_op = 'INSERT' then
    v_action := 'CONGREGATION_CREATED';
    v_description := 'Congregação cadastrada.';
  elsif new.deleted_at is distinct from old.deleted_at and new.deleted_at is not null then
    v_action := 'CONGREGATION_ARCHIVED';
    v_description := 'Congregação excluída logicamente.';
  elsif new.region_id is distinct from old.region_id then
    v_action := 'CONGREGATION_REGION_CHANGED';
    v_description := 'Regional da Congregação alterada.';
  elsif new.status is distinct from old.status then
    v_action := 'CONGREGATION_STATUS_CHANGED';
    v_description := 'Situação da Congregação alterada.';
  else
    v_action := 'CONGREGATION_UPDATED';
    v_description := 'Dados da Congregação alterados.';
  end if;

  perform public.log_audit(
    new.church_id, 'organization', v_action, 'congregation', new.id, new.name,
    v_description,
    case when tg_op = 'UPDATE' then jsonb_build_object(
      'name', old.name,
      'code', old.code,
      'region_id', old.region_id,
      'status', old.status,
      'display_order', old.display_order
    ) else null end,
    jsonb_build_object(
      'name', new.name,
      'code', new.code,
      'region_id', new.region_id,
      'status', new.status,
      'display_order', new.display_order,
      'is_headquarters', new.is_headquarters
    ),
    null,
    case when v_action in ('CONGREGATION_ARCHIVED', 'CONGREGATION_REGION_CHANGED', 'CONGREGATION_STATUS_CHANGED') then 'WARNING' else 'INFO' end
  );

  return new;
end;
$$;

create or replace function private.audit_role_mutation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_action text;
  v_description text;
begin
  if tg_op = 'INSERT' then
    v_action := 'POSITION_CREATED';
    v_description := 'Cargo eclesiástico cadastrado.';
  elsif new.deleted_at is distinct from old.deleted_at and new.deleted_at is not null then
    v_action := 'POSITION_ARCHIVED';
    v_description := 'Cargo eclesiástico excluído logicamente.';
  elsif new.status is distinct from old.status then
    v_action := 'POSITION_STATUS_CHANGED';
    v_description := 'Situação do Cargo alterada.';
  elsif new.display_order is distinct from old.display_order then
    v_action := 'POSITION_ORDER_CHANGED';
    v_description := 'Ordem do Cargo alterada.';
  else
    v_action := 'POSITION_UPDATED';
    v_description := 'Dados do Cargo alterados.';
  end if;

  perform public.log_audit(
    new.church_id, 'organization', v_action, 'position', new.id, new.name,
    v_description,
    case when tg_op = 'UPDATE' then jsonb_build_object(
      'name', old.name,
      'female_name', old.female_name,
      'abbreviation', old.abbreviation,
      'female_abbreviation', old.female_abbreviation,
      'status', old.status,
      'display_order', old.display_order
    ) else null end,
    jsonb_build_object(
      'name', new.name,
      'female_name', new.female_name,
      'abbreviation', new.abbreviation,
      'female_abbreviation', new.female_abbreviation,
      'status', new.status,
      'display_order', new.display_order
    ),
    null,
    case when v_action in ('POSITION_ARCHIVED', 'POSITION_STATUS_CHANGED') then 'WARNING' else 'INFO' end
  );

  return new;
end;
$$;

drop trigger if exists audit_regions_organization_mutation on public.regions;
create trigger audit_regions_organization_mutation
after insert or update on public.regions
for each row execute function private.audit_region_mutation();

drop trigger if exists audit_congregations_organization_mutation on public.congregations;
create trigger audit_congregations_organization_mutation
after insert or update on public.congregations
for each row execute function private.audit_congregation_mutation();

drop trigger if exists audit_roles_organization_mutation on public.roles;
create trigger audit_roles_organization_mutation
after insert or update on public.roles
for each row execute function private.audit_role_mutation();

revoke all on function private.audit_region_mutation()
  from public, anon, authenticated;
revoke all on function private.audit_congregation_mutation()
  from public, anon, authenticated;
revoke all on function private.audit_role_mutation()
  from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- RLS e privilégios explícitos da Data API
-- ---------------------------------------------------------------------------

alter table public.regions enable row level security;
alter table public.congregations enable row level security;
alter table public.roles enable row level security;

drop policy if exists regions_select_scope on public.regions;
create policy regions_select_scope
on public.regions for select to authenticated
using (
  deleted_at is null
  and (select public.has_permission(church_id, 'organization.view'))
  and (select public.can_access_region(church_id, id))
);

drop policy if exists regions_manage on public.regions;
drop policy if exists regions_insert on public.regions;
create policy regions_insert
on public.regions for insert to authenticated
with check (
  deleted_at is null
  and (select public.has_permission(church_id, 'regions.manage'))
  and (select private.is_church_admin(church_id))
);

drop policy if exists regions_update on public.regions;
create policy regions_update
on public.regions for update to authenticated
using (
  deleted_at is null
  and (select public.has_permission(church_id, 'regions.manage'))
  and (select private.is_church_admin(church_id))
)
with check (
  (select public.has_permission(church_id, 'regions.manage'))
  and (select private.is_church_admin(church_id))
);

drop policy if exists congregations_select_scope on public.congregations;
create policy congregations_select_scope
on public.congregations for select to authenticated
using (
  deleted_at is null
  and (select public.has_permission(church_id, 'organization.view'))
  and (select public.can_access_congregation(church_id, id))
);

drop policy if exists congregations_manage on public.congregations;
drop policy if exists congregations_insert on public.congregations;
create policy congregations_insert
on public.congregations for insert to authenticated
with check (
  deleted_at is null
  and (select public.has_permission(church_id, 'congregations.manage'))
  and (select private.is_church_admin(church_id))
);

drop policy if exists congregations_update on public.congregations;
create policy congregations_update
on public.congregations for update to authenticated
using (
  deleted_at is null
  and (select public.has_permission(church_id, 'congregations.manage'))
  and (select private.is_church_admin(church_id))
)
with check (
  (select public.has_permission(church_id, 'congregations.manage'))
  and (select private.is_church_admin(church_id))
);

drop policy if exists roles_select_access on public.roles;
create policy roles_select_access
on public.roles for select to authenticated
using (
  deleted_at is null
  and (select public.has_permission(church_id, 'organization.view'))
  and (select public.can_access_church(church_id))
);

drop policy if exists roles_manage_access on public.roles;
drop policy if exists roles_insert_access on public.roles;
create policy roles_insert_access
on public.roles for insert to authenticated
with check (
  deleted_at is null
  and (select public.has_permission(church_id, 'positions.manage'))
  and (select private.is_church_admin(church_id))
);

drop policy if exists roles_update_access on public.roles;
create policy roles_update_access
on public.roles for update to authenticated
using (
  deleted_at is null
  and (select public.has_permission(church_id, 'positions.manage'))
  and (select private.is_church_admin(church_id))
)
with check (
  (select public.has_permission(church_id, 'positions.manage'))
  and (select private.is_church_admin(church_id))
);

revoke delete on public.regions, public.congregations, public.roles
  from authenticated;
grant select, insert, update on public.regions, public.congregations, public.roles
  to authenticated;

revoke all on function public.set_access_permission_override(uuid, text, text)
  from public, anon;
grant execute on function public.set_access_permission_override(uuid, text, text)
  to authenticated;

commit;
