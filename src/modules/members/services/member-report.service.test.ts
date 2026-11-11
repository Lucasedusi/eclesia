import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AuthContext } from "@/modules/auth/types/auth.types";
import { PERMISSIONS } from "@/modules/auth/constants/permissions";
import type { MemberReportDocument } from "../types/member-report.types";
import { memberReportSchema } from "../validations/member-report.schemas";
import { birthdayReportSchema } from "../validations/member-birthdays";
import { loadMemberReportDocument, generateMemberReportDownload } from "./member-report.service";

vi.mock("server-only", () => ({}));
const mocks = vi.hoisted(() => ({ client: vi.fn(), logo: vi.fn(), pdf: vi.fn(), workbook: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createClient: mocks.client }));
vi.mock("@/modules/auth/services/church-logo.service", () => ({ loadChurchLogoDataUri: mocks.logo }));
vi.mock("./member-report-pdf.service", () => ({ createMemberReportPdf: mocks.pdf }));
vi.mock("./member-report-workbook.service", () => ({ createMemberReportWorkbook: mocks.workbook }));
const church = "00000000-0000-4000-8000-000000000001", region = "00000000-0000-4000-8000-000000000002", congregation = "00000000-0000-4000-8000-000000000003";
const context = { church: { id: church, name: "Igreja de Teste", logoUrl: null }, access: { scope: "CHURCH", regionId: null, congregationId: null, ministryId: null }, permissions: Object.values(PERMISSIONS) } as AuthContext;
const simple = memberReportSchema.parse({ kind: "simplified", format: "pdf" });
type Row = Record<string, unknown>;
const member: Row = { id: "member-1", church_id: church, congregation_id: congregation, member_code: "00001", full_name: "Ana de Teste", gender: "FEMALE", deleted_at: null,
  member_status: "ACTIVE", member_type: "MEMBER", whatsapp: "11999998888", birth_date: "1990-02-10", nationality: "Brasileira", natural_city: "Goiânia", natural_state: "GO", profession: "Professora", education_level: "Superior", notes: "OBSERVACAO_GERAL", pastoral_notes: "SEGREDO_PASTORAL",
  congregations: { id: congregation, church_id: church, name: "Central", region_id: region, deleted_at: null, regions: { name: "Regional Central", church_id: church, deleted_at: null } },
  active_roles: [{ id: "link-1", church_id: church, status: "ACTIVE", deleted_at: null, start_date: "2020-01-01", title_variant: "AUTO", role_id: "00000000-0000-4000-8000-000000000005", roles: { church_id: church, deleted_at: null, name: "Diácono", female_name: "Diaconisa" } }],
  identity: { church_id: church, member_id: "member-1", deleted_at: null, cpf: "00000000191", rg: "RG-TESTE", issuing_agency: "SSP" },
};
function database(rows: Row[] = [member], mode: "normal" | "error" | "changed" | "duplicate" | "audit" = "normal") {
  const calls: { table: string; select: string; filters: [string, string, unknown][]; range?: [number, number] }[] = [];
  function from(table: string) {
    const call: typeof calls[number] = { table, select: "", filters: [] }; calls.push(call);
    const get = (row: Row, key: string): unknown => key.split(".").reduce<unknown>((v, part) => v && typeof v === "object" ? (v as Row)[part] : undefined, row);
    const result = () => {
      let data = table === "members" ? rows.map((row) => ({ ...row })) : table === "churches" ? [{ id: church, name: "Igreja de Teste", senior_pastor_name: "Paulo", senior_pastor_spouse_name: "Ana", deleted_at: null }] : [];
      for (const [key, op, expected] of call.filters) {
        if (key.startsWith("active_roles.") || key.startsWith("identity.") || key.startsWith("ministry_scope.")) continue;
        if (key.startsWith("congregations.") && !call.select.includes("congregations!inner")) continue;
        data = data.filter((row) => {
          const value = get(row, key);
          if (op === "in" && Array.isArray(expected)) return expected.includes(value);
          return op === "not" ? value !== expected : value === expected;
        });
      }
      const count = data.length + (mode === "changed" && call.range?.[0] ? 1 : 0);
      if (call.range) data = mode === "duplicate" && call.range[0] ? data.slice(0, 500) : data.slice(call.range[0], call.range[1] + 1);
      return { data, count, error: mode === "error" ? { message: "PRIVATE" } : null };
    };
    const q = { select: (select: string) => { call.select = select; return q; }, eq: (key: string, value: unknown) => { call.filters.push([key, "eq", value]); return q; },
      in: (key: string, values: string[]) => { call.filters.push([key, "in", values]); return q; },
      is: (key: string, value: unknown) => { call.filters.push([key, "is", value]); return q; }, not: (key: string, _op: string, value: unknown) => { call.filters.push([key, "not", value]); return q; },
      order: () => q, returns: () => q, range: (start: number, end: number) => { call.range = [start, end]; return q; },
      maybeSingle: async () => { const r = result(); return { ...r, data: r.data[0] ?? null }; }, then: (resolve: (value: ReturnType<typeof result>) => unknown) => Promise.resolve(result()).then(resolve) };
    return q;
  }
  const rpc = vi.fn(async () => ({ error: mode === "audit" ? { message: "PRIVATE" } : null }));
  mocks.client.mockResolvedValue({ from, rpc }); return { calls, rpc };
}
beforeEach(() => { vi.clearAllMocks(); mocks.logo.mockResolvedValue(null); mocks.pdf.mockResolvedValue(new Uint8Array([37,80,68,70])); mocks.workbook.mockResolvedValue(Buffer.from("xlsx")); });

describe("member report data", () => {
  it("omits matrícula from birthday PDFs and places birth date immediately before WhatsApp", async () => {
    database([{ ...member, birthday_mmdd: 210 }]);
    const options = birthdayReportSchema.parse({ kind: "birthdays", format: "pdf", filters: { period: "all" } });
    await generateMemberReportDownload(context, options);
    const [document] = mocks.pdf.mock.calls[0] as [MemberReportDocument];
    expect(document.columns.map((column) => column.key)).toEqual(["full_name", "congregation", "region", "role", "birth_date", "whatsapp"]);
    expect(document.rows[0].values).not.toHaveProperty("member_code");
    expect(document.rows[0].values).toMatchObject({ birth_date: "10/02/1990", whatsapp: "(11) 99999-8888" });
  });

  it("exports only selected fields and preserves church and archive boundaries", async () => {
    const db = database([member, { ...member, id: "other", church_id: "other" }, { ...member, id: "archived", deleted_at: "2026-01-01" }]);
    const doc = await loadMemberReportDocument(context, simple);
    expect(doc.rows).toHaveLength(1);
    expect(doc.rows[0].values).toEqual({ member_code: "00001", full_name: "Ana de Teste", congregation: "Central", whatsapp: "(11) 99999-8888", role: "Diaconisa" });
    expect(db.calls[0].select).not.toMatch(/identity|cpf|notes|nationality|\*/);
    expect(doc.church.pastorNames).toEqual(["Paulo", "Ana"]);
    expect(JSON.stringify(doc)).not.toMatch(/SEGREDO|OBSERVACAO|RG-TESTE/);
  });
  it.each(["members.export", "members.view_basic", "members.view_full"])("requires %s before reads", async (permission) => {
    database(); await expect(loadMemberReportDocument({ ...context, permissions: context.permissions.filter((p) => p !== permission) }, simple)).rejects.toThrow("MEMBER_REPORT_PERMISSION_DENIED"); expect(mocks.client).not.toHaveBeenCalled();
  });
  it("omits forbidden complete columns and rejects a forged custom identity column", async () => {
    const db = database(); const limited = { ...context, permissions: ["members.export", "members.view_basic", "members.view_full"] };
    const full = await loadMemberReportDocument(limited, memberReportSchema.parse({ kind: "complete", format: "xlsx" }));
    expect(full.columns.map((c) => c.key)).not.toContain("cpf"); expect(full.columns.map((c) => c.key)).not.toContain("role");
    expect(db.calls[0].select).not.toMatch(/identity|active_roles|pastoral/);
    await expect(loadMemberReportDocument(limited, memberReportSchema.parse({ kind: "custom", format: "xlsx", fields: ["cpf"] }))).rejects.toThrow("MEMBER_REPORT_PERMISSION_DENIED");
    expect((await loadMemberReportDocument(limited, simple)).rows[0].values.role).toBe("Informação restrita");
  });
  it("includes complete current registration, general notes and authorized identity only", async () => {
    database(); const full = await loadMemberReportDocument(context, memberReportSchema.parse({ kind: "complete", format: "xlsx" }));
    expect(full.rows[0].values).toMatchObject({ cpf: "000.000.001-91", role_start_date: "01/01/2020", nationality: "Brasileira", notes: "OBSERVACAO_GERAL" });
    expect(JSON.stringify(full)).not.toContain("SEGREDO_PASTORAL");
  });
  it("keeps authorized members when congregation metadata is hidden and supports combined naturality", async () => {
    const db = database([{ ...member, congregations: null }]);
    const doc = await loadMemberReportDocument(context, simple);
    expect(doc.rows).toHaveLength(1); expect(doc.rows[0].values.congregation).toBe("Informação indisponível");
    expect(db.calls[0].select).not.toContain("congregations!inner");
    const custom = await loadMemberReportDocument(context, memberReportSchema.parse({ kind: "custom", format: "xlsx", fields: ["natural_origin"] }));
    expect(custom.rows[0].values.natural_origin).toBe("Goiânia / GO");
  });
  it("applies text/CPF searches without the screen's 100-result cutoff", async () => {
    database(Array.from({ length: 120 }, (_, i) => ({ ...member, id: `m${i}`, identity: { ...(member.identity as Row), member_id: `m${i}` } })));
    const options = memberReportSchema.parse({ kind: "custom", format: "xlsx", fields: [], filters: { search: "000000001" } });
    expect((await loadMemberReportDocument(context, options)).rows).toHaveLength(120);
    const noIdentity = { ...context, permissions: context.permissions.filter((p) => p !== PERMISSIONS.membersViewSensitiveIdentity) };
    expect((await loadMemberReportDocument(noIdentity, options)).rows).toHaveLength(0);
    expect((await loadMemberReportDocument(context, { ...simple, filters: { ...simple.filters, search: "Ana" } })).rows).toHaveLength(120);
  });
  it("applies regional/congregational scope and all structured filters", async () => {
    const db = database();
    await loadMemberReportDocument({ ...context, access: { ...context.access, scope: "REGION", regionId: region } }, { ...simple, filters: { ...simple.filters, congregationId: congregation, status: "ACTIVE", memberType: "MEMBER" } });
    expect(db.calls[0].filters).toEqual(expect.arrayContaining([["congregations.region_id", "eq", region], ["congregation_id", "eq", congregation], ["member_status", "eq", "ACTIVE"], ["member_type", "eq", "MEMBER"]]));
    expect((await loadMemberReportDocument({ ...context, access: { ...context.access, scope: "CONGREGATION", congregationId: "other" } }, simple)).rows).toHaveLength(0);
  });
  it("requires restore for archives and validates ministry scope before reading", async () => {
    database(); const limited = { ...context, permissions: ["members.export", "members.view_basic", "members.view_full"] };
    await expect(loadMemberReportDocument(limited, { ...simple, filters: { ...simple.filters, archived: true } })).rejects.toThrow("MEMBER_REPORT_PERMISSION_DENIED");
    await expect(loadMemberReportDocument({ ...context, access: { ...context.access, scope: "MINISTRY" } }, simple)).rejects.toThrow("MEMBER_REPORT_PERMISSION_DENIED");
    const db = database(); const ministryId = "00000000-0000-4000-8000-000000000009";
    await loadMemberReportDocument({ ...context, access: { ...context.access, scope: "MINISTRY", ministryId } }, simple);
    expect(db.calls[0].select).toContain("ministry_scope:member_ministries!");
    expect(db.calls[0].filters).toContainEqual(["ministry_scope.ministry_id", "eq", ministryId]);
  });
  it("reads all pages and rejects inconsistent or excessive exports", async () => {
    const many = Array.from({ length: 1001 }, (_, i) => ({ ...member, id: `m${i}` }));
    database(many); expect((await loadMemberReportDocument(context, simple)).rows).toHaveLength(1001);
    for (const mode of ["changed", "duplicate", "error"] as const) { database(many, mode); await expect(loadMemberReportDocument(context, simple)).rejects.toThrow("MEMBER_REPORT_LOAD_FAILED"); }
    database(Array.from({ length: 10001 }, (_, i) => ({ ...member, id: `m${i}` }))); await expect(loadMemberReportDocument(context, simple)).rejects.toThrow("MEMBER_REPORT_TOO_LARGE");
  });
  it("audits without personal values, fails closed and returns the selected format", async () => {
    const db = database(); const result = await generateMemberReportDownload(context, { ...simple, format: "xlsx" });
    expect(result.contentType).toContain("spreadsheetml"); expect(result.fileName).toBe("lista-membros-simplificada.xlsx");
    expect(db.rpc).toHaveBeenCalledWith("log_audit", expect.objectContaining({ p_action: "EXPORT_MEMBER_REPORT", p_church_id: church }));
    expect(JSON.stringify(db.rpc.mock.calls)).not.toMatch(/Ana de Teste|11999998888|00000000191/);
    database([member], "audit"); await expect(generateMemberReportDownload(context, simple)).rejects.toThrow("MEMBER_REPORT_AUDIT_FAILED");
  });
});
