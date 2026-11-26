"use client";

import dynamic from "next/dynamic";
import { useId, useLayoutEffect, useRef, useState } from "react";
import { CalendarDays } from "lucide-react";
import { isCivilDate } from "@/utils/civil-date";
import MonthPicker from "./month-picker";
import { FieldPopup } from "./field-popup";
import styles from "./pickers.module.css";

export const Calendar = dynamic(() => import("./calendar"), {
  loading: () => (
    <p role="status" className={styles.empty}>
      Abrindo calendário…
    </p>
  ),
});

export function DateField({
  label,
  id: suppliedId,
  tone = "administrative",
  "aria-invalid": invalid,
  value: controlled,
  defaultValue = "",
  onChange,
  disabled,
  withCalendar = tone === "administrative",
  monthOnly = false,
  required = tone === "finance",
  name,
  min: suppliedMin,
  max: suppliedMax,
  hideLabel,
  "aria-label": accessibleLabel,
  className,
  entryFocus,
  onOpenCalendar,
}: {
  label: string;
  id?: string;
  tone?: "administrative" | "finance";
  "aria-invalid"?: boolean;
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
  const generatedId = useId();
  const id = suppliedId ?? generatedId;
  const min = suppliedMin || (monthOnly ? "2000-01" : tone === "finance" ? "2000-01-01" : "0001-01-01");
  const max = suppliedMax || (monthOnly ? "2099-12" : tone === "finance" ? "2099-12-31" : "9999-12-31");
  const [local, setLocal] = useState(defaultValue);
  const value = controlled ?? local;
  const trigger = useRef<HTMLButtonElement>(null);
  const field = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<{ text: string; source: string } | null>(
    null,
  );
  const validate = monthOnly ? (month: string) => isCivilDate(month + "-01") : isCivilDate;
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
    <div data-picker="" className={[styles.field, tone === "finance" ? "finance-picker-field" : styles.admin].join(" ")}>
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
          aria-invalid={invalid || Boolean(error) || undefined}
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
        <FieldPopup
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
              <MonthPicker
                value={value}
                min={min}
                max={max}
                onChange={choose}
              />
            ) : (
              <Calendar
                mode="single"
                value={value}
                min={min}
                max={max}
                onChange={choose}
              />
            )}
          </div>
        </FieldPopup>
      )}
    </div>
  );
}
