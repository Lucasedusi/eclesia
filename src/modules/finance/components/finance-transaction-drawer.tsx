"use client";
import { useState, type ComponentProps } from "react";
import { Modal } from "@/components/ui/modal";
import { FinanceEntryForm } from "./finance-entry-form";
export function FinanceTransactionDrawer(
  props: ComponentProps<typeof FinanceEntryForm> & { onClose: () => void },
) {
  const [status, setStatus] = useState({ dirty: false, busy: false });
  return (
    <Modal
      title={
        props.initialTransaction
          ? "Corrigir lançamento"
          : props.direction === "EXPENSE"
            ? "Nova saída"
            : "Nova entrada"
      }
      description={<><span className="finance-desktop-only">A confirmação registra o lançamento e atualiza o caixa.</span><span className="finance-mobile-only">A confirmação registra o lançamento.</span></>}
      headerShadowOnScroll
      className="finance-drawer finance-entry-drawer"
      busy={status.busy}
      onClose={() => {
        if (
          !status.busy &&
          (!status.dirty ||
            window.confirm("Descartar as alterações deste lançamento?"))
        )
          props.onClose();
      }}
    >
      <FinanceEntryForm {...props} onStatusChange={setStatus} />
    </Modal>
  );
}
