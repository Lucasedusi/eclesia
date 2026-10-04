import { it, expect } from "vitest";
import { newEntryState, nextEntryDefaults } from "./finance-entry-session";
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
