import { expect, it, vi } from "vitest";
import { PDFDocument } from "pdf-lib";
vi.mock("server-only", () => ({}));
import { createFinanceDigitalReceiptPdf } from "./finance-digital-receipt-pdf.service";
import type { DigitalReceipt } from "../types/finance-digital-receipt.types";
const receipt: DigitalReceipt = {
  number: "FIN-1234567890ABCDEFGHIJ1234567890ABCD", direction: "INCOME", churchName: "Igreja Teste", churchDocument: null,
  congregationName: "Congregação Central", congregationAddress: null, logoDataUri: null, personName: "Pessoa fictícia",
  date: "2026-11-02", registeredAt: "2026-11-02T13:30:00Z", paymentMethodName: "Pix", totalCents: 10000,
  items: [{ categoryName: "Contribuição", departmentName: "Tesouraria", classificationName: null, amountCents: 10000 }],
};
it("creates a compact PDF with no bearer token in metadata", async () => {
  const pdf = await PDFDocument.load(await createFinanceDigitalReceiptPdf(receipt));
  expect(pdf.getPageCount()).toBe(1);
  expect(pdf.getPage(0).getWidth()).toBeCloseTo(420);
  expect(pdf.getTitle()).toBe("Comprovante digital");
});
it("paginates large receipts and wraps long names instead of dropping items", async () => {
  const bytes = await createFinanceDigitalReceiptPdf({ ...receipt, personName: "Nome completo muito longo ".repeat(15), items: Array.from({ length: 75 }, (_, i) => ({ ...receipt.items[0], categoryName: `Item ${i + 1} - contribuição para o departamento de missões`, amountCents: 100 })), totalCents: 7500 });
  const pdf = await PDFDocument.load(bytes);
  expect(pdf.getPageCount()).toBeGreaterThan(2);
  for (const page of pdf.getPages()) expect(page.getHeight()).toBe(595.28);
});
