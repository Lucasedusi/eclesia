import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { FinanceStatementDetail } from "./finance-statement-detail";
import { FinanceCashboxes } from "./finance-cashboxes";
import type { StatementVersionDTO } from "../types/finance-statement.types";

vi.mock("./finance-shell", () => ({
  useFinanceNavigation: () => ({ refresh: () => {} }),
}));
vi.mock("../actions/finance-command.actions", () => ({
  submitFinanceCommand: () => Promise.resolve({ ok: false }),
}));
vi.mock("../actions/finance-catalog.actions", () => ({
  saveFinanceCatalogAction: () => Promise.resolve({ ok: false }),
}));

const statement: StatementVersionDTO = {
  id: "version-2",
  month: "2026-10",
  revision: 2,
  createdAt: "2026-10-14T12:00:00Z",
  congregationName: "Centro",
  stale: false,
  sourceRevision: 2,
  configurationHash: "hash",
  ruleSetId: "rules",
  totalIncomeCents: 10000,
  eligibleIncomeCents: 8000,
  excludedIncomeCents: 2000,
  expenseCents: 0,
  grossPrebendCents: 1000,
  prebendDeductionCents: 100,
  netPastorCents: 900,
  cathedralTotalCents: 1500,
  distributionTotalCents: 2500,
  remainderCents: 7500,
  departments: [{ id: "missions", name: "Missões", participatesInBase: false, incomeCents: 2000, versionId: null }],
  items: [{ name: "Repasse", destination: "CATHEDRAL", role: "DISTRIBUTION", calculation: "ELIGIBLE_INCOME_PERCENT", percentage: "10", baseCents: 8000, calculatedCents: 800 }],
  sources: [],
};

describe("mobile secondary finance views", () => {
  it("keeps statement figures in one semantic table that can become labeled cards", () => {
    const html = renderToStaticMarkup(createElement(FinanceStatementDetail, { statement }));
    expect(html).toContain("Este demonstrativo não registra pagamentos");
    expect(html).toContain('class="finance-mobile-card-table"');
    expect(html).toContain('data-label="Participação"');
    expect(html).toContain('data-label="Base utilizada"');
    expect(html).toContain("Missões");
    expect(html).toContain("Fora da base");
  });

  it("shows cashbox balances but no edit actions when management is unavailable", () => {
    const html = renderToStaticMarkup(createElement(FinanceCashboxes, {
      unit: "unit-1",
      month: "2026-10",
      capabilities: { view: true, create: false, update: false, cancel: false, transfer: false, generateStatement: false, manageSettings: false, lookupContributors: false },
      catalogs: {
        departments: [], categories: [], classifications: [], paymentMethods: [],
        cashboxes: [{ id: "box-1", congregationId: "unit-1", name: "Caixa central", kind: "CASH", status: "ACTIVE", openingDate: null, openingCents: 0, balanceCents: 1200, paymentMethodIds: [], bankName: null, agency: null, accountNumber: null }],
      },
    }));
    expect(html).toContain("Caixa central");
    expect(html).toContain("12,00");
    expect(html).not.toContain("Ajustar saldo");
    expect(html).not.toContain("Novo caixa ou conta");
  });
});
