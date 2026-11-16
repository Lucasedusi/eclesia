"use client";
import { FinanceDateField } from "./finance-date-field";
import { FinanceSelect } from "./finance-select";
import type { FinanceUnit } from "../types/finance.types";
export function FinanceContextBar({
  units,
  selectedUnitId,
  month,
  onChange,
  transactionPeriod,
  attendance = false,
}: {
  units: FinanceUnit[];
  selectedUnitId: string;
  month: string;
  onChange: (unit: string, month: string) => void;
  attendance?: boolean;
  transactionPeriod?: React.ReactNode;
}) {
  const options = units.map((unit) => (
    <option key={unit.id} value={unit.id}>
      {unit.name}
      {unit.isHeadquarters ? " · Sede" : ""}
    </option>
  ));
  return (
    <div className="finance-context">
      {units.length === 1 ? (
        <label>
          Congregação
          <span className="finance-single-unit">
            {units[0].name}
            {units[0].isHeadquarters ? " · Sede" : ""}
          </span>
        </label>
      ) : attendance ? (
        <label>
          Congregação
          <select
            aria-label="Congregação"
            value={selectedUnitId}
            onChange={(e) => onChange(e.target.value, month)}
          >
            {options}
          </select>
        </label>
      ) : (
        <FinanceSelect
          label="Congregação"
          value={selectedUnitId}
          onChange={(e) => onChange(e.target.value, month)}
        >
          {options}
        </FinanceSelect>
      )}
      {transactionPeriod ??
        (attendance ? (
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
        ) : (
          <FinanceDateField
            label="Período"
            withCalendar
            monthOnly
            value={month}
            onChange={(iso) => {
              if (iso && iso !== month) onChange(selectedUnitId, iso);
            }}
          />
        ))}
    </div>
  );
}
