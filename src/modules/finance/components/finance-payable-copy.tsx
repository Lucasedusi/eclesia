"use client";
import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { queryFinancePayablesAction } from "../actions/finance-payable.actions";
import { usePayableMutation } from "../hooks/use-payable-mutation";
import { nextPayableDate, shiftPayableDate } from "../utils/finance-payables";
import { formatFinanceMonth, monthRange } from "../utils/finance-period";
import { parseMoneyInput } from "../utils/finance-money";
import type { PayablePage, PayableRow, PayableResult } from "../types/finance-payable.types";
import type { Category } from "../types/finance-catalog.types";
import { FinanceMoneyInput } from "./finance-money-input";
import { useFinanceDirtyGuard } from "./finance-shell";
import { payableDate } from "./finance-payable-details";

type CopyDraft = { item: PayableRow; dueDate: string; categoryId: string; amount: string };
export function FinancePayableCopy({ initial, month, categories, onClose, onSaved }: {
  initial: PayablePage; month: string; categories: Category[]; onClose: (reconcile?: boolean) => void; onSaved: (result: PayableResult) => void;
}) {
  const [data, setData] = useState(initial), [selected, setSelected] = useState<Record<string, CopyDraft>>({}),
    [review, setReview] = useState(false), [loading, setLoading] = useState(false), [error, setError] = useState("");
  const form = useRef<HTMLFormElement>(null), mutation = usePayableMutation(onSaved);
  const target = nextPayableDate(`${month}-01`).slice(0, 7), drafts = Object.values(selected);
  async function page(number: number) {
    setLoading(true); setError("");
    try {
      const result = await queryFinancePayablesAction({ month, status: "ALL", page: number });
      if (result.ok) setData(result.data); else setError(result.message);
    } catch { setError("Não foi possível carregar as contas. Tente novamente."); }
    finally { setLoading(false); }
  }
  async function save() {
    if (!review || !drafts.length) { setError("Selecione as contas e confira as cópias antes de salvar."); return false; }
    if (!mutation.uncertain && !form.current?.reportValidity()) return false;
    return mutation.run({ kind: "COPY", sourceMonth: month, items: drafts.map((d) => ({ sourceId: d.item.id, revision: d.item.revision,
      categoryId: d.categoryId, dueDate: d.dueDate, amountCents: d.amount ? parseMoneyInput(d.amount) : null })) });
  }
  function close() {
    if (!drafts.length || window.confirm("Fechar a conferência das cópias? Se houve falha de conexão, confira a lista antes de repetir.")) onClose(mutation.needsRefresh);
  }
  useFinanceDirtyGuard(drafts.length > 0, save, () => onClose(mutation.needsRefresh));
  function update(id: string, values: Partial<CopyDraft>) { setSelected((all) => ({ ...all, [id]: { ...all[id], ...values } })); }
  return <Modal title="Copiar para o próximo mês" className="finance-secondary-drawer finance-payable-copy" size="lg" busy={loading || mutation.busy} onClose={close}
    footer={<><Button variant="outline" onClick={close} disabled={mutation.busy}>Fechar</Button>{review && !mutation.uncertain && <Button variant="outline" disabled={mutation.busy} onClick={() => setReview(false)}>Voltar à seleção</Button>}
      <Button loading={mutation.busy} disabled={!drafts.length || loading} onClick={() => review ? void save() : setReview(true)}>{mutation.uncertain ? "Conferir gravação" : review ? "Salvar cópias" : "Conferir cópias"}</Button></>}>
    <div className="stack"><p>De {formatFinanceMonth(month, true)} para <strong>{formatFinanceMonth(target, true)}</strong>. As novas contas começarão pendentes.</p>
      {(error || mutation.error) && <p role="alert">{error || mutation.error}</p>}
      {!review ? <><p>{drafts.length} selecionada(s), até 100 por vez.</p><div className="stack" aria-busy={loading}>
        {data.items.map((item) => <label className="finance-payable-copy-choice" key={item.id}>
          <input type="checkbox" aria-label={item.name} disabled={loading || item.copiedNextMonth || (!selected[item.id] && drafts.length >= 100)} checked={Boolean(selected[item.id])} onChange={(e) => {
            const checked = e.target.checked;
            setSelected((all) => {
              const next = { ...all };
              if (checked) next[item.id] = { item, dueDate: nextPayableDate(item.dueDate), categoryId: item.categoryId, amount: item.amountCents === null ? "" : (item.amountCents / 100).toFixed(2).replace(".", ",") };
              else delete next[item.id];
              return next;
            });
          }} /><span><strong>{item.name}</strong><small>{payableDate(item.dueDate)} · {item.categoryName}{item.copiedNextMonth ? " · Já copiada" : ""}</small></span></label>)}
        {!data.items.length && <p className="muted">Nenhuma conta neste mês.</p>}
      </div><nav className="finance-payable-copy-pagination" aria-label="Páginas das contas para copiar"><Button size="sm" variant="outline" disabled={loading || data.page <= 1} onClick={() => void page(data.page - 1)}>Anterior</Button><span>Página {data.page} de {Math.max(1, Math.ceil(data.count / 20))}</span><Button size="sm" variant="outline" disabled={loading || data.page * 20 >= data.count} onClick={() => void page(data.page + 1)}>Próxima</Button></nav></> :
      <form ref={form} className="stack" onSubmit={(e) => { e.preventDefault(); void save(); }}><fieldset className="finance-payable-fields stack" disabled={mutation.busy || mutation.uncertain}>
        {drafts.map((draft) => <article className="card stack" key={draft.item.id}><strong>{draft.item.name}</strong>
          <div className="grid"><label>Vencimento<input aria-label={`Vencimento: ${draft.item.name}`} type="date" min={`${target}-01`} max={shiftPayableDate(monthRange(target).end, -1)} value={draft.dueDate} required onChange={(e) => update(draft.item.id, { dueDate: e.target.value })} /></label>
          <label>Valor (R$)<FinanceMoneyInput aria-label={`Valor: ${draft.item.name}`} value={draft.amount} onChange={(e) => update(draft.item.id, { amount: e.target.value })} placeholder="Não informado" /></label></div>
          {draft.item.dueDate.slice(8) !== nextPayableDate(draft.item.dueDate).slice(8) && <small className="muted">Vencimento ajustado para o último dia do mês.</small>}
          <label>Categoria<select aria-label={`Categoria: ${draft.item.name}`} value={draft.categoryId} required onChange={(e) => update(draft.item.id, { categoryId: e.target.value })}>
            <option value="">Selecione uma categoria ativa</option>{categories.filter((c) => c.status === "ACTIVE" && c.direction !== "INCOME").map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select></label>
        </article>)}
      </fieldset></form>}
    </div>
  </Modal>;
}
