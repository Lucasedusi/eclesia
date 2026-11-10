// Extends the existing local-only member harness with fictional history and finances.
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
const status = JSON.parse(
  execFileSync("npx", ["supabase", "status", "--output", "json"], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  }),
);
if (!status.API_URL?.startsWith("http://127.0.0.1:"))
  throw new Error("Local Supabase required");
const ids = JSON.parse(readFileSync("tmp/member-reports/fixture.json", "utf8"));
if (
  ids.cleanedUp ||
  [
    ...ids.churches,
    ...ids.members,
    ...Object.values(ids.financeCategories ?? {}),
  ].some((id) => !/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(id))
)
  throw new Error("Valid, active local fixture required");
const admin = createClient(
  status.API_URL,
  status.SECRET_KEY ?? status.SERVICE_ROLE_KEY,
  { auth: { persistSession: false } },
);
const sql = (query) =>
  execFileSync(
    "docker",
    [
      "exec",
      "-i",
      "supabase_db_eclesia",
      "psql",
      "-X",
      "-v",
      "ON_ERROR_STOP=1",
      "-U",
      "postgres",
      "-d",
      "postgres",
    ],
    { input: query, stdio: ["pipe", "ignore", "pipe"] },
  );
if (process.argv[2] === "setup") {
  const existing = await admin
    .from("financial_transactions")
    .select("id", { count: "exact", head: true })
    .eq("church_id", ids.churches[0]);
  if (existing.error || existing.count)
    throw new Error(
      "Extension already exists or local check failed; cleanup first",
    );
  const old = await admin
    .from("financial_transactions")
    .select("id,financial_categories(name)")
    .limit(1);
  console.log(
    "Original member finance query:",
    old.error?.code ?? "unexpected success",
  );
  if (old.error?.code !== "PGRST201")
    throw new Error("Expected ambiguous category relationship");
  ids.financeCategories = {
    mission: randomUUID(),
    other: randomUUID(),
    foreign: randomUUID(),
  };
  writeFileSync("tmp/member-reports/fixture.json", JSON.stringify(ids), {
    mode: 0o600,
  });
  sql(`begin;
 update public.members set member_type='CONGREGATED' where id='${ids.members[30]}';
 update public.members set member_status='INACTIVE' where id='${ids.members[31]}';
 insert into public.member_history(church_id,member_id,congregation_id,history_type,title,description,old_value,new_value,metadata,event_date) values
 ('${ids.churches[0]}','${ids.members[0]}','${ids.congregations[0]}','ROLE_CHANGED','Cargo alterado','O cargo foi atualizado.','Diaconisa','Missionária','{"old_role_id":"${ids.role}"}',current_date),
 ('${ids.churches[0]}','${ids.members[0]}','${ids.congregations[0]}','MEMBER_RECEIVED','Recebimento atualizado','Recebimento atualizado: BAPTISM',null,'BAPTISM','{}',current_date);
 insert into public.financial_categories(id,church_id,name,category_type,category_group) values
 ('${ids.financeCategories.other}','${ids.churches[0]}','Categoria fictícia do membro','INCOME','TITHE'),
 ('${ids.financeCategories.mission}','${ids.churches[0]}','Ofertas missionárias','INCOME','OFFERING'),
 ('${ids.financeCategories.foreign}','${ids.churches[1]}','Categoria de outra igreja','INCOME','OFFERING');
 insert into public.financial_transactions(church_id,congregation_id,member_id,category_id,transaction_type,description,amount,transaction_date,status,category_name)
 select '${ids.churches[0]}','${ids.congregations[0]}','${ids.members[0]}',id,'INCOME','Lançamento fictício '||i,10,'2026-11-01',case when i=25 then 'CANCELLED' else 'CONFIRMED' end,'Dízimo' from public.financial_categories cross join generate_series(1,25) i where church_id='${ids.churches[0]}' and name='Categoria fictícia do membro';
 update public.financial_transactions set category_id='${ids.financeCategories.mission}',category_name='Ofertas missionárias'
 where church_id='${ids.churches[0]}' and description in (select 'Lançamento fictício '||i from generate_series(1,22) i);
 commit;`);
  console.log(
    "Local finance and history fixtures created (24 confirmed, one cancelled).",
  );
} else if (process.argv[2] === "cleanup") {
  sql(
    `begin;delete from public.financial_transactions where church_id='${ids.churches[0]}';delete from public.financial_categories where church_id in ('${ids.churches[0]}','${ids.churches[1]}') and name in ('Categoria fictícia do membro','Ofertas missionárias','Categoria de outra igreja');commit;`,
  );
  console.log(
    "Local finance extension cleaned; run member-reports cleanup next.",
  );
} else throw new Error("Expected setup or cleanup");
