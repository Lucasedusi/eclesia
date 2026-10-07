"use client";
import { formatFinanceMonth } from "../utils/finance-period";
import { FinanceMoneyInput } from "./finance-money-input";
import { useState, useRef, useEffect } from "react";

import { Plus, Trash2, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  saveStatementRulesAction,
  copyStatementRulesAction,
} from "../actions/finance-statement.actions";
import type {
  StatementRuleInput,
  StatementRuleSet,
} from "../types/finance-statement.types";
import type { FinanceUnit } from "../types/finance.types";
import { parseMoneyInput, centsToDecimal } from "../utils/finance-money";
import { useFinanceDirtyGuard, useFinanceNavigation } from "./finance-shell";
type DraftRule = {
  key: number;
  name: string;
  role: StatementRuleInput["role"];
  calculation: StatementRuleInput["calculation"];
  value: string;
  cap: string;
};
export function FinanceRuleEditor({
  unit,
  month,
  rules,
  units,
  onDirtyChange,
}: {
  unit: string;
  month: string;
  rules: StatementRuleSet[];
  units: FinanceUnit[];
  onDirtyChange?: (dirty: boolean) => void;
}) {
  const effective = rules.find((r) => r.effectiveMonth <= month),
    financeNavigation = useFinanceNavigation(),
    form = useRef<HTMLFormElement>(null),
    nextKey = useRef(100);
  const initial: DraftRule[] = (effective?.items ?? []).map((r, i) => ({
    key: i,
    name: r.name,
    role: r.role,
    cap:
      r.capCents === undefined
        ? ""
        : centsToDecimal(r.capCents).replace(".", ","),
    calculation: r.calculation,
    value:
      r.calculation === "FIXED"
        ? centsToDecimal(r.amountCents ?? 0).replace(".", ",")
        : (r.percentage ?? "0"),
  }));
  const [items, setItems] = useState(initial),
    [dirty, setDirty] = useState(false),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState(""),
    [error, setError] = useState("");
  useEffect(() => {
    onDirtyChange?.(dirty);
  }, [dirty, onDirtyChange]);
  function change(key: number, patch: Partial<DraftRule>) {
    setDirty(true);
    setItems((current) =>
      current.map((r) => (r.key === key ? { ...r, ...patch } : r)),
    );
  }
  async function save() {
    if (busy || !form.current?.reportValidity()) return false;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const data = new FormData(form.current);
      const result = await saveStatementRulesAction({
        congregationId: unit,
        effectiveMonth: String(data.get("month")),
        items: items.map((r) => ({
          name: r.name,
          role: r.role,
          ...(r.role === "GROSS_PREBEND"
            ? { capCents: parseMoneyInput(r.cap) }
            : {}),
          calculation: r.calculation,
          destination:
            r.role === "GROSS_PREBEND" ? "LOCAL_PASTOR" : "CATHEDRAL",
          ...(r.calculation === "FIXED"
            ? { amountCents: parseMoneyInput(r.value) }
            : { percentage: r.value.replace(",", ".") }),
        })),
        ...(data.get("reason")
          ? { retroactiveReason: String(data.get("reason")) }
          : {}),
      });
      if (!result.ok) {
        setError(
          result.message +
            (result.fieldErrors
              ? " " + Object.values(result.fieldErrors).flat().join(" ")
              : ""),
        );
        return false;
      }
      setDirty(false);
      setMessage(`Regras salvas. Revisão ${result.data.revision}.`);
      financeNavigation.refresh();
      return true;
    } catch {
      setError("Confira os valores e percentuais de cada item.");
      return false;
    } finally {
      setBusy(false);
    }
  }
  useFinanceDirtyGuard(dirty, save, () => {
    setItems(initial);
    setDirty(false);
  });
  return (
    <div className="stack">
      <div className="notice">
        Estas regras calculam o demonstrativo. Os pagamentos e saídas serão
        registrados pelo tesoureiro. O desconto da prebenda é retirado uma única
        vez da parte do pastor.
      </div>
      {effective?.items.some(
        (r) => r.role === "GROSS_PREBEND" && r.capCents === undefined,
      ) && (
        <p className="notice">
          Defina o teto mensal da prebenda para gerar novos demonstrativos. Os
          valores dos demonstrativos anteriores permanecem preservados.
        </p>
      )}
      <form
        ref={form}
        className="card stack"
        onChange={() => setDirty(true)}
        onSubmit={(e) => {
          e.preventDefault();
          void save();
        }}
      >
        <div className="row spread">
          <div>
            <h2>Regras desta congregação</h2>
            <p className="muted">
              {effective
                ? `Vigência ${formatFinanceMonth(effective.effectiveMonth, true)} · revisão ${effective.revision}`
                : "Nenhuma regra cadastrada"}
            </p>
          </div>
          <label>
            Nova vigência
            <input name="month" type="month" defaultValue={month} required />
          </label>
        </div>
        {error && <div role="alert">{error}</div>}
        {message && <p role="status">{message}</p>}
        {items.map((r, index) => (
          <fieldset
            className="card stack finance-rule-item"
            key={r.key}
            style={{ padding: 18 }}
          >
            <legend>Item {index + 1}</legend>
            <div className="grid">
              <label>
                Descrição do item
                <input
                  value={r.name}
                  required
                  maxLength={120}
                  onChange={(e) => change(r.key, { name: e.target.value })}
                />
              </label>
              <label>
                Finalidade
                <select
                  value={r.role}
                  onChange={(e) =>
                    change(r.key, { role: e.target.value as DraftRule["role"] })
                  }
                >
                  <option value="DISTRIBUTION">Entrega à Catedral</option>
                  <option value="GROSS_PREBEND">
                    Prebenda bruta do pastor
                  </option>
                  <option value="PREBEND_DEDUCTION">
                    Desconto da prebenda → Catedral
                  </option>
                </select>
              </label>
            </div>
            <div className="grid">
              <label>
                Cálculo
                <select
                  value={r.calculation}
                  onChange={(e) =>
                    change(r.key, {
                      calculation: e.target.value as DraftRule["calculation"],
                    })
                  }
                >
                  <option value="ELIGIBLE_INCOME_PERCENT">
                    Percentual das entradas da base
                  </option>
                  <option value="GROSS_PREBEND_PERCENT">
                    Percentual da prebenda bruta
                  </option>
                  <option value="FIXED">Valor fixo</option>
                </select>
              </label>
              <label>
                {r.calculation === "FIXED" ? "Valor (R$)" : "Percentual (%)"}
                {r.calculation === "FIXED" ? (
                  <FinanceMoneyInput
                    value={r.value}
                    required
                    onChange={(e) => change(r.key, { value: e.target.value })}
                  />
                ) : (
                  <input
                    value={r.value}
                    inputMode="decimal"
                    required
                    onChange={(e) => change(r.key, { value: e.target.value })}
                  />
                )}
              </label>
            </div>
            {r.role === "GROSS_PREBEND" && (
              <label>
                Teto mensal da prebenda bruta
                <FinanceMoneyInput
                  value={r.cap}
                  required
                  onChange={(e) => change(r.key, { cap: e.target.value })}
                />
                <span className="muted">
                  Limite antes do dízimo. O excedente permanece na congregação.
                  Informe 0 para limitar a zero.
                </span>
              </label>
            )}
            {r.calculation === "FIXED" && (
              <p className="muted">
                Valor fixo desta congregação, independente da arrecadação.
              </p>
            )}
            <Button
              variant="outline"
              onClick={() => {
                setItems((current) => current.filter((v) => v.key !== r.key));
                setDirty(true);
              }}
            >
              <Trash2 size={15} />
              Remover item {index + 1}
            </Button>
          </fieldset>
        ))}
        <Button
          variant="outline"
          onClick={() => {
            setItems((current) => [
              ...current,
              {
                key: nextKey.current++,
                name: "",
                role: "DISTRIBUTION",
                calculation: "ELIGIBLE_INCOME_PERCENT",
                value: "",
                cap: "",
              },
            ]);
            setDirty(true);
          }}
        >
          <Plus size={16} />
          Adicionar regra
        </Button>
        <label>
          Justificativa para revisão de período anterior
          <textarea name="reason" minLength={5} maxLength={1000} />
        </label>
        <p className="muted">
          Obrigatória ao alterar um período passado ou que já possui
          demonstrativo. As versões anteriores permanecem disponíveis.
        </p>
        <Button type="submit" loading={busy} disabled={items.length === 0}>
          Salvar regras
        </Button>
      </form>
      <form
        className="card stack"
        onSubmit={async (e) => {
          e.preventDefault();
          if (dirty) {
            setError(
              "Salve ou descarte a edição atual antes de copiar regras.",
            );
            return;
          }
          const data = new FormData(e.currentTarget);
          setBusy(true);
          setError("");
          try {
            const result = await copyStatementRulesAction({
              fromCongregationId: String(data.get("from")),
              toCongregationId: unit,
              effectiveMonth: String(data.get("month")),
              ...(data.get("reason")
                ? { retroactiveReason: String(data.get("reason")) }
                : {}),
            });
            if (!result.ok) setError(result.message);
            else {
              setMessage(
                "Regras copiadas. Abra novamente a aba para editar a cópia.",
              );
              financeNavigation.refresh();
            }
          } catch {
            setError("Não foi possível confirmar a cópia.");
          } finally {
            setBusy(false);
          }
        }}
      >
        <h2>Copiar de outra congregação</h2>
        <p className="muted">
          A cópia é independente. Alterações futuras na origem não mudam estas
          regras.
        </p>
        <div className="grid">
          <label>
            Congregação de origem
            <select name="from" required defaultValue="">
              <option value="" disabled>
                Selecione
              </option>
              {units
                .filter((u) => u.id !== unit)
                .map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name}
                  </option>
                ))}
            </select>
          </label>
          <label>
            Vigência da cópia
            <input type="month" name="month" defaultValue={month} required />
          </label>
        </div>
        <label>
          Justificativa da cópia retroativa
          <textarea name="reason" minLength={5} />
        </label>
        <Button type="submit" variant="outline" loading={busy}>
          <Copy size={16} />
          Copiar regras
        </Button>
      </form>
    </div>
  );
}
