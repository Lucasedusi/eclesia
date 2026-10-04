import type { ContributorRef } from "../types/finance-command.types";
export type EntryFormState = {
  operationKey: string;
  date: string;
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
export function nextEntryDefaults(
  current: EntryFormState,
  operationKey: string,
): EntryFormState {
  return {
    ...newEntryState(current.date, operationKey),
    cashboxId: current.cashboxId,
    paymentMethodId: current.paymentMethodId,
    categoryId: current.categoryId,
    departmentId: current.departmentId,
    detailsOpen: current.detailsOpen,
  };
}
