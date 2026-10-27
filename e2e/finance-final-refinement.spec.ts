import { expect, test, type Locator, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";

test.use({ serviceWorkers: "block" });
test.beforeEach(() => {
  test.skip(!process.env.E2E_STORAGE_STATE || !process.env.E2E_FINANCE_FIXTURE,
    "Requires authenticated local financial fixture");
});
const fixture = () => JSON.parse(readFileSync(process.env.E2E_FINANCE_FIXTURE!, "utf8"));
const location = (screen: string) =>
  `/financeiro/${screen}?unidade=${fixture().headquartersId}&mes=2026-10`;

async function within(container: Locator, element: Locator) {
  const parent = (await container.boundingBox())!;
  const child = (await element.boundingBox())!;
  expect(child.x).toBeGreaterThanOrEqual(parent.x);
  expect(child.x + child.width).toBeLessThanOrEqual(parent.x + parent.width + 1);
}

async function dirtyAttendance(page: Page) {
  await page.goto(location("atendimento"));
  await page.getByRole("combobox", { name: /Identificação/ }).selectOption("UNREGISTERED");
  await page.getByRole("textbox", { name: "Nome da pessoa", exact: true }).fill("Conferência final fictícia");
}

for (const width of [320, 390]) {
  test.describe(`mobile final refinement ${width}px`, () => {
    test.use({ viewport: { width, height: 844 }, isMobile: true, hasTouch: true });

    test("unsaved actions fit, preserve editing, validate saving and allow discard", async ({ page }) => {
      await dirtyAttendance(page);
      const nav = page.getByRole("navigation", { name: "Navegação financeira mobile" });
      await nav.getByRole("link", { name: "Lançamentos", exact: true }).click();
      const dialog = page.getByRole("dialog", { name: "Há alterações não salvas" });
      await expect(dialog).toBeVisible();
      for (const name of ["Editar", "Descartar", "Salvar"]) {
        const button = dialog.getByRole("button", { name, exact: true });
        await expect(button).toBeVisible();
        await within(dialog, button);
        const icon = (await button.locator("svg").boundingBox())!;
        const label = (await button.locator(".finance-mobile-only").last().boundingBox())!;
        expect(icon.y + icon.height).toBeLessThanOrEqual(label.y);
        expect((await button.boundingBox())!.height).toBeGreaterThanOrEqual(44);
      }
      await dialog.screenshot({ path: test.info().outputPath("unsaved-actions.png") });
      await dialog.getByRole("button", { name: "Editar", exact: true }).click();
      await expect(page.getByRole("textbox", { name: "Nome da pessoa", exact: true })).toHaveValue("Conferência final fictícia");
      await nav.getByRole("link", { name: "Lançamentos", exact: true }).click();
      await dialog.getByRole("button", { name: "Salvar", exact: true }).click();
      await expect(dialog).toBeVisible();
      await expect(page).toHaveURL(/\/atendimento/);
      await dialog.getByRole("button", { name: "Descartar", exact: true }).click();
      await expect(page).toHaveURL(/\/lancamentos/);
      await expect(dialog).toBeHidden();
    });

    test("report waiting page uses phone viewport and centers its content", async ({ page }) => {
      await page.goto(location("relatorios"));
      let release!: () => void;
      const held = new Promise<void>((resolve) => { release = resolve; });
      await page.route("**/api/finance/reports/pdf", async (route) => {
        await held;
        await route.fulfill({ status: 500, contentType: "application/json", body: '{"message":"Teste de recuperação"}' });
      });
      const opening = page.waitForEvent("popup");
      await page.getByRole("button", { name: "Gerar relatório", exact: true }).click();
      const popup = await opening;
      try {
        await expect(popup.locator('meta[name="viewport"]')).toHaveAttribute("content", "width=device-width, initial-scale=1");
        const box = (await popup.getByRole("status").boundingBox())!;
        const viewport = await popup.evaluate(() => ({ width: innerWidth, height: innerHeight, scroll: document.documentElement.scrollWidth }));
        expect(viewport.width).toBe(width);
        expect(viewport.scroll).toBeLessThanOrEqual(width);
        expect(Math.abs(box.x + box.width / 2 - width / 2)).toBeLessThan(2);
        expect(Math.abs(box.y + box.height / 2 - viewport.height / 2)).toBeLessThan(2);
        await expect(popup.getByRole("heading", { name: "Preparando relatório…" })).toBeVisible();
        await popup.screenshot({ path: test.info().outputPath("report-waiting.png") });
      } finally {
        release();
      }
      await expect.poll(() => popup.isClosed()).toBe(true);
      await expect(page.getByRole("button", { name: "Gerar relatório", exact: true })).toBeEnabled();
    });
  });
}

test("desktop review panels are highlighted and attendance actions align", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto(location("lancamentos"));
  for (const direction of ["entrada", "saída"]) {
    await page.getByRole("button", { name: `Nova ${direction}`, exact: true }).click();
    const dialog = page.getByRole("dialog", { name: `Nova ${direction}` });
    await expect(dialog.getByRole("region", { name: "Conferência do lançamento" })).toHaveCSS("background-color", "rgb(244, 248, 245)");
    await dialog.getByRole("region", { name: "Conferência do lançamento" })
      .screenshot({ path: test.info().outputPath(`review-${direction}.png`) });
    await dialog.getByRole("button", { name: "Fechar modal" }).click();
  }
  await dirtyAttendance(page);
  const primary = page.getByRole("button", { name: "Confirmar atendimento", exact: true });
  const secondary = page.getByRole("button", { name: "Salvar e continuar", exact: true });
  expect(Math.abs((await primary.boundingBox())!.width - (await secondary.boundingBox())!.width)).toBeLessThan(2);
  await page.locator(".finance-attendance-summary").screenshot({ path: test.info().outputPath("attendance-review.png") });
  await page.getByLabel("Período", { exact: true }).fill("2026-09");
  const dialog = page.getByRole("dialog", { name: "Há alterações não salvas" });
  await expect(dialog.getByRole("button", { name: "Continuar editando", exact: true })).toBeVisible();
  await expect(dialog.getByRole("button", { name: "Salvar e continuar", exact: true })).toBeVisible();
});

test("mobile saves the draft before navigating and shows a compact update status", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 844 });
  await dirtyAttendance(page);
  const f = fixture();
  const name = `Teste final ${Date.now()}`;
  await page.getByRole("textbox", { name: "Nome da pessoa", exact: true }).fill(name);
  await page.getByRole("combobox", { name: "Caixa ou conta", exact: true }).selectOption(f.boxes[f.headquartersId].cash);
  await page.getByRole("combobox", { name: "Categoria", exact: true }).selectOption(f.offeringId);
  await page.getByLabel("Valor (R$)", { exact: true }).fill("1234");
  let release!: () => void;
  const held = new Promise<void>((resolve) => { release = resolve; });
  await page.route("**/financeiro/lancamentos?**", async (route) => {
    await held;
    await route.continue();
  });
  await page.getByRole("navigation", { name: "Navegação financeira mobile" })
    .getByRole("link", { name: "Lançamentos", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Há alterações não salvas" });
  try {
    await dialog.getByRole("button", { name: "Salvar", exact: true }).click();
    await expect(dialog).toBeHidden();
    const progress = page.locator(".finance-progress");
    await expect(progress).toBeVisible();
    await expect(progress).toHaveText("Atualizando", { useInnerText: true });
    const bounds = (await progress.boundingBox())!;
    expect(bounds.x).toBeGreaterThanOrEqual(0);
    expect(bounds.x + bounds.width).toBeLessThanOrEqual(320);
    await expect(progress).toHaveCSS("white-space", "nowrap");
  } finally {
    release();
  }
  await expect(page).toHaveURL(/\/lancamentos/);
  await expect(page.getByRole("button", { name: `Abrir lançamento: Oferta de culto ${name}`, exact: false })).toBeVisible();
});
