import { expect, it } from "vitest";
import { wrapReportText } from "./finance-report-layout";
it("wraps words and unbroken identifiers without losing content", () => {
  const text = "José da Conceição abcdefghijklmnopqrstuvwxyz";
  const lines = wrapReportText(text, 10, (s) => s.length);
  expect(lines.every((l) => l.length <= 10)).toBe(true);
  expect(lines.join("").replaceAll(" ", "")).toBe(text.replaceAll(" ", ""));
});
it("preserves paragraph boundaries and removes control characters", () => {
  expect(
    wrapReportText("Missões\nConstrução\u0000", 30, (s) => s.length),
  ).toEqual(["Missões", "Construção"]);
});
