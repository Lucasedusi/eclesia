-- Explicit unit assignment never expands the scope of the underlying access.
create or replace function private.can_access_finance_unit(p_church_id uuid,p_congregation_id uuid,p_permission text)
returns boolean language sql stable security definer set search_path='' as $$
 select (select auth.uid()) is not null and exists (
 select 1 from public.user_church_access a
 join public.churches ch on ch.id=a.church_id and ch.deleted_at is null and ch.status='ACTIVE'
 join public.congregations c on c.church_id=a.church_id and c.id=p_congregation_id and c.deleted_at is null
 left join public.financial_operational_assignments op on op.access_id=a.id and op.church_id=a.church_id and op.deleted_at is null
 where a.church_id=p_church_id and a.profile_id=(select auth.uid()) and a.status='ACTIVE' and a.deleted_at is null
 and private.access_has_permission(a.id,p_permission)
 and (a.access_scope='CHURCH' or (a.access_scope='REGION' and a.region_id=c.region_id)
   or (a.access_scope='CONGREGATION' and a.congregation_id=c.id)
   or (a.access_scope='MINISTRY' and coalesce(op.congregation_id,a.congregation_id)=c.id and exists(
     select 1 from public.ministries m where m.id=a.ministry_id and m.church_id=a.church_id and m.deleted_at is null and m.status='ACTIVE' and (m.is_global or m.congregation_id=c.id))))
 and (p_permission<>'finance.settings.manage' or (a.role='ADMIN' and a.access_scope='CHURCH'))
 and (p_permission not in ('finance.transactions.create','finance.transactions.update','finance.transactions.cancel','finance.transfers.manage')
   or (a.role='ADMIN' and a.access_scope='CHURCH') or coalesce(op.congregation_id,a.congregation_id)=c.id)
 );
$$;

create function public.list_finance_operators(p_church_id uuid,p_unit uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
begin
 if not private.can_access_finance_unit(p_church_id,p_unit,'finance.settings.manage') then raise exception 'FORBIDDEN' using errcode='42501'; end if;
 return coalesce((select jsonb_agg(jsonb_build_object('id',a.id,'name',coalesce(p.display_name,p.full_name),'scope',a.access_scope,'unitId',op.congregation_id,'allowedUnitIds',coalesce((select jsonb_agg(c.id order by c.name) from public.congregations c where c.church_id=p_church_id and c.deleted_at is null and c.status='ACTIVE' and (a.access_scope='CHURCH' or (a.access_scope='REGION' and a.region_id=c.region_id) or (a.access_scope='MINISTRY' and exists(select 1 from public.ministries m where m.church_id=p_church_id and m.id=a.ministry_id and m.deleted_at is null and m.status='ACTIVE' and (m.is_global or m.congregation_id=c.id))))),'[]'::jsonb)) order by p.full_name,a.id)
 from public.user_church_access a join public.profiles p on p.id=a.profile_id
 left join public.financial_operational_assignments op on op.church_id=a.church_id and op.access_id=a.id and op.deleted_at is null
 where a.church_id=p_church_id and a.deleted_at is null and a.status='ACTIVE' and p.status='ACTIVE' and a.access_scope in ('REGION','MINISTRY','CHURCH') and not(a.role='ADMIN' and a.access_scope='CHURCH') and private.access_has_permission(a.id,'finance.view')),'[]'::jsonb);
end $$;
create function public.assign_finance_operator(p_church_id uuid,p_unit uuid,p_access_id uuid,p_operating_unit uuid) returns void
language plpgsql security definer set search_path='' as $$
declare a public.user_church_access; ident uuid;
begin
 if not private.can_access_finance_unit(p_church_id,p_unit,'finance.settings.manage') then raise exception 'FORBIDDEN' using errcode='42501'; end if;
 perform pg_advisory_xact_lock(hashtextextended(p_church_id::text,0));
 select * into a from public.user_church_access where church_id=p_church_id and id=p_access_id and status='ACTIVE' and deleted_at is null for update;
 if not found or a.access_scope not in ('REGION','MINISTRY','CHURCH') or (a.role='ADMIN' and a.access_scope='CHURCH') then raise exception 'FORBIDDEN' using errcode='42501'; end if;
 if p_operating_unit is not null and not exists(select 1 from public.congregations c where c.church_id=p_church_id and c.id=p_operating_unit and c.status='ACTIVE' and c.deleted_at is null and (a.access_scope='CHURCH' or (a.access_scope='REGION' and a.region_id=c.region_id) or (a.access_scope='MINISTRY' and exists(select 1 from public.ministries m where m.church_id=p_church_id and m.id=a.ministry_id and m.status='ACTIVE' and m.deleted_at is null and (m.is_global or m.congregation_id=c.id))))) then raise exception 'FORBIDDEN' using errcode='42501'; end if;
 update public.financial_operational_assignments set deleted_at=now(),updated_at=now() where church_id=p_church_id and access_id=p_access_id and deleted_at is null;
 if p_operating_unit is not null then
 insert into public.financial_operational_assignments(church_id,access_id,congregation_id,created_by) values(p_church_id,p_access_id,p_operating_unit,auth.uid()) returning id into ident;
 end if;
 perform public.log_audit(p_church_id,'finance','ASSIGN_OPERATOR','user_church_access',p_access_id,null,null,null,jsonb_build_object('operatingUnit',p_operating_unit),null,'INFO');
end $$;
revoke all on function public.list_finance_operators(uuid,uuid),public.assign_finance_operator(uuid,uuid,uuid,uuid) from public,anon;
grant execute on function public.list_finance_operators(uuid,uuid),public.assign_finance_operator(uuid,uuid,uuid,uuid) to authenticated;
