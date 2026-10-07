"use client";
import { useFinanceNavigation } from "./finance-shell";
import { FinanceMoneyInput } from "./finance-money-input";
import { useRef, useState } from "react";

import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import type { Cashbox } from "../types/finance-catalog.types";
import { submitFinanceCommand } from "../actions/finance-command.actions";
import { parseMoneyInput, centsToDecimal } from "../utils/finance-money";
export type TransferRow = {
  id: string;
  date: string;
  sourceCashboxId: string;
  targetCashboxId: string;
  amountCents: number;
  description: string | null;
  revision: number;
  status: string;
};
export function FinanceTransferDialog({
  unit,
  date,
  boxes,
  existing,
  onClose,
}: {
  unit: string;
  date: string;
  boxes: Cashbox[];
  existing?: TransferRow;
  onClose: () => void;
}) {
  const form = useRef<HTMLFormElement>(null),
    key = useRef<string | null>(null),
    pending = useRef<unknown>(null),
    [uncertain, setUncertain] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    financeNavigation = useFinanceNavigation();
  async function save() {
    if (busy || !form.current?.reportValidity()) return;
    setBusy(true);
    setError("");
    try {
      if (!pending.current) {
        const d = new FormData(form.current),
          replacement = {
            date: String(d.get("date")),
            sourceCashboxId: String(d.get("from")),
            targetCashboxId: String(d.get("to")),
            amountCents: parseMoneyInput(String(d.get("amount"))),
            description: String(d.get("description")),
          };
        key.current ??= crypto.randomUUID();
        const input = existing
          ? {
              kind: "CORRECT_TRANSFER",
              congregationId: unit,
              operationKey: key.current,
              id: existing.id,
              expectedRevision: existing.revision,
              reason: String(d.get("reason")),
              replacement,
            }
          : {
              kind: "TRANSFER",
              congregationId: unit,
              operationKey: key.current,
              ...replacement,
            };
        pending.current = input;
      }
      const result = await submitFinanceCommand(pending.current);
      if (!result.ok) {
        setError(result.message);
        setUncertain(result.code === "UNAVAILABLE");
        if (result.code !== "UNAVAILABLE") pending.current = null;
        return;
      }
      financeNavigation.refresh();
      onClose();
    } catch {
      if (pending.current) setUncertain(true);
      setError(
        "Confira o valor e os caixas. Em caso de falha de conexão, tente novamente com os mesmos dados.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal
      title={existing ? "Corrigir transferência" : "Transferir entre caixas"}
      busy={busy || uncertain}
      onClose={onClose}
      footer={
        <Button loading={busy} onClick={() => void save()}>
          Confirmar transferência
        </Button>
      }
    >
      <form
        ref={form}
        className="stack"
        onSubmit={(e) => {
          e.preventDefault();
          void save();
        }}
      >
        {error && <p role="alert">{error}</p>}
        <fieldset
          disabled={busy || uncertain}
          className="stack"
          style={{ border: 0, padding: 0, minWidth: 0 }}
        >
          <p className="notice">
            Movimenta recursos entre caixas desta congregação. Não conta como
            receita, despesa ou base do demonstrativo.
          </p>
          <label>
            Data
            <input
              name="date"
              type="date"
              defaultValue={existing?.date ?? date}
              required
            />
          </label>
          <div className="grid">
            {[
              {
                name: "from",
                label: "Origem",
                value: existing?.sourceCashboxId,
              },
              {
                name: "to",
                label: "Destino",
                value: existing?.targetCashboxId,
              },
            ].map((f) => (
              <label key={f.name}>
                {f.label}
                <select name={f.name} defaultValue={f.value ?? ""} required>
                  <option value="">Selecione</option>
                  {boxes
                    .filter((b) => b.status === "ACTIVE")
                    .map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.name}
                      </option>
                    ))}
                </select>
              </label>
            ))}
          </div>
          <label>
            Valor (R$)
            <FinanceMoneyInput
              name="amount"
              inputMode="decimal"
              required
              defaultValue={
                existing
                  ? centsToDecimal(existing.amountCents).replace(".", ",")
                  : ""
              }
            />
          </label>
          <label>
            Descrição
            <input
              name="description"
              defaultValue={existing?.description ?? ""}
              maxLength={1000}
            />
          </label>
          {existing && (
            <label>
              Justificativa
              <textarea name="reason" required minLength={5} maxLength={1000} />
            </label>
          )}
        </fieldset>
      </form>
    </Modal>
  );
}
