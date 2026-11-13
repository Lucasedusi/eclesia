import type { FinanceCatalogs } from "../types/finance-catalog.types";
import type { FinanceTransactionRow } from "../types/finance-query.types";
import { formatMoney } from "../utils/finance-money";
import { financeTransactionStatusLabel } from "../utils/finance-transaction-status";
import { FinancePaymentIcon } from "./finance-payment-icon";

export function FinanceTransactionPayment({ item, catalogs }: {
  item: FinanceTransactionRow;
  catalogs: FinanceCatalogs;
}) {
  const cashbox = catalogs.cashboxes.find((box) => box.id === item.cashboxId);
  const method = catalogs.paymentMethods.find((option) => option.id === item.paymentMethodId);
  return (
    <span className="finance-transaction-payment">
      <span>{cashbox?.name ?? "Caixa indisponível"}</span>
      <span className="muted"><FinancePaymentIcon kind={method?.kind} />{method?.name ?? "Forma indisponível"}</span>
    </span>
  );
}

export function FinanceTransactionAmount({ item }: { item: FinanceTransactionRow }) {
  const income = item.direction === "INCOME";
  const amount = `${income ? "+" : "−"} ${formatMoney(item.amountCents)}`;
  if (item.status === "CONFIRMED") return <span className={income ? "positive" : "negative"}>{amount}</span>;
  return (
    <span className="finance-unconfirmed-amount">
      <s>{amount}</s><span className="sr-only"> {financeTransactionStatusLabel(item.status)}</span>
    </span>
  );
}
