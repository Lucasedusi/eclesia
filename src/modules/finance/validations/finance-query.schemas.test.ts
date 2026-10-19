import { describe, expect, it } from "vitest";
import { financeFiltersSchema } from "./finance-query.schemas";

describe("transaction date intervals", () => {
  it("accepts an inclusive range across months without changing the selected month", () => {
    const result = financeFiltersSchema.safeParse({ month: "2026-10", dateFrom: "2026-09-29", dateTo: "2026-10-05" });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data).toMatchObject({ month: "2026-10", dateFrom: "2026-09-29", dateTo: "2026-10-05" });
  });
  it("keeps monthly queries backwards compatible and accepts a single day", () => {
    expect(financeFiltersSchema.safeParse({ month: "2026-10" }).success).toBe(true);
    expect(financeFiltersSchema.safeParse({ month: "2026-10", dateFrom: "2024-02-29", dateTo: "2024-02-29" }).success).toBe(true);
  });
  it.each([
    { dateFrom: "2026-10-01" }, { dateTo: "2026-10-01" },
    { dateFrom: "2026-10-02", dateTo: "2026-10-01" },
    { dateFrom: "2026-02-30", dateTo: "2026-03-01" },
    { dateFrom: "1999-12-31", dateTo: "2026-10-01" },
    { dateFrom: "2026-10-01", dateTo: "2100-01-01" },
    { dateFrom: ["2026-10-01"], dateTo: "2026-10-01" },
  ])("rejects incomplete, invalid or reversed intervals: %j", (range) => {
    expect(financeFiltersSchema.safeParse({ month: "2026-10", ...range }).success).toBe(false);
  });
});
