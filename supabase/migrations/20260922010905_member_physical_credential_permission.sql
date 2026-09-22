insert into public.permissions (
  key, name, description, module, action, is_sensitive, status
)
values (
  'members.credentials.issue',
  'Emitir credencial física de membro',
  'Pré-visualizar e gerar credenciais físicas de membros',
  'members',
  'issue_credential',
  true,
  'ACTIVE'
)
on conflict do nothing;

update public.permissions
set status = 'ACTIVE', updated_at = now()
where key = 'members.credentials.issue'
  and deleted_at is null
  and status is distinct from 'ACTIVE';

insert into public.role_permissions (role, permission_id, status)
select role_name.role, permission.id, 'ACTIVE'
from (values ('ADMIN'::text), ('SECRETARY'::text)) role_name(role)
join public.permissions permission
  on permission.key = 'members.credentials.issue'
 and permission.status = 'ACTIVE'
 and permission.deleted_at is null
on conflict do nothing;

update public.role_permissions role_permission
set status = 'ACTIVE', updated_at = now()
from public.permissions permission
where role_permission.permission_id = permission.id
  and role_permission.role in ('ADMIN', 'SECRETARY')
  and role_permission.deleted_at is null
  and role_permission.status is distinct from 'ACTIVE'
  and permission.key = 'members.credentials.issue'
  and permission.status = 'ACTIVE'
  and permission.deleted_at is null;
