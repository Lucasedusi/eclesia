import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";
test.beforeEach(() =>
  test.skip(!process.env.E2E_FINANCE_FIXTURE, "Local fixture required"),
);
const fixture = () =>
  JSON.parse(readFileSync(process.env.E2E_FINANCE_FIXTURE!, "utf8"));
test("select filters apply immediately and clear preserves the financial context", async ({
  page,
}) => {
  const f = fixture();
  await page.goto(
    `/financeiro/lancamentos?unidade=${f.headquartersId}&mes=2026-10`,
  );
  await page
    .getByRole("button", { name: "Filtros avançados", exact: true })
    .click();
  await page
    .getByRole("combobox", { name: "Natureza", exact: true })
    .selectOption("EXPENSE");
  await expect(page).toHaveURL(/direction=EXPENSE/);
  await page
    .getByRole("combobox", { name: "Classificação do dízimo", exact: true })
    .selectOption(f.classificationId);
  await expect(page).toHaveURL(
    new RegExp(`titheClassificationId=${f.classificationId}`),
  );
  await page
    .getByRole("button", { name: "Limpar filtros", exact: true })
    .click();
  await expect(page).toHaveURL(
    new RegExp(`unidade=${f.headquartersId}&mes=2026-10$`),
  );
  await expect(
    page.getByRole("combobox", { name: "Natureza", exact: true }),
  ).toHaveValue("ALL");
});
test("sidebar keeps collapsed preference and cashbox cards have aligned balances", async ({
  page,
}) => {
  const f = fixture();
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto(`/financeiro/caixas?unidade=${f.unitId}&mes=2026-10`);
  await page
    .getByRole("button", { name: "Recolher menu", exact: true })
    .click();
  await page.reload();
  await expect(
    page.getByRole("button", { name: "Expandir menu", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Expandir menu", exact: true })
    .click();
  const cards = page.locator(".finance-cashbox");
  const first = await cards.nth(0).boundingBox(),
    second = await cards.nth(1).boundingBox();
  expect(Math.abs(first!.height - second!.height)).toBeLessThan(2);
  await expect(cards.getByText(/Abertura em/)).toHaveCount(0);
  await page.screenshot({
    path: "tmp/finance-usability-cashboxes.png",
    fullPage: true,
  });
});

test("existing statements require a clear justification and keep their history accessible", async ({
  page,
}) => {
  const f = fixture(),
    month = "2035-02";
  await page.goto(
    `/financeiro/demonstrativos?unidade=${f.headquartersId}&mes=${month}`,
  );
  await page
    .getByRole("button", { name: /Gerar (demonstrativo|nova versão)/ })
    .click();
  await expect(
    page.getByTestId("statement-cathedral-total").filter({ visible: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Ver demonstrativo" }),
  ).toHaveCount(0);
  await expect(
    page.getByText("Total distribuído", { exact: true }),
  ).toHaveCount(0);
  await page
    .getByRole("button", { name: "Visualizar histórico", exact: true })
    .click();
  await expect(
    page.getByRole("dialog", { name: "Histórico de demonstrativos" }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Ver demonstrativo" }).first(),
  ).toBeVisible();
  await page.getByRole("button", { name: "Fechar modal", exact: true }).click();
  await page.screenshot({
    path: "tmp/finance-usability-statements.png",
    fullPage: true,
  });
  await page.goto(
    `/financeiro/configuracoes?unidade=${f.headquartersId}&mes=${month}`,
  );
  await page
    .getByRole("button", { name: "Regras do demonstrativo", exact: true })
    .click();
  const reason = page.getByRole("textbox", {
    name: /^Justificativa da alteração/,
  });
  await expect(reason).toHaveAttribute("required", "");
  const cap = page.getByRole("textbox", {
    name: /Teto mensal da prebenda bruta/,
  });
  await cap.fill("3210,55");
  await page
    .getByRole("button", { name: "Salvar regras", exact: true })
    .click();
  await expect(reason).toBeFocused();
  await expect(cap).toHaveValue("3.210,55");
  await reason.fill("Ajuste do teto para conferência");
  await page
    .getByRole("button", { name: "Salvar regras", exact: true })
    .click();
  await expect(page.locator(".finance-progress")).toHaveCount(0);
  await expect(reason).toHaveValue("");
  await page.reload();
  await page
    .getByRole("button", { name: "Regras do demonstrativo", exact: true })
    .click();
  await expect(cap).toHaveValue("3.210,55");
});
test("mobile menu opens and closes without horizontal overflow", async ({
  page,
}) => {
  const f = fixture();
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto(
    `/financeiro/lancamentos?unidade=${f.headquartersId}&mes=2026-10`,
  );
  await expect(
    page.getByRole("navigation", { name: "Navegação financeira" }),
  ).toBeHidden();
  const mobile = page.getByRole("navigation", { name: "Navegação financeira mobile" });
  await mobile.getByRole("button", { name: "Mais", exact: true }).click();
  await expect(page.getByRole("group", { name: "Mais opções" })).toBeVisible();
  await page
    .getByRole("link", { name: "Caixas e contas", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Caixas e contas", exact: true }),
  ).toBeVisible();
  await expect(page.getByRole("group", { name: "Mais opções" })).toHaveCount(0);
  await expect(mobile).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: "tmp/finance-usability-mobile.png",
    fullPage: true,
  });
});
