import { test, expect } from "@playwright/test";
import { readFileSync, mkdirSync } from "node:fs";
test.use({
  channel: "chromium",
  serviceWorkers: "block",
  contextOptions: { reducedMotion: "reduce" },
});
test.beforeEach(() =>
  test.skip(!process.env.E2E_FINANCE_FIXTURE, "Local finance fixture required"),
);
const fixture = () =>
  JSON.parse(readFileSync(process.env.E2E_FINANCE_FIXTURE!, "utf8"));
for (const [width, minimumGap] of [[390, 24], [1280, 32]]) {
  test(`report filters are separated from the cards at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto(`/financeiro/relatorios?unidade=${fixture().unitId}&mes=2026-10`);
    const options = page.getByRole("region", { name: "Opções do relatório" });
    const choices = await options.getByRole("group", { name: "Tipo de relatório" }).boundingBox();
    const filters = await options.locator(".finance-report-controls").boundingBox();
    const panel = await options.boundingBox();
    const result = await page.locator(".finance-report-empty:visible").boundingBox();
    expect(filters!.y - choices!.y - choices!.height).toBeGreaterThanOrEqual(minimumGap);
    expect(result!.y - panel!.y - panel!.height).toBeGreaterThanOrEqual(minimumGap);
  });
}

test("desktop groups delivery navigation with report choices and removes redundant filters", async ({
  page,
}) => {
  const f = fixture();
  await page.goto(`/financeiro/relatorios?unidade=${f.unitId}&mes=2026-10`);
  const delivery = page
    .locator(".finance-report-types")
    .getByRole("link", { name: /Entrega de relatórios/ });
  await expect(delivery).toBeVisible();
  await expect(
    page.locator(".finance-report-types:visible > :last-child"),
  ).toContainText("Entrega de relatórios");
  for (const title of [
    "Comparativo individual por congregação",
    "Informativo geral por congregação",
  ]) {
    await page.getByRole("radio", { name: title, exact: true }).check();
    const month = await page.getByLabel("Mês final", { exact: true }).boundingBox();
    const generate = await page
      .getByRole("button", { name: "Gerar relatório" })
      .boundingBox();
    expect(generate!.x).toBeGreaterThanOrEqual(month!.x + month!.width);
    expect(Math.abs(generate!.y - month!.y)).toBeLessThan(2);
  }
  await expect(page.getByLabel("Incluir congregações inativas")).toHaveCount(0);
  await page.getByRole("radio", { name: "Por categoria", exact: true }).check();
  await expect(
    page.getByRole("button", { name: /^Este (mês|ano)$/ }),
  ).toHaveCount(0);
  await expect(page.getByLabel("Data inicial", { exact: true })).toBeVisible();
  mkdirSync("tmp/reports", { recursive: true });
  await page.screenshot({
    path: "tmp/reports/report-layout-desktop.png",
    fullPage: true,
    animations: "disabled",
  });
  await delivery.click();
  await expect(
    page.getByRole("heading", { name: "Entrega de relatórios", exact: true }),
  ).toBeVisible();
});
test("deliveries use status badges, align row actions and explain empty filters", async ({
  page,
}) => {
  const f = fixture();
  await page.goto(
    `/financeiro/relatorios/entregas?unidade=${f.unitId}&mes=2026-09`,
  );
  await expect(page.getByLabel("Incluir congregações inativas")).toHaveCount(0);
  const table = page.getByRole("table");
  await expect(table.locator('td[data-label="Situação"] .badge')).toHaveText(
    "Não entregue",
  );
  await expect(table.locator('td[data-label="Prazo"] .badge')).toHaveText(
    "Em atraso",
  );
  const pdf = await page
    .getByRole("button", { name: "Gerar PDF", exact: true })
    .boundingBox();
  const action = await table
    .locator(".finance-delivery-actions")
    .boundingBox();
  expect(
    Math.abs(pdf!.x + pdf!.width - action!.x - action!.width),
  ).toBeLessThan(2);
  await page.screenshot({
    path: "tmp/reports/delivery-layout-desktop.png",
    fullPage: true,
    animations: "disabled",
  });
  await page.getByRole("button", { name: /^Entregues \(/ }).click();
  await expect(
    page.getByText("Nenhum relatório entregue neste período.", { exact: true }),
  ).toBeVisible();
  await expect(page.locator(".finance-deliveries .empty svg")).toBeVisible();
  await page
    .getByRole("searchbox", { name: "Buscar congregação", exact: true })
    .fill("Sem correspondência");
  await expect(
    page.getByText("Nenhuma congregação encontrada.", { exact: true }),
  ).toBeVisible();
  await page.screenshot({
    path: "tmp/reports/delivery-layout-empty.png",
    fullPage: true,
    animations: "disabled",
  });
});
test("catalog columns stay fixed across tabs and edit actions start beneath the create button", async ({
  page,
}) => {
  const f = fixture();
  await page.goto(`/financeiro/configuracoes?unidade=${f.unitId}&mes=2026-10`);
  let baseline: number[] | undefined;
  for (const name of [
    "Departamentos",
    "Categorias",
    "Classificações",
    "Formas de pagamento",
  ]) {
    await page.getByRole("button", { name, exact: true }).click();
    const create = await page
      .getByRole("button", { name: "Novo cadastro", exact: true })
      .boundingBox();
    const edit = await page
      .getByRole("button", { name: /^Editar / })
      .first()
      .boundingBox();
    expect(Math.abs(create!.x - edit!.x)).toBeLessThan(2);
    const positions = await page
      .locator("table:visible thead th")
      .evaluateAll((cells) => cells.map((c) => c.getBoundingClientRect().x));
    if (baseline)
      positions.forEach((x, i) =>
        expect(Math.abs(x - baseline![i])).toBeLessThan(2),
      );
    else baseline = positions;
    await page.screenshot({
      path: `tmp/reports/settings-layout-${name}.png`,
      fullPage: true,
      animations: "disabled",
    });
  }
});

for (const width of [1024, 1280]) {
  test(`category filters keep the layout stable and the finance header stays visible at ${width}px`, async ({ page }) => {
    const f = fixture();
    await page.setViewportSize({ width, height: 700 });
    await page.goto(`/financeiro/configuracoes?unidade=${f.unitId}&mes=2026-10`);
    await page.getByRole("button", { name: "Categorias", exact: true }).click();
    const card = page.locator(".finance-settings-catalog:visible");
    const search = page.getByRole("searchbox", { name: "Buscar categoria" });
    const cardBefore = await card.boundingBox();
    const searchBefore = await search.boundingBox();
    const results = await card.getByRole("region", { name: "Resultados de categorias" }).boundingBox();
    const status = await card.getByRole("combobox", { name: "Situação" }).boundingBox();
    expect(searchBefore!.x).toBeCloseTo(results!.x, 0);
    expect(status!.x + status!.width).toBeCloseTo(results!.x + results!.width, 0);
    expect(status!.y).toBeCloseTo(searchBefore!.y, 0);
    await search.fill("categoria-inexistente");
    await expect(card.getByRole("button", { name: "Limpar filtros" })).toHaveCount(0);
    await expect(page.getByText("Nenhuma categoria corresponde aos filtros.")).toBeVisible();
    expect((await card.boundingBox())!.height).toBeCloseTo(cardBefore!.height, 0);
    expect((await search.boundingBox())!.width).toBeCloseTo(searchBefore!.width, 0);
    const clear = page.getByRole("button", { name: "Limpar busca" });
    await expect(clear).toBeVisible();
    await expect(search).toHaveAttribute("type", "text");
    await expect(clear).not.toHaveCSS("background-color", "rgba(0, 0, 0, 0)");
    await clear.click();
    await expect(search).toHaveValue("");
    await expect(search).toBeFocused();

    await page.getByRole("button", { name: "Regras do demonstrativo" }).click();
    const item = page.getByRole("group", { name: "Item 1", exact: true });
    const remove = item.getByRole("button", { name: "Remover item 1", exact: true });
    await expect(remove).toHaveCSS("background-color", "rgb(8, 127, 91)");
    await expect(remove).toHaveCSS("color", "rgb(255, 255, 255)");
    const fields = await item.locator(".grid").first().boundingBox();
    const action = await remove.boundingBox();
    expect(action!.x + action!.width).toBeCloseTo(fields!.x + fields!.width, 0);
    await page.evaluate(() => window.scrollTo({ top: 500, behavior: "instant" }));
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(100);
    expect((await page.getByRole("banner").boundingBox())!.y).toBeCloseTo(0, 0);
  });
}
