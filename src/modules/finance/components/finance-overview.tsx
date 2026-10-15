"use client";

import Link from "next/link";
import {
  ArrowDownLeft,
  ArrowUpRight,
  ChevronRight,
  HandCoins,
  Plus,
  Wallet,
} from "lucide-react";
import type {
  FinanceOverview as Overview,
  FinanceTransactionPage,
} from "../types/finance-query.types";
import type { FinanceCapabilities } from "../types/finance.types";
import { formatMoney } from "../utils/finance-money";
import { financeLocation } from "../utils/finance-navigation";
import { FinanceCharts } from "./finance-charts";
import { FinanceEmpty } from "./finance-empty";
import { useFinanceNavigation } from "./finance-shell";

function RecentTransactions({
  recent,
  unit,
  month,
  mobile,
}: {
  recent: FinanceTransactionPage;
  unit: string;
  month: string;
  mobile: boolean;
}) {
  const { navigate } = useFinanceNavigation();
  const items = recent.items.slice(0, 5);
  return (
    <section
      className={`card stack ${mobile ? "finance-overview-recent-mobile" : "finance-overview-recent-desktop"}`}
    >
      <div className="row spread">
        <h2>Últimos lançamentos</h2>
        <Link
          className="row muted"
          href={financeLocation("/financeiro/lancamentos", unit, month)}
          onNavigate={(event) => {
            event.preventDefault();
            navigate(financeLocation("/financeiro/lancamentos", unit, month));
          }}
        >
          Ver todos <ChevronRight size={15} />
        </Link>
      </div>
      {items.length === 0 ? (
        <FinanceEmpty>Ainda não há lançamentos neste mês.</FinanceEmpty>
      ) : mobile ? (
        <div className="finance-overview-recent-list">
          {items.map((item) => (
            <div className="finance-overview-recent-item" key={item.id}>
              <div>
                <strong>{item.categoryName}</strong>
                <span className="muted">
                  {item.personName ||
                    item.beneficiaryName ||
                    item.description ||
                    "Contribuição coletiva"}
                </span>
                <span className="muted">
                  {item.date.split("-").reverse().join("/")}
                  {item.departmentName ? ` · ${item.departmentName}` : ""}
                  {item.status === "CANCELLED" ? " · Cancelado" : ""}
                </span>
              </div>
              <strong className={item.direction === "INCOME" ? "positive" : "negative"}>
                {item.direction === "INCOME" ? "+" : "−"} {formatMoney(item.amountCents)}
              </strong>
            </div>
          ))}
        </div>
      ) : (
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Descrição</th>
                <th>Departamento</th>
                <th>Data</th>
                <th>Valor</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id}>
                  <td>
                    <strong>{item.categoryName}</strong>
                    <div className="muted">
                      {item.personName ||
                        item.beneficiaryName ||
                        item.description ||
                        "Contribuição coletiva"}
                    </div>
                  </td>
                  <td>{item.departmentName}</td>
                  <td>{item.date.split("-").reverse().join("/")}</td>
                  <td
                    className={`money ${item.direction === "INCOME" ? "positive" : "negative"}`}
                  >
                    {item.direction === "INCOME" ? "+" : "−"}{" "}
                    {formatMoney(item.amountCents)}
                    {item.status === "CANCELLED" && (
                      <div className="muted">Cancelado</div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

export function FinanceOverview({
  overview,
  recent,
  unit,
  month,
  capabilities,
}: {
  overview: Overview;
  recent: FinanceTransactionPage;
  unit: string;
  month: string;
  capabilities: FinanceCapabilities;
}) {
  const { navigate } = useFinanceNavigation();
  const cards = [
    {
      label: "Saldo ao final do período",
      value: overview.closingCents,
      icon: Wallet,
      featured: true,
    },
    {
      tone: "income",
      label: "Entradas no mês",
      value: overview.incomeCents,
      icon: ArrowDownLeft,
      featured: false,
    },
    {
      tone: "expense",
      label: "Saídas no mês",
      value: overview.expenseCents,
      icon: ArrowUpRight,
      featured: false,
    },
  ];
  const shortcuts = [
    {
      label: "Atendimento",
      path: "/financeiro/atendimento",
      icon: HandCoins,
      show: capabilities.create,
    },
    {
      label: "Nova entrada",
      path: "/financeiro/lancamentos",
      icon: Plus,
      extras: { novo: "entrada" },
      show: capabilities.create,
    },
    {
      label: "Nova saída",
      path: "/financeiro/lancamentos",
      icon: ArrowUpRight,
      extras: { novo: "saida" },
      show: capabilities.create,
    },
    {
      label: "Caixas",
      path: "/financeiro/caixas",
      icon: Wallet,
      show: true,
    },
  ];
  return (
    <div className="stack finance-overview">
      <div className="row spread">
        <div>
          <h1>Visão geral</h1>
          <p className="muted">
            Sua congregação em números · {month.split("-").reverse().join("/")}
          </p>
        </div>
      </div>
      <div className="grid finance-overview-summaries">
        {cards.map((card) => (
          <section
            key={card.label}
            className={`card stack finance-summary-card ${card.tone === "expense" ? "finance-expense-card" : card.tone === "income" ? "finance-income-card" : ""}`}
            style={
              card.featured
                ? {
                    background: "linear-gradient(120deg,#0B3D32,#087F5B)",
                    color: "white",
                    border: 0,
                  }
                : undefined
            }
          >
            <div className="row spread">
              <span style={{ fontSize: 12, opacity: 0.8 }}>{card.label}</span>
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
              {formatMoney(card.value)}
            </div>
            <span style={{ fontSize: 11, opacity: 0.75 }}>
              {card.featured
                ? "Posição consolidada dos caixas"
                : "Lançamentos confirmados"}
            </span>
          </section>
        ))}
      </div>
      <nav className="finance-mobile-actions" aria-label="Ações rápidas">
        {shortcuts
          .filter((shortcut) => shortcut.show)
          .map((shortcut) => {
            const href = financeLocation(
              shortcut.path,
              unit,
              month,
              shortcut.extras,
            );
            return (
              <Link
                key={shortcut.label}
                href={href}
                onNavigate={(event) => {
                  event.preventDefault();
                  navigate(href);
                }}
              >
                <span className="finance-mobile-action-icon">
                  <shortcut.icon size={20} aria-hidden="true" />
                </span>
                <span>{shortcut.label}</span>
              </Link>
            );
          })}
      </nav>
      <RecentTransactions recent={recent} unit={unit} month={month} mobile />
      <div
        className="card row spread"
        style={{ padding: "16px 22px", fontSize: 12 }}
      >
        <span>
          Saldo inicial <strong>{formatMoney(overview.openingCents)}</strong>
        </span>
        <span>
          Aberturas no mês{" "}
          <strong>{formatMoney(overview.openingMovementCents)}</strong>
        </span>
        <span>
          Ajustes <strong>{formatMoney(overview.adjustmentCents)}</strong>
        </span>
        <span className="muted">
          Transferências entre caixas não alteram o total.
        </span>
      </div>
      <FinanceCharts overview={overview} />
      <RecentTransactions recent={recent} unit={unit} month={month} mobile={false} />
    </div>
  );
}
