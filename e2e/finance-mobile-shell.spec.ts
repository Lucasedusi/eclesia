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
    for (const label of ["Início", "Lançamentos", "Atendimento", "Mais"])
      await expect(mobile.getByText(label, { exact: true })).toBeVisible();
    await expect(page.locator(".finance-sidebar")).toHaveCount(1);
    await expect(page.locator(".finance-sidebar")).toBeHidden();
    await expect(page.getByLabel("Período")).toBeVisible();
    await expect
      .poll(() => page.evaluate(() => document.documentElement.scrollWidth))
      .toBeLessThanOrEqual(width + 1);

    await mobile.getByRole("button", { name: "Mais" }).click();
    await expect(page.getByRole("link", { name: "Caixas e contas" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Relatórios" })).toBeVisible();
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

test("changing month with unsaved attendance asks before navigation", async ({
  page,
}) => {
  const { unitId } = fixture();
  await page.setViewportSize({ width: 390, height: 800 });
  await page.goto(`/financeiro/atendimento?unidade=${unitId}&mes=2026-10`);
  await page
    .getByRole("combobox", { name: "Identificação", exact: true })
    .selectOption("UNREGISTERED");
  await page
    .getByRole("textbox", { name: "Nome da pessoa", exact: true })
    .fill("Pessoa em preenchimento");
  await page.getByLabel("Período").fill("2026-09");
  await expect(
    page.getByRole("dialog", { name: "Há alterações não salvas" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Editar", exact: true }).click();
  await expect(
    page.getByRole("textbox", { name: "Nome da pessoa", exact: true }),
  ).toHaveValue("Pessoa em preenchimento");
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
