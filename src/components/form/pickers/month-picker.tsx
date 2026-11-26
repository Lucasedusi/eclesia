"use client";
import { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { formatMonth, todayLocal } from "@/utils/civil-date";
import styles from "./pickers.module.css";

export default function MonthPicker({
  value,
  min,
  max,
  onChange,
}: {
  value: string;
  min: string;
  max: string;
  onChange: (month: string) => void;
}) {
  const initial = value || todayLocal().slice(0, 7);
  const [year, setYear] = useState(() =>
    Number((initial < min ? min : initial > max ? max : initial).slice(0, 4)),
  );
  return (
    <>
      <div className={styles.year}>
        <button
          type="button"
          aria-label="Ano anterior"
          disabled={year <= Number(min.slice(0, 4))}
          onClick={() => setYear(year - 1)}
        >
          <ChevronLeft size={18} />
        </button>
        <strong aria-live="polite">{year}</strong>
        <button
          type="button"
          aria-label="Próximo ano"
          disabled={year >= Number(max.slice(0, 4))}
          onClick={() => setYear(year + 1)}
        >
          <ChevronRight size={18} />
        </button>
      </div>
      <div
        role="group"
        aria-label={`Meses de ${year}`}
        className={styles.months}
      >
        {Array.from({ length: 12 }, (_, i) => {
          const month = year + "-" + String(i + 1).padStart(2, "0");
          const name = formatMonth(month, true);
          return (
            <button
              key={month}
              type="button"
              aria-label={name}
              aria-pressed={value === month}
              disabled={month < min || month > max}
              onClick={() => onChange(month)}
            >
              {name.split(" ")[0]}
            </button>
          );
        })}
      </div>
    </>
  );
}
