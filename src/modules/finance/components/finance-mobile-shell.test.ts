import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import type { FinanceCapabilities } from "../types/finance.types";
import { FinanceShell } from "./finance-shell";
import { FinanceContextBar } from "./finance-context-bar";

vi.mock("next/navigation", () => ({
  usePathname: () => "/financeiro",
  useSearchParams: () => new URLSearchParams("unidade=unit-1&mes=2026-10"),
  useRouter: () => ({ push: () => {}, refresh: () => {} }),
}));

const capabilities: FinanceCapabilities = {
  view: true,
  create: true,
  update: true,
  cancel: true,
  transfer: true,
  generateStatement: true,
  manageSettings: true,
  lookupContributors: true,
};

function renderShell(create: boolean) {
  return renderToStaticMarkup(
    createElement(
      FinanceShell,
      {
        context: {
          name: "Teste Local",
          churchName: "Igreja Teste",
          defaultUnitId: "unit-1",
          defaultMonth: "2026-10",
          units: [
            {
              id: "unit-1",
              name: "Congregação Centro",
              isHeadquarters: false,
              capabilities: { ...capabilities, create },
            },
          ],
        },
      } as Parameters<typeof FinanceShell>[0],
      createElement("p", null, "Conteúdo"),
    ),
  );
}

describe("finance mobile shell", () => {
  it("renders the touch navigation with the selected unit and month", () => {
    const html = renderShell(true);
    expect(html).toContain('aria-label="Navegação financeira mobile"');
    expect(html).toContain("Início");
    expect(html).toContain("Mais");
    expect(html).toContain("/financeiro/atendimento?unidade=unit-1&amp;mes=2026-10");
  });

  it("hides attendance when the selected unit cannot create entries", () => {
    const html = renderShell(false);
    expect(html).toContain('aria-label="Navegação financeira mobile"');
    expect(html).not.toContain("/financeiro/atendimento?");
  });

  it("shows a single congregation as text instead of a disabled selector", () => {
    const html = renderToStaticMarkup(
      createElement(FinanceContextBar, {
        units: [{ id: "unit-1", name: "Congregação Centro", isHeadquarters: false }],
        selectedUnitId: "unit-1",
        month: "2026-10",
        onChange: () => {},
      }),
    );
    expect(html).toContain("Congregação Centro");
    expect(html).not.toContain("<select");
  });
});
