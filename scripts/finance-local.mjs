// Local-only harness. Keys, fictional accounts and sessions stay in ignored tmp/.
import {execFileSync,spawn} from 'node:child_process';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {randomUUID} from 'node:crypto';
import {createClient} from '@supabase/supabase-js';
import {createServerClient} from '@supabase/ssr';
const command=process.argv[2];mkdirSync('tmp',{recursive:true});
const dockerEnv={...process.env,DOCKER_HOST:'unix:///Users/mac/.colima/eclesia/docker.sock'};
const status=JSON.parse(execFileSync('npx',['supabase','status','--output','json'],{env:dockerEnv,encoding:'utf8',stdio:['ignore','pipe','pipe']}));
if(!status.API_URL?.startsWith('http://127.0.0.1:'))throw new Error('Local only');
const env={...dockerEnv,NEXT_PUBLIC_SUPABASE_URL:status.API_URL,NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:status.PUBLISHABLE_KEY??status.ANON_KEY,SUPABASE_SECRET_KEY:status.SECRET_KEY??status.SERVICE_ROLE_KEY,E2E_BASE_URL:'http://127.0.0.1:3217',E2E_STORAGE_STATE:'tmp/finance-admin-session.json',E2E_FINANCE_FIXTURE:'tmp/finance-e2e-fixture.json',MERCADO_PAGO_MOCK_MODE:'true'};
if(command==='setup'){
 const admin=createClient(status.API_URL,status.SECRET_KEY??status.SERVICE_ROLE_KEY);const map=new Map();let sql=readFileSync('supabase/tests/finance_fixture.sql','utf8');
 for(const id of sql.matchAll(/[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}/g))map.set(id[0],randomUUID());
 const sessions={};
 for(let i=1;i<=4;i++){
  const email=`finance-${randomUUID()}@example.invalid`,password=randomUUID()+'Az1!';
  const r=await admin.auth.admin.createUser({email,password,email_confirm:true});if(r.error)throw r.error;
  map.set(`10000000-0000-4000-8000-00000000000${i}`,r.data.user.id);
  const cookies=[];const client=createServerClient(status.API_URL,env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,{cookies:{getAll:()=>[],setAll:values=>cookies.push(...values)}});
  const login=await client.auth.signInWithPassword({email,password});if(login.error)throw login.error;
  const name=['admin','treasurer','secretary','observer'][i-1];
  writeFileSync(`tmp/finance-${name}-session.json`,JSON.stringify({cookies:cookies.map(c=>({name:c.name,value:c.value,domain:'127.0.0.1',path:'/',expires:-1,httpOnly:false,secure:false,sameSite:'Lax'})),origins:[]}));sessions[name]=r.data.user.id;
 }
 sql=sql.replace(/insert into auth.users[\s\S]*?;/,'');for(const [from,to] of map)sql=sql.replaceAll(from,to);
 execFileSync('docker',['exec','-i','supabase_db_eclesia','psql','-X','-v','ON_ERROR_STOP=1','-U','postgres','-d','postgres'],{env:dockerEnv,input:sql,stdio:['pipe','ignore','pipe']});
 const fixture={churchId:map.get('20000000-0000-4000-8000-000000000001'),unitId:map.get('30000000-0000-4000-8000-000000000001'),headquartersId:map.get('30000000-0000-4000-8000-000000000002'),sessions};writeFileSync('tmp/finance-e2e-fixture.json',JSON.stringify(fixture));console.log('Local financial users prepared.');
}else{
 const args=command==='dev'?['run','dev','--','--port','3217']:command==='e2e'?['run','test:e2e','--',...process.argv.slice(3)]:command==='build'?['run','build']:command==='start'?['run','start','--','--port','3217']:null;
 if(!args)throw new Error('Unknown command');const child=spawn('npm',args,{env,stdio:'inherit'});child.on('exit',code=>process.exit(code??1));
}
