import { expect, it, vi, beforeEach } from "vitest";
import type { FinanceContext } from "../types/finance.types";
import { getDailyCashFlowReport } from "./finance-daily-report.service";

vi.mock("server-only", () => ({}));
const db = vi.hoisted(() => ({
  rpc: vi.fn(),
  from: vi.fn(),
  identity: vi.fn(),
}));
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => db }));
vi.mock("./finance-report.service", () => ({
  loadFinanceReportIdentity: db.identity,
}));
const id = (n: number) =>
  `30000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const context = {
  churchId: id(1),
  congregationId: id(2),
  capabilities: { view: true },
  auth: {
    profile: { status: "ACTIVE" },
    access: { status: "ACTIVE", role: "ADMIN", scope: "CHURCH" },
  },
} as FinanceContext;
const request = {
  type: "DAILY",
  date: "2026-10-02",
  presentation: "BALANCES",
} as const;
const unitId = id(3);
const catalogRow = (
  n: number,
  status: string,
): {
  id: string;
  name: string;
  status: string;
  cashbox_type: string;
  bank_name: string | null;
  agency: string | null;
  account_number: string | null;
} => ({
  id: id(n),
  name: `Caixa ${n}`,
  status,
  cashbox_type: "CASH",
  bank_name: null,
  agency: null,
  account_number: null,
});
const position = (n: number, closing: number) => ({
  id: id(n),
  name: `Caixa ${n}`,
  bankDetails: null,
  opening: closing,
  income: 0,
  expense: 0,
  closing,
  categories: [],
  movements: [],
});
const snapshot = {
  date: request.date,
  box: null,
  unitId,
  generatedAt: "2026-11-13T19:00:00Z",
  boxes: [position(10, 5000), position(12, -1200), position(13, 0)],
  payments: [],
};

function catalog(rows: ReturnType<typeof catalogRow>[]) {
  const query = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    is: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue({ data: rows, error: null }),
  };
  db.from.mockReturnValue(query);
  return query;
}

beforeEach(() => {
  vi.clearAllMocks();
  db.rpc.mockResolvedValue({ data: snapshot, error: null });
});
it("uses historical balances and includes active zeros and inactive nonzero balances in the authorized Cathedral", async () => {
  const query = catalog([
    catalogRow(10, "ACTIVE"),
    catalogRow(11, "ACTIVE"),
    {
      ...catalogRow(12, "INACTIVE"),
      cashbox_type: "BANK_ACCOUNT",
      bank_name: "Banco Exemplo",
      agency: "001",
      account_number: "123-4",
    },
    catalogRow(13, "INACTIVE"),
    catalogRow(14, "INACTIVE"),
  ]);
  const result = await getDailyCashFlowReport(context, request);
  expect(db.rpc).toHaveBeenCalledWith("get_finance_daily_cash_flow_report", {
    p_church_id: context.churchId,
    p_day: request.date,
    p_box: undefined,
    p_detail: false,
    p_payments: false,
  });
  expect(db.from).toHaveBeenCalledWith("financial_cashboxes");
  expect(query.eq).toHaveBeenCalledWith("church_id", context.churchId);
  expect(query.eq).toHaveBeenCalledWith("congregation_id", unitId);
  expect(query.is).toHaveBeenCalledWith("deleted_at", null);
  expect(db.identity).toHaveBeenCalledWith({
    ...context,
    congregationId: unitId,
  });
  if (result.presentation !== "BALANCES") throw Error("Modelo incorreto");
  expect(result.date).toBe(request.date);
  expect(result.generatedAt).toBe(snapshot.generatedAt);
  expect(
    result.accounts.map((box) => [box.id, box.closing, box.inactive]),
  ).toEqual([
    [id(10), 5000, false],
    [id(11), 0, false],
    [id(12), -1200, true],
  ]);
  expect(result.accounts[2].bankDetails).toEqual({
    bankName: "Banco Exemplo",
    agency: "001",
    accountNumber: "123-4",
  });
  expect(result.totalCents).toBe(3800);
});

it("avoids a partial balance report when an account with money is missing from the catalog", async () => {
  catalog([catalogRow(10, "ACTIVE")]);
  await expect(getDailyCashFlowReport(context, request)).rejects.toThrow(
    "REPORT_RECONCILIATION_REQUIRED",
  );
});

it("returns a zero total for an empty Cathedral", async () => {
  db.rpc.mockResolvedValueOnce({
    data: { ...snapshot, boxes: [] },
    error: null,
  });
  catalog([]);
  await expect(getDailyCashFlowReport(context, request)).resolves.toMatchObject(
    { accounts: [], totalCents: 0 },
  );
});
