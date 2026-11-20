import { devices, expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";

test.skip(!process.env.E2E_FINANCE_FIXTURE || !process.env.E2E_STORAGE_STATE, "Requer a sessão financeira local.");
test.use({ ...devices["iPhone 13"], browserName: "webkit" });

test("mantém o período em uma linha e restringe os links diretos", async ({ page }) => {
  const { headquartersId } = JSON.parse(readFileSync(process.env.E2E_FINANCE_FIXTURE!, "utf8"));
  const query = `?unidade=${headquartersId}&mes=2026-11`;
  for (const width of [320, 375, 390, 430]) {
    await page.setViewportSize({ width, height: 844 });
    for (const range of ["", "&dateFrom=2026-12-31&dateTo=2027-01-02"]) {
      await page.goto("/financeiro/lancamentos" + query + range);
      const period = page.locator(".finance-period-trigger");
      const label = period.locator("span");
      await expect(period).toHaveCSS("height", "48px");
      expect(await label.evaluate(el => el.scrollWidth <= el.clientWidth + 1)).toBe(true);
      await expect(label).toHaveCSS("white-space", "nowrap");
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
    }
  }
  await page.setViewportSize({ width: 320, height: 740 });
  await page.locator(".finance-period-trigger").click();
  const dialog = page.getByRole("dialog", { name: "Período dos lançamentos" });
  for (const mode of ["Mês", "Personalizado"]) {
    await dialog.getByRole("button", { name: mode, exact: true }).click();
    const apply = dialog.getByRole("button", { name: "Aplicar", exact: true });
    const button = (await apply.boundingBox())!;
    const footer = (await apply.locator("..").boundingBox())!;
    expect(button.x).toBeCloseTo(footer.x, 0);
    expect(button.width).toBeCloseTo(footer.width, 0);
  }
  await page.goto("/financeiro" + query);
  const month = page.getByLabel("Período", { exact: true });
  await expect(month).toHaveCSS("height", "48px");
  await expect(month).toHaveCSS("font-size", "16px");
  await expect(page.getByRole("link", { name: "Fluxo de caixa diário" })).toHaveCount(0);
  // A phone in landscape still receives the desktop-only notice.
  await page.setViewportSize({ width: 844, height: 390 });
  for (const route of ["fluxo-de-caixa", "configuracoes"]) {
    await page.goto("/financeiro/" + route + query);
    await expect(page.getByText(/Acesse pelo computador/)).toBeVisible();
    await expect(page.getByRole("link", { name: "Configurações", exact: true })).toHaveCount(0);
  }
});
