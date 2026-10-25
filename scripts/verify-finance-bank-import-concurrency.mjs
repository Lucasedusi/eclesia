// Fictional local fixtures only. Never reads deployment credentials or .env files.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { randomUUID, createHash } from "node:crypto";
import { execFileSync, spawn } from "node:child_process";
const socket = JSON.parse(
  execFileSync(
    "docker",
    ["context", "inspect", "--format", "{{json .Endpoints.docker.Host}}"],
    { encoding: "utf8" },
  ).trim(),
);
assert.ok(socket.startsWith("unix://"), "A local Docker socket is required");
const f = JSON.parse(readFileSync("tmp/finance-e2e-fixture.json", "utf8"));
const quote = (value) => "'" + String(value).replaceAll("'", "''") + "'";
function sql(source) {
  return new Promise((resolve, reject) => {
    const p = spawn(
      "docker",
      [
        "exec",
        "-i",
        "supabase_db_eclesia",
        "psql",
        "-X",
        "-qAt",
        "-v",
        "ON_ERROR_STOP=1",
        "-U",
        "postgres",
        "-d",
        "postgres",
      ],
      { stdio: ["pipe", "pipe", "pipe"] },
    );
    let out = "",
      err = "";
    p.stdout.on("data", (v) => (out += v));
    p.stderr.on("data", (v) => (err += v));
    p.on("error", reject);
    p.on("close", (code) =>
      code ? reject(new Error(err)) : resolve(out.trim()),
    );
    p.stdin.end(source);
  });
}
const actors = JSON.parse(
  await sql(
    `select jsonb_object_agg(a.role,a.profile_id) from public.user_church_access a join auth.users u on u.id=a.profile_id where a.church_id=${quote(f.churchId)} and a.role in ('ADMIN','TREASURER') and u.email like '%@example.invalid';`,
  ),
);
assert.ok(
  actors.ADMIN && actors.TREASURER,
  "Run the local financial setup first",
);
async function asActor(actor, expression) {
  const output = await sql(
    `begin;select set_config('request.jwt.claim.sub',${quote(actor)},true);set local role authenticated;select ${expression};commit;`,
  );
  return JSON.parse(
    output
      .split("\n")
      .find((line) => line.startsWith("{") || line.startsWith("[")),
  );
}
const source = {
  parserVersion: "SICOOB_XLSX_V1",
  reconciliation: "UNAVAILABLE",
  balances: [],
  rows: [
    {
      rowNumber: 3,
      date: "2026-10-22",
      amountCents: 1234,
      document: "PIX",
      history: "PIX RECEBIDO",
      complement: `Concorrência fictícia ${randomUUID()}`,
    },
  ],
};
const prepare = async () =>
  asActor(
    actors.ADMIN,
    `public.prepare_finance_bank_import(${quote(f.churchId)},${quote(f.unitId)},${quote(f.boxes[f.unitId].bank)},${quote(createHash("sha256").update(randomUUID()).digest("hex"))},'concorrencia-ficticia.xlsx',${quote(JSON.stringify(source))}::jsonb)`,
  );
const batch = await prepare();
const item = await sql(
  `select id from public.finance_bank_import_items where church_id=${quote(f.churchId)} and batch_id=${quote(batch.id)};`,
);
const command = {
  kind: "RECORD",
  operationKey: randomUUID(),
  congregationId: f.unitId,
  mode: "SINGLE",
  direction: "INCOME",
  date: source.rows[0].date,
  cashboxId: f.boxes[f.unitId].bank,
  paymentMethodId: f.pixMethod,
  contributor: { kind: "COLLECTIVE" },
  items: [
    {
      categoryId: f.offeringId,
      departmentId: f.departmentId,
      amountCents: 1234,
    },
  ],
  issueReceipt: true,
};
const mutation = (actor, id, key, action, payload) =>
  asActor(
    actor,
    `public.finance_bank_import_item(${quote(f.churchId)},${quote(f.unitId)},${quote(id)},1,${quote(key)},${quote(action)},${quote(JSON.stringify(payload))}::jsonb)`,
  );
const keys = [randomUUID(), randomUUID()],
  users = [actors.ADMIN, actors.TREASURER];
const attempts = await Promise.allSettled(
  users.map((user, n) => mutation(user, item, keys[n], "POST", { command })),
);
assert.equal(attempts.filter((r) => r.status === "fulfilled").length, 1);
assert.match(
  attempts.find((r) => r.status === "rejected").reason.message,
  /BANK_IMPORT_CONFLICT/,
);
const winner = attempts.findIndex((r) => r.status === "fulfilled");
const replay = await mutation(users[winner], item, keys[winner], "POST", {
  command,
});
assert.equal(replay.replayed, true);
assert.equal(
  replay.result.transactionIds[0],
  attempts[winner].value.result.transactionIds[0],
);
const overlap = await prepare();
const second = await sql(
  `select id from public.finance_bank_import_items where church_id=${quote(f.churchId)} and batch_id=${quote(overlap.id)};`,
);
await assert.rejects(
  mutation(actors.TREASURER, second, randomUUID(), "POST", { command }),
  /BANK_IMPORT_DUPLICATE_REVIEW/,
);
await mutation(actors.TREASURER, second, randomUUID(), "DUPLICATE", {
  targetId: item,
  reason: "Mesma origem confirmada no teste local",
});
assert.equal(
  await sql(
    `select count(*) from public.finance_bank_import_links where church_id=${quote(f.churchId)} and item_id in (${quote(item)},${quote(second)}) and deleted_at is null;`,
  ),
  "1",
);
assert.equal(
  await sql(
    `select count(*) from public.financial_ledger_entries where church_id=${quote(f.churchId)} and transaction_id=${quote(replay.result.transactionIds[0])} and entry_kind='TRANSACTION';`,
  ),
  "1",
);
console.log(
  "PASS: two operators, one posting; lost-response replay; overlapping statement alias; exactly one ledger entry.",
);

// A review deletion and a financial posting must share the same serialization lock.
for (const batchDelete of [false, true]) {
  source.rows[0].complement = `Delete race ${randomUUID()}`;
  const raceBatch = await prepare();
  const raceItem = await sql(`select id from public.finance_bank_import_items where church_id=${quote(f.churchId)} and batch_id=${quote(raceBatch.id)};`);
  const results = await Promise.allSettled([
    mutation(actors.ADMIN, raceItem, randomUUID(), "POST", { command }),
    asActor(actors.TREASURER, `public.manage_finance_bank_import(${quote(f.churchId)},${quote(f.unitId)},${quote(raceBatch.id)},${batchDelete ? "null" : quote(raceItem)},${batchDelete ? "null" : "1"},${quote(randomUUID())},${quote(batchDelete ? "DELETE_BATCH" : "DELETE_ITEM")})`),
  ]);
  assert.equal(results.filter(r => r.status === "fulfilled").length, 1);
  assert.match(results.find(r => r.status === "rejected").reason.message, /FORBIDDEN|BANK_IMPORT_CONFLICT|BANK_IMPORT_STATE|BANK_IMPORT_DELETE_BLOCKED/);
  const state = JSON.parse(await sql(`select jsonb_build_object('deleted',i.deleted_at is not null,'posted',i.status='POSTED','links',(select count(*) from public.finance_bank_import_links l where l.church_id=i.church_id and l.item_id=i.id)) from public.finance_bank_import_items i where i.church_id=${quote(f.churchId)} and i.id=${quote(raceItem)};`));
  assert.notEqual(state.deleted, state.posted);
  assert.equal(state.links, state.posted ? 1 : 0);
}
console.log("PASS: item/batch deletion versus posting is serialized, with no hidden financial posting.");
