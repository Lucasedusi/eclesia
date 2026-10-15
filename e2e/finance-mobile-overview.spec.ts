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

test("mobile overview prioritizes balance, actions and recent entries", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 820 });
  await page.goto(`/financeiro?unidade=${unitId()}&mes=2026-10`);
  await expect(page.getByText("Saldo ao final do período")).toBeVisible();
  await expect(page.getByText("Entradas no mês")).toBeVisible();
  await expect(page.getByText("Saídas no mês")).toBeVisible();

  const actions = page.getByRole("navigation", { name: "Ações rápidas" });
  await expect(actions).toBeVisible();
  for (const label of ["Atendimento", "Nova entrada", "Nova saída", "Caixas"])
    await expect(actions.getByRole("link", { name: label })).toBeVisible();
  const recent = await page.getByRole("heading", { name: "Últimos lançamentos" }).boundingBox();
  const chart = await page.getByRole("heading", { name: "Movimentação do mês" }).boundingBox();
  expect(recent!.y).toBeLessThan(chart!.y);

  await actions.getByRole("link", { name: "Nova saída" }).click();
  await expect(page).toHaveURL(/\/financeiro\/lancamentos\?/);
  await expect(page).toHaveURL(/unidade=/);
  await expect(page).toHaveURL(/mes=2026-10/);
  await expect(page.getByRole("dialog", { name: "Nova saída" })).toBeVisible();
});

test("desktop overview keeps quick actions hidden", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(`/financeiro?unidade=${unitId()}&mes=2026-10`);
  await expect(page.getByRole("navigation", { name: "Ações rápidas" })).toBeHidden();
});

test.describe("read only unit", () => {
  test.use({ storageState: "tmp/finance-observer-session.json" });

  test("has no shortcuts that write", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 820 });
    await page.goto(`/financeiro?unidade=${unitId()}&mes=2026-10`);
    const actions = page.getByRole("navigation", { name: "Ações rápidas" });
    await expect(actions.getByRole("link", { name: "Caixas" })).toBeVisible();
    for (const label of ["Atendimento", "Nova entrada", "Nova saída"])
      await expect(actions.getByRole("link", { name: label })).toHaveCount(0);
  });
});
