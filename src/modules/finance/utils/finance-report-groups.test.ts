import { expect, it } from "vitest";
import { groupReportClassifications } from "./finance-report-groups";

it("collects interleaved classifications across cashboxes without changing recorded names or losing rows", () => {
  const rows = [
    {
      id: "a",
      classificationId: "1",
      classificationName: "Senhoras",
      amountCents: 100,
      cashboxName: "Banco",
    },
    {
      id: "b",
      classificationId: "2",
      classificationName: "Senhores",
      amountCents: 200,
      cashboxName: "Caixa",
    },
    {
      id: "c",
      classificationId: "1",
      classificationName: "Senhoras",
      amountCents: 300,
      cashboxName: "Caixa",
    },
    {
      id: "d",
      classificationId: null,
      classificationName: null,
      amountCents: 400,
      cashboxName: "Caixa",
    },
    {
      id: "e",
      classificationId: "1",
      classificationName: "Nome histórico",
      amountCents: 500,
      cashboxName: "Caixa",
    },
  ];
  const groups = groupReportClassifications(rows);
  expect(
    groups.map((g) => [g.name, g.rows.map((r) => r.id), g.totalCents]),
  ).toEqual([
    ["Senhoras", ["a", "c"], 400],
    ["Senhores", ["b"], 200],
    ["Sem classificação", ["d"], 400],
    ["Nome histórico", ["e"], 500],
  ]);
  expect(rows.map((r) => r.id)).toEqual(["a", "b", "c", "d", "e"]);
});

it("handles empty categories and unnamed historical classifications", () => {
  expect(groupReportClassifications([])).toEqual([]);
  expect(
    groupReportClassifications([
      {
        classificationId: "removed",
        classificationName: null,
        amountCents: 25,
      },
    ])[0].name,
  ).toBe("Sem classificação");
});
