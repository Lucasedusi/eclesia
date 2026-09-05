import { parseBrazilCurrencyInput } from "@/utils/input-masks";

type PaymentReceiptInput = {
  amount: number;
  receiptPath?: string;
  receiptFileName?: string;
  receiptMimeType?: string;
  receiptFileSize?: number;
};

export function buildRegistrationPaymentPayload(input: PaymentReceiptInput) {
  const receiptPath = input.receiptPath?.trim() ?? "";

  if (!receiptPath) return { amount: input.amount };

  return {
    amount: input.amount,
    receiptPath,
    receiptFileName: input.receiptFileName?.trim() ?? "",
    receiptMimeType: input.receiptMimeType?.trim() ?? "",
    receiptFileSize: input.receiptFileSize ?? 0,
  };
}

export function parsePublicCaravanPaymentAmount(value: string, hasReceipt: boolean) {
  return hasReceipt ? parseBrazilCurrencyInput(value) : 0;
}

export function canShowPublicCashWhatsapp(input: {
  completed: boolean;
  paymentMethod: string;
  hasWhatsappNumber: boolean;
}) {
  return input.completed && input.paymentMethod === "CASH" && input.hasWhatsappNumber;
}
