"use client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useFinanceNavigation } from "../components/finance-shell";
import { financeLocation } from "../utils/finance-navigation";
import { formatMoney } from "../utils/finance-money";
import type { FinanceCapabilities } from "../types/finance.types";
import type { FinanceCatalogs } from "../types/finance-catalog.types";
import type { BankImportItem, BankImportWorkspace as Workspace } from "./types";
import type { BankImportFilters } from "./schemas";
import { BankImportLayout } from "./bank-import.styles";
import { BankImportMobile } from "./bank-import-list";
import { BankImportReview, bankImportStatus } from "./bank-import-review";

export function BankImportWorkspace({
  unit,
  month,
  workspace,
  filters,
  catalogs,
  capabilities,
}: {
  unit: string;
  month: string;
  workspace: Workspace;
  filters: BankImportFilters;
  catalogs: FinanceCatalogs;
  capabilities: FinanceCapabilities;
}) {
  const navigation = useFinanceNavigation(),
    [selected, setSelected] = useState<BankImportItem | null>(null);
  const { batch, counts } = workspace,
    base = financeLocation(
      `/financeiro/lancamentos/importacoes/${batch.id}`,
      unit,
      month,
    );
  function filterURL(patch: Partial<BankImportFilters>) {
    return `${base}&${new URLSearchParams(Object.entries({ ...filters, ...patch }).map(([key, value]) => [key, String(value)]))}`;
  }
  return (
    <BankImportLayout>
      <BankImportMobile unit={unit} month={month} />
      <div className="bank-import-desktop stack">
        <header className="row spread">
          <div>
            <h1>Conferência do extrato</h1>
            <p className="muted">
              {batch.cashboxName} · {batch.fileName} · {batch.total} movimentos
            </p>
          </div>
          <Button
            variant="outline"
            onClick={() =>
              navigation.navigate(
                financeLocation(
                  "/financeiro/lancamentos/importacoes",
                  unit,
                  month,
                ),
              )
            }
          >
            Todas as importações
          </Button>
        </header>
        <section className="bank-import-card stack">
          <div className="bank-import-summary">
            <div>
              <span className="muted">Entradas no arquivo</span>
              <strong>{formatMoney(batch.incomeCents)}</strong>
            </div>
            <div>
              <span className="muted">Saídas no arquivo</span>
              <strong className="bank-import-expense">
                {formatMoney(batch.expenseCents)}
              </strong>
            </div>
            <div>
              <span className="muted">Conferência</span>
              <strong>
                {counts.completed}/{counts.total}
              </strong>
            </div>
          </div>
          <p className="muted">
            {counts.pending} pendente(s) · {counts.completed} concluído(s) ·{" "}
            {counts.ignored} ignorado(s)
          </p>
          <details>
            <summary>Referências de saldo do extrato</summary>
            <div className="stack" style={{ marginTop: 12 }}>
              <p
                className={
                  batch.reconciliation === "MISMATCH"
                    ? "bank-import-warning"
                    : "notice"
                }
              >
                {batch.reconciliation === "MATCHED"
                  ? "Saldos do arquivo conferem."
                  : batch.reconciliation === "MISMATCH"
                    ? "Os movimentos não correspondem à diferença entre os saldos do arquivo. Confira antes de prosseguir."
                    : "Não foi possível conferir um intervalo completo de saldos neste arquivo."}
              </p>
              {batch.balances.map((b, index) => (
                <div className="row spread" key={index}>
                  <span>
                    {b.label} ·{" "}
                    {b.date?.split("-").reverse().join("/") ??
                      "Data indisponível"}
                  </span>
                  <strong>
                    {b.amountCents === null
                      ? "Valor indisponível"
                      : formatMoney(b.amountCents)}
                  </strong>
                </div>
              ))}
              {batch.reconciliationReason && (
                <p>Motivo registrado: {batch.reconciliationReason}</p>
              )}
              <p className="muted">
                Estas referências verificam a leitura do arquivo. O saldo do
                caixa no Eclesias depende dos lançamentos já confirmados.
              </p>
            </div>
          </details>
        </section>
        {selected ? (
          <BankImportReview
            key={selected.id}
            unit={unit}
            month={month}
            batch={batch}
            item={selected}
            catalogs={catalogs}
            capabilities={capabilities}
            onClose={() => setSelected(null)}
            onResult={(item, next) => {
              if (next) {
                const remaining = workspace.items.filter(
                  (i) => i.id !== item.id && i.status === "PENDING",
                );
                setSelected(
                  remaining.find((i) => i.rowNumber > item.rowNumber) ??
                    remaining[0] ??
                    null,
                );
                if (!remaining.length)
                  navigation.navigate(
                    filterURL({ page: 1, status: "PENDING" }),
                  );
              } else setSelected(item);
            }}
          />
        ) : (
          <section className="bank-import-card stack">
            <form
              className="bank-import-filters"
              onSubmit={(e) => {
                e.preventDefault();
                const f = new FormData(e.currentTarget);
                navigation.navigate(
                  filterURL({
                    page: 1,
                    status: f.get("status") as BankImportFilters["status"],
                    direction: f.get(
                      "direction",
                    ) as BankImportFilters["direction"],
                    query: String(f.get("query") ?? ""),
                  }),
                );
              }}
            >
              <label>
                Situação
                <select name="status" defaultValue={filters.status}>
                  <option value="PENDING">Pendentes</option>
                  <option value="COMPLETED">Concluídos</option>
                  <option value="IGNORED">Ignorados</option>
                  <option value="ALL">Todos</option>
                </select>
              </label>
              <label>
                Direção
                <select name="direction" defaultValue={filters.direction}>
                  <option value="ALL">Entradas e saídas</option>
                  <option value="INCOME">Entradas</option>
                  <option value="EXPENSE">Saídas</option>
                </select>
              </label>
              <label>
                Buscar no extrato
                <input
                  name="query"
                  maxLength={100}
                  defaultValue={filters.query}
                  placeholder="Documento, histórico ou complemento"
                />
              </label>
              <Button type="submit" variant="outline">
                Filtrar
              </Button>
            </form>
            {workspace.items.length === 0 ? (
              <p className="notice">
                Nenhum item nesta seleção. Consulte as outras situações ou
                importe outro extrato.
              </p>
            ) : (
              <div className="bank-import-table">
                <table>
                  <thead>
                    <tr>
                      <th>Data</th>
                      <th>Movimento</th>
                      <th>Valor</th>
                      <th>Origem</th>
                      <th>Situação</th>
                      <th>Ação</th>
                    </tr>
                  </thead>
                  <tbody>
                    {workspace.items.map((i) => (
                      <tr key={i.id}>
                        <td>
                          {i.date?.split("-").reverse().join("/") ??
                            "A conferir"}
                        </td>
                        <td>
                          {i.amountCents === null
                            ? "A conferir"
                            : i.amountCents > 0
                              ? "Entrada"
                              : "Saída"}
                        </td>
                        <td
                          className={
                            (i.amountCents ?? 0) < 0
                              ? "bank-import-expense"
                              : ""
                          }
                        >
                          {i.amountCents === null
                            ? i.sourceValue
                            : formatMoney(Math.abs(i.amountCents))}
                        </td>
                        <td>
                          <strong>
                            {i.history || "Linha não reconhecida"}
                          </strong>
                          <span className="bank-import-excerpt">
                            {i.complement.slice(0, 140)}
                            {i.complement.length > 140 ? "…" : ""}
                          </span>
                        </td>
                        <td>
                          <span className="bank-import-status">
                            {bankImportStatus[i.status]}
                          </span>
                          {i.issue && (
                            <p className="bank-import-expense">
                              Conferir leitura
                            </p>
                          )}
                          {i.possibleDuplicate && i.status === "PENDING" && (
                            <p className="bank-import-expense">
                              Possível duplicidade
                            </p>
                          )}
                          {i.stale && (
                            <p className="bank-import-expense">
                              Vínculo a conferir
                            </p>
                          )}
                          {i.changed && !i.stale && (
                            <p className="muted">Alterado após conferência</p>
                          )}
                        </td>
                        <td>
                          <Button
                            size="sm"
                            variant="outline"
                            aria-label={`Conferir linha ${i.rowNumber}`}
                            onClick={() => setSelected(i)}
                          >
                            Conferir
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <div className="row spread">
              <span className="muted">
                Página {workspace.page} de {workspace.pageCount}
              </span>
              <div className="row">
                <Button
                  variant="outline"
                  disabled={workspace.page <= 1}
                  onClick={() =>
                    navigation.navigate(filterURL({ page: workspace.page - 1 }))
                  }
                >
                  Anterior
                </Button>
                <Button
                  variant="outline"
                  disabled={workspace.page >= workspace.pageCount}
                  onClick={() =>
                    navigation.navigate(filterURL({ page: workspace.page + 1 }))
                  }
                >
                  Próxima
                </Button>
              </div>
            </div>
          </section>
        )}
      </div>
    </BankImportLayout>
  );
}
