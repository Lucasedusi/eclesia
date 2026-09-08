import { describe, expect, it } from "vitest";
import { mergeRequiredGroupItems, sortCaravans } from "./group-items";

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

describe("sortCaravans", () => {
  const rows = [
    { id: "3", originChurchName: "Igreja Betel", originCity: "Minaçu", total: 18, createdAt: "2026-09-03T10:00:00Z" },
    { id: "1", originChurchName: "Assembleia Central", originCity: "Porangatu", total: 42, createdAt: "2026-09-01T10:00:00Z" },
    { id: "2", originChurchName: "Comunidade da Fé", originCity: "Uruaçu", total: 7, createdAt: "2026-09-02T10:00:00Z" },
  ];

  it("ordena pelo maior e pelo menor número de inscrições sem alterar a lista original", () => {
    expect(sortCaravans(rows, "MOST_REGISTRATIONS").map((row) => row.id)).toEqual(["1", "3", "2"]);
    expect(sortCaravans(rows, "LEAST_REGISTRATIONS").map((row) => row.id)).toEqual(["2", "3", "1"]);
    expect(rows.map((row) => row.id)).toEqual(["3", "1", "2"]);
  });

  it("ordena alfabeticamente pelo nome da igreja de origem", () => {
    expect(sortCaravans(rows, "ALPHABETICAL_ASC").map((row) => row.id)).toEqual(["1", "2", "3"]);
    expect(sortCaravans(rows, "ALPHABETICAL_DESC").map((row) => row.id)).toEqual(["3", "2", "1"]);
  });

  it("preserva a ordem mais recente como padrão", () => {
    expect(sortCaravans(rows, "NEWEST").map((row) => row.id)).toEqual(["3", "2", "1"]);
  });
});
