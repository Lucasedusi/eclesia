"use client";
import { useEffect, useRef, useState } from "react";
import {
  ChartNoAxesCombined,
  ListOrdered,
  FileDown,
  FileText,
  ExternalLink,
} from "lucide-react";
import { Button } from "@/components/ui/button";
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
  const [pdf, setPdf] = useState<{
    url: string;
    name: string;
    opened: boolean;
  } | null>(null);
  const controller = useRef<AbortController | null>(null),
    url = useRef<string | null>(null),
    pendingTab = useRef<Window | null>(null);
  const { isPending } = useFinanceNavigation();
  useEffect(
    () => () => {
      controller.current?.abort();
      pendingTab.current?.close();
      if (url.current) URL.revokeObjectURL(url.current);
    },
    [],
  );
  useEffect(() => {
    if (isPending) {
      controller.current?.abort();
      pendingTab.current?.close();
      pendingTab.current = null;
    }
  }, [isPending]);
  function invalidate() {
    controller.current?.abort();
    pendingTab.current?.close();
    pendingTab.current = null;
    controller.current = null;
    if (url.current) URL.revokeObjectURL(url.current);
    url.current = null;
    setPdf(null);
    setError("");
    setBusy(false);
  }
  async function generate() {
    invalidate();
    // Reserve the tab during the click; opening after fetch may be blocked.
    let tab: Window | null = null;
    try {
      tab = window.open("about:blank", "_blank");
      if (tab) {
        tab.opener = null;
        tab.document.title = "Preparando relatório — Eclesias";
        const waiting = tab.document.createElement("main");
        waiting.setAttribute("role", "status");
        waiting.setAttribute("aria-busy", "true");
        const spinner = tab.document.createElement("span");
        spinner.className = "spinner";
        spinner.setAttribute("aria-hidden", "true");
        const title = tab.document.createElement("h1");
        title.textContent = "Preparando o PDF…";
        const message = tab.document.createElement("p");
        message.textContent =
          "Você pode aguardar nesta aba. O relatório abrirá assim que estiver pronto.";
        waiting.append(spinner, title, message);
        const style = tab.document.createElement("style");
        style.textContent = `
          body { margin:0; min-height:100vh; display:grid; place-items:center; background:#f5f8f6; color:#183d2e; font:14px system-ui,sans-serif; }
          main { margin:24px; padding:36px; max-width:420px; text-align:center; background:white; border:1px solid #dfe8e2; border-radius:16px; }
          h1 { font-size:20px; margin:18px 0 10px; } p { color:#52675c; line-height:1.6; }
          .spinner { display:inline-block; width:30px; height:30px; border:3px solid #dfe8e2; border-top-color:#087e5c; border-radius:50%; animation:spin .8s linear infinite; }
          @keyframes spin { to { transform:rotate(360deg); } }
          @media (prefers-reduced-motion:reduce) { .spinner { animation:none; } }
        `;
        tab.document.documentElement.lang = "pt-BR";
        tab.document.head.append(style);
        tab.document.body.replaceChildren(waiting);
      }
    } catch {
      tab?.close();
      tab = null;
    }
    pendingTab.current = tab;
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
      let opened = false;
      if (tab && !tab.closed) {
        try {
          tab.location.replace(objectUrl);
          opened = true;
        } catch {
          tab.close();
        }
      }
      pendingTab.current = null;
      setPdf({
        opened,
        url: objectUrl,
        name: `relatorio-${type === "ANALYTIC" ? "analitico" : "sintetico"}-${month}.pdf`,
      });
    } catch (e) {
      tab?.close();
      if (!request.signal.aborted)
        setError(
          e instanceof Error
            ? e.message
            : "Não foi possível gerar o relatório.",
        );
    } finally {
      if (controller.current === request) {
        controller.current = null;
        pendingTab.current = null;
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
        <div className="finance-report-controls finance-mobile-report-controls">
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
          >
            {busy ? (
              <span className="finance-spinner" aria-hidden="true" />
            ) : (
              <FileText size={17} />
            )}
            Gerar relatório
          </Button>
        </div>
      </section>
      {error && (
        <div role="alert" className="notice finance-report-error">
          {error}
        </div>
      )}
      {busy ? (
        <section
          className="notice"
          aria-label="Gerando relatório"
          aria-busy="true"
        >
          <p role="status">Preparando o PDF…</p>
        </section>
      ) : visiblePdf ? (
        <section
          className="card stack finance-report-ready"
          aria-label="Relatório gerado"
        >
          <div className="row spread">
            <div role="status">
              <h2>Seu relatório está pronto</h2>
              <p className="muted">
                {visiblePdf.opened
                  ? "O PDF foi aberto em uma nova aba. Use o visualizador para imprimir ou salvar."
                  : "Use Abrir PDF para visualizar o relatório em uma nova aba."}
              </p>
            </div>
            <div className="row finance-report-ready-actions">
              <a
                className="finance-report-link"
                href={visiblePdf.url}
                target="_blank"
                rel="noopener noreferrer"
              >
                <ExternalLink size={17} aria-hidden="true" />
                Abrir PDF
              </a>
              <a
                className="finance-report-link"
                href={visiblePdf.url}
                download={visiblePdf.name}
              >
                <FileDown size={17} aria-hidden="true" />
                Baixar PDF
              </a>
            </div>
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
