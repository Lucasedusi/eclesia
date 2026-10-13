import { describe, expect, it } from "vitest";
import { financeReportOptionsSchema } from "./finance-report.schemas";
describe("finance report options", () => {
  it.each(["ANALYTIC", "SYNTHETIC"])("accepts %s monthly reports", (type) => {
    expect(
      financeReportOptionsSchema.parse({ type, month: "2026-10" }),
    ).toEqual({ type, month: "2026-10" });
  });
  it.each([
    { type: "BAD", month: "2026-10" },
    { type: "ANALYTIC", month: "2026-13" },
    { type: "ANALYTIC", month: "2026-10", cashboxId: "bad" },
    { type: "SYNTHETIC", month: "2026-10", churchId: "injected" },
  ])("rejects invalid or extra options", (input) => {
    expect(financeReportOptionsSchema.safeParse(input).success).toBe(false);
  });
});
