import { expect, it, vi } from "vitest";
import { PDFDocument, PDFPage } from "pdf-lib";
import { mkdir, writeFile } from "node:fs/promises";
import type {
  RankingDocument,
  DeliveryDocument,
} from "../types/finance-administrative.types";
vi.mock("server-only", () => ({}));
import { createFinanceReportPdf } from "./finance-report-pdf.service";
const identity = {
  church: {
    name: "Assembleia de Deus — Campo Exemplo",
    city: "Porangatu / GO",
    document: null,
    logoDataUri: null,
  },
  congregationName: "Todas as congregações",
  congregationAddress: null,
  emissionId: "12345678-0000-4000-8000-000000000001",
  generatedAt: "2026-10-22T12:00:00Z",
};
const amounts = {
  incomeCents: 2000000,
  expenseCents: 500000,
  closingCents: 8000000,
  grossPrebendCents: 300000,
  transferCents: 700000,
  missingMonths: 0,
};
it.each([
  [true, true],
  [false, false],
])(
  "renders ranking totals, optional columns and partial values (%s,%s)",
  async (includePrebend, includeTransfer) => {
    const data: RankingDocument = {
      ...identity,
      type: "RANKING",
      startMonth: "2026-09",
      endMonth: "2026-09",
      includeInactive: false,
      includePrebend,
      includeTransfer,
      rows: [
        {
          ...amounts,
          id: "a",
          name: "Congregação Jardim Esperança",
          status: "ACTIVE",
          isHeadquarters: false,
          staleMonths: [],
          missingMonths: 1,
        },
        {
          ...amounts,
          id: "b",
          name: "Catedral",
          status: "ACTIVE",
          isHeadquarters: true,
          staleMonths: ["2026-09"],
        },
      ],
      totals: {
        incomeCents: 4000000,
        expenseCents: 1000000,
        closingCents: 16000000,
        grossPrebendCents: 600000,
        transferCents: 1400000,
        missingMonths: 1,
      },
    };
    const draw = vi.spyOn(PDFPage.prototype, "drawText");
    try {
      const bytes = await createFinanceReportPdf(data);
      const text = draw.mock.calls.map(([s]) => s).join(" ");
      expect(text).toContain("Total geral");
      expect(text).toContain("160.000,00");
      expect(text.includes("Prebenda bruta")).toBe(includePrebend);
      expect(text.includes("Repasse")).toBe(includeTransfer);
      if (includePrebend) expect(text).toContain("parcial");
      expect((await PDFDocument.load(bytes)).getPageCount()).toBe(1);
      if (process.env.REPORT_PDF_QA) {
        await mkdir("tmp/reports", { recursive: true });
        await writeFile(`tmp/reports/ranking-${includePrebend}.pdf`, bytes);
      }
    } finally {
      draw.mockRestore();
    }
  },
);
it("renders delivered and pending rows with date, deadline and count across pages", async () => {
  const data: DeliveryDocument = {
    ...identity,
    type: "DELIVERIES",
    month: "2026-09",
    includeInactive: true,
    filter: "ALL",
    search: "",
    dueDate: "2026-10-08",
    today: "2026-10-22",
    rows: Array.from({ length: 90 }, (_, i) => ({
      id: String(i),
      name: `Congregação Jardim Esperança ${i + 1}`,
      status: "ACTIVE",
      deliveryDate: i % 2 ? null : "2026-10-10",
      revision: 0,
      history: [],
    })),
  };
  const draw = vi.spyOn(PDFPage.prototype, "drawText");
  try {
    const bytes = await createFinanceReportPdf(data);
    const text = draw.mock.calls.map(([s]) => s).join(" ");
    expect(text).toContain("Com atraso");
    expect(text).toContain("Em atraso");
    expect(text).toContain("90");
    expect(text).toContain("10/10/2026");
    expect((await PDFDocument.load(bytes)).getPageCount()).toBeGreaterThan(1);
    for (const [text, o] of draw.mock.calls) {
      expect(o!.y).toBeGreaterThanOrEqual(20);
      expect(
        o!.x! + o!.font!.widthOfTextAtSize(text, o!.size!),
      ).toBeLessThanOrEqual(562);
    }
    if (process.env.REPORT_PDF_QA) {
      await mkdir("tmp/reports", { recursive: true });
      await writeFile("tmp/reports/entregas.pdf", bytes);
    }
  } finally {
    draw.mockRestore();
  }
});
