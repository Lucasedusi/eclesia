import { beforeEach, expect, it, vi } from "vitest";
import type { FinanceContext } from "../types/finance.types";
vi.mock("server-only", () => ({}));
const m = vi.hoisted(() => ({ rpc: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => m }));
vi.mock("./finance-report.service", () => ({
  loadFinanceReportIdentity: async () => ({
    church: { name: "Igreja", document: null, city: null, logoDataUri: null },
    congregationName: "Congregação",
    congregationAddress: null,
  }),
}));
import { getFinanceCategoryReport } from "./finance-category-report.service";
const id = "30000000-0000-4000-8000-000000000001";
const ctx = {
  churchId: id,
  congregationId: id,
  capabilities: { view: true },
} as FinanceContext;
const options = {
  type: "CATEGORY" as const,
  dateFrom: "2026-01-01",
  dateTo: "2026-12-31",
  direction: "EXPENSE" as const,
  presentation: "SUMMARY" as const,
  categoryIds: [id],
};
const projection = {
  ...options,
  cashboxId: null,
  cashboxName: null,
  generatedAt: "2026-10-22T12:00:00Z",
  totalCents: 12345,
  count: 1,
  categories: [
    {
      id,
      name: "Combustível",
      status: "INACTIVE",
      amountCents: 12345,
      count: 1,
    },
  ],
  rows: [],
};
beforeEach(() =>
  m.rpc
    .mockReset()
    .mockResolvedValue({ data: structuredClone(projection), error: null }),
);
it("permits financial viewers and preserves inactive category totals", async () => {
  const report = await getFinanceCategoryReport(ctx, options);
  expect(report.totalCents).toBe(12345);
  expect(report.categories[0].status).toBe("INACTIVE");
  expect(m.rpc).toHaveBeenCalledWith("get_finance_category_report", {
    p_church_id: id,
    p_unit: id,
    p_options: options,
  });
});
it("denies a caller without financial access before reading", async () => {
  await expect(
    getFinanceCategoryReport(
      { ...ctx, capabilities: { ...ctx.capabilities, view: false } },
      options,
    ),
  ).rejects.toThrow("FORBIDDEN");
  expect(m.rpc).not.toHaveBeenCalled();
});
it.each([
  { dateTo: "2026-11-30" },
  { direction: "INCOME" },
  { categoryIds: [] },
  { cashboxId: id },
  { totalCents: 12346 },
  { count: 2 },
  { categories: [] },
  { rows: [{}] },
])("rejects a mismatched or incomplete projection %j", async (change) => {
  m.rpc.mockResolvedValue({ data: { ...projection, ...change }, error: null });
  await expect(getFinanceCategoryReport(ctx, options)).rejects.toThrow();
});
it("checks detailed rows against category totals and date bounds", async () => {
  const row = {
    id,
    categoryId: id,
    date: "2026-01-01",
    amountCents: 12345,
    description: "Abastecimento",
    personName: "Posto",
    cashboxId: id,
    cashboxName: "Caixa",
    classificationName: null,
  };
  const detailed = { ...projection, presentation: "DETAILED", rows: [row] };
  m.rpc.mockResolvedValue({ data: detailed, error: null });
  await expect(
    getFinanceCategoryReport(ctx, { ...options, presentation: "DETAILED" }),
  ).resolves.toHaveProperty("count", 1);
  for (const change of [
    { amountCents: 12344 },
    { date: "2025-12-31" },
    { categoryId: "30000000-0000-4000-8000-000000000002" },
  ]) {
    m.rpc.mockResolvedValue({
      data: { ...detailed, rows: [{ ...row, ...change }] },
      error: null,
    });
    await expect(
      getFinanceCategoryReport(ctx, { ...options, presentation: "DETAILED" }),
    ).rejects.toThrow();
  }
});
