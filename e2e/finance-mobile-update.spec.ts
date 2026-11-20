import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";

test.beforeEach(() => {
  test.skip(!process.env.E2E_STORAGE_STATE || !process.env.E2E_FINANCE_FIXTURE, "Requires authenticated local financial fixture");
});

function unitId() {
  return JSON.parse(readFileSync(process.env.E2E_FINANCE_FIXTURE!, "utf8")).unitId as string;
}

test("a waiting update preserves a dirty rules form until it is discarded", async ({ page }) => {
  await page.addInitScript(() => {
    const handlers = new Map<string, Set<() => void>>();
    const events = {
      addEventListener(name: string, listener: () => void) {
        if (!handlers.has(name)) handlers.set(name, new Set());
        handlers.get(name)!.add(listener);
      },
      removeEventListener(name: string, listener: () => void) { handlers.get(name)?.delete(listener); },
    };
    const state = window as Window & { __financePosted?: unknown[]; __financeControllerChange?: () => void };
    state.__financePosted = [];
    state.__financeControllerChange = () => handlers.get("controllerchange")?.forEach((listener) => listener());
    Object.defineProperty(navigator, "serviceWorker", {
      configurable: true,
      value: {
        ...events,
        controller: {},
        register: async () => ({ waiting: { postMessage: (message: unknown) => state.__financePosted!.push(message) }, installing: null, update: async () => {}, addEventListener: () => {}, removeEventListener: () => {} }),
      },
    });
  });
  await page.setViewportSize({ width: 1280, height: 780 });
  await page.goto(`/financeiro/configuracoes?unidade=${unitId()}&mes=2026-10`);
  await expect(page.getByText("Uma atualização está pronta.")).toBeVisible();
  await page.getByRole("button", {name: "Regras do demonstrativo"}).click();
  await page.getByLabel("Descrição do item", {exact:true}).first().fill("Rascunho protegido");
  await page.getByRole("button", { name: "Atualizar agora" }).click();
  await expect(page.getByText("Salve ou descarte o preenchimento antes de atualizar o aplicativo.")).toBeVisible();
  await expect(page.getByLabel("Descrição do item", {exact:true}).first()).toHaveValue("Rascunho protegido");
  expect(await page.evaluate(() => (window as Window & { __financePosted?: unknown[] }).__financePosted)).toEqual([]);

  await page.getByRole("link", { name: "Lançamentos", exact: true }).last().click();
  await page.getByRole("dialog", { name: "Há alterações não salvas" }).getByRole("button", { name: "Descartar" }).click();
  await expect(page).toHaveURL(/\/financeiro\/lancamentos/);
  await page.getByRole("button", { name: "Atualizar agora" }).click();
  expect(await page.evaluate(() => (window as Window & { __financePosted?: unknown[] }).__financePosted)).toEqual([{ type: "SKIP_WAITING" }]);

  await page.getByRole("link", {name:"Configurações",exact:true}).last().click();
  await page.getByRole("button", {name: "Regras do demonstrativo"}).click();
  await page.getByLabel("Descrição do item", {exact:true}).first().fill("Rascunho durante atualização");
  await page.evaluate(() => (window as Window & { __financeControllerChange?: () => void }).__financeControllerChange?.());
  await expect(page.getByLabel("Descrição do item", {exact:true}).first()).toHaveValue("Rascunho durante atualização");
  await expect(page.getByText("Salve ou descarte o preenchimento antes de atualizar o aplicativo.")).toBeVisible();
  await page.getByRole("link", { name: "Lançamentos", exact: true }).last().click();
  await page.getByRole("dialog", { name: "Há alterações não salvas" }).getByRole("button", { name: "Descartar" }).click();
  const loaded = page.waitForEvent("load");
  await page.getByRole("button", { name: "Atualizar agora" }).click();
  await loaded;
});

test("mobile widths and desktop keep their navigation without horizontal overflow", async ({ page }) => {
  for (const width of [320, 375, 390, 430, 1440]) {
    await page.setViewportSize({ width, height: 820 });
    await page.goto(`/financeiro?unidade=${unitId()}&mes=2026-10`);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width + 1);
    if (width < 761) {
      await expect(page.getByRole("navigation", { name: "Navegação financeira mobile" })).toBeVisible();
    } else {
      await expect(page.getByRole("navigation", { name: "Navegação financeira" })).toBeVisible();
    }
  }
});
