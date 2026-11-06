import { describe, expect, it } from "vitest";
import { memberReportSchema } from "./member-report.schemas";
import { getMemberReportColumns } from "../constants/member-report-fields";

describe("member report options", () => {
  it("accepts both simplified formats and defaults to all unarchived members", () => {
    for (const format of ["pdf", "xlsx"]) {
      const result = memberReportSchema.parse({ kind: "simplified", format });
      expect(result.filters).toMatchObject({ search: "", archived: false, sort: "name_asc" });
      expect(getMemberReportColumns(result, { viewRoles: true, viewSensitiveIdentity: true }).map((field) => field.key))
        .toEqual(["member_code", "full_name", "congregation", "whatsapp", "role"]);
    }
  });
  it("accepts zero through four optional columns after the two fixed ones", () => {
    for (const fields of [[], ["whatsapp"], ["congregation", "whatsapp", "role", "full_address"]]) {
      const result = memberReportSchema.parse({ kind: "custom", format: "pdf", fields });
      expect(getMemberReportColumns(result, { viewRoles: true, viewSensitiveIdentity: true }).map((field) => field.key))
        .toEqual(["member_code", "full_name", ...fields]);
    }
  });
  it.each([
    { kind: "complete", format: "pdf" },
    { kind: "custom", format: "xlsx", fields: ["whatsapp", "email", "role", "congregation", "birth_date"] },
    { kind: "custom", format: "pdf", fields: ["email", "email"] },
    { kind: "custom", format: "pdf", fields: ["full_name"] },
    { kind: "custom", format: "pdf", fields: ["pastoral_notes"] },
    { kind: "complete", format: "xlsx", churchId: "other" },
    { kind: "simplified", format: "xlsx", fields: ["notes"] },
    { kind: "simplified", format: "pdf", filters: { congregationId: "invalid" } },
    { kind: "simplified", format: "pdf", filters: { search: "x".repeat(81) } },
  ])("rejects an invalid or expanded request: %j", (input) => expect(memberReportSchema.safeParse(input).success).toBe(false));
  it("complete columns follow identity and role permissions and never include pastoral notes", () => {
    const options = memberReportSchema.parse({ kind: "complete", format: "xlsx" });
    const allowed = getMemberReportColumns(options, { viewRoles: true, viewSensitiveIdentity: true }).map((field) => field.key);
    expect(allowed).toEqual(expect.arrayContaining(["nationality", "natural_city", "natural_state", "profession", "education_level", "cpf", "rg", "issuing_agency", "role_start_date", "notes", "country"]));
    expect(allowed).not.toEqual(expect.arrayContaining(["pastoral_notes"]));
    const restricted = getMemberReportColumns(options, { viewRoles: false, viewSensitiveIdentity: false }).map((field) => field.key);
    for (const key of ["cpf", "rg", "issuing_agency", "role", "role_start_date"]) expect(restricted).not.toContain(key);
  });
});
