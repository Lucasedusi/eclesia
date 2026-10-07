"use client";
import { HandCoins, ShieldCheck } from "lucide-react";
import { FinanceEntryForm } from "./finance-entry-form";
import type { FinanceCatalogs } from "../types/finance-catalog.types";
import type { FinanceCapabilities } from "../types/finance.types";
export function FinanceAttendance(props: {
  unit: string;
  month: string;
  date: string;
  catalogs: FinanceCatalogs;
  capabilities: FinanceCapabilities;
}) {
  return (
    <div className="stack">
      <div className="row spread">
        <div>
          <p className="eyebrow">Cada contribuição tem um propósito</p>
          <h1>Atendimento</h1>
          <p className="muted">
            Uma identificação. Todas as contribuições. Um comprovante.
          </p>
        </div>
        <HandCoins color="#087F5B" size={32} />
      </div>
      <div>
        <section className="card stack">
          <div className="row">
            <ShieldCheck color="#087F5B" size={18} />
            <span className="muted">
              Confira a pessoa e os valores antes de confirmar.
            </span>
          </div>
          <FinanceEntryForm {...props} mode="ATTENDANCE" />
        </section>
      </div>
    </div>
  );
}
