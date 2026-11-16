"use client";

import { useState } from "react";
import { FinanceCalendar, FinanceDateField } from "./finance-date-field";

export type FinanceDateRange = { dateFrom: string; dateTo: string };

export function FinanceRangeEditor({
  range,
  onChange,
}: {
  range: FinanceDateRange;
  onChange: (range: FinanceDateRange) => void;
}) {
  const [typedMonth, setTypedMonth] = useState("");
  return (
    <>
      <div className="finance-period-dates">
        <FinanceDateField
          label="Data inicial"
          value={range.dateFrom}
          onChange={(dateFrom) => {
            onChange({ ...range, dateFrom });
            if (dateFrom) setTypedMonth(dateFrom.slice(0, 7));
          }}
        />
        <FinanceDateField
          label="Data final"
          value={range.dateTo}
          onChange={(dateTo) => {
            onChange({ ...range, dateTo });
            if (dateTo) setTypedMonth(dateTo.slice(0, 7));
          }}
        />
      </div>
      <FinanceCalendar
        key={typedMonth}
        initialMonth={typedMonth}
        mode="range"
        from={range.dateFrom}
        to={range.dateTo}
        onChange={(dateFrom, dateTo) => onChange({ dateFrom, dateTo })}
      />
    </>
  );
}
