import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import type { FinanceCapabilities } from "../types/finance.types";
import { FinanceShell } from "./finance-shell";
import { FinanceOverview } from "./finance-overview";

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

function renderOverview(create: boolean) {
  const selected = { ...capabilities, create };
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
            { id: "unit-1", name: "Centro", isHeadquarters: false, capabilities: selected },
          ],
        },
      } as Parameters<typeof FinanceShell>[0],
      createElement(FinanceOverview, {
        overview: {
          openingCents: 10000,
          openingMovementCents: 0,
          incomeCents: 1200,
          expenseCents: 300,
          adjustmentCents: 0,
          closingCents: 10900,
          dailySeries: [],
          categorySeries: [],
        },
        recent: {
          items: [
            {
              id: "entry-1",
              date: "2026-10-14",
              direction: "INCOME",
              amountCents: 1200,
              status: "CONFIRMED",
              revision: 1,
              personName: "Pessoa Exemplo",
              beneficiaryName: null,
              categoryName: "Oferta",
              departmentName: "Tesouraria",
              classificationName: null,
              description: null,
              documentNumber: null,
              attendanceId: null,
              cashboxId: "box-1",
              paymentMethodId: "cash",
            },
          ],
          totalCount: 1,
          filteredIncomeCents: 1200,
          filteredExpenseCents: 0,
          page: 1,
          pageCount: 1,
        },
        unit: "unit-1",
        month: "2026-10",
      }),
    ),
  );
}

describe("finance mobile overview", () => {
  it("keeps recent entries and their scoped full-list link", () => {
    const html = renderOverview(true);
    expect(html).toContain("/financeiro/lancamentos?unidade=unit-1&amp;mes=2026-10");
    expect(html).toContain("Pessoa Exemplo");
    expect(html).toContain("Oferta");
    expect(html).toContain("12,00");
  });

  it("does not offer entry actions without create capability", () => {
    const html = renderOverview(false);
    expect(html).not.toContain("/financeiro/lancamentos?novo=");
    expect(html).toContain("/financeiro/caixas?unidade=unit-1&amp;mes=2026-10");
  });
});
