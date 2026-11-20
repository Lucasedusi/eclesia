import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";

test.beforeEach(() => {
  test.skip(
    !process.env.E2E_STORAGE_STATE || !process.env.E2E_FINANCE_FIXTURE,
    "Requires authenticated local financial fixture",
  );
});

function fixture(): {
  headquartersId: string;
  boxes: Record<string, { cash: string; bank: string }>;
} {
  return JSON.parse(readFileSync(process.env.E2E_FINANCE_FIXTURE!, "utf8"));
}

test("mobile transaction cards share filters, totals and details with the desktop table", async ({
  page,
}) => {
  const { headquartersId } = fixture();
  await page.setViewportSize({ width: 390, height: 820 });
  await page.goto(
    `/financeiro/lancamentos?unidade=${headquartersId}&mes=2026-10`,
  );
  const cards = page.getByRole("list", { name: "Lançamentos em cartões" });
  await expect(cards).toBeVisible();
  const desktopTable = page.locator(".finance-desktop-transactions");
  await expect(desktopTable).toHaveCount(1);
  await expect(desktopTable).toBeHidden();
  await expect(cards.getByText("Oferta de culto").first()).toBeVisible();
  await expect(page.getByText("Entradas filtradas")).toBeHidden();
  for (const card of await cards.getByRole("button").all()) {
    await expect(card.locator("time")).toHaveText(/\d{2}\/\d{2}\/\d{4}/);
    await expect(card.locator(".finance-payment-badge")).toBeVisible();
    await expect(card.locator(".finance-payment-badge svg")).toBeVisible();
    const amount = (await card.locator(".finance-mobile-transaction-side > strong").boundingBox())!;
    const badge = (await card.locator(".finance-payment-badge").boundingBox())!;
    const date = (await card.locator("time").boundingBox())!;
    expect(amount.x).toBeGreaterThan(date.x);
    expect(amount.y).toBeCloseTo(date.y, 0);
    expect(badge.y).toBeGreaterThan(amount.y + amount.height);
    expect(badge.x + badge.width).toBeCloseTo(amount.x + amount.width, 0);
  }

  await cards.getByRole("button", { name: /Oferta de culto/ }).first().click();
  await expect(page.getByRole("dialog", { name: "Detalhes do lançamento" })).toBeVisible();
  await page.getByRole("button", { name: "Fechar modal" }).click();

  const nature = page.getByRole("group", { name: "Filtrar movimento" });
  await nature.getByRole("button", { name: "Saídas" }).click();
  await expect(page).toHaveURL(/direction=EXPENSE/);
  await expect(page).toHaveURL(new RegExp(`unidade=${headquartersId}`));
  await expect(page).toHaveURL(/mes=2026-10/);
  await nature.getByRole("button", { name: "Todos" }).click();

  await page.getByRole("button", { name: /^Filtros/ }).click();
  await page.getByRole("combobox", { name: "Situação" }).selectOption("CANCELLED");
  const toggle = page.getByRole("button", { name: /1 filtro ativo/ });
  await expect(toggle).toBeVisible();
  const badge = toggle.locator(".finance-active-filter-count");
  await expect(badge).toHaveText("1");
  expect(await badge.evaluate(el => {
    const digits = document.createRange();
    digits.selectNodeContents(el);
    const text = digits.getBoundingClientRect();
    const circle = el.getBoundingClientRect();
    return text.top >= circle.top && text.bottom <= circle.bottom &&
      Math.abs(text.left + text.width / 2 - circle.left - circle.width / 2) < 1;
  })).toBe(true);
  await page.getByRole("button", { name: "Limpar filtros" }).click();
  await expect(page).not.toHaveURL(/status=CANCELLED/);
});

test("mobile transfers stay separate from entry and expense totals", async ({
  page,
}) => {
  const f = fixture();
  await page.setViewportSize({ width: 390, height: 820 });
  await page.goto(
    `/financeiro/lancamentos?unidade=${f.headquartersId}&mes=2026-10`,
  );
  await expect(page.getByRole("button", { name: "Transferir", exact: true })).toBeVisible();
  const totals = page.locator(".finance-filter-totals:visible");
  const before = await totals.textContent();
  await page.getByRole("button", { name: "Transferir", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Data", { exact: true }).fill("2026-10-19");
  await dialog.getByRole("combobox", { name: "Origem" }).selectOption(f.boxes[f.headquartersId].cash);
  await dialog.getByRole("combobox", { name: "Destino" }).selectOption(f.boxes[f.headquartersId].bank);
  await dialog.getByLabel("Valor (R$)").fill("1,00");
  const description = `Transferência mobile ${Date.now()}`;
  await dialog.getByLabel("Descrição").fill(description);
  await dialog.getByRole("button", { name: "Transferir", exact: true }).click();
  await expect(dialog).toHaveCount(0);
  await page.getByText("Transferências entre caixas", { exact: true }).click();
  await expect(page.locator(".finance-mobile-transfers").getByText(description)).toBeVisible();
  await expect(page.locator(".finance-mobile-transfers")).toBeVisible();
  await expect(totals).toHaveText(before!);
  // Transfers follow the same inclusive interval as the transaction list.
  await page.goto(`/financeiro/lancamentos?unidade=${f.headquartersId}&mes=2026-10&dateFrom=2026-09-29&dateTo=2026-10-05`);
  await expect(page.getByRole("list", { name: "Lançamentos em cartões" })).toBeVisible();
  await expect(page.locator(".finance-mobile-transfers").getByText(description)).toHaveCount(0);
  await page.goto(`/financeiro/lancamentos?unidade=${f.headquartersId}&mes=2026-10&dateFrom=2026-09-29&dateTo=2026-10-19`);
  await page.getByText("Transferências entre caixas", { exact: true }).click();
  await expect(page.locator(".finance-mobile-transfers").getByText(description)).toBeVisible();
});

test("mobile search preserves the list height and text entered while results load", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`/financeiro/lancamentos?unidade=${fixture().headquartersId}&mes=2026-10`);
  const results = page.locator(".finance-list-results");
  const search = page.getByRole("textbox", { name: "Buscar", exact: true });
  await expect(results.getByRole("list")).toBeVisible();
  const before = (await results.boundingBox())!.height;
  const hold = Promise.withResolvers<void>();
  await page.route(url => url.searchParams.get("search") === "sem-resultado", async route => {
    await hold.promise;
    await route.continue();
  });
  await search.fill("sem-resultado");
  await search.press("Enter");
  try {
    await expect(results.getByRole("status", { name: "Buscando lançamentos" })).toBeVisible();
    expect((await results.boundingBox())!.height).toBe(before);
    await expect(search).toBeFocused();
    await search.fill("próxima consulta");
  } finally {
    hold.resolve();
  }
  await expect(results).toContainText("Nenhum lançamento encontrado");
  await expect(search).toBeFocused();
  await expect(search).toHaveValue("próxima consulta");
});
