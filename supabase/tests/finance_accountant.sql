-- Fictional records only. Run against a local database.
begin;
\ir finance_fixture.sql
update public.user_church_access set role='ACCOUNTANT' where id='40000000-0000-4000-8000-000000000002';
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000002',true);
set local role authenticated;
do $$
declare
 church constant uuid := '20000000-0000-4000-8000-000000000001';
 unit constant uuid := '30000000-0000-4000-8000-000000000001';
 hq constant uuid := '30000000-0000-4000-8000-000000000002';
 catalog jsonb := public.finance_accounting_catalog(church);
begin
 assert public.get_my_access_context(church)->'permissions' = '["finance.accounting.export"]'::jsonb;
 assert jsonb_array_length(catalog->'units')=1 and (catalog->'units'->0->>'id')::uuid=unit;
 assert public.finance_accounting_catalog('20000000-0000-4000-8000-000000000002')->'units'='[]'::jsonb;
 assert not private.can_access_finance_unit(church,unit,'finance.view');
 assert not public.can_access_congregation(church,unit);
 assert not exists(select from public.financial_transactions where church_id=church);
 begin
   perform public.preview_finance_accounting(church,jsonb_build_object('unit',hq,'start','2026-10-01','end','2026-10-31','direction','ALL'),1);
   raise exception 'preview outside authorized congregation';
 exception when insufficient_privilege then null; end;
 begin
   perform public.finance_accounting_plan(church);
   raise exception 'accountant accessed accounting configuration';
 exception when insufficient_privilege then null; end;
end $$;
reset role;
do $$
declare
 church constant uuid := '20000000-0000-4000-8000-000000000001';
 hq constant uuid := '30000000-0000-4000-8000-000000000002';
 token text;
begin
 perform set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000001',true);
 execute 'set local role authenticated';
 begin
   perform public.create_church_invitation(church,'Contador Teste','finance-treasurer@example.invalid','ACCOUNTANT','CHURCH');
   raise exception 'accountant invited without a congregation';
 exception when check_violation then null; end;
 token := public.create_church_invitation(church,'Contador Teste','finance-treasurer@example.invalid','ACCOUNTANT','CONGREGATION',null,hq);
 perform set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000002',true);
 perform public.accept_church_invitation(token);
 assert (select count(*) from private.accounting_units(church))=2;
 execute 'reset role';
end $$;
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000001',true);
do $$
declare
 church constant uuid := '20000000-0000-4000-8000-000000000001';
 unit constant uuid := '30000000-0000-4000-8000-000000000001';
 admin constant text := '10000000-0000-4000-8000-000000000001';
 accountant constant text := '10000000-0000-4000-8000-000000000002';
 method uuid; dept uuid; cat uuid; classification uuid; box uuid;
 preview jsonb; batch jsonb; filters jsonb; csv text;
begin
 method := (public.save_finance_catalog(church,jsonb_build_object('entity','PAYMENT_METHOD','congregationId',unit,'name','PIX','kind','PIX'))->>'id')::uuid;
 dept := (public.save_finance_catalog(church,jsonb_build_object('entity','DEPARTMENT','congregationId',unit,'name','Geral','effectiveMonth','2026-10','reason','Teste local','participatesInBase',false))->>'id')::uuid;
 cat := (public.save_finance_catalog(church,jsonb_build_object('entity','CATEGORY','congregationId',unit,'name','Dízimos','direction','INCOME','isTithe',true))->>'id')::uuid;
 classification := (public.save_finance_catalog(church,jsonb_build_object('entity','CLASSIFICATION','congregationId',unit,'name','Jovens'))->>'id')::uuid;
 box := (public.save_finance_catalog(church,jsonb_build_object('entity','CASHBOX','kind','BANK_ACCOUNT','congregationId',unit,'name','Banco fictício','agency','0001','accountNumber','123-4','openingDate','2026-10-01','openingCents',0,'paymentMethodIds',jsonb_build_array(method)))->>'id')::uuid;
 perform public.set_finance_accounting_code(church,'CATEGORY',cat,'1415',null);
 perform public.set_finance_accounting_code(church,'CASHBOX',box,'2124',null);
 perform public.execute_finance_command(church,jsonb_build_object('kind','RECORD','congregationId',unit,'operationKey',gen_random_uuid(),'mode','SINGLE','direction','INCOME','date','2026-10-02','cashboxId',box,'paymentMethodId',method,'contributor',jsonb_build_object('kind','UNREGISTERED','name','Maria Fictícia'),'items',jsonb_build_array(jsonb_build_object('categoryId',cat,'departmentId',dept,'amountCents',87600,'description','referente a outubro','titheClassificationId',classification,'documentNumber','DOC-1'))));
 perform set_config('request.jwt.claim.sub',accountant,true);
 execute 'set local role authenticated';
 filters := jsonb_build_object('unit',unit,'box',box,'start','2026-10-01','end','2026-10-31','direction','ALL');
 preview := public.preview_finance_accounting(church,filters,1);
 assert preview#>>'{rows,0,classification}'='Jovens';
 assert public.finance_accounting_catalog(church)#>>'{boxes,0,agency}'='0001' and public.finance_accounting_catalog(church)#>>'{boxes,0,account}'='123-4';
 batch := public.generate_finance_accounting(church,filters,preview->>'fingerprint',false);
 csv := convert_from(decode(batch->>'file','base64'),'WIN1252');
 assert strpos(csv,';2124;1415;2026-10-02;876,00;;Dízimo de Maria Fictícia — referente a outubro;;;DOC-1')>0;
 assert not exists(select from public.financial_transactions where church_id=church);
 perform public.confirm_finance_accounting_import(church,(batch->>'id')::uuid);
 assert public.finance_accounting_history(church,unit,box,1)#>>'{items,0,confirmed}' is not null;
 begin
   perform public.set_finance_accounting_code(church,'CASHBOX',box,'999','2124');
   raise exception 'accountant edited the bank mapping';
 exception when insufficient_privilege then null; end;
 execute 'reset role';
 perform set_config('request.jwt.claim.sub',admin,true);
 update public.user_church_access set status='INACTIVE' where profile_id=accountant::uuid and congregation_id=unit;
 perform set_config('request.jwt.claim.sub',accountant,true);
 execute 'set local role authenticated';
 assert public.finance_accounting_history(church,null,null,1)->>'total'='0';
 begin
   perform public.confirm_finance_accounting_import(church,(batch->>'id')::uuid);
   raise exception 'import confirmed after access revoked';
 exception when insufficient_privilege then null; end;
 execute 'reset role';
end $$;

do $$ begin
 assert private.accounting_memo(true,'Maria','Dízimos','Dízimos')='Dízimo de Maria';
 assert private.accounting_memo(true,'Maria','Dízimo de Maria','Dízimos')='Dízimo de Maria';
 assert private.accounting_memo(true,null,'Coleta coletiva','Dízimos')='Coleta coletiva';
 assert private.accounting_memo(false,'Maria',null,'Oferta')='Oferta';
end $$;
rollback;
