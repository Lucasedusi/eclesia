import { expect, it } from "vitest";
import { formatPersonName } from "./person-name";
it.each([
  ["MARIA DE SOUZA", "Maria de Souza"],
  ["JOÃO DOS SANTOS E SILVA", "João dos Santos e Silva"],
  ["  ANA-MARIA D’ÁVILA  ", "Ana-Maria D’Ávila"],
  ["JOSÉ II", "José II"],
  ["Não informado", "Não informado"],
  ["", ""],
])("formats personal name %s for presentation", (input, expected) =>
  expect(formatPersonName(input)).toBe(expected),
);
