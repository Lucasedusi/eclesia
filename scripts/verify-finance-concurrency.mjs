import assert from "node:assert/strict";
import {randomUUID} from "node:crypto";
import {readFileSync,writeFileSync,mkdirSync} from "node:fs";
import {spawn,execFileSync} from "node:child_process";

// Only the disposable local Supabase database is supported; never uses .env.local.
const url=new URL(process.env.FINANCE_TEST_DATABASE_URL??"postgresql://postgres:postgres@127.0.0.1:54322/postgres");
if(!["127.0.0.1","localhost","[::1]"].includes(url.hostname)) throw new Error("Refusing a non-local database");
const host=JSON.parse(execFileSync("docker",["context","inspect","--format","{{json .Endpoints.docker.Host}}"],{encoding:"utf8"}).trim());
if(!host.startsWith("unix://")) throw new Error("This test requires the local Docker socket");
const db="supabase_db_eclesia";
function sql(source){return new Promise((resolve,reject)=>{
 const proc=spawn("docker",["exec","-i",db,"psql","-X","-qAt","-v","ON_ERROR_STOP=1","-U","postgres","-d","postgres"],{stdio:["pipe","pipe","pipe"]});let out="",err="";
 proc.stdout.on("data",v=>out+=v);proc.stderr.on("data",v=>err+=v);proc.on("error",reject);proc.on("close",code=>code?reject(new Error(err.trim())):resolve(out.trim()));proc.stdin.end(source);
});}
const tag=randomUUID().slice(0,8);
const fixture=readFileSync(new URL("../supabase/tests/finance_fixture.sql",import.meta.url),"utf8").replaceAll("0000-4000-8000",`${tag.slice(0,4)}-4000-${tag.slice(4)}`).replaceAll("@example.invalid",`-${tag}@example.invalid`).replace("where email like 'finance-%",`where email like 'finance-%`);
const suffix=`${tag.slice(0,4)}-4000-${tag.slice(4)}`;
const user=`10000000-${suffix}-000000000001`,church=`20000000-${suffix}-000000000001`,unit=`30000000-${suffix}-000000000001`;
const quote=s=>"'"+s.replaceAll("'","''")+"'";
const auth=`select set_config('request.jwt.claim.sub',${quote(user)},true);`;
const setup=await sql(`begin;${fixture}${auth}
create temporary table test_ids(value jsonb);
do $$ declare m uuid;d uuid;c uuid;b uuid;begin
 m:=(public.save_finance_catalog('${church}','{"entity":"PAYMENT_METHOD","congregationId":"${unit}","name":"Cash ${tag}","kind":"CASH"}')->>'id')::uuid;
 d:=(public.save_finance_catalog('${church}','{"entity":"DEPARTMENT","congregationId":"${unit}","name":"Treasury ${tag}","effectiveMonth":"2026-10","participatesInBase":true}')->>'id')::uuid;
 c:=(public.save_finance_catalog('${church}',jsonb_build_object('entity','CATEGORY','congregationId','${unit}','name','Offering ${tag}','direction','INCOME','departmentId',d))->>'id')::uuid;
 b:=(public.save_finance_catalog('${church}',jsonb_build_object('entity','CASHBOX','congregationId','${unit}','name','Cashbox ${tag}','kind','CASH','openingDate','2026-10-01','openingCents',0,'paymentMethodIds',jsonb_build_array(m)))->>'id')::uuid;
 insert into test_ids values(jsonb_build_object('cashboxId',b,'paymentMethodId',m,'categoryId',c,'departmentId',d));end $$;
select value from test_ids;commit;`);
const refs=JSON.parse(setup.split("\n").find(s=>s.startsWith("{")));
const record={kind:"RECORD",operationKey:randomUUID(),congregationId:unit,mode:"SINGLE",direction:"INCOME",date:"2026-10-01",cashboxId:refs.cashboxId,paymentMethodId:refs.paymentMethodId,contributor:{kind:"COLLECTIVE"},items:[{categoryId:refs.categoryId,departmentId:refs.departmentId,amountCents:15000}],issueReceipt:true,documentIds:[]};
async function command(payload){const result=await sql(`begin;${auth}set local role authenticated;select public.execute_finance_command('${church}',${quote(JSON.stringify(payload))}::jsonb);commit;`);return JSON.parse(result.split("\n").find(s=>s.startsWith("{")));}
const duplicate=await Promise.all([command(record),command(record)]);
assert.equal(duplicate[0].operationId,duplicate[1].operationId);assert.equal(duplicate.filter(r=>r.replayed).length,1);
const correction={kind:"CORRECT_TRANSACTION",operationKey:randomUUID(),congregationId:unit,id:duplicate[0].transactionIds[0],expectedRevision:1,reason:"Concurrent correction",replacement:{direction:"INCOME",date:record.date,cashboxId:refs.cashboxId,paymentMethodId:refs.paymentMethodId,contributor:record.contributor,item:{...record.items[0],amountCents:10000},documentIds:[]}};
const corrections=await Promise.allSettled([command(correction),command({...correction,operationKey:randomUUID()})]);
assert.equal(corrections.filter(r=>r.status==="fulfilled").length,1);assert.ok(corrections.some(r=>r.status==="rejected"&&r.reason.message.includes("CONFLICT")));
const separate=await Promise.all([command({...record,operationKey:randomUUID()}),command({...record,operationKey:randomUUID()})]);assert.notEqual(separate[0].operationId,separate[1].operationId);
const balance=await sql(`select current_balance from public.financial_cashboxes where church_id='${church}' and id='${refs.cashboxId}';`);assert.equal(Number(balance),400);
mkdirSync("tmp",{recursive:true});writeFileSync("tmp/finance-concurrency-fixture.json",JSON.stringify({church,unit,user,...refs}));
console.log("PASS: concurrent retry, stale revision conflict, separate contributions; final balance R$ 400.00. Fictional data retained only in disposable local DB.");
