// Local-only report verification. Fictional accounts, keys and sessions stay in ignored tmp/.
import { execFileSync, spawn } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";

const command = process.argv[2];
const root = "tmp/region-reports";
mkdirSync(root, { recursive: true });
const status = JSON.parse(execFileSync("npx", ["supabase", "status", "--output", "json"], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }));
if (!status.API_URL?.startsWith("http://127.0.0.1:")) throw new Error("This harness only accepts local Supabase.");
const env = {
  ...process.env,
  NEXT_PUBLIC_SUPABASE_URL: status.API_URL,
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: status.PUBLISHABLE_KEY ?? status.ANON_KEY,
  SUPABASE_SECRET_KEY: status.SECRET_KEY ?? status.SERVICE_ROLE_KEY,
  SUPABASE_SERVICE_ROLE_KEY: status.SERVICE_ROLE_KEY,
  E2E_BASE_URL: "http://127.0.0.1:3219",
  E2E_STORAGE_STATE: `${root}/secretary-session.json`,
  E2E_REPORT_REGION_NAME: "Regional São José - Teste de Relatórios",
  E2E_REPORT_FIXTURE: `${root}/fixture.json`,
  MERCADO_PAGO_MOCK_MODE: "true",
};
const sql = (query) => execFileSync("docker", ["exec", "-i", "supabase_db_eclesia", "psql", "-X", "-v", "ON_ERROR_STOP=1", "-U", "postgres", "-d", "postgres"], { input: query, stdio: ["pipe", "ignore", "pipe"] });

if (command === "setup") {
  const admin = createClient(status.API_URL, env.SUPABASE_SECRET_KEY);
  const ids = { church: randomUUID(), otherChurch: randomUUID(), region: randomUUID(), otherRegion: randomUUID(), congregation: randomUUID(), secondCongregation: randomUUID() };
  const users = {};
  for (const [name, role, scope] of [["secretary", "SECRETARY", "CHURCH"], ["regional", "SECRETARY", "REGION"], ["congregation", "SECRETARY", "CONGREGATION"], ["viewer", "VIEWER", "CHURCH"]]) {
    const email = `region-${randomUUID()}@example.invalid`, password = `${randomUUID()}Az1!`;
    const result = await admin.auth.admin.createUser({ email, password, email_confirm: true });
    if (result.error) throw result.error;
    const cookies = [];
    const client = createServerClient(status.API_URL, env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, { cookies: { getAll: () => cookies, setAll: (values) => cookies.push(...values) } });
    const login = await client.auth.signInWithPassword({ email, password });
    if (login.error) throw login.error;
    users[name] = { id: result.data.user.id, role, scope };
    writeFileSync(`${root}/${name}-session.json`, JSON.stringify({ cookies: cookies.map((c) => ({ name: c.name, value: c.value, domain: "127.0.0.1", path: "/", expires: -1, httpOnly: false, secure: false, sameSite: "Lax" })), origins: [] }), { mode: 0o600 });
  }
  sql(`begin;
    insert into public.churches(id, name, phone, city, state) values ('${ids.church}', 'Igreja Fictícia - Relatórios', '1133334444', 'São Paulo', 'SP'), ('${ids.otherChurch}', 'Outra Igreja Fictícia', null, null, null);
    insert into public.regions(id, church_id, name, coordinator_name, coordinator_phone, description) values
      ('${ids.region}', '${ids.church}', '${env.E2E_REPORT_REGION_NAME}', 'Coordenadora de Teste', '11922223333', 'Descrição de teste da regional central.'),
      ('${ids.otherRegion}', '${ids.otherChurch}', 'Regional de outra igreja', 'Não exportar', '11911112222', null);
    insert into public.regions(church_id, name, display_order) select '${ids.church}', 'Regional de Teste ' || i, i from generate_series(1, 24) as i;
    insert into public.congregations(id, church_id, region_id, name, pastor_name, whatsapp, phone, status) values
      ('${ids.congregation}', '${ids.church}', '${ids.region}', 'Congregação Central de Teste', 'Dirigente de Teste', '11999998888', '1133334444', 'ACTIVE'),
      ('${ids.secondCongregation}', '${ids.church}', '${ids.region}', 'Congregação Inativa de Teste', 'Outro Dirigente', null, '1144445555', 'INACTIVE');
    ${Object.values(users).map((u) => `insert into public.profiles(id, full_name, status) values ('${u.id}', 'Usuário de teste regional', 'ACTIVE') on conflict(id) do update set status='ACTIVE';
    insert into public.user_church_access(profile_id, church_id, role, access_scope, region_id, congregation_id, status) values ('${u.id}', '${ids.church}', '${u.role}', '${u.scope}', ${u.scope === "REGION" ? `'${ids.region}'` : "null"}, ${u.scope === "CONGREGATION" ? `'${ids.congregation}'` : "null"}, 'ACTIVE');`).join("\n")}
    commit;`);
  writeFileSync(`${root}/fixture.json`, JSON.stringify({ ...ids, users }), { mode: 0o600 });
  console.log("Fictional local report fixtures and four scoped sessions created.");
} else if (command === "cleanup") {
  const fixture = JSON.parse(readFileSync(`${root}/fixture.json`, "utf8"));
  // Only random IDs created by this harness are accepted for cleanup.
  const allIds = [fixture.church, fixture.otherChurch, ...Object.values(fixture.users).map((u) => u.id)];
  if (allIds.some((id) => !/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/.test(id))) throw new Error("Invalid fixture identifiers");
  sql(`begin;
    delete from public.audit_logs where church_id in ('${fixture.church}', '${fixture.otherChurch}');
    delete from public.user_church_access where church_id in ('${fixture.church}', '${fixture.otherChurch}');
    delete from public.congregations where church_id in ('${fixture.church}', '${fixture.otherChurch}');
    delete from public.regions where church_id in ('${fixture.church}', '${fixture.otherChurch}');
    delete from public.app_settings where church_id in ('${fixture.church}', '${fixture.otherChurch}');
    delete from public.churches where id in ('${fixture.church}', '${fixture.otherChurch}');
    commit;`);
  const admin = createClient(status.API_URL, env.SUPABASE_SECRET_KEY);
  for (const user of Object.values(fixture.users)) { const result = await admin.auth.admin.deleteUser(user.id); if (result.error) throw result.error; }
  console.log("Fictional local report records removed.");
} else {
  const args = command === "build" ? ["run", "build", ...process.argv.slice(3)]
    : command === "start" ? ["run", "start", "--", "-p", "3219"]
    : command === "dev" ? ["run", "dev", "--", "-p", "3219"]
    : command === "e2e" ? ["run", "test:e2e", "--", "e2e/region-reports.spec.ts", ...process.argv.slice(3)] : null;
  if (!args) throw new Error("Expected setup, build, start, dev, e2e or cleanup");
  const child = spawn("npm", args, { env, stdio: "inherit" });
  child.on("exit", (code) => { process.exitCode = code ?? 1; });
}
