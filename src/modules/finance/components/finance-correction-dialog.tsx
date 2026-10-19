"use client";
import { useFinanceNavigation } from "./finance-shell";
import { useRef, useState } from "react";

import { ArrowLeft, Check } from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { submitFinanceCommand } from "../actions/finance-command.actions";
export function FinanceCancellationDialog({
  unit,
  id,
  revision,
  kind,
  attendance,
  onClose,
}: {
  unit: string;
  id: string;
  revision: number;
  kind: "CANCEL_TRANSACTION" | "CANCEL_ATTENDANCE" | "CANCEL_TRANSFER";
  attendance?: { id: string; revision: number };
  onClose: () => void;
}) {
  const [scope, setScope] = useState<"TRANSACTION" | "ATTENDANCE">("TRANSACTION");
  const canChooseScope = kind === "CANCEL_TRANSACTION" && attendance != null;
  const target = canChooseScope && scope === "ATTENDANCE"
    ? { kind: "CANCEL_ATTENDANCE" as const, id: attendance.id, revision: attendance.revision }
    : { kind, id, revision };
  const [reason, setReason] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [uncertain, setUncertain] = useState(false),
    key = useRef<string | null>(null),
    financeNavigation = useFinanceNavigation();
  return (
    <Modal
      className="finance-cancellation-dialog"
      title={
        target.kind === "CANCEL_ATTENDANCE"
          ? "Cancelar todo o atendimento"
          : "Cancelar registro"
      }
      description="O registro permanece no histórico e seu efeito financeiro é revertido."
      busy={busy || uncertain}
      onClose={onClose}
      footer={
        <div className="finance-cancellation-actions">
          <Button
            variant="outline"
            disabled={busy || uncertain}
            onClick={onClose}
          >
            <ArrowLeft className="finance-mobile-only" size={17} aria-hidden="true" />
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
                  kind: target.kind,
                  operationKey: key.current,
                  congregationId: unit,
                  id: target.id,
                  expectedRevision: target.revision,
                  reason,
                });
                if (!result.ok) {
                  setError(result.message);
                  setUncertain(result.code === "UNAVAILABLE");
                  return;
                }
                financeNavigation.refresh();
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
            <span className="finance-desktop-only">Confirmar cancelamento</span>
            <span className="finance-mobile-only finance-button-content"><Check size={17} aria-hidden="true" />Confirmar</span>
          </Button>
        </div>
      }
    >
      <div className="stack">
        {error && <p role="alert">{error}</p>}
        {canChooseScope && (
          <fieldset className="finance-cancellation-scope" disabled={busy || uncertain}>
            <legend>O que deseja cancelar?</legend>
            {([
              ["TRANSACTION", "Somente este lançamento"],
              ["ATTENDANCE", "Todo o atendimento"],
            ] as const).map(([value, label]) => (
              <label key={value}>
                <input type="radio" name="cancellationScope" value={value}
                  checked={scope === value}
                  aria-describedby="finance-cancellation-impact"
                  onChange={() => {
                    setScope(value);
                    key.current = null;
                    setError("");
                  }}
                />
                <span>{label}</span>
              </label>
            ))}
            <p id="finance-cancellation-impact" role="status">
              {scope === "ATTENDANCE"
                ? "Todas as contribuições deste atendimento serão canceladas."
                : "Apenas este lançamento será cancelado. As outras contribuições do atendimento serão mantidas."}
            </p>
          </fieldset>
        )}
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
