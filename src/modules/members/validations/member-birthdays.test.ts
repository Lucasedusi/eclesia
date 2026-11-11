import { describe, expect, it } from "vitest";
import { birthdayCalendar, birthdayFiltersSchema, birthdayReportSchema } from "./member-birthdays";

describe("birthday calendar", () => {
  it("opens on today's birthday in Brasília across a UTC year boundary", () => {
    const calendar = birthdayCalendar(birthdayFiltersSchema.parse({}), new Date("2027-01-01T01:00:00Z"));
    expect(calendar.ranges).toEqual([[1231, 1231]]);
    expect(calendar.label).toContain("31 de dezembro de 2026");
  });

  it("includes leap-day birthdays when February is selected and every date for Todos", () => {
    const february = birthdayFiltersSchema.parse({ period: "month", month: "2" });
    expect(birthdayCalendar(february).ranges).toEqual([[201, 231]]);
    expect(birthdayCalendar({ ...february, period: "all" }).ranges).toEqual([]);
    expect(birthdayCalendar(birthdayFiltersSchema.parse({}), new Date("2028-02-29T12:00:00Z")).ranges).toEqual([[229, 229]]);
  });

  it.each([
    ["2026-12-31T12:00:00Z", [[1227, 1231], [101, 102]]],
    ["2025-03-01T12:00:00Z", [[223, 228], [301, 301]]],
    ["2024-02-29T12:00:00Z", [[225, 229], [301, 302]]],
    ["2026-11-15T02:50:00Z", [[1108, 1114]]],
    ["2026-11-15T03:00:00Z", [[1115, 1121]]],
  ])("uses the Sunday–Saturday calendar week in Brasília on %s", (timestamp, ranges) => {
    const filters = birthdayFiltersSchema.parse({ period: "week" });
    expect(birthdayCalendar(filters, new Date(timestamp)).ranges).toEqual(ranges);
  });

  it("normalizes short searches consistently for the page and PDF", () => {
    for (const [input, expected] of [[" ab ", ""], [" abc ", "abc"]]) {
      expect(birthdayFiltersSchema.parse({ search: input }).search).toBe(expected);
      expect(birthdayReportSchema.parse({ kind: "birthdays", format: "pdf", filters: { search: input } }).filters.search).toBe(expected);
    }
  });

  it("rejects unsupported months and report attempts to override eligibility or church", () => {
    expect(birthdayFiltersSchema.safeParse({ month: 13 }).success).toBe(false);
    for (const change of [{ status: "INACTIVE" }, { memberType: "VISITOR" }, { churchId: "other" }, { archived: true }, { page: 2 }]) {
      expect(birthdayReportSchema.safeParse({ kind: "birthdays", format: "pdf", filters: change }).success).toBe(false);
    }
    expect(birthdayReportSchema.safeParse({ kind: "birthdays", format: "xlsx", filters: {} }).success).toBe(false);
  });
});
