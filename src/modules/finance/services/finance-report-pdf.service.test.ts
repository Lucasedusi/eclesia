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
        cashboxCategories: n
          ? [
              {
                cashboxId: common.cashboxes[0].id,
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

it("repeats consolidated indicators at the end and separates the opening indicators from entries", async () => {
  const text = vi.spyOn(PDFPage.prototype, "drawText");
  const rectangles = vi.spyOn(PDFPage.prototype, "drawRectangle");
  try {
    const bytes = await createFinanceReportPdf(fixture(1, "ANALYTIC"));
    const labels = text.mock.calls
      .filter(([, o]) => o?.size === 8.5)
      .map(([t]) => t);
    for (const label of [
      "Saldo anterior",
      "Entradas",
      "Saídas",
      "Saldo final",
    ]) {
      expect(labels.filter((t) => t === label)).toHaveLength(2);
    }
    expect(text.mock.calls.map(([t]) => t)).toContain(
      "Resumo final do período",
    );
    const summaryValue = text.mock.calls.find(([, o]) => o?.size === 11)![1]!;
    const firstSection = text.mock.calls.find(([t]) => t === "ENTRADAS")![1]!;
    expect(summaryValue.y! - firstSection.y!).toBeGreaterThanOrEqual(55);
    if (process.env.REPORT_PDF_QA)
      await writeFile("tmp/reports/analitico-resumo-final.pdf", bytes);
  } finally {
    text.mockRestore();
    rectangles.mockRestore();
  }
});

it("prints bank identification below its name and in continuation headers", async () => {
  const input = fixture(49, "ANALYTIC");
  Object.assign(input.cashboxes[0], {
    name: "Conta bancária",
    bankDetails: {
      bankName: "Banco Exemplo",
      agency: "0001",
      accountNumber: "12345-6",
    },
  });
  const text = vi.spyOn(PDFPage.prototype, "drawText");
  try {
    const bytes = await createFinanceReportPdf(input);
    const details = text.mock.calls.filter(
      ([t]) => t.includes("Agência 0001") && t.includes("Conta 12345-6"),
    );
    expect(details.length).toBeGreaterThanOrEqual(3);
    expect(details.every(([, o]) => o!.size! <= 7.5)).toBe(true);
    if (process.env.REPORT_PDF_QA)
      await writeFile("tmp/reports/analitico-dados-bancarios.pdf", bytes);
  } finally {
    text.mockRestore();
  }
});

it("summarizes each cashbox with classified totals, compact typography and a closing summary", async () => {
  const input = fixture(49, "SYNTHETIC");
  if (input.type !== "SYNTHETIC") throw new Error("Synthetic fixture required");
  const base = input.cashboxCategories[0];
  input.cashboxCategories = [
    { ...base, classificationName: "Jovens", amountCents: 20000, count: 20 },
    {
      ...base,
      classificationId: "women",
      classificationName: "Senhoras",
      amountCents: 19000,
      count: 19,
    },
    {
      ...base,
      categoryId: "offering",
      categoryName: "Oferta de culto",
      classificationId: null,
      classificationName: null,
      amountCents: 10000,
      count: 10,
    },
  ];
  input.cashboxes[0].bankDetails = {
    bankName: "Banco Exemplo",
    agency: "0001",
    accountNumber: "12345-6",
  };
  input.movements = [
    {
      id: base.cashboxId,
      date: "2026-10-01",
      kind: "ADJUSTMENT",
      description: "Detalhe que não pertence ao resumo",
      amountCents: 0,
    },
  ];
  const draw = vi.spyOn(PDFPage.prototype, "drawText");
  try {
    const bytes = await createFinanceReportPdf(input);
    const texts = draw.mock.calls.map(([text]) => text);
    expect(texts).toContain("RELATÓRIO FINANCEIRO SINTÉTICO");
    expect(texts.some((t) => t.startsWith("Endereço:"))).toBe(true);
    expect(texts).toContain("ENTRADAS");
    expect(texts).toContain("SAÍDAS");
    expect(texts).toContain("Subtotal Dízimos");
    expect(texts).not.toContain("Subtotal Oferta de culto");
    expect(texts).not.toContain("Subtotal da categoria");
    expect(texts).not.toContain("Lançamentos");
    expect(texts).not.toContain("Outros movimentos de saldo");
    expect(texts).not.toContain(input.movements[0].description);
    expect(
      texts.filter((t) => t === "Saldo anterior").length,
    ).toBeGreaterThanOrEqual(3); // initial, balance table, final
    expect(texts).toContain("Resumo final do período");
    expect(texts).toContain("Resumo por departamento");
    expect(
      texts.some((t) => t.includes("Agência 0001") && t.includes("12345-6")),
    ).toBe(true);
    const parent = texts.indexOf("Dízimos"),
      child = texts.indexOf("Jovens");
    expect(draw.mock.calls[child][1]?.size).toBe(7.5);
    expect(draw.mock.calls[child][1]?.x).toBeGreaterThan(
      draw.mock.calls[parent][1]?.x ?? 0,
    );
    expect(draw.mock.instances[parent]).toBe(draw.mock.instances[child]);
    const pdf = await PDFDocument.load(bytes);
    expect(pdf.getPageCount()).toBeLessThanOrEqual(2);
    if (process.env.REPORT_PDF_QA)
      await writeFile("tmp/reports/sintetico-classificado.pdf", bytes);
  } finally {
    draw.mockRestore();
  }
});

it("keeps same-named synthetic cashboxes separate without forcing a new page for each", async () => {
  const input = fixture(0, "SYNTHETIC");
  input.departments = [];
  input.cashboxes.push({
    ...input.cashboxes[0],
    id: "00000000-0000-4000-8000-000000000003",
  });
  input.summary.openingCents *= 2;
  input.summary.closingCents *= 2;
  const draw = vi.spyOn(PDFPage.prototype, "drawText");
  try {
    const bytes = await createFinanceReportPdf(input);
    const entries = draw.mock.calls.flatMap(([text], i) =>
      text === "ENTRADAS" ? [i] : [],
    );
    expect(entries).toHaveLength(2);
    expect(draw.mock.instances[entries[0]]).toBe(
      draw.mock.instances[entries[1]],
    );
    expect(
      draw.mock.calls.filter(([text]) => text === "TOTAL DE ENTRADAS"),
    ).toHaveLength(2);
    if (process.env.REPORT_PDF_QA)
      await writeFile("tmp/reports/sintetico-dois-caixas.pdf", bytes);
  } finally {
    draw.mockRestore();
  }
});

it("repeats synthetic category context across pages and keeps the last row with its subtotal", async () => {
  const input = fixture(49, "SYNTHETIC");
  if (input.type !== "SYNTHETIC") throw new Error("Synthetic fixture required");
  const base = input.cashboxCategories[0];
  input.cashboxCategories = Array.from({ length: 49 }, (_, i) => ({
    ...base,
    classificationId: `class-${i}`,
    classificationName: `Classificação ${i + 1}`,
    amountCents: 1000,
    count: 1,
  }));
  const draw = vi.spyOn(PDFPage.prototype, "drawText");
  try {
    const bytes = await createFinanceReportPdf(input);
    const texts = draw.mock.calls.map(([text]) => text);
    expect(texts).toContain("Dízimos · continuação");
    for (let i = 1; i <= 49; i++)
      expect(texts.filter((t) => t === `Classificação ${i}`)).toHaveLength(1);
    expect(draw.mock.instances[texts.indexOf("Classificação 49")]).toBe(
      draw.mock.instances[texts.indexOf("Subtotal Dízimos")],
    );
    for (const [text, options] of draw.mock.calls) {
      expect(options!.y).toBeGreaterThanOrEqual(20);
      expect(
        options!.x! + options!.font!.widthOfTextAtSize(text, options!.size!),
      ).toBeLessThanOrEqual(562);
    }
    const finalSummary = texts.indexOf("Resumo final do período");
    const issuedNotice = texts.findIndex((t) => t.startsWith("49 lançamento"));
    expect(draw.mock.instances[finalSummary]).toBe(
      draw.mock.instances[issuedNotice],
    );
    if (process.env.REPORT_PDF_QA)
      await writeFile("tmp/reports/sintetico-paginado.pdf", bytes);
  } finally {
    draw.mockRestore();
  }
});

it("prints income and expenses of each synthetic cashbox without mixing same-named accounts", async () => {
  const input = fixture(4, "SYNTHETIC");
  if (input.type !== "SYNTHETIC") throw new Error("Synthetic fixture required");
  const base = input.cashboxCategories[0];
  const otherId = "00000000-0000-4000-8000-000000000003";
  input.cashboxes = [
    {
      ...input.cashboxes[0],
      incomeCents: 1000,
      expenseCents: 200,
      closingCents: -9200,
      count: 2,
    },
    {
      ...input.cashboxes[0],
      id: otherId,
      incomeCents: 2000,
      expenseCents: 300,
      closingCents: -8300,
      count: 2,
      bankDetails: {
        bankName: "Banco Exemplo",
        agency: "0001",
        accountNumber: "12345-6",
      },
    },
  ];
  input.cashboxCategories = input.cashboxes.flatMap((box, i) => [
    {
      ...base,
      cashboxId: box.id,
      classificationName: i ? "Senhoras" : "Jovens",
      amountCents: box.incomeCents,
      count: 1,
    },
    {
      ...base,
      cashboxId: box.id,
      categoryId: "expense",
      categoryName: "Despesas prediais",
      classificationId: null,
      classificationName: null,
      direction: "EXPENSE" as const,
      amountCents: box.expenseCents,
      count: 1,
    },
  ]);
  Object.assign(input.summary, {
    openingCents: -20000,
    incomeCents: 3000,
    expenseCents: 500,
    closingCents: -17500,
    count: 4,
  });
  input.departments = [
    { id: "dep", name: "Tesouraria", incomeCents: 3000, expenseCents: 500 },
  ];
  const draw = vi.spyOn(PDFPage.prototype, "drawText");
  try {
    const bytes = await createFinanceReportPdf(input);
    const text = draw.mock.calls.map(([text]) => text);
    const sections = text.flatMap((t, i) =>
      t === "ENTRADAS" || t === "SAÍDAS" ? [i] : [],
    );
    expect(sections.map((i) => text[i])).toEqual([
      "ENTRADAS",
      "SAÍDAS",
      "ENTRADAS",
      "SAÍDAS",
    ]);
    expect(text.slice(sections[0], sections[1])).toContain("Jovens");
    expect(text.slice(sections[0], sections[1])).not.toContain("Senhoras");
    expect(text.slice(sections[1], sections[2])).toContain("R$ 2,00");
    expect(text.slice(sections[2], sections[3])).toContain("Senhoras");
    expect(text.slice(sections[2], sections[3])).not.toContain("Jovens");
    expect(text.slice(sections[3])).toContain("R$ 3,00");
    if (process.env.REPORT_PDF_QA)
      await writeFile("tmp/reports/sintetico-caixas-movimentados.pdf", bytes);
  } finally {
    draw.mockRestore();
  }
});

it.each([11, 12, 13])(
  "keeps a synthetic cashbox heading with its first classified group near a page break (%i)",
  async (n) => {
    const input = fixture(8, "SYNTHETIC");
    if (input.type !== "SYNTHETIC")
      throw new Error("Synthetic fixture required");
    const base = input.cashboxCategories[0];
    const otherId = "00000000-0000-4000-8000-000000000003";
    input.cashboxes.push({
      ...input.cashboxes[0],
      id: otherId,
      name: "Segundo caixa",
    });
    input.cashboxCategories = [
      ...Array.from({ length: n }, (_, i) => ({
        ...base,
        classificationId: `c-${i}`,
        classificationName: `Grupo ${i}`,
        amountCents: 1000,
        count: 1,
      })),
      {
        ...base,
        cashboxId: otherId,
        classificationName: "Grupo do segundo caixa",
        amountCents: 1000,
        count: 1,
      },
    ];
    const draw = vi.spyOn(PDFPage.prototype, "drawText");
    try {
      await createFinanceReportPdf(input);
      const texts = draw.mock.calls.map(([text]) => text);
      const entries = texts.flatMap((t, i) => (t === "ENTRADAS" ? [i] : []));
      expect(
        draw.mock.instances[entries[1]] ===
          draw.mock.instances[texts.indexOf("Grupo do segundo caixa")],
      ).toBe(true);
    } finally {
      draw.mockRestore();
    }
  },
);

it.each(["ANALYTIC", "SYNTHETIC"] as const)(
  "uses soft section colors, rounded surfaces and a quiet empty state in %s",
  async (type) => {
    const input = fixture(1, type);
    const original = structuredClone(input);
    const text = vi.spyOn(PDFPage.prototype, "drawText");
    const rectangles = vi.spyOn(PDFPage.prototype, "drawRectangle");
    const paths = vi.spyOn(PDFPage.prototype, "drawSvgPath");
    try {
      await createFinanceReportPdf(input);
      expect(input).toEqual(original);
      const filledBands = rectangles.mock.calls.filter(
        ([o]) =>
          o!.width! > 500 && o!.color?.type === "RGB" && o!.color.red < 0.8,
      );
      expect(filledBands).toHaveLength(0);
      expect(paths.mock.calls.length).toBeGreaterThanOrEqual(8);
      const labels = text.mock.calls.map(([t]) => t);
      expect(labels).toContain("TOTAL DE SAÍDAS");
      for (const title of [
        "ENTRADAS",
        "SAÍDAS",
        "TOTAL DE ENTRADAS",
        "TOTAL DE SAÍDAS",
      ]) {
        const options = text.mock.calls[labels.indexOf(title)][1]!;
        expect(options.color).not.toEqual({
          type: "RGB",
          red: 1,
          green: 1,
          blue: 1,
        });
      }
    } finally {
      text.mockRestore();
      rectangles.mockRestore();
      paths.mockRestore();
    }
  },
);

it("keeps balance notes and final indicators together in a two-box analytic report", async () => {
  const input = fixture(11, "ANALYTIC");
  if (input.type !== "ANALYTIC") throw new Error("Analytic fixture required");
  const bankId = "00000000-0000-4000-8000-000000000003";
  input.rows.forEach((row, i) => {
    row.description = i === 4 || i === 5 ? "Oferta do culto de ensino" : null;
    row.documentNumber = null;
    row.cashboxId = i < 9 ? input.cashboxes[0].id : bankId;
    row.classificationId =
      i < 4 || i === 9
        ? i === 0
          ? "senhoras"
          : i === 3
            ? "criancas"
            : "missionarias"
        : null;
    row.classificationName =
      row.classificationId === "senhoras"
        ? "Senhoras"
        : row.classificationId === "criancas"
          ? "Crianças"
          : row.classificationId
            ? "Missionárias"
            : null;
    row.categoryId =
      i === 8
        ? "expense"
        : i === 6 || i === 7
          ? "missions"
          : row.classificationId
            ? "tithe"
            : "offering";
    row.categoryName =
      i === 8
        ? "Manutenção predial"
        : i === 6 || i === 7
          ? "Oferta de missões"
          : row.classificationId
            ? "Dízimos"
            : "Oferta de culto";
    row.direction = i === 8 ? "EXPENSE" : "INCOME";
  });
  input.cashboxes = [
    {
      ...summary,
      id: input.cashboxes[0].id,
      name: "Caixa local",
      openingCents: 0,
      incomeCents: 8000,
      expenseCents: 1000,
      adjustmentCents: -500,
      closingCents: 6500,
      count: 9,
    },
    {
      ...summary,
      id: bankId,
      name: "Conta bancária",
      openingCents: 0,
      incomeCents: 2000,
      adjustmentCents: -2000,
      closingCents: 0,
      count: 2,
      bankDetails: {
        bankName: "Banco Exemplo",
        agency: "0001",
        accountNumber: "12345-6",
      },
    },
  ];
  input.summary = {
    ...summary,
    openingCents: 0,
    incomeCents: 10000,
    expenseCents: 1000,
    adjustmentCents: -2500,
    closingCents: 6500,
    count: 11,
  };
  const text = vi.spyOn(PDFPage.prototype, "drawText");
  try {
    const bytes = await createFinanceReportPdf(input);
    const labels = text.mock.calls.map(([t]) => t);
    expect(
      text.mock.instances[labels.indexOf("Caixas e contas")] ===
        text.mock.instances[labels.indexOf("Resumo final do período")],
    ).toBe(true);
    expect((await PDFDocument.load(bytes)).getPageCount()).toBeLessThanOrEqual(
      3,
    );
    if (process.env.REPORT_PDF_QA)
      await writeFile("tmp/reports/analitico-refinamento.pdf", bytes);
  } finally {
    text.mockRestore();
  }
});
