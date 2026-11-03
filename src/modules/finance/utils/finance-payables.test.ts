import { describe, expect, it } from "vitest";
import { canManagePayables, nextPayableDate, payableStatus } from "./finance-payables";

describe("payable calendar and administrative scope", () => {
  it.each([
    ["2026-01-31", "2026-02-28"], ["2028-01-31", "2028-02-29"],
    ["2026-03-31", "2026-04-30"], ["2026-12-31", "2027-01-31"],
  ])("copies %s into %s", (date, expected) => expect(nextPayableDate(date)).toBe(expected));
  it("distinguishes today, overdue and paid without moving the due date", () => {
    expect(payableStatus("PENDING", "2026-10-29", "2026-10-30")).toBe("OVERDUE");
    expect(payableStatus("PENDING", "2026-10-30", "2026-10-30")).toBe("TODAY");
    expect(payableStatus("PENDING", "2026-10-31", "2026-10-30")).toBe("PENDING");
    expect(payableStatus("PAID", "2026-10-01", "2026-11-03")).toBe("PAID");
  });
  it("denies a treasurer even with an explicit payable permission", () => {
    const auth = { profile: { status: "ACTIVE" }, access: { status: "ACTIVE", role: "ADMIN", scope: "CHURCH" }, permissions: ["finance.payables.manage"] };
    expect(canManagePayables(auth)).toBe(true);
    expect(canManagePayables({ ...auth, access: { ...auth.access, role: "TREASURER" } })).toBe(false);
    expect(canManagePayables({ ...auth, access: { ...auth.access, scope: "CONGREGATION" } })).toBe(false);
    expect(canManagePayables({ ...auth, profile: { status: "BLOCKED" } })).toBe(false);
    expect(canManagePayables({ ...auth, permissions: [] })).toBe(false);
  });
});
