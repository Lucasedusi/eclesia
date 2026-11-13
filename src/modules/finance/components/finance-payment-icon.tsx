import { ArrowLeftRight, Banknote, Barcode, CreditCard, FilePenLine, QrCode, ReceiptText, type LucideIcon } from "lucide-react";

const paymentIcons: Record<string, LucideIcon | undefined> = {
  CASH: Banknote,
  PIX: QrCode,
  CHECK: FilePenLine,
  BANK_TRANSFER: ArrowLeftRight,
  BANK_SLIP: Barcode,
  DEBIT_CARD: CreditCard,
  CREDIT_CARD: CreditCard,
};

export function FinancePaymentIcon({ kind, size = 15 }: { kind?: string; size?: number }) {
  const Icon = paymentIcons[kind ?? "OTHER"] ?? ReceiptText;
  return <Icon size={size} aria-hidden="true" />;
}
