import { beforeEach, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
const mocks = vi.hoisted(() => ({ rpc: vi.fn(), auth: vi.fn(), units: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => ({ rpc: mocks.rpc }) }));
vi.mock("@/modules/auth/services/access-context.service", () => ({ requireAccessContext: mocks.auth }));
vi.mock("./finance-access.service", () => ({ listFinanceUnits: mocks.units }));
import { requirePayableContext, queryFinancePayables, submitFinancePayable } from "./finance-payable.service";
const churchId = "20000000-0000-4000-8000-000000000001";
const headquartersId = "30000000-0000-4000-8000-000000000002";
const auth = { church: { id: churchId }, profile: { status: "ACTIVE" }, access: { status: "ACTIVE", role: "ADMIN", scope: "CHURCH" }, permissions: ["finance.payables.manage"] };
beforeEach(() => {
  vi.clearAllMocks(); mocks.auth.mockResolvedValue(auth);
  mocks.units.mockResolvedValue([{ id: "other", isHeadquarters: false }, { id: headquartersId, isHeadquarters: true, capabilities: { view: true } }]);
});
it("resolves headquarters independently of other selected units", async () => {
  expect((await requirePayableContext()).congregationId).toBe(headquartersId);
});
it("denies non-admins and missing or ambiguous headquarters", async () => {
  mocks.auth.mockResolvedValueOnce({ ...auth, access: { ...auth.access, role: "TREASURER" } });
  await expect(requirePayableContext()).rejects.toThrow("FORBIDDEN");
  mocks.units.mockResolvedValueOnce([]);
  await expect(requirePayableContext()).rejects.toThrow("CONFIGURATION_REQUIRED");
  mocks.units.mockResolvedValueOnce([{ id: headquartersId, isHeadquarters: true }, { id: "duplicate", isHeadquarters: true }]);
  await expect(requirePayableContext()).rejects.toThrow("CONFIGURATION_REQUIRED");
});
it("rejects malformed database responses and never exposes provider error text", async () => {
  mocks.rpc.mockResolvedValueOnce({ data: { items: [] }, error: null });
  await expect(queryFinancePayables({ month: "2026-10" })).rejects.toThrow("UNAVAILABLE");
  mocks.rpc.mockResolvedValueOnce({ data: null, error: { message: "secret provider internals" } });
  await expect(queryFinancePayables({ month: "2026-10" })).rejects.toThrow("UNAVAILABLE");
});
it("rejects client ownership and returns commands only after server-owned authorization", async () => {
  const cmd = { kind: "CREATE", requestId: headquartersId, values: { name: "Rent", categoryId: headquartersId, dueDate: "2026-10-31", amountCents: null, notes: "" } };
  await expect(submitFinancePayable({ ...cmd, churchId: "wrong" })).rejects.toThrow();
  expect(mocks.rpc).not.toHaveBeenCalled();
  mocks.rpc.mockResolvedValueOnce({ data: { id: headquartersId }, error: null });
  expect(await submitFinancePayable(cmd)).toEqual({ data: { id: headquartersId }, churchId });
  expect(mocks.rpc).toHaveBeenCalledWith("execute_finance_payable", { p_church_id: churchId, p_command: cmd });
});
