import { expect, test, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";

test.beforeEach(() => {
  test.skip(!process.env.E2E_FINANCE_FIXTURE, "Local fixture required");
  expect(process.env.E2E_BASE_URL).toBe("http://127.0.0.1:3217");
});
async function create(page: Page) {
  const f = JSON.parse(readFileSync(process.env.E2E_FINANCE_FIXTURE!, "utf8"));
  const name = `Conferência ${randomUUID()}`;
  await page.goto(`/financeiro/contas-a-pagar?mes=2026-10&search=${encodeURIComponent(name)}`);
  await page.getByRole("button", { name: "Nova conta", exact: true }).click();
  const modal = page.getByRole("dialog", { name: "Nova conta" });
  await modal.getByLabel("Nome da conta").fill(name);
  await modal.getByRole("combobox", { name: "Categoria", exact: true }).selectOption(f.expenseId);
  await modal.getByRole("button", { name: "Salvar conta", exact: true }).click();
  await expect(modal).toHaveCount(0);
  return name;
}

test("success feedback expires five seconds after the latest identical message", async ({ page }) => {
  await page.clock.install();
  const name = await create(page);
  const notice = page.getByRole("status").filter({ hasText: /^Conta salva\.$/ });
  await expect(notice).toBeVisible();
  await page.clock.fastForward(3000);
  await page.getByRole("button", { name: `Ações: ${name}`, exact: true }).click();
  await page.getByRole("button", { name: "Editar", exact: true }).click();
  const modal = page.getByRole("dialog", { name: "Editar conta" });
  await modal.getByLabel("Valor (R$)").fill("12,50");
  await modal.getByRole("button", { name: "Salvar conta", exact: true }).click();
  await expect(modal).toHaveCount(0);
  await page.clock.fastForward(3000);
  await expect(notice).toBeVisible();
  await page.clock.fastForward(2100);
  await expect(notice).toHaveCount(0);
});

for (const width of [1280, 320]) {
  test(`details feedback stays inside the actions button at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    const name = await create(page);
    const action = page.getByRole("button", { name: `Ações: ${name}`, exact: true });
    const title = page.getByRole("button", { name: `Detalhes: ${name}`, exact: true });
    for (const fromMenu of [false, true]) {
      let release!: () => void;
      const gate = new Promise<void>((resolve) => { release = resolve; });
      await page.route("**/financeiro/contas-a-pagar**", async (route) => {
        if (route.request().method() === "POST") await gate;
        await route.continue();
      });
      const before = await action.boundingBox();
      try {
        if (fromMenu) {
          await action.click();
          await page.getByRole("button", { name: "Detalhes", exact: true }).click();
        } else await title.click();
        await expect(action).toHaveAttribute("aria-busy", "true");
        await expect(action).toBeDisabled();
        await expect(action.locator("svg.finance-spin")).toBeVisible();
        await expect(title.locator("svg")).toHaveCount(0);
        const during = await action.boundingBox();
        expect(during!.width).toBe(before!.width);
        expect(during!.height).toBe(before!.height);
        if (fromMenu) await page.screenshot({ path: `tmp/payables-feedback-loading-${width}.png`, fullPage: true });
      } finally { release(); }
      const modal = page.getByRole("dialog", { name: "Detalhes da conta" });
      await expect(modal).toBeVisible();
      await page.unroute("**/financeiro/contas-a-pagar**");
      await modal.getByRole("button", { name: "Fechar", exact: true }).click();
      await expect(action).toHaveAttribute("aria-busy", "false");
      await expect(action).toBeEnabled();
    }
    for (const paid of [false, true]) {
      if (paid) {
        await page.getByRole("button", { name: `Pagar: ${name}`, exact: true }).click();
        await page.getByRole("dialog", { name: "Confirmar pagamento" }).getByRole("button", { name: "Confirmar pagamento", exact: true }).click();
        await expect(page.getByRole("dialog")).toHaveCount(0);
        await page.getByRole("tab", { name: /^Pagas/ }).click();
        await expect(title).toBeVisible();
      }
      await action.click();
      const menu = page.locator(".finance-payable-menu-items");
      await expect(menu).toBeVisible();
      const box = await menu.boundingBox();
      expect(box!.x).toBeGreaterThanOrEqual(0);
      expect(box!.x + box!.width).toBeLessThanOrEqual(width);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      await page.screenshot({ path: `tmp/payables-feedback-${paid ? "paid" : "pending"}-${width}.png`, fullPage: true });
      await action.click();
    }
  });
}
