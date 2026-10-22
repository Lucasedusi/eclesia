import { describe, expect, it } from "vitest";
import {
  deliveryTimeliness,
  sumCents,
  summarizeRanking,
} from "./finance-administrative";

describe("administrative report calculations", () => {
  it("distinguishes overdue pending, timely and late delivered reports using civil dates", () => {
    expect(deliveryTimeliness(null, "2026-10-08", "2026-10-08")).toBe(
      "Aguardando entrega",
    );
    expect(deliveryTimeliness(null, "2026-10-08", "2026-10-09")).toBe(
      "Em atraso",
    );
    expect(deliveryTimeliness("2026-10-08", "2026-10-08", "2026-10-22")).toBe(
      "No prazo",
    );
    expect(deliveryTimeliness("2026-10-09", "2026-10-08", "2026-10-22")).toBe(
      "Com atraso",
    );
  });
  it("rejects totals outside safe cent precision instead of rounding them", () => {
    expect(sumCents([100, -50, 20])).toBe(70);
    expect(() => sumCents([Number.MAX_SAFE_INTEGER, 1])).toThrow();
  });
  it("orders by income then name and preserves incomplete optional totals", () => {
    const result = summarizeRanking([
      {
        id: "b",
        name: "Beta",
        incomeCents: 10000,
        expenseCents: 1000,
        closingCents: 50000,
        grossPrebendCents: 100,
        transferCents: 200,
        missingMonths: 1,
        staleMonths: [],
      },
      {
        id: "a",
        name: "Alfa",
        incomeCents: 10000,
        expenseCents: 3000,
        closingCents: -2000,
        grossPrebendCents: 0,
        transferCents: 0,
        missingMonths: 0,
        staleMonths: [],
      },
      {
        id: "c",
        name: "Gama",
        incomeCents: 20000,
        expenseCents: 0,
        closingCents: 90000,
        grossPrebendCents: 200,
        transferCents: 500,
        missingMonths: 0,
        staleMonths: [],
      },
    ]);
    expect(result.rows.map((r) => r.name)).toEqual(["Gama", "Alfa", "Beta"]);
    expect(result.totals).toMatchObject({
      incomeCents: 40000,
      expenseCents: 4000,
      closingCents: 138000,
      grossPrebendCents: 300,
      transferCents: 700,
      missingMonths: 1,
    });
  });
});
