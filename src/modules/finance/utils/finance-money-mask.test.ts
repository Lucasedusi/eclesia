import { expect, it } from "vitest";
import { maskCurrencyInput, formatCurrencyInput } from "./finance-money-mask";
it("formats decimal typing and pasted BRL amounts without changing magnitude", () => {
  expect(maskCurrencyInput("1234")).toBe("1.234");
  expect(maskCurrencyInput("1234,5")).toBe("1.234,5");
  expect(maskCurrencyInput("R$ 1.234,56")).toBe("1.234,56");
  expect(formatCurrencyInput("1234")).toBe("1.234,00");
  expect(formatCurrencyInput("0")).toBe("0,00");
  expect(maskCurrencyInput("")).toBe("");
  expect(maskCurrencyInput("-12,50", true)).toBe("-12,50");
  expect(maskCurrencyInput("-", true)).toBe("-");
  expect(maskCurrencyInput("-12,50")).toBe("12,50");
  expect(maskCurrencyInput("1,234")).toBe("1,23");
});
