-- Run through psql from the repository root. All fixtures roll back.
begin;
-- Local-only fictional data, intended to run inside the caller's transaction.
-- All IDs are reserved for this suite and nothing is committed.
insert into auth.users(id,email) values
 ('10000000-0000-4000-8000-000000000001','finance-admin@example.invalid'),
 ('10000000-0000-4000-8000-000000000002','finance-treasurer@example.invalid'),
 ('10000000-0000-4000-8000-000000000003','finance-secretary@example.invalid'),
 ('10000000-0000-4000-8000-000000000004','finance-observer@example.invalid');
insert into public.profiles(id,full_name,status) select id,'Finance fixture','ACTIVE' from auth.users where id in ('10000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000002','10000000-0000-4000-8000-000000000003','10000000-0000-4000-8000-000000000004') on conflict(id) do update set status='ACTIVE';
insert into public.churches(id,name) values
 ('20000000-0000-4000-8000-000000000001','Finance Field A'),('20000000-0000-4000-8000-000000000002','Finance Field B');
insert into public.regions(id,church_id,name) values
 ('25000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001','Region A');
insert into public.congregations(id,church_id,name,is_headquarters,region_id) values
 ('30000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001','Unit A',false,'25000000-0000-4000-8000-000000000001'),
 ('30000000-0000-4000-8000-000000000002','20000000-0000-4000-8000-000000000001','Headquarters',true,null),
 ('30000000-0000-4000-8000-000000000003','20000000-0000-4000-8000-000000000002','Unit other field',true,null);
insert into public.user_church_access(id,profile_id,church_id,role,access_scope,congregation_id,status) values
 ('40000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001','ADMIN','CHURCH',null,'ACTIVE'),
 ('40000000-0000-4000-8000-000000000002','10000000-0000-4000-8000-000000000002','20000000-0000-4000-8000-000000000001','TREASURER','CONGREGATION','30000000-0000-4000-8000-000000000001','ACTIVE'),
 ('40000000-0000-4000-8000-000000000003','10000000-0000-4000-8000-000000000003','20000000-0000-4000-8000-000000000001','SECRETARY','CONGREGATION','30000000-0000-4000-8000-000000000002','ACTIVE');
insert into public.user_church_access(id,profile_id,church_id,role,access_scope,region_id,status) values
 ('40000000-0000-4000-8000-000000000004','10000000-0000-4000-8000-000000000004','20000000-0000-4000-8000-000000000001','VIEWER','REGION','25000000-0000-4000-8000-000000000001','ACTIVE');
insert into public.user_permission_overrides(access_id,permission_id,effect)
select a.id,p.id,'ALLOW' from public.user_church_access a cross join public.permissions p
where a.id in ('40000000-0000-4000-8000-000000000002','40000000-0000-4000-8000-000000000003','40000000-0000-4000-8000-000000000004')
and p.key in ('finance.view','finance.transactions.create') and p.deleted_at is null;
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000001',true);
set local role authenticated;

create function pg_temp.delivery(c uuid, m text, u uuid) returns jsonb language sql as $$
  select row from jsonb_array_elements(public.list_finance_deliveries_with_transfers(c,m,true)->'rows') row
  where row->>'id'=u::text;
$$;
create function pg_temp.check_delivery(v boolean, label text) returns void language plpgsql as $$
begin
  if v is distinct from true then raise exception '%',label; end if;
end $$;

do $$
declare
  c uuid := '20000000-0000-4000-8000-000000000001';
  u uuid := '30000000-0000-4000-8000-000000000001';
  hq uuid := '30000000-0000-4000-8000-000000000002';
  movement date := (date_trunc('month',current_date)-interval '1 month')::date;
  m text := to_char(movement-interval '1 month','YYYY-MM');
  older text := to_char(movement-interval '2 months','YYYY-MM');
  method uuid; dep uuid; cat uuid; other_cat uuid; box uuid; local_box uuid; first_id uuid; next_id uuid;
  p jsonb; manual jsonb; correction jsonb; r jsonb;
begin
  method := (public.save_finance_catalog(c,jsonb_build_object('entity','PAYMENT_METHOD','congregationId',hq,'name','Dinheiro','kind','CASH'))->>'id')::uuid;
  dep := (public.save_finance_catalog(c,jsonb_build_object('entity','DEPARTMENT','congregationId',hq,'name','Tesouraria','effectiveMonth',older,'participatesInBase',true,'reason','Teste local de entrega'))->>'id')::uuid;
  cat := (public.save_finance_catalog(c,jsonb_build_object('entity','CATEGORY','congregationId',hq,'name','Entrega mensal','direction','BOTH','departmentId',dep,'informativeRole','TRANSFER'))->>'id')::uuid;
  box := (public.save_finance_catalog(c,jsonb_build_object('entity','CASHBOX','congregationId',hq,'name','Caixa','kind','CASH','openingDate',older||'-01','openingCents',0,'paymentMethodIds',jsonb_build_array(method)))->>'id')::uuid;
  p := jsonb_build_object('kind','RECORD','mode','SINGLE','operationKey',gen_random_uuid(),'congregationId',hq,
    'date',movement,'referenceMonth',m,'direction','INCOME','cashboxId',box,'paymentMethodId',method,
    'contributor',jsonb_build_object('kind','CONGREGATION','congregationId',u),
    'items',jsonb_build_array(jsonb_build_object('categoryId',cat,'departmentId',dep,'amountCents',100)));
  other_cat := (public.save_finance_catalog(c,jsonb_build_object('entity','CATEGORY','congregationId',hq,'name','Oferta','direction','INCOME','departmentId',dep))->>'id')::uuid;
  local_box := (public.save_finance_catalog(c,jsonb_build_object('entity','CASHBOX','congregationId',u,'name','Local','kind','CASH','openingDate',older||'-01','openingCents',0,'paymentMethodIds',jsonb_build_array(method)))->>'id')::uuid;
  perform public.execute_finance_command(c,p||jsonb_build_object('operationKey',gen_random_uuid(),'direction','EXPENSE'));
  perform public.execute_finance_command(c,jsonb_set(p,'{items,0,categoryId}',to_jsonb(other_cat))||jsonb_build_object('operationKey',gen_random_uuid()));
  perform public.execute_finance_command(c,p||jsonb_build_object('operationKey',gen_random_uuid(),'congregationId',u,'cashboxId',local_box,
    'contributor',jsonb_build_object('kind','CONGREGATION','congregationId',hq)));
  perform pg_temp.check_delivery(pg_temp.delivery(c,m,u)->>'deliveryDate' is null,'Expenses, other categories and non-Cathedral receipts do not count');
  first_id := (public.execute_finance_command(c,p)#>>'{transactionIds,0}')::uuid;
  perform public.execute_finance_command(c,p);
  r := pg_temp.delivery(c,m,u);
  perform pg_temp.check_delivery(r->>'source'='TRANSFER' and r->>'deliveryDate'=movement::text
    and r#>>'{transfer,id}'=first_id::text and jsonb_array_length(r->'transferHistory')=1,'Repasse and replay');
  next_id := (public.execute_finance_command(c,p||jsonb_build_object('operationKey',gen_random_uuid(),'date',movement+3))#>>'{transactionIds,0}')::uuid;
  perform pg_temp.check_delivery(pg_temp.delivery(c,m,u)#>>'{transfer,id}'=first_id::text,'Earliest movement wins');
  manual := jsonb_build_object('month',m,'congregationId',u,'action','RECEIVE','deliveryDate',movement+5,'expectedRevision',0,'operationKey',gen_random_uuid(),'reason','');
  perform public.record_finance_delivery(c,manual);
  r := pg_temp.delivery(c,m,u);
  perform pg_temp.check_delivery(r->>'source'='MANUAL' and r->>'deliveryDate'=(movement+5)::text,'Manual date takes priority');
  correction := jsonb_build_object('kind','CORRECT_TRANSACTION','operationKey',gen_random_uuid(),'congregationId',hq,
    'id',first_id,'expectedRevision',1,'reason','Conferência da referência',
    'replacement',(p-'kind'-'mode'-'operationKey'-'congregationId'-'items')||jsonb_build_object('referenceMonth',older,'item',p#>'{items,0}'));
  perform public.execute_finance_command(c,correction);
  perform pg_temp.check_delivery(pg_temp.delivery(c,older,u)#>>'{transfer,id}'=first_id::text,'Correction moves source to right report');
  perform public.record_finance_delivery(c,manual||jsonb_build_object('action','UNDO','deliveryDate',null,'reason','Correção administrativa','operationKey',gen_random_uuid(),'expectedRevision',1));
  r := pg_temp.delivery(c,m,u);
  perform pg_temp.check_delivery(r->>'deliveryDate'=(movement+3)::text and r#>>'{transfer,id}'=next_id::text,'Undo restores second eligible repasse');
  perform public.execute_finance_command(c,jsonb_build_object('kind','CANCEL_TRANSACTION','operationKey',gen_random_uuid(),'congregationId',hq,'id',next_id,'expectedRevision',1,'reason','Pagamento cancelado'));
  perform public.execute_finance_command(c,p||jsonb_build_object('operationKey',gen_random_uuid(),'contributor',jsonb_build_object('kind','COLLECTIVE')));
  perform public.execute_finance_command(c,p||jsonb_build_object('operationKey',gen_random_uuid(),'date',(m||'-01')::date));
  r := pg_temp.delivery(c,m,u);
  perform pg_temp.check_delivery(r->>'deliveryDate' is null and jsonb_array_length(r->'transferHistory')=4,'Cancellation, unidentified and open month');
  begin perform public.list_finance_deliveries_with_transfers('20000000-0000-4000-8000-000000000002',m,true);
    raise exception 'Cross-tenant read'; exception when insufficient_privilege then null; end;
end $$;
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000002',true);
do $$ begin
  begin perform public.list_finance_deliveries_with_transfers('20000000-0000-4000-8000-000000000001','2026-10',false);
    raise exception 'Treasurer read'; exception when insufficient_privilege then null; end;
  perform pg_temp.check_delivery(not exists(select from private.finance_delivery_transfer_events),'Treasurer sees no transfer delivery history');
end $$;
reset role;
select pg_temp.check_delivery(not has_function_privilege('anon','public.list_finance_deliveries_with_transfers(uuid,text,boolean)','execute'),'Anonymous read denied');
rollback;
