"use client";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import type { DeliveryRule } from "../types/finance-administrative.types";
import { deliveryDeadlineSchema } from "../validations/finance-administrative.schemas";
import { saveFinanceDeliveryDeadlineAction } from "../actions/finance-delivery.actions";
import { formatFinanceMonth } from "../utils/finance-period";
export function FinanceDeliveryDeadline({
  rules,
  currentMonth,
  onDirtyChange,
}: {
  rules: DeliveryRule[];
  currentMonth: string;
  onDirtyChange: (dirty: boolean) => void;
}) {
  const router = useRouter();
  const [day, setDay] = useState(
      String(rules.find((r) => r.effectiveMonth <= currentMonth)?.day ?? 8),
    ),
    [effective, setEffective] = useState(currentMonth),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [saved, setSaved] = useState(false);
  const key = useRef<string | null>(null),
    revision = Math.max(0, ...rules.map((r) => r.revision));
  const distinct = rules.filter(
    (r, i) =>
      rules.findIndex((v) => v.effectiveMonth === r.effectiveMonth) === i,
  );
  function dirty() {
    key.current = null;
    setSaved(false);
    onDirtyChange(true);
  }
  return (
    <section className="card stack">
      <h2>Prazo de entrega dos relatórios</h2>
      <p className="muted">
        Regra para todas as congregações. O dia é aplicado ao mês seguinte à
        referência. Antes da primeira regra cadastrada, o prazo é dia 8.
      </p>
      <form
        className="stack"
        onSubmit={async (e) => {
          e.preventDefault();
          key.current ??= crypto.randomUUID();
          const parsed = deliveryDeadlineSchema.safeParse({
            day: Number(day),
            effectiveMonth: effective,
            expectedRevision: revision,
            operationKey: key.current,
          });
          if (!parsed.success) {
            setError(parsed.error.issues[0].message);
            return;
          }
          setBusy(true);
          setError("");
          try {
            const r = await saveFinanceDeliveryDeadlineAction(parsed.data);
            if (!r.ok) {
              setError(r.message);
              return;
            }
            setSaved(true);
            onDirtyChange(false);
            router.refresh();
          } catch {
            setError(
              "Não foi possível confirmar a alteração. Tente novamente.",
            );
          } finally {
            setBusy(false);
          }
        }}
      >
        <fieldset disabled={busy} className="stack finance-delivery-fields">
          <div className="finance-informative-period">
            <label>
              Dia limite de entrega
              <input
                type="number"
                min={1}
                max={31}
                step={1}
                required
                value={day}
                onChange={(e) => {
                  setDay(e.target.value);
                  dirty();
                }}
              />
            </label>
            <label>
              Aplicar a partir do mês de referência
              <input
                type="month"
                min={currentMonth}
                max="2099-12"
                required
                value={effective}
                onChange={(e) => {
                  setEffective(e.target.value);
                  dirty();
                }}
              />
            </label>
          </div>
          <p className="muted">
            Meses anteriores mantêm o prazo original. Se o dia não existir no
            mês de entrega, será usado o último dia desse mês.
          </p>
          <div>
            <Button type="submit" loading={busy}>
              Salvar prazo
            </Button>
          </div>
        </fieldset>
        {error && (
          <p role="alert" className="notice">
            {error}
          </p>
        )}
        {saved && <p role="status">Prazo salvo.</p>}
      </form>
      {distinct.length > 0 && (
        <div className="stack">
          <h3>Prazos cadastrados</h3>
          {distinct.map((r) => (
            <p key={r.revision}>
              Referência a partir de{" "}
              {formatFinanceMonth(r.effectiveMonth, true)}: dia {r.day} do mês
              seguinte.
            </p>
          ))}
        </div>
      )}
    </section>
  );
}
