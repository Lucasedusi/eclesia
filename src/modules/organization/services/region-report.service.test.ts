import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AuthContext } from "@/modules/auth/types/auth.types";
import { loadRegionReportDocument, generateRegionReportDownload } from "./region-report.service";

const mocks = vi.hoisted(() => ({ client: vi.fn(), logo: vi.fn(), pdf: vi.fn(), workbook: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/server", () => ({ createClient: mocks.client }));
vi.mock("@/modules/auth/services/church-logo.service", () => ({ loadChurchLogoDataUri: mocks.logo }));
vi.mock("./region-report-pdf.service", () => ({ createRegionReportPdf: mocks.pdf }));
vi.mock("./region-report-workbook.service", () => ({ createRegionReportWorkbook: mocks.workbook }));

const churchId = "00000000-0000-4000-8000-000000000001";
const regionId = "00000000-0000-4000-8000-000000000002";
const context = { church: { id: churchId, name: "Igreja teste", logoUrl: null }, access: { scope: "CHURCH", regionId: null, congregationId: null }, permissions: ["organization.view", "regions.reports.export"] } as AuthContext;
const simple = { kind: "simplified", format: "pdf", search: "", status: "ALL", sort: "ORDER" } as const;
const individual = { kind: "individual", format: "pdf", regionId, congregationStatus: "ALL" } as const;
const region = { id: regionId, church_id: churchId, name: "Regional São José", coordinator_name: "Maria Teste", coordinator_phone: "11933334444", description: "Área central", status: "ACTIVE", display_order: 0, created_at: "2026-01-01", deleted_at: null };
const congregation = { id: "congregation-1", church_id: churchId, region_id: regionId, name: "Congregação Central", pastor_name: "Dirigente Teste", whatsapp: "11999998888", phone: "1133334444", status: "ACTIVE", deleted_at: null };
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

describe("regional reports authorization and data", () => {
  it.each(["organization.view", "regions.reports.export"])("denies before querying without %s", async (permission) => {
    database();
    await expect(loadRegionReportDocument({ ...context, permissions: context.permissions.filter((p) => p !== permission) }, simple)).rejects.toThrow("REGION_REPORT_PERMISSION_DENIED");
    expect(mocks.client).not.toHaveBeenCalled();
  });
  it("uses current church, excludes archived records and exports an explicit safe projection", async () => {
    const db = database({ regions: [region, { ...region, id: "other", church_id: "other" }, { ...region, id: "archived", deleted_at: "2026-01-01" }] });
    const doc = await loadRegionReportDocument(context, simple);
    expect(doc.regions).toHaveLength(1);
    expect(doc.regions[0]).toMatchObject({ name: region.name, coordinatorPhone: "(11) 93333-4444" });
    expect(db.calls.find((c) => c.table === "regions")?.filters).toEqual(expect.arrayContaining([["church_id", churchId], ["deleted_at", null]]));
    expect(db.calls.some((c) => c.select.includes("*") || c.select.includes("notes"))).toBe(false);
  });
  it.each([
    ["11999998888", "1133334444", "(11) 99999-8888"],
    ["  ", "1133334444", "(11) 3333-4444"],
    [null, null, "Não informado"],
  ])("prefers WhatsApp, then telephone, then missing label", async (whatsapp, phone, expected) => {
    database({ congregations: [{ ...congregation, whatsapp, phone }] });
    expect((await loadRegionReportDocument(context, individual)).congregations[0].contactPhone).toBe(expected);
  });
  it("filters case/accents and sorts the complete collection", async () => {
    database({ regions: [region, { ...region, id: "b", name: "Outra", status: "INACTIVE" }] });
    expect((await loadRegionReportDocument(context, { ...simple, search: "sao jose", status: "ACTIVE", sort: "NAME" })).regions.map((r) => r.id)).toEqual([regionId]);
  });
  it("loads more than 1000 records without truncation", async () => {
    database({ regions: Array.from({ length: 1001 }, (_, i) => ({ ...region, id: `r${i}`, name: `Regional ${i}` })) });
    const doc = await loadRegionReportDocument(context, simple);
    expect(doc.regions).toHaveLength(1001);
    expect(doc.regions.some((r) => r.id === "r1000")).toBe(true);
  });
  it.each([{ changedCount: true }, { duplicatePage: true }])("rejects inconsistent pages %j", async (options) => {
    database({ regions: Array.from({ length: 501 }, (_, i) => ({ ...region, id: `r${i}` })) }, options);
    await expect(loadRegionReportDocument(context, simple)).rejects.toThrow("REGION_REPORT_LOAD_FAILED");
  });
  it("rejects collections above the limit", async () => {
    database({ regions: Array.from({ length: 10001 }, (_, i) => ({ ...region, id: `r${i}` })) });
    await expect(loadRegionReportDocument(context, simple)).rejects.toThrow("REGION_REPORT_TOO_LARGE");
  });
  it("limits a regional session to its regional", async () => {
    database({ regions: [region, { ...region, id: "other" }] });
    const scoped = { ...context, access: { ...context.access, scope: "REGION" as const, regionId } };
    const doc = await loadRegionReportDocument(scoped, simple);
    expect(doc.regions).toHaveLength(1);
    expect(doc.scopeLabel).toContain("autorizados");
    await expect(loadRegionReportDocument(scoped, { ...individual, regionId: "other" })).rejects.toThrow("REGION_REPORT_NOT_FOUND");
  });
  it("limits congregational access and marks a partial regional view", async () => {
    database({ congregations: [congregation, { ...congregation, id: "other-congregation" }] });
    const doc = await loadRegionReportDocument({ ...context, access: { ...context.access, scope: "CONGREGATION", congregationId: congregation.id } }, individual);
    expect(doc.congregations).toHaveLength(1);
    expect(doc.scopeLabel).toContain("autorizados");
  });
  it("does not broaden ministry or malformed scopes", async () => {
    database();
    await expect(loadRegionReportDocument({ ...context, access: { ...context.access, scope: "MINISTRY" } }, simple)).rejects.toThrow("REGION_REPORT_PERMISSION_DENIED");
    await expect(loadRegionReportDocument({ ...context, access: { ...context.access, scope: "REGION", regionId: null } }, simple)).rejects.toThrow("REGION_REPORT_PERMISSION_DENIED");
  });
  it("does not return a report for an invisible regional", async () => {
    database({ regions: [] });
    await expect(loadRegionReportDocument(context, individual)).rejects.toThrow("REGION_REPORT_NOT_FOUND");
  });
  it("fails closed on query errors", async () => {
    database({}, { errorTable: "congregations" });
    await expect(loadRegionReportDocument(context, individual)).rejects.toThrow("REGION_REPORT_LOAD_FAILED");
  });
  it("audits exports without personal content", async () => {
    const db = database();
    const result = await generateRegionReportDownload(context, individual);
    expect(result.fileName).toMatch(/^ficha-regional-.*\.pdf$/);
    expect(db.rpc).toHaveBeenCalledWith("log_audit", expect.objectContaining({ p_church_id: churchId, p_entity_id: regionId, p_action: "EXPORT_REGION_REPORT" }));
    expect(JSON.stringify(db.rpc.mock.calls)).not.toContain(region.coordinator_name);
    expect(JSON.stringify(db.rpc.mock.calls)).not.toContain(congregation.whatsapp);
  });
  it("blocks downloads if audit fails", async () => {
    database({}, { auditError: true });
    await expect(generateRegionReportDownload(context, simple)).rejects.toThrow("REGION_REPORT_AUDIT_FAILED");
  });
  it("uses the workbook generator for xlsx", async () => {
    database();
    const result = await generateRegionReportDownload(context, { ...simple, format: "xlsx" });
    expect(result.contentType).toContain("spreadsheetml.sheet");
    expect(result.fileName).toMatch(/\.xlsx$/);
    expect(mocks.pdf).not.toHaveBeenCalled();
  });
});
