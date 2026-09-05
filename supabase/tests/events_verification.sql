-- Verificação pós-migração do módulo de Eventos.
-- Execute em uma sessão administrativa. O script é somente leitura e falha
-- imediatamente quando uma garantia estrutural não estiver presente.
do $$
declare
  v_table text;
  v_policy_count integer;
  v_public_checkout_definition text;
begin
  foreach v_table in array array[
    'events','event_congregation_quotas','event_city_quotas',
    'event_registration_batches','event_groups','event_items',
    'event_registrations','event_registration_items','event_payments',
    'event_checkins','event_documents','event_expenses',
    'event_registration_fields','event_registration_field_values'
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
     or has_function_privilege('anon', 'public.create_event_registration_v3(uuid,jsonb,text)', 'execute')
     or has_function_privilege('anon', 'public.create_event_group(uuid,jsonb,jsonb,text)', 'execute')
     or has_function_privilege('anon', 'public.update_event_registration(uuid,uuid,timestamptz,jsonb)', 'execute')
     or has_function_privilege('anon', 'public.register_event_checkin(uuid,uuid,text,text,text,text)', 'execute') then
    raise exception 'A role anon não pode executar RPCs transacionais de Eventos';
  end if;
  if has_function_privilege('authenticated', 'public.create_event_registration(uuid,jsonb,text)', 'execute')
    or has_function_privilege('authenticated', 'public.create_event_registration_v3_unvalidated(uuid,jsonb,text)', 'execute')
    or has_function_privilege('service_role', 'public.create_event_registration_v3_unvalidated(uuid,jsonb,text)', 'execute') then
    raise exception 'RPC antiga ou não validada permanece exposta';
  end if;

  if not exists (select 1 from pg_indexes where schemaname='public' and indexname='events_tenant_key') then
    raise exception 'Índice de integridade multitenant events_tenant_key ausente';
  end if;
  if not exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='events' and column_name='registration_status'
      and column_default = '''CLOSED''::text'
  ) then
    raise exception 'Controle manual events.registration_status ausente ou divergente';
  end if;
  select pg_get_functiondef(procedure.oid) into v_public_checkout_definition
  from pg_proc procedure
  join pg_namespace namespace on namespace.oid = procedure.pronamespace
  where namespace.nspname = 'public'
    and procedure.proname = 'start_event_public_checkout'
    and pg_get_function_identity_arguments(procedure.oid) =
      'p_event_id uuid, p_payload jsonb, p_idempotency_key text, p_access_token_hash text';
  if v_public_checkout_definition is null
    or position('public.create_event_registration_v3(p_event_id, p_payload, p_idempotency_key)'
      in v_public_checkout_definition) = 0
    or position('public.create_event_registration(p_event_id, p_payload, p_idempotency_key)'
      in v_public_checkout_definition) > 0 then
    raise exception 'Checkout público ainda utiliza o fluxo legado de inscrições';
  end if;
  if has_function_privilege('anon', 'public.start_event_public_checkout(uuid,jsonb,text,text)', 'execute')
    or has_function_privilege('authenticated', 'public.start_event_public_checkout(uuid,jsonb,text,text)', 'execute')
    or not has_function_privilege('service_role', 'public.start_event_public_checkout(uuid,jsonb,text,text)', 'execute') then
    raise exception 'Privilégios do checkout público estão divergentes';
  end if;
  if not exists (
    select 1 from public.permissions
    where key in ('events.expenses.view','events.expenses.manage') and status='ACTIVE' and deleted_at is null
    having count(*) = 2
  ) then
    raise exception 'Permissões da aba Despesas ausentes';
  end if;
  if not has_function_privilege('authenticated', 'public.update_event_registration(uuid,uuid,timestamptz,jsonb)', 'execute') then
    raise exception 'Edição transacional de inscrição indisponível para usuários autenticados';
  end if;
  if not exists (
    select 1 from pg_trigger
    where tgrelid='public.event_registration_fields'::regclass
      and tgname='protect_event_registration_field_identity' and not tgisinternal
  ) or not exists (
    select 1 from pg_trigger
    where tgrelid='public.event_expenses'::regclass
      and tgname='protect_event_expense_identity' and not tgisinternal
  ) then
    raise exception 'Proteções de integridade dos novos registros ausentes';
  end if;
  if not exists (
    select 1 from pg_trigger
    where tgrelid='public.event_registration_field_values'::regclass
      and tgname='validate_event_custom_field_value' and not tgisinternal
  ) then
    raise exception 'Validação de respostas personalizadas ausente';
  end if;
  if not exists (
    select 1 from pg_constraint
    where conname in (
      'event_expenses_event_tenant_fkey',
      'event_registration_fields_event_tenant_fkey',
      'event_registration_field_values_registration_tenant_fkey',
      'event_registration_field_values_field_tenant_fkey'
    )
    having count(*) = 4
  ) then
    raise exception 'Chaves de isolamento composto das novas tabelas ausentes';
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
