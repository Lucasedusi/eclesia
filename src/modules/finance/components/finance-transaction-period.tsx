"use client";

import { useState } from "react";
import { CalendarDays, Check } from "lucide-react";
import { FinanceCalendar, FinanceDateField } from "./finance-date-field";
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
  const [typedMonth, setTypedMonth] = useState("");
  const label = dateFrom && dateTo ? formatFinanceDateRange(dateFrom, dateTo) : formatFinanceMonth(month, true);
  const valid = financeFiltersSchema.safeParse({ month: selectedMonth, ...(mode === "MONTH" ? {} : range) }).success;

  function selectMode(next: PeriodMode) {
    setMode(next);
    if (next === "3" || next === "7") setRange(recentFinanceRange(next === "3" ? 3 : 7));
  }

  return (
    <>
      <div className="finance-transaction-period">
        <span className="finance-period-label">Período</span>
        <button type="button" className="finance-period-trigger" aria-label={`Período: ${label}`} onClick={() => {
          setSelectedMonth(month);
          setTypedMonth("");
          setRange({ dateFrom: dateFrom ?? todayLocal(), dateTo: dateTo ?? todayLocal() });
          setMode(dateFrom && dateTo ? "CUSTOM" : "MONTH");
          setOpen(true);
        }}>
          <span>{label}</span><CalendarDays size={16} aria-hidden="true" />
        </button>
      </div>
      {open && (
        <Modal size={mode === "CUSTOM" ? "lg" : "md"} title="Período dos lançamentos" className="finance-period-dialog" onClose={() => setOpen(false)}
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
                {mode === "CUSTOM" && <>
                  <div className="finance-period-dates">
                    <FinanceDateField label="Data inicial" value={range.dateFrom}
                      onChange={dateFrom => {
                        setRange({ ...range, dateFrom });
                        if (dateFrom) setTypedMonth(dateFrom.slice(0, 7));
                      }} />
                    <FinanceDateField label="Data final" value={range.dateTo}
                      onChange={dateTo => {
                        setRange({ ...range, dateTo });
                        if (dateTo) setTypedMonth(dateTo.slice(0, 7));
                      }} />
                  </div>
                  <FinanceCalendar key={typedMonth} initialMonth={typedMonth} mode="range" from={range.dateFrom} to={range.dateTo}
                    onChange={(dateFrom, dateTo) => setRange({ dateFrom, dateTo })} />
                </>}
                {valid ? <p className="notice">{formatFinanceDateRange(range.dateFrom, range.dateTo)} · incluindo as duas datas.</p> : mode === "CUSTOM" && range.dateFrom && !range.dateTo ? <p role="status">Escolha a data final do período.</p> : <p role="alert">Informe as duas datas, com o fim igual ou posterior ao início.</p>}
              </>
            )}
          </div>
        </Modal>
      )}
    </>
  );
}
