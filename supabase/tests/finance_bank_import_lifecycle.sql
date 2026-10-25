-- Run only against a local/development database. Everything rolls back.
begin;
set local statement_timeout='30s';
\ir finance_fixture.sql
create function pg_temp.assert_true(value boolean, message text) returns void language plpgsql as $$
begin if value is distinct from true then raise exception '%',message; end if; end $$;
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000001',true);
set local role authenticated;
do $$
declare
 c uuid:='20000000-0000-4000-8000-000000000001'; u uuid:='30000000-0000-4000-8000-000000000001';
 method uuid; dep uuid; cat uuid; box uuid; other_box uuid; b uuid; b2 uuid; item uuid; item2 uuid; item3 uuid;
 d jsonb; r jsonb; result jsonb; command jsonb; key uuid; tx uuid; transfer uuid; workspace jsonb; linked uuid; att uuid; started timestamptz;
begin
 method:=(public.save_finance_catalog(c,jsonb_build_object('entity','PAYMENT_METHOD','congregationId',u,'name','Pix teste','kind','PIX'))->>'id')::uuid;
 dep:=(public.save_finance_catalog(c,jsonb_build_object('entity','DEPARTMENT','congregationId',u,'name','Tesouraria importação','effectiveMonth','2026-01','participatesInBase',true,'reason','Configuração inicial fictícia'))->>'id')::uuid;
 cat:=(public.save_finance_catalog(c,jsonb_build_object('entity','CATEGORY','congregationId',u,'name','Oferta importação','direction','BOTH','departmentId',dep))->>'id')::uuid;
 box:=(public.save_finance_catalog(c,jsonb_build_object('entity','CASHBOX','congregationId',u,'name','Banco importação','kind','BANK_ACCOUNT','openingDate','2026-01-01','openingCents',0,'paymentMethodIds',jsonb_build_array(method)))->>'id')::uuid;
 other_box:=(public.save_finance_catalog(c,jsonb_build_object('entity','CASHBOX','congregationId',u,'name','Outro banco importação','kind','BANK_ACCOUNT','openingDate','2026-01-01','openingCents',0,'paymentMethodIds',jsonb_build_array(method)))->>'id')::uuid;
 d:=jsonb_build_object('parserVersion','SICOOB_XLSX_V1','reconciliation','UNAVAILABLE','balances','[]'::jsonb,'rows',jsonb_build_array(
   jsonb_build_object('rowNumber',3,'date','2026-10-21','document','PIX','history','PIX RECEBIDO','complement','Pessoa fictícia A','amountCents',10000),
   jsonb_build_object('rowNumber',4,'date','2026-10-21','document','PIX','history','PIX RECEBIDO','complement','Pessoa fictícia B','amountCents',10000),
   jsonb_build_object('rowNumber',5,'date','2026-10-21','document','PIX','history','PIX ENVIADO','complement','Transferência fictícia','amountCents',-5000)));
 r:=public.prepare_finance_bank_import(c,u,box,repeat('a',64),'teste.xlsx',d); b:=(r->>'id')::uuid;
 perform pg_temp.assert_true((select count(*)=0 from public.financial_transactions where church_id=c),'upload must not create transactions');
 perform pg_temp.assert_true((public.prepare_finance_bank_import(c,u,box,repeat('a',64),'teste.xlsx',d)->>'id')::uuid=b,'same file reopens same batch');
 select id into item from public.finance_bank_import_items where batch_id=b and row_number=3;
 select id into item2 from public.finance_bank_import_items where batch_id=b and row_number=4;
 select id into item3 from public.finance_bank_import_items where batch_id=b and row_number=5;

 key:=gen_random_uuid();
 r:=public.manage_finance_bank_import(c,u,b,item,1,key,'DELETE_ITEM');
 perform pg_temp.assert_true((r->>'deleted')::boolean,'item removed');
 perform pg_temp.assert_true((public.manage_finance_bank_import(c,u,b,item,1,key,'DELETE_ITEM')->>'replayed')::boolean,'remove retry idempotent');
 workspace:=public.get_finance_bank_import(c,u,b,'{}');
 perform pg_temp.assert_true((workspace#>>'{counts,total}')::int=2 and (workspace#>>'{counts,pending}')::int=2,'active counts decrease');
 perform pg_temp.assert_true((workspace#>>'{batch,incomeCents}')::bigint=10000,'active totals decrease');
 perform pg_temp.assert_true((private.bank_import_batch_dto(c,b)->>'total')::int=2,'history totals exclude removed items');
 perform pg_temp.assert_true(jsonb_array_length(public.get_finance_bank_import(c,u,b,'{"status":"DELETED"}')->'items')=1,'removed item accessible for recovery');
 perform pg_temp.assert_true((public.prepare_finance_bank_import(c,u,box,repeat('a',64),'teste.xlsx',d)->>'id')::uuid=b,'reupload retains removed line');
 perform pg_temp.assert_true((public.get_finance_bank_import(c,u,b,'{}')#>>'{counts,total}')::int=2,'reupload does not resurrect');
 begin
   perform public.manage_finance_bank_import(c,u,b,item,1,gen_random_uuid(),'RESTORE_ITEM');
   raise exception 'stale revision accepted';
 exception when raise_exception then if sqlerrm<>'BANK_IMPORT_CONFLICT' then raise; end if; end;
 perform public.manage_finance_bank_import(c,u,b,item,2,gen_random_uuid(),'RESTORE_ITEM');
 perform pg_temp.assert_true((public.get_finance_bank_import(c,u,b,'{}')#>>'{counts,total}')::int=3,'restore restores counts');
 perform pg_temp.assert_true((public.get_finance_bank_import(c,u,b,'{"page":99}')->>'page')::int=1,'page clamped');
 command:=jsonb_build_object('kind','RECORD','mode','SINGLE','direction','INCOME','date','2026-10-21','cashboxId',box,'congregationId',u,'paymentMethodId',method,'contributor',jsonb_build_object('kind','COLLECTIVE'),'issueReceipt',true,'items',jsonb_build_array(jsonb_build_object('categoryId',cat,'departmentId',dep,'amountCents',10000)));
 result:=public.finance_bank_import_item(c,u,item,3,gen_random_uuid(),'POST',jsonb_build_object('command',command));
 tx:=(result#>>'{result,transactionIds,0}')::uuid;
 begin
   perform public.manage_finance_bank_import(c,u,b,item,4,gen_random_uuid(),'DELETE_ITEM');
   raise exception 'financial history deleted';
 exception when raise_exception then if sqlerrm<>'BANK_IMPORT_DELETE_BLOCKED' then raise; end if; end;
 begin
   perform public.manage_finance_bank_import(c,u,b,null,null,gen_random_uuid(),'DELETE_BATCH');
   raise exception 'batch with financial history deleted';
 exception when raise_exception then if sqlerrm<>'BANK_IMPORT_DELETE_BLOCKED' then raise; end if; end;
 perform pg_temp.assert_true(not (public.get_finance_bank_import(c,u,b,'{}')#>>'{batch,canDelete}')::boolean,'batch delete disabled');
 perform public.execute_finance_command(c,jsonb_build_object('kind','CANCEL_TRANSACTION','operationKey',gen_random_uuid(),'congregationId',u,'id',tx,'expectedRevision',1,'reason','Cancelamento de teste local'));
 perform public.finance_bank_import_item(c,u,item,4,gen_random_uuid(),'REOPEN','{"reason":"Refazer após cancelamento"}');
 begin
   perform public.manage_finance_bank_import(c,u,b,item,5,gen_random_uuid(),'DELETE_ITEM');
   raise exception 'reopened financial history deleted';
 exception when raise_exception then if sqlerrm<>'BANK_IMPORT_DELETE_BLOCKED' then raise; end if; end;
 -- A previous link is still financial history after unlinking.
 result:=public.execute_finance_command(c,command||jsonb_build_object('operationKey',gen_random_uuid()));
 att:=(result#>>'{transactionIds,0}')::uuid;
 perform public.finance_bank_import_item(c,u,item2,1,gen_random_uuid(),'LINK',jsonb_build_object('targetKind','TRANSACTION','targetId',att));
 perform public.finance_bank_import_item(c,u,item2,2,gen_random_uuid(),'UNLINK','{"reason":"Correção de vínculo local"}');
 begin
   perform public.manage_finance_bank_import(c,u,b,item2,3,gen_random_uuid(),'DELETE_ITEM');
   raise exception 'unlinked history deleted';
 exception when raise_exception then if sqlerrm<>'BANK_IMPORT_DELETE_BLOCKED' then raise; end if; end;
 -- Another scope cannot remove a known batch/item.
 begin
   perform public.manage_finance_bank_import(c,'30000000-0000-4000-8000-000000000002',b,item3,1,gen_random_uuid(),'DELETE_ITEM');
   raise exception 'wrong scope accepted';
 exception when insufficient_privilege then null; end;
 begin
   perform public.manage_finance_bank_import('20000000-0000-4000-8000-000000000002',u,b,item3,1,gen_random_uuid(),'DELETE_ITEM');
   raise exception 'cross church accepted';
 exception when insufficient_privilege then null; end;
 perform set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000003',true);
 begin
   perform public.manage_finance_bank_import(c,u,b,item3,1,gen_random_uuid(),'DELETE_ITEM');
   raise exception 'user without financial permission accepted';
 exception when insufficient_privilege then null; end;
 perform set_config('request.jwt.claim.sub','',true);
 begin
   perform public.manage_finance_bank_import(c,u,b,item3,1,gen_random_uuid(),'DELETE_ITEM');
   raise exception 'missing identity accepted';
 exception when insufficient_privilege then null; end;
 perform set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000001',true);
 -- Empty-financial-history batches can be removed, including their items, with audit.
 r:=public.prepare_finance_bank_import(c,u,box,repeat('d',64),'descartavel.xlsx',d); b2:=(r->>'id')::uuid;
 select id into item2 from public.finance_bank_import_items where batch_id=b2 limit 1;
 key:=gen_random_uuid();
 perform public.manage_finance_bank_import(c,u,b2,null,null,key,'DELETE_BATCH');
 perform pg_temp.assert_true((public.manage_finance_bank_import(c,u,b2,null,null,key,'DELETE_BATCH')->>'replayed')::boolean,'batch retry idempotent');
 perform pg_temp.assert_true(not exists(select 1 from public.finance_bank_import_items where batch_id=b2 and deleted_at is null),'batch removes children');
 perform pg_temp.assert_true(exists(select 1 from public.finance_bank_import_events where item_id=item2 and action='DELETE_BATCH'),'batch audit retained');
 begin
   perform public.manage_finance_bank_import(c,u,b2,item2,2,gen_random_uuid(),'RESTORE_ITEM');
   raise exception 'restored child of removed batch';
 exception when raise_exception then if sqlerrm<>'BANK_IMPORT_STATE' then raise; end if; end;
 perform pg_temp.assert_true((public.prepare_finance_bank_import(c,u,box,repeat('d',64),'descartavel.xlsx',d)->>'id')::uuid<>b2,'removed batch can be imported again');
 -- Removing the only row on page two returns the first page, with current totals.
 d:=jsonb_set(d,'{rows}',(select jsonb_agg(jsonb_build_object('rowNumber',n+2,'date','2026-10-21','document','PIX','history','PIX RECEBIDO','complement','Página local '||n,'amountCents',100)) from generate_series(1,51) n));
 b2:=(public.prepare_finance_bank_import(c,u,box,repeat('e',64),'paginacao.xlsx',d)->>'id')::uuid;
 workspace:=public.get_finance_bank_import(c,u,b2,'{"page":2}');
 perform pg_temp.assert_true(jsonb_array_length(workspace->'items')=1,'last page contains one row');
 perform public.manage_finance_bank_import(c,u,b2,(workspace#>>'{items,0,id}')::uuid,1,gen_random_uuid(),'DELETE_ITEM');
 workspace:=public.get_finance_bank_import(c,u,b2,'{"page":2}');
 perform pg_temp.assert_true((workspace->>'page')::int=1 and jsonb_array_length(workspace->'items')=50,'last row removal clamps page');
 -- History uses the same last-page rule after removing the final batch.
 d:=jsonb_set(d,'{rows}',jsonb_build_array(d#>'{rows,0}'));
 for n in 1..21 loop
   perform public.prepare_finance_bank_import(c,u,other_box,md5(n::text)||md5(n::text),'historico.xlsx',d);
 end loop;
 workspace:=public.list_finance_bank_imports(c,u,other_box,2);
 perform pg_temp.assert_true(jsonb_array_length(workspace->'batches')=1,'history last page contains one batch');
 perform public.manage_finance_bank_import(c,u,(workspace#>>'{batches,0,id}')::uuid,null,null,gen_random_uuid(),'DELETE_BATCH');
 workspace:=public.list_finance_bank_imports(c,u,other_box,2);
 perform pg_temp.assert_true((workspace->>'page')::int=1 and jsonb_array_length(workspace->'batches')=20,'history last batch removal clamps page');
end $$;
reset role;
select pg_temp.assert_true(not has_function_privilege('anon','public.manage_finance_bank_import(uuid,uuid,uuid,uuid,integer,uuid,text)','execute'),'anonymous execution denied');
rollback;
