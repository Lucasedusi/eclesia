// Local-only harness. Keys, fictional accounts and sessions stay in ignored tmp/.
import { execFileSync, spawn } from "node:child_process";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";
const command = process.argv[2];
mkdirSync("tmp", { recursive: true });
const dockerEnv = {
  ...process.env,
  DOCKER_HOST: "unix:///Users/mac/.colima/eclesia/docker.sock",
};
const status = JSON.parse(
  execFileSync("npx", ["supabase", "status", "--output", "json"], {
    env: dockerEnv,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  }),
);
if (!status.API_URL?.startsWith("http://127.0.0.1:"))
  throw new Error("Local only");
const env = {
  ...dockerEnv,
  NEXT_PUBLIC_SUPABASE_URL: status.API_URL,
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:
    status.PUBLISHABLE_KEY ?? status.ANON_KEY,
  SUPABASE_SECRET_KEY: status.SECRET_KEY ?? status.SERVICE_ROLE_KEY,
  E2E_BASE_URL: "http://127.0.0.1:3217",
  E2E_STORAGE_STATE: "tmp/finance-admin-session.json",
  E2E_FINANCE_FIXTURE: "tmp/finance-e2e-fixture.json",
  MERCADO_PAGO_MOCK_MODE: "true",
};
if (command === "setup") {
  const admin = createClient(
    status.API_URL,
    status.SECRET_KEY ?? status.SERVICE_ROLE_KEY,
  );
  const map = new Map();
  let sql = readFileSync("supabase/tests/finance_fixture.sql", "utf8");
  for (const id of sql.matchAll(/[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}/g))
    map.set(id[0], randomUUID());
  const sessions = {},
    clients = [];
  for (let i = 1; i <= 4; i++) {
    const email = `finance-${randomUUID()}@example.invalid`,
      password = randomUUID() + "Az1!";
    const r = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });
    if (r.error) throw r.error;
    map.set(`10000000-0000-4000-8000-00000000000${i}`, r.data.user.id);
    const cookies = [];
    const client = createServerClient(
      status.API_URL,
      env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
      {
        cookies: {
          getAll: () => cookies,
          setAll: (values) => cookies.push(...values),
        },
      },
    );
    const login = await client.auth.signInWithPassword({ email, password });
    if (login.error) throw login.error;
    clients.push(client);
    const name = ["admin", "treasurer", "secretary", "observer"][i - 1];
    writeFileSync(
      `tmp/finance-${name}-session.json`,
      JSON.stringify({
        cookies: cookies.map((c) => ({
          name: c.name,
          value: c.value,
          domain: "127.0.0.1",
          path: "/",
          expires: -1,
          httpOnly: false,
          secure: false,
          sameSite: "Lax",
        })),
        origins: [],
      }),
    );
    sessions[name] = r.data.user.id;
  }
  sql = sql.replace(/insert into auth.users[\s\S]*?;/, "");
  for (const [from, to] of map) sql = sql.replaceAll(from, to);
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
    { env: dockerEnv, input: sql, stdio: ["pipe", "ignore", "pipe"] },
  );
  const fixture = {
    churchId: map.get("20000000-0000-4000-8000-000000000001"),
    unitId: map.get("30000000-0000-4000-8000-000000000001"),
    headquartersId: map.get("30000000-0000-4000-8000-000000000002"),
    sessions,
  };
  const c = clients[0];
  const rpc = async (name, payload) => {
    const r = await c.rpc(name, payload);
    if (r.error) throw new Error(r.error.message);
    return r.data;
  };
  const catalog = async (entity, values) => {
    const r = await rpc("save_finance_catalog", {
      p_church_id: fixture.churchId,
      p_payload: { entity, congregationId: fixture.unitId, ...values },
    });
    return r.id;
  };
  fixture.cashMethod = await catalog("PAYMENT_METHOD", {
    name: "Dinheiro",
    kind: "CASH",
  });
  fixture.pixMethod = await catalog("PAYMENT_METHOD", {
    name: "Pix",
    kind: "PIX",
  });
  fixture.departmentId = await catalog("DEPARTMENT", {
    name: "Tesouraria",
    participatesInBase: true,
    effectiveMonth: "2026-01",
    reason: "Configuração inicial de teste",
  });
  fixture.missionsId = await catalog("DEPARTMENT", {
    name: "Missões",
    participatesInBase: false,
    effectiveMonth: "2026-01",
    reason: "Configuração inicial de teste",
  });
  fixture.titheId = await catalog("CATEGORY", {
    name: "Dízimo",
    direction: "INCOME",
    departmentId: fixture.departmentId,
    isTithe: true,
  });
  fixture.offeringId = await catalog("CATEGORY", {
    name: "Oferta de culto",
    direction: "INCOME",
    departmentId: fixture.departmentId,
    isOffering: true,
  });
  fixture.missionsOfferingId = await catalog("CATEGORY", {
    name: "Oferta de missões",
    direction: "INCOME",
    departmentId: fixture.missionsId,
    isOffering: true,
  });
  fixture.expenseId = await catalog("CATEGORY", {
    name: "Despesa predial",
    direction: "EXPENSE",
    departmentId: fixture.departmentId,
  });
  fixture.classificationId = await catalog("CLASSIFICATION", {
    name: "Diácono",
  });
  fixture.boxes = {};
  for (const unit of [fixture.unitId, fixture.headquartersId]) {
    fixture.boxes[unit] = {
      cash: await catalog("CASHBOX", {
        congregationId: unit,
        name: "Caixa principal",
        kind: "CASH",
        openingDate: "2026-01-01",
        openingCents: 0,
        paymentMethodIds: [fixture.cashMethod],
      }),
      bank: await catalog("CASHBOX", {
        congregationId: unit,
        name: "Conta bancária",
        kind: "BANK_ACCOUNT",
        openingDate: "2026-01-01",
        openingCents: 0,
        paymentMethodIds: [fixture.pixMethod],
      }),
    };
  }
  const member = await admin
    .from("members")
    .insert({
      church_id: fixture.churchId,
      congregation_id: fixture.headquartersId,
      full_name: "Pessoa Financeiro Teste",
      member_code: "FIN001",
    })
    .select("id")
    .single();
  if (member.error) throw new Error(member.error.message);
  fixture.memberId = member.data.id;
  const grantSQL = `insert into public.user_permission_overrides(access_id,permission_id,effect) select a.id,p.id,'ALLOW' from public.user_church_access a cross join public.permissions p where a.profile_id='${sessions.treasurer}' and a.church_id='${fixture.churchId}' and p.key in ('finance.transactions.update','finance.transactions.cancel','finance.transfers.manage','finance.statements.generate','finance.contributors.lookup') and p.deleted_at is null on conflict do nothing;`;
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
    { env: dockerEnv, input: grantSQL, stdio: ["pipe", "ignore", "pipe"] },
  );
  const rules = [
    {
      name: "Repasse",
      destination: "CATHEDRAL",
      role: "DISTRIBUTION",
      calculation: "ELIGIBLE_INCOME_PERCENT",
      percentage: "30",
    },
    {
      name: "Prebenda",
      destination: "LOCAL_PASTOR",
      role: "GROSS_PREBEND",
      capCents: 100000000,
      calculation: "ELIGIBLE_INCOME_PERCENT",
      percentage: "35",
    },
    {
      name: "Dízimo da prebenda",
      destination: "CATHEDRAL",
      role: "PREBEND_DEDUCTION",
      calculation: "GROSS_PREBEND_PERCENT",
      percentage: "10",
    },
    ...Object.entries({ Sistema: 2500, Seguro: 8600, Contador: 15000 }).map(
      ([name, amountCents]) => ({
        name,
        destination: "CATHEDRAL",
        role: "DISTRIBUTION",
        calculation: "FIXED",
        amountCents,
      }),
    ),
  ];
  for (const unit of [fixture.unitId, fixture.headquartersId])
    await rpc("save_finance_statement_rules", {
      p_church_id: fixture.churchId,
      p_payload: {
        congregationId: unit,
        effectiveMonth: "2026-10",
        items: rules,
      },
    });
  const entry = {
    kind: "RECORD",
    mode: "SINGLE",
    direction: "INCOME",
    congregationId: fixture.headquartersId,
    date: "2026-10-01",
    cashboxId: fixture.boxes[fixture.headquartersId].cash,
    paymentMethodId: fixture.cashMethod,
    contributor: { kind: "COLLECTIVE" },
  };
  for (const [categoryId, departmentId, amountCents] of [
    [fixture.offeringId, fixture.departmentId, 1500000],
    [fixture.missionsOfferingId, fixture.missionsId, 300000],
  ])
    await rpc("execute_finance_command", {
      p_church_id: fixture.churchId,
      p_payload: {
        ...entry,
        operationKey: randomUUID(),
        items: [{ categoryId, departmentId, amountCents }],
      },
    });
  writeFileSync("tmp/finance-e2e-fixture.json", JSON.stringify(fixture));
  console.log("Local financial users and catalogs prepared.");
} else {
  const args =
    command === "dev"
      ? ["run", "dev", "--", "--port", "3217"]
      : command === "e2e"
        ? ["run", "test:e2e", "--", ...process.argv.slice(3)]
        : command === "build"
          ? ["run", "build"]
          : command === "start"
            ? ["run", "start", "--", "--port", "3217"]
            : null;
  if (!args) throw new Error("Unknown command");
  const child = spawn("npm", args, { env, stdio: "inherit" });
  child.on("exit", (code) => process.exit(code ?? 1));
}
