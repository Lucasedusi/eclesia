"use client";

import type { FinanceTransactionRow } from "../types/finance-query.types";
import type { FinanceCatalogs } from "../types/finance-catalog.types";
import { FinanceTransactionAmount, FinanceTransactionPayment } from "./finance-transaction-cells";
import { Loader2 } from "lucide-react";

export function FinanceMobileTransactionCards({
  items,
  catalogs,
  onOpen,
  loadingId,
}: {
  items: FinanceTransactionRow[];
  catalogs: FinanceCatalogs;
  onOpen: (id: string) => void;
  loadingId?: string | null;
}) {
  return (
    <ul className="finance-mobile-transaction-cards" aria-label="Lançamentos em cartões">
      {items.map((item) => (
        <li key={item.id}>
          <button
            type="button"
            className="finance-mobile-transaction-card"
            disabled={loadingId === item.id}
            aria-busy={loadingId === item.id}
            onClick={() => onOpen(item.id)}
          >
            <span className="sr-only">Abrir lançamento: </span>
            <span className="finance-mobile-transaction-main">
              <time dateTime={item.date}>
                {item.date.split("-").reverse().join("/")}
              </time>
              <strong>{item.categoryName || "Lançamento"}</strong>
              <span>
                {item.personName ||
                  item.beneficiaryName ||
                  item.description ||
                  (item.direction === "INCOME" ? "Contribuição coletiva" : "Não informado")}
              </span>
              <span>{[item.departmentName, item.classificationName].filter(Boolean).join(" · ")}</span>
              <FinanceTransactionPayment item={item} catalogs={catalogs} />
            </span>
            <strong className="finance-mobile-transaction-side"><FinanceTransactionAmount item={item} /></strong>
            {loadingId === item.id && (
              <span className="finance-card-loading" role="status">
                <Loader2 size={24} className="finance-spin" aria-hidden="true" />
                <span className="sr-only">Carregando detalhes…</span>
              </span>
            )}
          </button>
        </li>
      ))}
    </ul>
  );
}
