import type {
  IndividualPaymentFlow,
  IndividualPaymentMethod,
  IndividualPaymentSettings,
} from "../types/event.types";

export type IndividualPaymentOption = {
  value: Exclude<IndividualPaymentMethod, "NOT_APPLICABLE">;
  flow: Exclude<IndividualPaymentFlow, "NOT_APPLICABLE">;
};

export function individualPaymentOptions(settings: IndividualPaymentSettings): IndividualPaymentOption[] {
  const options: IndividualPaymentOption[] = [];
  if (settings.pixMode === "AUTOMATIC") options.push({ value: "PIX", flow: "AUTOMATIC_PIX" });
  if (settings.pixMode === "STATIC") options.push({ value: "PIX", flow: "STATIC_PIX" });
  if (settings.cashEnabled) options.push({ value: "CASH", flow: "MANUAL" });
  if (settings.cardEnabled) {
    options.push({ value: "DEBIT_CARD", flow: "MANUAL" });
    options.push({ value: "CREDIT_CARD", flow: "MANUAL" });
  }
  return options;
}

export function resolveIndividualPaymentFlow(
  method: IndividualPaymentMethod,
  totalAmount: number,
  settings: IndividualPaymentSettings,
): IndividualPaymentFlow | null {
  if (totalAmount <= 0) return "NOT_APPLICABLE";
  return individualPaymentOptions(settings).find((option) => option.value === method)?.flow ?? null;
}
