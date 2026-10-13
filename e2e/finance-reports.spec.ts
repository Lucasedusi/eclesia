import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";
test.beforeEach(() =>
  test.skip(!process.env.E2E_FINANCE_FIXTURE, "Local finance fixture required"),
);
const fixture = () =>
  JSON.parse(readFileSync(process.env.E2E_FINANCE_FIXTURE!, "utf8"));
test("reports preview and download share a PDF and changing type clears it", async ({
  page,
}) => {
  const f = fixture();
  await page.goto(`/financeiro/relatorios?unidade=${f.unitId}&mes=2026-10`);
  await expect(
    page.getByRole("heading", { name: "Relatórios", exact: true }),
  ).toBeVisible();
  const response = page.waitForResponse(
    (r) =>
      r.url().endsWith("/api/finance/reports/pdf") &&
      r.request().method() === "POST",
  );
  await page
    .getByRole("button", { name: "Gerar relatório", exact: true })
    .click();
  const pdf = await response;
  expect(pdf.status()).toBe(200);
  await expect(page.getByTitle("Prévia do relatório financeiro")).toBeVisible();
  const previewUrl = await page
    .getByTitle("Prévia do relatório financeiro")
    .getAttribute("src");
  expect(
    await page
      .getByRole("link", { name: "Baixar PDF", exact: true })
      .getAttribute("href"),
  ).toBe(previewUrl);
  const bytes = Buffer.from(
    await page.evaluate(
      async (url) =>
        Array.from(new Uint8Array(await (await fetch(url!)).arrayBuffer())),
      previewUrl,
    ),
  );
  expect(bytes.length).toBeGreaterThan(1000);
  const download = page.waitForEvent("download");
  await page.getByRole("link", { name: "Baixar PDF", exact: true }).click();
  expect(readFileSync((await (await download).path())!)).toEqual(bytes);
  await page.screenshot({
    path: "tmp/reports/previa-relatorio.png",
    fullPage: true,
  });
  await page.getByLabel("Analítico — lançamentos detalhados").check();
  await expect(
    page.getByRole("link", { name: "Baixar PDF", exact: true }),
  ).toHaveCount(0);
  await page.screenshot({
    path: "tmp/reports/tela-relatorios.png",
    fullPage: true,
  });
});
test("treasurer only sees own congregation and cannot request another PDF", async ({
  browser,
}) => {
  const f = fixture();
  const context = await browser.newContext({
    storageState: "tmp/finance-treasurer-session.json",
  });
  const page = await context.newPage();
  await page.goto(`/financeiro/relatorios?unidade=${f.unitId}&mes=2026-10`);
  const select = page.getByRole("combobox", {
    name: "Congregação",
    exact: true,
  });
  await expect(select).toBeDisabled();
  await expect(select.locator("option")).toHaveCount(1);
  const own = await context.request.post("/api/finance/reports/pdf", {
    data: { congregationId: f.unitId, type: "ANALYTIC", month: "2026-10" },
  });
  expect(own.status()).toBe(200);
  expect((await own.body()).subarray(0, 4).toString()).toBe("%PDF");
  const response = await context.request.post("/api/finance/reports/pdf", {
    data: {
      congregationId: f.headquartersId,
      type: "SYNTHETIC",
      month: "2026-10",
    },
  });
  expect(response.status()).toBe(403);
  await context.close();
});

test("filters discard an in-flight report and mobile stays within viewport", async ({
  page,
}) => {
  const f = fixture();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`/financeiro/relatorios?unidade=${f.unitId}&mes=2026-10`);
  let release!: () => void;
  const held = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route("**/api/finance/reports/pdf", async (route) => {
    await held;
    await route
      .fulfill({
        status: 500,
        contentType: "application/json",
        body: JSON.stringify({ message: "Resposta antiga" }),
      })
      .catch(() => {});
  });
  await page
    .getByRole("button", { name: "Gerar relatório", exact: true })
    .click();
  await expect(page.getByText("Preparando o PDF…")).toBeVisible();
  await page.getByLabel("Analítico — lançamentos detalhados").check();
  release();
  await expect(page.getByText("Preparando o PDF…")).toHaveCount(0);
  await expect(page.getByText("Resposta antiga")).toHaveCount(0);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({ path: "tmp/reports/mobile.png", fullPage: true });
});
