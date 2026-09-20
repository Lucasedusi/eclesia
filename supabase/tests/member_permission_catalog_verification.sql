-- Verifica que bancos construídos somente pelo histórico de migrações possuam
-- as permissões usadas pelo modal de membros e pelas políticas financeiras.
-- O script é somente leitura.
do $$
declare
  v_permission_count integer;
  v_admin_permission_count integer;
begin
  select count(*)
  into v_permission_count
  from public.permissions permission
  where permission.key in (
    'member_history.view',
    'member_history.create',
    'member_history.view_sensitive',
    'finance.view',
    'finance.manage'
  )
    and permission.status = 'ACTIVE'
    and permission.deleted_at is null;

  if v_permission_count <> 5 then
    raise exception
      'Catálogo de permissões de membros/financeiro incompleto: esperado 5, encontrado %',
      v_permission_count;
  end if;

  select count(*)
  into v_admin_permission_count
  from public.role_permissions role_permission
  join public.permissions permission
    on permission.id = role_permission.permission_id
  where role_permission.role = 'ADMIN'
    and permission.key in (
      'member_history.view',
      'member_history.create',
      'member_history.view_sensitive',
      'finance.view',
      'finance.manage'
    )
    and role_permission.status = 'ACTIVE'
    and role_permission.deleted_at is null
    and permission.status = 'ACTIVE'
    and permission.deleted_at is null;

  if v_admin_permission_count <> 5 then
    raise exception
      'Permissões de membros/financeiro do ADMIN incompletas: esperado 5, encontrado %',
      v_admin_permission_count;
  end if;
end $$;

select 'member_permission_catalog_verification_ok' as result;
