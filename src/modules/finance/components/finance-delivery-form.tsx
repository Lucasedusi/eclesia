"use client";
import { FinanceDateField } from "./finance-date-field";
import { useRef, useState } from "react";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { recordFinanceDeliveryAction } from "../actions/finance-delivery.actions";
import { recordDeliverySchema } from "../validations/finance-administrative.schemas";
import type { DeliveryRow } from "../types/finance-administrative.types";
import { formatFinanceMonth, monthRange } from "../utils/finance-period";
export function FinanceDeliveryForm({
  row,
  month,
  today,
  onClose,
  onSaved,
}: {
  row: DeliveryRow;
  month: string;
  today: string;
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const [date, setDate] = useState(row.deliveryDate ?? today),
    [reason, setReason] = useState(""),
    [undo, setUndo] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const key = useRef<string | null>(null);
  const manual = row.source === "MANUAL";
  const title = undo
    ? "Desfazer entrega"
    : manual
      ? "Corrigir entrega"
      : row.transfer ? "Registrar data manual" : "Registrar entrega";
  return (
    <Modal
      title={title}
      onClose={() => {
        if (!busy) onClose();
      }}
      className="finance-drawer finance-secondary-drawer"
    >
      <form
        className="stack"
        onSubmit={async (e) => {
          e.preventDefault();
          key.current ??= crypto.randomUUID();
          const input = {
            congregationId: row.id,
            month,
            deliveryDate: undo ? null : date,
            action: undo
              ? ("UNDO" as const)
              : manual
                ? ("CORRECT" as const)
                : ("RECEIVE" as const),
            reason,
            expectedRevision: row.revision,
            operationKey: key.current,
          };
          const parsed = recordDeliverySchema.safeParse(input);
          if (!parsed.success) {
            setError(parsed.error.issues[0].message);
            return;
          }
          setBusy(true);
          setError("");
          try {
            const result = await recordFinanceDeliveryAction(parsed.data);
            if (!result.ok) {
              setError(result.message);
              return;
            }
            await onSaved();
          } catch {
            setError("Não foi possível confirmar a entrega. Tente novamente.");
          } finally {
            setBusy(false);
          }
        }}
      >
        <p>
          <strong>{row.name}</strong>
          <br />
          {formatFinanceMonth(month, true)}
        </p>
        {error && (
          <p role="alert" className="notice">
            {error}
          </p>
        )}
        <fieldset disabled={busy} className="stack finance-delivery-fields">
          {!undo && (
            <FinanceDateField label="Data da entrega"
              withCalendar
              required
              min={monthRange(month).end}
              max={today}
              value={date}
              onChange={iso => {
                setDate(iso);
                key.current = null;
              }}
            />
          )}
          {manual && (
            <label>
              Motivo da alteração
              <textarea
                required
                minLength={5}
                maxLength={500}
                value={reason}
                onChange={(e) => {
                  setReason(e.target.value);
                  key.current = null;
                }}
              />
            </label>
          )}
          {undo && (
            <p className="muted">
              {row.transfer
                ? "Ao desfazer o registro manual, valerá a data do primeiro repasse válido."
                : "A entrega voltará a constar como pendente."}
            </p>
          )}
          <div className="row finance-delivery-actions">
            <Button type="submit" loading={busy}>
              {title}
            </Button>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancelar
            </Button>
          </div>
          {manual && (
            <button
              type="button"
              className="finance-delivery-undo"
              onClick={() => {
                setUndo(!undo);
                key.current = null;
                setError("");
              }}
            >
              {undo ? "Voltar à correção" : "Desfazer registro de entrega"}
            </button>
          )}
        </fieldset>
      </form>
    </Modal>
  );
}
