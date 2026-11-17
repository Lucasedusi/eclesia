import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { FinanceShell } from "./finance-shell";
import { FinanceEntryForm } from "./finance-entry-form";

vi.mock("next/navigation", () => ({
  usePathname: () => "/financeiro/lancamentos",
  useSearchParams: () => new URLSearchParams("unidade=unit-1&mes=2026-10"),
  useRouter: () => ({ push: () => {}, refresh: () => {} }),
}));
vi.mock("../actions/finance-command.actions", () => ({
  submitFinanceCommand: () => Promise.resolve({ ok: false }),
}));
vi.mock("../actions/finance-contributor.actions", () => ({
  searchFinanceContributorsAction: () => Promise.resolve({ ok: true, data: [] }),
}));
vi.mock("../actions/finance-document.actions", () => ({
  uploadFinanceDocumentAction: () => Promise.resolve({ ok: false }),
  deleteFinanceDocumentAction: () => Promise.resolve({ ok: false }),
}));

const capabilities = {
  view: true,
  create: true,
  update: true,
  cancel: true,
  transfer: true,
  generateStatement: true,
  manageSettings: true,
  lookupContributors: true,
};

function renderEntry() {
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
            { id: "unit-1", name: "Centro", isHeadquarters: false, capabilities },
          ],
        },
      } as Parameters<typeof FinanceShell>[0],
      createElement(FinanceEntryForm, {
        unit: "unit-1",
        month: "2026-10",
        date: "2026-10-14",
        catalogs: {
          departments: [],
          categories: [],
          classifications: [],
          paymentMethods: [],
          cashboxes: [],
        },
        capabilities,
      }),
    ),
  );
}

describe("finance entry review", () => {
  it("shows the single-entry review without manual grouping", () => {
    const html = renderEntry();
    expect(html).toContain("Conferir antes de confirmar");
    expect(html).toContain("14/10/2026");
    expect(html).toContain("finance-entry-primary-action");
    expect(html).not.toContain("Adicionar contribuição");
  });

  it("shows the same review and total for a single entry", () => {
    const html = renderEntry();
    expect(html).toContain("Conferir antes de confirmar");
    expect(html).toContain("Total do lançamento");
    expect(html).toContain("Salvar e continuar");
    expect(html).toContain("Salvar e imprimir");
  });
});
