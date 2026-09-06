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

export function buildPublicCaravanPaymentPayload(input: {
  paymentMethod: "PIX" | "CASH" | "NOT_APPLICABLE";
  amountValue: string;
  receipt?: { path: string; fileName: string; mimeType: string; fileSize: number } | null;
}) {
  const emptyReceipt = {
    paymentReceiptPath: "",
    paymentReceiptFileName: "",
    paymentReceiptMimeType: "",
    paymentReceiptFileSize: 0,
  };
  if (input.paymentMethod !== "PIX" || !input.receipt?.path) {
    return { paymentMethod: input.paymentMethod, paymentAmount: 0, ...emptyReceipt };
  }
  return {
    paymentMethod: "PIX" as const,
    paymentAmount: parseBrazilCurrencyInput(input.amountValue),
    paymentReceiptPath: input.receipt.path,
    paymentReceiptFileName: input.receipt.fileName,
    paymentReceiptMimeType: input.receipt.mimeType,
    paymentReceiptFileSize: input.receipt.fileSize,
  };
}

export function canShowPublicCashWhatsapp(input: {
  completed: boolean;
  paymentMethod: string;
  hasWhatsappNumber: boolean;
}) {
  return input.completed && input.paymentMethod === "CASH" && input.hasWhatsappNumber;
}
