import { expect, test, type Locator } from "@playwright/test";
import { readFileSync } from "node:fs";

test.beforeEach(() => {
  test.skip(!process.env.E2E_STORAGE_STATE || !process.env.E2E_FINANCE_FIXTURE,
    "Requires authenticated local financial fixture");
});

function location(screen: string) {
  const fixture = JSON.parse(readFileSync(process.env.E2E_FINANCE_FIXTURE!, "utf8"));
  return `/financeiro/${screen}?unidade=${fixture.headquartersId}&mes=2026-10`;
}

async function assertFooter(action: Locator, mobile: boolean, width: number) {
  const bounds = (await action.boundingBox())!;
  const footer = (await action.locator("..").boundingBox())!;
  expect(bounds.x).toBeGreaterThanOrEqual(0);
  expect(bounds.x + bounds.width).toBeLessThanOrEqual(width);
  if (mobile) {
    expect(Math.abs(bounds.width - footer.width)).toBeLessThan(2);
    expect(bounds.height).toBeGreaterThanOrEqual(44);
    await expect(action.locator("svg")).toBeVisible();
  } else {
    expect(bounds.width).toBeLessThan(footer.width * .8);
    await expect(action.locator("svg")).toBeHidden();
  }
}

for (const width of [320, 390, 1440]) {
  const mobile = width < 761;
  test(`secondary page space and modal actions remain usable at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 844 });
    for (const [screen, title] of [
      ["caixas", "Caixas e contas"], ["demonstrativos", "Demonstrativos"],
      ["relatorios", "Relatórios"], ["configuracoes", "Configurações financeiras"],
    ]) {
      await page.goto(location(screen));
      const heading = page.getByRole("heading", { name: title, exact: true });
      const bounds = (await heading.boundingBox())!;
      if (mobile) expect(bounds.width).toBeLessThanOrEqual(1);
      else expect(bounds.width).toBeGreaterThan(100);
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
    }
    for (const [screen, create] of [["caixas", "Novo caixa ou conta"], ["configuracoes", "Novo cadastro"]]) {
      await page.goto(location(screen));
      await page.getByRole("button", { name: create, exact: true }).click();
      const dialog = page.getByRole("dialog");
      const save = dialog.getByRole("button", { name: mobile ? "Salvar" : "Salvar cadastro", exact: true });
      await assertFooter(save, mobile, width);
      const cancel = dialog.getByRole("button", { name: "Cancelar", exact: true });
      if (mobile) await expect(cancel).toBeHidden();
      else await expect(cancel).toBeVisible();
      await save.click();
      await expect(dialog.getByRole("textbox", { name: "Nome", exact: true })).toBeFocused();
      await dialog.getByRole("textbox", { name: "Nome", exact: true }).fill("Cadastro não salvo para conferência");
      page.once("dialog", (confirmation) => confirmation.dismiss());
      await dialog.getByRole("button", { name: "Fechar modal" }).click();
      await expect(dialog).toBeVisible();
      page.once("dialog", (confirmation) => confirmation.accept());
      await dialog.getByRole("button", { name: "Fechar modal" }).click();
      await expect(dialog).toBeHidden();
    }
    await page.goto(location("caixas"));
    await page.getByRole("button", { name: "Ajustar saldo" }).first().click();
    const adjustment = page.getByRole("dialog");
    await assertFooter(adjustment.getByRole("button", {
      name: mobile ? "Ajustar" : "Registrar ajuste", exact: true,
    }), mobile, width);
    await adjustment.getByRole("button", { name: "Fechar modal" }).click();
  });

  test(`statement actions preserve history, generation and printing at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 844 });
    await page.goto(location("demonstrativos"));
    const generate = page.getByRole("button", { name: /Gerar (demonstrativo|nova versão)/ });
    await generate.click();
    const history = page.getByRole("button", { name: "Visualizar histórico", exact: true });
    const print = page.getByRole("button", { name: "Imprimir demonstrativo", exact: true });
    await expect(history).toBeVisible();
    await expect(generate).toBeEnabled();
    const actions = [history, print, generate];
    const boxes = await Promise.all(actions.map((action) => action.boundingBox()));
    for (const box of boxes) {
      expect(box!.x).toBeGreaterThanOrEqual(0);
      expect(box!.x + box!.width).toBeLessThanOrEqual(width);
      expect(Math.abs(box!.y - boxes[0]!.y)).toBeLessThan(2);
      if (mobile) {
        expect(Math.abs(box!.width - boxes[0]!.width)).toBeLessThan(2);
        expect(box!.height).toBeGreaterThanOrEqual(76);
      }
    }
    if (mobile) {
      for (let i = 0; i < actions.length; i++) {
        const action = actions[i];
        const icon = (await action.locator("svg").boundingBox())!;
        const label = (await action.getByText(["Histórico", "Imprimir", "Gerar"][i], { exact: true }).boundingBox())!;
        expect(icon.y + icon.height).toBeLessThanOrEqual(label.y);
      }
    } else {
      await expect(history.getByText("Visualizar histórico", { exact: true })).toBeVisible();
      await expect(print.getByText("Imprimir demonstrativo", { exact: true })).toBeVisible();
      await expect(generate.getByText("Gerar nova versão", { exact: true })).toBeVisible();
    }
    await history.click();
    const historyDialog = page.getByRole("dialog", { name: "Histórico de demonstrativos" });
    await expect(historyDialog.locator("[data-label='Versão']").first()).toBeVisible();
    await historyDialog.getByRole("button", { name: "Fechar modal" }).click();
    await page.evaluate(() => { window.print = () => { document.documentElement.dataset.printRequested = "true"; }; });
    await print.click();
    await expect(page.locator("html")).toHaveAttribute("data-print-requested", "true");
    await page.emulateMedia({ media: "print" });
    for (const action of actions) await expect(action).toBeHidden();
    await expect(page.locator(".finance-statement-meta")).toBeVisible();
  });
}
