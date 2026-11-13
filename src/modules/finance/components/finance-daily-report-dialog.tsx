"use client";

import { useState } from "react";
import { FileText } from "lucide-react";
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
  const [box, setBox] = useState("");
  const [presentation, setPresentation] =
    useState<DailyReportOptions["presentation"]>("SUMMARY");
  const [includePayments, setIncludePayments] = useState(false);
  const report = useFinanceReportPdf(
    {
      type: "DAILY",
      date,
      box: box || undefined,
      presentation,
      includePayments,
    },
    dailyReportFilename(date, presentation),
  );
  return (
    <Modal
      title="Relatório do fluxo diário"
      onClose={onClose}
      busy={report.busy}
      footer={
        <Button
          onClick={report.generate}
          loading={report.busy}
          disabled={report.busy || report.isPending}
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
          <label>
            Caixas e contas
            <select value={box} onChange={(e) => setBox(e.target.value)}>
              <option value="">Todos os caixas e contas</option>
              {boxes.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                  {b.status === "INACTIVE" ? " (inativo)" : ""}
                </option>
              ))}
            </select>
          </label>
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
          </fieldset>
          <label className="check">
            <input
              type="checkbox"
              checked={includePayments}
              onChange={(e) => setIncludePayments(e.target.checked)}
            />
            Incluir resumo por forma de pagamento
          </label>
        </fieldset>
        {filtered && (
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
