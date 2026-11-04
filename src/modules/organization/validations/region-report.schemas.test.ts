import { describe, expect, it } from "vitest";
import { regionReportSchema } from "./region-report.schemas";

describe("regionReportSchema", () => {
  it("defaults to all records rather than the current UI page", () => {
    expect(regionReportSchema.parse({ kind: "simplified", format: "xlsx" })).toEqual({ kind: "simplified", format: "xlsx", status: "ALL", search: "", sort: "ORDER" });
  });
  it.each([
    { kind: "individual", format: "xlsx", regionId: "00000000-0000-4000-8000-000000000001" },
    { kind: "individual", format: "pdf", regionId: "invalid" },
    { kind: "simplified", format: "pdf", churchId: "another-church" },
    { kind: "simplified", format: "pdf", page: 2 },
    { kind: "simplified", format: "pdf", status: "ARCHIVED" },
    { kind: "simplified", format: "pdf", search: "a".repeat(201) },
  ])("rejects invalid or privileged inputs: %j", (input) => {
    expect(regionReportSchema.safeParse(input).success).toBe(false);
  });
});
