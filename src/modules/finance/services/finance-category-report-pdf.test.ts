import { expect, it, vi } from "vitest";
import { PDFDocument, PDFPage } from "pdf-lib";
import { mkdir, writeFile } from "node:fs/promises";
import type { CategoryReportDocument } from "../types/finance-category-report.types";
vi.mock("server-only", () => ({}));
import { createFinanceReportPdf } from "./finance-report-pdf.service";
const data: CategoryReportDocument = {
  type: "CATEGORY",
  dateFrom: "2026-01-01",
  dateTo: "2026-12-31",
  direction: "EXPENSE",
  presentation: "SUMMARY",
  categoryIds: ["a", "b"],
  cashboxId: null,
  cashboxName: null,
  generatedAt: "2026-10-22T12:00:00Z",
  emissionId: "12345678",
  congregationName: "Congregação Jardim Esperança",
  congregationAddress: "Rua das Flores, 100 · Centro",
  church: {
    name: "Assembleia de Deus — Campo Exemplo",
    city: "Porangatu / GO",
    document: null,
    logoDataUri: null,
  },
  totalCents: 17345,
  count: 2,
  categories: [
    {
      id: "a",
      name: "Combustível",
      status: "INACTIVE",
      amountCents: 12345,
      count: 1,
    },
    {
      id: "b",
      name: "Manutenção",
      status: "ACTIVE",
      amountCents: 5000,
      count: 1,
    },
  ],
  rows: [],
};
it.each(["SUMMARY", "DETAILED"] as const)(
  "renders %s with category totals and no balance indicators",
  async (presentation) => {
    const draw = vi.spyOn(PDFPage.prototype, "drawText");
    try {
      const report = {
        ...data,
        presentation,
        rows:
          presentation === "SUMMARY"
            ? []
            : data.categories.map((c, i) => ({
                id: String(i),
                categoryId: c.id,
                date: "2026-01-01",
                amountCents: c.amountCents,
                description: "Abastecimento e manutenção do veículo",
                personName: "Fornecedor Exemplo",
                cashboxId: "box",
                cashboxName: "Caixa geral",
                classificationName: null,
              })),
      };
      const bytes = await createFinanceReportPdf(report);
      const text = draw.mock.calls.map(([s]) => s).join(" ");
      expect(text).toContain("POR CATEGORIA");
      expect(text).toContain("01/01/2026");
      expect(text).toContain("31/12/2026");
      expect(text).toContain("173,45");
      expect(text).toContain("Combustível");
      expect(text).not.toContain("Saldo inicial");
      expect(text.includes("Fornecedor Exemplo")).toBe(
        presentation === "DETAILED",
      );
      if (presentation === "DETAILED")
        expect(
          draw.mock.calls.filter(([text]) => text === "01/01/2026"),
        ).toHaveLength(2);
      expect((await PDFDocument.load(bytes)).getPageCount()).toBe(1);
      for (const [s, o] of draw.mock.calls) {
        expect(o!.y).toBeGreaterThanOrEqual(20);
        expect(
          o!.x! + o!.font!.widthOfTextAtSize(s, o!.size!),
        ).toBeLessThanOrEqual(562);
      }
      if (process.env.REPORT_PDF_QA) {
        await mkdir("tmp/reports", { recursive: true });
        await writeFile(`tmp/reports/categorias-${presentation}.pdf`, bytes);
      }
    } finally {
      draw.mockRestore();
    }
  },
);
it("keeps every detail across pages and identifies an empty result", async () => {
  const draw = vi.spyOn(PDFPage.prototype, "drawText");
  try {
    const rows = Array.from({ length: 100 }, (_, i) => ({
      id: String(i),
      categoryId: "a",
      date: "2026-01-01",
      amountCents: 100,
      description: `Abastecimento ${i + 1}`,
      personName: "Posto Exemplo",
      cashboxId: "box",
      cashboxName: "Caixa geral",
      classificationName: null,
    }));
    const bytes = await createFinanceReportPdf({
      ...data,
      presentation: "DETAILED",
      categoryIds: ["a"],
      categories: [{ ...data.categories[0], count: 100, amountCents: 10000 }],
      rows,
      totalCents: 10000,
      count: 100,
    });
    expect((await PDFDocument.load(bytes)).getPageCount()).toBeGreaterThan(1);
    expect(draw.mock.calls.map(([s]) => s).join(" ")).toContain(
      "Abastecimento 100",
    );
    draw.mockClear();
    await createFinanceReportPdf({
      ...data,
      totalCents: 0,
      count: 0,
      categories: data.categories.map((c) => ({
        ...c,
        amountCents: 0,
        count: 0,
      })),
    });
    expect(draw.mock.calls.map(([s]) => s).join(" ")).toContain(
      "Sem movimentação",
    );
  } finally {
    draw.mockRestore();
  }
});
