import { afterEach, expect, it, vi } from "vitest";
import { PDFDocument, PDFPage } from "pdf-lib";
import ExcelJS from "exceljs";
import { mkdir, writeFile } from "node:fs/promises";
import {
  createMemberFinancialPdf,
  createMemberFinancialWorkbook,
} from "./member-financial-documents.service";
import type { MemberFinancialDocument } from "../types/member-finance.types";
import { PDF_COLORS } from "@/lib/pdf/church-document";
vi.mock("server-only", () => ({}));
afterEach(() => vi.restoreAllMocks());
const data: MemberFinancialDocument = {
  issuedAt: "2026-11-09T12:00:00Z",
  church: {
    name: "Campo de Teste",
    pastorNames: ["Paulo", "Ana"],
    logoDataUri: null,
    address: "",
    phone: "",
    document: "",
  },
  member: { id: "m", name: "MARIA DE SOUZA", code: "001", congregationName: "Congregação de Teste" },
  period: "01/11/2026 a 30/11/2026",
  category: null,
  categories: [],
  summary: {
    incomeCents: 10000,
    expenseCents: 0,
    cancelledCents: 10000,
    pendingCents: 0,
  },
  items: [
    {
      id: "1",
      transactionNumber: null,
      transactionType: "INCOME",
      description: '=HYPERLINK("teste")',
      amount: 100,
      transactionDate: "2026-11-01",
      status: "CONFIRMED",
      category: "Dízimo",
      paymentMethod: "Pix",
    },
  ],
};
it("creates a paginated branded PDF with translated labels, readable names and complete long descriptions", async () => {
  const draw = vi.spyOn(PDFPage.prototype, "drawText");
  const input = {
    ...data,
    items: Array.from({ length: 40 }, (_, i) => ({
      ...data.items[0],
      id: String(i),
      description:
        i === 20
          ? "Descrição longa ".repeat(100) + "FIM DO TEXTO"
          : data.items[0].description,
    })),
  };
  const bytes = await createMemberFinancialPdf(input);
  const pdf = await PDFDocument.load(bytes);
  expect(pdf.getPageCount()).toBeGreaterThan(1);
  const text = draw.mock.calls.map(([t]) => t).join(" ");
  for (const value of [
    "Maria de Souza",
    "Presidentes: Paulo e Ana",
    "Eklesias",
    "Confirmado",
    "FIM DO TEXTO",
    "Cancelados",
  ])
    expect(text).toContain(value);
  expect(text).not.toContain("CONFIRMED");
  for (const [text, o] of draw.mock.calls) {
    expect(o!.y).toBeGreaterThanOrEqual(20);
    expect(
      o!.x! + o!.font!.widthOfTextAtSize(text, o!.size!),
    ).toBeLessThanOrEqual(841.89 - 30);
  }
  if (process.env.MEMBER_REPORT_QA_DIR) {
    await mkdir(process.env.MEMBER_REPORT_QA_DIR, { recursive: true });
    await writeFile(
      `${process.env.MEMBER_REPORT_QA_DIR}/financeiro-membro.pdf`,
      bytes,
    );
  }
});
it("exports literal descriptions, numeric money and all rows to Excel", async () => {
  const book = new ExcelJS.Workbook();
  await book.xlsx.load((await createMemberFinancialWorkbook(data)) as never);
  const sheet = book.worksheets[0];
  expect(sheet.getCell("D8").value).toBe(data.items[0].description);
  expect(sheet.getCell("G8").value).toBe(100);
  expect(sheet.getCell("F8").value).toBe("Confirmado");
  expect(sheet.getCell("G8").numFmt).toContain("0.00");
});

it("identifies the selected category in PDF and Excel even with no transactions", async () => {
  const input = { ...data, items: [], category: "Ofertas missionárias" };
  const draw = vi.spyOn(PDFPage.prototype, "drawText");
  await createMemberFinancialPdf(input);
  expect(draw.mock.calls.map(([text]) => text).join(" ")).toContain(
    "Categoria: Ofertas missionárias",
  );
  const book = new ExcelJS.Workbook();
  await book.xlsx.load((await createMemberFinancialWorkbook(input)) as never);
  expect(book.worksheets[0].getCell("A4").value).toContain(
    "Categoria: Ofertas missionárias",
  );
  expect(book.worksheets[0].getRow(7).values).toContain("Valor");
});

it("centers the short header, aligns the summary and emphasizes amounts and expenses", async () => {
  const draw = vi.spyOn(PDFPage.prototype, "drawText");
  const input = {
    ...data,
    period: "Todo o período",
    summary: {
      incomeCents: 249200,
      expenseCents: 12000,
      cancelledCents: 3500,
      pendingCents: 0,
    },
    items: Array.from({ length: 10 }, (_, i) => ({
      ...data.items[0],
      id: String(i),
      transactionType: i % 2 ? "EXPENSE" : "INCOME",
      amount: i % 2 ? 120 : 249.2,
      category: i % 2 ? "Assistência" : "Dízimo",
      description: i % 2 ? "Auxílio ao membro" : "Contribuição do membro",
    })),
  };
  const bytes = await createMemberFinancialPdf(input);
  const calls = draw.mock.calls;
  const text = calls.map(([t]) => t).join(" ");
  expect(text).not.toMatch(
    /Todo o período|Entradas confirmadas|Saídas confirmadas/,
  );
  const count = calls.find(([t]) => t === "10 lançamento(s)")![1]!;
  const total = calls.find(([t]) => t === "Entradas: ")![1]!;
  expect(total.y).toBe(count.y);
  expect(total.x).toBeGreaterThan(count.x! + 100);
  const money = calls.filter(([t]) => t.startsWith("R$"));
  expect(money.length).toBe(14);
  expect(money.every(([, o]) => o!.font === count.font)).toBe(true);
  const expenses = calls.filter(
    ([t, o]) =>
      t === "Saída" || (t.includes("120,00") && o!.color === PDF_COLORS.danger),
  );
  expect(expenses).toHaveLength(10);
  expect(expenses.every(([, o]) => o!.color === PDF_COLORS.danger)).toBe(true);
  const name = calls.find(([t]) => t === "CAMPO DE TESTE")![1]!;
  const presidents = calls.find(([t]) => t === "Presidentes: Paulo e Ana")![1]!;
  const topPadding =
    595.28 -
    name.y! -
    name.font!.heightAtSize(name.size!, { descender: false });
  const bottomPadding = presidents.y! - (595.28 - 94);
  expect(Math.abs(topPadding - bottomPadding)).toBeLessThan(1);
  for (const [t, o] of calls) {
    expect(o!.x! + o!.font!.widthOfTextAtSize(t, o!.size!)).toBeLessThanOrEqual(
      841.89 - 30,
    );
  }
  if (process.env.MEMBER_REPORT_QA_DIR) {
    await mkdir(process.env.MEMBER_REPORT_QA_DIR, { recursive: true });
    await writeFile(
      `${process.env.MEMBER_REPORT_QA_DIR}/financeiro-resumo.pdf`,
      bytes,
    );
  }
});
