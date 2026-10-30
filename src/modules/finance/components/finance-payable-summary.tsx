"use client";
import { useEffect } from "react";
import Link from "next/link";
import type { PayablePage } from "../types/finance-payable.types";
import { shiftPayableDate } from "../utils/finance-payables";
import { todayLocal } from "../utils/finance-period";
import { financeLocation } from "../utils/finance-navigation";
import { useFinanceNavigation } from "./finance-shell";
export function FinancePayableSummary({ result, unit, month }: { result: PayablePage | null; unit: string; month: string }) {
  const { navigate, refresh } = useFinanceNavigation();
  useEffect(() => {
    let last = result?.today ?? todayLocal();
    const check = () => { const current = todayLocal(); if (current !== last) { last = current; refresh(); } };
    const timer = window.setInterval(check, 30_000); window.addEventListener("focus", check);
    return () => { window.clearInterval(timer); window.removeEventListener("focus", check); };
  }, [result?.today, refresh]);
  return <section className="card stack finance-payable-summary"><div><h2>Contas da Catedral</h2><p className="muted">Pendências atuais da administração, em todas as datas.</p></div>
    {!result ? <p role="status">O resumo está indisponível. Confira o cadastro da Catedral e tente novamente.</p> : <div className="grid">
      {[
        { label: "contas em atraso", count: result.summary.overdue, from: "2000-01-01", to: shiftPayableDate(result.today, -1) },
        { label: "contas que vencem hoje", count: result.summary.today, from: result.today, to: result.today },
        { label: "contas nos próximos 7 dias", count: result.summary.upcoming, from: shiftPayableDate(result.today, 1), to: shiftPayableDate(result.today, 7) },
      ].map((item) => {
        const href = financeLocation("/financeiro/contas-a-pagar", unit, month, { dateFrom: item.from, dateTo: item.to, status: "PENDING" });
        return <Link key={item.label} href={href} aria-label={`${item.count} ${item.label}`} onNavigate={(e) => { e.preventDefault(); navigate(href); }}><strong>{item.count}</strong><span>{item.label}</span></Link>;
      })}
    </div>}
  </section>;
}
