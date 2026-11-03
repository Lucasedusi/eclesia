"use client";
import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { FinanceMoneyInput } from "./finance-money-input";
import { FinanceCatalogForm } from "./finance-catalog-form";
import { useFinanceDirtyGuard } from "./finance-shell";
import { usePayableMutation } from "../hooks/use-payable-mutation";
import { parseMoneyInput } from "../utils/finance-money";
import type { FinanceCatalogs } from "../types/finance-catalog.types";
import type { PayableRow } from "../types/finance-payable.types";

export function FinancePayableForm({ item, catalogs, unit, month, canCreateCategory, onClose, onSaved }: {
  item?: PayableRow; catalogs: FinanceCatalogs; unit: string; month: string; canCreateCategory: boolean; onClose: (reconcile?: boolean) => void; onSaved: () => void;
}) {
  const form = useRef<HTMLFormElement>(null);
  const [name, setName] = useState(item?.name ?? ""), [categoryId, setCategoryId] = useState(item?.categoryId ?? ""),
    [dueDate, setDueDate] = useState(item?.dueDate ?? `${month}-01`), [notes, setNotes] = useState(item?.notes ?? ""),
    [amount, setAmount] = useState(item?.amountCents == null ? "" : (item.amountCents / 100).toFixed(2).replace(".", ",")),
    [dirty, setDirty] = useState(false), [categoryOpen, setCategoryOpen] = useState(false);
  const mutation = usePayableMutation(() => { setDirty(false); onSaved(); });
  async function save() {
    if (!mutation.uncertain && !form.current?.reportValidity()) return false;
    const values = { name, categoryId, dueDate, amountCents: amount ? parseMoneyInput(amount) : null, notes };
    return mutation.run(item ? { kind: "UPDATE", id: item.id, revision: item.revision, values } : { kind: "CREATE", values });
  }
  function close() {
    if (mutation.busy) return;
    if ((!dirty && !mutation.uncertain) || window.confirm(mutation.uncertain ? "A confirmação ainda está pendente. Ao fechar, confira a lista antes de cadastrar novamente." : "Descartar as alterações desta conta?")) onClose(mutation.needsRefresh);
  }
  useFinanceDirtyGuard((dirty || mutation.uncertain) && !categoryOpen, save, () => onClose(mutation.needsRefresh));
  const categories = catalogs.categories.filter((c) => c.status === "ACTIVE" && c.direction !== "INCOME");
  return <>
    <Modal open={!categoryOpen} title={item ? "Editar conta" : "Nova conta"} className="finance-secondary-drawer" busy={mutation.busy} onClose={close}
      footer={<><Button variant="outline" onClick={close} disabled={mutation.busy}>Cancelar</Button><Button loading={mutation.busy} onClick={() => void save()}>{mutation.uncertain ? "Conferir gravação" : "Salvar conta"}</Button></>}>
      <form ref={form} className="stack" onChange={() => setDirty(true)} onSubmit={(e) => { e.preventDefault(); void save(); }}>
        {mutation.error && <p role="alert">{mutation.error}</p>}
        <fieldset className="finance-payable-fields stack" disabled={mutation.busy || mutation.uncertain}>
          <label>Nome da conta<input required maxLength={120} value={name} onChange={(e) => setName(e.target.value)} autoFocus /></label>
          <label>Categoria<select required value={categoryId} onChange={(e) => setCategoryId(e.target.value)}><option value="">Selecione</option>{categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
          {canCreateCategory && <Button variant="outline" onClick={() => setCategoryOpen(true)}>Nova categoria</Button>}
          <div className="grid"><label>Vencimento<input required type="date" min="2000-01-01" max="2099-12-31" value={dueDate} onChange={(e) => setDueDate(e.target.value)} /></label>
          <label>Valor (R$)<FinanceMoneyInput value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="Não informado" /></label></div>
          <label>Observação<textarea maxLength={1000} rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} /></label>
        </fieldset>
      </form>
    </Modal>
    {categoryOpen && <FinanceCatalogForm entity="CATEGORY" defaultDirection="EXPENSE" unit={unit} month={month} catalogs={catalogs} roles={[]} onClose={() => setCategoryOpen(false)} />}
  </>;
}
