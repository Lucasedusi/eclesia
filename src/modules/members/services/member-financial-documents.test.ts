import { afterEach, expect, it, vi } from "vitest";
import { PDFDocument, PDFPage } from "pdf-lib";
import ExcelJS from "exceljs";
import { mkdir, writeFile } from "node:fs/promises";
import {
  createMemberFinancialPdf,
  createMemberFinancialWorkbook,
} from "./member-financial-documents.service";
import type { MemberFinancialDocument } from "../types/member-finance.types";
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
  member: { id: "m", name: "MARIA DE SOUZA", code: "001" },
  period: "01/11/2026 a 30/11/2026",
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
