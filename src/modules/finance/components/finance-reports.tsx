"use client";
import { useState } from "react";
import { useFinanceDesktop } from "../hooks/use-finance-desktop";
import { FinanceCategoryReportOptions } from "./finance-category-report-options";
import type {
  CategoryReportOptions,
  ReportCategory,
} from "../types/finance-category-report.types";
import { categoryReportOptionsSchema } from "../validations/finance-category-report.schemas";
import {
  ChartNoAxesCombined,
  ListOrdered,
  FileDown,
  FileText,
  ExternalLink,
  CalendarRange,
  ClipboardCheck,
  ArrowUpRight,
} from "lucide-react";
import Link from "next/link";
import { useFinanceReportPdf } from "../hooks/use-finance-report-pdf";
import { financeLocation } from "../utils/finance-navigation";
import { Button } from "@/components/ui/button";
import {
  financeInformativeReportOptionsSchema,
  informativeStartMonth,
} from "../validations/finance-informative-report.schemas";
type FinanceReportsProps = {
  unit: string;
  month: string;
  cashboxes: { id: string; name: string; status: string }[];
  canViewInformative?: boolean;
  categories?: ReportCategory[];
};
export function FinanceReports(props: FinanceReportsProps) {
  const desktop = useFinanceDesktop();
  // Remount on a layout change to discard hidden filters and pending PDFs safely.
  return (
    <FinanceReportsContent
      {...props}
      desktop={desktop}
      key={desktop ? "desktop" : "mobile"}
    />
  );
}
function FinanceReportsContent({
  unit,
  month,
  cashboxes,
  canViewInformative = false,
  categories = [],
  desktop,
}: FinanceReportsProps & { desktop: boolean }) {
  const [type, setType] = useState<
      "ANALYTIC" | "SYNTHETIC" | "INFORMATIVE" | "RANKING" | "CATEGORY"
    >("SYNTHETIC"),
    [box, setBox] = useState("");
  const [startMonth, setStartMonth] = useState(() =>
    informativeStartMonth(month),
  );
  const [endMonth, setEndMonth] = useState(month);
  const [includePrebend, setIncludePrebend] = useState(true);
  const [includeTransfer, setIncludeTransfer] = useState(true);
  const [categoryOptions, setCategoryOptions] = useState<CategoryReportOptions>(
    () => ({
      type: "CATEGORY",
      dateFrom: `${month}-01`,
      dateTo: new Date(
        Date.UTC(Number(month.slice(0, 4)), Number(month.slice(5, 7)), 0),
      )
        .toISOString()
        .slice(0, 10),
      direction: "EXPENSE",
      presentation: "SUMMARY",
      categoryIds: [],
    }),
  );
  const categoryReport = type === "CATEGORY";
  const categoryValidation =
    categoryReportOptionsSchema.safeParse(categoryOptions);
  const ranking = type === "RANKING";
  const informative = type === "INFORMATIVE" || ranking;
  const informativeOptions = {
    type: "INFORMATIVE" as const,
    startMonth,
    endMonth,
    includePrebend,
    includeTransfer,
  };
  const periodValidation =
    financeInformativeReportOptionsSchema.safeParse(informativeOptions);
  const {
    busy,
    error,
    pdf: visiblePdf,
    generate,
    invalidate,
    isPending,
  } = useFinanceReportPdf(
    ranking
      ? { ...informativeOptions, type: "RANKING", includeInactive: false }
      : {
          congregationId: unit,
          ...(categoryReport
            ? { ...categoryOptions, ...(box ? { cashboxId: box } : {}) }
            : informative
              ? informativeOptions
              : { type, month, ...(box ? { cashboxId: box } : {}) }),
        },
    categoryReport
      ? `relatorio-categorias-${categoryOptions.dateFrom}-a-${categoryOptions.dateTo}.pdf`
      : informative
        ? `relatorio-${ranking ? "ranking" : "informativo"}-${startMonth}-a-${endMonth}.pdf`
        : `relatorio-${type === "ANALYTIC" ? "analitico" : "sintetico"}-${month}.pdf`,
  );
  return (
    <div className="stack finance-reports">
      <header className="finance-page-header finance-mobile-page-heading">
        <div>
          <h1>Relatórios</h1>
          <p className="muted">
            Confira a movimentação financeira e prepare os documentos para
            impressão.
          </p>
        </div>
      </header>
      <section className="card stack" aria-label="Opções do relatório">
        <fieldset
          className="finance-report-types"
          data-administrative={canViewInformative || undefined}
        >
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
            {
              value: "CATEGORY",
              title: "Por categoria",
              description:
                "Consulte receitas ou despesas em qualquer intervalo.",
              Icon: CalendarRange,
            },
            ...(canViewInformative
              ? [
                  {
                    value: "INFORMATIVE",
                    title: "Informativo por congregação",
                    description:
                      "Compare os meses, com prebenda e repasse opcionais.",
                    Icon: CalendarRange,
                  },
                  {
                    value: "RANKING",
                    title: "Informativo geral por congregação",
                    description:
                      "Ranking por entradas, com totais de todas as congregações.",
                    Icon: ListOrdered,
                  },
                ]
              : []),
          ]
            .filter(
              (option) =>
                desktop || ["SYNTHETIC", "ANALYTIC"].includes(option.value),
            )
            .map(({ value, title, description, Icon }) => (
              <label
                key={value}
                className={`finance-report-option${["SYNTHETIC", "ANALYTIC"].includes(value) ? "" : " finance-desktop-only"}`}
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
                    if (value === "RANKING") {
                      setStartMonth(month);
                      setEndMonth(month);
                    }
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
          {desktop && canViewInformative && (
            <Link
              className="finance-report-option finance-report-delivery-link finance-desktop-only"
              href={financeLocation(
                "/financeiro/relatorios/entregas",
                unit,
                month,
              )}
            >
              <ClipboardCheck size={23} aria-hidden="true" />
              <span>
                <strong>Entrega de relatórios</strong>
                <small>
                  Acompanhe os recebimentos e emita a lista por situação.
                </small>
              </span>
              <ArrowUpRight size={18} aria-hidden="true" />
            </Link>
          )}
        </fieldset>
        {categoryReport && (
          <FinanceCategoryReportOptions
            options={categoryOptions}
            categories={categories}
            onChange={(value) => {
              invalidate();
              setCategoryOptions(value);
            }}
          />
        )}
        {categoryReport && !categoryValidation.success && (
          <p className="muted" role="status">
            {categoryValidation.error.issues[0].message}
          </p>
        )}
        {informative && (
          <div className="stack finance-informative-options">
            <p className="muted">
              {ranking
                ? "Congregações ativas autorizadas, incluindo a catedral. Ordenação por maiores entradas no período."
                : "Todos os caixas e contas da congregação selecionada no topo."}
            </p>
            <div className="finance-informative-period">
              <label>
                Mês inicial
                <input
                  type="month"
                  min="2000-01"
                  max="2099-12"
                  value={startMonth}
                  onChange={(e) => {
                    invalidate();
                    setStartMonth(e.target.value);
                  }}
                />
              </label>
              <label>
                Mês final
                <input
                  type="month"
                  min="2000-01"
                  max="2099-12"
                  value={endMonth}
                  onChange={(e) => {
                    invalidate();
                    setEndMonth(e.target.value);
                  }}
                />
              </label>
            </div>
            {!periodValidation.success && (
              <p role="alert" className="finance-report-error">
                {periodValidation.error.issues[0].message}
              </p>
            )}
            <fieldset className="finance-informative-columns">
              <legend>Colunas opcionais</legend>
              <label>
                <input
                  type="checkbox"
                  checked={includePrebend}
                  onChange={(e) => {
                    invalidate();
                    setIncludePrebend(e.target.checked);
                  }}
                />
                Incluir prebenda bruta
              </label>
              <label>
                <input
                  type="checkbox"
                  checked={includeTransfer}
                  onChange={(e) => {
                    invalidate();
                    setIncludeTransfer(e.target.checked);
                  }}
                />
                Incluir repasse
              </label>
            </fieldset>
            <p className="muted finance-informative-help">
              A prebenda bruta soma as saídas registradas na congregação. O repasse
              soma as entradas da Catedral identificadas com a congregação pagadora,
              pela data do recebimento. Configure o uso das categorias nos informativos
              em Configurações. Apenas lançamentos confirmados são contabilizados.
            </p>
          </div>
        )}
        <div className="finance-report-controls finance-mobile-report-controls">
          {!informative && (
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
          )}
          <Button
            onClick={() => void generate()}
            disabled={
              busy ||
              isPending ||
              (informative && !periodValidation.success) ||
              (categoryReport && !categoryValidation.success)
            }
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
            {categoryReport
              ? "Selecione o período, a movimentação e as categorias desejadas para gerar o relatório."
              : informative
                ? "Confira o período e as colunas desejadas para gerar o informativo da congregação."
                : "Selecione o modelo e gere o relatório do período escolhido no cabeçalho."}
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
