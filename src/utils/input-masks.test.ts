import { describe, expect, it } from "vitest";
import { formatBrazilCurrencyInput, formatBrazilPhone, parseBrazilCurrencyInput } from "./input-masks";

describe("máscaras brasileiras", () => {
  it("formata telefones fixos e celulares", () => {
    expect(formatBrazilPhone("62999998888")).toBe("(62) 99999-8888");
    expect(formatBrazilPhone("6233334444")).toBe("(62) 3333-4444");
  });

  it("formata e converte valores monetários sem perder centavos", () => {
    const formatted = formatBrazilCurrencyInput("12345");
    expect(formatted).toContain("123,45");
    expect(parseBrazilCurrencyInput(formatted)).toBe(123.45);
  });
});
