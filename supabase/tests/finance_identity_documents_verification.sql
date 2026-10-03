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

insert into public.members(id,church_id,congregation_id,full_name,member_code) values
 ('50000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000001','Pessoa Homônima','FIN001'),
 ('50000000-0000-4000-8000-000000000002','20000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000002','Pessoa Homônima','FIN002'),
 ('50000000-0000-4000-8000-000000000003','20000000-0000-4000-8000-000000000002','30000000-0000-4000-8000-000000000003','Pessoa Homônima','FIN003');
insert into public.member_sensitive_identity(member_id,church_id,cpf) values('50000000-0000-4000-8000-000000000002','20000000-0000-4000-8000-000000000001','52998224725');
insert into public.member_credential_tokens(church_id,member_id,token_hash,status,pending_expires_at,issued_at,created_by) values('20000000-0000-4000-8000-000000000001','50000000-0000-4000-8000-000000000002',repeat('a',64),'ACTIVE',now()+interval '1 hour',now(),'10000000-0000-4000-8000-000000000001');
insert into public.user_permission_overrides(access_id,permission_id,effect) select '40000000-0000-4000-8000-000000000002',id,'ALLOW' from public.permissions where key='finance.contributors.lookup' and deleted_at is null;
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000002',true);
do $$ declare result jsonb;c uuid:='20000000-0000-4000-8000-000000000001';u uuid:='30000000-0000-4000-8000-000000000001';upload jsonb;begin
 result:=public.lookup_finance_contributors(c,u,'NAME','Pessoa');
 perform pg_temp.assert_true(jsonb_array_length(result)=2,'homonyms from same field distinguished');
 perform pg_temp.assert_true(result#>>'{0,memberCode}' is not null and result#>>'{1,congregationName}' is not null,'minimal disambiguation present');
 perform pg_temp.assert_true(not exists(select 1 from jsonb_array_elements(result) x where x?'cpf' or x?'transactions' or x?'email'),'no sensitive or financial fields returned');
 perform pg_temp.assert_true(jsonb_array_length(public.lookup_finance_contributors(c,u,'CPF','52998224725'))=1,'exact CPF finds another congregation');
 perform pg_temp.assert_true(jsonb_array_length(public.lookup_finance_contributors(c,u,'CREDENTIAL',repeat('a',64)))=1,'active credential accepted');
 perform pg_temp.assert_true(not private.can_access_finance_unit(c,'30000000-0000-4000-8000-000000000002','finance.view'),'identity lookup did not grant finances');
 begin perform public.lookup_finance_contributors('20000000-0000-4000-8000-000000000002','30000000-0000-4000-8000-000000000003','NAME','Pessoa');raise exception 'expected cross tenant denial';exception when insufficient_privilege then null;end;
 upload:=public.prepare_finance_upload(c,u,'test.pdf','application/pdf',8);
 perform pg_temp.assert_true(private.finance_storage_access(upload->>'path',true),'author can upload prepared path');
 perform pg_temp.assert_true(not private.finance_storage_access('other/'||(upload->>'path'),true),'wrong tenant path rejected');
 begin perform public.prepare_finance_upload(c,u,'test.pdf','application/pdf',10485761);raise exception 'expected size rejection';exception when invalid_parameter_value then null;end;
 perform public.discard_finance_upload(c,u,(upload->>'uploadId')::uuid);
 perform pg_temp.assert_true(not private.finance_storage_access(upload->>'path',true),'discarded upload no longer writable');
end $$;
update public.member_credential_tokens set status='REVOKED',revoked_at=now(),revoked_by='10000000-0000-4000-8000-000000000001',revocation_reason='MANUAL' where token_hash=repeat('a',64);
select pg_temp.assert_true(jsonb_array_length(public.lookup_finance_contributors('20000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000001','CREDENTIAL',repeat('a',64)))=0,'revoked credential rejected');
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000003',true);
do $$ begin perform public.lookup_finance_contributors('20000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000002','NAME','Pessoa');raise exception 'expected missing lookup permission';exception when insufficient_privilege then null;end $$;
select pg_temp.assert_true(not has_table_privilege('authenticated','public.financial_document_uploads','UPDATE'),'client cannot mark unverified bytes ready');
select pg_temp.assert_true(not has_function_privilege('anon','public.lookup_finance_contributors(uuid,uuid,text,text)','EXECUTE'),'anonymous identity lookup denied');
select pg_temp.assert_true((select not public from storage.buckets where id='financial-documents'),'private bucket');
rollback;
