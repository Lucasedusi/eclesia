import { describe, expect, it } from "vitest";
import { createCaravanThermalReceiptHtml } from "./event-caravan-receipt-html";
import type { CaravanReceiptData } from "./event-caravan-receipt.service";

const receipt: CaravanReceiptData = {
  groupNumber: "CAR-001",
  eventName: "Encontro Regional",
  hostChurchName: "Igreja Central",
  hostChurchCity: "Recife",
  hostChurchState: "PE",
  seniorPastorName: "Pr. Responsável",
  seniorPastorSpouseName: "",
  originChurchName: "Congregação Esperança",
  originCity: "Olinda",
  originState: "PE",
  responsibleName: "Ana & João",
  responsiblePhone: "(81) 99999-0000",
  pastorName: "Pr. José",
  totalRegistrations: 25,
  maleCount: 12,
  femaleCount: 13,
  items: [{ name: "Inscrição", quantity: 25, unitPrice: 50, totalPrice: 1250 }],
  totalAmount: 1250,
  paidAmount: 500,
  remainingAmount: 750,
  paymentStatus: "PARTIAL",
  createdAt: "2026-09-05T12:00:00.000Z",
  updatedAt: "2026-09-05T13:00:00.000Z",
  verificationToken: "ek1_caravan_test",
};

describe("createCaravanThermalReceiptHtml", () => {
  it("gera comprovante de caravana em 80 mm com situação e totais", () => {
    const html = createCaravanThermalReceiptHtml(receipt);
    expect(html).toContain("size:80mm auto");
    expect(html).toContain("CAR-001");
    expect(html).toContain("Congregação Esperança");
    expect(html).toContain("PAGAMENTO PARCIAL");
    expect(html).toContain("R$&nbsp;750,00");
  });

  it("escapa conteúdo vindo do cadastro", () => {
    const html = createCaravanThermalReceiptHtml(receipt);
    expect(html).toContain("Ana &amp; João");
    expect(html).not.toContain("Ana & João");
  });
});
