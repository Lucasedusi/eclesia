import { it, expect } from "vitest";
import {
  formatFinanceMonth,
  isLocalDate,
  monthOf,
  monthRange,
  recentFinanceRange,
  financeQueryRange,
  formatFinanceDateRange,
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

it("uses inclusive recent civil days across month/year and leap-day boundaries", () => {
  expect(recentFinanceRange(3, "2026-10-01")).toEqual({ dateFrom: "2026-09-29", dateTo: "2026-10-01" });
  expect(recentFinanceRange(7, "2026-01-03")).toEqual({ dateFrom: "2025-12-28", dateTo: "2026-01-03" });
  expect(recentFinanceRange(3, "2024-03-01")).toEqual({ dateFrom: "2024-02-28", dateTo: "2024-03-01" });
});

it("turns inclusive custom dates into an exclusive query end without shifting timezone", () => {
  expect(financeQueryRange({ month: "2026-10", dateFrom: "2025-12-31", dateTo: "2026-01-01" })).toEqual({ start: "2025-12-31", end: "2026-01-02" });
  expect(financeQueryRange({ month: "2026-10" })).toEqual({ start: "2026-10-01", end: "2026-11-01" });
  expect(() => financeQueryRange({ month: "2026-10", dateFrom: "2026-10-02" })).toThrow();
});

it("shows the applied years when an interval crosses years", () => {
  expect(formatFinanceDateRange("2026-09-29", "2026-10-05")).toBe("29/09 a 05/10/2026");
  expect(formatFinanceDateRange("2025-12-31", "2026-01-01")).toBe("31/12/2025 a 01/01/2026");
});

it("formats effective months without timezone shifts", () => {
  expect(formatFinanceMonth("2026-10")).toBe("out/2026");
  expect(formatFinanceMonth("2026-10", true)).toBe("Outubro de 2026");
  expect(formatFinanceMonth("2027-01", true)).toBe("Janeiro de 2027");
});
