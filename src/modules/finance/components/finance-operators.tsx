"use client";
import { useFinanceNavigation } from "./finance-shell";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import type { FinanceOperator } from "../services/finance-operator.service";
import type { FinanceUnit } from "../types/finance.types";
import { assignFinanceOperatorAction } from "../actions/finance-operator.actions";
export function FinanceOperators({
  operators,
  units,
  unit,
}: {
  operators: FinanceOperator[];
  units: FinanceUnit[];
  unit: string;
}) {
  const [busy, setBusy] = useState(false),
    [message, setMessage] = useState(""),
    [error, setError] = useState(""),
    financeNavigation = useFinanceNavigation();
  return (
    <section className="card stack">
      <h2>Congregação de operação</h2>
      <p className="notice">
        Acessos regionais, de ministério ou do campo precisam de uma congregação
        definida para registrar movimentações. A escolha respeita o alcance do
        acesso e mantém as permissões já concedidas. Tesoureiros com acesso por
        congregação usam a própria unidade.
      </p>
      {message && <p role="status">{message}</p>}
      {error && <p role="alert">{error}</p>}
      {operators.length === 0 ? (
        <p className="muted">
          Nenhum acesso requer uma congregação operacional adicional.
        </p>
      ) : (
        operators.map((operator) => (
          <form
            key={`${operator.id}-${operator.unitId}`}
            className="row"
            onSubmit={async (e) => {
              e.preventDefault();
              if (busy) return;
              const data = new FormData(e.currentTarget);
              setBusy(true);
              setError("");
              setMessage("");
              try {
                const result = await assignFinanceOperatorAction({
                  congregationId: unit,
                  accessId: operator.id,
                  operatingUnit: data.get("unit") || null,
                });
                if (result.ok) {
                  setMessage("Congregação operacional atualizada.");
                  financeNavigation.refresh();
                } else setError(result.message);
              } catch {
                setError("Não foi possível atualizar o acesso.");
              } finally {
                setBusy(false);
              }
            }}
          >
            <label style={{ flex: 1 }}>
              {operator.name} ·{" "}
              {operator.scope === "REGION"
                ? "Região"
                : operator.scope === "MINISTRY"
                  ? "Ministério"
                  : "Campo"}
              <select name="unit" defaultValue={operator.unitId ?? ""}>
                <option value="">Sem congregação operacional</option>
                {units
                  .filter((u) => operator.allowedUnitIds.includes(u.id))
                  .map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name}
                    </option>
                  ))}
              </select>
            </label>
            <Button type="submit" variant="outline" loading={busy}>
              Salvar atribuição
            </Button>
          </form>
        ))
      )}
    </section>
  );
}
