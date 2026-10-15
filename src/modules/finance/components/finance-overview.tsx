"use client";

import Link from "next/link";
import {
  ArrowDownLeft,
  ArrowUpRight,
  ChevronRight,
  Wallet,
} from "lucide-react";
import type {
  FinanceOverview as Overview,
  FinanceTransactionPage,
} from "../types/finance-query.types";
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
}: {
  overview: Overview;
  recent: FinanceTransactionPage;
  unit: string;
  month: string;
}) {
  const cards = [
    {
      label: "Saldo ao final do período",
      mobileLabel: "SALDO FINAL",
      value: overview.closingCents,
      icon: Wallet,
      featured: true,
    },
    {
      tone: "income",
      label: "Entradas no mês",
      mobileLabel: "Entradas",
      value: overview.incomeCents,
      icon: ArrowDownLeft,
      featured: false,
    },
    {
      tone: "expense",
      label: "Saídas no mês",
      mobileLabel: "Saídas",
      value: overview.expenseCents,
      icon: ArrowUpRight,
      featured: false,
    },
  ];
  return (
    <div className="stack finance-overview">
      <div className="row spread finance-overview-heading">
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
                ? "Posição consolidada dos caixas"
                : "Lançamentos confirmados"}
            </span>
          </section>
        ))}
      </div>
      <RecentTransactions recent={recent} unit={unit} month={month} mobile />
      <div
        className="card row spread finance-overview-breakdown"
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
