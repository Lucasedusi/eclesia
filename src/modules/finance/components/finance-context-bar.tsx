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
}: {
  units: FinanceUnit[];
  selectedUnitId: string;
  month: string;
  onChange: (unit: string, month: string) => void;
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
      ) : (
        <FinanceSelect
          label="Congregação"
          fieldClassName="finance-congregation-field"
          popupWidth={480}
          value={selectedUnitId}
          onChange={(e) => onChange(e.target.value, month)}
        >
          {options}
        </FinanceSelect>
      )}
      {transactionPeriod ?? (
        <FinanceDateField
          label="Período"
          withCalendar
          monthOnly
          value={month}
          onChange={(iso) => {
            if (iso && iso !== month) onChange(selectedUnitId, iso);
          }}
        />
      )}
    </div>
  );
}
