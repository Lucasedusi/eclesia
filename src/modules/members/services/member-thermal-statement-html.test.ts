import { expect, it, vi } from "vitest";
import { renderMemberThermalStatement } from "./member-thermal-statement-html";
import type { MemberThermalStatement } from "../types/member-thermal-statement.types";
vi.mock("server-only", () => ({}));
const data: MemberThermalStatement = {
  churchName: "Campo de teste",
  logoDataUri: null,
  congregationName: "Congregação Central",
  memberName: "TESTE DA SILVA JÚNIOR",
  period: "01/11/2026 a 30/11/2026",
  category: "Ofertas missionárias",
  issuedAt: "2026-11-10T15:00:00Z",
  totalCents: 2300,
  items: [
    { date: "2026-11-01", category: "Ofertas missionárias", amountCents: 2300 },
  ],
};
it.each([
  [80, 74, 3, 3],
  [58, 47, 5, 6],
] as const)(
  "renders the %s mm printable strip without clipping money or injecting scripts",
  (width, printable, left, right) => {
    const html = renderMemberThermalStatement(data, width);
    expect(html).toContain(`width:${printable}mm`);
    expect(html).toContain(`margin:3mm ${right}mm 3mm ${left}mm`);
    expect(html).not.toMatch(/size:\s*(58|80)mm auto/);
    expect(html).toContain("Teste da Silva Júnior");
    expect(html.match(/Teste da Silva Júnior/g)).toHaveLength(1);
    expect(html).toContain("01/11/26");
    expect(html).toContain("23,00");
    expect(html).toContain("Eklesias");
    expect(html).toContain("01/11/2026 a 30/11/2026");
    expect(html).not.toContain("<script");
    expect(html).toContain("break-inside:avoid");
  },
);
it("escapes names/categories and refuses executable or remote logo sources", () => {
  const html = renderMemberThermalStatement(
    {
      ...data,
      churchName: '<script>alert("x")</script>',
      logoDataUri: '" onerror="alert(1)',
      items: [{ ...data.items[0], category: '<img src=x onerror="alert(1)">' }],
    },
    58,
  );
  expect(html).not.toContain("<img");
  expect(html).not.toContain("<script");
  expect(html).toContain("&lt;script&gt;");
  expect(html).toContain("&lt;img");
});
it("prints an explicit empty statement with zero contributions", () => {
  const html = renderMemberThermalStatement(
    { ...data, items: [], totalCents: 0 },
    80,
  );
  expect(html).toContain("Nenhuma entrada confirmada");
  expect(html).toContain("0 lançamento(s)");
  expect(html).toContain("0,00");
});
