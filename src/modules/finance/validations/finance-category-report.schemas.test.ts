import { expect, it } from "vitest";
import { categoryReportOptionsSchema } from "./finance-category-report.schemas";
const category = "30000000-0000-4000-8000-000000000001";
const options = {
  type: "CATEGORY",
  dateFrom: "2026-01-01",
  dateTo: "2026-12-31",
  direction: "EXPENSE",
  presentation: "SUMMARY",
  categoryIds: [category],
};
it("accepts arbitrary inclusive periods, including a single day and leap day", () => {
  expect(categoryReportOptionsSchema.safeParse(options).success).toBe(true);
  expect(
    categoryReportOptionsSchema.safeParse({
      ...options,
      dateFrom: "2024-02-29",
      dateTo: "2024-02-29",
    }).success,
  ).toBe(true);
});
it.each([
  { dateFrom: "2026-02-29" },
  { dateFrom: "2027-01-01" },
  { categoryIds: [] },
  { categoryIds: [category, category] },
  { categoryIds: ["invalid"] },
  { direction: "ALL" },
  { presentation: "OTHER" },
  { churchId: category },
  { cashboxId: "invalid" },
])("rejects invalid or ambiguous filters %j", (change) => {
  expect(
    categoryReportOptionsSchema.safeParse({ ...options, ...change }).success,
  ).toBe(false);
});
