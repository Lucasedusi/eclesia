create function public.lookup_finance_contributors(p_church_id uuid,p_unit uuid,p_kind text,p_value text) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare term text:=trim(p_value);result jsonb;begin
 if not private.can_access_finance_unit(p_church_id,p_unit,'finance.contributors.lookup') then raise exception 'FORBIDDEN' using errcode='42501';end if;
 if p_kind not in ('NAME','CPF','MEMBER_CODE','CREDENTIAL') or coalesce(length(term),0)>250 or (p_kind in ('NAME','MEMBER_CODE') and length(term)<3) or (p_kind='CPF' and (term !~ '^[0-9]{11}$' or not public.is_valid_cpf(term))) or (p_kind='CREDENTIAL' and term !~ '^[a-f0-9]{64}$') then raise exception 'INVALID_INPUT' using errcode='22023';end if;
 select coalesce(jsonb_agg(v.item order by v.name,v.id),'[]') into result from (
 select m.id,m.full_name name,jsonb_build_object('id',m.id,'name',m.full_name,'memberCode',m.member_code,'congregationName',c.name,'suggestedClassificationId',suggestion.id) item
 from public.members m join public.congregations c on c.church_id=m.church_id and c.id=m.congregation_id and c.deleted_at is null
 left join lateral(select fc.id from public.member_roles mr join public.financial_tithe_classifications fc on fc.church_id=mr.church_id and fc.role_id=mr.role_id and fc.status='ACTIVE' and fc.deleted_at is null
 where mr.church_id=p_church_id and mr.member_id=m.id and mr.status='ACTIVE' and mr.deleted_at is null and (mr.start_date is null or mr.start_date<=current_date) and (mr.end_date is null or mr.end_date>=current_date)
 order by mr.is_primary desc,mr.created_at desc,fc.id limit 1) suggestion on true
 where m.church_id=p_church_id and m.deleted_at is null and m.member_status='ACTIVE' and (
 (p_kind='NAME' and m.full_name ilike '%'||replace(replace(replace(term,'!','!!'),'%','!%'),'_','!_')||'%' escape '!')
 or (p_kind='MEMBER_CODE' and lower(m.member_code)=lower(term))
 or (p_kind='CPF' and exists(select 1 from public.member_sensitive_identity s where s.church_id=p_church_id and s.member_id=m.id and s.cpf=term and s.deleted_at is null))
 or (p_kind='CREDENTIAL' and m.member_type='MEMBER' and exists(select 1 from public.member_credential_tokens t where t.church_id=p_church_id and t.member_id=m.id and t.token_hash=term and t.status='ACTIVE' and t.issued_at is not null)))
 order by m.full_name,m.id limit 20) v;
 return result;
end $$;
revoke all on function public.lookup_finance_contributors(uuid,uuid,text,text) from public,anon;
grant execute on function public.lookup_finance_contributors(uuid,uuid,text,text) to authenticated;

create table public.financial_document_uploads(
 id uuid primary key default gen_random_uuid(),church_id uuid not null references public.churches(id),congregation_id uuid not null,
 created_by uuid not null references public.profiles(id),file_name text not null,mime_type text not null check(mime_type in ('application/pdf','image/jpeg','image/png')),
 file_size bigint not null check(file_size between 1 and 10485760),pending_path text not null unique,storage_path text not null unique,
 status text not null default 'PENDING' check(status in ('PENDING','READY','LINKED','DISCARDED')),content_hash text check(content_hash ~ '^[a-f0-9]{64}$'),transaction_id uuid,
 created_at timestamptz not null default now(),updated_at timestamptz not null default now(),deleted_at timestamptz,
 unique(church_id,id),foreign key(church_id,congregation_id) references public.congregations(church_id,id),foreign key(church_id,transaction_id) references public.financial_transactions(church_id,id),
 check((status='LINKED')=(transaction_id is not null)),check(status not in ('READY','LINKED') or content_hash is not null)
);
create index finance_upload_owner on public.financial_document_uploads(church_id,congregation_id,created_by,status);
alter table public.financial_document_uploads enable row level security;
revoke all on public.financial_document_uploads from public,anon,authenticated;
grant select on public.financial_document_uploads to authenticated;
grant select,insert,update,delete on public.financial_document_uploads to service_role;
create policy finance_upload_read on public.financial_document_uploads for select to authenticated using(deleted_at is null and private.can_access_finance_unit(church_id,congregation_id,'finance.view') and (created_by=(select auth.uid()) or status='LINKED'));
alter table public.financial_documents add column upload_id uuid,
 add constraint finance_document_upload_fk foreign key(church_id,upload_id) references public.financial_document_uploads(church_id,id),
 add constraint finance_document_tx_fk foreign key(church_id,financial_transaction_id) references public.financial_transactions(church_id,id) not valid,
 add constraint finance_document_receipt_fk foreign key(church_id,financial_receipt_id) references public.financial_receipts(church_id,id) not valid,
 add constraint finance_document_unit_fk foreign key(church_id,congregation_id) references public.congregations(church_id,id) not valid;
create unique index finance_document_upload_unique on public.financial_documents(upload_id) where upload_id is not null;

create function public.prepare_finance_upload(p_church_id uuid,p_unit uuid,p_name text,p_type text,p_size bigint) returns jsonb
language plpgsql security definer set search_path='' as $$
declare ident uuid:=gen_random_uuid();ext text;prefix text;begin
 if not (private.can_access_finance_unit(p_church_id,p_unit,'finance.transactions.create') or private.can_access_finance_unit(p_church_id,p_unit,'finance.transactions.update')) then raise exception 'FORBIDDEN' using errcode='42501';end if;
 ext:=case p_type when 'application/pdf' then 'pdf' when 'image/jpeg' then 'jpg' when 'image/png' then 'png' end;
 if ext is null or p_size not between 1 and 10485760 or coalesce(length(trim(p_name)),0) not between 1 and 200 then raise exception 'INVALID_INPUT' using errcode='22023';end if;
 prefix:=p_church_id::text||'/'||p_unit::text||'/'||ident::text||'/';
 insert into public.financial_document_uploads(id,church_id,congregation_id,created_by,file_name,mime_type,file_size,pending_path,storage_path)
 values(ident,p_church_id,p_unit,auth.uid(),p_name,p_type,p_size,prefix||'pending.'||ext,prefix||'document.'||ext);
 return jsonb_build_object('uploadId',ident,'path',prefix||'pending.'||ext);
end $$;
create function public.discard_finance_upload(p_church_id uuid,p_unit uuid,p_upload_id uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare u public.financial_document_uploads;begin
 if not (private.can_access_finance_unit(p_church_id,p_unit,'finance.transactions.create') or private.can_access_finance_unit(p_church_id,p_unit,'finance.transactions.update')) then raise exception 'FORBIDDEN' using errcode='42501';end if;
 select * into u from public.financial_document_uploads where church_id=p_church_id and congregation_id=p_unit and id=p_upload_id and created_by=auth.uid() and deleted_at is null for update;
 if u.id is null then raise exception 'FORBIDDEN' using errcode='42501';end if;
 if u.status='LINKED' then raise exception 'CONFLICT';end if;
 update public.financial_document_uploads set status='DISCARDED',updated_at=now() where id=u.id;
 return jsonb_build_object('pendingPath',u.pending_path,'storagePath',u.storage_path);
end $$;
revoke all on function public.prepare_finance_upload(uuid,uuid,text,text,bigint),public.discard_finance_upload(uuid,uuid,uuid) from public,anon;
grant execute on function public.prepare_finance_upload(uuid,uuid,text,text,bigint),public.discard_finance_upload(uuid,uuid,uuid) to authenticated;

create or replace function private.finance_attach_documents(p_church uuid,p_unit uuid,p_ids jsonb,p_transaction uuid) returns void
language plpgsql security definer set search_path='' as $$
declare ident text;u public.financial_document_uploads;begin
 if p_ids is null then return;end if;
 if jsonb_typeof(p_ids)<>'array' or jsonb_array_length(p_ids)>10 then raise exception 'INVALID_INPUT' using errcode='22023';end if;
 if not exists(select 1 from public.financial_transactions where church_id=p_church and congregation_id=p_unit and id=p_transaction and deleted_at is null) then raise exception 'FORBIDDEN' using errcode='42501';end if;
 for ident in select value from jsonb_array_elements_text(p_ids) loop
  select * into u from public.financial_document_uploads where church_id=p_church and congregation_id=p_unit and id=ident::uuid and deleted_at is null for update;
  if u.id is null then raise exception 'FORBIDDEN' using errcode='42501';end if;
  if u.status='LINKED' and u.transaction_id=p_transaction then continue;end if;
  if u.created_by<>auth.uid() or u.status<>'READY' or u.content_hash is null then raise exception 'INACTIVE_REFERENCE';end if;
  insert into public.financial_documents(id,church_id,congregation_id,financial_transaction_id,upload_id,title,file_name,storage_bucket,storage_path,mime_type,file_size,uploaded_by)
  values(u.id,p_church,p_unit,p_transaction,u.id,u.file_name,u.file_name,'financial-documents',u.storage_path,u.mime_type,u.file_size,auth.uid());
  update public.financial_document_uploads set status='LINKED',transaction_id=p_transaction,updated_at=now() where id=u.id;
 end loop;
 update public.financial_transactions set has_attachment=exists(select 1 from public.financial_documents where church_id=p_church and financial_transaction_id=p_transaction and deleted_at is null) where church_id=p_church and id=p_transaction;
end $$;
revoke all on function private.finance_attach_documents(uuid,uuid,jsonb,uuid) from public,anon,authenticated;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('financial-documents','financial-documents',false,10485760,array['application/pdf','image/jpeg','image/png'])
on conflict(id) do update set public=false,file_size_limit=10485760,allowed_mime_types=excluded.allowed_mime_types;
create function private.finance_storage_access(p_path text,p_write boolean) returns boolean
language sql stable security definer set search_path='' as $$
 select (select auth.uid()) is not null and exists(select 1 from public.financial_document_uploads u where u.deleted_at is null and (
 (u.pending_path=p_path and u.status='PENDING' and u.created_by=(select auth.uid()) and u.created_at>now()-interval '2 hours' and (private.can_access_finance_unit(u.church_id,u.congregation_id,'finance.transactions.create') or private.can_access_finance_unit(u.church_id,u.congregation_id,'finance.transactions.update')))
 or (not p_write and u.storage_path=p_path and u.status='LINKED' and private.can_access_finance_unit(u.church_id,u.congregation_id,'finance.view'))));
$$;
revoke all on function private.finance_storage_access(text,boolean) from public,anon;
grant execute on function private.finance_storage_access(text,boolean) to authenticated;
-- Restrictive policies prevent an unrelated broad storage policy from exposing these files.
create policy finance_storage_anon_guard on storage.objects as restrictive for all to anon using(bucket_id<>'financial-documents') with check(bucket_id<>'financial-documents');
create policy finance_storage_read_guard on storage.objects as restrictive for select to authenticated using(bucket_id<>'financial-documents' or private.finance_storage_access(name,false));
create policy finance_storage_insert_guard on storage.objects as restrictive for insert to authenticated with check(bucket_id<>'financial-documents' or private.finance_storage_access(name,true));
create policy finance_storage_update_guard on storage.objects as restrictive for update to authenticated using(bucket_id<>'financial-documents') with check(bucket_id<>'financial-documents');
create policy finance_storage_delete_guard on storage.objects as restrictive for delete to authenticated using(bucket_id<>'financial-documents');
create policy finance_storage_read on storage.objects for select to authenticated using(bucket_id='financial-documents' and private.finance_storage_access(name,false));
create policy finance_storage_pending_insert on storage.objects for insert to authenticated with check(bucket_id='financial-documents' and private.finance_storage_access(name,true));
