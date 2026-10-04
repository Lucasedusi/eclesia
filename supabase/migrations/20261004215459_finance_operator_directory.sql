-- Caller is already authorized as the field administrator. List target access records, not only the current caller. Assignment alone grants no financial permission.
create or replace function public.list_finance_operators(p_church_id uuid,p_unit uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
begin
 if not private.can_access_finance_unit(p_church_id,p_unit,'finance.settings.manage') then raise exception 'FORBIDDEN' using errcode='42501'; end if;
 return coalesce((select jsonb_agg(jsonb_build_object('id',a.id,'name',coalesce(p.display_name,p.full_name),'scope',a.access_scope,'unitId',op.congregation_id,'allowedUnitIds',coalesce((select jsonb_agg(c.id order by c.name) from public.congregations c where c.church_id=p_church_id and c.deleted_at is null and c.status='ACTIVE' and (a.access_scope='CHURCH' or (a.access_scope='REGION' and a.region_id=c.region_id) or (a.access_scope='MINISTRY' and exists(select 1 from public.ministries m where m.church_id=p_church_id and m.id=a.ministry_id and m.deleted_at is null and m.status='ACTIVE' and (m.is_global or m.congregation_id=c.id))))),'[]'::jsonb)) order by p.full_name,a.id)
 from public.user_church_access a join public.profiles p on p.id=a.profile_id
 left join public.financial_operational_assignments op on op.church_id=a.church_id and op.access_id=a.id and op.deleted_at is null
 where a.church_id=p_church_id and a.deleted_at is null and a.status='ACTIVE' and p.status='ACTIVE' and p.deleted_at is null and a.access_scope in ('REGION','MINISTRY','CHURCH') and not(a.role='ADMIN' and a.access_scope='CHURCH')),'[]'::jsonb);
end $$;
