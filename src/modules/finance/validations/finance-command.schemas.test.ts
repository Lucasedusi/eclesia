import { it, expect } from "vitest";
import { financeCommandSchema } from "./finance-command.schemas";
const id = "30000000-0000-4000-8000-000000000001";
const record = {
  kind: "RECORD",
  operationKey: id,
  congregationId: id,
  mode: "SINGLE",
  direction: "INCOME",
  date: "2026-10-01",
  cashboxId: id,
  paymentMethodId: id,
  contributor: { kind: "COLLECTIVE" },
  items: [{ categoryId: id, departmentId: id, amountCents: 100 }],
};
it("accepts an independent reference for entries, expenses, attendance and corrections", () => {
  for (const variant of [
    { ...record, referenceMonth: "2026-09" },
    { ...record, referenceMonth: "2026-09", direction: "EXPENSE" },
    { ...record, referenceMonth: "2026-09", mode: "ATTENDANCE" },
    { kind: "CORRECT_TRANSACTION", operationKey: id, congregationId: id, id,
      expectedRevision: 1, reason: "Corrigir referência",
      replacement: { date: record.date, referenceMonth: "2026-09", direction: record.direction,
        cashboxId: id, paymentMethodId: id, contributor: record.contributor, item: record.items[0] } },
  ]) expect(financeCommandSchema.safeParse(variant).success).toBe(true);
});
it.each(["", "2026-00", "2026-13", "1999-12", "2100-01", "2026-10-01", null])(
  "rejects invalid reference %s", (referenceMonth) => {
    expect(financeCommandSchema.safeParse({ ...record, referenceMonth }).success).toBe(false);
  },
);
it("single means one line and attendance only receives income", () => {
  expect(financeCommandSchema.safeParse(record).success).toBe(true);
  expect(
    financeCommandSchema.safeParse({
      ...record,
      items: [...record.items, ...record.items],
    }).success,
  ).toBe(false);
  expect(
    financeCommandSchema.safeParse({
      ...record,
      mode: "ATTENDANCE",
      direction: "EXPENSE",
    }).success,
  ).toBe(false);
});
it("requires revision and reason for destructive transitions", () => {
  expect(
    financeCommandSchema.safeParse({
      kind: "CANCEL_TRANSACTION",
      operationKey: id,
      congregationId: id,
      id,
    }).success,
  ).toBe(false);
});

it.each(["INCOME", "EXPENSE"])(
  "accepts congregation and organization identities for %s",
  (direction) => {
    for (const contributor of [
      { kind: "CONGREGATION", congregationId: id },
      { kind: "ORGANIZATION", name: "Concessionária exemplo" },
    ]) {
      expect(
        financeCommandSchema.safeParse({ ...record, direction, contributor })
          .success,
      ).toBe(true);
    }
  },
);

it("rejects forged identity labels, missing congregation and blank organization", () => {
  for (const contributor of [
    { kind: "CONGREGATION" },
    { kind: "CONGREGATION", congregationId: id, name: "Nome forjado" },
    { kind: "CONGREGATION", congregationId: id, churchId: id },
    { kind: "ORGANIZATION", name: " " },
    { kind: "ORGANIZATION", name: "a".repeat(161) },
  ])
    expect(
      financeCommandSchema.safeParse({ ...record, contributor }).success,
    ).toBe(false);
});
