"use client";

import dynamic from "next/dynamic";
import { useId, useRef, useState } from "react";
import { CalendarDays } from "lucide-react";
import { isLocalDate } from "../utils/finance-period";
import { FinanceFieldPopup } from "./finance-field-popup";
import styles from "./finance-pickers.module.css";

export const FinanceCalendar = dynamic(() => import("./finance-calendar"), {
  loading: () => (
    <p role="status" className={styles.empty}>
      Abrindo calendário…
    </p>
  ),
});

export function FinanceDateField({
  label,
  value,
  onChange,
  disabled,
  withCalendar = false,
}: {
  label: string;
  value: string;
  onChange: (iso: string) => void;
  disabled?: boolean;
  withCalendar?: boolean;
}) {
  const id = useId();
  const trigger = useRef<HTMLButtonElement>(null);
  const field = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState("");
  const display = isLocalDate(value)
    ? value.split("-").reverse().join("/")
    : draft;
  function edit(text: string) {
    const digits = text.replace(/\D/g, "");
    const formatted = /^\d{8}$/.test(text)
      ? digits.slice(0, 2) + "/" + digits.slice(2, 4) + "/" + digits.slice(4)
      : text;
    const iso = isLocalDate(text)
      ? text
      : formatted.split("/").reverse().join("-");
    const valid = isLocalDate(iso);
    field.current?.setCustomValidity(
      text && !valid ? "Informe uma data válida no formato dd/mm/aaaa." : "",
    );
    setDraft(valid ? "" : formatted);
    onChange(valid ? iso : "");
  }
  return (
    <div className={styles.field}>
      <label htmlFor={id}>{label}</label>
      <div className={styles.control}>
        <input
          ref={field}
          id={id}
          type="text"
          inputMode="numeric"
          autoComplete="off"
          maxLength={10}
          data-entry-focus={withCalendar || undefined}
          className={withCalendar ? styles.dateInput : undefined}
          placeholder="dd/mm/aaaa"
          value={display}
          required
          disabled={disabled}
          onChange={(event) => edit(event.target.value)}
        />
        {withCalendar && (
          <button
            type="button"
            ref={trigger}
            className={styles.dateTrigger}
            aria-label={`Abrir calendário de ${label.toLowerCase()}`}
            aria-expanded={open}
            aria-haspopup="dialog"
            disabled={disabled}
            onClick={() => setOpen(!open)}
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
          <div role="dialog" aria-label="Escolher data">
            <FinanceCalendar
              mode="single"
              value={value}
              onChange={(iso) => {
                edit(iso);
                setOpen(false);
                trigger.current?.focus();
              }}
            />
          </div>
        </FinanceFieldPopup>
      )}
    </div>
  );
}
