import { parseBrazilCurrencyInput } from "@/utils/input-masks";

type PaymentReceiptInput = {
  amount: number;
  paymentMethod?: string | null;
  approvePending?: boolean;
  receiptPath?: string;
  receiptFileName?: string;
  receiptMimeType?: string;
  receiptFileSize?: number;
};

const registrationPaymentMethods = new Set(["PIX", "CASH", "CREDIT_CARD", "DEBIT_CARD"]);

export function resolveRegistrationPaymentMethod(totalAmount: number, paymentMethod: string | null | undefined) {
  if (totalAmount <= 0) return "NOT_APPLICABLE";
  return paymentMethod && registrationPaymentMethods.has(paymentMethod) ? paymentMethod : "PIX";
}

export function buildRegistrationPaymentPayload(input: PaymentReceiptInput) {
  const receiptPath = input.receiptPath?.trim() ?? "";
  const paymentMethod = resolveRegistrationPaymentMethod(input.amount, input.paymentMethod);
  const approval = input.approvePending ? { approvePending: true } : {};

  if (!receiptPath) return { amount: input.amount, paymentMethod, ...approval };

  return {
    amount: input.amount,
    paymentMethod,
    ...approval,
    receiptPath,
    receiptFileName: input.receiptFileName?.trim() ?? "",
    receiptMimeType: input.receiptMimeType?.trim() ?? "",
    receiptFileSize: input.receiptFileSize ?? 0,
  };
}

export function parsePublicCaravanPaymentAmount(value: string, hasReceipt: boolean) {
  return hasReceipt ? parseBrazilCurrencyInput(value) : 0;
}

export function normalizePublicCaravanPaymentInput(input: Record<string, unknown>) {
  const paymentMethod = input.paymentMethod;
  const receiptPath = typeof input.paymentReceiptPath === "string" ? input.paymentReceiptPath.trim() : "";

  if (paymentMethod === "PIX" && receiptPath) return { ...input, paymentReceiptPath: receiptPath };

  return {
    ...input,
    paymentAmount: 0,
    paymentReceiptPath: "",
    paymentReceiptFileName: "",
    paymentReceiptMimeType: "",
    paymentReceiptFileSize: 0,
  };
}

type StorageReadResult<T, E> = { data: T | null; error: E | null };

function isTransientStorageReadError(error: unknown) {
  if (!error || typeof error !== "object") return false;

  const candidate = error as { message?: unknown; statusCode?: unknown };
  const statusCode = String(candidate.statusCode ?? "");
  const message = typeof candidate.message === "string" ? candidate.message.toLowerCase() : "";

  return ["404", "409", "429", "500", "502", "503", "504"].includes(statusCode)
    || /not found|fetch failed|timeout|temporar/.test(message);
}

export async function retryPublicCaravanStorageRead<T, E>(
  read: () => Promise<StorageReadResult<T, E>>,
  wait: (milliseconds: number) => Promise<void> = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds)),
) {
  let result = await read();

  for (
    let attempt = 1;
    attempt < 3
      && (!result.data || result.error)
      && (!result.error || isTransientStorageReadError(result.error));
    attempt += 1
  ) {
    await wait(attempt * 150);
    result = await read();
  }

  return result;
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
