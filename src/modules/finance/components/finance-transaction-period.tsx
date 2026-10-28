"use client";

import { useState } from "react";
import { CalendarDays, Check } from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { financeFiltersSchema } from "../validations/finance-query.schemas";
import { formatFinanceDateRange, formatFinanceMonth, recentFinanceRange, todayLocal } from "../utils/finance-period";

type Range = { dateFrom: string; dateTo: string };
type PeriodMode = "MONTH" | "3" | "7" | "CUSTOM";

export function FinanceTransactionPeriod({ month, dateFrom, dateTo, onApply }: {
  month: string;
  dateFrom?: string;
  dateTo?: string;
  onApply: (month: string, range?: Range) => void;
}) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<PeriodMode>("MONTH");
  const [selectedMonth, setSelectedMonth] = useState(month);
  const [range, setRange] = useState<Range>({ dateFrom: "", dateTo: "" });
  const label = dateFrom && dateTo ? formatFinanceDateRange(dateFrom, dateTo) : formatFinanceMonth(month, true);
  const valid = financeFiltersSchema.safeParse({ month: selectedMonth, ...(mode === "MONTH" ? {} : range) }).success;

  function selectMode(next: PeriodMode) {
    setMode(next);
    if (next === "3" || next === "7") setRange(recentFinanceRange(next === "3" ? 3 : 7));
  }

  return (
    <>
      <div className="finance-mobile-only finance-transaction-period">
        <span className="finance-period-label">Período</span>
        <button type="button" className="finance-period-trigger" aria-label={`Período: ${label}`} onClick={() => {
          setSelectedMonth(month);
          setRange({ dateFrom: dateFrom ?? todayLocal(), dateTo: dateTo ?? todayLocal() });
          setMode(dateFrom && dateTo ? "CUSTOM" : "MONTH");
          setOpen(true);
        }}>
          <span>{label}</span><CalendarDays size={16} aria-hidden="true" />
        </button>
      </div>
      {open && (
        <Modal title="Período dos lançamentos" className="finance-period-dialog" onClose={() => setOpen(false)}
          footer={<Button disabled={!valid} onClick={() => {
            if (!valid) return;
            onApply(selectedMonth, mode === "MONTH" ? undefined : range);
            setOpen(false);
          }}><Check size={16} aria-hidden="true" />Aplicar</Button>}>
          <div className="stack">
            <div className="finance-period-options" role="group" aria-label="Escolher período">
              {([
                ["MONTH", "Mês"], ["3", "Últimos 3 dias"], ["7", "Últimos 7 dias"], ["CUSTOM", "Personalizado"],
              ] as const).map(([value, text]) => <button type="button" key={value} aria-pressed={mode === value} onClick={() => selectMode(value)}>{text}</button>)}
            </div>
            {mode === "MONTH" ? <label>Mês da movimentação<input type="month" min="2000-01" max="2099-12" value={selectedMonth} onChange={e => setSelectedMonth(e.target.value)} /></label> : (
              <>
                {mode === "CUSTOM" && <div className="finance-period-dates">
                  <label>Data inicial<input type="date" min="2000-01-01" max="2099-12-31" value={range.dateFrom} onChange={e => setRange({ ...range, dateFrom: e.target.value })} /></label>
                  <label>Data final<input type="date" min={range.dateFrom || "2000-01-01"} max="2099-12-31" value={range.dateTo} onChange={e => setRange({ ...range, dateTo: e.target.value })} /></label>
                </div>}
                {valid ? <p className="notice">{formatFinanceDateRange(range.dateFrom, range.dateTo)} · incluindo as duas datas.</p> : <p role="alert">Informe as duas datas, com o fim igual ou posterior ao início.</p>}
              </>
            )}
          </div>
        </Modal>
      )}
    </>
  );
}
