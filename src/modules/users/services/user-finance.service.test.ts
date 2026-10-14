import { beforeEach, expect, it, vi } from "vitest";
import type { AuthContext } from "@/modules/auth/types/auth.types";
vi.mock("server-only", () => ({}));
const mocks = vi.hoisted(() => ({ units: vi.fn(), operators: vi.fn() }));
vi.mock("@/modules/finance/services/finance-access.service", () => ({ listFinanceUnits: mocks.units }));
vi.mock("@/modules/finance/services/finance-operator.service", () => ({ listFinanceOperators: mocks.operators }));
import { getUserFinanceOperations } from "./user-finance.service";
const auth = { church: { id: "church-a" }, permissions: ["finance.settings.manage"] } as AuthContext;
beforeEach(() => vi.clearAllMocks());
it("does not expose operational assignments to an administrator without financial permission", async () => {
  expect(await getUserFinanceOperations({ ...auth, permissions: ["users.view"] })).toBeNull();
  expect(mocks.units).not.toHaveBeenCalled();
  expect(mocks.operators).not.toHaveBeenCalled();
});
it("requires an authorized settings unit even when the permission key is present", async () => {
  mocks.units.mockResolvedValue([{ id: "unit-a", capabilities: { manageSettings: false } }]);
  expect(await getUserFinanceOperations(auth)).toBeNull();
  expect(mocks.operators).not.toHaveBeenCalled();
});
it("returns existing assignments with only server-authorized congregation options", async () => {
  mocks.units.mockResolvedValue([
    { id: "unit-a", name: "A", capabilities: { manageSettings: true } },
    { id: "unit-b", name: "B", capabilities: { manageSettings: true } },
  ]);
  mocks.operators.mockResolvedValue([{ id: "access-a", name: "Unused name", unitId: "unit-a", allowedUnitIds: ["unit-a", "foreign-unit"] }]);
  expect(await getUserFinanceOperations(auth)).toEqual({
    authorizationUnitId: "unit-a",
    assignments: [{ accessId: "access-a", unitId: "unit-a", units: [{ id: "unit-a", name: "A" }] }],
  });
});
