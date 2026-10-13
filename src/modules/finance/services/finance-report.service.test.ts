import { beforeEach, expect, it, vi } from "vitest";
import type { FinanceContext } from "../types/finance.types";
vi.mock("server-only", () => ({}));
const m = vi.hoisted(() => ({ rpc: vi.fn(), from: vi.fn(), logo: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => m }));
vi.mock("@/modules/auth/services/church-logo.service", () => ({
  loadChurchLogoDataUri: m.logo,
}));
import { getFinanceReport } from "./finance-report.service";
const ctx = {
  churchId: "20000000-0000-4000-8000-000000000001",
  congregationId: "30000000-0000-4000-8000-000000000001",
  capabilities: { view: true },
  auth: { church: { name: "Igreja", logoUrl: null } },
} as FinanceContext;
const summary = {
  openingCents: 100000,
  incomeCents: 150000,
  expenseCents: 60000,
  openingMovementCents: 20000,
  adjustmentCents: -5000,
  transferNetCents: 0,
  closingCents: 205000,
  count: 4,
};
const projection = {
  type: "SYNTHETIC",
  month: "2026-10",
  generatedAt: "2026-10-12T12:00:00Z",
  cashboxId: null,
  cashboxName: null,
  summary,
  departments: [
    { id: "d", name: "Missões", incomeCents: 150000, expenseCents: 60000 },
  ],
  cashboxes: [{ ...summary, id: ctx.congregationId, name: "Caixa" }],
  movements: [],
  categories: [
    {
      categoryId: "c",
      categoryName: "Oferta",
      classificationId: null,
      classificationName: null,
      direction: "INCOME",
      amountCents: 150000,
      count: 3,
    },
    {
      categoryId: "e",
      categoryName: "Despesa",
      classificationId: null,
      classificationName: null,
      direction: "EXPENSE",
      amountCents: 60000,
      count: 1,
    },
  ],
};
beforeEach(() => {
  m.rpc
    .mockReset()
    .mockResolvedValue({ data: structuredClone(projection), error: null });
  m.logo.mockResolvedValue(null);
  m.from.mockImplementation((table: string) => {
    const q = {
      select: () => q,
      eq: () => q,
      is: () => q,
      maybeSingle: async () => ({
        data:
          table === "app_settings"
            ? { display_church_name: "Nome configurado", logo_url: null }
            : {
                name: "Nome",
                document: null,
                city: null,
                state: null,
                logo_url: null,
                ...(table === "congregations"
                  ? {
                      address: "Rua Exemplo",
                      number: "120",
                      district: "Centro",
                      city: "Porangatu",
                      state: "GO",
                      zip_code: "76550000",
                    }
                  : {}),
              },
        error: null,
      }),
    };
    return q;
  });
});
it("loads a scoped synthetic without personal rows and tolerates absent logo", async () => {
  const doc = await getFinanceReport(ctx, {
    type: "SYNTHETIC",
    month: "2026-10",
  });
  expect(doc.summary.closingCents).toBe(205000);
  expect(doc.congregationAddress).toBe(
    "Rua Exemplo, 120 · Centro · Porangatu / GO · CEP 76550000",
  );
  expect(doc.church.name).toBe("Nome configurado");
  expect(doc.church.logoDataUri).toBeNull();
  expect(doc).not.toHaveProperty("rows");
  expect(m.rpc).toHaveBeenCalledWith("get_finance_report", {
    p_church_id: ctx.churchId,
    p_unit: ctx.congregationId,
    p_options: { type: "SYNTHETIC", month: "2026-10" },
  });
});
it("denies capability before reading any report", async () => {
  await expect(
    getFinanceReport(
      { ...ctx, capabilities: { ...ctx.capabilities, view: false } },
      { type: "ANALYTIC", month: "2026-10" },
    ),
  ).rejects.toThrow("FORBIDDEN");
  expect(m.rpc).not.toHaveBeenCalled();
});
it("rejects inconsistent totals", async () => {
  m.rpc.mockResolvedValue({
    data: { ...projection, summary: { ...summary, closingCents: 1 } },
    error: null,
  });
  await expect(
    getFinanceReport(ctx, { type: "SYNTHETIC", month: "2026-10" }),
  ).rejects.toThrow("REPORT_RECONCILIATION_REQUIRED");
});
it("rejects unsafe cents and wrong period", async () => {
  for (const data of [
    {
      ...projection,
      summary: { ...summary, incomeCents: Number.MAX_SAFE_INTEGER + 1 },
    },
    { ...projection, month: "2026-09" },
  ]) {
    m.rpc.mockResolvedValue({ data, error: null });
    await expect(
      getFinanceReport(ctx, { type: "SYNTHETIC", month: "2026-10" }),
    ).rejects.toThrow();
  }
});
it.each(["REPORT_TOO_LARGE", "REPORT_RECONCILIATION_REQUIRED"])(
  "preserves safe actionable %s",
  async (message) => {
    m.rpc.mockResolvedValue({ data: null, error: { message } });
    await expect(
      getFinanceReport(ctx, { type: "SYNTHETIC", month: "2026-10" }),
    ).rejects.toThrow(message);
  },
);

it("rejects analytic rows assigned to an unknown or unbalanced cashbox", async () => {
  const rows = projection.categories.map((category, i) => ({
    ...category,
    id: `00000000-0000-4000-8000-00000000000${i}`,
    date: "2026-10-01",
    personName: null,
    description: null,
    documentNumber: null,
    departmentName: "Missões",
    cashboxId: ctx.congregationId,
    cashboxName: "Caixa",
    paymentMethodName: "Dinheiro",
  }));
  const analytic = {
    ...projection,
    type: "ANALYTIC",
    rows,
    summary: { ...summary, count: 2 },
    cashboxes: [
      { ...summary, count: 2, id: ctx.congregationId, name: "Caixa" },
    ],
  };
  m.rpc.mockResolvedValue({ data: analytic, error: null });
  await expect(
    getFinanceReport(ctx, { type: "ANALYTIC", month: "2026-10" }),
  ).resolves.toHaveProperty("rows");
  rows[0].cashboxId = "30000000-0000-4000-8000-000000000099";
  await expect(
    getFinanceReport(ctx, { type: "ANALYTIC", month: "2026-10" }),
  ).rejects.toThrow("REPORT_RECONCILIATION_REQUIRED");
  analytic.cashboxes.push({
    ...summary,
    count: 0,
    incomeCents: 0,
    expenseCents: 0,
    openingCents: 0,
    closingCents: 0,
    openingMovementCents: 0,
    adjustmentCents: 0,
    id: rows[0].cashboxId,
    name: "Caixa",
  });
  await expect(
    getFinanceReport(ctx, { type: "ANALYTIC", month: "2026-10" }),
  ).rejects.toThrow("REPORT_RECONCILIATION_REQUIRED");
});
