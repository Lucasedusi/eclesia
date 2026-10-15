import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";

test.beforeEach(() => {
  test.skip(
    !process.env.E2E_STORAGE_STATE || !process.env.E2E_FINANCE_FIXTURE,
    "Requires authenticated local financial fixture",
  );
});

function unitId() {
  return JSON.parse(readFileSync(process.env.E2E_FINANCE_FIXTURE!, "utf8"))
    .unitId as string;
}

for (const width of [320, 393, 430]) {
  test(`mobile overview stays compact without losing navigation at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 852 });
    await page.goto(`/financeiro?unidade=${unitId()}&mes=2026-10`);
    const main = page.getByRole("main");
    await expect(main.getByText("SALDO FINAL", { exact: true })).toBeVisible();
    const cards = main.locator(".finance-overview-summaries > section");
    await expect(cards.nth(1).getByText("Entradas", { exact: true })).toBeVisible();
    await expect(cards.nth(2).getByText("Saídas", { exact: true })).toBeVisible();
    for (const card of [cards.nth(1), cards.nth(2)]) {
      await expect(card.getByText("Lançamentos confirmados")).toBeHidden();
      const title = await card.locator(".finance-summary-label").boundingBox();
      const icon = await card.locator(".finance-summary-icon").boundingBox();
      expect(Math.abs(title!.y + title!.height / 2 - icon!.y - icon!.height / 2)).toBeLessThan(2);
    }
    const income = await cards.nth(1).boundingBox();
    const expense = await cards.nth(2).boundingBox();
    expect(income!.y).toBe(expense!.y);
    expect(income!.height).toBe(expense!.height);
    await expect(page.locator(".finance-overview-heading")).toHaveCSS("position", "absolute");
    await expect(page.locator(".finance-topbar").getByText("Financeiro", { exact: true })).toBeHidden();
    await expect(page.getByRole("navigation", { name: "Ações rápidas" })).toBeHidden();
    await expect(page.getByRole("main").getByText("Saldo inicial", { exact: false })).toBeHidden();
    await expect(page.getByRole("heading", { name: "Movimentação do mês" })).toBeHidden();
    await expect(page.getByRole("heading", { name: "Por categoria" })).toBeVisible();
    await expect(page.getByLabel("Período")).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
    await page.getByRole("link", { name: "Ver todos" }).click();
    await expect(page).toHaveURL(/\/financeiro\/lancamentos\?/);
    await expect(page).toHaveURL(new RegExp(`unidade=${unitId()}`));
    await expect(page).toHaveURL(/mes=2026-10/);
  });
}

test("desktop keeps its full overview and original card labels", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(`/financeiro?unidade=${unitId()}&mes=2026-10`);
  await expect(page.getByRole("heading", { name: "Visão geral", exact: true })).toBeVisible();
  for (const label of ["Saldo ao final do período", "Entradas no mês", "Saídas no mês"])
    await expect(page.getByText(label, { exact: true })).toBeVisible();
  await expect(page.getByText("Lançamentos confirmados").first()).toBeVisible();
  await expect(page.getByRole("main").getByText("Saldo inicial", { exact: false })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Movimentação do mês" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Por categoria" })).toBeVisible();
  await expect(page.getByRole("table")).toBeVisible();
  await expect(page.getByRole("navigation", { name: "Navegação financeira mobile" })).toBeHidden();
});
