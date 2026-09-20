import { describe, expect, it } from "vitest";
import {
  formatBrazilCurrencyInput,
  formatBrazilPhone,
  formatBrazilZipCode,
  normalizeBrazilWhatsapp,
  parseBrazilCurrencyInput,
} from "./input-masks";

describe("máscaras brasileiras", () => {
  it("formata telefones fixos e celulares", () => {
    expect(formatBrazilPhone("62999998888")).toBe("(62) 99999-8888");
    expect(formatBrazilPhone("6233334444")).toBe("(62) 3333-4444");
  });

  it("normaliza o WhatsApp brasileiro com o código do país", () => {
    expect(normalizeBrazilWhatsapp("(62) 99999-8888")).toBe("5562999998888");
    expect(normalizeBrazilWhatsapp("5562999998888")).toBe("5562999998888");
    expect(normalizeBrazilWhatsapp("")).toBe("");
  });

  it("formata e converte valores monetários sem perder centavos", () => {
    const formatted = formatBrazilCurrencyInput("12345");
    expect(formatted).toContain("123,45");
    expect(parseBrazilCurrencyInput(formatted)).toBe(123.45);
  });

  it("formata o CEP sem aceitar mais de oito dígitos", () => {
    expect(formatBrazilZipCode("76550000")).toBe("76550-000");
    expect(formatBrazilZipCode("76.550-00099")).toBe("76550-000");
  });
});
