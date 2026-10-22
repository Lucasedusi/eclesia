import { beforeEach, expect, it, vi } from "vitest";
import type { FinanceContext } from "../types/finance.types";
vi.mock("server-only", () => ({}));
const m = vi.hoisted(() => ({ rpc: vi.fn(), metadata: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => m }));
vi.mock("./finance-report.service", () => ({
  loadFinanceReportIdentity: m.metadata,
}));
import {
  getFinanceRankingReport,
  getFinanceDeliveryReport,
  recordFinanceDelivery,
  saveFinanceDeliveryDeadline,
} from "./finance-administrative.service";
const context = {
  churchId: "20000000-0000-4000-8000-000000000001",
  congregationId: "30000000-0000-4000-8000-000000000001",
  capabilities: { view: true, manageSettings: true },
  auth: {
    profile: { status: "ACTIVE" },
    access: { role: "ADMIN", scope: "CHURCH", status: "ACTIVE" },
  },
} as FinanceContext;
const options = {
  type: "RANKING" as const,
  startMonth: "2026-08",
  endMonth: "2026-09",
  includeInactive: false,
  includePrebend: true,
  includeTransfer: true,
};
const summary = {
  openingCents: 10000,
  incomeCents: 10000,
  expenseCents: 2000,
  openingMovementCents: 0,
  adjustmentCents: 0,
  transferNetCents: 0,
  closingCents: 18000,
  count: 2,
};
function projection() {
  return {
    ...options,
    generatedAt: "2026-10-22T12:00:00Z",
    units: [
      {
        id: context.congregationId,
        name: "Congregação",
        status: "ACTIVE",
        isHeadquarters: false,
        report: {
          ...options,
          type: "INFORMATIVE",
          generatedAt: "2026-10-22T12:00:00Z",
          months: [
            {
              month: "2026-08",
              summary,
              statement: {
                revision: 1,
                stale: true,
                grossPrebendCents: 1000,
                transferCents: 3500,
              },
            },
            {
              month: "2026-09",
              summary: { ...summary, openingCents: 18000, closingCents: 26000 },
              statement: null,
            },
          ],
        },
      },
    ],
  };
}
beforeEach(() => {
  vi.clearAllMocks();
  m.metadata.mockResolvedValue({
    church: { name: "Igreja", document: null, city: null, logoDataUri: null },
    congregationName: "Topo",
    congregationAddress: "Endereço da unidade",
  });
});
it("uses final accumulated balance and labels missing optional months with partial sums", async () => {
  m.rpc.mockResolvedValue({ data: projection(), error: null });
  const report = await getFinanceRankingReport(context, options);
  expect(report.rows[0]).toMatchObject({
    incomeCents: 20000,
    expenseCents: 4000,
    closingCents: 26000,
    grossPrebendCents: 1000,
    transferCents: 3500,
    missingMonths: 1,
    staleMonths: ["2026-08"],
  });
  expect(report.congregationAddress).toBeNull();
  expect(report.congregationName).toBe("Todas as congregações");
  expect(report.totals.closingCents).toBe(26000);
});
it("refuses unreconciled balances and unexpected months", async () => {
  const data = projection();
  data.units[0].report.months[1].summary.closingCents = 999;
  m.rpc.mockResolvedValue({ data, error: null });
  await expect(getFinanceRankingReport(context, options)).rejects.toThrow(
    "REPORT_RECONCILIATION_REQUIRED",
  );
});
it.each(["TREASURER", "SECRETARY", "VIEWER"])(
  "denies %s on read and write endpoints before reaching the database",
  async (role) => {
    const denied = {
      ...context,
      auth: { ...context.auth, access: { ...context.auth.access, role } },
    } as FinanceContext;
    await expect(getFinanceRankingReport(denied, options)).rejects.toThrow(
      "FORBIDDEN",
    );
    await expect(recordFinanceDelivery(denied, {})).rejects.toThrow(
      "FORBIDDEN",
    );
    await expect(saveFinanceDeliveryDeadline(denied, {})).rejects.toThrow(
      "FORBIDDEN",
    );
    expect(m.rpc).not.toHaveBeenCalled();
  },
);
it("exports exactly the delivery status and name filter", async () => {
  m.rpc.mockResolvedValue({
    data: {
      month: "2026-09",
      includeInactive: false,
      today: "2026-10-22",
      dueDate: "2026-10-08",
      generatedAt: "2026-10-22T12:00:00Z",
      rules: [],
      rows: [
        {
          id: context.congregationId,
          name: "Jardim",
          status: "ACTIVE",
          deliveryDate: "2026-10-09",
          revision: 1,
          history: [],
        },
        {
          id: "30000000-0000-4000-8000-000000000002",
          name: "Centro",
          status: "ACTIVE",
          deliveryDate: null,
          revision: 0,
          history: [],
        },
      ],
    },
    error: null,
  });
  const report = await getFinanceDeliveryReport(context, {
    type: "DELIVERIES",
    month: "2026-09",
    includeInactive: false,
    filter: "PENDING",
    search: "centro",
  });
  expect(report.rows.map((r) => r.name)).toEqual(["Centro"]);
});
