import { expect, it, vi } from "vitest";
import { mkdir, writeFile } from "node:fs/promises";
import { PDFDocument, PDFPage } from "pdf-lib";
import type { FinanceInformativeReportDocument } from "../types/finance-informative-report.types";
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
    startMonth: "2026-01",
    endMonth: n === 3 ? "2026-03" : "2030-12",
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
      statement:
        i === 2
          ? null
          : {
              revision: 1,
              stale: i === 1,
              grossPrebendCents: 400000,
              transferCents: 525000,
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
  "renders selected columns (prebend %s, transfer %s) and missing/stale values",
  async (includePrebend, includeTransfer) => {
    const input = { ...fixture(), includePrebend, includeTransfer };
    const draw = vi.spyOn(PDFPage.prototype, "drawText");
    try {
      const bytes = await createFinanceReportPdf(input);
      const text = draw.mock.calls.map(([t]) => t).join(" ");
      expect(text).toContain("INFORMATIVO");
      expect(text.includes("Prebenda bruta")).toBe(includePrebend);
      expect(text.includes("Repasse")).toBe(includeTransfer);
      expect(text).toContain("Saldo final");
      expect(text).toContain("jan/2026");
      expect(text).toContain("mar/2026");
      if (includePrebend || includeTransfer) {
        expect(text).toContain("Não disponível");
        expect(text).toContain("desatualizado");
      } else expect(text).not.toContain("Não disponível");
      expect((await PDFDocument.load(bytes)).getPageCount()).toBe(1);
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
      expect(
        o!.x! + o!.font!.widthOfTextAtSize(text, o!.size!),
      ).toBeLessThanOrEqual(562);
    }
    if (process.env.REPORT_PDF_QA)
      await writeFile("tmp/reports/informativo-paginado.pdf", bytes);
  } finally {
    draw.mockRestore();
  }
});
