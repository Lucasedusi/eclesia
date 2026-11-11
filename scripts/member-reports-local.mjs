// Local-only verification with fictional data; sessions and fixture IDs stay in ignored tmp/.
import { execFileSync, spawn } from 'node:child_process';
import { mkdirSync, writeFileSync, readFileSync, existsSync, unlinkSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { createServerClient } from '@supabase/ssr';
const root = 'tmp/member-reports';
mkdirSync(root, { recursive: true });
const status = JSON.parse(execFileSync('npx', ['supabase', 'status', '--output', 'json'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }));
if (!status.API_URL?.startsWith('http://127.0.0.1:')) throw new Error('Local Supabase required');
const env = { ...process.env, NEXT_PUBLIC_SUPABASE_URL: status.API_URL, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: status.PUBLISHABLE_KEY ?? status.ANON_KEY,
  SUPABASE_SECRET_KEY: status.SECRET_KEY ?? status.SERVICE_ROLE_KEY, SUPABASE_SERVICE_ROLE_KEY: status.SERVICE_ROLE_KEY,
  E2E_BASE_URL: 'http://localhost:3222', E2E_STORAGE_STATE: `${root}/full.json`, E2E_MEMBER_REPORT_FIXTURE: `${root}/fixture.json`,
  MERCADO_PAGO_MOCK_MODE: 'true', MERCADO_PAGO_ENV: 'test', MERCADO_PAGO_ACCESS_TOKEN: '', BREVO_API_KEY: '' };
const admin = createClient(status.API_URL, env.SUPABASE_SECRET_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
const sql = (query) => execFileSync('docker', ['exec','-i','supabase_db_eclesia','psql','-X','-v','ON_ERROR_STOP=1','-U','postgres','-d','postgres'], { input: query, stdio: ['pipe','ignore','pipe'] });
const command = process.argv[2];
if (command === 'setup') {
  if (existsSync(`${root}/fixture.json`) && !JSON.parse(readFileSync(`${root}/fixture.json`, 'utf8')).cleanedUp) throw new Error('Fixture already exists; cleanup first');
  const ids = { churches: [randomUUID(),randomUUID()], regions: [randomUUID(),randomUUID()], congregations: [randomUUID(),randomUUID(),randomUUID(),randomUUID()], ministry: randomUUID(), role: randomUUID(), members: Array.from({length:34},randomUUID), users: [], sessions: {}, total: 32 };
  const save = () => writeFileSync(`${root}/fixture.json`, JSON.stringify(ids), { mode: 0o600 }); save();
  const credentials = [];
  for (const name of ['full','limited','region','congregation','ministry','viewer']) {
    const email = `report-${randomUUID()}@example.invalid`, password = `${randomUUID()}Az1!`;
    const result = await admin.auth.admin.createUser({ email, password, email_confirm: true });
    if (result.error) throw new Error(result.error.message);
    const user = { id: result.data.user.id, name, access: randomUUID() }; ids.users.push(user); ids.sessions[name] = `${root}/${name}.json`; credentials.push({ ...user,email,password }); save();
  }
  let query = `begin; insert into public.churches(id,name,city,state,senior_pastor_name,senior_pastor_spouse_name) values ('${ids.churches[0]}','Igreja Fictícia das Listagens','Goiânia','GO','Paulo de Teste','Ana de Teste'),('${ids.churches[1]}','Outra Igreja Fictícia','Goiânia','GO',null,null);`;
  query += `insert into public.regions(id,church_id,name) values ('${ids.regions[0]}','${ids.churches[0]}','Regional de Teste A'),('${ids.regions[1]}','${ids.churches[0]}','Regional de Teste B');`;
  ids.congregations.forEach((id,i) => { query += `insert into public.congregations(id,church_id,region_id,name,is_headquarters) values ('${id}','${ids.churches[i===3?1:0]}',${i===3?'null':`'${ids.regions[i===2?1:0]}'`},'Congregação de Teste ${i+1}',${i===3?'true':'false'});`; });
  query += `insert into public.ministries(id,church_id,name,is_global) values ('${ids.ministry}','${ids.churches[0]}','Ministério de Teste',true); insert into public.roles(id,church_id,name,female_name) values ('${ids.role}','${ids.churches[0]}','Diácono','Diaconisa');`;
  ids.users.forEach((u) => {
    const scope = u.name==='region'?'REGION':u.name==='congregation'?'CONGREGATION':u.name==='ministry'?'MINISTRY':'CHURCH';
    const role = u.name==='full'?'ADMIN':u.name==='ministry'?'MINISTRY_LEADER':u.name==='viewer'?'VIEWER':'SECRETARY';
    query += `insert into public.profiles(id,full_name,status) values ('${u.id}','Usuário Fictício ${u.name}','ACTIVE') on conflict(id) do update set status='ACTIVE'; insert into public.user_church_access(id,profile_id,church_id,role,access_scope,status,region_id,congregation_id,ministry_id,accepted_at) values ('${u.access}','${u.id}','${ids.churches[0]}','${role}','${scope}','ACTIVE',${scope==='REGION'?`'${ids.regions[0]}'`:'null'},${scope==='CONGREGATION'?`'${ids.congregations[0]}'`:'null'},${scope==='MINISTRY'?`'${ids.ministry}'`:'null'},'2020-01-01');`;
    if(u.name!=='viewer') query += `insert into public.user_permission_overrides(access_id,permission_id,effect) select '${u.access}',id,case when '${u.name}'='limited' and key in ('members.view_sensitive_identity','member_roles.view','members.restore') then 'DENY' else 'ALLOW' end from public.permissions where status='ACTIVE' and deleted_at is null and key in ('members.export','members.view_basic','members.view_full','members.view_sensitive_identity','members.restore','member_roles.view','ministries.view','organization.view','church.view');`;
    // A broader second grant makes the explicit selected-scope restriction observable.
    if(u.name==='region') query += `insert into public.user_church_access(profile_id,church_id,role,access_scope,status,accepted_at) values ('${u.id}','${ids.churches[0]}','SECRETARY','CHURCH','ACTIVE','2027-01-01');`;
  });
  ids.members.forEach((id,i) => {
    const c=i===33?3:i<26||i===32?0:i<29?1:2;
    query += `insert into public.members(id,church_id,congregation_id,full_name,member_code,gender,birth_date,nationality,natural_city,natural_state,profession,education_level,whatsapp,address,number,city,state,country,notes,deleted_at) values ('${id}','${ids.churches[i===33?1:0]}','${ids.congregations[c]}','${i===0?'Ana de Teste':i===32?'ARQUIVADO_TESTE':i===33?'OUTRA_IGREJA_TESTE':`Membro de Teste ${String(i+1).padStart(2,'0')}`}','${String(i+1).padStart(5,'0')}','FEMALE','1990-02-10','Brasileira','Goiânia','GO','Professora','Superior completo','11999998888','Rua de Teste','001','Goiânia','GO','Brasil','=1+1',${i===32?"'2026-11-01'":'null'});`;
  });
  query += `insert into public.member_sensitive_identity(member_id,church_id,cpf,rg,issuing_agency) values ('${ids.members[0]}','${ids.churches[0]}','00000000191','RG-TESTE','SSP'); insert into public.member_pastoral_notes(member_id,church_id,notes) values ('${ids.members[0]}','${ids.churches[0]}','SEGREDO_PASTORAL_NUNCA_EXPORTAR'); insert into public.member_roles(church_id,member_id,role_id,status,start_date,title_variant) values ('${ids.churches[0]}','${ids.members[0]}','${ids.role}','ACTIVE','2020-01-01','AUTO');`;
  for (const member of ids.members.slice(0,2)) query += `insert into public.member_ministries(church_id,member_id,ministry_id,status) values ('${ids.churches[0]}','${member}','${ids.ministry}','ACTIVE');`;
  if (process.argv.includes('--birthdays')) {
    const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts();
    const month = Number(today.find(part => part.type === 'month').value);
    const day = Number(today.find(part => part.type === 'day').value);
    const year = Number(today.find(part => part.type === 'year').value);
    const sameWeek = new Date(Date.UTC(year, month - 1, day));
    sameWeek.setUTCDate(day + (sameWeek.getUTCDay() === 0 ? 1 : -1));
    ids.otherBirthdayMonth = (month + 5) % 12 + 1;
    save();
    query += `update public.members set birth_date=make_date(2000,${ids.otherBirthdayMonth},10) where church_id='${ids.churches[0]}';
      update public.members set birth_date=make_date(2000,${month},${day}) where id in ('${ids.members[0]}','${ids.members[1]}','${ids.members[32]}','${ids.members[33]}');
      update public.members set birth_date=make_date(2000,${sameWeek.getUTCMonth() + 1},${sameWeek.getUTCDate()}) where id='${ids.members[6]}';
      update public.members set member_type='CHILD', whatsapp=null where id='${ids.members[1]}';
      update public.members set member_type='VISITOR' where id='${ids.members[2]}';
      update public.members set member_type='CONGREGATED' where id='${ids.members[3]}';
      update public.members set member_status='INACTIVE' where id='${ids.members[4]}';
      update public.members set birth_date=null where id='${ids.members[5]}';`;
  }
  query += 'commit;'; sql(query);
  for (const credential of credentials) {
    const cookies = [];
    const client = createServerClient(status.API_URL,env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,{cookies:{getAll:()=>cookies,setAll:values=>cookies.push(...values)}});
    const login = await client.auth.signInWithPassword({email:credential.email,password:credential.password}); if(login.error) throw new Error(login.error.message);
    writeFileSync(ids.sessions[credential.name],JSON.stringify({cookies:cookies.map(c=>({name:c.name,value:c.value,domain:'localhost',path:'/',expires:-1,httpOnly:false,secure:false,sameSite:'Lax'})),origins:[]}),{mode:0o600});
  }
  console.log('Local fictional report fixtures and six sessions created.');
} else if(command === 'cleanup') {
  const ids=JSON.parse(readFileSync(`${root}/fixture.json`,'utf8'));
  if([...ids.churches,...ids.users.map(u=>u.id)].some(id=>!/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/.test(id))) throw new Error('Invalid fixture IDs');
  for(const church of ids.churches) sql(`begin; delete from public.member_ministries where church_id='${church}'; delete from public.member_roles where church_id='${church}'; delete from public.member_history where church_id='${church}'; delete from public.member_pastoral_notes where church_id='${church}'; delete from public.member_sensitive_identity where church_id='${church}'; delete from public.members where church_id='${church}'; delete from public.user_church_access where church_id='${church}'; delete from public.ministries where church_id='${church}'; delete from public.roles where church_id='${church}'; delete from public.congregations where church_id='${church}'; delete from public.regions where church_id='${church}'; delete from public.app_settings where church_id='${church}'; delete from public.audit_logs where church_id='${church}'; delete from public.churches where id='${church}'; commit;`);
  for(const u of ids.users) { const r=await admin.auth.admin.deleteUser(u.id); if(r.error) throw new Error(r.error.message); }
  for (const name of ['full','limited','region','congregation','ministry','viewer']) { const session = `${root}/${name}.json`; if (existsSync(session)) unlinkSync(session); }
  writeFileSync(`${root}/fixture.json`, JSON.stringify({ ...ids, cleanedUp: true }), { mode: 0o600 });
  console.log('Local fictional report fixtures removed.');
} else {
  const args = command==='build'?['run','build']:command==='start'?['run','start','--','-H','127.0.0.1','-p','3222']:command==='e2e'?['run','test:e2e','--','e2e/member-reports.spec.ts',...process.argv.slice(3)]:null;
  if(!args) throw new Error('Expected setup, build, start, e2e or cleanup');
  const child=spawn('npm',args,{env,stdio:'inherit'}); child.on('exit',code=>process.exitCode=code??1);
}
