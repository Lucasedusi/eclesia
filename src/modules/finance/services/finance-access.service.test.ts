import { describe, expect, it } from "vitest";
import {
  selectFinanceUnit,
  financeCapabilities,
} from "../utils/finance-access";
import type { AuthContext } from "@/modules/auth/types/auth.types";

function auth(role = "ADMIN", scope = "CHURCH"): AuthContext {
  return {
    profile: { status: "ACTIVE" },
    church: { id: "church-a" },
    access: {
      role,
      scope,
      status: "ACTIVE",
      congregationId: scope === "CONGREGATION" ? "a" : null,
    },
    permissions: [
      "finance.view",
      "finance.transactions.create",
      "finance.settings.manage",
    ],
  } as AuthContext;
}
const units = [
  { id: "a", name: "A", isHeadquarters: false },
  { id: "hq", name: "Catedral", isHeadquarters: true },
];
describe("financial access", () => {
  it("defaults to headquarters for administrator", () =>
    expect(selectFinanceUnit(auth(), units)).toBe("hq"));
  it("defaults to assigned unit for operator", () =>
    expect(selectFinanceUnit(auth("TREASURER", "CONGREGATION"), units)).toBe(
      "a",
    ));
  it("rejects unit outside server-authorized list", () =>
    expect(() => selectFinanceUnit(auth(), units, "other-church")).toThrow(
      "FORBIDDEN",
    ));
  it("rejects suspended profile", () => {
    const a = auth();
    a.profile.status = "BLOCKED";
    expect(() => selectFinanceUnit(a, units)).toThrow("FORBIDDEN");
  });
  it("does not grant settings to a treasurer with the permission alone", () =>
    expect(
      financeCapabilities(auth("TREASURER", "CONGREGATION")).manageSettings,
    ).toBe(false));
  it("does not permit operations without an operational unit", () =>
    expect(financeCapabilities(auth("TREASURER", "REGION")).create).toBe(
      false,
    ));
  it("reports missing unit explicitly", () =>
    expect(() => selectFinanceUnit(auth(), [])).toThrow(
      "CONFIGURATION_REQUIRED",
    ));
});
