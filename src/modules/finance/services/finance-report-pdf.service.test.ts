import { expect, it, vi } from "vitest";
import { PDFDocument } from "pdf-lib";
import { mkdir, writeFile } from "node:fs/promises";
import type { FinanceReportDocument } from "../types/finance-report.types";
vi.mock("server-only", () => ({}));
import { createFinanceReportPdf } from "./finance-report-pdf.service";
const summary = {
  openingCents: -10000,
  incomeCents: 0,
  expenseCents: 0,
  openingMovementCents: 0,
  adjustmentCents: 0,
  transferNetCents: 0,
  closingCents: -10000,
  count: 0,
};
function fixture(
  n: number,
  type: "ANALYTIC" | "SYNTHETIC",
): FinanceReportDocument {
  const s = {
    ...summary,
    incomeCents: n * 1000,
    closingCents: n * 1000 - 10000,
    count: n,
  };
  const common = {
    month: "2026-10",
    generatedAt: "2026-10-12T14:00:00Z",
    emissionId: "00000000-0000-4000-8000-000000000001",
    cashboxId: null,
    cashboxName: null,
    summary: s,
    departments: [
      { id: "dep", name: "Tesouraria", incomeCents: n * 1000, expenseCents: 0 },
    ],
    cashboxes: [
      { ...s, id: "00000000-0000-4000-8000-000000000002", name: "Caixa local" },
    ],
    movements: [],
    church: {
      name: "Assembleia de Deus · Igreja de Exemplo",
      logoDataUri: null,
      city: "Porangatu / GO",
      document: "00.000.000/0001-00",
    },
    congregationName: "Congregação Esperança",
  };
  return type === "SYNTHETIC"
    ? {
        ...common,
        type,
        categories: n
          ? [
              {
                categoryId: "cat",
                categoryName: "Dízimos",
                classificationId: "k",
                classificationName: "Presbíteros",
                direction: "INCOME",
                amountCents: n * 1000,
                count: n,
              },
            ]
          : [],
      }
    : {
        ...common,
        type,
        rows: Array.from({ length: n }, (_, i) => ({
          id: `00000000-0000-4000-8000-${String(i).padStart(12, "0")}`,
          date: "2026-10-05",
          categoryId: "cat",
          categoryName: "Dízimos",
          classificationId: "k",
          classificationName: "Presbíteros",
          direction: "INCOME",
          amountCents: 1000,
          personName: `Pessoa fictícia ${i + 1}`,
          description:
            i === 1
              ? "Descrição extensa com acentuação e conferência. ".repeat(80)
              : "Contribuição mensal",
          documentNumber: `REF-${i + 1}`,
          departmentName: "Tesouraria",
          cashboxName: "Conta principal",
          paymentMethodName: "Pix",
        })),
      };
}
it.each([0, 1, 49, 1000, 9995])(
  "generates full searchable A4 analytic for %i rows",
  async (n) => {
    const bytes = await createFinanceReportPdf(fixture(n, "ANALYTIC"));
    const pdf = await PDFDocument.load(bytes);
    expect(pdf.getPageCount()).toBeGreaterThan(0);
    expect(
      pdf.getPages().every((p) => Math.abs(p.getWidth() - 595.28) < 1),
    ).toBe(true);
    if (n > 1) expect(pdf.getPageCount()).toBeGreaterThan(1);
    expect(pdf.getTitle()).toContain("Analítico");
    if (process.env.REPORT_PDF_QA) {
      await mkdir("tmp/reports", { recursive: true });
      await writeFile(`tmp/reports/analitico-${n}.pdf`, bytes);
    }
  },
  30000,
);
it("generates compact synthetic with preserved accented text", async () => {
  const bytes = await createFinanceReportPdf(fixture(49, "SYNTHETIC"));
  const pdf = await PDFDocument.load(bytes);
  expect(pdf.getPageCount()).toBe(1);
  if (process.env.REPORT_PDF_QA)
    await writeFile("tmp/reports/sintetico.pdf", bytes);
});

it("embeds a valid church logo and keeps the report readable", async () => {
  const sharp = (await import("sharp")).default;
  const logo = await sharp({
    create: {
      width: 48,
      height: 48,
      channels: 4,
      background: { r: 10, g: 94, b: 67, alpha: 1 },
    },
  })
    .png()
    .toBuffer();
  const input = fixture(1, "SYNTHETIC");
  input.church.logoDataUri = `data:image/png;base64,${logo.toString("base64")}`;
  const pdf = await PDFDocument.load(await createFinanceReportPdf(input));
  expect(pdf.getPageCount()).toBe(1);
  expect(pdf.getPages()[0].node.Resources()?.toString()).toContain("XObject");
});
