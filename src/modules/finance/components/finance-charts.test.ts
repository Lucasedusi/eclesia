import { createElement } from "react";
import { renderToString } from "react-dom/server";
import { expect, it, vi } from "vitest";
import { FinanceCharts } from "./finance-charts";

it("renders complete accessible daily labels without React title warnings", () => {
  const errors = vi.spyOn(console, "error").mockImplementation(() => {});
  try {
    const html = renderToString(createElement(FinanceCharts, {
      overview: {
        openingCents: 0,
        openingMovementCents: 0,
        incomeCents: 1234,
        expenseCents: 500,
        adjustmentCents: 0,
        closingCents: 734,
        dailySeries: [{ date: "2026-10-14", incomeCents: 1234, expenseCents: 500 }],
        categorySeries: [],
      },
    }));
    expect(errors).not.toHaveBeenCalled();
    expect(html.replaceAll("\u00a0", " ")).toContain(
      "<title>14/10/2026: entradas R$ 12,34, saídas R$ 5,00</title>",
    );
  } finally {
    errors.mockRestore();
  }
});
