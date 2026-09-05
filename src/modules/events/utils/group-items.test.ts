import { describe, expect, it } from "vitest";
import { mergeRequiredGroupItems } from "./group-items";

describe("mergeRequiredGroupItems", () => {
  it("adiciona os itens obrigatórios ausentes", () => {
    expect(mergeRequiredGroupItems([], [
      { id: "registration", minQuantity: 1 },
      { id: "meal", minQuantity: 2 },
    ])).toEqual([
      { itemId: "registration", quantity: 1 },
      { itemId: "meal", quantity: 2 },
    ]);
  });

  it("preserva itens opcionais e ajusta a quantidade mínima sem duplicar", () => {
    const selected = [
      { itemId: "shirt", quantity: 1 },
      { itemId: "registration", quantity: 1 },
    ];

    expect(mergeRequiredGroupItems(selected, [
      { id: "registration", minQuantity: 2 },
    ])).toEqual([
      { itemId: "shirt", quantity: 1 },
      { itemId: "registration", quantity: 2 },
    ]);
    expect(selected[1].quantity).toBe(1);
  });
});
