import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";

test.beforeEach(() => {
  test.skip(
    !process.env.E2E_STORAGE_STATE || !process.env.E2E_FINANCE_FIXTURE,
    "Requires authenticated local financial fixture",
  );
});

function fixture(): { unitId: string; headquartersId: string } {
  return JSON.parse(readFileSync(process.env.E2E_FINANCE_FIXTURE!, "utf8"));
}

for (const width of [320, 390]) {
  test(`mobile finance navigation works at ${width}px`, async ({ page }) => {
    const { unitId } = fixture();
    await page.setViewportSize({ width, height: 800 });
    await page.goto(`/financeiro?unidade=${unitId}&mes=2026-10`);

    const mobile = page.getByRole("navigation", {
      name: "Navegação financeira mobile",
    });
    await expect(mobile).toBeVisible();
    for (const label of ["Início", "Lançamentos", "Relatórios", "Mais"])
      await expect(mobile.getByText(label, { exact: true })).toBeVisible();
    await expect(page.locator(".finance-sidebar")).toHaveCount(1);
    await expect(page.locator(".finance-sidebar")).toBeHidden();
    await expect(page.getByLabel("Período", { exact: true })).toBeVisible();
    await expect
      .poll(() => page.evaluate(() => document.documentElement.scrollWidth))
      .toBeLessThanOrEqual(width + 1);

    await mobile.getByRole("button", { name: "Mais" }).click();
    await expect(page.getByRole("link", { name: "Caixas e contas" })).toBeVisible();
    await expect(mobile.getByRole("link", { name: "Configurações" })).toHaveCount(0);
    await expect(mobile.getByRole("link", { name: "Caixas e contas" })).toHaveCSS("gap", "12px");
    await expect(mobile.getByRole("group", { name: "Mais opções" }).getByRole("link", { name: "Relatórios" })).toHaveCount(0);
    await mobile.getByRole("link", { name: "Relatórios" }).click();
    await expect(page.getByText("Confira cada entrada e saída", { exact: true })).toBeVisible();
    await expect(page.getByText(/PDF em A4, pronto para conferir|Selecione o modelo e gere o relatório/)).toHaveCount(0);
    await expect(page).toHaveURL(new RegExp("/financeiro/relatorios\\?unidade=" + unitId + "&mes=2026-10"));
  });
}

test("desktop keeps the financial sidebar", async ({ page }) => {
  const { unitId } = fixture();
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(`/financeiro?unidade=${unitId}&mes=2026-10`);
  await expect(page.getByRole("complementary")).toBeVisible();
  await expect(
    page.getByRole("navigation", { name: "Navegação financeira mobile" }),
  ).toBeHidden();
});

test.describe("read only congregation", () => {
  test.use({ storageState: "tmp/finance-observer-session.json" });

  test("hides attendance and write actions", async ({ page }) => {
    const { unitId } = fixture();
    await page.setViewportSize({ width: 390, height: 800 });
    await page.goto(`/financeiro?unidade=${unitId}&mes=2026-10`);
    const mobile = page.getByRole("navigation", {
      name: "Navegação financeira mobile",
    });
    await expect(mobile).toBeVisible();
    await expect(mobile.getByText("Atendimento", { exact: true })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Entrada", exact: true })).toHaveCount(0);
  });
});
