"use client";
import {
  ArrowDownLeft,
  ArrowUpRight,
  List,
  ListChecks,
  CheckCheck,
  ClipboardCheck,
  ChevronLeft,
  ChevronRight,
  Clock3,
} from "lucide-react";
import { BankImportLifecycleButton } from "./bank-import-lifecycle";
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
              {batch.cashboxName} · {batch.fileName} · {batch.total}{" "}
              {batch.total === 1 ? "movimento" : "movimentos"}
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
            <List size={16} /> Todas as importações
          </Button>
        </header>
        <div className="bank-import-summary">
          <section className="bank-import-card bank-import-metric">
            <div>
              <span>Entradas consideradas</span>
              <ArrowDownLeft size={22} />
            </div>
            <strong>{formatMoney(batch.incomeCents)}</strong>
            <small>Movimentos incluídos na conferência</small>
          </section>
          <section className="bank-import-card bank-import-metric is-expense">
            <div>
              <span>Saídas consideradas</span>
              <ArrowUpRight size={22} />
            </div>
            <strong>{formatMoney(batch.expenseCents)}</strong>
            <small>Movimentos incluídos na conferência</small>
          </section>
          <section className="bank-import-card bank-import-metric is-progress">
            <div>
              <span>Conferência</span>
              <ListChecks size={22} />
            </div>
            <strong>
              {counts.completed}/{counts.total}
            </strong>
            <small>Movimentos concluídos</small>
          </section>
        </div>
        <div
          className="bank-import-card bank-import-counts"
          aria-label="Situação da conferência"
        >
          <span>
            <Clock3 size={16} /> <strong>{counts.pending}</strong> pendente(s)
          </span>
          <span>
            <CheckCheck size={16} /> <strong>{counts.completed}</strong>{" "}
            concluído(s)
          </span>
          <span>
            <List size={16} /> <strong>{counts.ignored}</strong> ignorado(s)
          </span>
        </div>
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
                  <option value="DELETED">Excluídos</option>
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
                          <span
                            className={`bank-import-status status-${i.deleted ? "DELETED" : i.status}`}
                          >
                            {i.deleted
                              ? "Excluído"
                              : bankImportStatus[i.status]}
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
                          {!i.deleted && (
                            <Button
                              size="sm"
                              variant="outline"
                              aria-label={`Conferir linha ${i.rowNumber}`}
                              onClick={() => setSelected(i)}
                            >
                              <ClipboardCheck size={14} /> Conferir
                            </Button>
                          )}
                          <BankImportLifecycleButton
                            label={`${i.deleted ? "Restaurar" : "Excluir"} linha ${i.rowNumber}`}
                            disabled={!i.canDelete}
                            target={{
                              unit,
                              batchId: batch.id,
                              itemId: i.id,
                              revision: i.revision,
                              action: i.deleted
                                ? "RESTORE_ITEM"
                                : "DELETE_ITEM",
                            }}
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {workspace.pageCount > 1 && (
              <nav
                className="bank-import-pagination"
                aria-label="Páginas do extrato"
              >
                <span className="muted">
                  Página {workspace.page} de {workspace.pageCount}
                </span>
                <div className="row">
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={workspace.page <= 1}
                    onClick={() =>
                      navigation.navigate(
                        filterURL({ page: workspace.page - 1 }),
                      )
                    }
                  >
                    <ChevronLeft size={16} /> Anterior
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={workspace.page >= workspace.pageCount}
                    onClick={() =>
                      navigation.navigate(
                        filterURL({ page: workspace.page + 1 }),
                      )
                    }
                  >
                    Próxima <ChevronRight size={16} />
                  </Button>
                </div>
              </nav>
            )}
          </section>
        )}
      </div>
    </BankImportLayout>
  );
}
