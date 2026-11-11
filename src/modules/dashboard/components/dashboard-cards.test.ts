import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { DashboardCards } from "./dashboard-cards";

function cards(total: number, male: number, female: number) {
  return renderToStaticMarkup(createElement(DashboardCards, { summary: {
    total, male, female, congregationName: null, congregations: null, regions: null, roles: null, fieldRoles: null,
  } }));
}

describe("composição por sexo no Dashboard", () => {
  it("inclui os cadastros sem sexo informado na legenda e na proporção", () => {
    const html = cards(10, 3, 5);
    expect(html).toContain("Não informado</dt><dd>2</dd>");
    expect(html).toContain('class="unknown" style="flex-grow:2"');
  });

  it("mantém os totais zerados legíveis quando o escopo não tem membros", () => {
    const html = cards(0, 0, 0);
    expect(html).toContain("Masculino</dt><dd>0</dd>");
    expect(html).toContain("Feminino</dt><dd>0</dd>");
    expect(html).not.toContain("Não informado");
    expect(html).not.toContain("flex-grow:");
  });
});
