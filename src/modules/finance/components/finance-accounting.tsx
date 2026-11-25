"use client";

import { useRef, useState, useTransition } from "react";
import {
  ArrowDownLeft,
  ArrowUpRight,
  ChartNoAxesColumn,
  Download,
  Search,
  Save,
  Wallet,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { FinanceSelect } from "./finance-select";
import { FinanceDateField } from "./finance-date-field";
import { useFinanceNavigation } from "./finance-shell";
import { monthRange, shiftCivilDate } from "../utils/finance-period";
import { FinanceSkeleton } from "./finance-skeleton";
import { formatMoney } from "../utils/finance-money";
import {
  accountingFilters,
  type AccountingFilters,
} from "../validations/finance-accounting.schemas";
import type {
  AccountingCatalog,
  AccountingHistory,
  AccountingPreview,
} from "../types/finance-accounting.types";
import {
  confirmAccountingAction,
  consultAccountingAction,
  accountingHistoryAction,
  exportAccountingAction,
  saveAccountingCodeAction,
} from "../actions/finance-accounting.actions";
import styles from "./finance-accounting.module.css";

type Props = {
  catalog: AccountingCatalog;
  currentMonth: string;
  initialBox: string | null;
  canConfigure: boolean;
  canConfirm: boolean;
};

const dateLabel = (iso: string) => iso.split("-").reverse().join("/");
const movement = (value: string) =>
  value === "INCOME" ? "Entrada" : value === "EXPENSE" ? "Saída" : "Todos";

function AccountingCodes({
  catalog,
  onSaved,
}: {
  catalog: AccountingCatalog;
  onSaved: () => void;
}) {
  const [kind, setKind] = useState<"CASHBOX" | "CATEGORY">("CASHBOX");
  const [id, setId] = useState("");
  const [code, setCode] = useState("");
  const [busy, start] = useTransition();
  const [message, setMessage] = useState("");
  const { refresh, isPending } = useFinanceNavigation();
  const options =
    kind === "CASHBOX"
      ? catalog.boxes.map((b) => ({
          ...b,
          label:
            b.name + " · " + catalog.units.find((u) => u.id === b.unit)?.name,
        }))
      : catalog.categories
          .filter((c) => c.direction !== "BOTH")
          .map((c) => ({
            ...c,
            label: c.name + " · " + movement(c.direction),
          }));
  const item = options.find((o) => o.id === id);
  return (
    <details className="card">
      <summary className={styles.summary}>Configurar códigos contábeis</summary>
      <form
        className={styles.filters}
        onSubmit={(e) => {
          e.preventDefault();
          if (!item) return;
          start(async () => {
            const r = await saveAccountingCodeAction({
              kind,
              id,
              code: code || null,
              previous: item.code,
            });
            setMessage(r.ok ? "Código salvo." : r.message);
            refresh();
            if (r.ok) onSaved();
          });
        }}
      >
        <FinanceSelect
          label="Tipo de cadastro"
          disabled={busy}
          value={kind}
          onChange={(e) => {
            setKind(e.target.value as typeof kind);
            setId("");
            setCode("");
            setMessage("");
          }}
        >
          <option value="CASHBOX">Caixas e contas</option>
          <option value="CATEGORY">Categorias</option>
        </FinanceSelect>
        <FinanceSelect
          label="Cadastro"
          disabled={busy}
          value={id}
          onChange={(e) => {
            setId(e.target.value);
            setCode(options.find((o) => o.id === e.target.value)?.code ?? "");
            setMessage("");
          }}
        >
          <option value="">Selecione</option>
          {options.map((o) => (
            <option key={o.id} value={o.id}>
              {o.label}
              {o.code ? " · " + o.code : ""}
            </option>
          ))}
        </FinanceSelect>
        <label>
          Código Alterdata
          <input
            value={code}
            onChange={(e) => setCode(e.target.value)}
            inputMode="numeric"
            pattern="[0-9]{1,32}"
            maxLength={32}
            disabled={!id || busy}
          />
        </label>
        <Button
          type="submit"
          loading={busy}
          disabled={!item || isPending || (code || null) === item.code}
        >
          <Save size={16} />
          Salvar código
        </Button>
      </form>
      {message && <p role="status">{message}</p>}
    </details>
  );
}

function Pager({
  page,
  total,
  size,
  go,
}: {
  page: number;
  total: number;
  size: number;
  go: (page: number) => void;
}) {
  if (total <= size) return null;
  return (
    <div className="row">
      <Button
        variant="secondary"
        disabled={page === 1}
        onClick={() => go(page - 1)}
      >
        Anterior
      </Button>
      <span>
        Página {page} de {Math.ceil(total / size)}
      </span>
      <Button
        variant="secondary"
        disabled={page * size >= total}
        onClick={() => go(page + 1)}
      >
        Próxima
      </Button>
    </div>
  );
}

function presetDates(currentMonth: string, previous: boolean) {
  const current = monthRange(currentMonth);
  const range = previous
    ? monthRange(shiftCivilDate(current.start, -1).slice(0, 7))
    : current;
  return { start: range.start, end: shiftCivilDate(range.end, -1) };
}

export function FinanceAccounting({
  catalog,
  currentMonth,
  initialBox,
  canConfigure,
  canConfirm,
}: Props) {
  const [preset, setPreset] = useState("previous");
  const [draft, setDraft] = useState<AccountingFilters>(() => ({
    ...presetDates(currentMonth, true),
    box: initialBox,
    unit: catalog.boxes.find((b) => b.id === initialBox)?.unit ?? null,
    direction: "ALL",
  }));
  const [filters, setFilters] = useState(draft);
  const [preview, setPreview] = useState<AccountingPreview | null>(null);
  const [history, setHistory] = useState<AccountingHistory | null>(null);
  const [historyPage, setHistoryPage] = useState(1);
  const [isPending, query] = useTransition();
  const request = useRef(0);
  const [repeatFingerprint, setRepeatFingerprint] = useState<string | null>(
    null,
  );
  const repeat = Boolean(preview && repeatFingerprint === preview.fingerprint);
  const [message, setMessage] = useState("");
  const [busy, start] = useTransition();
  const changed = JSON.stringify(draft) !== JSON.stringify(filters);
  const valid = accountingFilters.safeParse(draft).success;
  function consult(next: AccountingFilters, page = 1) {
    const id = ++request.current;
    setHistory(null);
    setMessage("");
    setRepeatFingerprint(null);
    query(async () => {
      try {
        const response = await consultAccountingAction(next, page);
        if (request.current !== id) return;
        setFilters(next);
        setPreview(response.ok ? response.data : null);
        if (!response.ok) setMessage(response.message);
      } catch {
        if (request.current === id) {
          setPreview(null);
          setMessage(
            "Não foi possível consultar os lançamentos. Tente novamente.",
          );
        }
      }
    });
  }

  function showHistory(page: number) {
    const id = request.current;
    start(async () => {
      const result = await accountingHistoryAction(filters, page);
      if (request.current !== id) return;
      if (!result.ok) return setMessage(result.message);
      setHistoryPage(page);
      setHistory(result.data);
    });
  }
  const eligible =
    filters.unit &&
    filters.box &&
    preview &&
    preview.total > 0 &&
    !preview.missing &&
    !preview.special.length;
  const units = new Map(catalog.units.map((u) => [u.id, u.name]));
  const boxes = new Map(catalog.boxes.map((b) => [b.id, b]));
  function renderBox(value: string) {
    const box = boxes.get(value);
    if (!box) return "Todos os caixas e contas";
    return (
      <span>
        {box.name} · <strong>{units.get(box.unit)}</strong>
        {(box.agency || box.account) && (
          <span className={styles.bankDetails}>
            {box.agency && `AG: ${box.agency}`}
            {box.agency && box.account && " | "}
            {box.account && (
              <>
                CC: <strong>{box.account}</strong>
              </>
            )}
          </span>
        )}
      </span>
    );
  }
  function download() {
    if (!preview || !eligible || changed) return;
    start(async () => {
      const r = await exportAccountingAction(
        filters,
        preview.fingerprint,
        repeat,
      );
      if (!r.ok) {
        consult(filters, preview.page);
        setMessage(r.message);
        return;
      }
      const bytes = Uint8Array.from(atob(r.data.file), (c) => c.charCodeAt(0));
      const url = URL.createObjectURL(
        new Blob([bytes], { type: "text/csv;charset=windows-1252" }),
      );
      const a = document.createElement("a");
      a.href = url;
      const box =
        catalog.boxes.find((b) => b.id === filters.box)?.name ?? "conta";
      a.download = `Alterdata-${box.replace(/[^\p{L}\d-]+/gu, "-")}-${filters.start}-${filters.end}-${r.data.id.slice(0, 8)}.csv`;
      a.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 30000);
      consult(filters, preview.page);
      setMessage(
        canConfirm
          ? "Arquivo gerado. Após conferir no Alterdata, use Consultar exportações para confirmar a importação."
          : "Arquivo gerado. O lote está disponível em Consultar exportações.",
      );
    });
  }
  return (
    <div className="stack">
      <header className="finance-page-header">
        <h1>Contabilidade</h1>
      </header>
      {canConfigure && (
        <AccountingCodes
          catalog={catalog}
          onSaved={() => {
            if (preview) consult(filters, preview.page);
          }}
        />
      )}
      <form
        className={`card ${styles.filters} ${styles.searchFilters}`}
        onSubmit={(e) => {
          e.preventDefault();
          if (valid) consult(draft);
        }}
      >
        <FinanceSelect
          label="Caixa ou conta"
          fieldClassName={styles.boxField}
          popupWidth={540}
          renderValue={renderBox}
          value={draft.box ?? ""}
          onChange={(e) =>
            setDraft({
              ...draft,
              box: e.target.value || null,
              unit: boxes.get(e.target.value)?.unit ?? null,
            })
          }
        >
          <option value="">Todos os caixas e contas</option>
          {Array.from(boxes.values(), (b) => (
            <option key={b.id} value={b.id}>
              {[
                b.name,
                units.get(b.unit),
                [b.agency && `AG: ${b.agency}`, b.account && `CC: ${b.account}`]
                  .filter(Boolean)
                  .join(" | "),
              ]
                .filter(Boolean)
                .join(" · ")}
            </option>
          ))}
        </FinanceSelect>
        <FinanceSelect
          label="Período da consulta"
          value={preset}
          onChange={(e) => {
            const value = e.target.value;
            setPreset(value);
            if (value !== "custom")
              setDraft({
                ...draft,
                ...presetDates(currentMonth, value === "previous"),
              });
          }}
        >
          <option value="previous">Mês anterior</option>
          <option value="current">Mês atual</option>
          <option value="custom">Personalizado</option>
        </FinanceSelect>
        <FinanceDateField
          label="Data inicial"
          withCalendar
          value={draft.start}
          max={draft.end || undefined}
          onChange={(start) => {
            setPreset("custom");
            setDraft({ ...draft, start });
          }}
        />
        <FinanceDateField
          label="Data final"
          withCalendar
          value={draft.end}
          min={draft.start || undefined}
          onChange={(end) => {
            setPreset("custom");
            setDraft({ ...draft, end });
          }}
        />
        <Button type="submit" disabled={!valid || isPending || busy}>
          <Search size={16} />
          Consultar
        </Button>
      </form>
      <section
        className={`card stack ${styles.preview}`}
        aria-label="Prévia contábil"
      >
        <h2>Prévia contábil</h2>
        {isPending ? (
          <FinanceSkeleton table label="Consultando prévia contábil" />
        ) : !preview ? (
          <div className={styles.empty}>
            <Search size={28} aria-hidden="true" />
            <p>
              Selecione o caixa ou conta e o período para consultar os
              lançamentos.
            </p>
          </div>
        ) : (
          <>
            <div className={styles.totals}>
              {[
                {
                  label: "Saldo anterior",
                  value: preview.opening,
                  icon: Wallet,
                },
                {
                  label: "Entradas",
                  value: preview.income,
                  icon: ArrowDownLeft,
                  tone: "finance-income-card",
                },
                {
                  label: "Saídas",
                  value: preview.expense,
                  icon: ArrowUpRight,
                  tone: "finance-expense-card",
                },
                {
                  label: "Saldo do período",
                  value: preview.income - preview.expense,
                  icon: ChartNoAxesColumn,
                  tone:
                    preview.income >= preview.expense
                      ? "finance-income-card"
                      : "finance-expense-card",
                },
              ].map(({ label, value, icon: Icon, tone }) => (
                <div
                  key={label}
                  className={`card stack finance-summary-card ${tone ?? ""}`}
                >
                  <div className="row spread">
                    <span>{label}</span>
                    <Icon size={18} aria-hidden="true" />
                  </div>
                  <strong
                    className={`amount ${value < 0 ? "negative" : tone === "finance-income-card" && value > 0 ? "positive" : ""}`}
                  >
                    {formatMoney(value)}
                  </strong>
                </div>
              ))}
            </div>
            {preview.missing > 0 && (
              <p className="notice" role="status">
                {preview.missing} lançamento(s) com código contábil pendente.
                Confira o caixa e a categoria indicados na tabela.
              </p>
            )}
            {preview.special.length > 0 && (
              <details className="notice">
                <summary>
                  Exportação bloqueada por movimentos sem regra contábil
                </summary>
                <ul>
                  {preview.special.map((s) => (
                    <li key={s.date + s.kind}>
                      {dateLabel(s.date)} · {s.kind} ({s.quantity})
                    </li>
                  ))}
                </ul>
              </details>
            )}
            {preview.rows.length ? (
              <div className="table-scroll">
                <table>
                  <thead>
                    <tr>
                      {[
                        "Data",
                        "Caixa ou conta / Congregação",
                        "Plano de contas",
                        "Débito",
                        "Crédito",
                        "Valor",
                      ].map((c) => (
                        <th key={c}>{c}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {preview.rows.map((r) => (
                      <tr key={r.id}>
                        <td>{dateLabel(r.date)}</td>
                        <td>
                          <strong>{r.box ?? "Sem caixa"}</strong>
                          <small className={styles.detail}>{r.unit}</small>
                        </td>
                        <td>
                          {r.category ?? "Sem categoria"}
                          {r.classification && (
                            <small className={styles.detail}>
                              {r.classification}
                            </small>
                          )}
                          {r.payer && (
                            <small className={styles.detail}>
                              Congregação vinculada · {r.payer}
                            </small>
                          )}
                          {(r.box_issue || r.category_issue) && (
                            <small className={styles.issue}>
                              {[r.box_issue, r.category_issue]
                                .filter(Boolean)
                                .join(" e ")}{" "}
                              pendente
                            </small>
                          )}
                        </td>
                        <td>{r.debit || "—"}</td>
                        <td>{r.credit || "—"}</td>
                        <td>
                          {formatMoney(r.cents)}
                          <small className={styles.detail}>
                            {movement(r.direction)}
                          </small>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p>Nenhum lançamento confirmado no período.</p>
            )}
            <Pager
              page={preview.page}
              total={preview.total}
              size={50}
              go={(p) => consult(filters, p)}
            />
            {(!filters.unit || !filters.box) && (
              <p className="muted">
                Para gerar o CSV, selecione um caixa ou conta.
              </p>
            )}
            {eligible && preview.previous > 0 && (
              <label className={styles.repeat}>
                <input
                  type="checkbox"
                  checked={repeat}
                  onChange={(e) =>
                    setRepeatFingerprint(
                      e.target.checked ? preview.fingerprint : null,
                    )
                  }
                />
                <span>
                  Incluir novamente {preview.previous} lançamento(s) já
                  exportado(s)
                </span>
              </label>
            )}
            <div className="row">
              <Button
                loading={busy}
                disabled={
                  !eligible ||
                  changed ||
                  isPending ||
                  (preview.previous > 0 && !repeat)
                }
                onClick={download}
              >
                <Download size={16} />
                Gerar CSV Alterdata
              </Button>
              <button
                type="button"
                className={styles.historyToggle}
                aria-expanded={Boolean(history)}
                disabled={isPending || busy || changed}
                onClick={() => (history ? setHistory(null) : showHistory(1))}
              >
                {history ? "Fechar consulta" : "Consultar exportações"}
              </button>
            </div>
          </>
        )}
      </section>
      {message && (
        <p className="notice" role="status">
          {message}
        </p>
      )}
      {history && (
        <section className="card stack" aria-label="Exportações da seleção">
          <h2>Exportações da seleção</h2>
          {history.items.length === 0 ? (
            <p>Nenhum lote gerado para a seleção.</p>
          ) : (
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    {[
                      "Geração",
                      "Congregação / Caixa",
                      "Período",
                      "Lançamentos",
                      "Entradas",
                      "Saídas",
                      "Importação",
                    ].map((c) => (
                      <th key={c}>{c}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {history.items.map((h) => (
                    <tr key={h.id}>
                      <td>
                        {new Date(h.created).toLocaleString("pt-BR", {
                          timeZone: "America/Sao_Paulo",
                        })}
                        <small className={styles.detail}>{h.actor}</small>
                      </td>
                      <td>
                        {catalog.units.find((u) => u.id === h.unit)?.name}
                        <small className={styles.detail}>
                          {catalog.boxes.find((b) => b.id === h.box)?.name ||
                            "Conta arquivada"}
                        </small>
                      </td>
                      <td>
                        {dateLabel(h.start)} a {dateLabel(h.end)}
                        <small className={styles.detail}>
                          {movement(h.direction)}
                        </small>
                      </td>
                      <td>
                        {h.count}
                        {h.changed > 0 && (
                          <small className={styles.issue}>
                            {h.changed} alterado(s) ou cancelado(s) após a
                            geração
                          </small>
                        )}
                      </td>
                      <td>{formatMoney(h.income)}</td>
                      <td>{formatMoney(h.expense)}</td>
                      <td>
                        {h.confirmed ? (
                          "Importação confirmada"
                        ) : !canConfirm ? (
                          "Aguardando confirmação"
                        ) : (
                          <Button
                            variant="secondary"
                            disabled={busy || isPending}
                            onClick={() =>
                              start(async () => {
                                const r = await confirmAccountingAction(h.id);
                                setMessage(
                                  r.ok
                                    ? "Importação confirmada pelo usuário."
                                    : r.message,
                                );
                                if (r.ok) showHistory(historyPage);
                              })
                            }
                          >
                            Confirmar importação
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <Pager
            page={historyPage}
            total={history.total}
            size={20}
            go={showHistory}
          />
        </section>
      )}
    </div>
  );
}
