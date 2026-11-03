import { devices, expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";

test.beforeEach(() => {
  test.skip(!process.env.E2E_FINANCE_FIXTURE, "Local fixture required");
  expect(process.env.E2E_BASE_URL).toBe("http://127.0.0.1:3217");
});
const notice = "Contas a pagar está disponível apenas no computador.";

for (const width of [320, 390, 760]) {
  test(`payables is absent from mobile navigation and direct access at ${width}px`, async ({ page }) => {
    const { unitId } = JSON.parse(readFileSync(process.env.E2E_FINANCE_FIXTURE!, "utf8"));
    await page.setViewportSize({ width, height: 900 });
    await page.goto(`/financeiro?unidade=${unitId}&mes=2026-10`);
    const mobile = page.getByRole("navigation", { name: "Navegação financeira mobile" });
    await mobile.getByRole("button", { name: "Mais", exact: true }).click();
    await expect(mobile.getByRole("link", { name: "Contas a pagar", exact: true })).toHaveCount(0);
    await expect(mobile.getByRole("link", { name: "Caixas e contas", exact: true })).toBeVisible();
    await page.goto(`/financeiro/contas-a-pagar?unidade=${unitId}&mes=2026-10`);
    await expect(page.getByText(notice, { exact: true })).toBeVisible();
    await expect(page.locator(".finance-payables")).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Nova conta", exact: true })).toHaveCount(0);
    await page.screenshot({ path: `tmp/payables-desktop-only-${width}.png` });
    await page.getByRole("button", { name: "Voltar à visão geral", exact: true }).click();
    await expect(page).toHaveURL((url) => url.pathname === "/financeiro" && url.searchParams.get("unidade") === unitId && url.searchParams.get("mes") === "2026-10");
  });
}

for (const deviceName of ["iPhone 13 landscape", "iPad Pro 11"]) {
  test(`payables stays unavailable on ${deviceName}`, async ({ browser }) => {
    const context = await browser.newContext({ ...devices[deviceName], storageState: process.env.E2E_STORAGE_STATE });
    try {
      const page = await context.newPage();
      await page.goto(`${process.env.E2E_BASE_URL}/financeiro/contas-a-pagar?mes=2026-10`);
      await expect(page.getByText(notice, { exact: true })).toBeVisible();
      await expect(page.locator(".finance-payables")).toHaveCount(0);
      await expect(page.getByRole("link", { name: "Contas a pagar", exact: true })).toHaveCount(0);
      await expect(page.getByRole("button", { name: "Copiar para o próximo mês", exact: true })).toHaveCount(0);
    } finally { await context.close(); }
  });
}

test("desktop remains available and narrowing the screen removes an open payable modal", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/financeiro?mes=2026-10");
  await page.getByRole("link", { name: "Contas a pagar", exact: true }).click();
  await page.getByRole("button", { name: "Nova conta", exact: true }).click();
  await expect(page.getByRole("dialog", { name: "Nova conta" })).toBeVisible();
  await page.setViewportSize({ width: 760, height: 900 });
  await expect(page.getByText(notice, { exact: true })).toBeVisible();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.locator(".finance-payables")).toHaveCount(0);
  await page.setViewportSize({ width: 1280, height: 900 });
  await expect(page.getByRole("button", { name: "Nova conta", exact: true })).toBeVisible();
  await expect(page.getByRole("dialog")).toHaveCount(0);
});

test("mobile device detection does not bypass administrator authorization", async ({ browser }) => {
  const context = await browser.newContext({ ...devices["iPhone 13"], storageState: "tmp/finance-treasurer-session.json" });
  try {
    const page = await context.newPage();
    await page.goto(`${process.env.E2E_BASE_URL}/financeiro/contas-a-pagar?mes=2026-10`);
    await expect(page).toHaveURL(/\/acesso-negado/);
    await expect(page.getByText(notice, { exact: true })).toHaveCount(0);
  } finally { await context.close(); }
});
