import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";

test.use({ serviceWorkers: "block" });
test.beforeEach(() => test.skip(!process.env.E2E_STORAGE_STATE || !process.env.E2E_FINANCE_FIXTURE,
  "Requires authenticated local financial fixture"));
function location() {
  const f = JSON.parse(readFileSync(process.env.E2E_FINANCE_FIXTURE!, "utf8"));
  return `/financeiro/lancamentos?unidade=${f.headquartersId}&mes=2026-10`;
}

test("mobile resets only advanced filters, keeps nature/search and gives active feedback", async ({ page }) => {
  await page.setViewportSize({ width: 393, height: 852 });
  await page.goto(location());
  const clear = page.getByRole('button', { name: 'Limpar filtros', exact: true });
  await page.getByRole('button', { name: 'Entradas', exact: true }).click();
  await expect(page).toHaveURL(/direction=INCOME/);
  await expect(clear).toBeHidden();
  await page.getByRole('textbox', { name: 'Buscar', exact: true }).fill('Oferta');
  const clearSearch = page.getByRole('button', { name: 'Limpar busca', exact: true });
  await expect(clearSearch).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)');
  await page.getByRole('button', { name: 'Buscar lançamentos' }).click();
  await expect(page).toHaveURL(/search=Oferta/);
  await expect(clear).toBeHidden();
  const advanced = page.getByRole('button', { name: /Filtros avançados/ });
  await advanced.click();
  await expect(advanced).toHaveCSS('background-color', 'rgb(229, 244, 236)');
  await page.getByRole('combobox', { name: 'Situação' }).selectOption('CONFIRMED');
  await expect(page).toHaveURL(/status=CONFIRMED/);
  await advanced.click();
  await expect(advanced).toHaveCSS('background-color', 'rgb(229, 244, 236)');
  await expect(clear).toBeHidden();
  await advanced.click();
  await clear.click();
  await expect(page).not.toHaveURL(/status=/);
  await expect(page).toHaveURL(/search=Oferta/);
  await expect(page).toHaveURL(/direction=INCOME/);
  await clearSearch.click();
  await expect(page).not.toHaveURL(/search=/);
  await expect(page).toHaveURL(/direction=INCOME/);
});

test("mobile card shows localized loading, recovers after failure and opens details on retry", async ({ page }) => {
  await page.setViewportSize({ width: 393, height: 852 });
  await page.goto(location());
  const card = page.locator('.finance-mobile-transaction-card').first();
  await expect(card).toBeVisible();
  let release!: () => void;
  const gate = new Promise<void>(resolve => { release = resolve; });
  await page.route('**/financeiro/lancamentos?**', async route => {
    if (route.request().method() !== 'POST') return route.continue();
    await gate;
    await route.abort('connectionfailed');
  });
  await card.click();
  await expect(card).toHaveAttribute('aria-busy', 'true');
  await expect(card).toBeDisabled();
  await expect(card.getByRole('status')).toBeVisible();
  await expect(card.locator('.finance-mobile-transaction-main')).toHaveCSS('filter', 'blur(1px)');
  release();
  await expect(page.getByRole('alert')).toBeVisible();
  await expect(card).toBeEnabled();
  await expect(card.getByRole('status')).toHaveCount(0);
  await page.unroute('**/financeiro/lancamentos?**');
  await card.click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  await expect(dialog.locator('.finance-detail-revision')).toBeHidden();
  const history = dialog.locator('details').filter({ hasText: 'Histórico de alterações' });
  await expect(history).not.toHaveAttribute('open', '');
  await history.locator('summary').click();
  await expect(history.getByText('Revisão 1', { exact: true })).toBeVisible();
});

for (const width of [320, 1440]) {
  test(`entry review avoids duplicate item amounts and keeps totals at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto(location());
    await page.getByRole('button', { name: width < 761 ? 'Entrada' : 'Nova entrada', exact: true }).click();
    const dialog = page.getByRole('dialog');
    await dialog.getByLabel('Valor (R$)').fill('1234');
    const review = dialog.getByRole('region', { name: 'Conferência do lançamento' });
    await expect(review.locator('.finance-entry-review-items')).not.toContainText('12,34');
    await expect(review.locator('.finance-entry-review-total')).toContainText('12,34');
    if (width < 761) {
      await expect(dialog.getByText('A confirmação registra o lançamento.', { exact: true })).toBeVisible();
      await review.scrollIntoViewIfNeeded();
      await expect(dialog.locator('[data-modal-header]')).not.toHaveCSS('box-shadow', 'none');
      for (const name of ['Salvar e continuar', 'Salvar e imprimir']) {
        const action = dialog.getByRole('button', { name, exact: true });
        await expect(action.locator('.finance-action-icon')).toHaveCSS('border-right-width', '1px');
        const rect = (await action.boundingBox())!;
        expect(rect.x).toBeGreaterThanOrEqual(16);
        expect(rect.x + rect.width).toBeLessThanOrEqual(width - 16);
      }
    } else {
      await expect(dialog.getByText('A confirmação registra o lançamento e atualiza o caixa.', { exact: true })).toBeVisible();
      await expect(dialog.locator('[data-modal-header]')).toHaveCSS('box-shadow', 'none');
    }
    await page.goto(location());
    if (width < 761) await page.locator('.finance-mobile-transaction-card').first().click();
    else await page.locator('.finance-desktop-transactions').getByRole('button').first().click();
    const history = page.getByRole('dialog').locator('details').filter({ hasText: 'Histórico de alterações' });
    await expect(history).not.toHaveAttribute('open', '');
    await history.locator('summary').click();
    await expect(history.getByText('Revisão 1', { exact: true })).toBeVisible();
  });
}

test("mobile period applies inclusive cross-month dates and preserves them through filters", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 852 });
  await page.clock.setFixedTime(new Date('2026-10-02T14:00:00Z'));
  await page.goto(location() + '&page=2');
  await expect(page.getByRole('button', { name: 'Entrada', exact: true })).toBeVisible();
  const unitField = (await page.getByRole('combobox', { name: 'Congregação', exact: true }).boundingBox())!;
  const periodField = (await page.getByRole('button', { name: /^Período:/ }).boundingBox())!;
  expect(Math.abs(unitField.y - periodField.y)).toBeLessThanOrEqual(2);
  expect(periodField.width).toBeGreaterThanOrEqual(150);
  await page.getByRole('button', { name: /^Período:/ }).click();
  let dialog = page.getByRole('dialog', { name: 'Período dos lançamentos' });
  await dialog.getByRole('button', { name: 'Personalizado', exact: true }).click();
  await dialog.getByLabel('Data inicial').fill('2026-09-29');
  await dialog.getByLabel('Data final').fill('2026-10-05');
  await dialog.getByRole('button', { name: 'Aplicar', exact: true }).click();
  await expect(page).toHaveURL(/dateFrom=2026-09-29/);
  await expect(page).toHaveURL(/dateTo=2026-10-05/);
  await expect(page).not.toHaveURL(/(?:page|transferPage)=/);
  await expect(page.getByRole('button', { name: /^Período:/ })).toContainText('29/09 a 05/10/2026');
  await page.getByRole('button', { name: 'Entradas', exact: true }).click();
  await expect(page).toHaveURL(/direction=INCOME/);
  await expect(page).toHaveURL(/dateFrom=2026-09-29/);
  await page.getByRole('button', { name: /^Período:/ }).click();
  dialog = page.getByRole('dialog', { name: 'Período dos lançamentos' });
  await dialog.getByLabel('Data inicial').fill('2026-10-06');
  await expect(dialog.getByRole('button', { name: 'Aplicar', exact: true })).toBeDisabled();
  await dialog.getByRole('button', { name: 'Últimos 3 dias', exact: true }).click();
  await dialog.getByRole('button', { name: 'Aplicar', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page).toHaveURL(/dateFrom=2026-09-30/);
  await expect(page).toHaveURL(/dateTo=2026-10-02/);
  await page.getByRole('button', { name: /^Período:/ }).click();
  dialog = page.getByRole('dialog', { name: 'Período dos lançamentos' });
  await dialog.getByRole('button', { name: 'Últimos 7 dias', exact: true }).click();
  await dialog.getByRole('button', { name: 'Aplicar', exact: true }).click();
  await expect(page).toHaveURL(/dateFrom=2026-09-26/);
  await expect(page).toHaveURL(/dateTo=2026-10-02/);
  await page.getByRole('button', { name: /^Período:/ }).click();
  dialog = page.getByRole('dialog', { name: 'Período dos lançamentos' });
  await dialog.getByRole('button', { name: 'Mês', exact: true }).click();
  await dialog.getByLabel('Mês de referência').fill('2026-10');
  await dialog.getByRole('button', { name: 'Aplicar', exact: true }).click();
  await expect(page).not.toHaveURL(/dateFrom=|dateTo=/);
});
