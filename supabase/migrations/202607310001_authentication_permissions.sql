-- Eclesias — autenticação, onboarding, permissões, convites e isolamento multi-tenant
-- Pré-requisito: modelagem base do projeto já aplicada (churches, congregations,
-- profiles, user_church_access, permissions, role_permissions, members e tabelas auxiliares).

begin;

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- Estruturas adicionais e correções de integridade
-- ---------------------------------------------------------------------------

alter table public.congregations
  add column if not exists is_headquarters boolean not null default false;

create unique index if not exists congregations_one_active_headquarters_idx
  on public.congregations (church_id)
  where is_headquarters = true and status = 'ACTIVE' and deleted_at is null;

create unique index if not exists churches_document_active_unique_idx
  on public.churches (lower(regexp_replace(document, '[^0-9A-Za-z]', '', 'g')))
  where document is not null and document <> '' and deleted_at is null;

drop index if exists public.members_cpf_unique_idx;
drop index if exists public.members_church_cpf_unique_idx;

create table if not exists public.church_invitations (
  id uuid primary key default gen_random_uuid(),
  church_id uuid not null references public.churches(id) on delete restrict,
  invited_name text not null,
  email text not null,
  email_normalized text not null,
  token_hash text not null,
  role text not null check (role in ('ADMIN','SECRETARY','TREASURER','LEADER','MINISTRY_LEADER','VIEWER')),
  access_scope text not null check (access_scope in ('CHURCH','REGION','CONGREGATION','MINISTRY')),
  region_id uuid references public.regions(id) on delete set null,
  congregation_id uuid references public.congregations(id) on delete set null,
  ministry_id uuid references public.ministries(id) on delete set null,
  permission_overrides jsonb not null default '[]'::jsonb,
  status text not null default 'PENDING' check (status in ('PENDING','ACCEPTED','EXPIRED','CANCELLED')),
  invited_by uuid not null references public.profiles(id) on delete restrict,
  invited_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '7 days'),
  accepted_at timestamptz,
  accepted_by uuid references public.profiles(id) on delete set null,
  access_id uuid references public.user_church_access(id) on delete set null,
  cancelled_at timestamptz,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint church_invitations_scope_target_check check (
    (access_scope = 'CHURCH' and region_id is null and congregation_id is null and ministry_id is null) or
    (access_scope = 'REGION' and region_id is not null and congregation_id is null and ministry_id is null) or
    (access_scope = 'CONGREGATION' and region_id is null and congregation_id is not null and ministry_id is null) or
    (access_scope = 'MINISTRY' and region_id is null and congregation_id is null and ministry_id is not null)
  ),
  constraint church_invitations_role_scope_check check (
    (role = 'ADMIN' and access_scope = 'CHURCH') or
    (role = 'MINISTRY_LEADER' and access_scope = 'MINISTRY') or
    role not in ('ADMIN','MINISTRY_LEADER')
  )
);

create unique index if not exists church_invitations_token_hash_idx
  on public.church_invitations(token_hash) where deleted_at is null;
create index if not exists church_invitations_church_status_idx
  on public.church_invitations(church_id, status);
create index if not exists church_invitations_email_status_idx
  on public.church_invitations(email_normalized, status);
create unique index if not exists church_invitations_pending_target_idx
  on public.church_invitations (
    church_id,
    email_normalized,
    access_scope,
    coalesce(region_id, '00000000-0000-0000-0000-000000000000'::uuid),
    coalesce(congregation_id, '00000000-0000-0000-0000-000000000000'::uuid),
    coalesce(ministry_id, '00000000-0000-0000-0000-000000000000'::uuid)
  ) where status = 'PENDING' and deleted_at is null;

create table if not exists public.user_permission_overrides (
  id uuid primary key default gen_random_uuid(),
  access_id uuid not null references public.user_church_access(id) on delete cascade,
  permission_id uuid not null references public.permissions(id) on delete cascade,
  effect text not null check (effect in ('ALLOW','DENY')),
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create unique index if not exists user_permission_overrides_active_unique_idx
  on public.user_permission_overrides(access_id, permission_id)
  where deleted_at is null;
create index if not exists user_permission_overrides_access_idx
  on public.user_permission_overrides(access_id) where deleted_at is null;

create table if not exists public.member_sensitive_identity (
  member_id uuid primary key references public.members(id) on delete cascade,
  church_id uuid not null references public.churches(id) on delete restrict,
  cpf text,
  rg text,
  issuing_agency text,
  created_by uuid references public.profiles(id) on delete set null,
  updated_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create unique index if not exists member_sensitive_identity_church_cpf_idx
  on public.member_sensitive_identity(church_id, cpf)
  where cpf is not null and cpf <> '' and deleted_at is null;

create table if not exists public.member_pastoral_notes (
  member_id uuid primary key references public.members(id) on delete cascade,
  church_id uuid not null references public.churches(id) on delete restrict,
  notes text not null,
  created_by uuid references public.profiles(id) on delete set null,
  updated_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

-- Migração segura dos dados sensíveis existentes. As colunas legadas permanecem
-- por compatibilidade, mas deixam de ser usadas pela aplicação.
insert into public.member_sensitive_identity (member_id, church_id, cpf, rg, issuing_agency)
select id, church_id, cpf, rg, issuing_agency
from public.members
where coalesce(cpf, rg, issuing_agency) is not null
on conflict (member_id) do nothing;

insert into public.member_pastoral_notes (member_id, church_id, notes)
select id, church_id, pastoral_notes
from public.members
where pastoral_notes is not null and btrim(pastoral_notes) <> ''
on conflict (member_id) do nothing;

-- Evita que as cópias legadas permaneçam expostas pela tabela principal.
-- A partir desta migração, esses dados existem somente nas tabelas protegidas.
update public.members
set cpf = null, rg = null, issuing_agency = null, pastoral_notes = null
where cpf is not null or rg is not null or issuing_agency is not null or pastoral_notes is not null;

-- ---------------------------------------------------------------------------
-- Catálogo e matriz padrão de permissões
-- ---------------------------------------------------------------------------

insert into public.permissions (key, name, description, module, action, is_sensitive, status)
values
  ('dashboard.view','Visualizar dashboard','Acessar o painel inicial','dashboard','view',false,'ACTIVE'),
  ('church.view','Visualizar igreja','Consultar dados institucionais','church','view',false,'ACTIVE'),
  ('church.update','Alterar igreja','Editar dados institucionais','church','update',true,'ACTIVE'),
  ('organization.view','Visualizar organização','Consultar regionais e congregações','organization','view',false,'ACTIVE'),
  ('regions.manage','Gerenciar regionais','Criar e alterar regionais','organization','manage',true,'ACTIVE'),
  ('congregations.manage','Gerenciar congregações','Criar e alterar congregações','organization','manage',true,'ACTIVE'),
  ('settings.view','Visualizar configurações','Consultar configurações da igreja','settings','view',false,'ACTIVE'),
  ('settings.update','Alterar configurações','Editar configurações da igreja','settings','update',true,'ACTIVE'),
  ('users.view','Visualizar usuários','Consultar usuários e acessos','users','view',true,'ACTIVE'),
  ('users.invite','Convidar usuários','Criar, reenviar e cancelar convites','users','invite',true,'ACTIVE'),
  ('users.update_access','Alterar acessos','Editar papel, escopo e situação','users','update_access',true,'ACTIVE'),
  ('users.suspend_access','Suspender acessos','Suspender, bloquear e reativar acessos','users','suspend_access',true,'ACTIVE'),
  ('users.manage_permissions','Personalizar permissões','Definir exceções por acesso','users','manage_permissions',true,'ACTIVE'),
  ('audit.view','Visualizar auditoria','Consultar registros de auditoria','audit','view',true,'ACTIVE'),
  ('members.view_basic','Ver membros — básico','Consultar identificação pública do membro','members','view_basic',false,'ACTIVE'),
  ('members.view_full','Ver membros — completo','Consultar dados operacionais do membro','members','view_full',true,'ACTIVE'),
  ('members.create','Cadastrar membros','Criar cadastro de membro','members','create',true,'ACTIVE'),
  ('members.update','Editar membros','Alterar cadastro de membro','members','update',true,'ACTIVE'),
  ('members.change_status','Alterar situação de membros','Modificar situação cadastral','members','change_status',true,'ACTIVE'),
  ('members.transfer','Transferir membros','Mover membro entre congregações','members','transfer',true,'ACTIVE'),
  ('members.archive','Arquivar membros','Realizar exclusão lógica de membro','members','archive',true,'ACTIVE'),
  ('members.export','Exportar membros','Gerar exportações da base de membros','members','export',true,'ACTIVE'),
  ('members.view_sensitive_identity','Ver identidade sensível','Consultar CPF, RG e órgão emissor','members','view_sensitive_identity',true,'ACTIVE'),
  ('members.manage_sensitive_identity','Editar identidade sensível','Alterar CPF, RG e órgão emissor','members','manage_sensitive_identity',true,'ACTIVE'),
  ('members.manage_documents','Gerenciar documentos','Enviar e organizar documentos de membros','members','manage_documents',true,'ACTIVE'),
  ('members.view_sensitive_documents','Ver documentos sensíveis','Consultar documentos sensíveis','members','view_sensitive_documents',true,'ACTIVE'),
  ('members.view_pastoral_notes','Ver observações pastorais','Consultar conteúdo pastoral confidencial','members','view_pastoral_notes',true,'ACTIVE'),
  ('members.edit_pastoral_notes','Editar observações pastorais','Alterar conteúdo pastoral confidencial','members','edit_pastoral_notes',true,'ACTIVE'),
  ('member_roles.view','Ver cargos de membros','Consultar vínculos com cargos','members','view',false,'ACTIVE'),
  ('member_roles.manage','Gerenciar cargos de membros','Alterar vínculos com cargos','members','manage',true,'ACTIVE'),
  ('ministries.view','Ver ministérios','Consultar ministérios e vínculos','ministries','view',false,'ACTIVE'),
  ('ministries.manage','Gerenciar ministérios','Criar e alterar ministérios e vínculos','ministries','manage',true,'ACTIVE')
on conflict do nothing;

-- Atualiza registros já existentes sem depender do nome do índice parcial.
update public.permissions set status = 'ACTIVE', deleted_at = null
where key in (
  'dashboard.view','church.view','church.update','organization.view','regions.manage',
  'congregations.manage','settings.view','settings.update','users.view','users.invite',
  'users.update_access','users.suspend_access','users.manage_permissions','audit.view',
  'members.view_basic','members.view_full','members.create','members.update',
  'members.change_status','members.transfer','members.archive','members.export',
  'members.view_sensitive_identity','members.manage_sensitive_identity',
  'members.manage_documents','members.view_sensitive_documents',
  'members.view_pastoral_notes','members.edit_pastoral_notes','member_roles.view',
  'member_roles.manage','ministries.view','ministries.manage'
);

with role_keys(role, permission_key) as (
  values
    ('SECRETARY','dashboard.view'),('SECRETARY','church.view'),('SECRETARY','organization.view'),
    ('SECRETARY','members.view_basic'),('SECRETARY','members.view_full'),('SECRETARY','members.create'),
    ('SECRETARY','members.update'),('SECRETARY','members.change_status'),('SECRETARY','members.transfer'),
    ('SECRETARY','members.export'),('SECRETARY','members.view_sensitive_identity'),
    ('SECRETARY','members.manage_sensitive_identity'),('SECRETARY','members.manage_documents'),
    ('SECRETARY','member_roles.view'),('SECRETARY','ministries.view'),
    ('TREASURER','dashboard.view'),('TREASURER','church.view'),('TREASURER','organization.view'),
    ('TREASURER','members.view_basic'),
    ('LEADER','dashboard.view'),('LEADER','church.view'),('LEADER','organization.view'),
    ('LEADER','members.view_basic'),('LEADER','member_roles.view'),('LEADER','ministries.view'),
    ('MINISTRY_LEADER','dashboard.view'),('MINISTRY_LEADER','church.view'),
    ('MINISTRY_LEADER','members.view_basic'),('MINISTRY_LEADER','ministries.view'),
    ('VIEWER','dashboard.view'),('VIEWER','church.view'),('VIEWER','organization.view'),
    ('VIEWER','members.view_basic'),('VIEWER','member_roles.view'),('VIEWER','ministries.view')
), all_role_keys as (
  select 'ADMIN'::text as role, p.key as permission_key
  from public.permissions p where p.status = 'ACTIVE' and p.deleted_at is null
  union all
  select role, permission_key from role_keys
)
insert into public.role_permissions(role, permission_id, status)
select ark.role, p.id, 'ACTIVE'
from all_role_keys ark
join public.permissions p on p.key = ark.permission_key and p.deleted_at is null
where not exists (
  select 1 from public.role_permissions rp
  where rp.role = ark.role and rp.permission_id = p.id and rp.deleted_at is null
);

-- ---------------------------------------------------------------------------
-- Triggers utilitários
-- ---------------------------------------------------------------------------

create or replace function public.touch_updated_at()
returns trigger language plpgsql set search_path = public as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function public.clear_legacy_member_sensitive_columns()
returns trigger language plpgsql set search_path = public as $$
begin
  new.cpf := null;
  new.rg := null;
  new.issuing_agency := null;
  new.pastoral_notes := null;
  return new;
end;
$$;

drop trigger if exists clear_members_legacy_sensitive_columns on public.members;
create trigger clear_members_legacy_sensitive_columns
before insert or update of cpf, rg, issuing_agency, pastoral_notes on public.members
for each row execute function public.clear_legacy_member_sensitive_columns();

drop trigger if exists touch_church_invitations_updated_at on public.church_invitations;
create trigger touch_church_invitations_updated_at before update on public.church_invitations
for each row execute function public.touch_updated_at();
drop trigger if exists touch_user_permission_overrides_updated_at on public.user_permission_overrides;
create trigger touch_user_permission_overrides_updated_at before update on public.user_permission_overrides
for each row execute function public.touch_updated_at();
drop trigger if exists touch_member_sensitive_identity_updated_at on public.member_sensitive_identity;
create trigger touch_member_sensitive_identity_updated_at before update on public.member_sensitive_identity
for each row execute function public.touch_updated_at();
drop trigger if exists touch_member_pastoral_notes_updated_at on public.member_pastoral_notes;
create trigger touch_member_pastoral_notes_updated_at before update on public.member_pastoral_notes
for each row execute function public.touch_updated_at();

create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  insert into public.profiles (
    id, full_name, display_name, email, status, accepted_terms_at
  ) values (
    new.id,
    nullif(btrim(new.raw_user_meta_data ->> 'full_name'), ''),
    nullif(split_part(btrim(new.raw_user_meta_data ->> 'full_name'), ' ', 1), ''),
    lower(new.email),
    case when new.email_confirmed_at is null then 'PENDING' else 'ACTIVE' end,
    case when lower(coalesce(new.raw_user_meta_data ->> 'accepted_terms', 'false')) = 'true' then now() else null end
  )
  on conflict (id) do update set
    full_name = coalesce(excluded.full_name, profiles.full_name),
    display_name = coalesce(excluded.display_name, profiles.display_name),
    email = excluded.email,
    updated_at = now();
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users for each row execute function public.handle_new_auth_user();

create or replace function public.validate_access_target_tenant()
returns trigger language plpgsql set search_path = public as $$
begin
  if new.role = 'ADMIN' and new.access_scope <> 'CHURCH' then
    raise exception 'Administrador deve possuir escopo CHURCH';
  end if;
  if new.role = 'MINISTRY_LEADER' and new.access_scope <> 'MINISTRY' then
    raise exception 'Líder de Ministério deve possuir escopo MINISTRY';
  end if;
  if new.region_id is not null and not exists (
    select 1 from public.regions r where r.id = new.region_id and r.church_id = new.church_id and r.deleted_at is null
  ) then raise exception 'Regional não pertence à igreja'; end if;
  if new.congregation_id is not null and not exists (
    select 1 from public.congregations c where c.id = new.congregation_id and c.church_id = new.church_id and c.deleted_at is null
  ) then raise exception 'Congregação não pertence à igreja'; end if;
  if new.ministry_id is not null and not exists (
    select 1 from public.ministries m where m.id = new.ministry_id and m.church_id = new.church_id and m.deleted_at is null
  ) then raise exception 'Ministério não pertence à igreja'; end if;
  return new;
end;
$$;

drop trigger if exists validate_user_church_access_target on public.user_church_access;
create trigger validate_user_church_access_target before insert or update on public.user_church_access
for each row execute function public.validate_access_target_tenant();
drop trigger if exists validate_church_invitation_target on public.church_invitations;
create trigger validate_church_invitation_target before insert or update on public.church_invitations
for each row execute function public.validate_access_target_tenant();

create or replace function public.validate_member_tenant()
returns trigger language plpgsql set search_path = public as $$
begin
  if not exists (
    select 1 from public.congregations c
    where c.id = new.congregation_id and c.church_id = new.church_id and c.deleted_at is null
  ) then raise exception 'Congregação do membro não pertence à igreja'; end if;
  if tg_op = 'UPDATE' and new.church_id <> old.church_id then
    raise exception 'Não é permitido alterar a igreja de um membro';
  end if;
  return new;
end;
$$;

drop trigger if exists validate_members_tenant on public.members;
create trigger validate_members_tenant before insert or update on public.members
for each row execute function public.validate_member_tenant();

create or replace function public.validate_congregation_tenant()
returns trigger language plpgsql set search_path = public as $$
begin
  if new.region_id is not null and not exists (
    select 1 from public.regions r where r.id = new.region_id and r.church_id = new.church_id and r.deleted_at is null
  ) then raise exception 'Regional não pertence à igreja da congregação'; end if;
  return new;
end;
$$;

drop trigger if exists validate_congregations_tenant on public.congregations;
create trigger validate_congregations_tenant before insert or update on public.congregations
for each row execute function public.validate_congregation_tenant();

create or replace function public.protect_last_church_admin()
returns trigger language plpgsql set search_path = public as $$
declare
  removes_admin boolean;
  remaining_admins integer;
begin
  removes_admin := old.role = 'ADMIN' and old.access_scope = 'CHURCH'
    and old.status = 'ACTIVE' and old.deleted_at is null
    and (new.role <> 'ADMIN' or new.access_scope <> 'CHURCH' or new.status <> 'ACTIVE' or new.deleted_at is not null);
  if removes_admin then
    select count(*) into remaining_admins
    from public.user_church_access a
    where a.church_id = old.church_id and a.id <> old.id
      and a.role = 'ADMIN' and a.access_scope = 'CHURCH'
      and a.status = 'ACTIVE' and a.deleted_at is null;
    if remaining_admins = 0 then raise exception 'A igreja deve manter ao menos um Administrador ativo'; end if;
  end if;
  return new;
end;
$$;

drop trigger if exists protect_last_admin_access on public.user_church_access;
create trigger protect_last_admin_access before update on public.user_church_access
for each row execute function public.protect_last_church_admin();

-- ---------------------------------------------------------------------------
-- Funções de autorização e operações atômicas
-- ---------------------------------------------------------------------------

create or replace function public.get_my_permissions(p_church_id uuid)
returns table(permission_key text)
language sql stable security definer
set search_path = public
as $$
  with active_access as (
    select a.id, a.role
    from public.user_church_access a
    join public.profiles pr on pr.id = a.profile_id
    join public.churches ch on ch.id = a.church_id
    where a.profile_id = auth.uid() and a.church_id = p_church_id
      and a.status = 'ACTIVE' and a.deleted_at is null
      and pr.status = 'ACTIVE' and pr.deleted_at is null
      and ch.status = 'ACTIVE' and ch.deleted_at is null
  ), inherited as (
    select aa.id as access_id, p.id as permission_id, p.key
    from active_access aa
    join public.role_permissions rp on rp.role = aa.role and rp.status = 'ACTIVE' and rp.deleted_at is null
    join public.permissions p on p.id = rp.permission_id and p.status = 'ACTIVE' and p.deleted_at is null
    where not exists (
      select 1 from public.user_permission_overrides o
      where o.access_id = aa.id and o.permission_id = p.id
        and o.effect = 'DENY' and o.deleted_at is null
    )
  ), allowed as (
    select aa.id as access_id, p.id as permission_id, p.key
    from active_access aa
    join public.user_permission_overrides o on o.access_id = aa.id and o.effect = 'ALLOW' and o.deleted_at is null
    join public.permissions p on p.id = o.permission_id and p.status = 'ACTIVE' and p.deleted_at is null
  )
  select distinct key from (select key from inherited union all select key from allowed) effective;
$$;

create or replace function public.has_permission(p_church_id uuid, p_permission_key text)
returns boolean language sql stable security definer set search_path = public as $$
  select exists(select 1 from public.get_my_permissions(p_church_id) where permission_key = p_permission_key);
$$;

create or replace function public.can_access_church(p_church_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.user_church_access a
    join public.profiles p on p.id = a.profile_id
    where a.profile_id = auth.uid() and a.church_id = p_church_id
      and a.status = 'ACTIVE' and a.deleted_at is null
      and p.status = 'ACTIVE' and p.deleted_at is null
  );
$$;

create or replace function public.can_access_region(p_church_id uuid, p_region_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.user_church_access a
    where a.profile_id = auth.uid() and a.church_id = p_church_id
      and a.status = 'ACTIVE' and a.deleted_at is null
      and (a.access_scope = 'CHURCH' or (a.access_scope = 'REGION' and a.region_id = p_region_id))
  );
$$;

create or replace function public.can_access_congregation(p_church_id uuid, p_congregation_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1
    from public.user_church_access a
    join public.congregations c on c.id = p_congregation_id and c.church_id = p_church_id
    where a.profile_id = auth.uid() and a.church_id = p_church_id
      and a.status = 'ACTIVE' and a.deleted_at is null and c.deleted_at is null
      and (
        a.access_scope = 'CHURCH' or
        (a.access_scope = 'REGION' and a.region_id = c.region_id) or
        (a.access_scope = 'CONGREGATION' and a.congregation_id = c.id)
      )
  );
$$;

create or replace function public.can_access_member(p_church_id uuid, p_member_id uuid, p_congregation_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1
    from public.user_church_access a
    left join public.congregations c on c.id = p_congregation_id
    where a.profile_id = auth.uid() and a.church_id = p_church_id
      and a.status = 'ACTIVE' and a.deleted_at is null
      and (
        a.access_scope = 'CHURCH' or
        (a.access_scope = 'REGION' and a.region_id = c.region_id) or
        (a.access_scope = 'CONGREGATION' and a.congregation_id = p_congregation_id) or
        (a.access_scope = 'MINISTRY' and exists (
          select 1 from public.member_ministries mm
          where mm.member_id = p_member_id and mm.ministry_id = a.ministry_id
            and mm.status = 'ACTIVE' and mm.deleted_at is null
        ))
      )
  );
$$;

create or replace function public.log_audit(
  p_church_id uuid, p_module text, p_action text, p_entity_type text default null,
  p_entity_id uuid default null, p_entity_label text default null,
  p_description text default null, p_old_values jsonb default null,
  p_new_values jsonb default null, p_metadata jsonb default null,
  p_severity text default 'INFO'
) returns void
language plpgsql security definer set search_path = public, auth as $$
declare v_email text;
begin
  select email into v_email from auth.users where id = auth.uid();
  insert into public.audit_logs(
    church_id, actor_profile_id, actor_email, module, action, entity_type,
    entity_id, entity_label, description, old_values, new_values, metadata, severity
  ) values (
    p_church_id, auth.uid(), v_email, p_module, p_action, p_entity_type,
    p_entity_id, p_entity_label, p_description, p_old_values, p_new_values, p_metadata, p_severity
  );
end;
$$;

create or replace function public.audit_member_mutation()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_action text; declare v_description text;
begin
  if tg_op = 'INSERT' then
    v_action := 'MEMBER_CREATED'; v_description := 'Membro cadastrado.';
    perform public.log_audit(new.church_id, 'members', v_action, 'member', new.id,
      new.full_name, v_description, null,
      jsonb_build_object('congregation_id', new.congregation_id, 'member_status', new.member_status, 'member_type', new.member_type), null, 'INFO');
  else
    if new.deleted_at is distinct from old.deleted_at then
      v_action := 'MEMBER_ARCHIVED'; v_description := 'Cadastro de membro arquivado.';
    elsif new.congregation_id is distinct from old.congregation_id then
      v_action := 'MEMBER_TRANSFERRED'; v_description := 'Congregação do membro alterada.';
    elsif new.member_status is distinct from old.member_status then
      v_action := 'MEMBER_STATUS_CHANGED'; v_description := 'Situação do membro alterada.';
    else
      v_action := 'MEMBER_UPDATED'; v_description := 'Cadastro de membro atualizado.';
    end if;
    perform public.log_audit(new.church_id, 'members', v_action, 'member', new.id,
      new.full_name, v_description,
      jsonb_build_object('congregation_id', old.congregation_id, 'member_status', old.member_status, 'member_type', old.member_type),
      jsonb_build_object('congregation_id', new.congregation_id, 'member_status', new.member_status, 'member_type', new.member_type), null,
      case when v_action in ('MEMBER_ARCHIVED','MEMBER_TRANSFERRED') then 'WARNING' else 'INFO' end);
  end if;
  return new;
end;
$$;

drop trigger if exists audit_members_mutation on public.members;
create trigger audit_members_mutation after insert or update on public.members
for each row execute function public.audit_member_mutation();

create or replace function public.audit_sensitive_member_mutation()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_changed jsonb;
begin
  if tg_op = 'UPDATE' then
    v_changed := jsonb_build_object(
      'cpf', new.cpf is distinct from old.cpf,
      'rg', new.rg is distinct from old.rg,
      'issuing_agency', new.issuing_agency is distinct from old.issuing_agency
    );
  else
    v_changed := jsonb_build_object(
      'cpf', new.cpf is not null,
      'rg', new.rg is not null,
      'issuing_agency', new.issuing_agency is not null
    );
  end if;
  perform public.log_audit(new.church_id, 'members',
    case when tg_op = 'INSERT' then 'SENSITIVE_IDENTITY_CREATED' else 'SENSITIVE_IDENTITY_UPDATED' end,
    'member', new.member_id, null, 'Dados de identidade sensível alterados.', null, null,
    jsonb_build_object('changed_fields', v_changed), 'WARNING');
  return new;
end;
$$;

drop trigger if exists audit_member_sensitive_identity on public.member_sensitive_identity;
create trigger audit_member_sensitive_identity after insert or update on public.member_sensitive_identity
for each row execute function public.audit_sensitive_member_mutation();

create or replace function public.audit_pastoral_note_mutation()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  perform public.log_audit(new.church_id, 'members',
    case when tg_op = 'INSERT' then 'PASTORAL_NOTE_CREATED' else 'PASTORAL_NOTE_UPDATED' end,
    'member', new.member_id, null, 'Observação pastoral confidencial alterada.', null, null, null, 'WARNING');
  return new;
end;
$$;

drop trigger if exists audit_member_pastoral_notes on public.member_pastoral_notes;
create trigger audit_member_pastoral_notes after insert or update on public.member_pastoral_notes
for each row execute function public.audit_pastoral_note_mutation();

create or replace function public.audit_institution_update()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  perform public.log_audit(new.id, 'church', 'CHURCH_UPDATED', 'church', new.id,
    new.name, 'Dados institucionais alterados.',
    jsonb_build_object('name', old.name, 'email', old.email, 'phone', old.phone),
    jsonb_build_object('name', new.name, 'email', new.email, 'phone', new.phone), null, 'WARNING');
  return new;
end;
$$;

drop trigger if exists audit_churches_update on public.churches;
create trigger audit_churches_update after update on public.churches
for each row execute function public.audit_institution_update();

create or replace function public.audit_app_settings_update()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.app_name is distinct from old.app_name
    or new.display_church_name is distinct from old.display_church_name
    or new.member_code_prefix is distinct from old.member_code_prefix
    or new.member_code_padding is distinct from old.member_code_padding
    or new.primary_color is distinct from old.primary_color
    or new.secondary_color is distinct from old.secondary_color then
    perform public.log_audit(new.church_id, 'settings', 'SETTINGS_UPDATED', 'app_settings', new.id,
      new.display_church_name, 'Configurações institucionais alteradas.', null,
      jsonb_build_object('app_name', new.app_name, 'member_code_prefix', new.member_code_prefix,
        'member_code_padding', new.member_code_padding), null, 'WARNING');
  end if;
  return new;
end;
$$;

drop trigger if exists audit_app_settings_update on public.app_settings;
create trigger audit_app_settings_update after update on public.app_settings
for each row execute function public.audit_app_settings_update();

create or replace function public.complete_church_onboarding(p_payload jsonb)
returns uuid
language plpgsql security definer set search_path = public, auth as $$
declare
  v_user auth.users%rowtype;
  v_church_id uuid;
  v_congregation_id uuid;
  v_name text := nullif(btrim(p_payload->>'church_name'), '');
  v_headquarters_name text := nullif(btrim(p_payload->>'headquarters_name'), '');
begin
  select * into v_user from auth.users where id = auth.uid();
  if v_user.id is null then raise exception 'Sessão inválida'; end if;
  if v_name is null or v_headquarters_name is null then raise exception 'Igreja e Congregação Sede são obrigatórias'; end if;
  if exists(select 1 from public.user_church_access where profile_id = auth.uid() and status = 'ACTIVE' and deleted_at is null) then
    raise exception 'Este usuário já possui acesso ativo a uma igreja';
  end if;

  insert into public.churches(
    name, legal_name, document, email, phone, whatsapp, zip_code, address,
    number, complement, district, city, state, country, senior_pastor_name,
    senior_pastor_spouse_name, status
  ) values (
    v_name, nullif(btrim(p_payload->>'legal_name'), ''), nullif(btrim(p_payload->>'document'), ''),
    nullif(btrim(p_payload->>'church_email'), ''), nullif(btrim(p_payload->>'phone'), ''),
    nullif(btrim(p_payload->>'whatsapp'), ''), nullif(btrim(p_payload->>'zip_code'), ''),
    nullif(btrim(p_payload->>'address'), ''), nullif(btrim(p_payload->>'number'), ''),
    nullif(btrim(p_payload->>'complement'), ''), nullif(btrim(p_payload->>'district'), ''),
    nullif(btrim(p_payload->>'city'), ''), nullif(upper(btrim(p_payload->>'state')), ''),
    coalesce(nullif(btrim(p_payload->>'country'), ''), 'Brasil'),
    nullif(btrim(p_payload->>'senior_pastor_name'), ''),
    nullif(btrim(p_payload->>'senior_pastor_spouse_name'), ''), 'ACTIVE'
  ) returning id into v_church_id;

  insert into public.congregations(
    church_id, name, code, pastor_name, pastor_spouse_name, phone, whatsapp, email,
    zip_code, address, number, complement, district, city, state, country,
    is_headquarters, status
  ) values (
    v_church_id, v_headquarters_name, coalesce(nullif(upper(btrim(p_payload->>'headquarters_code')), ''), 'SEDE'),
    coalesce(nullif(btrim(p_payload->>'headquarters_pastor_name'), ''), nullif(btrim(p_payload->>'senior_pastor_name'), '')),
    nullif(btrim(p_payload->>'headquarters_pastor_spouse_name'), ''),
    nullif(btrim(p_payload->>'phone'), ''), nullif(btrim(p_payload->>'whatsapp'), ''),
    nullif(btrim(p_payload->>'church_email'), ''), nullif(btrim(p_payload->>'zip_code'), ''),
    nullif(btrim(p_payload->>'address'), ''), nullif(btrim(p_payload->>'number'), ''),
    nullif(btrim(p_payload->>'complement'), ''), nullif(btrim(p_payload->>'district'), ''),
    nullif(btrim(p_payload->>'city'), ''), nullif(upper(btrim(p_payload->>'state')), ''),
    coalesce(nullif(btrim(p_payload->>'country'), ''), 'Brasil'), true, 'ACTIVE'
  ) returning id into v_congregation_id;

  insert into public.app_settings(
    church_id, app_name, display_church_name, primary_color, member_code_prefix,
    member_code_next_number, member_code_padding, enable_member_auto_code,
    default_country, default_state, default_city, status
  ) values (
    v_church_id, coalesce(nullif(btrim(p_payload->>'app_name'), ''), 'Eclesias'),
    coalesce(nullif(btrim(p_payload->>'display_church_name'), ''), v_name), '#415BA5',
    coalesce(nullif(upper(regexp_replace(p_payload->>'member_code_prefix', '[^A-Za-z0-9]', '', 'g')), ''), 'MEM'),
    greatest(coalesce((p_payload->>'member_code_next_number')::integer, 1), 1),
    least(greatest(coalesce((p_payload->>'member_code_padding')::integer, 4), 1), 10),
    true, coalesce(nullif(btrim(p_payload->>'country'), ''), 'Brasil'),
    nullif(upper(btrim(p_payload->>'state')), ''), nullif(btrim(p_payload->>'city'), ''), 'ACTIVE'
  );

  insert into public.profiles(id, full_name, display_name, email, status, accepted_terms_at)
  values(
    v_user.id,
    coalesce(nullif(btrim(v_user.raw_user_meta_data->>'full_name'), ''), split_part(v_user.email, '@', 1)),
    coalesce(nullif(split_part(btrim(v_user.raw_user_meta_data->>'full_name'), ' ', 1), ''), split_part(v_user.email, '@', 1)),
    lower(v_user.email), 'ACTIVE', now()
  ) on conflict(id) do update set status = 'ACTIVE', email = excluded.email,
    accepted_terms_at = coalesce(profiles.accepted_terms_at, now()), updated_at = now();

  insert into public.user_church_access(
    profile_id, church_id, role, access_scope, status, accepted_at
  ) values (v_user.id, v_church_id, 'ADMIN', 'CHURCH', 'ACTIVE', now());

  perform public.log_audit(v_church_id, 'auth', 'ONBOARDING_COMPLETED', 'church',
    v_church_id, v_name, 'Igreja, Congregação Sede e primeiro Administrador criados.',
    null, jsonb_build_object('headquarters_id', v_congregation_id), null, 'INFO');
  return v_church_id;
end;
$$;

create or replace function public.create_church_invitation(
  p_church_id uuid, p_name text, p_email text, p_role text, p_scope text,
  p_region_id uuid default null, p_congregation_id uuid default null,
  p_ministry_id uuid default null, p_notes text default null,
  p_permission_overrides jsonb default '[]'::jsonb
) returns text
language plpgsql security definer set search_path = public as $$
declare v_token text := encode(gen_random_bytes(32), 'hex');
declare v_invite_id uuid;
begin
  if not public.has_permission(p_church_id, 'users.invite') then raise exception 'Acesso negado'; end if;
  if p_role = 'ADMIN' and not exists (
    select 1 from public.user_church_access a where a.profile_id = auth.uid()
      and a.church_id = p_church_id and a.role = 'ADMIN' and a.access_scope = 'CHURCH'
      and a.status = 'ACTIVE' and a.deleted_at is null
  ) then raise exception 'Somente Administradores podem convidar outro Administrador'; end if;
  insert into public.church_invitations(
    church_id, invited_name, email, email_normalized, token_hash, role, access_scope,
    region_id, congregation_id, ministry_id, permission_overrides, invited_by, notes
  ) values (
    p_church_id, btrim(p_name), lower(btrim(p_email)), lower(btrim(p_email)),
    encode(digest(v_token, 'sha256'), 'hex'), p_role, p_scope,
    p_region_id, p_congregation_id, p_ministry_id, coalesce(p_permission_overrides, '[]'::jsonb),
    auth.uid(), nullif(btrim(p_notes), '')
  ) returning id into v_invite_id;
  perform public.log_audit(p_church_id, 'users', 'INVITATION_CREATED', 'church_invitation',
    v_invite_id, lower(btrim(p_email)), 'Convite de acesso criado.', null,
    jsonb_build_object('role', p_role, 'scope', p_scope), null, 'INFO');
  return v_token;
end;
$$;

create or replace function public.renew_church_invitation(p_invitation_id uuid)
returns text
language plpgsql security definer set search_path = public as $$
declare v_token text := encode(gen_random_bytes(32), 'hex');
declare v_church_id uuid;
begin
  select church_id into v_church_id from public.church_invitations
  where id = p_invitation_id and deleted_at is null;
  if v_church_id is null or not public.has_permission(v_church_id, 'users.invite') then raise exception 'Acesso negado'; end if;
  update public.church_invitations set token_hash = encode(digest(v_token, 'sha256'), 'hex'),
    status = 'PENDING', invited_at = now(), expires_at = now() + interval '7 days',
    cancelled_at = null, accepted_at = null, accepted_by = null, access_id = null
  where id = p_invitation_id;
  perform public.log_audit(v_church_id, 'users', 'INVITATION_RENEWED', 'church_invitation',
    p_invitation_id, null, 'Convite reenviado.', null, null, null, 'INFO');
  return v_token;
end;
$$;

create or replace function public.get_church_invitation_preview(p_token text)
returns table(
  invited_name text,
  church_name text,
  role text,
  access_scope text,
  expires_at timestamptz,
  is_available boolean
)
language sql stable security definer set search_path = public as $$
  select i.invited_name, c.name, i.role, i.access_scope, i.expires_at,
    (i.status = 'PENDING' and i.expires_at > now() and i.deleted_at is null)
  from public.church_invitations i
  join public.churches c on c.id = i.church_id
  where i.token_hash = encode(digest(p_token, 'sha256'), 'hex')
    and i.deleted_at is null
  limit 1;
$$;

create or replace function public.cancel_church_invitation(p_invitation_id uuid)
returns void
language plpgsql security definer set search_path = public as $$
declare v_church_id uuid;
begin
  select church_id into v_church_id from public.church_invitations
  where id = p_invitation_id and status = 'PENDING' and deleted_at is null for update;
  if v_church_id is null or not public.has_permission(v_church_id, 'users.invite') then raise exception 'Acesso negado'; end if;
  update public.church_invitations set status = 'CANCELLED', cancelled_at = now()
  where id = p_invitation_id;
  perform public.log_audit(v_church_id, 'users', 'INVITATION_CANCELLED', 'church_invitation',
    p_invitation_id, null, 'Convite cancelado.', null, null, null, 'WARNING');
end;
$$;

create or replace function public.accept_church_invitation(p_token text)
returns uuid
language plpgsql security definer set search_path = public, auth as $$
declare v_inv public.church_invitations%rowtype;
declare v_email text;
declare v_access_id uuid;
begin
  select lower(email) into v_email from auth.users where id = auth.uid();
  if v_email is null then raise exception 'Sessão inválida'; end if;
  select * into v_inv from public.church_invitations
  where token_hash = encode(digest(p_token, 'sha256'), 'hex')
    and status = 'PENDING' and expires_at > now() and deleted_at is null
  for update;
  if v_inv.id is null then raise exception 'Convite inválido ou expirado'; end if;
  if v_inv.email_normalized <> v_email then raise exception 'O convite pertence a outro e-mail'; end if;
  if exists(select 1 from public.profiles where id = auth.uid() and status in ('INACTIVE','BLOCKED')) then
    raise exception 'Perfil indisponível para aceitar convites';
  end if;

  update public.profiles set status = 'ACTIVE', email = v_email, updated_at = now()
  where id = auth.uid() and deleted_at is null;

  select id into v_access_id from public.user_church_access a
  where a.profile_id = auth.uid() and a.church_id = v_inv.church_id
    and a.access_scope = v_inv.access_scope
    and coalesce(a.region_id, '00000000-0000-0000-0000-000000000000'::uuid) = coalesce(v_inv.region_id, '00000000-0000-0000-0000-000000000000'::uuid)
    and coalesce(a.congregation_id, '00000000-0000-0000-0000-000000000000'::uuid) = coalesce(v_inv.congregation_id, '00000000-0000-0000-0000-000000000000'::uuid)
    and coalesce(a.ministry_id, '00000000-0000-0000-0000-000000000000'::uuid) = coalesce(v_inv.ministry_id, '00000000-0000-0000-0000-000000000000'::uuid)
    and a.deleted_at is null limit 1;

  if v_access_id is null then
    insert into public.user_church_access(
      profile_id, church_id, region_id, congregation_id, ministry_id, role,
      access_scope, status, invited_by, invited_at, accepted_at, notes
    ) values (
      auth.uid(), v_inv.church_id, v_inv.region_id, v_inv.congregation_id,
      v_inv.ministry_id, v_inv.role, v_inv.access_scope, 'ACTIVE', v_inv.invited_by,
      v_inv.invited_at, now(), v_inv.notes
    ) returning id into v_access_id;
  else
    update public.user_church_access set role = v_inv.role, status = 'ACTIVE',
      invited_by = v_inv.invited_by, invited_at = v_inv.invited_at, accepted_at = now(), notes = v_inv.notes
    where id = v_access_id;
  end if;

  insert into public.user_permission_overrides(access_id, permission_id, effect, created_by)
  select v_access_id, p.id, upper(item->>'effect'), v_inv.invited_by
  from jsonb_array_elements(v_inv.permission_overrides) item
  join public.permissions p on p.key = item->>'permission' and p.status = 'ACTIVE' and p.deleted_at is null
  where upper(item->>'effect') in ('ALLOW','DENY')
  on conflict do nothing;

  update public.church_invitations set status = 'ACCEPTED', accepted_at = now(),
    accepted_by = auth.uid(), access_id = v_access_id where id = v_inv.id;
  perform public.log_audit(v_inv.church_id, 'users', 'INVITATION_ACCEPTED', 'user_church_access',
    v_access_id, v_email, 'Convite aceito e acesso ativado.', null,
    jsonb_build_object('role', v_inv.role, 'scope', v_inv.access_scope), null, 'INFO');
  return v_inv.church_id;
end;
$$;

create or replace function public.update_church_access(
  p_access_id uuid, p_role text, p_scope text, p_status text,
  p_region_id uuid default null, p_congregation_id uuid default null,
  p_ministry_id uuid default null, p_notes text default null
) returns void
language plpgsql security definer set search_path = public as $$
declare v_old public.user_church_access%rowtype;
begin
  select * into v_old from public.user_church_access where id = p_access_id and deleted_at is null for update;
  if v_old.id is null then raise exception 'Acesso não encontrado'; end if;
  if not public.has_permission(v_old.church_id, 'users.update_access') then raise exception 'Acesso negado'; end if;
  if (v_old.role = 'ADMIN' or p_role = 'ADMIN') and not exists (
    select 1 from public.user_church_access a where a.profile_id = auth.uid()
      and a.church_id = v_old.church_id and a.role = 'ADMIN' and a.access_scope = 'CHURCH'
      and a.status = 'ACTIVE' and a.deleted_at is null
  ) then raise exception 'Somente Administradores podem alterar outro Administrador'; end if;
  update public.user_church_access set role = p_role, access_scope = p_scope,
    status = p_status, region_id = p_region_id, congregation_id = p_congregation_id,
    ministry_id = p_ministry_id, notes = nullif(btrim(p_notes), '')
  where id = p_access_id;
  perform public.log_audit(v_old.church_id, 'users', 'ACCESS_UPDATED', 'user_church_access',
    p_access_id, null, 'Acesso de usuário alterado.', to_jsonb(v_old) - 'notes',
    jsonb_build_object('role', p_role, 'scope', p_scope, 'status', p_status), null, 'WARNING');
end;
$$;

create or replace function public.set_access_permission_override(
  p_access_id uuid, p_permission_key text, p_effect text
) returns void
language plpgsql security definer set search_path = public as $$
declare v_church_id uuid; declare v_permission_id uuid;
begin
  select church_id into v_church_id from public.user_church_access where id = p_access_id and deleted_at is null;
  if v_church_id is null or not public.has_permission(v_church_id, 'users.manage_permissions') then raise exception 'Acesso negado'; end if;
  select id into v_permission_id from public.permissions where key = p_permission_key and status = 'ACTIVE' and deleted_at is null;
  if v_permission_id is null then raise exception 'Permissão inválida'; end if;
  if upper(p_effect) = 'ALLOW' and not public.has_permission(v_church_id, p_permission_key) then
    raise exception 'Não é permitido conceder uma permissão que você não possui';
  end if;
  if upper(p_effect) = 'INHERIT' then
    update public.user_permission_overrides set deleted_at = now(), updated_at = now()
    where access_id = p_access_id and permission_id = v_permission_id and deleted_at is null;
  elsif upper(p_effect) in ('ALLOW','DENY') then
    insert into public.user_permission_overrides(access_id, permission_id, effect, created_by)
    values(p_access_id, v_permission_id, upper(p_effect), auth.uid())
    on conflict (access_id, permission_id) where deleted_at is null
    do update set effect = excluded.effect, created_by = auth.uid(), updated_at = now();
  else raise exception 'Efeito inválido'; end if;
  perform public.log_audit(v_church_id, 'users', 'PERMISSION_OVERRIDE_UPDATED', 'user_church_access',
    p_access_id, p_permission_key, 'Permissão personalizada alterada.', null,
    jsonb_build_object('permission', p_permission_key, 'effect', upper(p_effect)), null, 'WARNING');
end;
$$;

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------

alter table public.profiles enable row level security;
alter table public.churches enable row level security;
alter table public.regions enable row level security;
alter table public.congregations enable row level security;
alter table public.app_settings enable row level security;
alter table public.user_church_access enable row level security;
alter table public.permissions enable row level security;
alter table public.role_permissions enable row level security;
alter table public.user_permission_overrides enable row level security;
alter table public.church_invitations enable row level security;
alter table public.audit_logs enable row level security;
alter table public.members enable row level security;
alter table public.member_sensitive_identity enable row level security;
alter table public.member_pastoral_notes enable row level security;
alter table public.member_history enable row level security;
alter table public.member_documents enable row level security;
alter table public.roles enable row level security;
alter table public.member_roles enable row level security;
alter table public.ministries enable row level security;
alter table public.member_ministries enable row level security;

drop policy if exists profiles_select_authorized on public.profiles;
create policy profiles_select_authorized on public.profiles for select to authenticated using (
  id = auth.uid() or exists (
    select 1 from public.user_church_access target
    where target.profile_id = profiles.id and target.deleted_at is null
      and public.has_permission(target.church_id, 'users.view')
  )
);
drop policy if exists profiles_update_self on public.profiles;
create policy profiles_update_self on public.profiles for update to authenticated
using (id = auth.uid() and deleted_at is null) with check (id = auth.uid() and deleted_at is null);

drop policy if exists churches_select_access on public.churches;
create policy churches_select_access on public.churches for select to authenticated
using (public.can_access_church(id) and deleted_at is null);
drop policy if exists churches_update_permission on public.churches;
create policy churches_update_permission on public.churches for update to authenticated
using (public.has_permission(id, 'church.update') and deleted_at is null)
with check (public.has_permission(id, 'church.update') and deleted_at is null);

drop policy if exists regions_select_scope on public.regions;
create policy regions_select_scope on public.regions for select to authenticated using (
  deleted_at is null and (public.can_access_region(church_id, id) or public.has_permission(church_id, 'organization.view'))
);
drop policy if exists regions_manage on public.regions;
drop policy if exists regions_insert on public.regions;
create policy regions_insert on public.regions for insert to authenticated
with check (public.has_permission(church_id, 'regions.manage') and deleted_at is null);
drop policy if exists regions_update on public.regions;
create policy regions_update on public.regions for update to authenticated
using (public.has_permission(church_id, 'regions.manage') and deleted_at is null)
with check (public.has_permission(church_id, 'regions.manage') and deleted_at is null);

drop policy if exists congregations_select_scope on public.congregations;
create policy congregations_select_scope on public.congregations for select to authenticated using (
  deleted_at is null and (public.can_access_congregation(church_id, id) or public.has_permission(church_id, 'organization.view'))
);
drop policy if exists congregations_manage on public.congregations;
drop policy if exists congregations_insert on public.congregations;
create policy congregations_insert on public.congregations for insert to authenticated
with check (public.has_permission(church_id, 'congregations.manage') and deleted_at is null);
drop policy if exists congregations_update on public.congregations;
create policy congregations_update on public.congregations for update to authenticated
using (public.has_permission(church_id, 'congregations.manage') and deleted_at is null)
with check (public.has_permission(church_id, 'congregations.manage') and deleted_at is null);

drop policy if exists app_settings_select_access on public.app_settings;
create policy app_settings_select_access on public.app_settings for select to authenticated
using (public.can_access_church(church_id) and deleted_at is null);
drop policy if exists app_settings_update_permission on public.app_settings;
create policy app_settings_update_permission on public.app_settings for update to authenticated
using (public.has_permission(church_id, 'settings.update') and deleted_at is null)
with check (public.has_permission(church_id, 'settings.update') and deleted_at is null);

drop policy if exists access_select_authorized on public.user_church_access;
create policy access_select_authorized on public.user_church_access for select to authenticated using (
  profile_id = auth.uid() or public.has_permission(church_id, 'users.view')
);
drop policy if exists access_update_authorized on public.user_church_access;
create policy access_update_authorized on public.user_church_access for update to authenticated
using (public.has_permission(church_id, 'users.update_access'))
with check (public.has_permission(church_id, 'users.update_access'));

drop policy if exists permissions_select_authenticated on public.permissions;
create policy permissions_select_authenticated on public.permissions for select to authenticated
using (status = 'ACTIVE' and deleted_at is null);
drop policy if exists role_permissions_select_authenticated on public.role_permissions;
create policy role_permissions_select_authenticated on public.role_permissions for select to authenticated
using (status = 'ACTIVE' and deleted_at is null);

drop policy if exists overrides_select_authorized on public.user_permission_overrides;
create policy overrides_select_authorized on public.user_permission_overrides for select to authenticated using (
  deleted_at is null and exists (
    select 1 from public.user_church_access a where a.id = access_id
      and (a.profile_id = auth.uid() or public.has_permission(a.church_id, 'users.view'))
  )
);

drop policy if exists invitations_select_authorized on public.church_invitations;
create policy invitations_select_authorized on public.church_invitations for select to authenticated using (
  deleted_at is null and (
    public.has_permission(church_id, 'users.view') or email_normalized = lower(coalesce(auth.jwt()->>'email',''))
  )
);
drop policy if exists invitations_update_authorized on public.church_invitations;
create policy invitations_update_authorized on public.church_invitations for update to authenticated
using (public.has_permission(church_id, 'users.invite'))
with check (public.has_permission(church_id, 'users.invite'));

drop policy if exists audit_select_permission on public.audit_logs;
create policy audit_select_permission on public.audit_logs for select to authenticated
using (church_id is not null and public.has_permission(church_id, 'audit.view'));

drop policy if exists members_select_scope on public.members;
create policy members_select_scope on public.members for select to authenticated using (
  deleted_at is null and public.has_permission(church_id, 'members.view_basic')
  and public.can_access_member(church_id, id, congregation_id)
);
drop policy if exists members_insert_scope on public.members;
create policy members_insert_scope on public.members for insert to authenticated with check (
  deleted_at is null and public.has_permission(church_id, 'members.create')
  and public.can_access_congregation(church_id, congregation_id)
);
drop policy if exists members_update_scope on public.members;
create policy members_update_scope on public.members for update to authenticated
using (deleted_at is null and public.has_permission(church_id, 'members.update') and public.can_access_member(church_id, id, congregation_id))
with check (public.has_permission(church_id, 'members.update') and public.can_access_congregation(church_id, congregation_id));

drop policy if exists member_sensitive_select on public.member_sensitive_identity;
create policy member_sensitive_select on public.member_sensitive_identity for select to authenticated using (
  deleted_at is null and public.has_permission(church_id, 'members.view_sensitive_identity')
  and exists(select 1 from public.members m where m.id = member_id and public.can_access_member(m.church_id,m.id,m.congregation_id))
);
drop policy if exists member_sensitive_insert on public.member_sensitive_identity;
create policy member_sensitive_insert on public.member_sensitive_identity for insert to authenticated with check (
  public.has_permission(church_id, 'members.manage_sensitive_identity')
  and exists(select 1 from public.members m where m.id = member_id and m.church_id = member_sensitive_identity.church_id and public.can_access_member(m.church_id,m.id,m.congregation_id))
);
drop policy if exists member_sensitive_update on public.member_sensitive_identity;
create policy member_sensitive_update on public.member_sensitive_identity for update to authenticated
using (public.has_permission(church_id, 'members.manage_sensitive_identity'))
with check (public.has_permission(church_id, 'members.manage_sensitive_identity'));

drop policy if exists pastoral_notes_select on public.member_pastoral_notes;
create policy pastoral_notes_select on public.member_pastoral_notes for select to authenticated using (
  deleted_at is null and public.has_permission(church_id, 'members.view_pastoral_notes')
  and exists(select 1 from public.members m where m.id = member_id and public.can_access_member(m.church_id,m.id,m.congregation_id))
);
drop policy if exists pastoral_notes_insert on public.member_pastoral_notes;
create policy pastoral_notes_insert on public.member_pastoral_notes for insert to authenticated with check (
  public.has_permission(church_id, 'members.edit_pastoral_notes')
);
drop policy if exists pastoral_notes_update on public.member_pastoral_notes;
create policy pastoral_notes_update on public.member_pastoral_notes for update to authenticated
using (public.has_permission(church_id, 'members.edit_pastoral_notes'))
with check (public.has_permission(church_id, 'members.edit_pastoral_notes'));

drop policy if exists member_history_select_scope on public.member_history;
create policy member_history_select_scope on public.member_history for select to authenticated using (
  deleted_at is null and exists(
    select 1 from public.members m where m.id = member_id
      and public.can_access_member(m.church_id,m.id,m.congregation_id)
      and (not member_history.is_sensitive or public.has_permission(m.church_id,'members.view_pastoral_notes'))
  )
);
drop policy if exists member_history_insert_scope on public.member_history;
create policy member_history_insert_scope on public.member_history for insert to authenticated with check (
  public.has_permission(church_id,'members.update') or public.has_permission(church_id,'members.create')
);

drop policy if exists member_documents_select_scope on public.member_documents;
create policy member_documents_select_scope on public.member_documents for select to authenticated using (
  deleted_at is null and exists(
    select 1 from public.members m where m.id = member_id
      and public.can_access_member(m.church_id,m.id,m.congregation_id)
      and (not member_documents.is_sensitive or public.has_permission(m.church_id,'members.view_sensitive_documents'))
  )
);
drop policy if exists member_documents_manage_scope on public.member_documents;
drop policy if exists member_documents_insert_scope on public.member_documents;
create policy member_documents_insert_scope on public.member_documents for insert to authenticated
with check (public.has_permission(church_id,'members.manage_documents') and deleted_at is null);
drop policy if exists member_documents_update_scope on public.member_documents;
create policy member_documents_update_scope on public.member_documents for update to authenticated
using (public.has_permission(church_id,'members.manage_documents') and deleted_at is null)
with check (public.has_permission(church_id,'members.manage_documents') and deleted_at is null);

drop policy if exists roles_select_access on public.roles;
create policy roles_select_access on public.roles for select to authenticated using (public.can_access_church(church_id) and deleted_at is null);
drop policy if exists roles_manage_access on public.roles;
drop policy if exists roles_insert_access on public.roles;
create policy roles_insert_access on public.roles for insert to authenticated
with check (public.has_permission(church_id,'member_roles.manage') and deleted_at is null);
drop policy if exists roles_update_access on public.roles;
create policy roles_update_access on public.roles for update to authenticated
using (public.has_permission(church_id,'member_roles.manage') and deleted_at is null)
with check (public.has_permission(church_id,'member_roles.manage') and deleted_at is null);

drop policy if exists member_roles_select_scope on public.member_roles;
create policy member_roles_select_scope on public.member_roles for select to authenticated using (
  deleted_at is null and public.has_permission(church_id,'member_roles.view')
  and exists(select 1 from public.members m where m.id = member_id and public.can_access_member(m.church_id,m.id,m.congregation_id))
);
drop policy if exists member_roles_manage_scope on public.member_roles;
drop policy if exists member_roles_insert_scope on public.member_roles;
create policy member_roles_insert_scope on public.member_roles for insert to authenticated
with check (public.has_permission(church_id,'member_roles.manage') and deleted_at is null);
drop policy if exists member_roles_update_scope on public.member_roles;
create policy member_roles_update_scope on public.member_roles for update to authenticated
using (public.has_permission(church_id,'member_roles.manage') and deleted_at is null)
with check (public.has_permission(church_id,'member_roles.manage') and deleted_at is null);

drop policy if exists ministries_select_access on public.ministries;
create policy ministries_select_access on public.ministries for select to authenticated using (public.can_access_church(church_id) and deleted_at is null);
drop policy if exists ministries_manage_access on public.ministries;
drop policy if exists ministries_insert_access on public.ministries;
create policy ministries_insert_access on public.ministries for insert to authenticated
with check (public.has_permission(church_id,'ministries.manage') and deleted_at is null);
drop policy if exists ministries_update_access on public.ministries;
create policy ministries_update_access on public.ministries for update to authenticated
using (public.has_permission(church_id,'ministries.manage') and deleted_at is null)
with check (public.has_permission(church_id,'ministries.manage') and deleted_at is null);

drop policy if exists member_ministries_select_scope on public.member_ministries;
create policy member_ministries_select_scope on public.member_ministries for select to authenticated using (
  deleted_at is null and public.has_permission(church_id,'ministries.view')
  and exists(select 1 from public.members m where m.id = member_id and public.can_access_member(m.church_id,m.id,m.congregation_id))
);
drop policy if exists member_ministries_manage_scope on public.member_ministries;
drop policy if exists member_ministries_insert_scope on public.member_ministries;
create policy member_ministries_insert_scope on public.member_ministries for insert to authenticated
with check (public.has_permission(church_id,'ministries.manage') and deleted_at is null);
drop policy if exists member_ministries_update_scope on public.member_ministries;
create policy member_ministries_update_scope on public.member_ministries for update to authenticated
using (public.has_permission(church_id,'ministries.manage') and deleted_at is null)
with check (public.has_permission(church_id,'ministries.manage') and deleted_at is null);

-- Proteção por coluna: usuários comuns não consultam as colunas legadas sensíveis.
revoke update on public.profiles from authenticated;
grant update (full_name, display_name, phone, whatsapp, avatar_url, locale, timezone, last_seen_at)
  on public.profiles to authenticated;

-- Supabase Storage: caminho obrigatório church_id/member_id/arquivo.
create or replace function public.safe_uuid(p_value text)
returns uuid language plpgsql immutable set search_path = public as $$
begin
  return p_value::uuid;
exception when invalid_text_representation then
  return null;
end;
$$;

insert into storage.buckets(id, name, public)
values('member-documents','member-documents',false)
on conflict(id) do update set public = false;

drop policy if exists member_files_select on storage.objects;
create policy member_files_select on storage.objects for select to authenticated using (
  bucket_id = 'member-documents'
  and public.has_permission(public.safe_uuid((storage.foldername(name))[1]), 'members.manage_documents')
);
drop policy if exists member_files_insert on storage.objects;
create policy member_files_insert on storage.objects for insert to authenticated with check (
  bucket_id = 'member-documents'
  and public.has_permission(public.safe_uuid((storage.foldername(name))[1]), 'members.manage_documents')
);
drop policy if exists member_files_update on storage.objects;
create policy member_files_update on storage.objects for update to authenticated
using (bucket_id = 'member-documents' and public.has_permission(public.safe_uuid((storage.foldername(name))[1]), 'members.manage_documents'))
with check (bucket_id = 'member-documents' and public.has_permission(public.safe_uuid((storage.foldername(name))[1]), 'members.manage_documents'));
drop policy if exists member_files_delete on storage.objects;
create policy member_files_delete on storage.objects for delete to authenticated using (
  bucket_id = 'member-documents'
  and public.has_permission(public.safe_uuid((storage.foldername(name))[1]), 'members.manage_documents')
);

-- Funções SECURITY DEFINER expostas somente aos usuários autenticados.
revoke all on function public.complete_church_onboarding(jsonb) from public;
revoke all on function public.create_church_invitation(uuid,text,text,text,text,uuid,uuid,uuid,text,jsonb) from public;
revoke all on function public.renew_church_invitation(uuid) from public;
revoke all on function public.cancel_church_invitation(uuid) from public;
revoke all on function public.accept_church_invitation(text) from public;
revoke all on function public.update_church_access(uuid,text,text,text,uuid,uuid,uuid,text) from public;
revoke all on function public.set_access_permission_override(uuid,text,text) from public;
revoke all on function public.log_audit(uuid,text,text,text,uuid,text,text,jsonb,jsonb,jsonb,text) from public;
grant execute on function public.complete_church_onboarding(jsonb) to authenticated;
grant execute on function public.create_church_invitation(uuid,text,text,text,text,uuid,uuid,uuid,text,jsonb) to authenticated;
grant execute on function public.renew_church_invitation(uuid) to authenticated;
grant execute on function public.cancel_church_invitation(uuid) to authenticated;
grant execute on function public.get_church_invitation_preview(text) to anon, authenticated;
grant execute on function public.accept_church_invitation(text) to authenticated;
grant execute on function public.update_church_access(uuid,text,text,text,uuid,uuid,uuid,text) to authenticated;
grant execute on function public.set_access_permission_override(uuid,text,text) to authenticated;

commit;
