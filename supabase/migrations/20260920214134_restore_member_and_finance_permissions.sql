-- O baseline clonado preservou as políticas que usam estas permissões, mas não
-- os registros de dados que existiam no catálogo remoto. Em um banco criado do
-- zero, isso ocultava as abas de histórico e financeiro mesmo para ADMIN.
insert into public.permissions (
  key,
  name,
  description,
  module,
  action,
  is_sensitive,
  status
)
values
  (
    'member_history.view',
    'Ver histórico eclesiástico',
    'Consultar o histórico eclesiástico dos membros',
    'members',
    'view_history',
    false,
    'ACTIVE'
  ),
  (
    'member_history.create',
    'Registrar histórico eclesiástico',
    'Adicionar registros ao histórico eclesiástico dos membros',
    'members',
    'create_history',
    true,
    'ACTIVE'
  ),
  (
    'member_history.view_sensitive',
    'Ver histórico eclesiástico sensível',
    'Consultar registros sensíveis do histórico eclesiástico dos membros',
    'members',
    'view_sensitive_history',
    true,
    'ACTIVE'
  ),
  (
    'finance.view',
    'Visualizar financeiro',
    'Consultar informações e movimentações financeiras',
    'finance',
    'view',
    true,
    'ACTIVE'
  ),
  (
    'finance.manage',
    'Gerenciar financeiro',
    'Criar e alterar informações e movimentações financeiras',
    'finance',
    'manage',
    true,
    'ACTIVE'
  )
on conflict do nothing;

-- Mantém ativa uma permissão já existente sem reabrir registros excluídos
-- logicamente. Se houver somente um registro excluído, o INSERT acima cria um
-- novo registro ativo, preservando o histórico anterior.
update public.permissions
set status = 'ACTIVE',
    updated_at = now()
where key in (
  'member_history.view',
  'member_history.create',
  'member_history.view_sensitive',
  'finance.view',
  'finance.manage'
)
  and deleted_at is null
  and status is distinct from 'ACTIVE';

insert into public.role_permissions (role, permission_id, status)
select 'ADMIN', permission.id, 'ACTIVE'
from public.permissions permission
where permission.key in (
  'member_history.view',
  'member_history.create',
  'member_history.view_sensitive',
  'finance.view',
  'finance.manage'
)
  and permission.status = 'ACTIVE'
  and permission.deleted_at is null
on conflict do nothing;

update public.role_permissions role_permission
set status = 'ACTIVE',
    updated_at = now()
from public.permissions permission
where role_permission.permission_id = permission.id
  and role_permission.role = 'ADMIN'
  and role_permission.deleted_at is null
  and role_permission.status is distinct from 'ACTIVE'
  and permission.key in (
    'member_history.view',
    'member_history.create',
    'member_history.view_sensitive',
    'finance.view',
    'finance.manage'
  )
  and permission.status = 'ACTIVE'
  and permission.deleted_at is null;
