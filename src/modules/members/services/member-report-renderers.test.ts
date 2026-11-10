import { afterEach, describe, expect, it, vi } from "vitest";
import { PDFDocument, PDFPage } from "pdf-lib";
import ExcelJS from "exceljs";
import sharp from "sharp";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { getMemberReportColumns } from "../constants/member-report-fields";
import type { MemberReportDocument } from "../types/member-report.types";
import { createMemberReportPdf } from "./member-report-pdf.service";
import { createMemberReportWorkbook } from "./member-report-workbook.service";
vi.mock("server-only", () => ({}));
const access = { viewRoles: true, viewSensitiveIdentity: true };
function fixture(custom = false): MemberReportDocument {
  return { kind: custom ? "custom" : "simplified", issuedAt: "2026-11-06T15:00:00Z", church: { name: "Igreja de Teste", logoDataUri: null, address: "Rua de Teste, 10", phone: "", document: "", pastorNames: ["Paulo de Teste", "Ana de Teste"] }, scopeLabel: "", filters: ["Membros não arquivados"],
    columns: getMemberReportColumns(custom ? { kind: "custom", fields: ["birth_date", "cpf", "full_address", "notes"] } : { kind: "simplified" }, access),
    rows: [{ id: "1", values: { member_code: "00001", full_name: "=HYPERLINK(\"teste\")", congregation: "Central", whatsapp: "(11) 99999-8888", role: "Diaconisa", birth_date: "10/02/1990", cpf: "000.000.001-91", full_address: "Rua com nome extenso, 0001 · Bairro de Teste · Goiânia / GO", notes: "Observação geral de teste." } }],
  };
}
afterEach(() => vi.restoreAllMocks());
async function saveQa(name: string, bytes: Uint8Array) {
  const directory = process.env.MEMBER_REPORT_QA_DIR;
  if (directory) { await mkdir(directory, { recursive: true }); await writeFile(path.join(directory, name), bytes); }
}
describe("member report files", () => {
  it("uses the concise header and formats personal names only in the PDF", async () => {
    const data=fixture();data.rows[0].values.full_name="MARIA DE SOUZA";
    const draw=vi.spyOn(PDFPage.prototype,"drawText");await createMemberReportPdf(data);
    const text=draw.mock.calls.map(([t])=>t).join(" ");
    expect(text).toContain("Maria de Souza");expect(text).toContain("Presidentes: Paulo de Teste e Ana de Teste");
    expect(text).not.toContain("Membros não arquivados");expect(data.rows[0].values.full_name).toBe("MARIA DE SOUZA");
  });
  it("keeps the matrícula heading, CPF and phone on one line", async () => {
    const draw = vi.spyOn(PDFPage.prototype, "drawText");
    await createMemberReportPdf(fixture());
    expect(draw.mock.calls.map(([text]) => text)).toContain("MATRÍCULA");
    expect(draw.mock.calls.map(([text]) => text)).toContain("(11) 99999-8888");
    draw.mockClear(); await createMemberReportPdf(fixture(true));
    expect(draw.mock.calls.map(([text]) => text)).toContain("000.000.001-91");
    expect(draw.mock.calls.map(([text]) => text)).toContain("MATRÍCULA");
  });
  it.each([false, true])("preserves a centered proportional watermark on every page, custom=%s", async (custom) => {
    const draw = vi.spyOn(PDFPage.prototype, "drawImage"), data = fixture(custom);
    const logo = await sharp(Buffer.from('<svg width="600" height="400"><ellipse cx="300" cy="200" rx="280" ry="180" fill="#153f70"/><path d="M280 70h40v100h100v40H320v120h-40V210H180v-40h100z" fill="#dfb53d"/></svg>')).png().toBuffer();
    data.church.logoDataUri = `data:image/png;base64,${logo.toString("base64")}`;
    data.rows = Array.from({ length: 35 }, (_, i) => ({ id: String(i), values: { ...data.rows[0].values, full_name: `Membro de Teste ${i + 1}` } }));
    const bytes = await createMemberReportPdf(data), pdf = await PDFDocument.load(bytes);
    const marks = draw.mock.calls.flatMap(([, options], i) => options?.opacity === .05 ? [{ options, page: draw.mock.instances[i] as PDFPage }] : []);
    expect(marks).toHaveLength(pdf.getPageCount());
    for (const { options, page } of marks) { expect(options.width! / options.height!).toBeCloseTo(1.5); expect(options.x! + options.width! / 2).toBeCloseTo(page.getWidth() / 2); expect(options.y! + options.height! / 2).toBeCloseTo(page.getHeight() / 2); }
    await saveQa(custom ? "personalizada-marca-dagua.pdf" : "simplificada-marca-dagua.pdf", bytes);
  });
  it("exports normally when the logo is invalid", async () => {
    const data = fixture(); data.church.logoDataUri = "data:image/png;base64,aW52YWxpZA==";
    expect((await PDFDocument.load(await createMemberReportPdf(data))).getPageCount()).toBe(1);
  });
  it("keeps text literal, leading zeros, useful dates, filters and frozen headers in Excel", async () => {
    const data = fixture(true), workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(await createMemberReportWorkbook(data) as unknown as ExcelJS.Buffer);
    const sheet = workbook.worksheets[0];
    expect(sheet.getRow(6).values).toEqual([undefined, ...data.columns.map((c) => c.label)]);
    expect(sheet.getCell("A7").value).toBe("00001"); expect(sheet.getCell("A7").numFmt).toBe("@");
    expect(sheet.getCell("B7").value).toBe('=HYPERLINK("teste")'); expect(sheet.getCell("B7").type).toBe(ExcelJS.ValueType.String);
    expect(sheet.getCell("C7").value).toEqual(new Date("1990-02-10T00:00:00Z")); expect(sheet.getCell("C7").numFmt).toBe("dd/mm/yyyy");
    expect(sheet.getCell("D7").value).toBe("000.000.001-91");
    expect(sheet.views[0]).toMatchObject({ state: "frozen", ySplit: 6 }); expect(sheet.autoFilter).toBe("A6:F7");
  });
  it("renders portrait simplified PDF and landscape custom PDF with all rows and repeated pastoral headers", async () => {
    const draw = vi.spyOn(PDFPage.prototype, "drawText"), data = fixture();
    const portrait = await PDFDocument.load(await createMemberReportPdf(data)); expect(portrait.getPage(0).getWidth()).toBeLessThan(portrait.getPage(0).getHeight());
    draw.mockClear(); const custom = fixture(true);
    custom.rows = Array.from({ length: 70 }, (_, i) => ({ id: String(i), values: { ...custom.rows[0].values, full_name: `Membro ${i}`, notes: i === 30 ? "Observação extensa. ".repeat(650) + "FIM_NOTA" : "Nota breve." } }));
    const bytes = await createMemberReportPdf(custom), pdf = await PDFDocument.load(bytes);
    expect(pdf.getPageCount()).toBeGreaterThan(3); expect(pdf.getPage(0).getWidth()).toBeGreaterThan(pdf.getPage(0).getHeight());
    const strings = draw.mock.calls.map(([text]) => text).join(" "); expect(strings).toContain("FIM_NOTA"); expect(strings).toContain("Membro 69");
    expect(draw.mock.calls.filter(([text]) => text.includes("Paulo de Teste"))).toHaveLength(pdf.getPageCount());
    for (const [text, opts] of draw.mock.calls) { expect(opts?.y).toBeGreaterThanOrEqual(20); expect(opts?.x).toBeGreaterThanOrEqual(30); expect(opts!.x! + opts!.font!.widthOfTextAtSize(text, opts!.size!)).toBeLessThanOrEqual(841.89 - 30); }
    await saveQa("personalizada-texto-longo.pdf", bytes);
  });
  it("renders an explicit empty state without a fake member", async () => {
    const data = fixture(); data.rows = [];
    const draw = vi.spyOn(PDFPage.prototype, "drawText"); await createMemberReportPdf(data);
    expect(draw.mock.calls.some(([text]) => text.includes("Nenhum membro encontrado"))).toBe(true);
    const book = new ExcelJS.Workbook(); await book.xlsx.load(await createMemberReportWorkbook(data) as unknown as ExcelJS.Buffer);
    expect(book.worksheets[0].getCell("A7").value).toContain("Nenhum membro encontrado");
  });
});
