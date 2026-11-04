import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { PDFDocument, PDFPage } from "pdf-lib";
import ExcelJS from "exceljs";
import sharp from "sharp";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createRegionReportPdf } from "./region-report-pdf.service";
import { createRegionReportWorkbook } from "./region-report-workbook.service";
import { regionReportFixture } from "./region-report.fixtures";

vi.mock("server-only", () => ({}));
afterEach(() => vi.restoreAllMocks());

async function saveQa(name: string, bytes: Uint8Array) {
  const dir = process.env.REGION_REPORT_QA_DIR;
  if (dir) { await mkdir(dir, { recursive: true }); await writeFile(path.join(dir, name), bytes); }
}

describe("regional report documents", () => {
  it.each(["simplified", "individual"] as const)("creates %s A4 PDF in the member sheet visual identity", async (kind) => {
    const drawn = vi.spyOn(PDFPage.prototype, "drawText");
    const bytes = await createRegionReportPdf(regionReportFixture(kind));
    const pdf = await PDFDocument.load(bytes);
    expect(pdf.getPageCount()).toBe(1);
    expect(pdf.getPage(0).getSize()).toEqual({ width: 595.28, height: 841.89 });
    const text = drawn.mock.calls.map(([value]) => value).join(" ");
    expect(text).toContain("IGREJA EVANGÉLICA DE EXEMPLO");
    expect(text).toContain("Maria de Oliveira");
    expect(text).toContain("Página 1 de 1");
    expect(text).toContain("04/11/2026");
    if (kind === "individual") { expect(text).toContain("Congregação Central"); expect(text).toContain("Inativa"); }
    expect(Buffer.from(bytes).toString("latin1")).toContain("/FontFile2");
    await saveQa(`${kind}.pdf`, bytes);
  });
  it("paginates and repeats table headers without losing final records", async () => {
    const drawn = vi.spyOn(PDFPage.prototype, "drawText");
    const input = regionReportFixture();
    input.regions = Array.from({ length: 90 }, (_, i) => ({ ...input.regions[0], name: `Regional de exemplo ${i + 1}` }));
    const bytes = await createRegionReportPdf(input);
    const pdf = await PDFDocument.load(bytes);
    expect(pdf.getPageCount()).toBeGreaterThan(2);
    const text = drawn.mock.calls.map(([value]) => value).join(" ");
    expect(text).toContain("Regional de exemplo 90");
    expect(text.match(/NOME DA REGIONAL/g)?.length).toBe(pdf.getPageCount());
    await saveQa("lista-longa.pdf", bytes);
  });
  it("keeps long descriptions and table cells within page boundaries", async () => {
    const drawn = vi.spyOn(PDFPage.prototype, "drawText");
    const input = regionReportFixture("individual");
    input.region!.description = "Descrição extensa da regional. ".repeat(450) + "FINAL DA DESCRIÇÃO";
    input.congregations[0].name = "Congregação de nome extenso ".repeat(180) + "FINAL DO NOME";
    input.congregations[0].pastorName = "Álvaro 🎉";
    input.scopeLabel = "Visão restrita: somente registros autorizados para o seu acesso.";
    const bytes = await createRegionReportPdf(input);
    const text = drawn.mock.calls.map(([value]) => value).join(" ");
    expect(text).toContain("FINAL DA DESCRIÇÃO");
    expect(text).toContain("FINAL DO NOME");
    expect(text).toContain("registros autorizados");
    for (const [value, opts] of drawn.mock.calls) {
      expect(opts?.y, value).toBeGreaterThanOrEqual(20);
      expect((opts?.x ?? 0) + opts!.font!.widthOfTextAtSize(value, opts!.size!), value).toBeLessThanOrEqual(560);
      expect(opts?.y, value).toBeLessThan(822);
    }
    await saveQa("ficha-longa.pdf", bytes);
  });
  it("displays empty lists and omits absent description", async () => {
    const drawn = vi.spyOn(PDFPage.prototype, "drawText");
    const input = regionReportFixture("individual"); input.region!.description = null; input.congregations = [];
    await createRegionReportPdf(input);
    const text = drawn.mock.calls.map(([value]) => value).join(" ");
    expect(text).toContain("Nenhuma congregação encontrada para este relatório.");
    expect(text).not.toContain("DESCRIÇÃO");
  });
  it("embeds the configured church logo", async () => {
    const input = regionReportFixture("individual");
    const png = await sharp({ create: { width: 100, height: 100, channels: 4, background: "#ddb33f" } }).png().toBuffer();
    input.church.logoDataUri = `data:image/png;base64,${png.toString("base64")}`;
    const bytes = await createRegionReportPdf(input);
    expect(Buffer.from(bytes).toString("latin1")).toContain("/Subtype /Image");
    await saveQa("ficha-logo.pdf", bytes);
  });
  it("exports a usable workbook with literal text contacts and native table controls", async () => {
    const input = regionReportFixture();
    input.regions[0].name = '=HYPERLINK("https://example.invalid")';
    const bytes = await createRegionReportWorkbook(input);
    const workbook = new ExcelJS.Workbook(); await workbook.xlsx.load(bytes as never);
    const sheet = workbook.getWorksheet("Regionais")!;
    expect(sheet.getCell("A7").value).toBe(input.regions[0].name);
    expect(sheet.getCell("A7").type).toBe(ExcelJS.ValueType.String);
    expect(sheet.getCell("C7").value).toBe("(11) 99999-8888");
    expect(sheet.getCell("C7").numFmt).toBe("@");
    expect(sheet.getCell("A6").value).toBe("Nome da regional");
    expect(sheet.autoFilter).toBeTruthy();
    expect(sheet.views[0]).toMatchObject({ state: "frozen", ySplit: 6 });
    expect(sheet.pageSetup.printTitlesRow).toBe("1:6");
    await saveQa("lista.xlsx", bytes);
  });
  it("keeps the workbook headers and empty state without records", async () => {
    const input = regionReportFixture(); input.regions = [];
    const workbook = new ExcelJS.Workbook(); await workbook.xlsx.load(await createRegionReportWorkbook(input) as never);
    expect(workbook.getWorksheet("Regionais")!.getCell("A7").text).toBe("Nenhuma regional encontrada para este relatório.");
  });
});
