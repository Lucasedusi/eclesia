import { expect, it, vi } from "vitest";
import { PDFDocument, PDFPage } from "pdf-lib";
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
    congregationAddress:
      "Rua das Flores, 120 · Centro · Porangatu / GO · CEP 76550000",
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
          cashboxId: "00000000-0000-4000-8000-000000000002",
          cashboxName: "Caixa local",
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

it("renders classified tithe blocks with every contributor and accurate subtotals", async () => {
  const input = fixture(9, "ANALYTIC");
  if (input.type !== "ANALYTIC") throw new Error("Analytic fixture required");
  input.rows.forEach((row, i) => {
    row.classificationId = i % 2 ? "senhores" : "senhoras";
    row.classificationName = i % 2 ? "Senhores" : "Senhoras";
    row.description = null;
  });
  input.rows[4].classificationId = null;
  input.rows[4].classificationName = null;
  for (let i = 5; i < 9; i++) {
    Object.assign(input.rows[i], {
      categoryId: i < 7 ? `offering-${i}` : "expense",
      categoryName:
        i === 5
          ? "Oferta de culto"
          : i === 6
            ? "Oferta de missões"
            : "Despesas prediais",
      direction: i < 7 ? "INCOME" : "EXPENSE",
      classificationId: null,
      classificationName: null,
      personName: i < 7 ? null : "Fornecedor de manutenção",
      description:
        i < 7 ? "Oferta do culto de domingo" : "Manutenção das instalações",
      departmentName: i === 6 ? "Missões" : "Tesouraria",
      cashboxName: i % 2 ? "Caixa local" : "Conta principal",
      paymentMethodName: i % 2 ? "Dinheiro" : "Pix",
    });
  }
  Object.assign(input.summary, {
    incomeCents: 7000,
    expenseCents: 2000,
    closingCents: -5000,
  });
  Object.assign(input.cashboxes[0], input.summary);
  input.departments = [
    { id: "dep", name: "Tesouraria", incomeCents: 6000, expenseCents: 2000 },
    { id: "missions", name: "Missões", incomeCents: 1000, expenseCents: 0 },
  ];
  const logo = await (
    await import("sharp")
  )
    .default({
      create: {
        width: 60,
        height: 90,
        channels: 4,
        background: { r: 10, g: 94, b: 67, alpha: 1 },
      },
    })
    .png()
    .toBuffer();
  input.church.logoDataUri = `data:image/png;base64,${logo.toString("base64")}`;
  const draw = vi.spyOn(PDFPage.prototype, "drawText");
  try {
    const bytes = await createFinanceReportPdf(input);
    if (process.env.REPORT_PDF_QA)
      await writeFile("tmp/reports/analitico-hierarquia.pdf", bytes);
    const text = draw.mock.calls.map(([value]) => value);
    const start = text.indexOf("Dízimos — Senhoras");
    const next = text.indexOf("Dízimos — Senhores");
    const missing = text.indexOf("Dízimos — Sem classificação");
    expect(start).toBeGreaterThan(-1);
    expect(text.slice(start, next)).toContain("Pessoa fictícia 1");
    expect(text.slice(start, next)).toContain("Pessoa fictícia 3");
    expect(text.slice(start, next)).not.toContain("Pessoa fictícia 2");
    expect(text.slice(next, missing)).toContain("Pessoa fictícia 4");
    expect(text.slice(missing)).toContain("Pessoa fictícia 5");
    expect(text).toContain("Subtotal Dízimos — Senhoras");
    expect(text).toContain("Subtotal Dízimos — Senhores");
    expect(text).toContain("Subtotal Oferta de culto");
    const offeringHeading = text.indexOf("Oferta de culto");
    const offeringRow = text.indexOf("Doc. REF-6");
    expect(draw.mock.instances[offeringHeading]).toBe(
      draw.mock.instances[offeringRow],
    );
    expect(text).not.toContain("Subtotal da categoria");
    expect(text).not.toContain("Resumo por departamento");
    expect(text).not.toContain("Caixa / pagamento");
    expect(text).toContain("Pagamento");
    expect(text).toContain("RELATÓRIO FINANCEIRO ANALÍTICO");
    expect(text).toContain("TOTAL DE ENTRADAS");
    expect(text).not.toContain("Todos os caixas e contas da congregação");
    expect(text).not.toContain("Outros movimentos de saldo");
  } finally {
    draw.mockRestore();
  }
});

it("keeps same-named cashboxes separate, with income and expenses before the next cashbox page", async () => {
  const input = fixture(4, "ANALYTIC");
  if (input.type !== "ANALYTIC") throw new Error("Analytic fixture required");
  const other = "00000000-0000-4000-8000-000000000003";
  input.rows.forEach((row, index) => {
    row.description = null;
    row.cashboxId = index < 2 ? input.cashboxes[0].id : other;
    row.cashboxName = "Caixa local";
    row.direction = index % 2 ? "EXPENSE" : "INCOME";
    if (row.direction === "EXPENSE") {
      row.categoryName = "Despesa predial";
      row.classificationId = null;
      row.classificationName = null;
    }
  });
  input.cashboxes = [input.cashboxes[0].id, other].map((id) => ({
    ...summary,
    id,
    name: "Caixa local",
    incomeCents: 1000,
    expenseCents: 1000,
    count: 2,
  }));
  input.summary = {
    ...summary,
    openingCents: -20000,
    closingCents: -20000,
    incomeCents: 2000,
    expenseCents: 2000,
    count: 4,
  };
  const draw = vi.spyOn(PDFPage.prototype, "drawText");
  try {
    const bytes = await createFinanceReportPdf(input);
    const calls = draw.mock.calls;
    const index = (name: string) => calls.findIndex(([text]) => text === name);
    const firstIncome = index("Pessoa fictícia 1"),
      firstExpense = index("Pessoa fictícia 2");
    const nextIncome = index("Pessoa fictícia 3"),
      nextExpense = index("Pessoa fictícia 4");
    expect(firstExpense).toBeGreaterThan(firstIncome);
    expect(nextIncome).toBeGreaterThan(firstExpense);
    expect(nextExpense).toBeGreaterThan(nextIncome);
    expect(draw.mock.instances[firstIncome]).toBe(
      draw.mock.instances[firstExpense],
    );
    expect(draw.mock.instances[nextIncome]).not.toBe(
      draw.mock.instances[firstExpense],
    );
    expect(calls[firstIncome][1]?.size).toBeLessThan(8.5);
    expect(calls.map(([text]) => text).join(" ")).toContain(
      "Rua das Flores, 120",
    );
    if (process.env.REPORT_PDF_QA)
      await writeFile("tmp/reports/analitico-caixas.pdf", bytes);
  } finally {
    draw.mockRestore();
  }
});

it("wraps long congregation, cashbox and subtotal labels within the printable area", async () => {
  const input = fixture(1, "ANALYTIC");
  if (input.type !== "ANALYTIC") throw new Error("Analytic fixture required");
  input.congregationName =
    "Congregação do Jardim Esperança e Comunidade Missionária do Setor Central";
  input.congregationAddress =
    "Avenida das Comunidades, 1234 · Quadra 15, lote 10 · Jardim das Flores · Porangatu / GO · CEP 76550-000";
  input.cashboxes[0].name =
    "Conta bancária de arrecadação das contribuições e ofertas da congregação do Jardim Esperança";
  input.rows[0].categoryName =
    "Ofertas especiais para as atividades missionárias e evangelísticas da congregação";
  input.rows[0].classificationName =
    "Contribuição de participantes das atividades e encontros mensais";
  const draw = vi.spyOn(PDFPage.prototype, "drawText");
  try {
    const bytes = await createFinanceReportPdf(input);
    for (const [text, options] of draw.mock.calls) {
      expect(options?.x).toBeGreaterThanOrEqual(34);
      expect(
        options!.x! + options!.font!.widthOfTextAtSize(text, options!.size!),
      ).toBeLessThanOrEqual(562);
      expect(options?.y).toBeGreaterThanOrEqual(19);
    }
    if (process.env.REPORT_PDF_QA)
      await writeFile("tmp/reports/analitico-longos.pdf", bytes);
  } finally {
    draw.mockRestore();
  }
});
