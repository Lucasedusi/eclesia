import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";
test("finance fits small screens, keyboard focus and reduced motion", async ({
  page,
}) => {
  test.skip(
    !process.env.E2E_FINANCE_FIXTURE,
    "Local financial fixture required",
  );
  test.setTimeout(60000);
  const f = JSON.parse(readFileSync(process.env.E2E_FINANCE_FIXTURE!, "utf8"));
  await page.emulateMedia({ reducedMotion: "reduce" });
  for (const width of [320, 375, 640, 1024]) {
    await page.setViewportSize({ width, height: 900 });
    for (const route of [
      "",
      "/atendimento",
      "/lancamentos",
      "/demonstrativos",
      "/caixas",
      "/configuracoes",
    ]) {
      await page.goto(`/financeiro${route}?unidade=${f.unitId}&mes=2026-10`);
      await expect(page.locator("main h1").first()).toBeVisible();
      await expect
        .poll(() => page.evaluate(() => document.documentElement.scrollWidth), {
          message: `${width}px ${route}`,
        })
        .toBeLessThanOrEqual(width + 1);
    }
  }
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto(`/financeiro?unidade=${f.unitId}&mes=2026-10`);
  await expect(page.locator("main h1").first()).toBeVisible();
  await page.screenshot({ path: "tmp/finance-overview.png", fullPage: true });
  await page.goto(`/financeiro/atendimento?unidade=${f.unitId}&mes=2026-10`);
  await expect(page.locator("main h1").first()).toBeVisible();
  await page.screenshot({ path: "tmp/finance-attendance.png", fullPage: true });
  await page
    .getByRole("combobox", { name: "Identificação", exact: true })
    .selectOption("UNREGISTERED");
  await page
    .getByRole("textbox", { name: "Nome da pessoa", exact: true })
    .fill("Pessoa em preenchimento");
  await page.getByRole("link", { name: "Visão geral", exact: true }).click();
  await expect(
    page.getByRole("dialog", { name: "Há alterações não salvas" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Continuar editando" }).click();
  await expect(
    page.getByRole("textbox", { name: "Nome da pessoa", exact: true }),
  ).toHaveValue("Pessoa em preenchimento");
  await page.getByRole("link", { name: "Visão geral", exact: true }).click();
  await page.getByRole("button", { name: "Descartar", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Visão geral", exact: true }),
  ).toBeVisible();
  await page.goto(`/financeiro/lancamentos?unidade=${f.unitId}&mes=2026-10`);
  await page.getByRole("button", { name: "Nova entrada", exact: true }).click();
  await page.keyboard.press("Tab");
  await expect(page.getByRole("dialog").locator(":focus")).toHaveCount(1);
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
});
