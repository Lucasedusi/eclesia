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
    page.locator(".finance-report-types > :last-child"),
  ).toContainText("Entrega de relatórios");
  await page
    .getByRole("radio", {
      name: "Informativo geral por congregação",
      exact: true,
    })
    .check();
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
