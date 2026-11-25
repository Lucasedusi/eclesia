begin;

alter table public.church_invitations
 drop constraint church_invitations_role_check,
 add constraint church_invitations_role_check check (role in ('ADMIN','SECRETARY','TREASURER','LEADER','MINISTRY_LEADER','VIEWER','ACCOUNTANT'));

alter table public.church_invitations add constraint church_invitations_accountant_scope
 check (role <> 'ACCOUNTANT' or (access_scope='CONGREGATION' and congregation_id is not null and ministry_id is null and region_id is null));

alter table public.role_permissions
 drop constraint role_permissions_role_check,
 add constraint role_permissions_role_check check (role in ('ADMIN','SECRETARY','TREASURER','LEADER','MINISTRY_LEADER','VIEWER','ACCOUNTANT'));

alter table public.user_church_access
 drop constraint user_church_access_role_check,
 add constraint user_church_access_role_check check (role in ('ADMIN','SECRETARY','TREASURER','LEADER','MINISTRY_LEADER','VIEWER','ACCOUNTANT'));

alter table public.user_church_access add constraint user_church_access_accountant_scope
 check (role <> 'ACCOUNTANT' or (access_scope='CONGREGATION' and congregation_id is not null and ministry_id is null and region_id is null));

insert into public.role_permissions(role,permission_id,status)
select 'ACCOUNTANT',id,'ACTIVE' from public.permissions where key='finance.accounting.export' and deleted_at is null;

-- Accounting-only access may be repeated for distinct congregations in the same church.
create function private.guard_accountant_access() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 if new.status='ACTIVE' and new.deleted_at is null then
   perform 1 from public.profiles where id=new.profile_id for update;
   if exists(select from public.user_church_access a where a.church_id=new.church_id
      and a.profile_id=new.profile_id and a.id<>new.id and a.status='ACTIVE' and a.deleted_at is null
      and (a.role='ACCOUNTANT') <> (new.role='ACCOUNTANT')) then
      raise exception 'O acesso de Contador exige um perfil exclusivamente contábil nesta igreja.' using errcode='23514';
   end if;
 end if;
 return new;
end $$;
revoke all on function private.guard_accountant_access() from public,anon,authenticated;
create trigger guard_accountant_access before insert or update of role,status,deleted_at,church_id,profile_id
on public.user_church_access for each row execute function private.guard_accountant_access();

create or replace function public.get_my_permissions(p_church_id uuid)
returns table(permission_key text)
language sql stable security definer
set search_path = ''
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
    where (aa.role <> 'ACCOUNTANT' or p.key='finance.accounting.export') and not exists (
      select 1 from public.user_permission_overrides o
      where o.access_id = aa.id and o.permission_id = p.id
        and o.effect = 'DENY' and o.deleted_at is null
    )
  ), allowed as (
    select aa.id as access_id, p.id as permission_id, p.key
    from active_access aa
    join public.user_permission_overrides o on o.access_id = aa.id and o.effect = 'ALLOW' and o.deleted_at is null
    join public.permissions p on p.id = o.permission_id and p.status = 'ACTIVE' and p.deleted_at is null
    where aa.role <> 'ACCOUNTANT'
  )
  select distinct key from (select key from inherited union all select key from allowed) effective;
$$;

create or replace function private.access_has_permission(
  p_access_id uuid,
  p_permission_key text
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
    join public.profiles profile on profile.id = access.profile_id
    join public.permissions permission on permission.key = p_permission_key
      and permission.status = 'ACTIVE' and permission.deleted_at is null
    where (access.role <> 'ACCOUNTANT' or p_permission_key='finance.accounting.export')
      and access.id = p_access_id
      and access.profile_id = (select auth.uid())
      and access.status = 'ACTIVE' and access.deleted_at is null
      and profile.status = 'ACTIVE' and profile.deleted_at is null
      and (
        exists (
          select 1
          from public.user_permission_overrides permission_override
          where access.role <> 'ACCOUNTANT' and permission_override.access_id = access.id
            and permission_override.permission_id = permission.id
            and permission_override.effect = 'ALLOW'
            and permission_override.deleted_at is null
        )
        or (
          exists (
            select 1
            from public.role_permissions role_permission
            where role_permission.role = access.role
              and role_permission.permission_id = permission.id
              and role_permission.status = 'ACTIVE'
              and role_permission.deleted_at is null
          )
          and not exists (
            select 1
            from public.user_permission_overrides permission_override
            where permission_override.access_id = access.id
              and permission_override.permission_id = permission.id
              and permission_override.effect = 'DENY'
              and permission_override.deleted_at is null
          )
        )
      )
  );
$$;

create or replace function public.can_access_church(p_church_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.user_church_access a
    join public.profiles p on p.id = a.profile_id
    where a.role <> 'ACCOUNTANT' and a.profile_id = auth.uid() and a.church_id = p_church_id
      and a.status = 'ACTIVE' and a.deleted_at is null
      and p.status = 'ACTIVE' and p.deleted_at is null
  );
$$;

create or replace function public.can_access_congregation(p_church_id uuid, p_congregation_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1
    from public.user_church_access a
    join public.congregations c on c.id = p_congregation_id and c.church_id = p_church_id
    where a.role <> 'ACCOUNTANT' and a.profile_id = auth.uid() and a.church_id = p_church_id
      and a.status = 'ACTIVE' and a.deleted_at is null and c.deleted_at is null
      and (
        a.access_scope = 'CHURCH' or
        (a.access_scope = 'REGION' and a.region_id = c.region_id) or
        (a.access_scope = 'CONGREGATION' and a.congregation_id = c.id)
      )
  );
$$;

create or replace function public.can_access_member(p_church_id uuid, p_member_id uuid, p_congregation_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1
    from public.user_church_access a
    left join public.congregations c on c.id = p_congregation_id
    where a.role <> 'ACCOUNTANT' and a.profile_id = auth.uid() and a.church_id = p_church_id
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

-- Reading the church identity is required by the session resolver.
alter policy churches_select_access on public.churches using (deleted_at is null and (
 public.can_access_church(id) or (status='ACTIVE' and id in (
   select a.church_id from public.user_church_access a where a.profile_id=(select auth.uid())
   and a.role='ACCOUNTANT' and a.status='ACTIVE' and a.deleted_at is null
 ))
));
alter policy "Church users can view app settings" on public.app_settings using (exists(
 select from public.user_church_access uca where uca.profile_id=(select auth.uid()) and uca.church_id=app_settings.church_id
 and uca.status='ACTIVE' and uca.deleted_at is null and uca.role <> 'ACCOUNTANT'
));

create or replace function private.accounting_units(p_church uuid)
returns table(id uuid,name text) language sql stable security definer set search_path='' as $$
 select c.id,c.name from public.congregations c where c.church_id=p_church and c.deleted_at is null
 and c.status='ACTIVE' and exists(select from public.churches ch where ch.id=p_church and ch.status='ACTIVE' and ch.deleted_at is null)
 and exists(select from public.profiles p where p.id=(select auth.uid()) and p.status='ACTIVE' and p.deleted_at is null)
 and (private.can_access_finance_unit(p_church,c.id,'finance.view') or exists (
   select from public.user_church_access a where a.profile_id=(select auth.uid()) and a.church_id=c.church_id
   and a.role='ACCOUNTANT' and a.access_scope='CONGREGATION' and a.congregation_id=c.id and a.status='ACTIVE' and a.deleted_at is null
 ))
 and private.can_access_finance_unit(p_church,c.id,'finance.accounting.export')
$$;

create or replace function private.scoped_accounting_catalog(p_church uuid) returns jsonb
language sql stable security definer set search_path='' as $$
 with units as materialized (
   select u.id,u.name,c.is_headquarters as "isHeadquarters" from private.accounting_units(p_church) u
   join public.congregations c on c.church_id=p_church and c.id=u.id
 )
 select jsonb_build_object(
 'units',coalesce((select jsonb_agg(to_jsonb(u) order by u.name,u.id) from units u),'[]'),
 'boxes',coalesce((select jsonb_agg(jsonb_build_object('id',b.id,'unit',b.congregation_id,'name',b.name,'code',b.accounting_code,'agency',b.agency,'account',b.account_number) order by b.name,b.id)
   from public.financial_cashboxes b join units u on u.id=b.congregation_id where b.church_id=p_church and b.deleted_at is null),'[]'),
 'categories',private.accounting_catalog_categories(p_church))
$$;

revoke all on function private.scoped_accounting_catalog(uuid) from public,anon,authenticated;
grant execute on function private.scoped_accounting_catalog(uuid) to authenticated;
create or replace function public.finance_accounting_catalog(p_church uuid) returns jsonb
language sql stable security invoker set search_path='' as $$ select private.scoped_accounting_catalog(p_church) $$;

create function private.accounting_memo(tithe boolean,person text,description text,category text)
returns text language sql immutable security invoker set search_path='' as $$
 with parts as (select nullif(btrim(person),'') donor,nullif(btrim(description),'') note,
                       coalesce(nullif(btrim(category),''),'') label)
 select case when tithe and donor is not null then
  case when note is null or lower(note) in (lower(label),'dízimo','dízimos',lower(donor))
       then 'Dízimo de '||donor
       when strpos(lower(note),lower(donor))>0 then note
       else 'Dízimo de '||donor||' — '||note end
 else coalesce(note,label) end from parts
$$;
revoke all on function private.accounting_memo(boolean,text,text,text) from public,anon,authenticated;

create or replace function private.accounting_snapshot(p_church uuid,p_filters jsonb) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare
 u uuid := (p_filters->>'unit')::uuid; b uuid := (p_filters->>'box')::uuid;
 d1 date := (p_filters->>'start')::date; d2 date := (p_filters->>'end')::date;
 dir text := p_filters->>'direction'; allowed uuid[]; result jsonb;
begin
 select array_agg(id) into allowed from private.accounting_units(p_church) where u is null or id=u;
 if allowed is null then raise exception 'FORBIDDEN' using errcode='42501'; end if;
 if d1 is null or d2 is null or d1>d2 or dir is null or dir not in ('ALL','INCOME','EXPENSE') then raise exception 'INVALID_INPUT'; end if;
 if b is not null and not exists(select from public.financial_cashboxes where church_id=p_church and congregation_id=any(allowed) and id=b and deleted_at is null)
 then raise exception 'FORBIDDEN' using errcode='42501'; end if;

 with source as materialized (
 select t.id,t.revision,t.transaction_date date,t.transaction_type direction,(t.amount*100)::bigint cents,
  c.name unit,box.name box,coalesce(t.category_name,cat.name) category,
  case when t.transaction_type='INCOME' then box.accounting_code else mapping.code end debit,
  case when t.transaction_type='INCOME' then mapping.code else box.accounting_code end credit,
  coalesce(t.document_number,t.transaction_number,'') document,
  private.accounting_memo(t.transaction_type='INCOME' and
    coalesce(cat.is_tithe,t.tithe_classification_id is not null or t.classification_name is not null),
    case when t.contributor_kind in ('MEMBER','UNREGISTERED') then t.person_name end,
    t.description,coalesce(t.category_name,cat.name)) memo,
  case when t.transaction_type='INCOME' and coalesce(cat.is_tithe,true) then t.classification_name end classification,
  case when t.contributor_congregation_id is not null then t.person_name end payer,
  case when box.accounting_code is null then 'Código do caixa ou conta' end box_issue,
  case when mapping.code is null then 'Código da categoria' end category_issue,
  exists(select from private.finance_accounting_items i where i.church_id=t.church_id and i.transaction_id=t.id) exported
 from public.financial_transactions t join public.congregations c on c.church_id=t.church_id and c.id=t.congregation_id
 left join public.financial_cashboxes box on box.church_id=t.church_id and box.congregation_id=t.congregation_id and box.id=t.cashbox_id and box.deleted_at is null
 left join public.financial_categories cat on cat.church_id=t.church_id and cat.id=t.category_id and cat.deleted_at is null
 left join private.accounting_category_links mapping on mapping.church_id=cat.church_id and mapping.category_id=cat.id and mapping.direction=t.transaction_type
 where t.church_id=p_church and t.congregation_id=any(allowed) and t.deleted_at is null and t.status='CONFIRMED'
 and t.transaction_date between d1 and d2 and (b is null or t.cashbox_id=b) and (dir='ALL' or t.transaction_type=dir)
 ), special as (
 select t.transaction_date date,'Transferência' kind,t.id from public.financial_transfers t
 where t.church_id=p_church and t.congregation_id=any(allowed) and t.deleted_at is null and t.status='CONFIRMED'
 and t.transaction_date between d1 and d2 and (b is null or b in(t.source_cashbox_id,t.target_cashbox_id))
 union all
 select l.financial_date,'Ajuste de saldo',l.id from public.financial_ledger_entries l
 where l.church_id=p_church and l.congregation_id=any(allowed) and l.entry_kind='ADJUSTMENT' and l.deleted_at is null
 and l.financial_date between d1 and d2 and (b is null or l.cashbox_id=b)
 )
 select jsonb_build_object(
 'rows',coalesce(jsonb_agg(to_jsonb(s) order by s.date,s.id),'[]'),
 'fingerprint',md5(coalesce(jsonb_agg(to_jsonb(s)-'exported'-'classification' order by s.date,s.id)::text,'[]')),
 'total',count(*),'previous',count(*) filter(where exported),
 'missing',count(*) filter(where box_issue is not null or category_issue is not null),
 'income',coalesce(sum(cents) filter(where direction='INCOME'),0),'expense',coalesce(sum(cents) filter(where direction='EXPENSE'),0),
 'special',coalesce((select jsonb_agg(to_jsonb(x) order by date,kind) from (select date,kind,count(*) quantity from special group by date,kind)x),'[]')
 ) into result from source s;
 return result;
end $$;

commit;
