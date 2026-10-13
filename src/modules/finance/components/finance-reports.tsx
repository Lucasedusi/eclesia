"use client";
import { useEffect, useRef, useState } from "react";
import {
  ChartNoAxesCombined,
  ListOrdered,
  FileDown,
  FileText,
  Printer,
  ExternalLink,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { FinanceSkeleton } from "./finance-skeleton";
import { useFinanceNavigation } from "./finance-shell";
export function FinanceReports({
  unit,
  month,
  cashboxes,
}: {
  unit: string;
  month: string;
  cashboxes: { id: string; name: string; status: string }[];
}) {
  const [type, setType] = useState<"ANALYTIC" | "SYNTHETIC">("SYNTHETIC"),
    [box, setBox] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const [pdf, setPdf] = useState<{ url: string; name: string } | null>(null);
  const controller = useRef<AbortController | null>(null),
    url = useRef<string | null>(null),
    frame = useRef<HTMLIFrameElement>(null);
  const { isPending } = useFinanceNavigation();
  useEffect(
    () => () => {
      controller.current?.abort();
      if (url.current) URL.revokeObjectURL(url.current);
    },
    [],
  );
  function invalidate() {
    controller.current?.abort();
    controller.current = null;
    if (url.current) URL.revokeObjectURL(url.current);
    url.current = null;
    setPdf(null);
    setError("");
    setBusy(false);
  }
  async function generate() {
    invalidate();
    const request = new AbortController();
    controller.current = request;
    setBusy(true);
    try {
      const response = await fetch("/api/finance/reports/pdf", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          congregationId: unit,
          type,
          month,
          ...(box ? { cashboxId: box } : {}),
        }),
        signal: request.signal,
      });
      if (!response.ok) {
        const body = await response.json().catch(() => null);
        throw new Error(
          body?.message ||
            "Não foi possível gerar o relatório. Tente novamente.",
        );
      }
      if (!response.headers.get("content-type")?.includes("application/pdf"))
        throw new Error("Entre novamente para gerar o relatório.");
      const blob = await response.blob();
      if (request.signal.aborted) return;
      const objectUrl = URL.createObjectURL(blob);
      url.current = objectUrl;
      setPdf({
        url: objectUrl,
        name: `relatorio-${type === "ANALYTIC" ? "analitico" : "sintetico"}-${month}.pdf`,
      });
    } catch (e) {
      if (!request.signal.aborted)
        setError(
          e instanceof Error
            ? e.message
            : "Não foi possível gerar o relatório.",
        );
    } finally {
      if (controller.current === request) {
        controller.current = null;
        setBusy(false);
      }
    }
  }
  const visiblePdf = isPending ? null : pdf;
  return (
    <div className="stack finance-reports">
      <header className="finance-page-header">
        <div>
          <h1>Relatórios</h1>
          <p className="muted">
            Confira a movimentação do mês e prepare os documentos para
            impressão.
          </p>
        </div>
      </header>
      <section className="card stack" aria-label="Opções do relatório">
        <fieldset className="finance-report-types">
          <legend>Tipo de relatório</legend>
          {[
            {
              value: "SYNTHETIC",
              title: "Sintético — resumo por categorias",
              description: "Veja quanto entrou e saiu em cada categoria.",
              Icon: ChartNoAxesCombined,
            },
            {
              value: "ANALYTIC",
              title: "Analítico — lançamentos detalhados",
              description:
                "Confira cada entrada e saída, com pessoas e descrições.",
              Icon: ListOrdered,
            },
          ].map(({ value, title, description, Icon }) => (
            <label
              key={value}
              className="finance-report-option"
              data-selected={type === value}
            >
              <input
                type="radio"
                name="report-type"
                value={value}
                checked={type === value}
                onChange={() => {
                  invalidate();
                  setType(value as typeof type);
                }}
                aria-label={title}
              />
              <Icon size={23} aria-hidden="true" />
              <span>
                <strong>{title}</strong>
                <small>{description}</small>
              </span>
            </label>
          ))}
        </fieldset>
        <div className="finance-report-controls">
          <label>
            Caixas e contas
            <select
              value={box}
              onChange={(e) => {
                invalidate();
                setBox(e.target.value);
              }}
            >
              <option value="">Todos os caixas e contas</option>
              {cashboxes.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                  {b.status !== "ACTIVE" ? " · Inativo" : ""}
                </option>
              ))}
            </select>
          </label>
          <Button
            onClick={() => void generate()}
            disabled={busy || isPending}
            style={{ minWidth: 180 }}
          >
            {busy ? (
              <span className="finance-spinner" aria-hidden="true" />
            ) : (
              <FileText size={17} />
            )}
            Gerar relatório
          </Button>
        </div>
        <p className="muted">
          O relatório considera os lançamentos registrados. Os valores
          calculados no demonstrativo só aparecem como saídas depois de
          lançados.
        </p>
      </section>
      {error && (
        <div role="alert" className="notice finance-report-error">
          {error}
        </div>
      )}
      {busy ? (
        <section aria-label="Gerando relatório" aria-busy="true">
          <p role="status">Preparando o PDF…</p>
          <FinanceSkeleton table />
        </section>
      ) : visiblePdf ? (
        <section
          className="card stack finance-report-preview"
          aria-label="Relatório gerado"
        >
          <div className="row spread">
            <div>
              <h2>Seu relatório está pronto</h2>
              <p className="muted">
                A prévia, o download e a impressão usam o mesmo arquivo.
              </p>
            </div>
            <div className="row">
              <a
                className="finance-report-link"
                href={visiblePdf.url}
                download={visiblePdf.name}
              >
                <FileDown size={17} />
                Baixar PDF
              </a>
              <Button
                variant="outline"
                onClick={() => {
                  try {
                    if (!frame.current?.contentWindow) throw new Error();
                    frame.current.contentWindow.focus();
                    frame.current.contentWindow.print();
                  } catch {
                    window.open(
                      visiblePdf.url,
                      "_blank",
                      "noopener,noreferrer",
                    );
                  }
                }}
              >
                <Printer size={17} />
                Imprimir
              </Button>
            </div>
          </div>
          <iframe
            ref={frame}
            title="Prévia do relatório financeiro"
            src={visiblePdf.url}
          />
          <div className="row spread">
            <p className="muted">
              Uma nova emissão pode refletir correções feitas após este arquivo.
            </p>
            <a
              href={visiblePdf.url}
              target="_blank"
              rel="noopener noreferrer"
              className="finance-report-link"
            >
              <ExternalLink size={16} />
              Abrir PDF em outra aba
            </a>
          </div>
        </section>
      ) : (
        <section className="card finance-report-empty">
          <FileText size={34} aria-hidden="true" />
          <h2>Uma visão clara das finanças</h2>
          <p>
            Selecione o modelo e gere o relatório do período escolhido no
            cabeçalho.
          </p>
          <small>
            PDF em A4, pronto para conferir, imprimir ou compartilhar com a
            contabilidade.
          </small>
        </section>
      )}
    </div>
  );
}
