import { beforeEach, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const mocks = vi.hoisted(() => ({ context: vi.fn(), rpc: vi.fn() }));
vi.mock("./finance-access.service", () => ({ requireFinanceContext: mocks.context }));
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => ({ rpc: mocks.rpc }) }));
import { getDailyCashFlow } from "./finance-daily-cash-flow.service";

const context = {
  churchId: "church-a", congregationId: "some-unit", capabilities: { view: true },
  auth: { profile: { status: "ACTIVE" }, access: { role: "ADMIN", scope: "CHURCH", status: "ACTIVE" } },
};
const date = "2026-11-12";
const data = { date, box: null, summary: { opening: 200, income: 0, expense: 0, closing: 200 },
  cashboxes: [], categories: [], departments: [], methods: [], page: 1, total: 0, items: [] };

beforeEach(() => {
  vi.resetAllMocks();
  mocks.context.mockResolvedValue(context);
  mocks.rpc.mockResolvedValue({ data, error: null });
});

it("uses the authenticated church and sends no client unit or reference month", async () => {
  expect((await getDailyCashFlow({ date })).data).toEqual(data);
  expect(mocks.context).toHaveBeenCalledWith({ permission: "finance.view" });
  expect(mocks.rpc).toHaveBeenCalledWith("get_finance_daily_cash_flow", {
    p_church_id: "church-a", p_filters: expect.objectContaining({ date }),
  });
  await expect(getDailyCashFlow({ date, unidade: "other" })).rejects.toThrow();
});
it("requires active church-wide administrator access before querying", async () => {
  for (const access of [{ role: "TREASURER" }, { scope: "REGION" }, { status: "INACTIVE" }]) {
    mocks.context.mockResolvedValueOnce({ ...context, auth: { ...context.auth, access: { ...context.auth.access, ...access } } });
    await expect(getDailyCashFlow({ date })).rejects.toThrow("FORBIDDEN");
  }
  expect(mocks.rpc).not.toHaveBeenCalled();
});
it("rejects invalid dates, duplicate parameters, and invalid filter ids", async () => {
  for (const params of [{ date: "2026-02-30" }, { date: [date, date] }, { date, box: "invalid" }])
    await expect(getDailyCashFlow(params)).rejects.toThrow();
  expect(mocks.rpc).not.toHaveBeenCalled();
});
it("rejects a mismatched financial day or malformed amount", async () => {
  mocks.rpc.mockResolvedValueOnce({ data: { ...data, date: "2026-10-01" }, error: null });
  await expect(getDailyCashFlow({ date })).rejects.toThrow("UNAVAILABLE");
  mocks.rpc.mockResolvedValueOnce({ data: { ...data, summary: { ...data.summary, opening: 1.5 } }, error: null });
  await expect(getDailyCashFlow({ date })).rejects.toThrow("UNAVAILABLE");
});
