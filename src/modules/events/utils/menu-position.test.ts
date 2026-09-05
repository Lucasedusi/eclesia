import { describe, expect, it } from "vitest";
import { positionAnchoredMenu } from "./menu-position";

describe("positionAnchoredMenu", () => {
  it("mantém um menu curto junto ao botão mesmo no fim da tabela", () => {
    expect(positionAnchoredMenu(
      { left: 900, right: 934, top: 700, bottom: 734 },
      { width: 220, height: 92 },
      { width: 1024, height: 768 },
    )).toEqual({ left: 714, top: 604 });
  });

  it("abre abaixo do botão quando há espaço disponível", () => {
    expect(positionAnchoredMenu(
      { left: 500, right: 534, top: 200, bottom: 234 },
      { width: 220, height: 180 },
      { width: 1024, height: 768 },
    )).toEqual({ left: 314, top: 238 });
  });
});
