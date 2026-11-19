"use client";
import { FinanceFieldPopup } from "./finance-field-popup";
import styles from "./finance-pickers.module.css";

import { useId, useRef, useState } from "react";
import { ChevronDown, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { useFinanceReportPdf } from "../hooks/use-finance-report-pdf";
import type { DailyCashFlowPage } from "../validations/finance-daily-cash-flow.schemas";
import {
  dailyReportFilename,
  type DailyReportOptions,
} from "../validations/finance-daily-report.schemas";

export function FinanceDailyReportDialog({
  date,
  boxes,
  filtered,
  onClose,
}: {
  date: string;
  boxes: DailyCashFlowPage["cashboxes"];
  filtered: boolean;
  onClose: () => void;
}) {
  const [boxIds, setBoxIds] = useState<string[] | null>(null);
  const [presentation, setPresentation] =
    useState<DailyReportOptions["presentation"]>("SUMMARY");
  const [includePayments, setIncludePayments] = useState(false);
  const balances = presentation === "BALANCES";
  const report = useFinanceReportPdf(
    balances
      ? { type: "DAILY", date, presentation }
      : {
          type: "DAILY",
          date,
          boxIds: boxIds ?? undefined,
          presentation,
          includePayments,
        },
    dailyReportFilename(date, presentation),
  );
  return (
    <Modal
      title="Relatório do fluxo diário"
      className="finance-daily-report-dialog"
      onClose={onClose}
      busy={report.busy}
      footer={
        <Button
          onClick={report.generate}
          loading={report.busy}
          disabled={report.busy || report.isPending || (!balances && boxIds?.length === 0)}
        >
          <FileText size={16} />
          Gerar PDF
        </Button>
      }
    >
      <div className="stack">
        <p>
          Data do movimento ·{" "}
          <strong>{date.split("-").reverse().join("/")}</strong>
        </p>
        <fieldset
          className="stack finance-daily-report-fields"
          disabled={report.busy}
          onChange={report.invalidate}
        >
          <fieldset className="finance-daily-report-types">
            <legend>Tipo de relatório</legend>
            <label>
              <input
                type="radio"
                name="presentation"
                checked={presentation === "SUMMARY"}
                onChange={() => setPresentation("SUMMARY")}
              />
              <span>
                <strong>Resumido</strong>
                <small>Totais por categoria</small>
              </span>
            </label>
            <label>
              <input
                type="radio"
                name="presentation"
                checked={presentation === "DETAIL"}
                onChange={() => setPresentation("DETAIL")}
              />
              <span>
                <strong>Detalhado</strong>
                <small>Lançamentos individuais</small>
              </span>
            </label>
            <label>
              <input
                type="radio"
                name="presentation"
                checked={balances}
                onChange={() => setPresentation("BALANCES")}
              />
              <span>
                <strong>Resumo de caixa</strong>
                <small>Saldo geral e saldo por caixa ou conta</small>
              </span>
            </label>
          </fieldset>
          {balances ? (
            <p>Inclui todos os caixas e contas da Catedral.</p>
          ) : (
            <>
              <ReportBoxPicker boxes={boxes} selected={boxIds} onChange={setBoxIds} />
              <label className="check">
                <input
                  type="checkbox"
                  checked={includePayments}
                  onChange={(e) => setIncludePayments(e.target.checked)}
                />
                Incluir resumo por forma de pagamento
              </label>
            </>
          )}
        </fieldset>
        {filtered && !balances && (
          <p className="notice">
            O PDF inclui todas as movimentações do dia para os caixas
            selecionados.
          </p>
        )}
        {report.error && <p role="alert">{report.error}</p>}
        {report.pdf && (
          <div className="row" role="status">
            <a
              className="finance-report-link"
              href={report.pdf.url}
              target="_blank"
              rel="noopener noreferrer"
            >
              Abrir PDF
            </a>
            <a
              className="finance-report-link"
              href={report.pdf.url}
              download={report.pdf.name}
            >
              Baixar PDF
            </a>
          </div>
        )}
      </div>
    </Modal>
  );
}

function ReportBoxPicker({ boxes, selected, onChange }: {
  boxes: DailyCashFlowPage["cashboxes"];
  selected: string[] | null;
  onChange: (ids: string[] | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const anchor = useRef<HTMLButtonElement>(null);
  const id = useId();
  const all = "Todos os caixas e contas";
  const label = selected === null ? all : selected.length === 0 ? "Selecione os caixas"
    : selected.length === 1 ? boxes.find(box => box.id === selected[0])?.name
    : `${selected.length} caixas selecionados`;
  return (
    <div className={styles.field}>
      <label htmlFor={id}>Caixas e contas</label>
      <button type="button" id={id} ref={anchor} className={styles.multiTrigger}
        aria-expanded={open} aria-controls={open ? id + "-options" : undefined}
        onClick={() => setOpen(!open)}>{label}<ChevronDown size={16} aria-hidden="true" /></button>
      {open && <FinanceFieldPopup anchor={anchor} onDismiss={() => setOpen(false)}>
        <div id={id + "-options"} role="group" aria-label="Selecionar caixas e contas" className={styles.multiOptions}>
          <label><input type="checkbox" checked={selected === null}
            onChange={() => onChange(selected === null ? [] : null)} />{all}</label>
          {boxes.map(box => <label key={box.id}>
            <input type="checkbox" checked={selected?.includes(box.id) ?? false}
              onChange={event => onChange(event.target.checked ? [...(selected ?? []), box.id]
                : (selected ?? []).filter(id => id !== box.id))} />
            {box.name}{box.status === "INACTIVE" ? " (inativo)" : ""}
          </label>)}
        </div>
      </FinanceFieldPopup>}
    </div>
  );
}
