import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";

// Keep simulated network failures routable; the PWA suite covers the real worker.
test.use({ serviceWorkers: "block" });

test.beforeEach(() => {
  test.skip(
    !process.env.E2E_STORAGE_STATE || !process.env.E2E_FINANCE_FIXTURE,
    "Requires authenticated local financial fixture",
  );
});

function fixture(): {
  unitId: string;
  boxes: Record<string, { cash: string }>;
  offeringId: string;
  titheId: string;
  classificationId: string;
} {
  return JSON.parse(readFileSync(process.env.E2E_FINANCE_FIXTURE!, "utf8"));
}

for (const width of [320, 393, 430]) {
  test(`entry drawer remains usable at ${width}px`, async ({ page }) => {
    const f = fixture();
    await page.setViewportSize({ width, height: 700 });
    await page.goto(`/financeiro/lancamentos?unidade=${f.unitId}&mes=2026-10`);
    await page.getByRole("button", { name: "Entrada", exact: true }).click();
    const dialog = page.getByRole("dialog", { name: "Nova entrada" });
    await expect(dialog).toBeVisible();
    await expect.poll(async () => (await dialog.boundingBox())!.width).toBeGreaterThanOrEqual(width - 2);
    await dialog.getByLabel("Valor (R$)").fill("1234");
    await expect(dialog.getByLabel("Valor (R$)")).toHaveValue("12,34");
    await expect(dialog.getByText("Conferir antes de confirmar")).toBeVisible();
    await dialog.getByRole("button", { name: "Salvar", exact: true }).click();
    await expect(dialog.locator("input:invalid, select:invalid, textarea:invalid").first()).toBeFocused();
    await expect
      .poll(() => page.evaluate(() => document.documentElement.scrollWidth))
      .toBeLessThanOrEqual(width + 1);
    await page.setViewportSize({ width, height: 420 });
    await dialog.getByLabel("Valor (R$)").focus();
    await expect(dialog.getByLabel("Valor (R$)")).toBeFocused();
  });
}

test("uncertain mobile save preserves the filled form", async ({ page }) => {
  const f = fixture();
  await page.setViewportSize({ width: 390, height: 780 });
  await page.goto(`/financeiro/lancamentos?unidade=${f.unitId}&mes=2026-10`);
  await page.getByRole("button", { name: "Entrada", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Nova entrada" });
  await dialog.getByRole("combobox", { name: "Caixa ou conta" }).selectOption(f.boxes[f.unitId].cash);
  await dialog.getByRole("combobox", { name: "Identificação" }).selectOption("UNREGISTERED");
  await dialog.getByRole("textbox", { name: "Nome da pessoa" }).fill("Pessoa sem rede");
  await dialog.getByRole("combobox", { name: "Categoria" }).selectOption(f.offeringId);
  await dialog.getByLabel("Valor (R$)").fill("1234");
  await page.route(page.url(), async (route) => {
    await route.fetch();
    await route.abort("connectionfailed");
  }, { times: 1 });
  await dialog.getByRole("button", { name: "Salvar", exact: true }).click();
  await expect(dialog.getByRole("alert")).toBeVisible();
  await expect(dialog.getByRole("textbox", { name: "Nome da pessoa" })).toHaveValue("Pessoa sem rede");
  await expect(dialog.getByLabel("Valor (R$)")).toHaveValue("12,34");
  await expect(dialog.getByText("O preenchimento está preservado.", { exact: false })).toBeVisible();
});
