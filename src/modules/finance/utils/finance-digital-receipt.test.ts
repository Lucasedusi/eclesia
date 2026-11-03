import { expect, it } from "vitest";
import { buildReceiptWhatsAppUrl, normalizeReceiptPhone, buildDigitalReceiptUrl, formatReceiptPhone } from "./finance-digital-receipt";

it("masks Brazilian phones while typing and pasting a country code", () => {
  expect(formatReceiptPhone("")).toBe("");
  expect(formatReceiptPhone("6")).toBe("(6");
  expect(formatReceiptPhone("62999991234")).toBe("(62) 99999-1234");
  expect(formatReceiptPhone("1133334444")).toBe("(11) 3333-4444");
  expect(formatReceiptPhone("5562999991234")).toBe("(62) 99999-1234");
  expect(formatReceiptPhone("+55 62 99999-1234")).toBe("+55 (62) 99999-1234");
  expect(formatReceiptPhone("+55 (55) 99999-1234")).toBe("+55 (55) 99999-1234");
  expect(normalizeReceiptPhone(formatReceiptPhone("+55 62 99999-1234"))).toBe("5562999991234");
});

it("preserves explicit international numbers and incomplete country codes", () => {
  expect(formatReceiptPhone("+")).toBe("+");
  expect(formatReceiptPhone("+5")).toBe("+5");
  expect(formatReceiptPhone("+55")).toBe("+55");
  expect(formatReceiptPhone("+351 912 345 678")).toBe("+351 912 345 678");
  expect(normalizeReceiptPhone(formatReceiptPhone("+351 912 345 678"))).toBe("351912345678");
});

it("normalizes Brazilian numbers and explicit international numbers", () => {
  expect(normalizeReceiptPhone("(62) 99999-1234")).toBe("5562999991234");
  expect(normalizeReceiptPhone("55 62 99999-1234")).toBe("5562999991234");
  expect(normalizeReceiptPhone("(11) 3333-4444")).toBe("551133334444");
  expect(normalizeReceiptPhone("+351 912 345 678")).toBe("351912345678");
});

it.each(["", "123", "00000000000", "62999991234abc", "javascript:1", "+00012345678", "12345678901234567890"])("rejects invalid phone %s", (phone) => {
  expect(() => normalizeReceiptPhone(phone)).toThrow();
});

it("opens a conversation with a link but no personal or financial message data", () => {
  const url = new URL(buildReceiptWhatsAppUrl("(62) 99999-1234", "https://igreja.test/comprovante/token"));
  expect(url.origin).toBe("https://wa.me");
  expect(url.pathname).toBe("/5562999991234");
  expect(url.searchParams.get("text")).toBe("Olá! Seu comprovante está disponível neste link: https://igreja.test/comprovante/token");
});

it("uses only the configured origin for a valid opaque token", () => {
  expect(buildDigitalReceiptUrl("a".repeat(43), "https://igreja.test/path?q=1")).toBe(`https://igreja.test/comprovante/${"a".repeat(43)}`);
  expect(buildDigitalReceiptUrl("a".repeat(43), "http://127.0.0.1:3217")).toContain(":3217/comprovante/");
  expect(() => buildDigitalReceiptUrl("invalid", "https://igreja.test")).toThrow();
  expect(() => buildDigitalReceiptUrl("a".repeat(43), "http://igreja.test")).toThrow();
  expect(() => buildDigitalReceiptUrl("a".repeat(43), "https://user:password@igreja.test")).toThrow();
});
