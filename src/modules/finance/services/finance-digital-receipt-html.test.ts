import { expect, it } from "vitest";
import { renderFinanceDigitalReceipt, renderUnavailableDigitalReceipt } from "./finance-digital-receipt-html";
import type { DigitalReceipt } from "../types/finance-digital-receipt.types";

export const sampleDigitalReceipt: DigitalReceipt = {
  number: "FIN-1234567890ABCDEFGHIJ1234567890ABCD", direction: "INCOME",
  churchName: "Igreja Teste", churchDocument: "00.000.000/0001-00", congregationName: "Congregação Central",
  congregationAddress: "Rua das Flores, 100 · Centro · Goiânia / GO", logoDataUri: null,
  personName: "Maria Aparecida dos Santos", date: "2026-11-02", registeredAt: "2026-11-02T13:30:00Z",
  paymentMethodName: "Pix", totalCents: 25000,
  items: [{ categoryName: "Dízimo", departmentName: "Tesouraria", classificationName: null, amountCents: 20000 }, { categoryName: "Oferta de missões", departmentName: "Missões", classificationName: null, amountCents: 5000 }],
};
it("renders a full receipt with every item, a PDF link and neutral social metadata", () => {
  const html = renderFinanceDigitalReceipt(sampleDigitalReceipt, `/comprovante/${"a".repeat(43)}/pdf`);
  expect(html).toContain("Maria Aparecida dos Santos");
  expect(html).toContain("Oferta de missões");
  expect(html).toContain("250,00");
  expect(html).toContain("Baixar PDF");
  expect(html).toContain('name="robots" content="noindex, nofollow, noarchive, nosnippet"');
  const head = html.split("</head>")[0];
  expect(head).not.toContain("Maria");
  expect(head).not.toContain("250,00");
});
it("escapes stored content and rejects unsafe resource URLs", () => {
  const html = renderFinanceDigitalReceipt({ ...sampleDigitalReceipt, personName: '<script>alert("x")</script>', logoDataUri: "https://attacker.test/track" }, 'javascript:alert("x")');
  expect(html).not.toContain("<script>");
  expect(html).toContain("&lt;script&gt;");
  expect(html).not.toContain("attacker.test");
  expect(html).not.toContain("javascript:");
});
it("labels expenses and collective contributions correctly", () => {
  expect(renderFinanceDigitalReceipt({ ...sampleDigitalReceipt, direction: "EXPENSE" }, "")).toContain("Pago a");
  expect(renderFinanceDigitalReceipt({ ...sampleDigitalReceipt, personName: null }, "")).toContain("Contribuição coletiva");
});
it("shows a neutral unavailable state without receipt details", () => {
  expect(renderUnavailableDigitalReceipt()).toContain("Comprovante indisponível");
  expect(renderUnavailableDigitalReceipt()).not.toContain("Baixar PDF");
});
