import { expect, it } from "vitest";
import { financeInformativeReportOptionsSchema } from "./finance-informative-report.schemas";
const options = {
  type: "INFORMATIVE",
  startMonth: "2026-11",
  endMonth: "2027-01",
  includePrebend: true,
  includeTransfer: false,
};
it("accepts an inclusive range across years and independent optional columns", () => {
  expect(financeInformativeReportOptionsSchema.parse(options)).toEqual(options);
});
it.each([
  { startMonth: "2026-13" },
  { endMonth: "2026-10" },
  { startMonth: "2000-01", endMonth: "2099-12" },
  { includePrebend: "false" },
  { cashboxId: "30000000-0000-4000-8000-000000000001" },
])("rejects invalid, excessive or cashbox-filtered ranges: %j", (change) => {
  expect(
    financeInformativeReportOptionsSchema.safeParse({ ...options, ...change })
      .success,
  ).toBe(false);
});
