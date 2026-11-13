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
      for (const redundant of [
        "Todos os caixas e contas",
        "Resumo por Caixa",
        "CAIXA OU CONTA",
      ])
        expect(strings).not.toContain(redundant);
      if (detailed) {
        for (const item of items)
          expect(strings.filter((s) => s === item.identity)).toHaveLength(1);
        expect(text).toContain("Papelaria Exemplo");
        expect(text).toContain("Boleto");
        expect(pdf.getPageCount()).toBeGreaterThan(2);
        const accountIndex = strings.indexOf(bank.name);
        expect(draw.mock.calls[accountIndex][1]!.x).toBeLessThan(60);
        expect(draw.mock.calls[accountIndex + 1][0]).toContain("Agência 001");
        const categoryTotals = strings.flatMap((s, i) =>
          s === "Subtotal da categoria" ? [i] : [],
        );
        expect(categoryTotals).toHaveLength(2);
        for (const [index, label, last, value] of [
          [0, "Total de entradas", items.at(-1)!.identity, "75,00"],
          [1, "Total de saídas", "Papelaria Exemplo", "12,00"],
        ] as const) {
          const category = categoryTotals[index],
            block = strings.indexOf(label);
          expect(block).toBeGreaterThan(category);
          for (const i of [category, block]) {
            const pos = draw.mock.calls[i][1]!;
            expect(pos.x).toBeGreaterThan(300);
            expect(strings[i + 1]).toContain(value);
            expect(draw.mock.calls[i + 1][1]!.y).toBe(pos.y);
            expect(draw.mock.calls[i + 1][1]!.font).toBe(pos.font);
            expect(draw.mock.instances[i]).toBe(
              draw.mock.instances[strings.indexOf(last)],
            );
          }
          expect(draw.mock.calls[block][1]!.size!).toBeGreaterThan(
            draw.mock.calls[category][1]!.size!,
          );
        }
        const movements = strings.flatMap((s, i) =>
          s === "Outras movimentações de saldo" ? [i] : [],
        );
        expect(movements).toHaveLength(2);
        for (const [index, movement] of [
          "Transferido para Caixa físico",
          "Recebido de Conta principal",
        ].entries()) {
          expect(draw.mock.instances[movements[index]]).toBe(
            draw.mock.instances[strings.indexOf(movement)],
          );
        }
        const incomePages = new Set(
          items.map(
            (item) => draw.mock.instances[strings.indexOf(item.identity)],
          ),
        );
        expect(incomePages.size).toBeGreaterThan(1);
        for (const page of incomePages) {
          const onPage = strings.filter(
            (_, i) => draw.mock.instances[i] === page,
          );
          expect(onPage).toContain(bank.name);
          expect(
            onPage.some(
              (s) =>
                s === "Ofertas" || s === "Entradas · Ofertas · continuação",
            ),
          ).toBe(true);
          for (const heading of ["Departamento", "Forma de pagamento", "Valor"])
            expect(onPage).toContain(heading);
        }
      } else {
        expect(strings).not.toContain("Quantidade");
        expect(strings).not.toContain("Todos os caixas e contas");
        expect(strings).not.toContain("Resumo por Caixa");
        expect(strings).not.toContain("CAIXA OU CONTA");
        expect(strings).toContain("Valor");
        const position = (label: string) =>
          draw.mock.calls[strings.indexOf(label)][1]!;
        expect(position("Conta principal").x).toBeLessThan(60);
        expect(position("Banco Exemplo · Agência 001 · Conta 123-4").x).toBe(
          position("Conta principal").x,
        );
        expect(position("Conta principal").y!).toBeGreaterThan(
          position("Banco Exemplo · Agência 001 · Conta 123-4").y!,
        );
        for (const [category, total] of [
          ["Ofertas", "Total de entradas"],
          ["Material", "Total de saídas"],
        ]) {
          const [value, options] = draw.mock.calls[strings.indexOf(total) + 1];
          expect(value).toContain("R$");
          expect(options!.y).toBe(position(total).y);
          expect(position(total).x! - position(category).x!).toBeGreaterThan(
            200,
          );
          expect(options!.font).toBe(position(total).font);
          expect(position(total).font).not.toBe(position(category).font);
        }
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
it.each(["SUMMARY", "DETAIL"] as const)(
  "prints a zero-movement day for a selected account in %s without duplicating the opening balance",
  async (presentation) => {
    const draw = vi.spyOn(PDFPage.prototype, "drawText");
    try {
      const totals = { opening: 500, income: 0, expense: 0, closing: 500 };
      await createFinanceReportPdf({
        ...data,
        presentation,
        box: bank.id,
        summary: totals,
        boxes: [{ ...bank, ...totals, movements: [], categories: [] }],
        payments: [],
      });
      const strings = draw.mock.calls.map(([s]) => s);
      expect(strings.filter((s) => s === "Saldo inicial")).toHaveLength(1);
      expect(strings).toContain("Sem movimentação no dia.");
      const date = strings.indexOf("02/10/2026");
      const scope = strings.indexOf(bank.name);
      expect(scope).toBe(date + 1);
      const rightEdge = (idx: number) => {
        const [s, o] = draw.mock.calls[idx];
        return o!.x! + o!.font!.widthOfTextAtSize(s, o!.size!);
      };
      expect(rightEdge(scope)).toBeCloseTo(rightEdge(date));
    } finally {
      draw.mockRestore();
    }
  },
);

it("shares a page between short accounts and leaves room between their summaries", async () => {
  const draw = vi.spyOn(PDFPage.prototype, "drawText");
  try {
    const boxes = ["Caixa um", "Caixa dois"].map((name, index) => ({
      ...bank,
      id: String(index),
      name,
      bankDetails: null,
      movements: [],
      categories: [{ ...bank.categories[0], name: `Categoria ${index}` }],
    }));
    await createFinanceReportPdf({ ...data, boxes });
    const texts = draw.mock.calls.map(([s]) => s);
    const first = texts.indexOf(boxes[0].name);
    const second = texts.indexOf(boxes[1].name);
    const subtotal = texts.indexOf("Total de entradas");
    expect(first).toBeGreaterThan(texts.indexOf("Saldo final"));
    expect(second).toBeGreaterThan(subtotal);
    expect(draw.mock.instances[first]).toBe(draw.mock.instances[second]);
    expect(
      draw.mock.calls[subtotal][1]!.y! - draw.mock.calls[second][1]!.y!,
    ).toBeGreaterThan(23);
    expect(
      draw.mock.calls[texts.indexOf("Saldo final")][1]!.y! -
        draw.mock.calls[first][1]!.y!,
    ).toBeGreaterThan(23);
  } finally {
    draw.mockRestore();
  }
});

it("moves an account heading with its opening rows and keeps the last category and subtotal on the same sheet", async () => {
  const draw = vi.spyOn(PDFPage.prototype, "drawText");
  try {
    // Vary the space left by the preceding account to exercise breaks at the heading, rows and subtotal.
    let sawContinuation = false,
      sawFreshStart = false;
    for (const count of [16, 19, 22, 25, 28, 31, 34, 37, 40]) {
      draw.mockClear();
      const group = (prefix: string, n: number) =>
        Array.from({ length: n }, (_, i) => ({
          ...bank.categories[0],
          name: `${prefix} ${i + 1}`,
        }));
      const boxes = [
        { ...bank, categories: group("Oferta", count), movements: [] },
        {
          ...bank,
          id: "cash",
          name: "Segundo caixa",
          categories: group("Missões", 3),
          movements: [],
        },
      ];
      await createFinanceReportPdf({ ...data, boxes });
      const texts = draw.mock.calls.map(([s]) => s);
      const pageOf = (text: string) => {
        expect(texts).toContain(text);
        return draw.mock.instances[texts.indexOf(text)];
      };
      const total = texts.flatMap((s, i) =>
        s === "Total de entradas" ? [i] : [],
      );
      expect(total).toHaveLength(2);
      expect(pageOf(`Oferta ${count}`)).toBe(draw.mock.instances[total[0]]);
      expect(pageOf("Missões 3")).toBe(draw.mock.instances[total[1]]);
      expect(pageOf("Segundo caixa")).toBe(pageOf("Missões 1"));
      expect(pageOf("Segundo caixa")).toBe(pageOf("Missões 2"));
      expect(texts.filter((s) => s === "Segundo caixa")).toHaveLength(1);
      if (texts.includes("Entradas · continuação")) {
        const page = pageOf("Entradas · continuação");
        expect(
          texts.some(
            (s, i) => s === bank.name && draw.mock.instances[i] === page,
          ),
        ).toBe(true);
        sawContinuation = true;
      }
      if (pageOf("Segundo caixa") !== draw.mock.instances[total[0]])
        sawFreshStart = true;
    }
    expect(sawContinuation).toBe(true);
    expect(sawFreshStart).toBe(true);
  } finally {
    draw.mockRestore();
  }
});

it("closes each detailed category and direction once for each account", async () => {
  const draw = vi.spyOn(PDFPage.prototype, "drawText");
  try {
    const boxes = ["Caixa A", "Caixa B"].map((name, index) => {
      const categories = ["Oferta", "Missões"].map((label, i) => {
        const cents = (index + 1) * (i + 1) * 100;
        return {
          ...bank.categories[0],
          name: label,
          count: 1,
          cents,
          items: [{ ...items[0], identity: `${name} / ${label}`, cents }],
        };
      });
      return {
        ...bank,
        id: name,
        name,
        income: categories[0].cents + categories[1].cents,
        categories,
        movements: [],
      };
    });
    await createFinanceReportPdf({ ...data, presentation: "DETAIL", boxes });
    const lines = draw.mock.calls.map(([s]) => s);
    const values = (label: string) =>
      lines.flatMap((s, i) =>
        s === label ? [lines[i + 1].replace(/\s/g, "")] : [],
      );
    expect(values("Subtotal da categoria")).toEqual([
      "R$1,00",
      "R$2,00",
      "R$2,00",
      "R$4,00",
    ]);
    expect(values("Total de entradas")).toEqual(["R$3,00", "R$6,00"]);
    expect(lines).not.toContain("Total de saídas");
  } finally {
    draw.mockRestore();
  }
});

it("keeps the end of a multiline detail with both totals and never reprints its description", async () => {
  const draw = vi.spyOn(PDFPage.prototype, "drawText");
  try {
    const description = Array.from(
      { length: 100 },
      (_, i) => `Linha ${i + 1}`,
    ).join("\n");
    const category = {
      ...bank.categories[0],
      count: 1,
      cents: 100,
      items: [{ ...items[0], description }],
    };
    await createFinanceReportPdf({
      ...data,
      presentation: "DETAIL",
      boxes: [{ ...bank, income: 100, categories: [category], movements: [] }],
    });
    const texts = draw.mock.calls.map(([s]) => s);
    for (const line of description.split("\n"))
      expect(texts.filter((s) => s === line)).toHaveLength(1);
    const pageOf = (line: string) => draw.mock.instances[texts.indexOf(line)];
    expect(pageOf(bank.name)).toBe(pageOf(items[0].identity));
    expect(pageOf("Linha 100")).toBe(pageOf("Subtotal da categoria"));
    expect(pageOf("Linha 100")).toBe(pageOf("Total de entradas"));
  } finally {
    draw.mockRestore();
  }
});

it("prints the pastor's one-page cash balance with one indicator and account details", async () => {
  const draw = vi.spyOn(PDFPage.prototype, "drawText");
  try {
    const bytes = await createFinanceReportPdf({
      ...data,
      presentation: "BALANCES",
      totalCents: 116300,
      accounts: [
        {
          id: "cash",
          name: "Caixa físico",
          bankDetails: null,
          closing: 500,
          inactive: false,
        },
        {
          id: "bank",
          name: bank.name,
          bankDetails: bank.bankDetails,
          closing: 115800,
          inactive: false,
        },
        {
          id: "zero",
          name: "Caixa de apoio",
          bankDetails: null,
          closing: 0,
          inactive: false,
        },
      ],
    });
    const texts = draw.mock.calls.map(([s]) => s);
    expect(texts).toContain("RESUMO DE CAIXA");
    expect(texts).toContain("Saldo total geral");
    expect(texts).toContain("Caixa ou conta");
    expect(texts).toContain("Saldo");
    expect(texts).toContain("02/10/2026");
    expect(texts).toContain("Catedral");
    expect(texts).toContain("Caixa de apoio");
    const normalized = texts.map((line) => line.replace(/\s/g, ""));
    expect(normalized).toContain("R$0,00");
    expect(normalized).toContain("R$1.158,00");
    expect(texts.join(" ")).toContain("Agência 001");
    expect(texts.join(" ")).toContain("1.163,00");
    const baseline = (text: string) =>
      draw.mock.calls[texts.indexOf(text)][1]!.y!;
    const details = texts.find((line) => line.includes("Agência 001"))!;
    expect(
      baseline("Caixa físico") - baseline(bank.name),
    ).toBeGreaterThanOrEqual(28);
    expect(baseline(bank.name) - baseline(details)).toBeGreaterThanOrEqual(15);
    expect(
      baseline(details) - baseline("Caixa de apoio"),
    ).toBeGreaterThanOrEqual(28);
    expect(baseline(bank.name)).toBe(
      baseline(texts[normalized.indexOf("R$1.158,00")]),
    );

    for (const other of [
      "Entradas",
      "Saídas",
      "Conferência e aprovação",
      "Resumo por forma de pagamento",
      "Ofertas",
    ])
      expect(texts).not.toContain(other);
    expect((await PDFDocument.load(bytes)).getPageCount()).toBe(1);
    if (process.env.REPORT_PDF_QA) {
      await mkdir("tmp/reports", { recursive: true });
      await writeFile("tmp/reports/resumo-de-caixa.pdf", bytes);
    }
  } finally {
    draw.mockRestore();
  }
});
