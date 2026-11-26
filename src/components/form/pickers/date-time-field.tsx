"use client";

import { useState } from "react";
import { DateField } from "./date-field";
import styles from "./pickers.module.css";

export function DateTimeField({ label, name, defaultValue = "", required = false }: {
  label: string;
  name: string;
  defaultValue?: string;
  required?: boolean;
}) {
  const [initialDate, initialTime] = defaultValue.split("T");
  const [date, setDate] = useState(initialDate);
  const [time, setTime] = useState(initialTime ?? "");
  return (
    <div className={styles.dateTime} data-field-name={name}>
      <DateField label={label} hideLabel value={date} onChange={setDate} required={required || Boolean(time)} />
      <input type="time" aria-label={`Horário de ${label.toLowerCase()}`} value={time} onChange={(event) => setTime(event.target.value)} required={required || Boolean(date)} />
      <input type="hidden" name={name} value={date && time ? `${date}T${time}` : ""} />
    </div>
  );
}
