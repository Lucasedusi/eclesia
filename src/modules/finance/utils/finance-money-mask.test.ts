import { expect, it } from "vitest";
import { maskCurrencyInput, formatCurrencyInput, formatPastedCurrency } from "./finance-money-mask";

it("inserts cents automatically while typing and deleting digits", () => {
  expect(["1", "12", "123", "1234"].map(v => maskCurrencyInput(v))).toEqual(["0,01", "0,12", "1,23", "12,34"]);
  expect(maskCurrencyInput("0,012")).toBe("0,12");
  expect(maskCurrencyInput("12,3")).toBe("1,23");
  expect(maskCurrencyInput("123456789")).toBe("1.234.567,89");
  expect(maskCurrencyInput("")).toBe("");
  expect(maskCurrencyInput("0")).toBe("0,00");
});
it("preserves loaded decimal amounts without dividing them by one hundred", () => {
  expect(formatCurrencyInput("1234")).toBe("1.234,00");
  expect(formatCurrencyInput("1234,5")).toBe("1.234,50");
  expect(formatCurrencyInput("1.234,56")).toBe("1.234,56");
  expect(formatCurrencyInput("")).toBe("");
});
it("preserves decimal pasted values and treats unformatted digits as cents", () => {
  expect(formatPastedCurrency("R$ 1.234,56")).toBe("1.234,56");
  expect(formatPastedCurrency("1234,5")).toBe("1.234,50");
  expect(formatPastedCurrency("1234.50")).toBe("1.234,50");
  expect(formatPastedCurrency("1234")).toBe("12,34");
});
it("supports signed adjustments without allowing a negative ordinary entry", () => {
  expect(maskCurrencyInput("-1234", true)).toBe("-12,34");
  expect(maskCurrencyInput("-", true)).toBe("-");
  expect(formatCurrencyInput("-12,50", true)).toBe("-12,50");
  expect(maskCurrencyInput("-1234")).toBe("12,34");
});
