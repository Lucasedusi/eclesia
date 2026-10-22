begin;
create function pg_temp.assert_true(v boolean,m text) returns void language plpgsql as $$ begin if v is distinct from true then raise exception '%',m; end if; end; $$;
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

insert into public.congregations(id,church_id,name,status,region_id) values
 ('30000000-0000-4000-8000-000000000004','20000000-0000-4000-8000-000000000001','Inactive unit','INACTIVE','25000000-0000-4000-8000-000000000001');
set local role authenticated;
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000001',true);
do $$ declare c uuid:='20000000-0000-4000-8000-000000000001'; u uuid:='30000000-0000-4000-8000-000000000001'; r jsonb; opts jsonb; op uuid:=gen_random_uuid(); m text:=to_char(current_date-interval '2 months','YYYY-MM'); d text:=to_char(date_trunc('month',current_date)-interval '1 month'+interval '7 days','YYYY-MM-DD'); begin
 opts:=jsonb_build_object('type','RANKING','startMonth',m,'endMonth',m,'includePrebend',true,'includeTransfer',true,'includeInactive',false);
 r:=public.get_finance_ranking_report(c,opts);
 perform pg_temp.assert_true(jsonb_array_length(r->'units')=2,'Ranking includes headquarters, excludes inactive and other church');
 r:=public.get_finance_ranking_report(c,opts||'{"includeInactive":true}');
 perform pg_temp.assert_true(jsonb_array_length(r->'units')=3,'Ranking includes inactive on request');
 r:=public.list_finance_deliveries(c,m,false);
 perform pg_temp.assert_true(jsonb_array_length(r->'rows')=1,'Delivery excludes headquarters/inactive');
 perform pg_temp.assert_true(r->>'dueDate'=d,'Default due date is 8th of following month');
 perform pg_temp.assert_true(r#>>'{rows,0,deliveryDate}' is null,'Generating/no statement is not a delivery');
 r:=public.record_finance_delivery(c,jsonb_build_object('congregationId',u,'month',m,'deliveryDate',d,'action','RECEIVE','reason','','expectedRevision',0,'operationKey',op));
 perform pg_temp.assert_true((r->>'revision')::int=1,'Receipt recorded without statement');
 r:=public.record_finance_delivery(c,jsonb_build_object('congregationId',u,'month',m,'deliveryDate',d,'action','RECEIVE','reason','','expectedRevision',0,'operationKey',op));
 perform pg_temp.assert_true((r->>'revision')::int=1,'Same request is idempotent');
 begin
 perform public.record_finance_delivery(c,jsonb_build_object('congregationId',u,'month',m,'deliveryDate',d,'action','RECEIVE','reason','','expectedRevision',0,'operationKey',gen_random_uuid()));
 raise exception 'Stale revision accepted'; exception when raise_exception then if sqlerrm <> 'CONFLICT' then raise; end if; end;
 r:=public.record_finance_delivery(c,jsonb_build_object('congregationId',u,'month',m,'deliveryDate',(d::date+1)::text,'action','CORRECT','reason','Correct date','expectedRevision',1,'operationKey',gen_random_uuid()));
 r:=public.list_finance_deliveries(c,m,true);
 perform pg_temp.assert_true(jsonb_array_length(r->'rows')=2,'Include inactive delivery list');
 perform pg_temp.assert_true(r#>>'{rows,1,deliveryDate}'=(d::date+1)::text,'Civil delivery date corrected');
 perform public.record_finance_delivery(c,jsonb_build_object('congregationId',u,'month',m,'deliveryDate',null,'action','UNDO','reason','Wrong receipt','expectedRevision',2,'operationKey',gen_random_uuid()));
 r:=public.list_finance_deliveries(c,m,false);
 perform pg_temp.assert_true(r#>>'{rows,0,deliveryDate}' is null,'Undo restores pending');
 perform pg_temp.assert_true(jsonb_array_length(r#>'{rows,0,history}')=3,'Immutable receipt/correction/undo history');

 perform pg_temp.assert_true((select count(*)=3 from public.audit_logs where church_id=c and action like 'REPORT_DELIVERY_%'),'Receipt mutations are audited');
 begin
 perform public.record_finance_delivery(c,jsonb_build_object('congregationId',u,'month',m,'deliveryDate',(current_date+1)::text,'action','RECEIVE','reason','','expectedRevision',3,'operationKey',gen_random_uuid()));
 raise exception 'Future date accepted';exception when invalid_parameter_value then null;end;
 begin
 perform public.record_finance_delivery(c,jsonb_build_object('congregationId','30000000-0000-4000-8000-000000000003','month',m,'deliveryDate',d,'action','RECEIVE','reason','','expectedRevision',0,'operationKey',gen_random_uuid()));
 raise exception 'Cross church receipt accepted';exception when insufficient_privilege then null;end;
 begin update public.finance_delivery_events set reason='Tampering' where church_id=c;raise exception 'Direct writes allowed';exception when insufficient_privilege then null;end;
 perform pg_temp.assert_true((select count(*)=0 from public.financial_transactions where church_id=c),'Delivery creates no transactions');
 perform pg_temp.assert_true((select count(*)=0 from public.report_delivery_versions where church_id=c),'Delivery creates no statement');

 perform public.save_finance_delivery_deadline(c,jsonb_build_object('effectiveMonth',to_char(current_date,'YYYY-MM'),'day',31,'expectedRevision',0,'operationKey',gen_random_uuid()));
 perform pg_temp.assert_true(private.finance_delivery_due_date(c,'2096-01-01')='2096-02-29','Leap February deadline clamps to last day');
 perform pg_temp.assert_true(private.finance_delivery_due_date(c,'2097-01-01')='2097-02-28','Common February deadline clamps to last day');
 perform pg_temp.assert_true(private.finance_delivery_due_date(c,'2096-12-01')='2097-01-31','Deadline crosses the year');
 begin perform public.save_finance_delivery_deadline(c,jsonb_build_object('effectiveMonth',m,'day',10,'expectedRevision',1,'operationKey',gen_random_uuid()));raise exception 'Retroactive deadline accepted';exception when invalid_parameter_value then null;end;

 r:=public.list_finance_deliveries(c,m,false);
 perform pg_temp.assert_true(r->>'dueDate'=d,'New deadline preserves historical months');
 begin
 perform public.record_finance_delivery(c,jsonb_build_object('congregationId','30000000-0000-4000-8000-000000000002','month',m,'deliveryDate',d,'action','RECEIVE','reason','','expectedRevision',0,'operationKey',gen_random_uuid()));
 raise exception 'Headquarters accepted'; exception when insufficient_privilege then null; end;
 begin
 perform public.list_finance_deliveries('20000000-0000-4000-8000-000000000002',m,false);
 raise exception 'Other church accepted'; exception when insufficient_privilege then null; end;
end $$;
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000002',true);
do $$ begin
 begin perform public.list_finance_deliveries('20000000-0000-4000-8000-000000000001','2026-09',false); raise exception 'Treasurer accepted'; exception when insufficient_privilege then null; end;
 perform pg_temp.assert_true((select count(*)=0 from public.finance_delivery_events),'Treasurer cannot read receipt history');
 begin perform public.get_finance_ranking_report('20000000-0000-4000-8000-000000000001','{}'); raise exception 'Treasurer ranking accepted'; exception when insufficient_privilege then null; end;
end $$;
reset role;
select pg_temp.assert_true(not has_function_privilege('anon','public.list_finance_deliveries(uuid,text,boolean)','EXECUTE'),'No anonymous execute');
rollback;
