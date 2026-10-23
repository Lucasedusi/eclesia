import { test, expect, type Page } from "@playwright/test";
import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
test.use({ channel: "chromium", serviceWorkers: "block" });
test.beforeEach(() =>
  test.skip(
    !process.env.E2E_FINANCE_FIXTURE,
    "Local financial fixture required",
  ),
);
const fixture = () =>
  JSON.parse(readFileSync(process.env.E2E_FINANCE_FIXTURE!, "utf8"));

async function generate(page: Page, name: string) {
  const response = page.waitForResponse(
    (r) =>
      r.url().endsWith("/api/finance/reports/pdf") &&
      r.request().method() === "POST",
  );
  const popup = page.waitForEvent("popup");
  await page
    .getByRole("button", { name: "Gerar relatório", exact: true })
    .click();
  const res = await response;
  expect(res.status()).toBe(200);
  const link = page.getByRole("link", { name: "Abrir PDF", exact: true });
  await expect(link).toBeVisible();
  const bytes = Buffer.from(
    await page.evaluate(
      async (url) =>
        Array.from(new Uint8Array(await (await fetch(url!)).arrayBuffer())),
      await link.getAttribute("href"),
    ),
  );
  expect(bytes.subarray(0, 4).toString()).toBe("%PDF");
  mkdirSync("tmp/reports", { recursive: true });
  writeFileSync(`tmp/reports/${name}.pdf`, bytes);
  await (await popup).close();
  return res.request().postDataJSON();
}
test("administrator selects multiple income categories, exports both presentations and resets selection on direction change", async ({
  page,
}) => {
  const f = fixture();
  await page.goto(
    `/financeiro/relatorios?unidade=${f.headquartersId}&mes=2026-10`,
  );
  await page.getByRole("radio", { name: "Por categoria", exact: true }).check();
  await expect(
    page.getByRole("button", { name: "Gerar relatório", exact: true }),
  ).toBeDisabled();
  await page.getByLabel("Data inicial", { exact: true }).fill("2026-01-01");
  await page.getByLabel("Data final", { exact: true }).fill("2026-12-31");
  await page
    .getByRole("combobox", { name: "Movimentação", exact: true })
    .selectOption("INCOME");
  await page.getByLabel("Buscar categoria", { exact: true }).fill("oferta");
  const checkboxes = page.locator(
    ".finance-category-list input[type=checkbox]",
  );
  await expect(checkboxes).toHaveCount(2);
  for (const box of await checkboxes.all()) await box.check();
  const options = await generate(page, "categorias-browser-resumido");
  expect(options).toMatchObject({
    type: "CATEGORY",
    direction: "INCOME",
    dateFrom: "2026-01-01",
    dateTo: "2026-12-31",
    presentation: "SUMMARY",
  });
  expect(options.categoryIds).toHaveLength(2);
  await page
    .getByRole("combobox", { name: "Apresentação", exact: true })
    .selectOption("DETAILED");
  await expect(
    page.getByRole("link", { name: "Abrir PDF", exact: true }),
  ).toHaveCount(0);
  expect(
    (await generate(page, "categorias-browser-detalhado")).presentation,
  ).toBe("DETAILED");
  await page.screenshot({
    path: "tmp/reports/categorias-desktop.png",
    fullPage: true,
  });
  await page
    .getByRole("combobox", { name: "Movimentação", exact: true })
    .selectOption("EXPENSE");
  await expect(
    page.locator(".finance-category-list input:checked"),
  ).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Gerar relatório", exact: true }),
  ).toBeDisabled();
});
test("treasurer can generate only within their congregation and mobile filters fit", async ({
  browser,
}) => {
  const f = fixture();
  const context = await browser.newContext({
    storageState: "tmp/finance-treasurer-session.json",
    viewport: { width: 375, height: 812 },
  });
  try {
    const page = await context.newPage();
    await page.goto(`/financeiro/relatorios?unidade=${f.unitId}&mes=2026-10`);
    await page
      .getByRole("radio", { name: "Por categoria", exact: true })
      .check();
    await page
      .locator(".finance-category-list input[type=checkbox]")
      .first()
      .check();
    const body = await generate(page, "categorias-tesoureiro-vazio");
    expect(body.congregationId).toBe(f.unitId);
    const denied = await page.request.post("/api/finance/reports/pdf", {
      data: { ...body, congregationId: f.headquartersId },
    });
    expect(denied.status()).toBe(403);
    await page.getByLabel("Data inicial", { exact: true }).fill("2026-11-01");
    await expect(
      page.getByRole("button", { name: "Gerar relatório", exact: true }),
    ).toBeDisabled();
    await page.getByRole("button", { name: "Este mês", exact: true }).click();
    await expect(
      page.getByRole("button", { name: "Gerar relatório", exact: true }),
    ).toBeEnabled();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.screenshot({
      path: "tmp/reports/categorias-mobile.png",
      fullPage: true,
    });
  } finally {
    await context.close();
  }
});
