"use client";

import Link from "next/link";
import {
  CalendarDays,
  ChevronRight,
} from "lucide-react";
import type {
  FinanceOverview as Overview,
  FinanceTransactionPage,
} from "../types/finance-query.types";
import { formatMoney } from "../utils/finance-money";
import { financeLocation } from "../utils/finance-navigation";
import { FinanceSummaryCards } from "./finance-summary-cards";
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
  canViewDailyFlow = false,
}: {
  canViewDailyFlow?: boolean;
  overview: Overview;
  recent: FinanceTransactionPage;
  unit: string;
  month: string;
}) {
  return (
    <div className="stack finance-overview">
      <div className="row spread finance-overview-titlebar">
        <div className="finance-overview-heading">
          <h1>Visão geral</h1>
          <p className="muted">
            Sua congregação em números · {month.split("-").reverse().join("/")}
          </p>
        </div>
        {canViewDailyFlow && <Link className="finance-daily-shortcut" href="/financeiro/fluxo-de-caixa"><CalendarDays size={17} />Fluxo de caixa diário</Link>}
      </div>
      <FinanceSummaryCards overview={overview} />
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
