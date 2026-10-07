import { it, expect } from "vitest";
import {
  formatFinanceMonth,
  isLocalDate,
  monthOf,
  monthRange,
} from "./finance-period";
it("keeps civil dates and actual calendar boundaries", () => {
  expect(monthOf("2026-10-01")).toBe("2026-10");
  expect(isLocalDate("2026-02-30")).toBe(false);
  expect(isLocalDate("2024-02-29")).toBe(true);
  expect(monthRange("2026-12")).toEqual({
    start: "2026-12-01",
    end: "2027-01-01",
  });
});

it("formats effective months without timezone shifts", () => {
  expect(formatFinanceMonth("2026-10")).toBe("out/2026");
  expect(formatFinanceMonth("2026-10", true)).toBe("Outubro de 2026");
  expect(formatFinanceMonth("2027-01", true)).toBe("Janeiro de 2027");
});
