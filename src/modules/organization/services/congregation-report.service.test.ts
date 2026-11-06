import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AuthContext } from "@/modules/auth/types/auth.types";
import { loadCongregationReportDocument, generateCongregationReportDownload } from "./congregation-report.service";

const mocks = vi.hoisted(() => ({ client: vi.fn(), logo: vi.fn(), pdf: vi.fn(), workbook: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/server", () => ({ createClient: mocks.client }));
vi.mock("@/modules/auth/services/church-logo.service", () => ({ loadChurchLogoDataUri: mocks.logo }));
vi.mock("./congregation-report-pdf.service", () => ({ createCongregationReportPdf: mocks.pdf }));
vi.mock("./congregation-report-workbook.service", () => ({ createCongregationReportWorkbook: mocks.workbook }));

const churchId = "00000000-0000-4000-8000-000000000001";
const regionId = "00000000-0000-4000-8000-000000000002";
const context = { church: { id: churchId, name: "Igreja teste", logoUrl: null }, access: { scope: "CHURCH", regionId: null, congregationId: null }, permissions: ["organization.view", "congregations.reports.export"] } as AuthContext;
const simple = { kind: "simplified", format: "pdf", search: "", status: "ALL", sort: "ORDER", region: "ALL", congregationType: "ALL", fields: { spouse: false, phone: true, address: false } } as const;
const individual = { kind: "individual", format: "pdf", congregationId: "congregation-1" } as const;
const region = { id: regionId, church_id: churchId, name: "Regional São José", coordinator_name: "Maria Teste", coordinator_phone: "11933334444", description: "Área central", status: "ACTIVE", display_order: 0, created_at: "2026-01-01", deleted_at: null };
const congregation = { id: "congregation-1", church_id: churchId, region_id: regionId, name: "Congregação Central", pastor_name: "Dirigente Teste", pastor_spouse_name: "Cônjuge Teste", email: "contato@example.invalid", notes: "Nota privada", city: "São Paulo", is_headquarters: false, regions: { name: "Regional São José", church_id: churchId, deleted_at: null }, whatsapp: "11999998888", phone: "1133334444", status: "ACTIVE", deleted_at: null };
type Row = Record<string, unknown>;

function database(overrides: Record<string, Row[] > = {}, options: { errorTable?: string; auditError?: boolean; changedCount?: boolean; duplicatePage?: boolean } = {}) {
  const records: Record<string, Row[]> = { regions: [region], congregations: [congregation], churches: [{ id: churchId, name: "Igreja teste", deleted_at: null }], app_settings: [], ...overrides };
  const calls: { table: string; select: string; filters: [string, unknown][]; range?: [number, number] }[] = [];
  const from = vi.fn((table: string) => {
    const call: typeof calls[number] = { table, select: "", filters: [] };
    calls.push(call);
    let range: [number, number] | undefined;
    const result = () => {
      let data = (records[table] ?? []).filter((row) => call.filters.every(([key, value]) => row[key] === value));
      const count = data.length + (options.changedCount && range && range[0] > 0 ? 1 : 0);
      if (range) data = options.duplicatePage && range[0] > 0 ? data.slice(0, range[1] - range[0] + 1) : data.slice(range[0], range[1] + 1);
      return { data, count, error: options.errorTable === table ? { message: "PRIVATE" } : null };
    };
    const q = {
      select: (columns: string) => { call.select = columns; return q; },
      eq: (key: string, value: unknown) => { call.filters.push([key, value]); return q; },
      is: (key: string, value: unknown) => { call.filters.push([key, value]); return q; },
      order: () => q,
      range: (start: number, end: number) => { range = [start, end]; call.range = range; return q; },
      maybeSingle: async () => { const r = result(); return { ...r, data: r.data[0] ?? null }; },
      then: (resolve: (value: ReturnType<typeof result>) => unknown) => Promise.resolve(result()).then(resolve),
    };
    return q;
  });
  const rpc = vi.fn(async () => ({ error: options.auditError ? { message: "PRIVATE" } : null, data: true }));
  mocks.client.mockResolvedValue({ from, rpc });
  return { from, calls, rpc };
}

beforeEach(() => { vi.clearAllMocks(); mocks.logo.mockResolvedValue(null); mocks.pdf.mockResolvedValue(new Uint8Array([37, 80, 68, 70])); mocks.workbook.mockResolvedValue(Buffer.from("xlsx")); });

describe("congregation report data", () => {
  it("loads only the active church's registered pastoral names", async () => {
    const db = database({ churches: [
      { id: "other", name: "Other church", senior_pastor_name: "Other pastor", deleted_at: null },
      { id: churchId, name: "Igreja teste", senior_pastor_name: "  Paulo Silva  ", senior_pastor_spouse_name: "Ana Silva", deleted_at: null },
    ] });
    const doc = await loadCongregationReportDocument(context, simple);
    expect(doc.church.pastorNames).toEqual(["Paulo Silva", "Ana Silva"]);
    expect(db.calls.find((call) => call.table === "churches")!.select).toContain("senior_pastor_name, senior_pastor_spouse_name");
  });
  it.each(["organization.view", "congregations.reports.export"])("requires %s before data reads", async (permission) => {
    database();
    await expect(loadCongregationReportDocument({ ...context, permissions: context.permissions.filter((p) => p !== permission) }, simple)).rejects.toThrow("CONGREGATION_REPORT_PERMISSION_DENIED");
    expect(mocks.client).not.toHaveBeenCalled();
  });
  it("filters tenant/archive and selects optional personal fields only when requested", async () => {
    const db = database({ congregations: [congregation, { ...congregation, id: "other", church_id: "other" }, { ...congregation, id: "archived", deleted_at: "yesterday" }] });
    const doc = await loadCongregationReportDocument(context, simple);
    expect(doc.congregations).toHaveLength(1);
    expect(doc.congregations[0]).toMatchObject({ regionName: "Regional São José", contactPhone: "(11) 99999-8888" });
    expect(doc.congregations[0].spouseName).toBeUndefined();
    expect(doc.congregations[0]).not.toHaveProperty("email");
    expect(db.calls.find((c) => c.table === "congregations")!.select).not.toMatch(/pastor_spouse_name|notes|email|\*/);
  });
  it("includes spouse and full address only when selected", async () => {
    const db = database({ congregations: [{ ...congregation, address: "Rua A", number: "10", complement: "Sala 1", district: "Centro", state: "SP", zip_code: "01001000" }] });
    const doc = await loadCongregationReportDocument(context, { ...simple, fields: { spouse: true, phone: false, address: true } });
    expect(doc.congregations[0].spouseName).toBe("Cônjuge Teste");
    expect(doc.congregations[0].address!.full).toContain("Sala 1");
    expect(doc.congregations[0].contactPhone).toBeUndefined();
    expect(db.calls.find((c) => c.table === "congregations")!.select).not.toMatch(/whatsapp|phone/);
  });
  it.each([["11999998888", "1133334444", "(11) 99999-8888"], ["  ", "1133334444", "(11) 3333-4444"], [null, null, "Não informado"]])("prioritizes registered contact", async (whatsapp, phone, expected) => {
    database({ congregations: [{ ...congregation, whatsapp, phone }] });
    expect((await loadCongregationReportDocument(context, simple)).congregations[0].contactPhone).toBe(expected);
  });
  it("honors status, regional, type and accent-insensitive search", async () => {
    database({ congregations: [congregation, { ...congregation, id: "inactive", status: "INACTIVE" }, { ...congregation, id: "hq", is_headquarters: true }] });
    const doc = await loadCongregationReportDocument(context, { ...simple, search: "sao jose", status: "ACTIVE", region: regionId, congregationType: "CONGREGATION" });
    expect(doc.congregations.map((c) => c.id)).toEqual([congregation.id]);
  });
  it("allows a congregation without regional and does not broaden its scope", async () => {
    database({ congregations: [{ ...congregation, region_id: null, regions: null }, { ...congregation, id: "other" }] });
    const scoped = { ...context, access: { ...context.access, scope: "CONGREGATION" as const, congregationId: congregation.id } };
    expect((await loadCongregationReportDocument(scoped, { ...simple, region: "NONE" })).congregations).toHaveLength(1);
    await expect(loadCongregationReportDocument(scoped, { ...individual, congregationId: "other" })).rejects.toThrow("CONGREGATION_REPORT_NOT_FOUND");
  });
  it("enforces regional scope on individual and list reports", async () => {
    database({ congregations: [congregation, { ...congregation, id: "other", region_id: "other" }] });
    const scoped = { ...context, access: { ...context.access, scope: "REGION" as const, regionId } };
    expect((await loadCongregationReportDocument(scoped, simple)).congregations).toHaveLength(1);
    await expect(loadCongregationReportDocument(scoped, { ...individual, congregationId: "other" })).rejects.toThrow("CONGREGATION_REPORT_NOT_FOUND");
  });
  it.each(["MINISTRY", "REGION", "CONGREGATION"] as const)("rejects unsupported or incomplete %s scope", async (scope) => {
    database();
    await expect(loadCongregationReportDocument({ ...context, access: { ...context.access, scope } }, simple)).rejects.toThrow("CONGREGATION_REPORT_PERMISSION_DENIED");
  });
  it("loads all pages beyond 1000 rows", async () => {
    database({ congregations: Array.from({ length: 1001 }, (_, i) => ({ ...congregation, id: `c${i}` })) });
    expect((await loadCongregationReportDocument(context, simple)).congregations).toHaveLength(1001);
  });
  it.each([{ changedCount: true }, { duplicatePage: true }])("rejects inconsistent pages", async (options) => {
    database({ congregations: Array.from({ length: 501 }, (_, i) => ({ ...congregation, id: `c${i}` })) }, options);
    await expect(loadCongregationReportDocument(context, simple)).rejects.toThrow("CONGREGATION_REPORT_LOAD_FAILED");
  });
  it("rejects oversize reports and query failures", async () => {
    database({ congregations: Array.from({ length: 10001 }, (_, i) => ({ ...congregation, id: `c${i}` })) });
    await expect(loadCongregationReportDocument(context, simple)).rejects.toThrow("CONGREGATION_REPORT_TOO_LARGE");
    database({}, { errorTable: "congregations" });
    await expect(loadCongregationReportDocument(context, simple)).rejects.toThrow("CONGREGATION_REPORT_LOAD_FAILED");
  });
  it("exports the individual fields and audits without personal content", async () => {
    const db = database();
    const doc = await loadCongregationReportDocument(context, individual);
    expect(doc.congregations[0]).toMatchObject({ whatsapp: "(11) 99999-8888", spouseName: congregation.pastor_spouse_name, notes: congregation.notes });
    expect(doc.congregations[0]).not.toHaveProperty("email");
    expect(db.calls.find((c) => c.table === "congregations")!.select).not.toMatch(/email|\bphone\b/);
    expect((await generateCongregationReportDownload(context, individual)).fileName).toMatch(/^ficha-congregacao-/);
    expect(db.rpc).toHaveBeenCalledWith("log_audit", expect.objectContaining({ p_entity_id: congregation.id, p_action: "EXPORT_CONGREGATION_REPORT" }));
    expect(JSON.stringify(db.rpc.mock.calls)).not.toMatch(/Nota privada|Cônjuge Teste|11999998888/);
  });
  it("does not label a regular phone as WhatsApp in the sheet", async () => {
    database({ congregations: [{ ...congregation, whatsapp: null }] });
    expect((await loadCongregationReportDocument(context, individual)).congregations[0].whatsapp).toBe("Não informado");
  });
  it("fails closed on audit failure and selects workbook format", async () => {
    database({}, { auditError: true });
    await expect(generateCongregationReportDownload(context, simple)).rejects.toThrow("CONGREGATION_REPORT_AUDIT_FAILED");
    database();
    expect((await generateCongregationReportDownload(context, { ...simple, format: "xlsx" })).contentType).toContain("spreadsheetml");
  });
});
