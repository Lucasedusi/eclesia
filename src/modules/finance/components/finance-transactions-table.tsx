"use client";
import { FinanceEmpty } from "./finance-empty";
import { useFinanceNavigation } from "./finance-shell";
import { FinanceSkeleton } from "./finance-skeleton";
import { Loader2 } from "lucide-react";
import { useRef, useState } from "react";
import { usePathname } from "next/navigation";
import {
  Search,
  ChevronLeft,
  ChevronRight,
  Eye,
  SlidersHorizontal,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import type { FinanceCatalogs } from "../types/finance-catalog.types";
import type {
  FinanceTransactionPage,
  FinanceTransactionDetail,
} from "../types/finance-query.types";
import type { FinanceFilters } from "../validations/finance-query.schemas";
import { formatMoney } from "../utils/finance-money";
import { getFinanceTransactionAction } from "../actions/finance-query.actions";
import { FinanceTransactionDetails } from "./finance-transaction-details";
import { FinanceMobileTransactionCards } from "./finance-mobile-transaction-cards";
export function FinanceTransactionsTable({
  result,
  catalogs,
  unit,
  month,
  filters,
  actions,
  detailActions,
}: {
  result: FinanceTransactionPage;
  catalogs: FinanceCatalogs;
  unit: string;
  month: string;
  filters: FinanceFilters;
  actions?: React.ReactNode;
  detailActions?: (
    t: FinanceTransactionDetail,
    close: () => void,
  ) => React.ReactNode;
}) {
  const { navigate, isPending } = useFinanceNavigation(),
    path = usePathname(),
    sequence = useRef(0),
    [detail, setDetail] = useState<FinanceTransactionDetail | null>(null),
    [error, setError] = useState(""),
    [loading, setLoading] = useState<string | null>(null);
  const [advanced, setAdvanced] = useState(false);
  const filterForm = useRef<HTMLFormElement>(null);
  const advancedFilterCount = [
    filters.status !== "ALL",
    filters.titheClassificationId,
    filters.departmentId,
    filters.categoryId,
    filters.cashboxId,
    filters.paymentMethodId,
    filters.memberId,
  ].filter(Boolean).length;
  const hasActiveFilters =
    advancedFilterCount > 0 || Boolean(filters.search) || filters.direction !== "ALL";
  function filter(data: FormData) {
    const query = new URLSearchParams({ unidade: unit, mes: month });
    for (const [k, v] of data)
      if (typeof v === "string" && v && v !== "ALL") query.set(k, v);
    navigate(`${path}?${query}`);
  }
  function paginate(page: number) {
    const data = new FormData();
    Object.entries(filters).forEach(([k, v]) => {
      if (k !== "month" && v) data.set(k, String(v));
    });
    data.set("page", String(page));
    filter(data);
  }
  async function openDetail(id: string) {
    const request = ++sequence.current;
    setLoading(id);
    setError("");
    try {
      const response = await getFinanceTransactionAction(unit, id);
      if (request !== sequence.current) return;
      if (response.ok) setDetail(response.data);
      else setError(response.message);
    } catch {
      setError("Não foi possível abrir o lançamento.");
    } finally {
      if (request === sequence.current) setLoading(null);
    }
  }
  return (
    <div className="stack">
      <div className="row spread">
        <div>
          <h1>Lançamentos</h1>
          <p className="muted">Entradas e saídas do mês, sempre à mão.</p>
        </div>
        {actions}
      </div>
      <section className="card stack">
        <form
          className="stack"
          ref={filterForm}
          onChange={(e) => {
            if (e.target instanceof HTMLSelectElement)
              filter(new FormData(e.currentTarget));
          }}
          key={JSON.stringify(filters)}
          onSubmit={(e) => {
            e.preventDefault();
            filter(new FormData(e.currentTarget));
          }}
        >
          <div className="row finance-filter-bar">
            <label style={{ flex: 1, minWidth: 200 }}>
              Buscar
              <TransactionSearch
                initialValue={filters.search ?? ""}
                busy={isPending}
                onClear={() => {
                  const data = new FormData(filterForm.current!);
                  data.delete("search");
                  filter(data);
                }}
              />
            </label>
            <Button type="submit" style={{ alignSelf: "end" }}>
              <Search size={16} /> Filtrar
            </Button>
            <Button
              type="button"
              variant="outline"
              aria-expanded={advanced}
              aria-controls="finance-advanced-filters"
              onClick={() => setAdvanced(!advanced)}
              style={{ alignSelf: "end" }}
            >
              <SlidersHorizontal size={16} />
              Filtros avançados
              {advancedFilterCount > 0 && (
                <span className="finance-active-filter-count">
                  {advancedFilterCount} filtro{advancedFilterCount !== 1 ? "s" : ""} ativo{advancedFilterCount !== 1 ? "s" : ""}
                </span>
              )}
            </Button>
          </div>
          <div className="finance-mobile-nature" role="group" aria-label="Filtrar natureza">
            {[
              { label: "Todas", value: "ALL" },
              { label: "Entradas", value: "INCOME" },
              { label: "Saídas", value: "EXPENSE" },
            ].map((option) => (
              <button
                key={option.value}
                type="button"
                aria-pressed={filters.direction === option.value}
                onClick={() => {
                  const data = new FormData(filterForm.current!);
                  data.set("direction", option.value);
                  filter(data);
                }}
              >
                {option.label}
              </button>
            ))}
          </div>
          <div id="finance-advanced-filters" hidden={!advanced}>
            <div className="grid" style={{ marginTop: 6 }}>
              <label className="finance-advanced-direction">
                Natureza
                <select name="direction" defaultValue={filters.direction}>
                  <option value="ALL">Todas</option>
                  <option value="INCOME">Entradas</option>
                  <option value="EXPENSE">Saídas</option>
                </select>
              </label>
              <label>
                Situação
                <select name="status" defaultValue={filters.status}>
                  <option value="ALL">Todas</option>
                  <option value="CONFIRMED">Confirmados</option>
                  <option value="CANCELLED">Cancelados</option>
                </select>
              </label>
              {[
                {
                  name: "titheClassificationId",
                  label: "Classificação do dízimo",
                  items: catalogs.classifications,
                },
                {
                  name: "departmentId",
                  label: "Departamento",
                  items: catalogs.departments,
                },
                {
                  name: "categoryId",
                  label: "Categoria",
                  items: catalogs.categories,
                },
                {
                  name: "cashboxId",
                  label: "Caixa ou conta",
                  items: catalogs.cashboxes,
                },
                {
                  name: "paymentMethodId",
                  label: "Forma de pagamento",
                  items: catalogs.paymentMethods,
                },
              ].map((f) => (
                <label key={f.name}>
                  {f.label}
                  <select
                    name={f.name}
                    defaultValue={filters[f.name as keyof FinanceFilters] ?? ""}
                  >
                    <option value="">Todos</option>
                    {f.items.map((v) => (
                      <option key={v.id} value={v.id}>
                        {v.name}
                        {v.status === "INACTIVE" ? " (inativo)" : ""}
                      </option>
                    ))}
                  </select>
                </label>
              ))}
            </div>
          </div>
          {hasActiveFilters && (
            <div className="row" style={{ justifyContent: "flex-end" }}>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => {
                  filterForm.current?.reset();
                  filter(new FormData());
                }}
              >
                <X size={14} />
                Limpar filtros
              </Button>
            </div>
          )}
        </form>
        <div className="row spread notice finance-filter-totals">
          <span>
            {result.totalCount} resultado{result.totalCount !== 1 ? "s" : ""}
          </span>
          <span>
            Entradas filtradas{" "}
            <strong>{formatMoney(result.filteredIncomeCents)}</strong>
          </span>
          <span>
            Saídas filtradas{" "}
            <strong>{formatMoney(result.filteredExpenseCents)}</strong>
          </span>
        </div>
        {error && <div role="alert">{error}</div>}
        {isPending ? (
          <FinanceSkeleton table />
        ) : result.items.length === 0 ? (
          <FinanceEmpty>
            Nenhum lançamento encontrado. Confira o mês e os filtros
            selecionados.
          </FinanceEmpty>
        ) : (
          <>
            <FinanceMobileTransactionCards
              items={result.items}
              onOpen={openDetail}
            />
            <div className="table-scroll finance-desktop-transactions">
            <table>
              <thead>
                <tr>
                  <th>Lançamento</th>
                  <th>Departamento</th>
                  <th>Data</th>
                  <th>Situação</th>
                  <th style={{ textAlign: "right" }}>Valor</th>
                  <th>
                    <span className="sr-only">Detalhes</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {result.items.map((t) => (
                  <tr
                    key={t.id}
                    className={
                      t.status === "CANCELLED"
                        ? "finance-row-cancelled"
                        : t.direction === "INCOME"
                          ? "finance-row-income"
                          : "finance-row-expense"
                    }
                  >
                    <td>
                      <strong>{t.categoryName || "Lançamento"}</strong>
                      <div className="muted">
                        {t.personName ||
                          t.beneficiaryName ||
                          t.description ||
                          "Coletivo"}
                      </div>
                    </td>
                    <td>
                      {t.departmentName}
                      {t.classificationName && (
                        <div className="muted finance-classification">
                          {t.classificationName}
                        </div>
                      )}
                    </td>
                    <td style={{ whiteSpace: "nowrap" }}>
                      {t.date.split("-").reverse().join("/")}
                    </td>
                    <td>
                      <span className="badge">
                        {t.status === "CANCELLED" ? "Cancelado" : "Confirmado"}
                      </span>
                    </td>
                    <td
                      className={`money ${t.status === "CANCELLED" ? "muted" : t.direction === "INCOME" ? "positive" : "negative"}`}
                      style={{
                        textDecoration:
                          t.status === "CANCELLED" ? "line-through" : undefined,
                      }}
                    >
                      {t.direction === "INCOME" ? "+" : "−"}{" "}
                      {formatMoney(t.amountCents)}
                    </td>
                    <td>
                      <Button
                        variant="outline"
                        size="sm"
                        aria-label={`Detalhes ${t.categoryName} ${t.personName || t.beneficiaryName || ""}`}
                        disabled={loading === t.id}
                        aria-busy={loading === t.id}
                        className="finance-icon-button"
                        onClick={() => openDetail(t.id)}
                      >
                        {loading === t.id ? (
                          <Loader2 size={15} className="finance-spin" />
                        ) : (
                          <Eye size={15} />
                        )}
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
          </>
        )}
        <div className="row spread">
          <span className="muted">
            Página {result.page} de {result.pageCount} · até 20 por página
          </span>
          <div className="row">
            <Button
              variant="outline"
              size="sm"
              disabled={isPending || result.page <= 1}
              onClick={() => paginate(result.page - 1)}
              aria-label="Página anterior"
            >
              <ChevronLeft size={16} />
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={isPending || result.page >= result.pageCount}
              onClick={() => paginate(result.page + 1)}
              aria-label="Próxima página"
            >
              <ChevronRight size={16} />
            </Button>
          </div>
        </div>
      </section>
      {detail && (
        <FinanceTransactionDetails
          transaction={detail}
          catalogs={catalogs}
          unit={unit}
          month={month}
          onClose={() => setDetail(null)}
          actions={detailActions?.(detail, () => setDetail(null))}
        />
      )}
    </div>
  );
}

function TransactionSearch({ initialValue, busy, onClear }: {
  initialValue: string;
  busy: boolean;
  onClear: () => void;
}) {
  const [value, setValue] = useState(initialValue);
  const input = useRef<HTMLInputElement>(null);
  return <span className="finance-search-input">
    <input ref={input} name="search" value={value} onChange={event => setValue(event.target.value)} placeholder="Pessoa, descrição ou documento" maxLength={160} />
    {busy ? <span className="finance-search-loading" role="status" aria-label="Buscando lançamentos"><Loader2 size={16} className="finance-spin" aria-hidden="true" /></span> : value && <button type="button" className="finance-clear-search" aria-label="Limpar busca" onClick={() => {
      setValue("");
      onClear();
      input.current?.focus();
    }}><X size={15} aria-hidden="true" /></button>}
  </span>;
}
