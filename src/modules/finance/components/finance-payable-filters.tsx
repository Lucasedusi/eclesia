"use client";
import { useRef, useState } from "react";
import { Funnel, Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { PayableQuery } from "../types/finance-payable.types";
import type { FinanceCatalogs } from "../types/finance-catalog.types";

export function FinancePayableFilters({ query, categories, busy, onApply }: {
  query: PayableQuery;
  categories: FinanceCatalogs["categories"];
  busy: boolean;
  onApply: (changes: Record<string, string | undefined>) => void;
}) {
  const [search, setSearch] = useState(query.search);
  const input = useRef<HTMLInputElement>(null);
  return <form onSubmit={(event) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    onApply({ search: String(data.get("search") || ""), categoryId: String(data.get("categoryId") || ""),
      dueStatus: query.status === "PAID" ? query.dueStatus : String(data.get("dueStatus") || "ALL") });
  }}>
    <fieldset className="finance-payable-fields finance-payable-filters" disabled={busy}>
      <label>Buscar<span className="finance-search-input">
        <input ref={input} role="searchbox" aria-label="Buscar pelo nome" name="search" value={search} onChange={(e) => setSearch(e.target.value)} maxLength={120} placeholder="Nome da conta" />
        {busy ? <span className="finance-search-loading" role="status" aria-label="Buscando contas"><Loader2 size={16} className="finance-spin" aria-hidden="true" /></span> : search && <button type="button" className="finance-clear-search" aria-label="Limpar busca" onClick={() => { setSearch(""); onApply({ search: undefined }); input.current?.focus(); }}><X size={15} aria-hidden="true" /></button>}
      </span></label>
      <label>Mês do vencimento<input type="month" min="2000-01" max="2099-12" value={query.month} onChange={(e) => { if (e.target.value) onApply({ mes: e.target.value, dateFrom: undefined, dateTo: undefined }); }} /></label>
      <label>Categoria<select name="categoryId" defaultValue={query.categoryId ?? ""}><option value="">Todas as categorias</option>{categories.filter((c) => c.direction !== "INCOME").map((c) => <option key={c.id} value={c.id}>{c.name}{c.status !== "ACTIVE" ? " (inativa)" : ""}</option>)}</select></label>
      <label>Situação<select name="dueStatus" disabled={busy || query.status === "PAID"} defaultValue={query.status === "PAID" ? "PAID" : query.dueStatus}>
        {query.status === "PAID" ? <option value="PAID">Pagas</option> : <><option value="ALL">Todas</option><option value="OVERDUE">Em atraso</option><option value="TODAY">Vence hoje</option><option value="UPCOMING">A vencer</option></>}
      </select></label>
      <Button type="submit" variant="outline" className="finance-icon-button" disabled={busy} aria-label="Filtrar" title="Filtrar"><Funnel size={18} aria-hidden="true" /></Button>
    </fieldset>
    {(query.search || query.categoryId || query.dueStatus !== "ALL" || query.dateFrom) && <div className="finance-payable-filter-reset"><Button variant="outline" disabled={busy} onClick={() => onApply({ search: undefined, categoryId: undefined, dueStatus: undefined, dateFrom: undefined, dateTo: undefined })}><X size={15} />Limpar filtros</Button></div>}
  </form>;
}
