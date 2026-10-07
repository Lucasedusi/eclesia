"use client";
import { useFinanceNavigation } from "./finance-shell";
import { FinanceMoneyInput } from "./finance-money-input";
import { useRef, useState } from "react";

import { Wallet, Landmark, Plus, Pencil, Scale } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import type { FinanceCatalogs, Cashbox } from "../types/finance-catalog.types";
import type { FinanceCapabilities } from "../types/finance.types";
import { formatMoney, parseMoneyInput } from "../utils/finance-money";
import { submitFinanceCommand } from "../actions/finance-command.actions";
import { FinanceCatalogForm } from "./finance-catalog-form";
function Adjustment({
  unit,
  box,
  month,
  onClose,
}: {
  unit: string;
  box: Cashbox;
  month: string;
  onClose: () => void;
}) {
  const financeNavigation = useFinanceNavigation(),
    form = useRef<HTMLFormElement>(null),
    key = useRef<string | null>(null),
    pending = useRef<unknown>(null),
    [uncertain, setUncertain] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  async function save() {
    if (busy || !form.current?.reportValidity()) return;
    setBusy(true);
    setError("");
    try {
      if (!pending.current) {
        const d = new FormData(form.current);
        key.current ??= crypto.randomUUID();
        pending.current = {
          kind: "ADJUST_BALANCE",
          operationKey: key.current,
          congregationId: unit,
          cashboxId: box.id,
          date: String(d.get("date")),
          amountCents: parseMoneyInput(String(d.get("amount"))),
          reason: String(d.get("reason")),
        };
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
        "Confira o valor do ajuste. Para retirar saldo, use um valor negativo.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal
      title={`Ajustar ${box.name}`}
      busy={busy || uncertain}
      onClose={onClose}
      footer={
        <Button loading={busy} onClick={() => void save()}>
          Registrar ajuste
        </Button>
      }
    >
      <form
        className="stack"
        ref={form}
        onSubmit={(e) => {
          e.preventDefault();
          void save();
        }}
      >
        {error && <div role="alert">{error}</div>}
        <fieldset
          disabled={busy || uncertain}
          className="stack"
          style={{ border: 0, padding: 0, minWidth: 0 }}
        >
          <p className="notice">
            Saldo atual: {formatMoney(box.balanceCents)}. O ajuste fica no
            histórico e não conta como entrada ou despesa.
          </p>
          <label>
            Data do ajuste
            <input
              name="date"
              type="date"
              defaultValue={`${month}-01`}
              required
            />
          </label>
          <label>
            Valor a acrescentar ou retirar (R$)
            <FinanceMoneyInput
              signed
              name="amount"
              inputMode="decimal"
              placeholder="Ex.: -50,00"
              required
            />
          </label>
          <label>
            Justificativa
            <textarea name="reason" required minLength={5} maxLength={1000} />
          </label>
        </fieldset>
      </form>
    </Modal>
  );
}
export function FinanceCashboxes({
  catalogs,
  unit,
  month,
  capabilities,
}: {
  catalogs: FinanceCatalogs;
  unit: string;
  month: string;
  capabilities: FinanceCapabilities;
}) {
  const [editing, setEditing] = useState<{ id?: string } | null>(null),
    [adjusting, setAdjusting] = useState<Cashbox | null>(null);
  return (
    <div className="stack">
      <div className="row spread">
        <div>
          <p className="eyebrow">Recursos disponíveis</p>
          <h1>Caixas e contas</h1>
          <p className="muted">
            Saldos atuais e formas de recebimento desta congregação.
          </p>
        </div>
        {capabilities.manageSettings && (
          <Button onClick={() => setEditing({})}>
            <Plus size={17} />
            Novo caixa ou conta
          </Button>
        )}
      </div>
      {catalogs.cashboxes.length === 0 ? (
        <div className="card empty">
          Nenhum caixa cadastrado.
          {capabilities.manageSettings
            ? " Cadastre uma forma de pagamento nas configurações e crie o primeiro caixa."
            : " Solicite a configuração ao administrador."}
        </div>
      ) : (
        <div className="finance-cashbox-grid">
          {catalogs.cashboxes.map((box) => (
            <article
              className={`card stack finance-cashbox ${box.kind === "BANK_ACCOUNT" ? "finance-bank-card" : ""}`}
              key={box.id}
            >
              <div className="row spread">
                <div className="row">
                  {box.kind === "CASH" ? (
                    <Wallet color="#087F5B" />
                  ) : (
                    <Landmark />
                  )}
                  <h2>{box.name}</h2>
                </div>
                <span className="badge">
                  {box.status === "ACTIVE" ? "Ativo" : "Inativo"}
                </span>
              </div>
              {box.kind === "BANK_ACCOUNT" && (
                <div className="finance-bank-data">
                  <span className="finance-bank-chip" aria-hidden="true" />
                  <strong>{box.bankName || "Conta bancária"}</strong>
                  <div className="row">
                    <span>Agência {box.agency || "—"}</span>
                    <span>Conta {box.accountNumber || "—"}</span>
                  </div>
                </div>
              )}
              <div>
                <span className="muted">Saldo atual</span>
                <div
                  className={`amount ${box.balanceCents < 0 ? "negative" : ""}`}
                >
                  {formatMoney(box.balanceCents)}
                </div>
                {box.balanceCents < 0 && (
                  <span className="negative" style={{ fontSize: 12 }}>
                    Saldo negativo · confira a movimentação
                  </span>
                )}
              </div>
              <p className="muted">
                {box.paymentMethodIds
                  .map(
                    (id) =>
                      catalogs.paymentMethods.find((m) => m.id === id)?.name,
                  )
                  .filter(Boolean)
                  .join(" · ")}
              </p>
              <div className="muted">
                Abertura em {box.openingDate?.split("-").reverse().join("/")} ·{" "}
                {formatMoney(box.openingCents)}
              </div>
              {capabilities.manageSettings && (
                <div className="row">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setEditing({ id: box.id })}
                  >
                    <Pencil size={14} />
                    Editar
                  </Button>
                  {box.status === "ACTIVE" && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setAdjusting(box)}
                    >
                      <Scale size={14} />
                      Ajustar saldo
                    </Button>
                  )}
                </div>
              )}
            </article>
          ))}
        </div>
      )}
      {editing && (
        <FinanceCatalogForm
          entity="CASHBOX"
          id={editing.id}
          unit={unit}
          month={month}
          catalogs={catalogs}
          roles={[]}
          onClose={() => setEditing(null)}
        />
      )}
      {adjusting && (
        <Adjustment
          unit={unit}
          box={adjusting}
          month={month}
          onClose={() => setAdjusting(null)}
        />
      )}
    </div>
  );
}
