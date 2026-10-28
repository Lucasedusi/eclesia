import { expect, it } from "vitest";
import { bankImportMutationSchema, bankImportFiltersSchema, bankImportDraftSchema } from "./schemas";
import { newEntryState } from "../utils/finance-entry-session";
const id = "10000000-0000-4000-8000-000000000001";
const base = { unit: id, itemId: id, revision: 1, operationKey: id };
it("restores legacy drafts and preserves an edited reference in new drafts", () => {
  const legacy = { ...newEntryState("2026-11-05"), personLabel: "Preservado" } as Record<string, unknown>;
  delete legacy.referenceMonth;
  delete legacy.referenceMonthManual;
  expect(bankImportDraftSchema.parse({ state: legacy, extra: [] }).state).toMatchObject({
    referenceMonth: "2026-11", referenceMonthManual: false, personLabel: "Preservado",
  });
  expect(bankImportDraftSchema.parse({ state: { ...legacy, referenceMonth: "2026-10", referenceMonthManual: true }, extra: [] }).state)
    .toMatchObject({ referenceMonth: "2026-10", referenceMonthManual: true });
});
it("preserves congregation selection and unfinished organization in drafts", () => {
  for (const contributor of [
    { kind: "CONGREGATION", congregationId: id },
    { kind: "ORGANIZATION", name: "" },
  ])
    expect(
      bankImportMutationSchema.safeParse({
        ...base,
        action: "SAVE_DRAFT",
        payload: {
          state: { ...newEntryState("2026-10-21"), contributor },
          extra: [],
        },
      }).success,
    ).toBe(true);
});
it("allows an incomplete contributor in a server draft", () => {
  expect(
    bankImportMutationSchema.safeParse({
      ...base,
      action: "SAVE_DRAFT",
      payload: {
        state: {
          ...newEntryState("2026-10-21"),
          contributor: { kind: "UNREGISTERED", name: "" },
        },
        extra: [],
      },
    }).success,
  ).toBe(true);
});
it("requires audited reasons and rejects injected origin fields", () => {
  expect(
    bankImportMutationSchema.safeParse({
      ...base,
      action: "IGNORE",
      payload: { reason: "Conferido fora deste fluxo" },
    }).success,
  ).toBe(true);
  expect(
    bankImportMutationSchema.safeParse({
      ...base,
      action: "IGNORE",
      payload: {},
    }).success,
  ).toBe(false);
  expect(
    bankImportMutationSchema.safeParse({
      ...base,
      action: "LINK",
      payload: { targetKind: "TRANSACTION", targetId: id, cashboxId: id },
    }).success,
  ).toBe(false);
});
it("bounds paginated filters and rejects unsupported mutation actions", () => {
  expect(bankImportFiltersSchema.parse({})).toMatchObject({
    page: 1,
    status: "PENDING",
    direction: "ALL",
    query: "",
  });
  expect(bankImportFiltersSchema.safeParse({ page: 0 }).success).toBe(false);
  expect(
    bankImportMutationSchema.safeParse({
      ...base,
      action: "DELETE",
      payload: {},
    }).success,
  ).toBe(false);
});

it("validates lifecycle actions without allowing tenant or audit injection", async () => {
  const { bankImportLifecycleSchema } = await import("./schemas");
  const batch = {
    unit: id,
    batchId: id,
    operationKey: id,
    action: "DELETE_BATCH",
  };
  expect(bankImportLifecycleSchema.safeParse(batch).success).toBe(true);
  expect(
    bankImportLifecycleSchema.safeParse({ ...batch, churchId: id }).success,
  ).toBe(false);
  expect(
    bankImportLifecycleSchema.safeParse({ ...batch, action: "DELETE_ITEM" })
      .success,
  ).toBe(false);
  expect(
    bankImportLifecycleSchema.safeParse({
      ...batch,
      action: "RESTORE_ITEM",
      itemId: id,
      revision: 2,
    }).success,
  ).toBe(true);
  expect(bankImportFiltersSchema.safeParse({ status: "DELETED" }).success).toBe(
    true,
  );
});
