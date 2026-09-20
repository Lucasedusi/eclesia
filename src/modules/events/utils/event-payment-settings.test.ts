import { describe, expect, it } from "vitest";
import { buildEventPaymentSettingsPayload, eventPaymentSettingsFromRow } from "./event-payment-settings";

const caravan = {
  allowParticipantList: true,
  caravanRegistrationItemId: "123e4567-e89b-12d3-a456-426614174001",
  pixEnabled: true,
  pixKey: "caravana@igreja.org",
  pixHolderName: "Igreja Central",
  cashEnabled: true,
  whatsappNumber: "5562999999999",
  paymentInstructions: "Pagamento da caravana",
};

const individual = {
  pixMode: "STATIC" as const,
  pixKey: "individual@igreja.org",
  pixHolderName: "Igreja Central Eventos",
  cashEnabled: true,
  cardEnabled: true,
  whatsappNumber: "5562888888888",
  paymentInstructions: "Pagamento individual",
};

describe("buildEventPaymentSettingsPayload", () => {
  it("mantém configurações individuais sem reutilizar o contato de caravanas", () => {
    const payload = buildEventPaymentSettingsPayload({
      registrationMode: "MIXED",
      requiresPayment: true,
      caravanSettings: caravan,
      individualPaymentSettings: individual,
    });

    expect(payload).toMatchObject({
      pix_enabled: true,
      pix_key: "caravana@igreja.org",
      whatsapp_number: "5562999999999",
      individual_pix_mode: "STATIC",
      individual_pix_key: "individual@igreja.org",
      individual_cash_enabled: true,
      individual_card_enabled: true,
      individual_whatsapp_number: "5562888888888",
    });
  });

  it("remove somente as opções de caravana em evento individual", () => {
    const payload = buildEventPaymentSettingsPayload({
      registrationMode: "INDIVIDUAL",
      requiresPayment: true,
      caravanSettings: caravan,
      individualPaymentSettings: individual,
    });

    expect(payload.pix_enabled).toBe(false);
    expect(payload.whatsapp_number).toBeNull();
    expect(payload.individual_whatsapp_number).toBe("5562888888888");
  });

  it("desabilita cobranças individuais quando o evento não exige pagamento", () => {
    const payload = buildEventPaymentSettingsPayload({
      registrationMode: "INDIVIDUAL",
      requiresPayment: false,
      caravanSettings: caravan,
      individualPaymentSettings: individual,
    });

    expect(payload.individual_pix_mode).toBe("DISABLED");
    expect(payload.individual_cash_enabled).toBe(false);
    expect(payload.individual_card_enabled).toBe(false);
  });
});

describe("eventPaymentSettingsFromRow", () => {
  it("reconstrói configurações independentes e URLs dos dois QR Codes", () => {
    const settings = eventPaymentSettingsFromRow({
      allow_participant_list: true,
      caravan_registration_item_id: null,
      pix_enabled: false,
      pix_key: null,
      pix_holder_name: null,
      cash_enabled: false,
      whatsapp_number: null,
      payment_instructions: null,
      individual_pix_mode: "STATIC",
      individual_pix_key: "individual@igreja.org",
      individual_pix_holder_name: "Igreja Central",
      individual_cash_enabled: true,
      individual_card_enabled: true,
      individual_whatsapp_number: "5562888888888",
      individual_payment_instructions: "Apresente o comprovante",
    }, { caravanQrUrl: null, individualQrUrl: "https://cdn.example/individual.png" });

    expect(settings.individual).toEqual({
      pixMode: "STATIC",
      pixKey: "individual@igreja.org",
      pixHolderName: "Igreja Central",
      pixQrUrl: "https://cdn.example/individual.png",
      cashEnabled: true,
      cardEnabled: true,
      whatsappNumber: "5562888888888",
      paymentInstructions: "Apresente o comprovante",
    });
  });
});
