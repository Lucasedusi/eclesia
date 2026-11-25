"use client";

import { useState, useTransition } from "react";
import { Download, Filter, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FinanceSelect } from "./finance-select";
import { FinanceDateField } from "./finance-date-field";
import { useFinanceNavigation } from "./finance-shell";
import { financeLocation } from "../utils/finance-navigation";
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
  exportAccountingAction,
  saveAccountingCodeAction,
} from "../actions/finance-accounting.actions";
import styles from "./finance-accounting.module.css";

type Props = {
  filters: AccountingFilters;
  catalog: AccountingCatalog;
  preview: AccountingPreview;
  history: AccountingHistory | null;
  canConfigure: boolean;
  historyPage: number;
  month: string;
  selected: string;
};

const dateLabel = (iso: string) => iso.split("-").reverse().join("/");
const movement = (value: string) =>
  value === "INCOME" ? "Entrada" : value === "EXPENSE" ? "Saída" : "Todos";

function AccountingCodes({ catalog }: { catalog: AccountingCatalog }) {
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

export function FinanceAccounting({
  filters,
  catalog,
  preview,
  history,
  canConfigure,
  historyPage,
  month,
  selected,
}: Props) {
  const { navigate, refresh, isPending } = useFinanceNavigation();
  const [draft, setDraft] = useState(filters);
  const [repeatFingerprint, setRepeatFingerprint] = useState<string | null>(
    null,
  );
  const repeat = repeatFingerprint === preview.fingerprint;
  const [message, setMessage] = useState("");
  const [busy, start] = useTransition();
  const changed = JSON.stringify(draft) !== JSON.stringify(filters);
  const valid = accountingFilters.safeParse(draft).success;
  function go(f: AccountingFilters, page = 1, h?: number) {
    navigate(
      financeLocation("/financeiro/contabilidade", f.unit ?? selected, month, {
        inicio: f.start,
        fim: f.end,
        movimento: f.direction,
        ...(!f.unit && { escopo: "todas" }),
        ...(f.box && { caixa: f.box }),
        pagina: String(page),
        ...(h && { historico: String(h) }),
      }),
    );
  }
  const eligible =
    filters.unit &&
    filters.box &&
    preview.total > 0 &&
    !preview.missing &&
    !preview.special.length;
  const units = new Map(catalog.units.map((u) => [u.id, u.name]));
  const boxes = new Map(
    catalog.boxes
      .filter((b) => !draft.unit || b.unit === draft.unit)
      .map((b) => [b.id, b]),
  );
  function renderBox(value: string) {
    const box = boxes.get(value);
    if (!box) return "Todos os caixas";
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
    start(async () => {
      const r = await exportAccountingAction(
        filters,
        preview.fingerprint,
        repeat,
      );
      if (!r.ok) {
        setMessage(r.message);
        refresh();
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
      setMessage(
        "Arquivo gerado. Após conferir no Alterdata, use Consultar exportações para confirmar a importação.",
      );
      setRepeatFingerprint(null);
      refresh();
    });
  }
  return (
    <div className="stack">
      <header className="finance-page-header">
        <h1>Contabilidade</h1>
      </header>
      {canConfigure && <AccountingCodes catalog={catalog} />}
      <form
        className={`card ${styles.filters} ${styles.searchFilters}`}
        onSubmit={(e) => {
          e.preventDefault();
          if (valid) go(draft);
        }}
      >
        <FinanceSelect
          label="Congregação"
          value={draft.unit ?? ""}
          onChange={(e) =>
            setDraft({ ...draft, unit: e.target.value || null, box: null })
          }
        >
          <option value="">Todas as autorizadas</option>
          {catalog.units.map((u) => (
            <option value={u.id} key={u.id}>
              {u.name}
            </option>
          ))}
        </FinanceSelect>
        <FinanceSelect
          label="Caixa ou conta"
          fieldClassName={styles.boxField}
          popupWidth={540}
          renderValue={renderBox}
          value={draft.box ?? ""}
          onChange={(e) => setDraft({ ...draft, box: e.target.value || null })}
        >
          <option value="">Todos os caixas</option>
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
        <FinanceDateField
          label="Data inicial"
          withCalendar
          value={draft.start}
          max={draft.end || undefined}
          onChange={(start) => setDraft({ ...draft, start })}
        />
        <FinanceDateField
          label="Data final"
          withCalendar
          value={draft.end}
          min={draft.start || undefined}
          onChange={(end) => setDraft({ ...draft, end })}
        />
        <FinanceSelect
          label="Movimento"
          value={draft.direction}
          onChange={(e) =>
            setDraft({
              ...draft,
              direction: e.target.value as AccountingFilters["direction"],
            })
          }
        >
          <option value="ALL">Todos</option>
          <option value="INCOME">Entradas</option>
          <option value="EXPENSE">Saídas</option>
        </FinanceSelect>
        <Button type="submit" disabled={!valid || isPending || busy}>
          <Filter size={16} />
          Aplicar filtros
        </Button>
      </form>
      <section
        className={`card stack ${styles.preview}`}
        aria-label="Prévia contábil"
      >
        <div className="row spread">
          <h2>Prévia contábil</h2>
          <span className="muted">{preview.total} lançamentos confirmados</span>
        </div>
        <div className={styles.totals}>
          <span>
            Entradas <strong>{formatMoney(preview.income)}</strong>
          </span>
          <span>
            Saídas <strong>{formatMoney(preview.expense)}</strong>
          </span>
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
                    "Congregação / Caixa",
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
                      {r.unit}
                      <small className={styles.detail}>
                        {r.box ?? "Sem caixa"}
                      </small>
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
          go={(p) => go(filters, p, history ? historyPage : undefined)}
        />
        {(!filters.unit || !filters.box) && (
          <p className="muted">
            Para gerar o CSV, selecione uma congregação e um caixa ou conta.
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
            Incluir novamente {preview.previous} lançamento(s) já exportado(s)
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
            disabled={isPending}
            onClick={() => go(filters, preview.page, history ? undefined : 1)}
          >
            {history ? "Fechar consulta" : "Consultar exportações"}
          </button>
        </div>
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
                                refresh();
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
            go={(p) => go(filters, preview.page, p)}
          />
        </section>
      )}
    </div>
  );
}
