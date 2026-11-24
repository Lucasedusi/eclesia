import { expect, test, vi } from "vitest";
import { PDFDocument, StandardFonts } from "pdf-lib";
import { parseChartPdf } from "./pdf";
import { reviewAccounts, postingAccounts } from "./plan";

vi.mock("server-only", () => ({}));

async function pdf(rows: string[][]) {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const page = doc.addPage();
  [["Classificação", "Nome da Conta", "Chamada"], ...rows].forEach((row, i) =>
    row.forEach((cell, j) =>
      page.drawText(cell, {
        font,
        size: 9,
        x: [24, 150, 510][j],
        y: 720 - i * 16 + (j === 2 ? 1 : 0),
      }),
    ),
  );
  return doc.save();
}
const rows = [
  ["3", "Receitas", "0001"],
  ["3.01", "Doações", "0002"],
];
test("preserva códigos, identifica grupos e permite repetir o arquivo", async () => {
  const accounts = await parseChartPdf(await pdf(rows));
  expect(accounts[1]).toEqual({
    classification: "3.01",
    name: "Doações",
    code: "0002",
  });
  expect(postingAccounts(accounts)).toEqual([accounts[1]]);
  expect(reviewAccounts(accounts, accounts)).toEqual([]);
  expect(reviewAccounts([], accounts)).toHaveLength(2);
});
test("recusa linhas incompletas e chamadas duplicadas", async () => {
  await expect(
    parseChartPdf(await pdf([...rows, ["3.02", "Outra"]])),
  ).rejects.toThrow();
  await expect(
    parseChartPdf(await pdf([...rows, ["3.02", "Outra", "0002"]])),
  ).rejects.toThrow();
});

import {
  readMappingCells,
  reviewLinks,
  suggestLinks,
  type Category,
} from "./plan";
const repasse: Category = {
  id: "00000000-0000-4000-8000-000000000001",
  name: "Repasse",
  direction: "BOTH",
  income: null,
  expense: null,
  legacy: null,
};
const chart = [
  { classification: "3", code: "1", name: "Receitas" },
  { classification: "3.01", code: "012", name: "Repasse Congregações" },
  { classification: "4.01", code: "034", name: "Repasse à Catedral" },
];
test("sugere vínculos distintos nos dois sentidos, preservando o cadastro", () => {
  const suggestions = suggestLinks([repasse], chart);
  expect(reviewLinks(suggestions, [repasse], chart)).toEqual([
    { category: repasse.id, name: "Repasse", direction: "INCOME", code: "012" },
    {
      category: repasse.id,
      name: "Repasse",
      direction: "EXPENSE",
      code: "034",
    },
  ]);
  expect(suggestLinks([{ ...repasse, income: "100" }], chart)).toHaveLength(1);
});
test("as células coladas exigem seleção e a criação de uma categoria exige confirmação", () => {
  const [draft] = readMappingCells(
    "Categoria\tMovimento\tChamada\nCategoria nova\tSaída\t034",
  );
  expect(reviewLinks([draft], [], chart)).toEqual([]);
  expect(() =>
    reviewLinks([{ ...draft, selected: true }], [], chart),
  ).toThrow();
  expect(
    reviewLinks([{ ...draft, selected: true, create: true }], [], chart)[0]
      .category,
  ).toBeNull();
});
test("lê a aba Categorias, prioriza os valores confirmados e descarta linhas sem código", () => {
  const text =
    "Nome no plano antigo\tMovimento\tCódigo Alterdata\tCadastro no Eclesias\tCódigo vigente confirmado\nAntigo\tEntrada\t7\tRepasse\t012\nOutro\tEntrada\tA conferir\t\t";
  expect(readMappingCells(text)).toEqual([
    {
      name: "Repasse",
      direction: "INCOME",
      code: "012",
      create: false,
      selected: false,
    },
  ]);
});
test("não sugere homônimos, nem aceita grupo ou movimentações conflitantes", () => {
  expect(
    suggestLinks([repasse], [...chart, { ...chart[1], code: "456" }]),
  ).toHaveLength(1);
  const [draft] = suggestLinks([repasse], chart);
  expect(() =>
    reviewLinks([{ ...draft, code: "1" }], [repasse], chart),
  ).toThrow();
  expect(() => reviewLinks([draft, draft], [repasse], chart)).toThrow();
});
