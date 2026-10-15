import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";

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
} {
  return JSON.parse(readFileSync(process.env.E2E_FINANCE_FIXTURE!, "utf8"));
}

test("blocked mobile popup leaves full width PDF open and download actions", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 740 });
  await page.goto(`/financeiro/relatorios?unidade=${fixture().unitId}&mes=2026-10`);
  await page.evaluate(() => { window.open = () => null; });
  await page.getByRole("button", { name: "Gerar relatório" }).click();
  const ready = page.getByRole("region", { name: "Relatório gerado" });
  const open = ready.getByRole("link", { name: "Abrir PDF" });
  const download = ready.getByRole("link", { name: "Baixar PDF" });
  await expect(open).toBeVisible();
  await expect(download).toBeVisible();
  const bounds = await open.boundingBox();
  expect(bounds!.width).toBeGreaterThan(260);
  const bytes = await page.evaluate(async (url) => Array.from(new Uint8Array(await (await fetch(url!)).arrayBuffer())).slice(0, 4), await open.getAttribute("href"));
  expect(Buffer.from(bytes).toString()).toBe("%PDF");
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320);
});

test("thermal receipt keeps width and print controls within the phone", async ({ page }) => {
  const f = fixture();
  await page.setViewportSize({ width: 390, height: 780 });
  await page.goto(`/financeiro/atendimento?unidade=${f.unitId}&mes=2026-10`);
  await page.getByRole("combobox", { name: "Caixa ou conta" }).selectOption(f.boxes[f.unitId].cash);
  await page.getByRole("combobox", { name: "Identificação" }).selectOption("UNREGISTERED");
  await page.getByRole("textbox", { name: "Nome da pessoa" }).fill("Comprovante mobile teste");
  await page.getByRole("combobox", { name: "Categoria" }).selectOption(f.offeringId);
  await page.getByLabel("Valor (R$)").fill("1234");
  await page.getByRole("button", { name: "Confirmar atendimento" }).click();
  const href = await page.getByRole("link", { name: "Abrir comprovante" }).getAttribute("href");
  await page.goto(href!);
  const width = page.getByRole("combobox", { name: "Largura do papel" });
  await expect(width).toBeVisible();
  for (const mm of [58, 80]) {
    await width.selectOption(String(mm));
    await expect(page.locator(".financial-receipt")).toBeVisible();
  }
  await expect(page.getByRole("button", { name: "Imprimir comprovante" })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
});
