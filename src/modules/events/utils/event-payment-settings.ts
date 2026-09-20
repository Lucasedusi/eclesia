import type { EventPaymentSettings, IndividualPixMode } from "../types/event.types";

type CaravanSettingsInput = {
  allowParticipantList: boolean;
  caravanRegistrationItemId: string;
  pixEnabled: boolean;
  pixKey: string;
  pixHolderName: string;
  cashEnabled: boolean;
  whatsappNumber: string;
  paymentInstructions: string;
};

type IndividualSettingsInput = {
  pixMode: IndividualPixMode;
  pixKey: string;
  pixHolderName: string;
  cashEnabled: boolean;
  cardEnabled: boolean;
  whatsappNumber: string;
  paymentInstructions: string;
};

function text(row: Record<string, unknown>, key: string) {
  const value = row[key];
  return typeof value === "string" ? value : "";
}

function bool(row: Record<string, unknown>, key: string) {
  return row[key] === true;
}

function pixMode(value: unknown): IndividualPixMode {
  return value === "DISABLED" || value === "STATIC" || value === "AUTOMATIC" ? value : "AUTOMATIC";
}

export function defaultEventPaymentSettings(): EventPaymentSettings {
  return {
    allowParticipantList: true,
    caravanRegistrationItemId: "",
    pixEnabled: false,
    pixKey: "",
    pixHolderName: "",
    pixQrUrl: null,
    cashEnabled: false,
    whatsappNumber: "",
    paymentInstructions: "",
    individual: {
      pixMode: "AUTOMATIC",
      pixKey: "",
      pixHolderName: "",
      pixQrUrl: null,
      cashEnabled: false,
      cardEnabled: false,
      whatsappNumber: "",
      paymentInstructions: "",
    },
  };
}

export function eventPaymentSettingsFromRow(
  row: Record<string, unknown>,
  urls: { caravanQrUrl: string | null; individualQrUrl: string | null },
): EventPaymentSettings {
  return {
    allowParticipantList: bool(row, "allow_participant_list"),
    caravanRegistrationItemId: text(row, "caravan_registration_item_id"),
    pixEnabled: bool(row, "pix_enabled"),
    pixKey: text(row, "pix_key"),
    pixHolderName: text(row, "pix_holder_name"),
    pixQrUrl: urls.caravanQrUrl,
    cashEnabled: bool(row, "cash_enabled"),
    whatsappNumber: text(row, "whatsapp_number"),
    paymentInstructions: text(row, "payment_instructions"),
    individual: {
      pixMode: pixMode(row.individual_pix_mode),
      pixKey: text(row, "individual_pix_key"),
      pixHolderName: text(row, "individual_pix_holder_name"),
      pixQrUrl: urls.individualQrUrl,
      cashEnabled: bool(row, "individual_cash_enabled"),
      cardEnabled: bool(row, "individual_card_enabled"),
      whatsappNumber: text(row, "individual_whatsapp_number"),
      paymentInstructions: text(row, "individual_payment_instructions"),
    },
  };
}

export function buildEventPaymentSettingsPayload(input: {
  registrationMode: "INDIVIDUAL" | "MIXED";
  requiresPayment: boolean;
  caravanSettings: CaravanSettingsInput;
  individualPaymentSettings: IndividualSettingsInput;
}) {
  const caravanEnabled = input.registrationMode === "MIXED";
  const individualEnabled = input.requiresPayment;
  const caravan = input.caravanSettings;
  const individual = input.individualPaymentSettings;
  const staticPix = individualEnabled && individual.pixMode === "STATIC";

  return {
    allow_participant_list: caravanEnabled && caravan.allowParticipantList,
    caravan_registration_item_id: caravanEnabled && caravan.caravanRegistrationItemId ? caravan.caravanRegistrationItemId : null,
    pix_enabled: caravanEnabled && caravan.pixEnabled,
    pix_key: caravanEnabled && caravan.pixEnabled ? caravan.pixKey : null,
    pix_holder_name: caravanEnabled && caravan.pixEnabled ? caravan.pixHolderName : null,
    cash_enabled: caravanEnabled && caravan.cashEnabled,
    whatsapp_number: caravanEnabled ? caravan.whatsappNumber || null : null,
    payment_instructions: caravanEnabled ? caravan.paymentInstructions || null : null,
    individual_pix_mode: individualEnabled ? individual.pixMode : "DISABLED",
    individual_pix_key: staticPix ? individual.pixKey : null,
    individual_pix_holder_name: staticPix ? individual.pixHolderName : null,
    individual_cash_enabled: individualEnabled && individual.cashEnabled,
    individual_card_enabled: individualEnabled && individual.cardEnabled,
    individual_whatsapp_number: individualEnabled && (individual.cashEnabled || individual.cardEnabled)
      ? individual.whatsappNumber || null
      : null,
    individual_payment_instructions: individualEnabled ? individual.paymentInstructions || null : null,
  };
}
