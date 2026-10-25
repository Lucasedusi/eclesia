"use client";
import { useId, useLayoutEffect, useRef, useState } from "react";
import { MoreVertical, Trash2, RotateCcw } from "lucide-react";
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
  const menuId = useId(),
    menu = useRef<HTMLDivElement>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [position, setPosition] = useState({ top: 0, left: 0 });
  useLayoutEffect(() => {
    const popover = menu.current;
    return () => {
      popover?.hidePopover();
      setMenuOpen(false);
      setOpen(false);
      setError("");
    };
  }, []);
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
      {batch ? (
        <>
          <Button
            size="sm"
            variant="ghost"
            aria-label="Ações da importação"
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            popoverTarget={menuId}
            onClick={(event) => {
              const rect = event.currentTarget.getBoundingClientRect();
              setPosition({
                top: Math.min(rect.bottom + 4, window.innerHeight - 72),
                left: Math.max(
                  8,
                  Math.min(rect.right - 220, window.innerWidth - 228),
                ),
              });
            }}
          >
            <MoreVertical size={16} />
          </Button>
          <div
            id={menuId}
            ref={menu}
            popover="auto"
            role="menu"
            aria-label="Ações da importação"
            className="bank-import-menu"
            style={position}
            onToggle={(event) => {
              const shown = event.newState === "open";
              setMenuOpen(shown);
              if (shown)
                menu.current
                  ?.querySelector<HTMLButtonElement>("button:not(:disabled)")
                  ?.focus();
            }}
          >
            <Button
              role="menuitem"
              size="sm"
              variant="ghost"
              disabled={disabled}
              title={
                disabled
                  ? "Possui histórico financeiro e não pode ser excluído"
                  : label
              }
              onClick={() => {
                menu.current?.hidePopover();
                setOpen(true);
              }}
            >
              <Trash2 size={16} /> Excluir importação
            </Button>
          </div>
        </>
      ) : (
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
      )}
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
