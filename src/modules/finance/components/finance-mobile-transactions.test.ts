import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { FinanceShell } from "./finance-shell";
import { FinanceTransactionsTable } from "./finance-transactions-table";

vi.mock("next/navigation", () => ({
  usePathname: () => "/financeiro/lancamentos",
  useSearchParams: () => new URLSearchParams("unidade=unit-1&mes=2026-10"),
  useRouter: () => ({ push: () => {}, refresh: () => {} }),
}));
vi.mock("../actions/finance-query.actions", () => ({
  getFinanceTransactionAction: () => Promise.resolve({ ok: false }),
}));
vi.mock("../actions/finance-document.actions", () => ({
  getFinanceDocumentUrlAction: () => Promise.resolve({ ok: false }),
}));

function renderTransactions(activeFilter = false) {
  const items = [
    {
      id: "entry-1",
      date: "2026-10-14",
      direction: "INCOME" as const,
      amountCents: 1234,
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
    {
      id: "entry-2",
      date: "2026-10-13",
      direction: "EXPENSE" as const,
      amountCents: 500,
      status: "CANCELLED",
      revision: 2,
      personName: null,
      beneficiaryName: "Fornecedor Exemplo",
      categoryName: "Despesa predial",
      departmentName: "Tesouraria",
      classificationName: null,
      description: null,
      documentNumber: null,
      attendanceId: null,
      cashboxId: "box-1",
      paymentMethodId: "cash",
    },
  ];
  return renderToStaticMarkup(
    createElement(
      FinanceShell,
      {
        context: {
          name: "Teste Local",
          churchName: "Igreja Teste",
          defaultUnitId: "unit-1",
          defaultMonth: "2026-10",
          units: [{ id: "unit-1", name: "Centro", isHeadquarters: false }],
        },
      } as Parameters<typeof FinanceShell>[0],
      createElement(FinanceTransactionsTable, {
        unit: "unit-1",
        month: "2026-10",
        catalogs: {
          departments: [],
          categories: [],
          classifications: [],
          paymentMethods: [],
          cashboxes: [],
        },
        filters: {
          month: "2026-10",
          search: "",
          direction: "ALL",
          status: activeFilter ? "CANCELLED" : "ALL",
          page: 1,
        },
        result: {
          items: activeFilter ? items.slice(1) : items,
          totalCount: activeFilter ? 1 : 2,
          filteredIncomeCents: activeFilter ? 0 : 1234,
          filteredExpenseCents: 0,
          page: 1,
          pageCount: 1,
        },
      }),
    ),
  );
}

describe("mobile finance transactions", () => {
  it("groups transaction cards by date with status and signed amounts", () => {
    const html = renderTransactions();
    expect(html).toContain('aria-label="Lançamentos em cartões"');
    expect(html).toContain("Pessoa Exemplo");
    expect(html).toContain("Fornecedor Exemplo");
    expect(html).toContain("13/10/2026");
    expect(html).toContain("14/10/2026");
    expect(html).toContain("+ R$ 12,34");
    expect(html).toContain("− R$ 5,00");
    expect(html).toContain("Cancelado");
  });

  it("shows immediate nature chips and the active advanced filter count", () => {
    const html = renderTransactions(true);
    expect(html).toContain('aria-label="Filtrar natureza"');
    expect(html).toContain('aria-pressed="true">Todas');
    expect(html).toContain("1 filtro ativo");
  });
});
