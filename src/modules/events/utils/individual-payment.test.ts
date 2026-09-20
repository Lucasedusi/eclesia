import { describe, expect, it } from "vitest";
import { individualPaymentOptions, resolveIndividualPaymentFlow } from "./individual-payment";

const settings = {
  pixMode: "AUTOMATIC" as const,
  pixKey: "",
  pixHolderName: "",
  pixQrUrl: null,
  cashEnabled: true,
  cardEnabled: true,
  whatsappNumber: "5562999999999",
  paymentInstructions: "",
};

describe("individualPaymentOptions", () => {
  it("expõe Pix automático, Dinheiro e os dois cartões quando habilitados", () => {
    expect(individualPaymentOptions(settings).map((option) => option.value)).toEqual([
      "PIX",
      "CASH",
      "DEBIT_CARD",
      "CREDIT_CARD",
    ]);
  });

  it("identifica o Pix estático sem expor formas presenciais desabilitadas", () => {
    expect(individualPaymentOptions({ ...settings, pixMode: "STATIC", cashEnabled: false, cardEnabled: false })).toEqual([
      { value: "PIX", flow: "STATIC_PIX" },
    ]);
  });
});

describe("resolveIndividualPaymentFlow", () => {
  it("usa NOT_APPLICABLE para inscrição gratuita", () => {
    expect(resolveIndividualPaymentFlow("PIX", 0, settings)).toBe("NOT_APPLICABLE");
  });

  it("resolve somente os métodos habilitados", () => {
    expect(resolveIndividualPaymentFlow("PIX", 150, settings)).toBe("AUTOMATIC_PIX");
    expect(resolveIndividualPaymentFlow("CASH", 150, settings)).toBe("MANUAL");
    expect(resolveIndividualPaymentFlow("DEBIT_CARD", 150, settings)).toBe("MANUAL");
    expect(resolveIndividualPaymentFlow("CREDIT_CARD", 150, { ...settings, cardEnabled: false })).toBeNull();
  });

  it("nunca trata Pix desabilitado como automático", () => {
    expect(resolveIndividualPaymentFlow("PIX", 150, { ...settings, pixMode: "DISABLED" })).toBeNull();
  });
});
