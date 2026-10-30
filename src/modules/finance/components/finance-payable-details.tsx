"use client";
import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { useFinanceDirtyGuard } from "./finance-shell";
import { usePayableMutation } from "../hooks/use-payable-mutation";
import { formatMoney } from "../utils/finance-money";
import { todayLocal } from "../utils/finance-period";
import { payableStatus, payableStatusLabels } from "../utils/finance-payables";
import type { PayableRow, PayableDetail } from "../types/finance-payable.types";
export const payableDate = (date: string) => date.split("-").reverse().join("/");
const historyLabels = { CREATE: "Conta cadastrada", COPY: "Conta copiada", UPDATE: "Conta editada", PAY: "Pagamento confirmado", REOPEN: "Confirmação desfeita", DELETE: "Conta excluída" };
export function FinancePayableDetails({ detail, onClose, onReopen }: { detail: PayableDetail; onClose: () => void; onReopen: () => void }) {
  const item = detail.item;
  return <Modal title="Detalhes da conta" className="finance-secondary-drawer" onClose={onClose} footer={<><Button variant="outline" onClick={onClose}>Fechar</Button>{item.status === "PAID" && <Button onClick={onReopen}>Desfazer confirmação</Button>}</>}>
    <div className="stack finance-payable-detail"><h2>{item.name}</h2><p>{item.categoryName} · {payableStatusLabels[payableStatus(item.status, item.dueDate, todayLocal())]}</p>
      <dl className="grid"><div><dt>Vencimento</dt><dd>{payableDate(item.dueDate)}</dd></div><div><dt>Valor</dt><dd>{item.amountCents === null ? "Não informado" : formatMoney(item.amountCents)}</dd></div>
      {item.paidDate && <div><dt>Data do pagamento</dt><dd>{payableDate(item.paidDate)}</dd></div>}</dl>
      {item.notes && <p>{item.notes}</p>}<h3>Histórico</h3>
      {detail.history.map((event) => <article key={event.id} className="card stack"><strong>{historyLabels[event.action]}</strong>
        <span className="muted">{event.actorName} · {new Date(event.at).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}</span>
        {event.reason && <p>{event.reason}</p>}
        {event.action === "PAY" && typeof event.after.paidDate === "string" && <p>Pagamento em {payableDate(event.after.paidDate)}</p>}
        {event.action === "UPDATE" && <ul>{([ ["name", "Nome"], ["categoryName", "Categoria"], ["dueDate", "Vencimento"], ["amountCents", "Valor"], ["notes", "Observação"] ] as const).filter(([key]) => event.before?.[key] !== event.after[key]).map(([key, label]) => {
          const display = (value: unknown) => key === "amountCents" ? typeof value === "number" ? formatMoney(value) : "Não informado" : key === "dueDate" && typeof value === "string" ? payableDate(value) : String(value || "—");
          return <li key={key}>{label}: {display(event.before?.[key])} → {display(event.after[key])}</li>;
        })}</ul>}
      </article>)}
    </div>
  </Modal>;
}
export function FinancePayableConfirmation({ kind, item, onClose, onSaved }: { kind: "PAY" | "REOPEN" | "DELETE"; item: PayableRow; onClose: () => void; onSaved: () => void }) {
  const form = useRef<HTMLFormElement>(null), [paidDate, setPaidDate] = useState(todayLocal()), [reason, setReason] = useState(""), [dirty, setDirty] = useState(false);
  const mutation = usePayableMutation(onSaved);
  const title = kind === "PAY" ? "Confirmar pagamento" : kind === "REOPEN" ? "Desfazer confirmação" : "Excluir conta";
  async function save() {
    if (!mutation.uncertain && !form.current?.reportValidity()) return false;
    return mutation.run({ kind, id: item.id, revision: item.revision, ...(kind === "PAY" ? { paidDate } : kind === "REOPEN" ? { reason } : {}) });
  }
  function close() {
    if (mutation.busy) return;
    if ((!dirty && !mutation.uncertain) || window.confirm(mutation.uncertain ? "A confirmação ainda está pendente. Confira a lista antes de tentar novamente." : "Descartar o preenchimento desta confirmação?")) onClose();
  }
  useFinanceDirtyGuard(dirty || mutation.uncertain, save, onClose);
  return <Modal title={title} className="finance-secondary-drawer" busy={mutation.busy} onClose={close}
    footer={<><Button variant="outline" onClick={close} disabled={mutation.busy}>Cancelar</Button><Button variant={kind === "DELETE" ? "danger" : "primary"} loading={mutation.busy} onClick={() => void save()}>{mutation.uncertain ? "Conferir gravação" : title}</Button></>}>
    <form ref={form} className="stack" onChange={() => setDirty(true)} onSubmit={(e) => { e.preventDefault(); void save(); }}>
      <strong>{item.name}</strong><p>Vencimento em {payableDate(item.dueDate)} · {item.amountCents === null ? "Valor não informado" : formatMoney(item.amountCents)}</p>
      {mutation.error && <p role="alert">{mutation.error}</p>}
      <fieldset className="finance-payable-fields stack" disabled={mutation.busy || mutation.uncertain}>
        {kind === "PAY" && <><label>Data do pagamento<input type="date" required min="2000-01-01" max={todayLocal()} value={paidDate} onChange={(e) => setPaidDate(e.target.value)} /></label><p className="notice">Esta confirmação não registra uma saída financeira.</p></>}
        {kind === "REOPEN" && <label>Justificativa<textarea required minLength={5} maxLength={1000} value={reason} onChange={(e) => setReason(e.target.value)} /></label>}
        {kind === "DELETE" && <p>A conta será removida da lista. Seu histórico será preservado.</p>}
      </fieldset>
    </form>
  </Modal>;
}
