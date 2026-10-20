import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { ThemeProvider } from "styled-components";
import { theme } from "@/styles/theme";
import { FinanceReports } from "./finance-reports";
import { FinanceReceipt } from "./finance-receipt";

vi.mock("./finance-shell", () => ({
  useFinanceNavigation: () => ({ isPending: false }),
}));
vi.mock("../actions/finance-receipt.actions", () => ({
  recordFinancePrintAction: () => Promise.resolve({ ok: true }),
}));

describe("mobile finance documents", () => {
  it("offers one clear generation action with the existing report types and scope", () => {
    const html = renderToStaticMarkup(createElement(ThemeProvider, { theme }, createElement(FinanceReports, {
      unit: "unit-1", month: "2026-10", cashboxes: [{ id: "box-1", name: "Caixa central", status: "ACTIVE" }],
    })));
    expect(html).toContain("Sintético — resumo por categorias");
    expect(html).toContain("Analítico — lançamentos detalhados");
    expect(html).toContain("Todos os caixas e contas");
    expect(html).toContain("finance-mobile-report-controls");
    expect(html).toContain("Gerar relatório");
  });

  it("keeps receipt content and both thermal widths under one mobile control group", () => {
    const html = renderToStaticMarkup(createElement(ThemeProvider, { theme }, createElement(FinanceReceipt, {
      unit: "unit-1",
      receipt: {
        direction: "INCOME", id: "receipt-1", number: "A-1", revision: 1, status: "ACTIVE",
        congregationName: "Centro", personName: "Pessoa Teste", date: "2026-10-14",
        churchName: "Assembleia de Deus — Campo de Porangatu",
        congregationAddress: "Rua da Igreja, 25 · Centro · Porangatu / GO",
        logoDataUri: "data:image/png;base64,iVBORw0KGgo=",
        registeredAt: "2026-10-20T19:00:00Z",
        paymentMethodName: "Dinheiro", totalCents: 1234,
        items: [{ transactionId: "item-1", categoryName: "Oferta", departmentName: "Missões", classificationName: null, amountCents: 1234 }],
      },
    })));
    expect(html).toContain("finance-mobile-receipt-controls");
    expect(html).toContain("58 mm");
    expect(html).toContain("80 mm");
    expect(html).toContain("Imprimir comprovante");
    expect(html).toContain("Missões");
    const header = html.match(/<header[^>]*>([\s\S]*?)<\/header>/)![1];
    const footer = html.match(/<footer[^>]*>([\s\S]*?)<\/footer>/)![1];
    expect(header).toContain("Assembleia de Deus — Campo de Porangatu");
    expect(header).toContain("Rua da Igreja, 25");
    expect(header).toContain('alt="Logo da igreja"');
    expect(header.toLowerCase()).not.toContain("eclesias");
    expect(footer).toContain("Eclesias");
    expect(footer).toContain("Obrigado por sua contribuição.");
    expect(html).toContain("Nome:");
    expect(html).not.toContain("Pessoa:");
    expect(html).toContain("14/10/2026");
    expect(html).toContain("20/10/2026 às 16:00");
  });
});
