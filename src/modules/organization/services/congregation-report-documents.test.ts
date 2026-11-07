import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { PDFDocument, PDFPage } from "pdf-lib";
import ExcelJS from "exceljs";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createCongregationReportPdf } from "./congregation-report-pdf.service";
import { createCongregationReportWorkbook } from "./congregation-report-workbook.service";
import { congregationReportFixture } from "./congregation-report.fixtures";
vi.mock("server-only", () => ({}));
afterEach(() => vi.restoreAllMocks());
async function save(name: string, bytes: Uint8Array) { if (process.env.CONGREGATION_REPORT_QA_DIR) { await mkdir(process.env.CONGREGATION_REPORT_QA_DIR, { recursive: true }); await writeFile(path.join(process.env.CONGREGATION_REPORT_QA_DIR, name), bytes); } }
const combinations = Array.from({ length: 8 }, (_, mask) => ({ spouse: !!(mask & 1), phone: !!(mask & 2), address: !!(mask & 4) }));
describe("congregation report documents", () => {
  it.each(combinations)("renders only selected PDF and Excel fields %j", async (fields) => {
    const drawn = vi.spyOn(PDFPage.prototype, "drawText");
    const data = congregationReportFixture("simplified", fields);
    const bytes = await createCongregationReportPdf(data);
    const pdf = await PDFDocument.load(bytes);
    expect(pdf.getPage(0).getSize()).toEqual(fields.address ? { width: 841.89, height: 595.28 } : { width: 595.28, height: 841.89 });
    const text = drawn.mock.calls.map(([s]) => s).join(" ");
    expect(text).toContain("LISTA DE CONGREGAÇÕES");
    expect(text).toContain("Presidentes: Paulo e Ana");
    expect(text).not.toContain("Pastores:");
    expect(text).not.toContain(data.church.document!);
    expect(text).not.toContain(data.church.phone!);
    expect(text.includes("WHATSAPP")).toBe(fields.phone);
    expect(text).toContain("Regional São José");
    expect(text.includes("Maria de Souza")).toBe(fields.spouse);
    expect(text.includes("99999-8888")).toBe(fields.phone);
    expect(text.includes("Rua das Flores, 100 · Salão 2")).toBe(fields.address);
    const regional = drawn.mock.calls.find(([s]) => s === "Regional São José")!;
    const name = drawn.mock.calls.find(([s]) => s === "Congregação Central")!;
    expect(regional[1]!.size).toBeLessThan(name[1]!.size!);
    const wb = new ExcelJS.Workbook(); await wb.xlsx.load(await createCongregationReportWorkbook(data) as never);
    const headers = wb.worksheets[0].getRow(6).values as string[];
    expect(headers).toContain("Regional");
    expect(headers.includes("Cônjuge")).toBe(fields.spouse);
    expect(headers.includes("WhatsApp")).toBe(fields.phone);
    expect(headers.includes("Endereço")).toBe(fields.address);
    await save(`lista-${Number(fields.spouse)}${Number(fields.phone)}${Number(fields.address)}.pdf`, bytes);
  });
  it("groups the sheet title and regional below the leadership header, retaining address and notes", async () => {
    const drawn = vi.spyOn(PDFPage.prototype, "drawText");
    const data = congregationReportFixture("individual");
    const bytes = await createCongregationReportPdf(data);
    const text = drawn.mock.calls.map(([s]) => s).join(" ");
    for (const label of ["Presidentes: Paulo e Ana", "Dirigente: João de Souza", "Maria de Souza", "(11) 99999-8888", "ENDEREÇO", "OBSERVAÇÃO", "CONGREGAÇÃO CENTRAL", "Salão 2", data.congregations[0].notes!]) expect(text).toContain(label);
    for (const label of ["LIDERANÇA E CONTATO", "Pastores:", "E-MAIL", data.church.document!, data.church.phone!]) expect(text).not.toContain(label);
    const y = (label: string) => drawn.mock.calls.find(([s]) => s === label)![1]!.y!;
    expect(y("CONGREGAÇÃO CENTRAL") - y("Regional São José")).toBeLessThan(y("Regional São José") - y("ENDEREÇO"));
    expect((await PDFDocument.load(bytes)).getPageCount()).toBe(1);
    await save("ficha.pdf", bytes);
  });
  it("omits empty complement/observation and handles a missing address", async () => {
    const drawn = vi.spyOn(PDFPage.prototype, "drawText");
    const data = congregationReportFixture("individual"); data.congregations[0].notes = ""; data.congregations[0].address = undefined;
    await createCongregationReportPdf(data);
    const text = drawn.mock.calls.map(([s]) => s).join(" ");
    expect(text).not.toContain("COMPLEMENTO"); expect(text).not.toContain("OBSERVAÇÃO"); expect(text).toContain("Não informado");
  });
  it("paginates dynamic columns and maintains all indices", async () => {
    const drawn = vi.spyOn(PDFPage.prototype, "drawText");
    const data = congregationReportFixture("simplified", { spouse: true, phone: true, address: true });
    data.congregations = Array.from({ length: 90 }, (_, i) => ({ ...data.congregations[0], name: `Congregação ${i + 1}` }));
    const bytes = await createCongregationReportPdf(data);
    expect((await PDFDocument.load(bytes)).getPageCount()).toBeGreaterThan(2);
    const indices = drawn.mock.calls.filter(([s]) => /^\d+$/.test(s)).map(([s]) => Number(s));
    expect(indices).toEqual(Array.from({ length: 90 }, (_, i) => i + 1));
    await save("lista-longa.pdf", bytes);
  });
  it.each(["individual", "simplified"] as const)("keeps long %s content within page bounds", async (kind) => {
    const drawn = vi.spyOn(PDFPage.prototype, "drawText");
    const data = congregationReportFixture(kind, { spouse: true, phone: true, address: true });
    data.congregations[0].notes = "Observação longa 🎉. ".repeat(500) + "FIM DA OBSERVAÇÃO";
    data.congregations[0].address!.full = "Endereço muito extenso ".repeat(300) + "FIM DO ENDEREÇO";
    const bytes = await createCongregationReportPdf(data);
    const text = drawn.mock.calls.map(([s]) => s).join(" ");
    expect(text).toContain(kind === "individual" ? "FIM DA OBSERVAÇÃO" : "FIM DO ENDEREÇO");
    const width = kind === "individual" ? 595.28 : 841.89;
    for (const [value, opts] of drawn.mock.calls) { expect(opts!.y, value).toBeGreaterThanOrEqual(20); expect(opts!.x! + opts!.font!.widthOfTextAtSize(value, opts!.size!), value).toBeLessThanOrEqual(width - 35); }
    await save(`${kind}-longo.pdf`, bytes);
  });
  it("keeps workbook values literal and handles empty exports", async () => {
    const data = congregationReportFixture(); data.congregations[0].name = '=HYPERLINK("https://example.invalid")';
    const wb = new ExcelJS.Workbook(); await wb.xlsx.load(await createCongregationReportWorkbook(data) as never);
    expect(wb.worksheets[0].getCell("B7").type).toBe(ExcelJS.ValueType.String);
    expect(wb.worksheets[0].views[0]).toMatchObject({ state: "frozen", ySplit: 6 });
    await save("lista.xlsx", await createCongregationReportWorkbook(data));
    data.congregations = [];
    const pdf = await PDFDocument.load(await createCongregationReportPdf(data)); expect(pdf.getPageCount()).toBe(1);
    const empty = new ExcelJS.Workbook(); await empty.xlsx.load(await createCongregationReportWorkbook(data) as never);
    expect(empty.worksheets[0].getCell("A7").text).toContain("Nenhuma congregação");
  });
});
