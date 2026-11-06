-- Exporting contact reports is independent of editing the organization.
begin;

insert into public.permissions (key, name, description, module, action, is_sensitive, status)
values (
  'congregations.reports.export', 'Exportar relatórios de congregações',
  'Gerar lista simplificada em PDF/Excel e ficha individual da congregação em PDF',
  'organization', 'export', true, 'ACTIVE'
)
on conflict do nothing;

insert into public.role_permissions (role, permission_id, status)
select roles.role, permission.id, 'ACTIVE'
from (values ('ADMIN'::text), ('SECRETARY'::text)) roles(role)
join public.permissions permission on permission.key = 'congregations.reports.export'
  and permission.status = 'ACTIVE' and permission.deleted_at is null
on conflict do nothing;

commit;
