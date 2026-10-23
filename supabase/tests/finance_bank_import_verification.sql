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
 r:=public.finance_bank_import_item(c,u,item,1,key,'SAVE_DRAFT','{"state":{"categoryId":""},"extra":[]}'::jsonb);
 perform pg_temp.assert_true((r->>'revision')::int=2,'draft revision advances');
 perform pg_temp.assert_true((public.finance_bank_import_item(c,u,item,1,key,'SAVE_DRAFT','{"state":{"categoryId":""},"extra":[]}'::jsonb)->>'replayed')::boolean,'draft retry is idempotent');
 begin
   perform public.finance_bank_import_item(c,u,item,1,gen_random_uuid(),'IGNORE','{"reason":"Teste de conflito"}');
   raise exception 'stale revision accepted';
 exception when raise_exception then if sqlerrm<>'BANK_IMPORT_CONFLICT' then raise; end if; end;
 command:=jsonb_build_object('kind','RECORD','mode','SINGLE','direction','INCOME','date','2026-10-21','cashboxId',box,'congregationId',u,'paymentMethodId',method,'contributor',jsonb_build_object('kind','COLLECTIVE'),'issueReceipt',true,'items',jsonb_build_array(jsonb_build_object('categoryId',cat,'departmentId',dep,'amountCents',10000)));
 begin
   perform public.finance_bank_import_item(c,u,item,2,gen_random_uuid(),'POST',jsonb_build_object('command',command||jsonb_build_object('cashboxId',other_box)));
   raise exception 'changed source accepted';
 exception when raise_exception then if sqlerrm<>'BANK_IMPORT_SOURCE_MISMATCH' then raise; end if; end;
 key:=gen_random_uuid(); result:=public.finance_bank_import_item(c,u,item,2,key,'POST',jsonb_build_object('command',command));
 tx:=(result#>>'{result,transactionIds,0}')::uuid;
 perform pg_temp.assert_true(tx is not null,'posting returns transaction');
 perform pg_temp.assert_true((select current_balance=100 from public.financial_cashboxes where id=box),'one posting changes balance once');
 perform public.finance_bank_import_item(c,u,item,2,key,'POST',jsonb_build_object('command',command));
 perform pg_temp.assert_true((select current_balance=100 from public.financial_cashboxes where id=box),'retry does not change balance');
 perform pg_temp.assert_true((select source_type='IMPORT' from public.financial_transactions where id=tx),'source marked import');
 perform pg_temp.assert_true((select new_values->>'source_type'='IMPORT' from public.financial_transaction_revisions where transaction_id=tx and revision=1),'immutable audit includes import origin');
 begin
   perform public.finance_bank_import_item(c,u,item,3,gen_random_uuid(),'IGNORE','{"reason":"Não esconder dinheiro"}');
   raise exception 'posted item ignored';
 exception when raise_exception then if sqlerrm<>'BANK_IMPORT_STATE' then raise; end if; end;
 -- Same document/date/value, different complement is not a strong duplicate.
 perform public.finance_bank_import_item(c,u,item2,1,gen_random_uuid(),'POST',jsonb_build_object('command',command));
 perform pg_temp.assert_true((select current_balance=200 from public.financial_cashboxes where id=box),'legitimate repeated values remain separate');
 r:=public.prepare_finance_bank_import(c,u,box,repeat('b',64),'sobreposto.xlsx',d); b2:=(r->>'id')::uuid;
 select id into item2 from public.finance_bank_import_items where batch_id=b2 and row_number=3;
 begin
   perform public.finance_bank_import_item(c,u,item2,1,gen_random_uuid(),'POST',jsonb_build_object('command',command));
   raise exception 'strong duplicate accepted without decision';
 exception when raise_exception then if sqlerrm<>'BANK_IMPORT_DUPLICATE_REVIEW' then raise; end if; end;
 perform public.finance_bank_import_item(c,u,item2,1,gen_random_uuid(),'DUPLICATE',jsonb_build_object('targetId',item,'reason','Mesmo movimento em outro extrato'));
 perform pg_temp.assert_true((select current_balance=200 from public.financial_cashboxes where id=box),'duplicate alias creates no money');
 -- Ignore/reopen preserves the line.
 select id into item2 from public.finance_bank_import_items where batch_id=b2 and row_number=4;
 perform public.finance_bank_import_item(c,u,item2,1,gen_random_uuid(),'IGNORE','{"reason":"Conferência fora deste lote"}');
 perform public.finance_bank_import_item(c,u,item2,2,gen_random_uuid(),'RESTORE','{"reason":"Retomar conferência do item"}');
 perform pg_temp.assert_true((select status='PENDING' and revision=3 from public.finance_bank_import_items where id=item2),'restore preserves identity');
 -- Transfer points must affect both accounts atomically.
 result:=public.finance_bank_import_item(c,u,item3,1,gen_random_uuid(),'POST',jsonb_build_object('duplicateReason','Movimento distinto conferido','command',jsonb_build_object('kind','TRANSFER','date','2026-10-21','sourceCashboxId',box,'targetCashboxId',other_box,'amountCents',5000)));
 transfer:=(result#>>'{result,transferId}')::uuid;
 perform pg_temp.assert_true((select current_balance=150 from public.financial_cashboxes where id=box),'transfer debits statement account');
 perform pg_temp.assert_true((select current_balance=50 from public.financial_cashboxes where id=other_box),'transfer credits other account');
 -- The opposite bank statement links the same transfer, without moving money again.
 r:=public.prepare_finance_bank_import(c,u,other_box,repeat('c',64),'outra-conta.xlsx',jsonb_set(d,'{rows}',jsonb_build_array(jsonb_build_object('rowNumber',3,'date','2026-10-21','document','TRF','history','TRANSFERÊNCIA','complement','Outra ponta fictícia','amountCents',5000))));
 select id into linked from public.finance_bank_import_items where batch_id=(r->>'id')::uuid;
 perform pg_temp.assert_true(jsonb_array_length(public.finance_bank_import_candidates(c,u,linked,''))>0,'transfer candidate available');
 perform public.finance_bank_import_item(c,u,linked,1,gen_random_uuid(),'LINK',jsonb_build_object('targetKind','TRANSFER','targetId',transfer));
 perform pg_temp.assert_true((select current_balance=50 from public.financial_cashboxes where id=other_box),'linking opposite side does not create money');
 -- Manual transactions can be associated exactly once; unlinking does not cancel money.
 result:=public.execute_finance_command(c,command||jsonb_build_object('operationKey',gen_random_uuid()));
 att:=(result#>>'{transactionIds,0}')::uuid;
 perform public.finance_bank_import_item(c,u,item2,3,gen_random_uuid(),'LINK',jsonb_build_object('targetKind','TRANSACTION','targetId',att,'duplicateReason','Movimento distinto conferido'));
 perform pg_temp.assert_true((select source_type='MANUAL' from public.financial_transactions where id=att),'manual origin retained');
 perform public.finance_bank_import_item(c,u,item2,4,gen_random_uuid(),'UNLINK','{"reason":"Associação corrigida no teste"}');
 perform pg_temp.assert_true((select status='CONFIRMED' from public.financial_transactions where id=att),'unlink does not cancel');
 -- Complete attendance must match the bank total. A partial item cannot be linked.
 result:=public.execute_finance_command(c,command||jsonb_build_object('operationKey',gen_random_uuid(),'mode','ATTENDANCE','items',jsonb_build_array(jsonb_build_object('categoryId',cat,'departmentId',dep,'amountCents',4000),jsonb_build_object('categoryId',cat,'departmentId',dep,'amountCents',6000))));
 att:=(result->>'attendanceId')::uuid;
 perform public.finance_bank_import_item(c,u,item2,5,gen_random_uuid(),'LINK',jsonb_build_object('targetKind','ATTENDANCE','targetId',att,'duplicateReason','Outro movimento distinto conferido'));
 perform pg_temp.assert_true((select count(*)=2 from public.finance_bank_import_links where item_id=item2 and deleted_at is null),'attendance linked in full');
 perform pg_temp.assert_true(jsonb_typeof(public.list_finance_bank_imports(c,u,null,1)->'batches')='array','batch history available');
 -- Cancelled linked transaction becomes stale and can be explicitly reopened.
 perform public.execute_finance_command(c,jsonb_build_object('kind','CANCEL_TRANSACTION','operationKey',gen_random_uuid(),'congregationId',u,'id',tx,'expectedRevision',1,'reason','Teste de cancelamento posterior'));
 workspace:=public.get_finance_bank_import(c,u,b,'{"status":"ALL"}');
 perform pg_temp.assert_true((select (x->>'stale')::boolean from jsonb_array_elements(workspace->'items') x where x->>'id'=item::text),'cancellation is visible');
 perform pg_temp.assert_true((workspace#>>'{batch,pending}')::int=1,'batch summary counts a cancelled link as pending');
 perform public.finance_bank_import_item(c,u,item,3,gen_random_uuid(),'REOPEN','{"reason":"Refazer após cancelamento"}');
 perform pg_temp.assert_true((select status='PENDING' from public.finance_bank_import_items where id=item),'cancelled source reopened');
 -- Scope is checked for every entry point, even valid UUIDs from another unit.
 begin perform public.get_finance_bank_import(c,'30000000-0000-4000-8000-000000000002',b,'{}'); raise exception 'cross unit accepted'; exception when insufficient_privilege then null; end;
 perform pg_temp.assert_true(not has_table_privilege('authenticated','public.finance_bank_import_items','UPDATE'),'no direct item update');
 perform pg_temp.assert_true(not has_function_privilege('anon','public.finance_bank_import_item(uuid,uuid,uuid,integer,uuid,text,jsonb)','EXECUTE'),'no anonymous mutation');
 perform pg_temp.assert_true(not has_function_privilege('authenticated','private.execute_finance_command_core(uuid,jsonb,text)','EXECUTE'),'source-aware core is private');
 perform pg_temp.assert_true(not has_table_privilege('authenticated','public.finance_bank_import_operations','SELECT'),'retry payloads are private');
 -- Incompatible totals/dates and unexplained balance differences are never accepted.
 r:=public.prepare_finance_bank_import(c,u,box,repeat('e',64),'saldos-ficticios.xlsx',jsonb_set(jsonb_set(d,'{reconciliation}','"MISMATCH"'),'{rows}',jsonb_build_array(jsonb_build_object('rowNumber',3,'date','2026-10-21','document','CONFERÊNCIA','history','PIX RECEBIDO','complement','Exemplo fictício de saldo divergente','amountCents',10000))));
 select id into linked from public.finance_bank_import_items where church_id=c and batch_id=(r->>'id')::uuid;
 begin perform public.finance_bank_import_item(c,u,linked,1,gen_random_uuid(),'POST',jsonb_build_object('command',command)); raise exception 'unreviewed balance accepted'; exception when raise_exception then if sqlerrm<>'BANK_IMPORT_RECONCILIATION' then raise;end if;end;
 begin perform public.finance_bank_import_item(c,u,linked,1,gen_random_uuid(),'POST',jsonb_build_object('command',command||jsonb_build_object('date','2026-10-22'),'reconciliationReason','Conferência fictícia de saldo')); raise exception 'changed date accepted'; exception when raise_exception then if sqlerrm<>'BANK_IMPORT_SOURCE_MISMATCH' then raise;end if;end;
 begin perform public.finance_bank_import_item(c,u,linked,1,gen_random_uuid(),'POST',jsonb_build_object('command',jsonb_set(command,'{items,0,amountCents}','10001'),'reconciliationReason','Conferência fictícia de saldo')); raise exception 'changed total accepted'; exception when raise_exception then if sqlerrm<>'BANK_IMPORT_SOURCE_MISMATCH' then raise;end if;end;
 perform public.finance_bank_import_item(c,u,linked,1,gen_random_uuid(),'POST',jsonb_build_object('command',command,'reconciliationReason','Conferência fictícia de saldo'));
 perform pg_temp.assert_true((select reconciliation_reason is not null from public.finance_bank_import_batches where church_id=c and id=(r->>'id')::uuid),'balance decision audited');
 begin perform public.get_finance_bank_import('20000000-0000-4000-8000-000000000002',u,b,'{}'); raise exception 'cross church accepted'; exception when insufficient_privilege then null; end;
 -- Bulk reads preserve every source/draft/audit field and live link status.
 for r in select jsonb_build_object('id',id) from public.finance_bank_import_batches where church_id=c loop
  workspace:=public.get_finance_bank_import(c,u,(r->>'id')::uuid,'{"status":"ALL"}');
  perform pg_temp.assert_true(workspace->'items'=(select jsonb_agg(private.bank_import_item_dto(c,id) order by row_number) from public.finance_bank_import_items where church_id=c and batch_id=(r->>'id')::uuid and deleted_at is null),'bulk projection retains source, draft, aliases, audit and health');
 end loop;
 workspace:=public.get_finance_bank_import(c,u,b,'{"status":"COMPLETED","direction":"EXPENSE"}');
 perform pg_temp.assert_true(jsonb_array_length(workspace->'items')=1 and workspace#>>'{items,0,status}'='POSTED' and (workspace#>>'{items,0,stale}')::boolean=false,'expense filter returns the healthy posted transfer');
 workspace:=public.get_finance_bank_import(c,u,b2,'{"status":"PENDING","query":"Pessoa fictícia A"}');
 perform pg_temp.assert_true(jsonb_array_length(workspace->'items')=1 and workspace#>>'{items,0,status}'='DUPLICATE' and (workspace#>>'{items,0,stale}')::boolean=true,'reopened canonical source puts its alias back in pending review');
 perform pg_temp.assert_true((select count(*)=0 from private.bank_import_health_set('20000000-0000-4000-8000-000000000002',array[item])),'health set cannot cross churches');
 perform pg_temp.assert_true(not has_function_privilege('anon','private.bank_import_health_set(uuid,uuid[])','EXECUTE'),'no anonymous bulk health access');
 -- Upper-bound queue test, entirely fictional and rolled back with the suite.
 started:=clock_timestamp();
 select jsonb_agg(jsonb_build_object('rowNumber',n+2,'date','2026-10-22','document','TESTE','history','PIX RECEBIDO','complement','Volume fictício '||n,'amountCents',100)) into r from generate_series(1,5000) n;
 r:=public.prepare_finance_bank_import(c,u,box,repeat('d',64),'volume-ficticio.xlsx',jsonb_set(d,'{rows}',r));
 workspace:=public.get_finance_bank_import(c,u,(r->>'id')::uuid,'{}');
 perform pg_temp.assert_true((workspace#>>'{counts,total}')::int=5000 and jsonb_array_length(workspace->'items')=50 and (workspace->>'pageCount')::int=100,'5000 rows are paginated without truncating source');
 workspace:=public.get_finance_bank_import(c,u,(r->>'id')::uuid,'{"page":2}');
 perform pg_temp.assert_true(jsonb_array_length(workspace->'items')=50 and (workspace#>>'{items,0,rowNumber}')::int=53,'second page preserves row ordering');
 raise notice '5000 fictional rows prepared and paginated in % ms',round(extract(epoch from clock_timestamp()-started)*1000);
 perform set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000003',true);
 perform pg_temp.assert_true((select count(*)=0 from public.finance_bank_import_items where batch_id=b),'RLS hides other unit items');
 perform pg_temp.assert_true((select count(*)=0 from private.bank_import_health_set(c,array[item,item3])),'bulk health respects the caller unit scope');
 begin perform public.finance_bank_import_item(c,u,item,4,gen_random_uuid(),'IGNORE','{"reason":"Outra unidade"}'); raise exception 'cross scope accepted'; exception when insufficient_privilege then null; end;
end $$;
rollback;
