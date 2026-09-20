import { describe, expect, it } from "vitest";
import { readCheckoutPaymentSnapshot } from "./checkout-payment-snapshot";

describe("checkout payment snapshot", () => {
  it("lê os dados imutáveis do Pix estático", () => {
    expect(readCheckoutPaymentSnapshot({
      paymentSnapshot: {
        version: 1,
        flow: "STATIC_PIX",
        pixKey: "pix@example.com",
        pixHolderName: "Igreja",
        pixQrStorageBucket: "event-public-media",
        pixQrStoragePath: "church/events/event/individual-pix/qr.png",
        paymentInstructions: "Envie o comprovante",
      },
    })).toEqual({
      staticPix: {
        key: "pix@example.com",
        holderName: "Igreja",
        qrStorageBucket: "event-public-media",
        qrStoragePath: "church/events/event/individual-pix/qr.png",
        paymentInstructions: "Envie o comprovante",
      },
      manualPayment: null,
    });
  });

  it("lê o contato imutável do pagamento presencial", () => {
    expect(readCheckoutPaymentSnapshot({
      paymentSnapshot: {
        version: 1,
        flow: "MANUAL",
        whatsappNumber: "5531999999999",
        paymentInstructions: "Procure a secretaria",
      },
    })).toEqual({
      staticPix: null,
      manualPayment: {
        whatsappNumber: "5531999999999",
        paymentInstructions: "Procure a secretaria",
      },
    });
  });

  it("ignora rascunhos sem snapshot válido", () => {
    expect(readCheckoutPaymentSnapshot({ participantName: "Visitante" })).toEqual({
      staticPix: null,
      manualPayment: null,
    });
    expect(readCheckoutPaymentSnapshot(null)).toEqual({ staticPix: null, manualPayment: null });
  });
});
