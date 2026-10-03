-- Financial permissions remain attached to the SAME access that grants scope.
insert into public.permissions(key,name,module,action,is_sensitive,status)
select 'finance.'||k,n,'finance',k,true,'ACTIVE' from (values
 ('transactions.create','Registrar lançamentos'),('transactions.update','Corrigir lançamentos'),
 ('transactions.cancel','Cancelar lançamentos'),('transfers.manage','Gerenciar transferências'),
 ('statements.generate','Gerar demonstrativos'),('settings.manage','Configurar financeiro'),
 ('contributors.lookup','Identificar contribuintes')) v(k,n)
on conflict do nothing;
insert into public.role_permissions(role,permission_id,status)
select distinct rp.role,p.id,'ACTIVE' from public.role_permissions rp
join public.permissions old on old.id=rp.permission_id and old.key='finance.manage' and old.deleted_at is null and old.status='ACTIVE'
cross join public.permissions p
where rp.status='ACTIVE' and rp.deleted_at is null and p.module='finance' and p.key<>'finance.manage' and p.deleted_at is null
and (p.key<>'finance.settings.manage' or rp.role='ADMIN') on conflict do nothing;
insert into public.user_permission_overrides(access_id,permission_id,effect,created_by)
select o.access_id,p.id,o.effect,o.created_by from public.user_permission_overrides o
join public.permissions old on old.id=o.permission_id and old.key='finance.manage' and old.deleted_at is null
cross join public.permissions p
where o.deleted_at is null and p.module='finance' and p.key<>'finance.manage' and p.deleted_at is null
on conflict do nothing;

create table public.financial_operational_assignments (
 id uuid primary key default gen_random_uuid(), church_id uuid not null references public.churches(id),
 access_id uuid not null, congregation_id uuid not null, created_by uuid not null references public.profiles(id),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(), deleted_at timestamptz,
 unique(church_id,id), foreign key(church_id,congregation_id) references public.congregations(church_id,id)
);
create unique index financial_operational_assignment_active on public.financial_operational_assignments(access_id) where deleted_at is null;
create index financial_operational_assignment_unit on public.financial_operational_assignments(church_id,congregation_id);
-- Composite ownership for access assignment, without modifying authentication scope constraints.
create unique index if not exists user_church_access_church_finance_id on public.user_church_access(church_id,id);
alter table public.financial_operational_assignments add foreign key(church_id,access_id) references public.user_church_access(church_id,id);
alter table public.financial_operational_assignments enable row level security;
revoke all on public.financial_operational_assignments from public,anon,authenticated;

create function private.can_access_finance_unit(p_church_id uuid,p_congregation_id uuid,p_permission text)
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
     select 1 from public.ministries m where m.id=a.ministry_id and m.church_id=a.church_id and m.deleted_at is null)))
 and (p_permission<>'finance.settings.manage' or (a.role='ADMIN' and a.access_scope='CHURCH'))
 and (p_permission not in ('finance.transactions.create','finance.transactions.update','finance.transactions.cancel','finance.transfers.manage')
   or (a.role='ADMIN' and a.access_scope='CHURCH') or coalesce(op.congregation_id,a.congregation_id)=c.id)
 );
$$;
revoke all on function private.can_access_finance_unit(uuid,uuid,text) from public,anon;
grant execute on function private.can_access_finance_unit(uuid,uuid,text) to authenticated,service_role;

create function private.can_read_finance_catalog(p_church_id uuid,p_unit uuid default null)
returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.congregations c where c.church_id=p_church_id and (p_unit is null or c.id=p_unit)
 and c.deleted_at is null and private.can_access_finance_unit(p_church_id,c.id,'finance.view'));
$$;
revoke all on function private.can_read_finance_catalog(uuid,uuid) from public,anon;
grant execute on function private.can_read_finance_catalog(uuid,uuid) to authenticated,service_role;

create function public.list_finance_units(p_church_id uuid) returns jsonb
language sql stable security definer set search_path='' as $$
 select coalesce(jsonb_agg(jsonb_build_object('id',c.id,'name',c.name,'isHeadquarters',c.is_headquarters,'capabilities',
 jsonb_build_object('view',true,
 'create',private.can_access_finance_unit(p_church_id,c.id,'finance.transactions.create'),
 'update',private.can_access_finance_unit(p_church_id,c.id,'finance.transactions.update'),
 'cancel',private.can_access_finance_unit(p_church_id,c.id,'finance.transactions.cancel'),
 'transfer',private.can_access_finance_unit(p_church_id,c.id,'finance.transfers.manage'),
 'generateStatement',private.can_access_finance_unit(p_church_id,c.id,'finance.statements.generate'),
 'manageSettings',private.can_access_finance_unit(p_church_id,c.id,'finance.settings.manage'),
 'lookupContributors',private.can_access_finance_unit(p_church_id,c.id,'finance.contributors.lookup')))
 order by c.is_headquarters desc,c.name,c.id),'[]'::jsonb)
 from public.congregations c where c.church_id=p_church_id and c.deleted_at is null and c.status='ACTIVE'
 and private.can_access_finance_unit(p_church_id,c.id,'finance.view');
$$;
revoke all on function public.list_finance_units(uuid) from public,anon;
grant execute on function public.list_finance_units(uuid) to authenticated;

-- Financial mutations are only allowed through authorized domain RPCs.
do $$ declare t text; pol record; expr text; begin
 foreach t in array array['financial_transactions','financial_cashboxes','financial_departments','financial_categories','financial_payment_methods','financial_receipts','financial_documents','report_deliveries','report_delivery_rules','report_delivery_items'] loop
  for pol in select policyname from pg_policies where schemaname='public' and tablename=t loop
   execute format('drop policy %I on public.%I',pol.policyname,t);
  end loop;
  execute format('revoke all on public.%I from public, anon, authenticated',t);
  execute format('grant select on public.%I to authenticated',t);
  if t in ('financial_categories','financial_payment_methods') then expr:='private.can_read_finance_catalog(church_id)';
  elsif t in ('financial_departments','report_delivery_rules') then expr:='private.can_read_finance_catalog(church_id,congregation_id)';
  elsif t='report_delivery_items' then expr:='exists(select 1 from public.report_deliveries d where d.id=report_delivery_id and d.church_id=report_delivery_items.church_id and private.can_access_finance_unit(d.church_id,d.congregation_id,''finance.view''))';
  else expr:='private.can_access_finance_unit(church_id,congregation_id,''finance.view'')'; end if;
  execute format('create policy finance_scoped_read on public.%I for select to authenticated using (deleted_at is null and %s)',t,expr);
 end loop;
end $$;
