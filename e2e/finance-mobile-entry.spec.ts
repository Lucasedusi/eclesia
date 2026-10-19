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

test("mobile attendance keeps two contributions and one receipt", async ({
  page,
}) => {
  const f = fixture();
  await page.setViewportSize({ width: 390, height: 780 });
  await page.goto(`/financeiro/atendimento?unidade=${f.unitId}&mes=2026-10`);
  await page.getByRole("combobox", { name: "Caixa ou conta" }).selectOption(f.boxes[f.unitId].cash);
  await page.getByRole("combobox", { name: "Identificação" }).selectOption("UNREGISTERED");
  await page.getByRole("textbox", { name: "Nome da pessoa" }).fill("Pessoa Mobile Teste");
  await page.getByRole("combobox", { name: "Categoria" }).selectOption(f.titheId);
  await page.getByLabel("Valor (R$)").fill("1234");
  await page.getByRole("combobox", { name: "Classificação do dízimo" }).selectOption(f.classificationId);
  await page.getByRole("button", { name: "Adicionar contribuição" }).click();
  await page.getByRole("combobox", { name: "Categoria" }).nth(1).selectOption(f.offeringId);
  await page.getByLabel("Valor (R$)").nth(1).fill("500");
  await expect(page.getByTestId("attendance-total")).toHaveText("R$ 17,34");
  await expect(page.getByText("Conferir antes de confirmar")).toBeVisible();
  await expect(page.getByText("2 contribuições")).toBeVisible();
  await page.getByRole("button", { name: "Salvar", exact: true }).click();
  await expect(page.getByText("Atendimento confirmado.", { exact: false })).toBeVisible();
  await expect(page.getByRole("link", { name: "Abrir comprovante" })).toBeVisible();
});

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
