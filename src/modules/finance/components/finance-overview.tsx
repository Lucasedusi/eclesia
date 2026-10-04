"use client";
import Link from "next/link";
import {
  ArrowDownLeft,
  ArrowUpRight,
  Wallet,
  Plus,
  ChevronRight,
} from "lucide-react";
import type {
  FinanceOverview as Overview,
  FinanceTransactionPage,
} from "../types/finance-query.types";
import { formatMoney } from "../utils/finance-money";
import { financeLocation } from "../utils/finance-navigation";
import { FinanceCharts } from "./finance-charts";
export function FinanceOverview({
  overview,
  recent,
  unit,
  month,
  canCreate,
}: {
  overview: Overview;
  recent: FinanceTransactionPage;
  unit: string;
  month: string;
  canCreate: boolean;
}) {
  const cards = [
    {
      label: "Saldo ao final do período",
      value: overview.closingCents,
      icon: Wallet,
      featured: true,
    },
    {
      label: "Entradas no mês",
      value: overview.incomeCents,
      icon: ArrowDownLeft,
      featured: false,
    },
    {
      label: "Saídas no mês",
      value: overview.expenseCents,
      icon: ArrowUpRight,
      featured: false,
    },
  ];
  return (
    <div className="stack">
      <div className="row spread">
        <div>
          <p className="eyebrow">Clareza para cuidar de cada recurso</p>
          <h1>Visão geral</h1>
          <p className="muted">
            Sua congregação em números · {month.split("-").reverse().join("/")}
          </p>
        </div>
        {canCreate && (
          <Link
            className="badge"
            href={
              financeLocation("/financeiro/lancamentos", unit, month) +
              "&novo=entrada"
            }
            style={{
              background: "#B6E875",
              padding: "13px 18px",
              fontSize: 13,
              color: "#0B3D32",
            }}
          >
            <Plus size={17} />
            Nova entrada
          </Link>
        )}
      </div>
      <div className="grid">
        {cards.map((c) => (
          <section
            key={c.label}
            className="card stack"
            style={
              c.featured
                ? {
                    background: "linear-gradient(120deg,#0B3D32,#087F5B)",
                    color: "white",
                    border: 0,
                  }
                : undefined
            }
          >
            <div className="row spread">
              <span style={{ fontSize: 12, opacity: 0.8 }}>{c.label}</span>
              <c.icon size={20} color={c.featured ? "#B6E875" : "#087F5B"} />
            </div>
            <div
              className={`amount ${c.value < 0 ? "negative" : ""}`}
              style={
                c.featured && c.value < 0 ? { color: "#FFD4D7" } : undefined
              }
            >
              {formatMoney(c.value)}
            </div>
            <span style={{ fontSize: 11, opacity: 0.75 }}>
              {c.featured
                ? "Posição consolidada dos caixas"
                : "Lançamentos confirmados"}
            </span>
          </section>
        ))}
      </div>
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
      <section className="card stack">
        <div className="row spread">
          <h2>Últimos lançamentos</h2>
          <Link
            className="row muted"
            href={financeLocation("/financeiro/lancamentos", unit, month)}
          >
            Ver todos
            <ChevronRight size={15} />
          </Link>
        </div>
        {recent.items.length === 0 ? (
          <div className="empty">Ainda não há lançamentos neste mês.</div>
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
                {recent.items.slice(0, 5).map((t) => (
                  <tr key={t.id}>
                    <td>
                      <strong>{t.categoryName}</strong>
                      <div className="muted">
                        {t.personName ||
                          t.beneficiaryName ||
                          t.description ||
                          "Contribuição coletiva"}
                      </div>
                    </td>
                    <td>{t.departmentName}</td>
                    <td>{t.date.split("-").reverse().join("/")}</td>
                    <td
                      className={`money ${t.direction === "INCOME" ? "positive" : "negative"}`}
                    >
                      {t.direction === "INCOME" ? "+" : "−"}{" "}
                      {formatMoney(t.amountCents)}
                      {t.status === "CANCELLED" && (
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
    </div>
  );
}
