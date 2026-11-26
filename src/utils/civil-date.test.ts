import { expect, it } from "vitest";
import { isCivilDate } from "./civil-date";

it("accepts historic administrative dates and validates leap years", () => {
  expect(isCivilDate("1975-01-15")).toBe(true);
  expect(isCivilDate("2000-02-29")).toBe(true);
  expect(isCivilDate("1900-02-29")).toBe(false);
  expect(isCivilDate("2026-04-31")).toBe(false);
});
