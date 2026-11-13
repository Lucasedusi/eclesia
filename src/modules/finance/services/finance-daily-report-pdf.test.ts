import { PDFDocument, PDFPage } from "pdf-lib";
import { mkdir, writeFile } from "node:fs/promises";
import { expect, it, vi } from "vitest";
import type { DailyReportDocument } from "../validations/finance-daily-report.schemas";
import { createFinanceReportPdf } from "./finance-report-pdf.service";

vi.mock("server-only", () => ({}));

const totals = {
  opening: 110000,
  income: 7500,
  expense: 1200,
  closing: 116300,
};
const items = Array.from({ length: 75 }, (_, i) => ({
  identity: `Pessoa de exemplo ${i + 1}`,
  description: "Oferta do culto",
  department: "Missões",
  method: "Pix",
  cents: 100,
}));
const bank = {
  id: "bank",
  name: "Conta principal",
  bankDetails: {
    bankName: "Banco Exemplo",
    agency: "001",
    accountNumber: "123-4",
  },
  ...totals,
  closing: 115800,
  categories: [
    {
      name: "Ofertas",
      direction: "INCOME" as const,
      count: items.length,
      cents: 7500,
      items,
    },
    {
      name: "Material",
      direction: "EXPENSE" as const,
      count: 1,
      cents: 1200,
      items: [
        {
          identity: "Papelaria Exemplo",
          description: "Papel A4",
          method: "Boleto",
          department: "Secretaria",
          cents: 1200,
        },
      ],
    },
  ],
  movements: [{ label: "Transferido para Caixa físico", cents: -500 }],
};
const data: DailyReportDocument = {
  type: "DAILY",
  presentation: "SUMMARY",
  date: "2026-10-02",
  box: null,
  unitId: "unit",
  generatedAt: "2026-10-02T20:00:00Z",
  emissionId: "EXEMPLO",
  church: {
    name: "Igreja Exemplo",
    logoDataUri: null,
    document: null,
    city: "Porangatu / GO",
  },
  congregationName: "Catedral",
  congregationAddress: null,
  includePayments: false,
  summary: totals,
  boxes: [
    bank,
    {
      id: "cash",
      name: "Caixa físico",
      bankDetails: null,
      opening: 0,
      closing: 500,
      income: 0,
      expense: 0,
      categories: [],
      movements: [{ label: "Recebido de Conta principal", cents: 500 }],
    },
  ],
  payments: [
    { method: "Pix", income: 7500, expense: 0 },
    { method: "Boleto", income: 0, expense: 1200 },
  ],
};

it.each(["SUMMARY", "DETAIL"] as const)(
  "prints the complete %s closing with reconciled totals and approval",
  async (presentation) => {
    const draw = vi.spyOn(PDFPage.prototype, "drawText");
    try {
      const detailed = presentation === "DETAIL";
      const bytes = await createFinanceReportPdf({
        ...data,
        presentation,
        includePayments: detailed,
      });
      const strings = draw.mock.calls.map(([value]) => value);
      const text = strings.join(" ");
      expect(text).toContain("02/10/2026");
      expect(text).toContain("Conta principal");
      expect(text).toContain("Agência 001");
      expect(text).toContain("1.163,00");
      expect(text).toContain("Transferido para Caixa físico");
      expect(text).toContain("Conferido por");
      expect(text).toContain("Aprovado por");
      expect(strings.filter((s) => s === "Saldo inicial")).toHaveLength(3);
      expect(text.includes("Resumo por forma de pagamento")).toBe(detailed);
      expect(text.includes("Pessoa de exemplo")).toBe(detailed);
      const pdf = await PDFDocument.load(bytes);
      if (detailed) {
        for (const item of items)
          expect(strings.filter((s) => s === item.identity)).toHaveLength(1);
        expect(text).toContain("Papelaria Exemplo");
        expect(text).toContain("Boleto");
        expect(pdf.getPageCount()).toBeGreaterThan(2);
      } else {
        expect(text).toContain("Quantidade");
        expect(text).toContain("Material");
      }
      for (const [s, options] of draw.mock.calls) {
        expect(options!.y).toBeGreaterThanOrEqual(19);
        expect(
          options!.x! + options!.font!.widthOfTextAtSize(s, options!.size!),
        ).toBeLessThanOrEqual(562);
      }
      if (process.env.REPORT_PDF_QA) {
        await mkdir("tmp/reports", { recursive: true });
        await writeFile(
          `tmp/reports/fluxo-diario-${detailed ? "detalhado" : "resumido"}.pdf`,
          bytes,
        );
      }
    } finally {
      draw.mockRestore();
    }
  },
);
it("prints a zero-movement day for a selected account without duplicating the opening balance", async () => {
  const draw = vi.spyOn(PDFPage.prototype, "drawText");
  try {
    const totals = { opening: 500, income: 0, expense: 0, closing: 500 };
    await createFinanceReportPdf({
      ...data,
      box: bank.id,
      summary: totals,
      boxes: [{ ...bank, ...totals, movements: [], categories: [] }],
      payments: [],
    });
    const strings = draw.mock.calls.map(([s]) => s);
    expect(strings.filter((s) => s === "Saldo inicial")).toHaveLength(1);
    expect(strings).toContain("Sem movimentação no dia.");
  } finally {
    draw.mockRestore();
  }
});
