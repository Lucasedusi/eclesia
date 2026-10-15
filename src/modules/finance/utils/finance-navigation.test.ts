import { expect, it } from "vitest";
import { financeLocation } from "./finance-navigation";
it("carries only unit and month between financial screens", () => {
  expect(financeLocation("/financeiro/caixas", "unit", "2026-10")).toBe(
    "/financeiro/caixas?unidade=unit&mes=2026-10",
  );
  expect(financeLocation("/membros", "unit", "2026-10")).toBe("/membros");
});

it("keeps the authorized unit and month when adding a mobile entry shortcut", () => {
  expect(
    financeLocation("/financeiro/lancamentos", "unit-1", "2026-10", {
      novo: "saida",
      unidade: "forged",
    }),
  ).toBe("/financeiro/lancamentos?novo=saida&unidade=unit-1&mes=2026-10");
  expect(
    financeLocation("/membros", "unit-1", "2026-10", { novo: "entrada" }),
  ).toBe("/membros");
});
