import { mkdir, writeFile } from "node:fs/promises";
import { PDFDocument, PDFPage } from "pdf-lib";
import sharp from "sharp";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createRegionReportPdf } from "./region-report-pdf.service";
import { createCongregationReportPdf } from "./congregation-report-pdf.service";
import { regionReportFixture } from "./region-report.fixtures";
import { congregationReportFixture } from "./congregation-report.fixtures";

vi.mock("server-only", () => ({}));
afterEach(() => vi.restoreAllMocks());

const variants = ["regional-list", "regional-sheet", "congregation-list", "congregation-landscape", "congregation-sheet"] as const;

describe("organization PDF branding", () => {
  it.each(variants)("keeps a subtle, centered logo and pastoral header on every %s page", async (variant) => {
    const images = vi.spyOn(PDFPage.prototype, "drawImage");
    const texts = vi.spyOn(PDFPage.prototype, "drawText");
    const rectangles = vi.spyOn(PDFPage.prototype, "drawRectangle");
    const logo = await sharp(Buffer.from('<svg width="600" height="600"><circle cx="300" cy="300" r="260" fill="#153f70"/><path d="M270 130h60v140h120v60H330v150h-60V330H150v-60h120z" fill="#dfb53d"/></svg>')).png().toBuffer();
    const church = { ...regionReportFixture().church, pastorNames: ["Paulo Silva", "Ana Silva"], logoDataUri: `data:image/png;base64,${logo.toString("base64")}` };
    let bytes: Uint8Array;
    if (variant.startsWith("regional")) {
      const data = regionReportFixture(variant.endsWith("sheet") ? "individual" : "simplified");
      data.church = church;
      if (data.kind === "simplified") data.regions = Array.from({ length: 45 }, () => ({ ...data.regions[0] }));
      else data.congregations = Array.from({ length: 45 }, () => ({ ...data.congregations[0] }));
      bytes = await createRegionReportPdf(data);
    } else {
      const data = congregationReportFixture(variant.endsWith("sheet") ? "individual" : "simplified", { spouse: true, phone: true, address: variant.endsWith("landscape") });
      data.church = church;
      if (data.kind === "simplified") data.congregations = Array.from({ length: 45 }, () => ({ ...data.congregations[0] }));
      else data.congregations[0].notes = "Observação para verificar a continuidade da ficha. ".repeat(100);
      bytes = await createCongregationReportPdf(data);
    }
    const pdf = await PDFDocument.load(bytes);
    expect(pdf.getPageCount()).toBeGreaterThan(1);
    const marks = images.mock.calls.map((call, i) => ({ options: call[1]!, page: images.mock.instances[i] as PDFPage, order: images.mock.invocationCallOrder[i] })).filter(({ options }) => (options.opacity ?? 1) < 1);
    expect(marks).toHaveLength(pdf.getPageCount());
    for (const { options, page, order } of marks) {
      expect(options.opacity).toBeGreaterThan(0);
      expect(options.opacity).toBeLessThanOrEqual(0.06);
      expect(options.width).toBeGreaterThan(250);
      expect(options.x! + options.width! / 2).toBeCloseTo(page.getWidth() / 2);
      expect(options.y! + options.height! / 2).toBeCloseTo(page.getHeight() / 2);
      const pageText = texts.mock.calls.filter((_, i) => texts.mock.instances[i] === page);
      expect(pageText.map(([text]) => text).join(" ")).toContain("Paulo Silva e Ana Silva");
      expect(pageText.some(([text, options]) => text === "Eklesias" && options!.y! < 40)).toBe(true);
      const name = pageText.find(([text]) => /IGREJA|Igreja/.test(text))![1]!;
      const pastors = pageText.find(([text]) => text.includes("Paulo Silva"))![1]!;
      expect(pastors.y).toBeLessThan(name.y!);
      expect(texts.mock.invocationCallOrder[texts.mock.instances.indexOf(page)]).toBeGreaterThan(order);
    }
    // Table fills must let the background through instead of hiding the mark.
    const rows = rectangles.mock.calls.filter(([options]) => options?.x === 36 && options.color && "red" in options.color && options.color.red > 0.9);
    for (const [options] of rows) expect(options!.opacity).toBeLessThanOrEqual(0.4);
    if (process.env.REPORT_BRANDING_QA_DIR) {
      await mkdir(process.env.REPORT_BRANDING_QA_DIR, { recursive: true });
      await writeFile(`${process.env.REPORT_BRANDING_QA_DIR}/${variant}.pdf`, bytes);
    }
  });

  it.each([null, "data:image/png;base64,aW52YWxpZA=="])("exports without a watermark or empty pastoral label when the logo is unavailable: %s", async (logoDataUri) => {
    const images = vi.spyOn(PDFPage.prototype, "drawImage");
    const texts = vi.spyOn(PDFPage.prototype, "drawText");
    for (const create of [() => createRegionReportPdf({ ...regionReportFixture(), church: { ...regionReportFixture().church, logoDataUri } }), () => createCongregationReportPdf({ ...congregationReportFixture(), church: { ...congregationReportFixture().church, logoDataUri } })]) {
      expect((await PDFDocument.load(await create())).getPageCount()).toBe(1);
    }
    expect(images).not.toHaveBeenCalled();
    expect(texts.mock.calls.map(([text]) => text).join(" ")).not.toMatch(/Pastor(?:es)?:/);
  });
});
