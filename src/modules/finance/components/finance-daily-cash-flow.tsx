"use client";

import { useState, type FormEvent } from "react";
import { ChevronLeft, ChevronRight, SlidersHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FinanceSummaryCards } from "./finance-summary-cards";
import { useFinanceNavigation } from "./finance-shell";
import { FinanceEmpty } from "./finance-empty";
import { formatMoney } from "../utils/finance-money";
import { isLocalDate, shiftCivilDate } from "../utils/finance-period";
import type { DailyCashFlowPage, DailyCashFlowQuery } from "../validations/finance-daily-cash-flow.schemas";

type Row = DailyCashFlowPage["items"][number];
type Filters = Pick<DailyCashFlowQuery, "search" | "direction" | "department" | "category" | "method">;
type Props = { data: DailyCashFlowPage; filters: DailyCashFlowQuery; today: string };
const path = "/financeiro/fluxo-de-caixa";

function MovementAmount({ item }: { item: Row }) {
  const sign = item.sign === "MINUS" ? "−" : item.sign === "PLUS" ? "+" : "";
  const tone = item.sign === "MINUS" ? "negative" : item.sign === "PLUS" ? "positive" : "";
  return <strong className={tone}>{sign}{formatMoney(item.amount)}</strong>;
}

function MovementList({ items, date }: { items: Row[]; date: string }) {
  const formattedDate = date.split("-").reverse().join("/");
  return <>
    <div className="table-scroll finance-daily-table">
      <table>
        <thead><tr><th>Lançamento</th><th>Caixa ou conta</th><th>Departamento</th><th>Data</th><th className="money">Valor</th></tr></thead>
        <tbody>{items.map((item) => <tr key={item.id}>
          <td><strong>{item.title}</strong>{item.detail && <div className="muted">{item.detail}</div>}</td>
          <td>{item.boxName}{item.methodName && <div className="muted">{item.methodName}</div>}</td>
          <td>{item.departmentName ?? "—"}</td><td>{formattedDate}</td>
          <td className="money"><MovementAmount item={item} /></td>
        </tr>)}</tbody>
      </table>
    </div>
    <ul className="finance-daily-mobile-list">{items.map((item) => <li key={item.id}>
      <div className="row spread"><strong>{item.title}</strong><MovementAmount item={item} /></div>
      {item.detail && <div>{item.detail}</div>}
      <div>{[item.boxName, item.methodName].filter(Boolean).join(" · ")}</div>
      <small className="muted">{[item.departmentName, formattedDate].filter(Boolean).join(" · ")}</small>
    </li>)}</ul>
  </>;
}

function MovementFilters({ data, filters, apply, busy }: {
  data: DailyCashFlowPage; filters: Filters; busy: boolean; apply: (values: Filters) => void;
}) {
  const advancedCount = [filters.department, filters.category, filters.method].filter(Boolean).length;
  const [advanced, setAdvanced] = useState(advancedCount > 0);
  const hasFilters = Boolean(advancedCount || filters.search || filters.direction !== "ALL");

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const values = new FormData(event.currentTarget);
    const selected = (name: string) => String(values.get(name) ?? "") || undefined;
    apply({
      search: String(values.get("search") ?? "").trim(),
      direction: values.get("direction") as Filters["direction"],
      department: selected("department"), category: selected("category"), method: selected("method"),
    });
  }

  return <form onSubmit={submit}>
    <fieldset className="finance-daily-filters" disabled={busy}>
      <div className="finance-daily-filterbar">
        <label>Buscar<input type="search" name="search" placeholder="Nome ou descrição" maxLength={160} defaultValue={filters.search} /></label>
        <label>Movimento<select name="direction" defaultValue={filters.direction} onChange={(event) => event.currentTarget.form?.requestSubmit()}>
          <option value="ALL">Todos</option><option value="INCOME">Entradas</option><option value="EXPENSE">Saídas</option>
        </select></label>
        <Button variant="outline" aria-controls="daily-advanced" aria-expanded={advanced} onClick={() => setAdvanced(!advanced)}>
          <SlidersHorizontal size={16} /> Mais filtros{advancedCount ? ` (${advancedCount})` : ""}
        </Button>
        <Button type="submit">Filtrar</Button>
      </div>
      <div id="daily-advanced" className="finance-daily-advanced" hidden={!advanced}>
        {([
          ["department", "Departamento", data.departments, "Todos"],
          ["category", "Categoria", data.categories, "Todas"],
          ["method", "Forma de pagamento", data.methods, "Todas"],
        ] as const).map(([key, label, options, all]) => <label key={key}>{label}
          <select name={key} defaultValue={filters[key] ?? ""}>
            <option value="">{all}</option>{options.map((option) => <option key={option.id} value={option.id}>{option.name}</option>)}
          </select>
        </label>)}
      </div>
      {hasFilters && <Button variant="ghost" size="sm" onClick={() => apply({ search: "", direction: "ALL", department: undefined, category: undefined, method: undefined })}>
        Limpar filtros
      </Button>}
    </fieldset>
  </form>;
}

export function FinanceDailyCashFlow({ data, filters, today }: Props) {
  const { navigate, isPending } = useFinanceNavigation();
  const { summary } = data;
  function update(changes: Partial<DailyCashFlowQuery>) {
    const query = new URLSearchParams();
    for (const [key, value] of Object.entries({ ...filters, page: 1, ...changes })) {
      if (value !== undefined && value !== "" && !(key === "direction" && value === "ALL") && !(key === "page" && value === 1))
        query.set(key, String(value));
    }
    navigate(`${path}?${query}`);
  }
  const pages = Math.max(1, Math.ceil(data.total / 20));
  const filtered = Boolean(filters.search || filters.direction !== "ALL" || filters.department || filters.category || filters.method);
  const previous = shiftCivilDate(filters.date, -1);
  const next = shiftCivilDate(filters.date, 1);
  return <div className="stack finance-daily">
    <header className="finance-daily-heading">
      <div>
        <h1>Fluxo de caixa diário</h1>
        <p className="muted">Acompanhe as entradas, saídas e saldos da Catedral.</p>
      </div>
      <div className="finance-daily-controls">
        <div className="finance-daily-day-actions" role="group" aria-label="Navegar por dia">
          <Button variant="ghost" size="sm" disabled={isPending || filters.date === today} onClick={() => update({ date: today })}>Hoje</Button>
          <Button variant="ghost" size="sm" disabled={isPending || !isLocalDate(previous)} aria-label="Dia anterior" onClick={() => update({ date: previous })}><ChevronLeft size={17} /></Button>
          <Button variant="ghost" size="sm" disabled={isPending || !isLocalDate(next)} aria-label="Próximo dia" onClick={() => update({ date: next })}><ChevronRight size={17} /></Button>
        </div>
        <input className="finance-daily-control" aria-label="Data de movimento" type="date" min="2000-01-01" max="2099-12-31"
          key={filters.date} defaultValue={filters.date} disabled={isPending} onInput={(event) => {
            const date = event.currentTarget.value;
            if (date !== filters.date && isLocalDate(date)) update({ date });
          }} />
        <select className="finance-daily-control" aria-label="Caixa ou conta" value={filters.box ?? ""} disabled={isPending}
          onChange={(event) => update({ box: event.target.value || undefined })}>
          <option value="">Todos os caixas e contas</option>
          {data.cashboxes.map((box) => <option key={box.id} value={box.id}>{box.name}{box.status === "INACTIVE" ? " (inativo)" : ""}</option>)}
        </select>
      </div>
    </header>
    <FinanceSummaryCards daily overview={{ openingCents: summary.opening, closingCents: summary.closing, incomeCents: summary.income, expenseCents: summary.expense }} />
    <section className="card stack">
      <h2>Movimentações do dia</h2>
      <MovementFilters key={JSON.stringify(filters)} data={data} filters={filters} apply={update} busy={isPending} />
      {data.items.length ? <MovementList items={data.items} date={filters.date} /> :
        <FinanceEmpty>{filtered ? "Nenhuma movimentação corresponde aos filtros." : "Nenhuma movimentação nesta data."}</FinanceEmpty>}
      {pages > 1 && <div className="row spread">
        <span className="muted">Página {data.page} de {pages} · {data.total} movimentos</span>
        <div className="row">
          <Button size="sm" variant="outline" aria-label="Página anterior" disabled={isPending || data.page === 1} onClick={() => update({ page: data.page - 1 })}><ChevronLeft size={16} /></Button>
          <Button size="sm" variant="outline" aria-label="Próxima página" disabled={isPending || data.page === pages} onClick={() => update({ page: data.page + 1 })}><ChevronRight size={16} /></Button>
        </div>
      </div>}
    </section>
  </div>;
}
