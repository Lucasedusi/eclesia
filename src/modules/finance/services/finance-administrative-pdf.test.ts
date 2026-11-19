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
  closingCents: -8000000,
  grossPrebendCents: 300000,
  transferCents: 700000,
};
it.each([
  [true, true],
  [false, false],
])(
  "renders ranking totals, optional columns and receipts needing review (%s,%s)",
  async (includePrebend, includeTransfer) => {
    const data: RankingDocument = {
      ...identity,
      type: "RANKING",
      startMonth: "2026-09",
      endMonth: "2026-09",
      includeInactive: false,
      includePrebend,
      includeTransfer,
      transferReview: includeTransfer
        ? {
            receivedCents: 730000,
            unidentifiedCents: 10000,
            outsideReportCents: 20000,
          }
        : null,
      rows: [
        {
          ...amounts,
          id: "a",
          name: "Congregação Jardim Esperança",
          status: "ACTIVE",
          isHeadquarters: false,
        },
        {
          ...amounts,
          id: "b",
          name: "Catedral",
          status: "ACTIVE",
          isHeadquarters: true,
          transferCents: 0,
        },
      ],
      totals: {
        incomeCents: 4000000,
        expenseCents: 1000000,
        closingCents: -16000000,
        grossPrebendCents: 600000,
        transferCents: 700000,
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
      expect(text).not.toContain("parcial");
      expect(text).not.toContain("demonstrativo");
      if (includeTransfer) {
        expect(text).toContain("Sem congregação identificada");
        expect(text).toContain("Congregações fora da seleção");
        expect(text).not.toContain("Total recebido pela Catedral");
      }
      const document = await PDFDocument.load(bytes);
      expect(document.getPageCount()).toBe(1);
      expect(document.getPage(0).getWidth()).toBeCloseTo(841.89);
      expect(text).not.toContain("Prebenda bruta:");
      for (const [value, options] of draw.mock.calls) {
        if (value.startsWith("-"))
          expect(options!.color).toEqual({
            type: "RGB",
            red: 0.6,
            green: 0.23,
            blue: 0.26,
          });
      }
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
      source: i % 2 ? null : "TRANSFER",
      transfer: null,
      transferHistory: [],
      deliveryDate: i % 2 ? null : "2026-10-10",
      revision: 0,
      history: [],
    })),
  };
  const draw = vi.spyOn(PDFPage.prototype, "drawText");
  try {
    const bytes = await createFinanceReportPdf(data);
    const text = draw.mock.calls.map(([s]) => s).join(" ");
    expect(text).toContain("Automática por repasse");
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

it("paginates landscape ranking with long names and large negative totals", async () => {
  const data: RankingDocument = {
    ...identity,
    type: "RANKING",
    startMonth: "2026-01",
    endMonth: "2026-12",
    includeInactive: false,
    includePrebend: true,
    includeTransfer: true,
    transferReview: null,
    rows: Array.from({ length: 70 }, (_, index) => ({
      ...amounts,
      id: String(index),
      name: `Congregação Jardim Esperança com nome extenso ${index + 1}`,
      status: "ACTIVE",
      isHeadquarters: false,
      closingCents: -999999999999,
    })),
    totals: { ...amounts, closingCents: -69999999999930 },
  };
  const draw = vi.spyOn(PDFPage.prototype, "drawText");
  try {
    const bytes = await createFinanceReportPdf(data);
    const document = await PDFDocument.load(bytes);
    expect(document.getPageCount()).toBeGreaterThan(1);
    const total = draw.mock.calls.findIndex(([text]) => text === "Total geral");
    const lastUnit = draw.mock.calls.findIndex(([text]) => text === "extenso 70");
    expect(lastUnit).toBeGreaterThan(-1);
    expect(draw.mock.contexts[total]).toBe(draw.mock.contexts[lastUnit]);
    expect(draw.mock.calls.some(([text]) => text === "-699.999.999.999,30")).toBe(true);
    for (const page of document.getPages())
      expect(page.getWidth()).toBeCloseTo(841.89);
    for (const [text, options] of draw.mock.calls) {
      expect(options!.y).toBeGreaterThanOrEqual(20);
      expect(
        options!.x! + options!.font!.widthOfTextAtSize(text, options!.size!),
      ).toBeLessThanOrEqual(808);
      if (text.startsWith("-"))
        expect(options!.color).toEqual({
          type: "RGB",
          red: 0.6,
          green: 0.23,
          blue: 0.26,
        });
    }
    if (process.env.REPORT_PDF_QA) {
      await mkdir("tmp/reports", { recursive: true });
      await writeFile("tmp/reports/ranking-paginado.pdf", bytes);
    }
  } finally {
    draw.mockRestore();
  }
});
