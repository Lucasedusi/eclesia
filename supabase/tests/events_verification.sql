-- Verificação pós-migração do módulo de Eventos.
-- Execute em uma sessão administrativa. O script é somente leitura e falha
-- imediatamente quando uma garantia estrutural não estiver presente.
do $$
declare
  v_table text;
  v_policy_count integer;
begin
  foreach v_table in array array[
    'events','event_congregation_quotas','event_city_quotas',
    'event_registration_batches','event_groups','event_items',
    'event_registrations','event_registration_items','event_payments',
    'event_checkins','event_documents'
  ] loop
    if not exists (
      select 1 from pg_class c join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public' and c.relname = v_table and c.relrowsecurity
    ) then
      raise exception 'RLS ausente em public.%', v_table;
    end if;

    select count(*) into v_policy_count
    from pg_policies where schemaname = 'public' and tablename = v_table;
    if v_policy_count < 3 then
      raise exception 'Políticas insuficientes em public.%: %', v_table, v_policy_count;
    end if;

    if has_table_privilege('anon', format('public.%I', v_table), 'select')
       or has_table_privilege('anon', format('public.%I', v_table), 'insert')
       or has_table_privilege('anon', format('public.%I', v_table), 'update')
       or has_table_privilege('anon', format('public.%I', v_table), 'delete') then
      raise exception 'A role anon possui privilégio direto em public.%', v_table;
    end if;
  end loop;

  if not exists (select 1 from storage.buckets where id = 'event-documents' and not public and file_size_limit = 10485760) then
    raise exception 'Bucket privado event-documents ausente ou divergente';
  end if;
  if not exists (select 1 from storage.buckets where id = 'event-public-media' and public and file_size_limit = 5242880) then
    raise exception 'Bucket público event-public-media ausente ou divergente';
  end if;

  if has_function_privilege('anon', 'public.create_event_registration(uuid,jsonb,text)', 'execute')
     or has_function_privilege('anon', 'public.create_event_group(uuid,jsonb,jsonb,text)', 'execute')
     or has_function_privilege('anon', 'public.register_event_checkin(uuid,uuid,text,text,text,text)', 'execute') then
    raise exception 'A role anon não pode executar RPCs transacionais de Eventos';
  end if;

  if not exists (select 1 from pg_indexes where schemaname='public' and indexname='events_tenant_key') then
    raise exception 'Índice de integridade multitenant events_tenant_key ausente';
  end if;
  if not exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='events' and column_name='quota_mode'
      and column_default = '''NONE''::text'
  ) then
    raise exception 'Default de events.quota_mode divergente';
  end if;
  if not exists (
    select 1 from pg_constraint
    where conname='event_payment_valid_v2_check'
      and pg_get_constraintdef(oid) like '%FAILED%'
  ) then
    raise exception 'Status FAILED não está protegido pela constraint de pagamentos';
  end if;
end $$;

select 'events_module_verification_ok' as result;
