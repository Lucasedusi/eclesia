import type { ContributorRef } from "../types/finance-command.types";
export type EntryFormState = {
  operationKey: string;
  date: string;
  referenceMonth: string;
  referenceMonthManual: boolean;
  cashboxId: string;
  paymentMethodId: string;
  categoryId: string;
  departmentId: string;
  amount: string;
  titheClassificationId: string | null;
  contributor: ContributorRef | null;
  personLabel: string;
  beneficiaryName: string;
  paymentReference: string;
  documentIds: string[];
  documentNumber: string;
  description: string;
  notes: string;
  detailsOpen: boolean;
};
export function newEntryState(date: string, operationKey = ""): EntryFormState {
  return {
    operationKey,
    date,
    referenceMonth: date.slice(0, 7),
    referenceMonthManual: false,
    cashboxId: "",
    paymentMethodId: "",
    categoryId: "",
    departmentId: "",
    amount: "",
    titheClassificationId: null,
    contributor: null,
    personLabel: "",
    beneficiaryName: "",
    paymentReference: "",
    documentIds: [],
    documentNumber: "",
    description: "",
    notes: "",
    detailsOpen: false,
  };
}
export function updateEntryState(
  current: EntryFormState,
  patch: Partial<EntryFormState>,
): EntryFormState {
  const next = { ...current, ...patch };
  if (patch.referenceMonth !== undefined) next.referenceMonthManual = true;
  else if (patch.date !== undefined && !current.referenceMonthManual)
    next.referenceMonth = patch.date.slice(0, 7);
  return next;
}
export function nextEntryDefaults(
  current: EntryFormState,
  operationKey: string,
  direction: "INCOME" | "EXPENSE" = "INCOME",
): EntryFormState {
  return {
    ...newEntryState(current.date, operationKey),
    contributor: direction === "EXPENSE" ? { kind: "COLLECTIVE" } : null,
    cashboxId: current.cashboxId,
    paymentMethodId: current.paymentMethodId,
    categoryId: current.categoryId,
    departmentId: current.departmentId,
    detailsOpen: current.detailsOpen,
  };
}
