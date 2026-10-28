import { it, expect } from "vitest";
import { newEntryState, nextEntryDefaults, updateEntryState } from "./finance-entry-session";
it("follows the movement date until the reference is explicitly selected", () => {
  let state = newEntryState("2026-11-05");
  expect(state.referenceMonth).toBe("2026-11");
  state = updateEntryState(state, { date: "2026-12-01" });
  expect(state.referenceMonth).toBe("2026-12");
  state = updateEntryState(state, { referenceMonth: "2026-10" });
  state = updateEntryState(state, { date: "2027-01-01" });
  expect(state.referenceMonth).toBe("2026-10");
  expect(nextEntryDefaults(state, "next").referenceMonth).toBe("2027-01");
});
it("preserves an explicit reference even when it equals the current date's month", () => {
  const state = updateEntryState(newEntryState("2026-11-05"), { referenceMonth: "2026-11" });
  expect(updateEntryState(state, { date: "2026-12-01" }).referenceMonth).toBe("2026-11");
});
it("starts the next expense with an explicit empty identity after clearing the previous organization", () => {
  const state = { ...newEntryState("2026-10-27"), contributor: { kind: "ORGANIZATION" as const, name: "Empresa" }, personLabel: "Empresa", beneficiaryName: "Empresa" };
  expect(nextEntryDefaults(state, "next", "EXPENSE")).toMatchObject({ contributor: { kind: "COLLECTIVE" }, personLabel: "", beneficiaryName: "" });
});
it("retains working defaults and clears private contribution data only after confirmation", () => {
  const state = {
    ...newEntryState("2026-10-03", "key"),
    cashboxId: "box",
    paymentMethodId: "cash",
    categoryId: "cat",
    departmentId: "dep",
    contributor: { kind: "UNREGISTERED" as const, name: "Pessoa" },
    personLabel: "Pessoa",
    amount: "200,00",
    titheClassificationId: "role",
    documentIds: ["doc"],
    description: "Texto",
    notes: "Nota",
    documentNumber: "123",
    beneficiaryName: "Favorecido",
    paymentReference: "ref",
    detailsOpen: true,
  };
  const next = nextEntryDefaults(state, "next");
  expect(next).toMatchObject({
    date: state.date,
    cashboxId: "box",
    paymentMethodId: "cash",
    categoryId: "cat",
    departmentId: "dep",
    detailsOpen: true,
    operationKey: "next",
    contributor: null,
    personLabel: "",
    amount: "",
    titheClassificationId: null,
    documentIds: [],
    description: "",
    notes: "",
    documentNumber: "",
    beneficiaryName: "",
    paymentReference: "",
  });
  expect(state.contributor.name).toBe("Pessoa");
});
