"use client";
import type { FinanceUnit } from "../types/finance.types";
export function FinanceContextBar({
  units,
  selectedUnitId,
  month,
  onChange,
}: {
  units: FinanceUnit[];
  selectedUnitId: string;
  month: string;
  onChange: (unit: string, month: string) => void;
}) {
  return (
    <div className="finance-context">
      <label>
        Congregação
        <select
          aria-label="Congregação"
          value={selectedUnitId}
          disabled={units.length === 1}
          onChange={(e) => onChange(e.target.value, month)}
        >
          {units.map((u) => (
            <option key={u.id} value={u.id}>
              {u.name}
              {u.isHeadquarters ? " · Sede" : ""}
            </option>
          ))}
        </select>
      </label>
      <label>
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
    </div>
  );
}
