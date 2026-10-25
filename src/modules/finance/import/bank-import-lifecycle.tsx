"use client";
import { useRef, useState } from "react";
import { Trash2, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { useFinanceNavigation } from "../components/finance-shell";
import { manageBankImportAction } from "./actions";
import type { BankImportLifecycle } from "./schemas";

type Target =
  | Omit<
      Extract<BankImportLifecycle, { action: "DELETE_BATCH" }>,
      "operationKey"
    >
  | Omit<
      Extract<BankImportLifecycle, { action: "DELETE_ITEM" | "RESTORE_ITEM" }>,
      "operationKey"
    >;
export function BankImportLifecycleButton({
  target,
  disabled = false,
  label,
}: {
  target: Target;
  disabled?: boolean;
  label: string;
}) {
  const navigation = useFinanceNavigation();
  const [open, setOpen] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const attempt = useRef<BankImportLifecycle | null>(null);
  const restoring = target.action === "RESTORE_ITEM",
    batch = target.action === "DELETE_BATCH";
  const title = restoring
    ? "Restaurar item"
    : batch
      ? "Excluir importação"
      : "Excluir item";
  async function confirm() {
    if (busy) return;
    attempt.current ??= { ...target, operationKey: crypto.randomUUID() };
    setBusy(true);
    setError("");
    try {
      const result = await manageBankImportAction(attempt.current);
      if (!result.ok) {
        setError(result.message);
        if (result.code !== "UNAVAILABLE") attempt.current = null;
        return;
      }
      attempt.current = null;
      setOpen(false);
      navigation.refresh();
    } catch {
      setError(
        "A resposta não chegou. Tente novamente para conferir a mesma operação.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <Button
        size="sm"
        variant="ghost"
        aria-label={label}
        title={
          disabled
            ? "Possui histórico financeiro e não pode ser excluído"
            : label
        }
        disabled={disabled}
        onClick={() => setOpen(true)}
      >
        {restoring ? <RotateCcw size={16} /> : <Trash2 size={16} />}
        <span>{restoring ? "Restaurar" : "Excluir"}</span>
      </Button>
      <Modal
        open={open}
        title={title}
        size="sm"
        busy={busy}
        onClose={() => !busy && setOpen(false)}
        description={
          restoring
            ? "O item voltará à conferência e aos totais considerados."
            : batch
              ? "Esta importação sairá da listagem. Seu histórico será preservado. Você poderá enviar o arquivo novamente."
              : "O item sairá da conferência e dos totais considerados. Você poderá recuperá-lo pelo filtro Excluídos."
        }
        footer={
          <>
            <Button
              variant="outline"
              disabled={busy}
              onClick={() => setOpen(false)}
            >
              Voltar
            </Button>
            <Button
              variant={restoring ? "primary" : "danger"}
              loading={busy}
              onClick={() => void confirm()}
            >
              {title}
            </Button>
          </>
        }
      >
        {error && <p role="alert">{error}</p>}
      </Modal>
    </>
  );
}
