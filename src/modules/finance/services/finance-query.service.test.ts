import { it, expect, vi } from "vitest";
import type { FinanceContext } from "../types/finance.types";
vi.mock("server-only", () => ({}));
const mocks = vi.hoisted(() => ({ rpc: vi.fn(), from: vi.fn(), adminFrom: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({ rpc: mocks.rpc, from: mocks.from }),
}));
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({ from: mocks.adminFrom }),
}));
import {
  getFinanceTransaction,
  getFinanceOverview,
  listFinanceTransactions,
} from "./finance-query.service";
const context = {
  churchId: "20000000-0000-4000-8000-000000000001",
  congregationId: "30000000-0000-4000-8000-000000000001",
  capabilities: { view: true },
} as FinanceContext;
it("passes server scope and validated month without accepting another church", async () => {
  mocks.rpc.mockResolvedValue({ data: { closingCents: 2401000 }, error: null });
  expect(
    (await getFinanceOverview(context, { month: "2026-10" })).closingCents,
  ).toBe(2401000);
  expect(mocks.rpc).toHaveBeenLastCalledWith("get_finance_overview", {
    p_church_id: context.churchId,
    p_unit: context.congregationId,
    p_month: "2026-10",
  });
  await expect(
    getFinanceOverview(context, { month: "2026-13" }),
  ).rejects.toThrow();
});
it("rejects missing read capability before touching the database", async () => {
  mocks.rpc.mockClear();
  await expect(
    listFinanceTransactions(
      { ...context, capabilities: { ...context.capabilities, view: false } },
      { month: "2026-10" },
    ),
  ).rejects.toThrow("FORBIDDEN");
  expect(mocks.rpc).not.toHaveBeenCalled();
});

it("requires the database to acknowledge congregation filtering, avoiding unfiltered results on old schemas", async () => {
  const contributorCongregationId = "30000000-0000-4000-8000-000000000002";
  mocks.rpc.mockResolvedValue({
    data: { items: [], contributorCongregationId },
    error: null,
  });
  await expect(
    listFinanceTransactions(context, {
      month: "2026-10",
      contributorCongregationId,
    }),
  ).resolves.toMatchObject({ contributorCongregationId });
  mocks.rpc.mockResolvedValue({ data: { items: [] }, error: null });
  await expect(
    listFinanceTransactions(context, {
      month: "2026-10",
      contributorCongregationId,
    }),
  ).rejects.toThrow("CONFIGURATION_REQUIRED");
});

function rows(data: unknown) {
  const query = {
    select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), is: vi.fn().mockReturnThis(),
    in: vi.fn().mockReturnThis(), order: vi.fn().mockReturnThis(), maybeSingle: vi.fn().mockReturnThis(),
    then: (resolve: (value: unknown) => void) => resolve({ data, error: null }),
  };
  return query;
}

const transactionId = "30000000-0000-4000-8000-000000000003";
const transaction = { id: transactionId, created_by: "creator", created_at: "2026-10-01T10:00:00Z", transaction_date: "2026-10-01", reference_year: 2026, reference_month: 10, amount: 10 };

it("attributes each revision to its own actor and includes creation for older transactions without a first revision", async () => {
  const history = [
    { revision: 3, created_by: null, new_values: { status: "CANCELLED", amount: 10 }, previous_values: { amount: 10 } },
    { revision: 2, created_by: "editor", new_values: { status: "CONFIRMED", amount: 10 }, previous_values: { amount: 5 } },
  ];
  const revisions = rows(history);
  mocks.from.mockImplementation(table => table === "financial_transactions" ? rows(transaction) : table === "financial_transaction_revisions" ? revisions : rows([]));
  const people = rows([{ id: "creator", full_name: "Criadora", display_name: null }, { id: "editor", full_name: null, display_name: "Editor" }]);
  mocks.adminFrom.mockReturnValue(people);
  const detail = await getFinanceTransaction(context, transactionId);
  expect(detail.history).toMatchObject([
    { revision: 3, action: "CANCELLED", actorName: null },
    { revision: 2, action: "UPDATED", actorName: "Editor", beforeAmountCents: 500, afterAmountCents: 1000 },
    { revision: 1, action: "CREATED", actorName: "Criadora", createdAt: transaction.created_at },
  ]);
  expect(people.eq).toHaveBeenCalledWith("user_church_access.church_id", context.churchId);
  expect(people.in).toHaveBeenCalledWith("id", expect.arrayContaining(["creator", "editor"]));
  expect(revisions.eq).toHaveBeenCalledWith("congregation_id", context.congregationId);
  expect(revisions.eq).toHaveBeenCalledWith("transaction_id", transactionId);

  history.push({ revision: 1, created_by: "creator", new_values: { status: "CONFIRMED", amount: 5 }, previous_values: { amount: 0 } });
  expect((await getFinanceTransaction(context, transactionId)).history.map(event => event.revision)).toEqual([3, 2, 1]);
});

it("never resolves profile names for an inaccessible transaction", async () => {
  mocks.adminFrom.mockClear();
  mocks.from.mockReturnValue(rows(null));
  await expect(getFinanceTransaction(context, transactionId)).rejects.toThrow("FORBIDDEN");
  expect(mocks.adminFrom).not.toHaveBeenCalled();
});
