"use client";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { submitFinanceCommand } from "../actions/finance-command.actions";
export function FinanceCancellationDialog({
  unit,
  id,
  revision,
  kind,
  onClose,
}: {
  unit: string;
  id: string;
  revision: number;
  kind: "CANCEL_TRANSACTION" | "CANCEL_ATTENDANCE" | "CANCEL_TRANSFER";
  onClose: () => void;
}) {
  const [reason, setReason] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [uncertain, setUncertain] = useState(false),
    key = useRef<string | null>(null),
    router = useRouter();
  return (
    <Modal
      title={
        kind === "CANCEL_ATTENDANCE"
          ? "Cancelar todo o atendimento"
          : "Cancelar registro"
      }
      description="O registro permanece no histórico e seu efeito financeiro é revertido."
      busy={busy || uncertain}
      onClose={onClose}
      footer={
        <>
          <Button
            variant="outline"
            disabled={busy || uncertain}
            onClick={onClose}
          >
            Voltar
          </Button>
          <Button
            variant="danger"
            loading={busy}
            disabled={reason.trim().length < 5}
            onClick={async () => {
              key.current ??= crypto.randomUUID();
              setBusy(true);
              setError("");
              try {
                const result = await submitFinanceCommand({
                  kind,
                  operationKey: key.current,
                  congregationId: unit,
                  id,
                  expectedRevision: revision,
                  reason,
                });
                if (!result.ok) {
                  setError(result.message);
                  setUncertain(result.code === "UNAVAILABLE");
                  return;
                }
                router.refresh();
                onClose();
              } catch {
                setUncertain(true);
                setError(
                  "Não foi possível confirmar. Tente novamente com a mesma justificativa.",
                );
              } finally {
                setBusy(false);
              }
            }}
          >
            Confirmar cancelamento
          </Button>
        </>
      }
    >
      <div className="stack">
        {error && <p role="alert">{error}</p>}
        <label>
          Justificativa
          <textarea
            disabled={busy || uncertain}
            value={reason}
            minLength={5}
            maxLength={1000}
            required
            onChange={(e) => setReason(e.target.value)}
          />
        </label>
      </div>
    </Modal>
  );
}
