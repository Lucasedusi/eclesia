begin;
create function pg_temp.assert_true(value boolean,message text) returns void language plpgsql as $$ begin if value is distinct from true then raise exception '%',message; end if; end; $$;
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
do $$ declare
 c uuid:='20000000-0000-4000-8000-000000000001';u uuid:='30000000-0000-4000-8000-000000000001';hq uuid:='30000000-0000-4000-8000-000000000002';
 method uuid;dep uuid;missions uuid;cat uuid;expense_cat uuid;box uuid; rules jsonb;statement jsonb;november jsonb;retry jsonb;key uuid:=gen_random_uuid();ledger_count integer;tx_count integer;command jsonb;entry_result jsonb;
begin
 method:=(public.save_finance_catalog(c,jsonb_build_object('entity','PAYMENT_METHOD','congregationId',u,'name','Dinheiro','kind','CASH'))->>'id')::uuid;
 dep:=(public.save_finance_catalog(c,jsonb_build_object('entity','DEPARTMENT','congregationId',u,'name','Tesouraria','effectiveMonth','2026-10','participatesInBase',true))->>'id')::uuid;
 missions:=(public.save_finance_catalog(c,jsonb_build_object('entity','DEPARTMENT','congregationId',u,'name','Missões','effectiveMonth','2026-10','participatesInBase',false))->>'id')::uuid;
 cat:=(public.save_finance_catalog(c,jsonb_build_object('entity','CATEGORY','congregationId',u,'name','Oferta','direction','INCOME','departmentId',dep))->>'id')::uuid;
 expense_cat:=(public.save_finance_catalog(c,jsonb_build_object('entity','CATEGORY','congregationId',u,'name','Despesa','direction','EXPENSE','departmentId',dep))->>'id')::uuid;
 box:=(public.save_finance_catalog(c,jsonb_build_object('entity','CASHBOX','congregationId',u,'name','Caixa','kind','CASH','openingDate','2026-09-01','openingCents',10000,'paymentMethodIds',jsonb_build_array(method)))->>'id')::uuid;
 command:=jsonb_build_object('kind','RECORD','operationKey',gen_random_uuid(),'congregationId',u,'mode','SINGLE','direction','INCOME','date','2026-10-01','cashboxId',box,'paymentMethodId',method,'contributor',jsonb_build_object('kind','COLLECTIVE'),'items',jsonb_build_array(jsonb_build_object('categoryId',cat,'departmentId',dep,'amountCents',1500000)));
 entry_result:=public.execute_finance_command(c,command);
 perform public.execute_finance_command(c,command||jsonb_build_object('operationKey',gen_random_uuid(),'items',jsonb_build_array(jsonb_build_object('categoryId',cat,'departmentId',missions,'amountCents',300000))));
 perform public.execute_finance_command(c,command||jsonb_build_object('operationKey',gen_random_uuid(),'direction','EXPENSE','items',jsonb_build_array(jsonb_build_object('categoryId',expense_cat,'departmentId',dep,'amountCents',100000))));
 rules:='[
 {"name":"Repasse","destination":"CATHEDRAL","role":"DISTRIBUTION","calculation":"ELIGIBLE_INCOME_PERCENT","percentage":"30"},
 {"name":"Prebenda","destination":"LOCAL_PASTOR","role":"GROSS_PREBEND","capCents":100000000,"calculation":"ELIGIBLE_INCOME_PERCENT","percentage":"35"},
 {"name":"Dízimo da prebenda","destination":"CATHEDRAL","role":"PREBEND_DEDUCTION","calculation":"GROSS_PREBEND_PERCENT","percentage":"10"},
 {"name":"Sistema","destination":"CATHEDRAL","role":"DISTRIBUTION","calculation":"FIXED","amountCents":2500},
 {"name":"Seguro","destination":"CATHEDRAL","role":"DISTRIBUTION","calculation":"FIXED","amountCents":8600},
 {"name":"Contador","destination":"CATHEDRAL","role":"DISTRIBUTION","calculation":"FIXED","amountCents":15000}]'::jsonb;
 begin perform public.generate_finance_statement(c,u,'2026-10',key);raise exception 'expected missing configuration';exception when raise_exception then if sqlerrm<>'CONFIGURATION_REQUIRED' then raise;end if;end;
 perform public.save_finance_statement_rules(c,jsonb_build_object('congregationId',u,'effectiveMonth','2026-10','items',rules));
 select count(*) into ledger_count from public.financial_ledger_entries where church_id=c;select count(*) into tx_count from public.financial_transactions where church_id=c;
 statement:=public.generate_finance_statement(c,u,'2026-10',key);
 perform pg_temp.assert_true((statement->>'totalIncomeCents')::numeric=1800000 and (statement->>'eligibleIncomeCents')::numeric=1500000,'all income visible, eligible departments only');
 perform pg_temp.assert_true((statement->>'grossPrebendCents')::numeric=525000 and (statement->>'prebendDeductionCents')::numeric=52500 and (statement->>'netPastorCents')::numeric=472500,'gross tithe and net correct');
 perform pg_temp.assert_true((statement->>'cathedralTotalCents')::numeric=528600 and (statement->>'distributionTotalCents')::numeric=1001100 and (statement->>'remainderCents')::numeric=498900,'tithe not deducted twice');
 perform pg_temp.assert_true((statement->>'expenseCents')::numeric=100000,'expenses shown separately without reducing gross base');
 perform pg_temp.assert_true((select count(*)=ledger_count from public.financial_ledger_entries where church_id=c) and (select count(*)=tx_count from public.financial_transactions where church_id=c),'statement did not change money');
 retry:=public.generate_finance_statement(c,u,'2026-10',key);perform pg_temp.assert_true(retry->>'id'=statement->>'id','statement retry preserves version');

 -- Simulate a pre-migration rule set: old receipts stay readable/idempotent,
 -- while a NEW statement must wait for an explicitly configured cap.
 insert into public.report_delivery_rule_sets(church_id,congregation_id,effective_month,revision,reason,items,created_by)
 values(c,u,'2026-10-01',2,'Fixture legacy configuration',rules #- '{1,capCents}',auth.uid());
 retry:=public.generate_finance_statement(c,u,'2026-10',key);
 perform pg_temp.assert_true(retry->>'id'=statement->>'id' and retry->>'grossPrebendCents'='525000','legacy retry preserves saved amounts');
 begin
  perform public.generate_finance_statement(c,u,'2026-10',gen_random_uuid());
  raise exception 'legacy rule without cap generated a new statement';
 exception when raise_exception then if sqlerrm<>'PREBEND_CAP_REQUIRED' then raise;end if;end;

 -- Caps are monthly gross limits, BEFORE the tithe. Historical snapshots remain unchanged.
 perform public.save_finance_statement_rules(c,jsonb_build_object('congregationId',u,'effectiveMonth','2026-10','items',jsonb_set(rules,'{1,capCents}','400000'),'retroactiveReason','Definir teto pastoral'));
 retry:=public.generate_finance_statement(c,u,'2026-10',gen_random_uuid());
 perform pg_temp.assert_true((retry->>'grossPrebendCents')::numeric=400000,'gross must respect cap');
 perform pg_temp.assert_true((retry->>'prebendDeductionCents')::numeric=40000 and (retry->>'netPastorCents')::numeric=360000,'tithe uses capped gross');
 perform pg_temp.assert_true((retry->>'cathedralTotalCents')::numeric=516100 and (retry->>'remainderCents')::numeric=623900,'excess stays with congregation');
 perform pg_temp.assert_true(retry#>>'{items,1,uncappedCents}'='525000' and (retry#>>'{items,1,capApplied}')::boolean,'snapshot explains cap');
 perform pg_temp.assert_true((select snapshot->>'grossPrebendCents'='525000' from public.report_delivery_versions where id=(statement->>'id')::uuid),'previous snapshot immutable');
 perform public.save_finance_statement_rules(c,jsonb_build_object('congregationId',u,'effectiveMonth','2026-10','items',jsonb_set(rules,'{1,capCents}','525000'),'retroactiveReason','Teto igual ao percentual'));
 retry:=public.generate_finance_statement(c,u,'2026-10',gen_random_uuid());
 perform pg_temp.assert_true(retry->>'grossPrebendCents'='525000' and not (retry#>>'{items,1,capApplied}')::boolean,'equal limit does not truncate');
 perform public.save_finance_statement_rules(c,jsonb_build_object('congregationId',u,'effectiveMonth','2026-10','items',jsonb_set(rules,'{1,capCents}','0'),'retroactiveReason','Teto zero explícito'));
 retry:=public.generate_finance_statement(c,u,'2026-10',gen_random_uuid());
 perform pg_temp.assert_true(retry->>'grossPrebendCents'='0' and retry->>'prebendDeductionCents'='0','explicit zero cap valid');
 begin
  perform public.save_finance_statement_rules(c,jsonb_build_object('congregationId',u,'effectiveMonth','2026-10','items',rules #- '{1,capCents}','retroactiveReason','Tentativa sem teto'));
  raise exception 'missing cap accepted';
 exception when raise_exception then if sqlerrm<>'PREBEND_CAP_REQUIRED' then raise;end if;end;
 begin
  perform public.save_finance_statement_rules(c,jsonb_build_object('congregationId',u,'effectiveMonth','2026-10','items',jsonb_set(rules,'{1,capCents}','-1'),'retroactiveReason','Tentativa teto inválido'));
  raise exception 'negative cap accepted';
 exception when invalid_parameter_value then null;end;
 perform public.save_finance_statement_rules(c,jsonb_build_object('congregationId',u,'effectiveMonth','2026-10','items',rules,'retroactiveReason','Restaurar configuração de teste'));
 november:=public.generate_finance_statement(c,u,'2026-11',gen_random_uuid());
 perform pg_temp.assert_true((november->>'remainderCents')::numeric=-26100 and (november->>'netPastorCents')::numeric=0,'zero income keeps fixed charges and negative remainder');
 perform public.execute_finance_command(c,command||jsonb_build_object('operationKey',gen_random_uuid(),'date','2026-11-01','items',jsonb_build_array(jsonb_build_object('categoryId',cat,'departmentId',dep,'amountCents',5))));
 perform pg_temp.assert_true((public.get_finance_statement(c,(november->>'id')::uuid)->>'stale')::boolean,'later movement marks old version stale');
 november:=public.generate_finance_statement(c,u,'2026-11',gen_random_uuid());
 perform pg_temp.assert_true((november->>'grossPrebendCents')::numeric=2 and (november->>'prebendDeductionCents')::numeric=0,'round per item, including deduction on rounded gross');
 begin perform public.save_finance_statement_rules(c,jsonb_build_object('congregationId',u,'effectiveMonth','2026-10','items',rules));raise exception 'expected revision reason';exception when invalid_parameter_value then null;end;
 perform public.copy_finance_statement_rules(c,u,hq,'2026-10','Cópia administrativa');
 perform public.save_finance_statement_rules(c,jsonb_build_object('congregationId',u,'effectiveMonth','2026-10','items',jsonb_set(rules,'{0,percentage}','"25"'),'retroactiveReason','Revisão administrativa'));
 perform pg_temp.assert_true((public.get_finance_statement(c,(statement->>'id')::uuid)->>'stale')::boolean,'retroactive rule change marks previous statement stale');
 perform pg_temp.assert_true((select items#>>'{0,percentage}'='30' from public.report_delivery_rule_sets where congregation_id=hq),'copy remains independent');
 perform pg_temp.assert_true((select items#>>'{1,capCents}'='100000000' from public.report_delivery_rule_sets where congregation_id=hq),'copy preserves ceiling');
 perform pg_temp.assert_true((select snapshot->>'cathedralTotalCents'='528600' from public.report_delivery_versions where id=(statement->>'id')::uuid),'historical values unchanged');
 perform public.save_finance_catalog(c,jsonb_build_object('entity','DEPARTMENT','id',missions,'congregationId',u,'name','Missões','effectiveMonth','2026-10','participatesInBase',true,'reason','Alteração administrativa'));
 retry:=public.generate_finance_statement(c,u,'2026-10',gen_random_uuid());perform pg_temp.assert_true((retry->>'eligibleIncomeCents')::numeric=1800000,'department policy changes base only in new version');
end $$;
rollback;
