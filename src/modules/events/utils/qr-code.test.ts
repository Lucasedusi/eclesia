import { describe, expect, it } from "vitest";
import { createQrMatrix, qrSvg } from "./qr-code";

describe("QR Code de credencial", () => {
  it("gera uma matriz QR versão 3 para o token opaco", () => { const matrix = createQrMatrix("a".repeat(48)); expect(matrix).toHaveLength(29); expect(matrix.every((row) => row.length === 29)).toBe(true); expect(matrix.flat().filter(Boolean).length).toBeGreaterThan(200); });
  it("gera o QR Code do Pix simulado compacto", () => { expect(() => createQrMatrix(`PIXTESTE:${"A".repeat(24)}`)).not.toThrow(); });
  it("não inclui o token como texto no SVG", () => { const token = "b".repeat(48); const svg = qrSvg(token); expect(svg).toContain("<svg"); expect(svg).not.toContain(token); });
  it("rejeita valores maiores que a capacidade segura", () => { expect(() => createQrMatrix("ç".repeat(40))).toThrow("QR_VALUE_TOO_LONG"); });
});
