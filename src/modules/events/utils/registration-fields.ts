import type { EventRegistrationFieldRow, EventRegistrationFieldType } from "../types/event.types";

export function orderRegistrationFields(fields: EventRegistrationFieldRow[]) {
  return fields
    .map((field, index) => ({ field, index }))
    .sort((first, second) => first.field.sortOrder - second.field.sortOrder || first.index - second.index)
    .map(({ field }) => field);
}

export function visibleRegistrationFields(fields: EventRegistrationFieldRow[]) {
  return orderRegistrationFields(fields).filter((field) => field.active && field.visibility !== "HIDDEN");
}

export function formatRegistrationFieldValue(value: unknown, type?: EventRegistrationFieldType) {
  if (value === null || value === undefined || value === "") return "—";
  if (type === "DATE" && typeof value === "string") {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
    if (match) return `${match[3]}/${match[2]}/${match[1]}`;
  }
  if (typeof value === "boolean") return value ? "Sim" : "Não";
  if (Array.isArray(value)) return value.map(String).join(", ");
  return String(value);
}
