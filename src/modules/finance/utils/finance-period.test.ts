import {it,expect} from "vitest";
import {isLocalDate,monthOf,monthRange} from "./finance-period";
it("keeps civil dates and actual calendar boundaries",()=>{
 expect(monthOf("2026-10-01")).toBe("2026-10");expect(isLocalDate("2026-02-30")).toBe(false);
 expect(isLocalDate("2024-02-29")).toBe(true);expect(monthRange("2026-12")).toEqual({start:"2026-12-01",end:"2027-01-01"});
});
