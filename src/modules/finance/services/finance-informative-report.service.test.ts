import { beforeEach, expect, it, vi } from "vitest";
import type { FinanceContext } from "../types/finance.types";
vi.mock("server-only", () => ({}));
const m = vi.hoisted(() => ({ rpc: vi.fn(), metadata: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => m }));
vi.mock("./finance-report.service", () => ({
  loadFinanceReportIdentity: m.metadata,
}));
import { getFinanceInformativeReport } from "./finance-informative-report.service";
const context = {
  churchId: "20000000-0000-4000-8000-000000000001",
  congregationId: "30000000-0000-4000-8000-000000000001",
  capabilities: { view: true },
  auth: {
    profile: { status: "ACTIVE" },
    access: { role: "ADMIN", scope: "CHURCH", status: "ACTIVE" },
  },
} as FinanceContext;
const options = {
  type: "INFORMATIVE" as const,
  startMonth: "2026-09",
  endMonth: "2026-11",
  includePrebend: true,
  includeTransfer: true,
};
const base = {
  openingCents: 10000,
  incomeCents: 1800000,
  expenseCents: 100000,
  openingMovementCents: 20000,
  adjustmentCents: -5000,
  transferNetCents: 0,
  closingCents: 1725000,
  count: 3,
};
const projection = () => ({
  ...options,
  source: "TRANSACTIONS",
  generatedAt: "2026-11-30T12:00:00Z",
  months: [
    {
      month: "2026-09",
      summary: base,
      recorded: {
        grossPrebendCents: 40000,
        transferCents: 525000,
      },
    },
    {
      month: "2026-10",
      summary: {
        ...base,
        openingCents: 1725000,
        incomeCents: 10000,
        expenseCents: 0,
        openingMovementCents: 0,
        adjustmentCents: 0,
        closingCents: 1735000,
        count: 1,
      },
      recorded: {
        grossPrebendCents: 0,
        transferCents: 0,
      },
    },
    {
      month: "2026-11",
      summary: {
        ...base,
        openingCents: 1735000,
        incomeCents: 0,
        expenseCents: 0,
        openingMovementCents: 0,
        adjustmentCents: 0,
        closingCents: 1735000,
        count: 0,
      },
      recorded: { grossPrebendCents: 0, transferCents: 0 },
    },
  ],
});
beforeEach(() => {
  m.rpc.mockReset().mockResolvedValue({ data: projection(), error: null });
  m.metadata.mockResolvedValue({
    church: { name: "Igreja", document: null, city: null, logoDataUri: null },
    congregationName: "Congregação",
    congregationAddress: null,
  });
});
it("keeps balances unchanged and uses recorded values including empty months", async () => {
  const report = await getFinanceInformativeReport(context, options);
  expect(report.summary).toEqual({
    ...base,
    incomeCents: 1810000,
    closingCents: 1735000,
    count: 4,
  });
  expect(report.months[0].recorded?.grossPrebendCents).toBe(40000);
  expect(report.months[0].recorded?.transferCents).toBe(525000);
  expect(report.months[1].recorded).toMatchObject({
    grossPrebendCents: 0,
  });
  expect(report.months[2].recorded).toEqual({
    grossPrebendCents: 0,
    transferCents: 0,
  });
  expect(m.rpc).toHaveBeenCalledWith("get_finance_informative_report", {
    p_church_id: context.churchId,
    p_unit: context.congregationId,
    p_options: options,
  });
});
it.each(["TREASURER", "SECRETARY", "VIEWER"])(
  "denies %s before reading data",
  async (role) => {
    await expect(
      getFinanceInformativeReport(
        {
          ...context,
          auth: {
            ...context.auth,
            access: { ...context.auth.access, role: role as "ADMIN" },
          },
        },
        options,
      ),
    ).rejects.toThrow("FORBIDDEN");
    expect(m.rpc).not.toHaveBeenCalled();
  },
);
it("denies inactive administrators and administrators without finance access", async () => {
  await expect(
    getFinanceInformativeReport(
      { ...context, capabilities: { ...context.capabilities, view: false } },
      options,
    ),
  ).rejects.toThrow("FORBIDDEN");
  await expect(
    getFinanceInformativeReport(
      {
        ...context,
        auth: {
          ...context.auth,
          access: { ...context.auth.access, status: "INACTIVE" },
        },
      },
      options,
    ),
  ).rejects.toThrow("FORBIDDEN");
});
it("rejects missing months, incorrect balances and discontinuous balances", async () => {
  for (const mutate of [
    (p: ReturnType<typeof projection>) => p.months.splice(1, 1),
    (p: ReturnType<typeof projection>) => p.months[1].summary.closingCents++,
    (p: ReturnType<typeof projection>) => {
      p.months[1].summary.openingCents++;
      p.months[1].summary.closingCents++;
    },
  ]) {
    const p = structuredClone(projection());
    mutate(p);
    m.rpc.mockResolvedValue({ data: p, error: null });
    await expect(getFinanceInformativeReport(context, options)).rejects.toThrow(
      "REPORT_RECONCILIATION_REQUIRED",
    );
  }
});
it("rejects a mismatched range and unsafe monetary values", async () => {
  for (const p of [
    { ...projection(), endMonth: "2026-12" },
    {
      ...projection(),
      months: [
        {
          month: "2026-09",
          summary: { ...base, incomeCents: Number.MAX_SAFE_INTEGER + 1 },
          recorded: { grossPrebendCents: 0, transferCents: 0 },
        },
      ],
    },
  ]) {
    m.rpc.mockResolvedValue({ data: p, error: null });
    await expect(
      getFinanceInformativeReport(context, options),
    ).rejects.toThrow();
  }
});

it("rejects the old statement projection instead of showing calculated amounts", async () => {
  const p = projection();
  m.rpc.mockResolvedValue({
    data: {
      ...p,
      source: undefined,
      months: p.months.map(({ recorded, ...m }) => ({
        ...m,
        statement: { ...recorded, revision: 1, stale: false },
      })),
    },
    error: null,
  });
  await expect(getFinanceInformativeReport(context, options)).rejects.toThrow(
    "UNAVAILABLE",
  );
});
it("returns a safe configuration error instead of zero", async () => {
  m.rpc.mockResolvedValue({
    data: null,
    error: { message: "REPORT_CONFIGURATION_REQUIRED" },
  });
  await expect(getFinanceInformativeReport(context, options)).rejects.toThrow(
    "REPORT_CONFIGURATION_REQUIRED",
  );
});
