import { expect, it, vi } from "vitest";
import type { FinanceContext } from "../types/finance.types";
vi.mock("server-only", () => ({}));
const mocks = vi.hoisted(() => ({ rpc: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({ rpc: mocks.rpc }),
}));
import { searchFinanceCongregations } from "./finance-contributor.service";
const context = {
  churchId: "church",
  congregationId: "unit",
  capabilities: { view: true },
} as FinanceContext;
it("uses server church/unit and validated directory query", async () => {
  mocks.rpc.mockResolvedValue({
    data: [{ id: "payer", name: "Congregação" }],
    error: null,
  });
  expect(await searchFinanceCongregations(context, "  Sede  ")).toEqual([
    { id: "payer", name: "Congregação" },
  ]);
  expect(mocks.rpc).toHaveBeenLastCalledWith("lookup_finance_congregations", {
    p_church_id: "church",
    p_unit: "unit",
    p_query: "Sede",
  });
});
it("blocks missing access and invalid query before database", async () => {
  mocks.rpc.mockClear();
  await expect(
    searchFinanceCongregations(
      { ...context, capabilities: { ...context.capabilities, view: false } },
      "Sede",
    ),
  ).rejects.toThrow("FORBIDDEN");
  await expect(searchFinanceCongregations(context, "%")).rejects.toThrow();
  expect(mocks.rpc).not.toHaveBeenCalled();
});
