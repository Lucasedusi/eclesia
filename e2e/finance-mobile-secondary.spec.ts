import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";

test.beforeEach(() => {
  test.skip(
    !process.env.E2E_STORAGE_STATE || !process.env.E2E_FINANCE_FIXTURE,
    "Requires authenticated local financial fixture",
  );
});

function unitId() {
  const fixture = JSON.parse(readFileSync(process.env.E2E_FINANCE_FIXTURE!, "utf8"));
  return fixture.headquartersId as string;
}

for (const width of [320, 390]) {
  test(`secondary finance screens fit ${width}px and keep their actions`, async ({ page }) => {
    await page.setViewportSize({ width, height: 760 });
    const unit = unitId();
    await page.goto(`/financeiro/caixas?unidade=${unit}&mes=2026-10`);
    await expect(page.getByRole("heading", { name: "Caixas e contas" })).toBeVisible();
    await expect(page.locator(".finance-cashbox").first()).toBeVisible();
    await expect(page.locator(".finance-cashbox .amount").first()).toBeVisible();
    await expect(page.getByRole("button", { name: "Ajustar saldo" }).first()).toBeVisible();

    await page.goto(`/financeiro/configuracoes?unidade=${unit}&mes=2026-10`);
    await expect(page.getByRole("heading", { name: "Configurações financeiras" })).toBeVisible();
    await expect(page.locator(".finance-mobile-card-table").first()).toBeVisible();
    await expect(page.getByRole("button", { name: "Novo cadastro" })).toBeVisible();
    await page.getByRole("button", { name: "Novo cadastro" }).click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await expect(page.locator("#finance-modal-root .finance-secondary-drawer")).toHaveCSS("width", `${width}px`);
    await page.getByRole("button", { name: "Fechar modal" }).click();

    await page.goto(`/financeiro/demonstrativos?unidade=${unit}&mes=2026-10`);
    await expect(page.getByRole("button", { name: /Gerar (demonstrativo|nova versão)/ })).toBeVisible();
    if (!(await page.getByText("Este demonstrativo não registra pagamentos.", { exact: false }).isVisible())) {
      await page.getByRole("button", { name: /Gerar (demonstrativo|nova versão)/ }).click();
    }
    await expect(page.getByText("Este demonstrativo não registra pagamentos.", { exact: false })).toBeVisible();
    await expect(page.locator(".finance-mobile-card-table").first()).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
  });
}

test("statement history identifies revision and status in a mobile drawer", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`/financeiro/demonstrativos?unidade=${unitId()}&mes=2026-10`);
  await page.getByRole("button", { name: /Gerar (demonstrativo|nova versão)/ }).click();
  await page.getByRole("button", { name: "Visualizar histórico" }).click();
  const history = page.getByRole("dialog", { name: "Histórico de demonstrativos" });
  await expect(history.locator(".finance-mobile-card-table tr").last()).toBeVisible();
  await expect(history.locator("[data-label='Versão']").first()).toBeVisible();
  await expect(history.locator("[data-label='Situação']").first()).toBeVisible();
});
