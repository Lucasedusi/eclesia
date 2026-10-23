import { expect, it } from "vitest";
import { bankImportMutationSchema, bankImportFiltersSchema } from "./schemas";
const id = "10000000-0000-4000-8000-000000000001";
const base = { unit: id, itemId: id, revision: 1, operationKey: id };
it("requires audited reasons and rejects injected origin fields", () => {
  expect(bankImportMutationSchema.safeParse({ ...base, action: "IGNORE", payload: { reason: "Conferido fora deste fluxo" } }).success).toBe(true);
  expect(bankImportMutationSchema.safeParse({ ...base, action: "IGNORE", payload: {} }).success).toBe(false);
  expect(bankImportMutationSchema.safeParse({ ...base, action: "LINK", payload: { targetKind: "TRANSACTION", targetId: id, cashboxId: id } }).success).toBe(false);
});
it("bounds paginated filters and rejects unsupported mutation actions", () => {
  expect(bankImportFiltersSchema.parse({})).toMatchObject({ page: 1, status: "PENDING", direction: "ALL", query: "" });
  expect(bankImportFiltersSchema.safeParse({ page: 0 }).success).toBe(false);
  expect(bankImportMutationSchema.safeParse({ ...base, action: "DELETE", payload: {} }).success).toBe(false);
});
