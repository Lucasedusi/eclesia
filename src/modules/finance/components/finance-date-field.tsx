"use client";

import dynamic from "next/dynamic";
import { useId, useLayoutEffect, useRef, useState } from "react";
import { CalendarDays } from "lucide-react";
import { isLocalDate, isMonth } from "../utils/finance-period";
import { FinanceFieldPopup } from "./finance-field-popup";
import styles from "./finance-pickers.module.css";

export const FinanceCalendar = dynamic(() => import("./finance-calendar"), {
  loading: () => (
    <p role="status" className={styles.empty}>
      Abrindo calendário…
    </p>
  ),
});

const FinanceMonthPicker = dynamic(() => import("./finance-month-picker"));

export function FinanceDateField({
  label,
  value: controlled,
  defaultValue = "",
  onChange,
  disabled,
  withCalendar = false,
  monthOnly = false,
  required = true,
  name,
  min = monthOnly ? "2000-01" : "2000-01-01",
  max = monthOnly ? "2099-12" : "2099-12-31",
  hideLabel,
  "aria-label": accessibleLabel,
  className,
  entryFocus,
  onOpenCalendar,
}: {
  label: string;
  value?: string;
  defaultValue?: string;
  onChange?: (iso: string) => void;
  disabled?: boolean;
  withCalendar?: boolean;
  monthOnly?: boolean;
  required?: boolean;
  name?: string;
  min?: string;
  max?: string;
  hideLabel?: boolean;
  "aria-label"?: string;
  className?: string;
  entryFocus?: boolean;
  onOpenCalendar?: () => void;
}) {
  const id = useId();
  const [local, setLocal] = useState(defaultValue);
  const value = controlled ?? local;
  const trigger = useRef<HTMLButtonElement>(null);
  const field = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<{ text: string; source: string } | null>(
    null,
  );
  const validate = monthOnly ? isMonth : isLocalDate;
  const display =
    draft && (value === draft.source || value === "")
      ? draft.text
      : value.split("-").reverse().join("/");
  const format = monthOnly ? "mm/aaaa" : "dd/mm/aaaa";
  const formatValue = (iso: string) => iso.split("-").reverse().join("/");
  const parsed = display.split("/").reverse().join("-");
  const error = !display
    ? ""
    : !validate(parsed)
      ? `Informe uma data válida no formato ${format}.`
      : parsed < min || parsed > max
        ? `Escolha um valor entre ${formatValue(min)} e ${formatValue(max)}.`
        : "";
  useLayoutEffect(() => {
    field.current?.setCustomValidity(error);
  }, [error]);
  function edit(text: string) {
    const digits = monthOnly ? /^(\d{2})(\d{4})$/ : /^(\d{2})(\d{2})(\d{4})$/;
    const formatted = validate(text)
      ? formatValue(text)
      : text.replace(digits, monthOnly ? "$1/$2" : "$1/$2/$3");
    const next = formatted.split("/").reverse().join("-");
    const valid = validate(next) && next >= min && next <= max;
    const iso = valid ? next : "";
    setDraft(valid ? null : { text: formatted, source: value });
    if (controlled === undefined) setLocal(iso);
    onChange?.(iso);
  }
  function choose(iso: string) {
    edit(iso);
    setOpen(false);
    trigger.current?.focus();
  }
  return (
    <div className={styles.field + " finance-picker-field"}>
      {!hideLabel && <label htmlFor={id}>{label}</label>}
      {name && (
        <input
          type="hidden"
          name={name}
          value={error ? "" : parsed}
          disabled={disabled}
        />
      )}
      <div className={styles.control}>
        <input
          ref={field}
          id={id}
          type="text"
          inputMode="numeric"
          autoComplete="off"
          maxLength={monthOnly ? 7 : 10}
          aria-label={accessibleLabel ?? (hideLabel ? label : undefined)}
          data-entry-focus={entryFocus || undefined}
          className={[className, withCalendar && styles.dateInput]
            .filter(Boolean)
            .join(" ")}
          placeholder={format}
          value={display}
          required={required}
          disabled={disabled}
          onChange={(event) => edit(event.target.value)}
        />
        {withCalendar && (
          <button
            type="button"
            ref={trigger}
            className={styles.dateTrigger}
            aria-label={`Abrir calendário de ${(accessibleLabel ?? label).toLowerCase()}`}
            aria-expanded={onOpenCalendar ? undefined : open}
            aria-haspopup="dialog"
            disabled={disabled || min > max}
            onClick={() => (onOpenCalendar ? onOpenCalendar() : setOpen(!open))}
          >
            <CalendarDays size={18} aria-hidden="true" />
          </button>
        )}
      </div>
      {withCalendar && open && (
        <FinanceFieldPopup
          anchor={trigger}
          alignTo={field}
          width={316}
          onDismiss={() => setOpen(false)}
        >
          <div
            role="dialog"
            aria-label={monthOnly ? "Escolher mês" : "Escolher data"}
          >
            {monthOnly ? (
              <FinanceMonthPicker
                value={value}
                min={min}
                max={max}
                onChange={choose}
              />
            ) : (
              <FinanceCalendar
                mode="single"
                value={value}
                min={min}
                max={max}
                onChange={choose}
              />
            )}
          </div>
        </FinanceFieldPopup>
      )}
    </div>
  );
}
