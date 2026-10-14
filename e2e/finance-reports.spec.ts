import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";
// The headless shell downloads PDFs; the full browser exercises its PDF viewer.
test.use({ channel: "chromium" });
test.beforeEach(() =>
  test.skip(!process.env.E2E_FINANCE_FIXTURE, "Local finance fixture required"),
);
const fixture = () =>
  JSON.parse(readFileSync(process.env.E2E_FINANCE_FIXTURE!, "utf8"));
for (const type of [
  "Sintético — resumo por categorias",
  "Analítico — lançamentos detalhados",
]) {
  test(`${type} opens its PDF in a new tab without an embedded preview`, async ({
    page,
  }) => {
    const f = fixture();
    await page.goto(`/financeiro/relatorios?unidade=${f.unitId}&mes=2026-10`);
    await page.getByRole("radio", { name: type, exact: true }).check();
    const popupEvent = page.waitForEvent("popup");
    const response = page.waitForResponse(
      (r) =>
        r.url().endsWith("/api/finance/reports/pdf") &&
        r.request().method() === "POST",
    );
    await page
      .getByRole("button", { name: "Gerar relatório", exact: true })
      .click();
    const popup = await popupEvent;
    expect((await response).status()).toBe(200);
    const link = page.getByRole("link", { name: "Abrir PDF", exact: true });
    await expect(link).toBeVisible();
    const pdfUrl = await link.getAttribute("href");
    await expect(popup).toHaveURL(pdfUrl!);
    await expect(page.locator("iframe")).toHaveCount(0);
    const bytes = Buffer.from(
      await page.evaluate(
        async (url) =>
          Array.from(new Uint8Array(await (await fetch(url!)).arrayBuffer())),
        pdfUrl,
      ),
    );
    expect(bytes.subarray(0, 4).toString()).toBe("%PDF");
    const download = page.waitForEvent("download");
    await page.getByRole("link", { name: "Baixar PDF", exact: true }).click();
    expect(readFileSync((await (await download).path())!)).toEqual(bytes);
    await popup.close();
    await page
      .getByRole("radio", {
        name: type.startsWith("Sintético")
          ? "Analítico — lançamentos detalhados"
          : "Sintético — resumo por categorias",
        exact: true,
      })
      .check();
    await expect(link).toHaveCount(0);
  });
}

test("blocked popups still offer a usable PDF link and download", async ({
  page,
}) => {
  const f = fixture();
  await page.goto(`/financeiro/relatorios?unidade=${f.unitId}&mes=2026-10`);
  await page.evaluate(() => {
    window.open = () => null;
  });
  await page
    .getByRole("button", { name: "Gerar relatório", exact: true })
    .click();
  const link = page.getByRole("link", { name: "Abrir PDF", exact: true });
  await expect(link).toBeVisible();
  await expect(
    page.getByText(
      "Use Abrir PDF para visualizar o relatório em uma nova aba.",
    ),
  ).toBeVisible();
  const url = await link.getAttribute("href");
  expect(
    await page.evaluate(
      async (value) => (await (await fetch(value!)).blob()).type,
      url,
    ),
  ).toBe("application/pdf");
  await expect(page.locator("iframe")).toHaveCount(0);
});

test("generation failure closes the waiting tab and permits retry", async ({
  page,
}) => {
  const f = fixture();
  await page.goto(`/financeiro/relatorios?unidade=${f.unitId}&mes=2026-10`);
  await page.route("**/api/finance/reports/pdf", (route) =>
    route.fulfill({
      status: 500,
      contentType: "application/json",
      body: JSON.stringify({ message: "Falha de teste" }),
    }),
  );
  const popupEvent = page.waitForEvent("popup");
  await page
    .getByRole("button", { name: "Gerar relatório", exact: true })
    .click();
  const popup = await popupEvent;
  await expect(
    page.getByRole("alert").filter({ hasText: "Falha de teste" }),
  ).toBeVisible();
  await expect.poll(() => popup.isClosed()).toBe(true);
  await expect(
    page.getByRole("button", { name: "Gerar relatório", exact: true }),
  ).toBeEnabled();
  await expect(
    page.getByRole("link", { name: "Abrir PDF", exact: true }),
  ).toHaveCount(0);
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
  const popupEvent = page.waitForEvent("popup");
  await page
    .getByRole("button", { name: "Gerar relatório", exact: true })
    .click();
  const popup = await popupEvent;
  await expect(page.getByText("Preparando o PDF…")).toBeVisible();
  await expect(popup.getByRole("status")).toContainText("Preparando o PDF…");
  await expect(popup.locator(".spinner")).toBeVisible();
  await expect(popup.locator(".spinner")).toHaveCSS("animation-name", "spin");
  await popup.emulateMedia({ reducedMotion: "reduce" });
  await expect(popup.locator(".spinner")).toHaveCSS("animation-name", "none");
  await page
    .getByRole("radio", {
      name: "Analítico — lançamentos detalhados",
      exact: true,
    })
    .check();
  release();
  await expect.poll(() => popup.isClosed()).toBe(true);
  await expect(page.getByText("Preparando o PDF…")).toHaveCount(0);
  await expect(page.getByText("Resposta antiga")).toHaveCount(0);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({ path: "tmp/reports/mobile.png", fullPage: true });
});
