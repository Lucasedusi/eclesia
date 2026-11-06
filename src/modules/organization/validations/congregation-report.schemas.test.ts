import { describe, expect, it } from "vitest";
import { congregationReportSchema } from "./congregation-report.schemas";
describe("congregation report options", () => {
  it("defaults to telephone without spouse or address", () => {
    expect(congregationReportSchema.parse({ kind: "simplified", format: "pdf" })).toMatchObject({ region: "ALL", congregationType: "ALL", fields: { spouse: false, phone: true, address: false } });
  });
  it.each([{ fields: { spouse: "true" } }, { fields: { arbitrary: true } }, { churchId: "other" }, { region: "invalid" }, { search: "a".repeat(201) }, { sort: "invalid" }])("rejects unsafe options %j", (options) => {
    expect(congregationReportSchema.safeParse({ kind: "simplified", format: "pdf", ...options }).success).toBe(false);
  });
  it("allows no optional columns and rejects xlsx individual sheets", () => {
    expect(congregationReportSchema.safeParse({ kind: "simplified", format: "xlsx", fields: { spouse: false, phone: false, address: false } }).success).toBe(true);
    expect(congregationReportSchema.safeParse({ kind: "individual", format: "xlsx", congregationId: "00000000-0000-4000-8000-000000000001" }).success).toBe(false);
  });
});
