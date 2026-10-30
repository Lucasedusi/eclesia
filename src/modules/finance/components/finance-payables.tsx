"use client";
import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Ellipsis, Loader2, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useFinanceNavigation } from "./finance-shell";
import { getFinancePayableAction, queryFinancePayablesAction } from "../actions/finance-payable.actions";
import { payableStatus, payableStatusLabels } from "../utils/finance-payables";
import { todayLocal, formatFinanceDateRange } from "../utils/finance-period";
import { formatMoney } from "../utils/finance-money";
import type { PayablePage, PayableQuery, PayableRow, PayableDetail } from "../types/finance-payable.types";
import type { FinanceCatalogs } from "../types/finance-catalog.types";
import { FinancePayableFilters } from "./finance-payable-filters";
import { FinancePayableForm } from "./finance-payable-form";
import { FinancePayableConfirmation, FinancePayableDetails, payableDate } from "./finance-payable-details";
import { FinancePayableCopy } from "./finance-payable-copy";

type Dialog = { kind: "CREATE" } | { kind: "EDIT" | "PAY" | "REOPEN" | "DELETE"; item: PayableRow } | { kind: "DETAIL"; detail: PayableDetail } | { kind: "COPY"; initial: PayablePage };
export function FinancePayables({ result, query, catalogs, canCreateCategory }: {
  result: PayablePage; query: PayableQuery; catalogs: FinanceCatalogs; canCreateCategory: boolean;
}) {
  const navigation = useFinanceNavigation(), searchParams = useSearchParams(), sequence = useRef(0);
  const [dialog, setDialog] = useState<Dialog | null>(null), [loading, setLoading] = useState<string | null>(null),
    [error, setError] = useState(""), [notice, setNotice] = useState(""), [menu, setMenu] = useState<string | null>(null);
  useEffect(() => {
    let last = result.today;
    const check = () => { const current = todayLocal(); if (current !== last) { last = current; navigation.refresh(); } };
    const id = window.setInterval(check, 30_000);
    window.addEventListener("focus", check);
    document.addEventListener("visibilitychange", check);
    return () => { window.clearInterval(id); window.removeEventListener("focus", check); document.removeEventListener("visibilitychange", check); };
  }, [result.today, navigation]);
  function go(changes: Record<string, string | undefined>) {
    const params = new URLSearchParams(searchParams);
    params.set("mes", query.month); params.delete("page");
    for (const [key, value] of Object.entries(changes)) { if (value) params.set(key, value); else params.delete(key); }
    setMenu(null); setError(""); navigation.navigate(`/financeiro/contas-a-pagar?${params}`);
  }
  function closeDialog(reconcile = false) { setDialog(null); if (reconcile) navigation.refresh(); }
  function saved(message = "Conta atualizada.") { setDialog(null); setNotice(message); setError(""); navigation.refresh(); }
  async function details(item: PayableRow) {
    const ticket = ++sequence.current; setLoading(item.id); setError("");
    try { const response = await getFinancePayableAction(item.id);
      if (ticket !== sequence.current) return;
      if (response.ok) setDialog({ kind: "DETAIL", detail: response.data }); else setError(response.message);
    } catch { setError("Não foi possível carregar os detalhes. Tente novamente."); }
    finally { if (ticket === sequence.current) setLoading(null); }
  }
  async function copy() {
    setLoading("copy"); setError("");
    try { const response = await queryFinancePayablesAction({ month: query.month, status: "ALL" });
      if (response.ok) setDialog({ kind: "COPY", initial: response.data }); else setError(response.message);
    } catch { setError("Não foi possível carregar as contas. Tente novamente."); } finally { setLoading(null); }
  }
  return <div className="stack finance-payables">
    <div className="row spread finance-payables-heading"><div><h1>Contas a pagar</h1><p className="muted">Organize os vencimentos e acompanhe as confirmações de pagamento.</p></div>
      <div className="row finance-payable-heading-actions">{!query.dateFrom && query.month !== "2099-12" && <Button variant="outline" disabled={navigation.isPending} loading={loading === "copy"} onClick={() => void copy()}>Copiar para o próximo mês</Button>}
      <Button disabled={navigation.isPending} onClick={() => { setNotice(""); setDialog({ kind: "CREATE" }); }}><Plus size={18} />Nova conta</Button></div></div>
    {notice && <p className="notice" role="status">{notice}</p>}{error && <p role="alert">{error}</p>}
    {result.previousOverdue.count > 0 && <aside className="notice row spread"><span><strong>{result.previousOverdue.count} conta(s) vencida(s) de períodos anteriores</strong><br /><small>Fora da lista atual, independentemente da busca e da categoria.</small></span>
      <Button variant="outline" onClick={() => go({ status: "PENDING", search: undefined, categoryId: undefined, dueStatus: "OVERDUE", dateFrom: result.previousOverdue.firstDate!, dateTo: result.previousOverdue.lastDate! })}>Ver pendências anteriores</Button></aside>}
    <section className="card stack" aria-busy={navigation.isPending}>
      <FinancePayableFilters key={JSON.stringify(query)} query={query} categories={catalogs.categories} busy={navigation.isPending} onApply={go} />
      {query.dateFrom && <div className="row spread finance-payable-range-note"><span className="muted">Pendências de períodos anteriores</span><Button variant="outline" disabled={navigation.isPending} onClick={() => go({ dateFrom: undefined, dateTo: undefined, dueStatus: undefined })}>Voltar ao mês</Button></div>}
      <div className="finance-payable-tabs-bar">
      <div className="tabs" role="tablist" aria-label="Situação das contas">
        {([ ["PENDING", "A pagar", result.pendingCount], ["PAID", "Pagas", result.paidCount] ] as const).map(([status, label, count]) => <button key={status} type="button" disabled={navigation.isPending} role="tab" aria-selected={query.status === status} className={query.status === status ? "active" : ""} onClick={() => go({ status })}>{label} ({count})</button>)}
      </div>
        <span className="badge finance-payable-period">Vencimentos: {formatFinanceDateRange(result.start, result.end)}</span>
      </div>
      {!result.items.length ? <div className="notice">Nenhuma conta encontrada para estes filtros.</div> : <table className="finance-mobile-card-table finance-payable-table">
        <colgroup><col /><col className="finance-payable-date-column" /><col className="finance-payable-amount-column" /><col className="finance-payable-status-column" /><col className="finance-payable-actions-column" /></colgroup>
        <thead><tr><th>Conta</th><th>Vencimento</th><th>Valor</th><th>Situação</th><th>Ações</th></tr></thead>
        <tbody>{result.items.map((item) => {
          const status = payableStatus(item.status, item.dueDate, result.today);
          return <tr key={item.id}><td data-label="Conta"><button className="finance-payable-name" aria-label={`Detalhes: ${item.name}`} onClick={() => void details(item)} disabled={loading === item.id || navigation.isPending}>{item.name}{loading === item.id && <Loader2 size={14} className="finance-spin" />}</button><small className="muted">{item.categoryName}</small></td>
            <td data-label="Vencimento">{payableDate(item.dueDate)}{item.paidDate && <small className="muted">Pago em {payableDate(item.paidDate)}</small>}</td>
            <td data-label="Valor">{item.amountCents === null ? "Não informado" : formatMoney(item.amountCents)}</td>
            <td data-label="Situação"><span className={`badge payable-${status.toLowerCase()}`}>{payableStatusLabels[status]}</span></td>
            <td data-label="Ações"><div className="row finance-payable-row-actions">{item.status === "PENDING" && <Button size="sm" disabled={navigation.isPending} aria-label={`Pagar: ${item.name}`} onClick={() => setDialog({ kind: "PAY", item })}>Pagar</Button>}
              <div className="finance-payable-menu"><Button size="sm" variant="outline" disabled={navigation.isPending} aria-label={`Ações: ${item.name}`} aria-expanded={menu === item.id} onClick={() => setMenu(menu === item.id ? null : item.id)}><Ellipsis size={18} /></Button>
                {menu === item.id && <div className="finance-payable-menu-items" onKeyDown={(e) => { if (e.key === "Escape") setMenu(null); }}>
                  <button disabled={navigation.isPending} onClick={() => { setMenu(null); void details(item); }}>Detalhes</button>
                  {item.status === "PENDING" ? <><button disabled={navigation.isPending} onClick={() => { setMenu(null); setDialog({ kind: "EDIT", item }); }}>Editar</button><button disabled={navigation.isPending} onClick={() => { setMenu(null); setDialog({ kind: "DELETE", item }); }}>Excluir</button></> : <button disabled={navigation.isPending} onClick={() => { setMenu(null); setDialog({ kind: "REOPEN", item }); }}>Desfazer confirmação</button>}
                </div>}
              </div></div></td></tr>;
        })}</tbody>
      </table>}
      <div className="row spread"><span className="muted">{result.count} conta(s) · Página {result.page} de {Math.max(1, Math.ceil(result.count / 20))}</span><div className="row"><Button variant="outline" disabled={navigation.isPending || result.page <= 1} onClick={() => go({ page: String(result.page - 1) })}>Anterior</Button><Button variant="outline" disabled={navigation.isPending || result.page * 20 >= result.count} onClick={() => go({ page: String(result.page + 1) })}>Próxima</Button></div></div>
    </section>
    {(dialog?.kind === "CREATE" || dialog?.kind === "EDIT") && <FinancePayableForm item={dialog.kind === "EDIT" ? dialog.item : undefined} catalogs={catalogs} unit={result.headquartersId} month={query.month} canCreateCategory={canCreateCategory} onClose={closeDialog} onSaved={() => saved("Conta salva.")} />}
    {dialog?.kind === "DETAIL" && <FinancePayableDetails detail={dialog.detail} onClose={() => closeDialog()} onReopen={() => setDialog({ kind: "REOPEN", item: dialog.detail.item })} />}
    {(dialog?.kind === "PAY" || dialog?.kind === "REOPEN" || dialog?.kind === "DELETE") && <FinancePayableConfirmation kind={dialog.kind} item={dialog.item} onClose={closeDialog} onSaved={() => saved()} />}
    {dialog?.kind === "COPY" && <FinancePayableCopy initial={dialog.initial} month={query.month} categories={catalogs.categories} onClose={closeDialog} onSaved={(r) => saved(`${r.created ?? 0} conta(s) copiada(s). ${r.skipped ?? 0} já existia(m) no próximo mês.`)} />}
  </div>;
}
