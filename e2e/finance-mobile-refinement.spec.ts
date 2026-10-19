import { expect, test, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";

test.use({ serviceWorkers: "block" });
test.beforeEach(() => {
  test.skip(!process.env.E2E_STORAGE_STATE || !process.env.E2E_FINANCE_FIXTURE,
    "Requires authenticated local financial fixture");
});
function fixture(): {
  unitId: string; headquartersId: string; offeringId: string;
  boxes: Record<string, { cash: string }>;
} {
  return JSON.parse(readFileSync(process.env.E2E_FINANCE_FIXTURE!, "utf8"));
}
async function fitsViewport(page: Page) {
  const { width } = page.viewportSize()!;
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
}
for (const width of [320, 393, 430]) {
  test(`transaction controls use the available width at ${width}px`, async ({ page }) => {
    const f = fixture();
    await page.setViewportSize({ width, height: 852 });
    await page.goto(`/financeiro/lancamentos?unidade=${f.headquartersId}&mes=2026-10`);
    await expect(page.getByRole('button', { name: 'Entrada', exact: true })).toBeVisible();
    const header = await page.locator('.finance-topbar:visible').boundingBox();
    const context = await page.locator('.finance-context:visible').boundingBox();
    expect(context!.width).toBeGreaterThanOrEqual(header!.width - 34);
    const actions = ['Entrada', 'Saída', 'Transferir'];
    const boxes = [];
    for (const name of actions) boxes.push((await page.getByRole('button', { name, exact: true }).boundingBox())!);
    expect(new Set(boxes.map(b => Math.round(b.y))).size).toBe(1);
    expect(boxes[0].x).toBeLessThan(boxes[1].x);
    expect(boxes[1].x).toBeLessThan(boxes[2].x);
    const input = page.getByRole('textbox', { name: 'Buscar' });
    const search = page.getByRole('button', { name: 'Buscar lançamentos', exact: true });
    const filters = page.getByRole('button', { name: /Filtros avançados/ });
    const ib = (await input.boundingBox())!, sb = (await search.boundingBox())!, fb = (await filters.boundingBox())!;
    expect(sb.x).toBeGreaterThan(ib.x);
    expect(sb.x + sb.width).toBeLessThanOrEqual(ib.x + ib.width);
    expect(Math.abs(fb.y - ib.y)).toBeLessThanOrEqual(2);
    await input.fill('Nenhum lançamento deste teste');
    await search.click();
    await expect(page).toHaveURL(/search=Nenhum/);
    await input.fill('Oferta');
    await input.press('Enter');
    await expect(page).toHaveURL(/search=Oferta/);
    await page.getByRole('button', { name: 'Limpar busca' }).click();
    await expect(page).not.toHaveURL(/search=/);
    await fitsViewport(page);
    await page.getByRole('button', { name: 'Transferir', exact: true }).click();
    const dialog = page.getByRole('dialog');
    const transfer = await dialog.getByRole('button', { name: 'Transferir', exact: true }).boundingBox();
    const db = (await dialog.boundingBox())!;
    expect(transfer!.width).toBeGreaterThanOrEqual(db.width - 40);
    await fitsViewport(page);
  });
}
for (const wholeAttendance of [false, true]) {
  test(`mobile cancellation targets ${wholeAttendance ? 'the whole attendance with a safe retry' : 'only the selected transaction by default'}`, async ({ page }) => {
    const f = fixture();
    const name = `Cancelamento mobile ${wholeAttendance} ${Date.now()}`;
    await page.setViewportSize({ width: 320, height: 700 });
    await page.goto(`/financeiro/atendimento?unidade=${f.unitId}&mes=2026-10`);
    await page.getByRole('combobox', { name: 'Caixa ou conta' }).selectOption(f.boxes[f.unitId].cash);
    await page.getByRole('combobox', { name: 'Identificação' }).selectOption('UNREGISTERED');
    await page.getByRole('textbox', { name: 'Nome da pessoa' }).fill(name);
    await page.getByRole('combobox', { name: 'Categoria' }).selectOption(f.offeringId);
    await page.getByLabel('Valor (R$)').fill('100');
    await page.getByRole('button', { name: 'Adicionar contribuição' }).click();
    await page.getByRole('combobox', { name: 'Categoria' }).nth(1).selectOption(f.offeringId);
    await page.getByLabel('Valor (R$)').nth(1).fill('200');
    await page.getByRole('button', { name: 'Salvar', exact: true }).click();
    await expect(page.getByText('Atendimento confirmado.', { exact: false })).toBeVisible();
    await page.goto(`/financeiro/lancamentos?unidade=${f.unitId}&mes=2026-10&search=${encodeURIComponent(name)}`);
    const cards = page.getByRole('list', { name: 'Lançamentos em cartões' });
    await expect(cards.getByRole('button')).toHaveCount(2);
    await cards.getByRole('button').first().click();
    let dialog = page.getByRole('dialog');
    await expect(dialog.getByRole('button', { name: 'Corrigir', exact: true })).toBeVisible();
    await expect(dialog.getByRole('button', { name: 'Cancelar atendimento', exact: true })).toBeHidden();
    const cancel = dialog.getByRole('button', { name: 'Cancelar', exact: true });
    const cb = (await cancel.boundingBox())!;
    expect(cb.x).toBeGreaterThanOrEqual(0);
    expect(cb.x + cb.width).toBeLessThanOrEqual(320);
    await cancel.click();
    dialog = page.getByRole('dialog');
    await expect(dialog.getByRole('radio', { name: 'Somente este lançamento' })).toBeChecked();
    await expect(dialog.getByRole('button', { name: 'Confirmar', exact: true })).toBeDisabled();
    if (wholeAttendance) await dialog.getByRole('radio', { name: 'Todo o atendimento' }).check();
    await dialog.getByLabel('Justificativa').fill('Cancelamento de dados fictícios para teste');
    if (wholeAttendance) {
      await page.route(page.url(), async route => {
        await route.fetch();
        await route.abort('connectionfailed');
      }, { times: 1 });
    }
    await dialog.getByRole('button', { name: 'Confirmar', exact: true }).click();
    if (wholeAttendance) {
      await expect(dialog.getByRole('alert')).toBeVisible();
      await expect(dialog.getByRole('radio', { name: 'Somente este lançamento' })).toBeDisabled();
      await expect(dialog.getByRole('radio', { name: 'Todo o atendimento' })).toBeChecked();
      await expect(dialog.getByLabel('Justificativa')).toBeDisabled();
      await dialog.getByRole('button', { name: 'Confirmar', exact: true }).click();
    }
    await expect(dialog).toHaveCount(0);
    await expect(cards.getByText('Cancelado', { exact: true })).toHaveCount(wholeAttendance ? 2 : 1);
    await expect(cards.getByText('Confirmado', { exact: true })).toHaveCount(wholeAttendance ? 0 : 1);
  });
}

for (const width of [320, 1440]) {
  test(`selected person stays grouped and can be removed at ${width}px`, async ({ page }) => {
    const f = fixture();
    await page.setViewportSize({ width, height: 900 });
    await page.goto(`/financeiro/lancamentos?unidade=${f.headquartersId}&mes=2026-10`);
    await page.getByRole('button', { name: width < 761 ? 'Entrada' : 'Nova entrada', exact: true }).click();
    const dialog = page.getByRole('dialog');
    await dialog.getByRole('textbox', { name: 'Nome para busca' }).fill('Pessoa Financeiro Teste');
    await dialog.getByRole('button', { name: 'Buscar pessoa', exact: true }).click();
    await dialog.getByRole('button', { name: /Pessoa Financeiro Teste/ }).click();
    const selected = dialog.locator('.finance-selected-person');
    await expect(selected).toBeVisible();
    const identity = selected.locator('.finance-selected-person-identity');
    const ib = (await identity.boundingBox())!;
    const icon = (await identity.locator('svg').boundingBox())!;
    const name = (await identity.locator('strong').boundingBox())!;
    expect(name.x - icon.x - icon.width).toBeLessThanOrEqual(12);
    const remove = selected.getByRole('button', { name: 'Remover pessoa selecionada' });
    const rb = (await remove.boundingBox())!;
    expect(rb.x).toBeGreaterThanOrEqual(ib.x + ib.width);
    expect(Math.abs(rb.y + rb.height / 2 - ib.y - ib.height / 2)).toBeLessThanOrEqual(1);
    await dialog.getByLabel('Valor (R$)').fill('9999999999');
    const total = dialog.locator('.finance-entry-primary-total');
    if (width < 761) {
      const save = (await dialog.getByRole('button', { name: 'Salvar', exact: true }).boundingBox())!;
      const tb = (await total.boundingBox())!;
      expect(tb.x + tb.width).toBeLessThan(save.x);
      expect(save.x + save.width).toBeLessThanOrEqual(width - 16);
    }
    await remove.click();
    await expect(selected).toHaveCount(0);
    await expect(dialog.getByRole('textbox', { name: 'Nome para busca' })).toBeVisible();
    await expect(dialog.getByLabel('Valor (R$)')).toHaveValue('99.999.999,99');
    await fitsViewport(page);
  });
}
