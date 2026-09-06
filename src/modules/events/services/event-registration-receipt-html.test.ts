import { describe, expect, it } from "vitest";
import { createEventThermalReceiptHtml } from "./event-registration-receipt-html";
import type { PublicCheckoutStatus } from "../types/event.types";

const checkout: PublicCheckoutStatus = {
  checkoutId: "internal", eventId: "event", eventName: "Congresso <2026>", eventStartsAt: "2026-09-05T19:00:00Z", eventLocation: "Catedral",
  registrationId: "registration", registrationNumber: "EVT-001", participantName: "Ana & João", congregationName: "Congregação Central", regionName: "Regional 01",
  registeredAt: "2026-09-05T18:00:00Z", confirmedAt: null, registrationStatus: "PENDING", paymentStatus: "PENDING", paymentMethod: "CASH",
  checkoutStatus: "PENDING", totalAmount: 250, items: [{ id: "item", name: "Inscrição", quantity: 2, unitPrice: 125, totalPrice: 250 }], expiresAt: null,
  credentialToken: null, providerPaymentId: null, providerStatus: null, paymentSimulationEnabled: false, isSimulatedPayment: false, pix: null,
};

describe("createEventThermalReceiptHtml", () => {
  it("gera comprovante de 80 mm com congregação, regional e pendência", () => {
    const html = createEventThermalReceiptHtml(checkout);
    expect(html).toContain("size:80mm auto");
    expect(html).toContain("Congregação Central");
    expect(html).toContain("Regional 01");
    expect(html).toContain("PENDENTE");
    expect(html).not.toContain("Congresso <2026>");
    expect(html).toContain("Congresso &lt;2026&gt;");
  });

  it("inclui QR da credencial somente quando ela está liberada", () => {
    expect(createEventThermalReceiptHtml(checkout)).not.toContain("<svg");
    expect(createEventThermalReceiptHtml({ ...checkout, registrationStatus: "CONFIRMED", paymentStatus: "PAID", credentialToken: "ek1_credential" })).toContain("<svg");
  });
});
