"use client";

import type { FinanceTransactionRow } from "../types/finance-query.types";
import { formatMoney } from "../utils/finance-money";

export function FinanceMobileTransactionCards({
  items,
  onOpen,
}: {
  items: FinanceTransactionRow[];
  onOpen: (id: string) => void;
}) {
  const groups = new Map<string, FinanceTransactionRow[]>();
  for (const item of items) {
    const group = groups.get(item.date) ?? [];
    group.push(item);
    groups.set(item.date, group);
  }

  return (
    <ul className="finance-mobile-transaction-cards" aria-label="Lançamentos em cartões">
      {[...groups].map(([date, transactions]) => (
        <li key={date}>
          <h3>{date.split("-").reverse().join("/")}</h3>
          <ul>
            {transactions.map((item) => (
              <li key={item.id}>
                <button
                  type="button"
                  className="finance-mobile-transaction-card"
                  onClick={() => onOpen(item.id)}
                >
                  <span className="sr-only">Abrir lançamento: </span>
                  <span className="finance-mobile-transaction-main">
                    <strong>{item.categoryName || "Lançamento"}</strong>
                    <span>
                      {item.personName ||
                        item.beneficiaryName ||
                        item.description ||
                        "Contribuição coletiva"}
                    </span>
                    {item.departmentName && (
                      <small>{item.departmentName}</small>
                    )}
                    {item.classificationName && (
                      <small>Classificação: {item.classificationName}</small>
                    )}
                  </span>
                  <span className="finance-mobile-transaction-side">
                    <strong
                      className={
                        item.status === "CANCELLED"
                          ? "muted"
                          : item.direction === "INCOME"
                            ? "positive"
                            : "negative"
                      }
                    >
                      {item.direction === "INCOME" ? "+" : "−"}{" "}
                      {formatMoney(item.amountCents)}
                    </strong>
                    <span className="badge">
                      {item.status === "CANCELLED" ? "Cancelado" : "Confirmado"}
                    </span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </li>
      ))}
    </ul>
  );
}
