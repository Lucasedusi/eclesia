import { describe, expect, it } from "vitest";
import { isStaticPixReceiptPath, safeStaticPixReceiptName } from "./static-pix-receipt";

const prefix = "church/events/event/public-individuals/checkout/static-pix/";

describe("static Pix receipt paths", () => {
  it("aceita somente um UUID de upload e um nome canônico", () => {
    expect(isStaticPixReceiptPath(`${prefix}123e4567-e89b-12d3-a456-426614174000/comprovante.pdf`, prefix)).toBe(true);
    expect(isStaticPixReceiptPath(`${prefix}123e4567-e89b-12d3-a456-426614174000/../../other.pdf`, prefix)).toBe(false);
    expect(isStaticPixReceiptPath(`${prefix}123e4567-e89b-12d3-a456-426614174000/%2e%2e%2fother.pdf`, prefix)).toBe(false);
    expect(isStaticPixReceiptPath(`${prefix}not-a-uuid/comprovante.pdf`, prefix)).toBe(false);
    expect(isStaticPixReceiptPath(`${prefix}123e4567-e89b-12d3-a456-426614174000/comprovante.pdf?x=1`, prefix)).toBe(false);
  });

  it("normaliza nomes sem permitir segmentos de diretório", () => {
    expect(safeStaticPixReceiptName("meu comprovante.pdf")).toBe("meu_comprovante.pdf");
    expect(safeStaticPixReceiptName("../../segredo.pdf")).toBe(".._.._segredo.pdf");
    expect(safeStaticPixReceiptName("..")).toBe("comprovante");
    expect(safeStaticPixReceiptName("/\\%?#")).toBe("_____");
  });
});
