begin;

create or replace function private.audit_event_domain_change()
returns trigger
language plpgsql
security definer
set search_path=''
as $$
declare v_new jsonb:=case when tg_op='DELETE' then null else to_jsonb(new) end;
  v_old jsonb:=case when tg_op='INSERT' then null else to_jsonb(old) end;
  v_church_id uuid:=coalesce((v_new->>'church_id')::uuid,(v_old->>'church_id')::uuid);
  v_id uuid:=coalesce((v_new->>'id')::uuid,(v_old->>'id')::uuid);
  v_event_id uuid:=coalesce((v_new->>'event_id')::uuid,(v_old->>'event_id')::uuid,v_id);
  v_action text:=case when tg_op='INSERT' then 'CREATE' when tg_op='DELETE' then 'DELETE' else 'UPDATE' end;
  v_old_safe jsonb; v_new_safe jsonb;
begin
  if tg_table_name='events' then
    v_old_safe:=case when v_old is null then null else jsonb_build_object('status',v_old->>'status','starts_at',v_old->>'starts_at','capacity',v_old->'capacity','visibility',v_old->>'visibility','scope',v_old->>'event_scope') end;
    v_new_safe:=case when v_new is null then null else jsonb_build_object('status',v_new->>'status','starts_at',v_new->>'starts_at','capacity',v_new->'capacity','visibility',v_new->>'visibility','scope',v_new->>'event_scope') end;
  elsif tg_table_name='event_payments' then
    v_old_safe:=case when v_old is null then null else jsonb_build_object('status',v_old->>'payment_status','amount',v_old->'amount','method',v_old->>'payment_method') end;
    v_new_safe:=case when v_new is null then null else jsonb_build_object('status',v_new->>'payment_status','amount',v_new->'amount','method',v_new->>'payment_method') end;
  elsif tg_table_name='event_checkins' then
    v_old_safe:=case when v_old is null then null else jsonb_build_object('status',v_old->>'status','method',v_old->>'checkin_method') end;
    v_new_safe:=case when v_new is null then null else jsonb_build_object('status',v_new->>'status','method',v_new->>'checkin_method') end;
  elsif tg_table_name='event_documents' then
    v_old_safe:=case when v_old is null then null else jsonb_build_object('status',v_old->>'status','upload_status',v_old->>'upload_status','type',v_old->>'document_type','sensitive',v_old->'is_sensitive') end;
    v_new_safe:=case when v_new is null then null else jsonb_build_object('status',v_new->>'status','upload_status',v_new->>'upload_status','type',v_new->>'document_type','sensitive',v_new->'is_sensitive') end;
  elsif tg_table_name='event_groups' then
    v_old_safe:=case when v_old is null then null else jsonb_build_object('status',v_old->>'status','total',v_old->'total_registrations') end;
    v_new_safe:=case when v_new is null then null else jsonb_build_object('status',v_new->>'status','total',v_new->'total_registrations') end;
  else
    v_old_safe:=case when v_old is null then null else v_old - array['notes','metadata','created_by','updated_by','deleted_by'] end;
    v_new_safe:=case when v_new is null then null else v_new - array['notes','metadata','created_by','updated_by','deleted_by'] end;
  end if;
  if tg_op='UPDATE' and v_old_safe=v_new_safe then return null; end if;
  perform public.log_audit(v_church_id,'EVENTS',v_action,upper(tg_table_name),v_id,null,
    'Alteração no domínio de eventos',v_old_safe,v_new_safe,
    jsonb_build_object('event_id',v_event_id),'INFO');
  return null;
end;
$$;

do $$ declare v_table text;
begin
  foreach v_table in array array['events','event_groups','event_items','event_registration_batches',
    'event_congregation_quotas','event_city_quotas','event_payments','event_checkins','event_documents']
  loop
    execute format('drop trigger if exists audit_%I_domain_change on public.%I',v_table,v_table);
    execute format('create trigger audit_%I_domain_change after insert or update or delete on public.%I for each row execute function private.audit_event_domain_change()',v_table,v_table);
  end loop;
end $$;

commit;
