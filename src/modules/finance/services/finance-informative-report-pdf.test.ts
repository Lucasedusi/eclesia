import { expect, it, vi } from "vitest";
import { mkdir, writeFile } from "node:fs/promises";
import { PDFDocument, PDFPage } from "pdf-lib";
import type { FinanceInformativeReportDocument } from "../types/finance-informative-report.types";
import { formatFinanceMonth } from "../utils/finance-period";
vi.mock("server-only", () => ({}));
import { createFinanceReportPdf } from "./finance-report-pdf.service";
function fixture(n = 3): FinanceInformativeReportDocument {
  const summary = {
    openingCents: 10000,
    incomeCents: 1800000,
    expenseCents: 100000,
    openingMovementCents: 20000,
    adjustmentCents: -5000,
    transferNetCents: 0,
    closingCents: 1725000,
    count: 3,
  };
  return {
    type: "INFORMATIVE",
    source: "TRANSACTIONS",
    startMonth: "2026-01",
    endMonth: `${2026 + Math.floor((n - 1) / 12)}-${String(((n - 1) % 12) + 1).padStart(2, "0")}`,
    includePrebend: true,
    includeTransfer: true,
    emissionId: "12345678-0000-4000-8000-000000000001",
    generatedAt: "2026-10-21T12:00:00Z",
    church: {
      name: "Assembleia de Deus — Campo Exemplo",
      document: null,
      city: "Porangatu / GO",
      logoDataUri: null,
    },
    congregationName: "Congregação Jardim Esperança",
    congregationAddress: "Rua das Palmeiras, 120 · Centro · Porangatu / GO",
    summary,
    months: Array.from({ length: n }, (_, i) => ({
      month: `${2026 + Math.floor(i / 12)}-${String((i % 12) + 1).padStart(2, "0")}`,
      summary,
      recorded: {
        grossPrebendCents: i === 2 ? 0 : 40000,
        transferCents: i === 2 ? 0 : 525000,
      },
    })),
  };
}
it.each([
  [true, true],
  [true, false],
  [false, true],
  [false, false],
])(
  "renders selected columns (prebend %s, transfer %s) and recorded values",
  async (includePrebend, includeTransfer) => {
    const input = { ...fixture(), includePrebend, includeTransfer };
    const draw = vi.spyOn(PDFPage.prototype, "drawText");
    try {
      const bytes = await createFinanceReportPdf(input);
      const text = draw.mock.calls.map(([t]) => t).join(" ");
      expect(text).toContain("COMPARATIVO INDIVIDUAL POR CONGREGAÇÃO");
      expect(text).not.toContain("Prebenda bruta:");
      expect(text).not.toContain("As colunas informativas");
      expect(text.includes("Prebenda bruta")).toBe(includePrebend);
      expect(text.includes("Repasse")).toBe(includeTransfer);
      expect(text).toContain("Saldo final");
      expect(text).not.toContain("Evolução financeira mensal");
      expect(text).toContain("jan/2026");
      expect(text).toContain("mar/2026");
      expect(text).not.toContain("Não disponível");
      expect(text).not.toContain("desatualizado");
      expect(text).not.toContain("demonstrativo");
      expect(text).toContain("0,00");
      const document = await PDFDocument.load(bytes);
      expect(document.getPageCount()).toBe(1);
      expect(document.getPage(0).getWidth()).toBeCloseTo(841.89);
      if (process.env.REPORT_PDF_QA) {
        await mkdir("tmp/reports", { recursive: true });
        await writeFile(
          `tmp/reports/informativo-${includePrebend}-${includeTransfer}.pdf`,
          bytes,
        );
      }
    } finally {
      draw.mockRestore();
    }
  },
);
it("paginates long ranges and keeps large negative amounts inside the printable area", async () => {
  const input = fixture(60);
  input.months.forEach((r) => {
    r.summary = {
      ...r.summary,
      openingCents: -999999999999,
      closingCents: -999999999999,
    };
  });
  input.summary = {
    ...input.summary,
    openingCents: -999999999999,
    closingCents: -999999999999,
  };
  const draw = vi.spyOn(PDFPage.prototype, "drawText");
  try {
    const bytes = await createFinanceReportPdf(input);
    const doc = await PDFDocument.load(bytes);
    expect(doc.getPageCount()).toBeGreaterThan(1);
    const months = draw.mock.calls.filter(([text]) =>
      /^\w{3}\/20\d{2}\*?$/.test(text),
    );
    expect(months).toHaveLength(60);
    for (const [text, o] of draw.mock.calls) {
      expect(o!.y).toBeGreaterThanOrEqual(20);
      if (text.startsWith("-"))
        expect(o!.color).toEqual({
          type: "RGB",
          red: 0.6,
          green: 0.23,
          blue: 0.26,
        });
      expect(
        o!.x! + o!.font!.widthOfTextAtSize(text, o!.size!),
      ).toBeLessThanOrEqual(808);
    }
    if (process.env.REPORT_PDF_QA)
      await writeFile("tmp/reports/informativo-paginado.pdf", bytes);
  } finally {
    draw.mockRestore();
  }
});

it.each([1, 2, 3, 12, 13, 60])(
  "draws two bars per month in blocks of at most 12 months (%s months)",
  async (count) => {
    const input = { ...fixture(count), includeChart: true };
    input.months.forEach((row, index) => {
      row.summary = {
        ...row.summary,
        incomeCents:
          count === 3 ? 0 : count === 2 ? -150000 : 150000 + index * 12000,
        expenseCents: count === 3 ? 0 : 90000,
      };
    });
    const draw = vi.spyOn(PDFPage.prototype, "drawText");
    const rectangles = vi.spyOn(PDFPage.prototype, "drawRectangle");
    const points = vi.spyOn(PDFPage.prototype, "drawCircle");
    try {
      const bytes = await createFinanceReportPdf(input);
      const headings = draw.mock.calls.filter(
        ([value]) => value === "Evolução financeira mensal",
      );
      expect(headings).toHaveLength(Math.ceil(count / 12));
      expect(points).not.toHaveBeenCalled();
      const bars = rectangles.mock.calls.filter(
        ([options]) => options!.opacity === 0.9,
      );
      expect(bars).toHaveLength(count * 2);
      if (count === 2) {
        expect(
          bars.filter(
            ([bar]) => bar?.color?.type === "RGB" && bar.color.red === 0.6,
          ),
        ).toHaveLength(2);
      }
      for (const [bar] of bars) {
        expect(bar!.x).toBeGreaterThan(34);
        expect(bar!.x! + bar!.width!).toBeLessThan(808);
        expect(bar!.y).toBeGreaterThan(49);
        expect(bar!.y! + bar!.height!).toBeLessThan(540);
      }
      if (count !== 3) {
        // Identical monthly expenses retain identical heights across every block.
        const expenseBars = bars.filter(
          ([bar]) => bar?.color?.type === "RGB" && bar.color.red === 0.7,
        );
        expect(expenseBars).toHaveLength(count);
        expenseBars.forEach(([bar]) =>
          expect(bar!.height).toBeCloseTo(expenseBars[0][0]!.height!),
        );
      }
      const text = draw.mock.calls.map(([value]) => value).join(" ");
      for (const row of input.months) {
        expect(
          draw.mock.calls.filter(
            ([value]) => value === formatFinanceMonth(row.month),
          ),
        ).toHaveLength(2);
      }
      expect(text).not.toContain("Resultado do mês");
      expect(text).toContain("Entradas");
      expect(text).toContain("Saídas");
      const document = await PDFDocument.load(bytes);
      for (const page of document.getPages())
        expect(page.getWidth()).toBeCloseTo(841.89);
      for (const [value, options] of draw.mock.calls) {
        expect(options!.x).toBeGreaterThanOrEqual(0);
        expect(options!.y).toBeGreaterThanOrEqual(20);
        expect(
          options!.x! + options!.font!.widthOfTextAtSize(value, options!.size!),
        ).toBeLessThanOrEqual(808);
      }
      if (process.env.REPORT_PDF_QA) {
        await mkdir("tmp/reports", { recursive: true });
        await writeFile(`tmp/reports/barras-${count}.pdf`, bytes);
      }
    } finally {
      draw.mockRestore();
      rectangles.mockRestore();
      points.mockRestore();
    }
  },
);
