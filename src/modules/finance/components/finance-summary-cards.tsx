import { ArrowDownLeft, ArrowUpRight, Wallet } from "lucide-react";
import { formatMoney } from "../utils/finance-money";
import type { FinanceOverview } from "../types/finance-query.types";

export function FinanceSummaryCards({ overview, daily = false }: {
  overview: Pick<FinanceOverview, "closingCents" | "openingCents" | "incomeCents" | "expenseCents">;
  daily?: boolean;
}) {
  const cards = [
    {
      label: daily ? "Saldo em caixa e contas" : "Saldo ao final do período",
      mobileLabel: daily ? "Saldo em caixa e contas" : "SALDO FINAL",
      value: overview.closingCents,
      icon: Wallet,
      featured: true,
    },
    {
      tone: "income",
      label: daily ? "Entradas do dia" : "Entradas no mês",
      mobileLabel: "Entradas",
      value: overview.incomeCents,
      icon: ArrowDownLeft,
      featured: false,
    },
    {
      tone: "expense",
      label: daily ? "Saídas do dia" : "Saídas no mês",
      mobileLabel: "Saídas",
      value: overview.expenseCents,
      icon: ArrowUpRight,
      featured: false,
    },
  ];
  return (
    <div className="grid finance-overview-summaries">
      {cards.map((card) => (
        <section
          key={card.label}
          className={`card stack finance-summary-card ${card.tone === "expense" ? "finance-expense-card" : card.tone === "income" ? "finance-income-card" : ""}`}
          style={
            card.featured
              ? {
                  background: "var(--finance-featured-gradient)",
                  color: "white",
                  border: 0,
                }
              : undefined
          }
        >
          <div className="row spread">
            <span className="finance-summary-label" style={{ fontSize: 12, opacity: 0.8 }}>
              <span className="finance-summary-label-desktop">{card.label}</span>
              <span className="finance-summary-label-mobile">{card.mobileLabel}</span>
            </span>
            <span className="finance-summary-icon">
              <card.icon
                size={22}
                color={
                  card.featured
                    ? "#B6E875"
                    : card.tone === "expense"
                      ? "#B5474D"
                      : "#087F5B"
                }
              />
            </span>
          </div>
          <div
            className={`amount ${card.value < 0 ? "negative" : ""}`}
            style={
              card.featured && card.value < 0 ? { color: "#FFD4D7" } : undefined
            }
          >
            <span className="finance-summary-value-desktop">{formatMoney(card.value)}</span>
            <span className="finance-summary-value-mobile">
              {formatMoney(card.value).split("\u00a0")[0]}{"\u00a0"}
              <wbr />
              {formatMoney(card.value).split("\u00a0")[1]}
            </span>
          </div>
          <span className="finance-summary-caption" style={{ fontSize: 11, opacity: 0.75 }}>
            {card.featured
              ? (daily ? `Saldo anterior · ${formatMoney(overview.openingCents)}` : "Posição consolidada dos caixas")
              : "Lançamentos confirmados"}
          </span>
        </section>
      ))}
    </div>
  );
}
