"use client";
import type { FinanceUnit } from "../types/finance.types";
export function FinanceContextBar({
  units,
  selectedUnitId,
  month,
  onChange,
  transactionPeriod,
}: {
  units: FinanceUnit[];
  selectedUnitId: string;
  month: string;
  onChange: (unit: string, month: string) => void;
  transactionPeriod?: React.ReactNode;
}) {
  return (
    <div className="finance-context">
      <label>
        Congregação
        {units.length === 1 ? (
          <span className="finance-single-unit">
            {units[0].name}{units[0].isHeadquarters ? " · Sede" : ""}
          </span>
        ) : (
          <select
            aria-label="Congregação"
            value={selectedUnitId}
            onChange={(e) => onChange(e.target.value, month)}
          >
            {units.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name}
                {u.isHeadquarters ? " · Sede" : ""}
              </option>
            ))}
          </select>
        )}
      </label>
      <label className={transactionPeriod ? "finance-desktop-only" : undefined}>
        Período
        <input
          aria-label="Período"
          type="month"
          min="2000-01"
          max="2099-12"
          value={month}
          onChange={(e) => {
            if (e.target.value) onChange(selectedUnitId, e.target.value);
          }}
        />
      </label>
      {transactionPeriod}
    </div>
  );
}
