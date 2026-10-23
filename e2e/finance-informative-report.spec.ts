import { test, expect } from "@playwright/test";
import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
test.use({ channel: "chromium", serviceWorkers: "block" });
test.beforeEach(() =>
  test.skip(!process.env.E2E_FINANCE_FIXTURE, "Local finance fixture required"),
);
const fixture = () =>
  JSON.parse(readFileSync(process.env.E2E_FINANCE_FIXTURE!, "utf8"));

test("administrator generates a period report, selects optional columns and validates the period", async ({
  page,
}) => {
  const f = fixture();
  await page.goto(
    `/financeiro/demonstrativos?unidade=${f.headquartersId}&mes=2026-10`,
  );
  await page
    .getByRole("button", { name: /Gerar (demonstrativo|nova versão)/ })
    .click();
  await expect(page.getByTestId("statement-pastor-net")).toHaveText(
    "R$ 4.725,00",
  );
  await page.goto(
    `/financeiro/relatorios?unidade=${f.headquartersId}&mes=2026-10`,
  );
  await page
    .getByRole("radio", { name: "Informativo por congregação", exact: true })
    .check();
  await expect(page.getByLabel("Mês inicial", { exact: true })).toHaveValue(
    "2026-08",
  );
  await expect(page.getByLabel("Mês final", { exact: true })).toHaveValue(
    "2026-10",
  );
  await expect(
    page.getByRole("combobox", { name: "Caixas e contas" }),
  ).toHaveCount(0);
  await page.getByLabel("Mês final", { exact: true }).fill("2026-07");
  await expect(
    page.getByRole("button", { name: "Gerar relatório", exact: true }),
  ).toBeDisabled();
  await page.getByLabel("Mês final", { exact: true }).fill("2026-10");
  for (const [prebend, transfer] of [
    [true, true],
    [false, true],
    [true, false],
    [false, false],
  ]) {
    await page
      .getByLabel("Incluir prebenda bruta", { exact: true })
      .setChecked(prebend);
    await page
      .getByLabel("Incluir repasse", { exact: true })
      .setChecked(transfer);
    const responseEvent = page.waitForResponse(
      (r) =>
        r.url().endsWith("/api/finance/reports/pdf") &&
        r.request().method() === "POST",
    );
    const popupEvent = page.waitForEvent("popup");
    await page
      .getByRole("button", { name: "Gerar relatório", exact: true })
      .click();
    const popup = await popupEvent;
    const response = await responseEvent;
    expect(response.status()).toBe(200);
    expect(response.request().postDataJSON()).toEqual({
      congregationId: f.headquartersId,
      type: "INFORMATIVE",
      startMonth: "2026-08",
      endMonth: "2026-10",
      includePrebend: prebend,
      includeTransfer: transfer,
    });
    const link = page.getByRole("link", { name: "Abrir PDF", exact: true });
    await expect(link).toBeVisible();
    await expect(popup).toHaveURL((await link.getAttribute("href"))!);
    mkdirSync("tmp/reports", { recursive: true });
    const bytes = Buffer.from(
      await page.evaluate(
        async (url) =>
          Array.from(new Uint8Array(await (await fetch(url!)).arrayBuffer())),
        await link.getAttribute("href"),
      ),
    );
    expect(bytes.subarray(0, 4).toString()).toBe("%PDF");
    writeFileSync(
      `tmp/reports/informativo-browser-${prebend}-${transfer}.pdf`,
      bytes,
    );
    await popup.close();
  }
  await page.getByLabel("Mês inicial", { exact: true }).fill("2026-09");
  await expect(
    page.getByRole("link", { name: "Abrir PDF", exact: true }),
  ).toHaveCount(0);
  await page.screenshot({
    path: "tmp/reports/informativo-desktop.png",
    fullPage: true,
  });
});

test("mobile keeps only monthly reports and discards desktop filters on resize", async ({
  page,
}) => {
  const f = fixture();
  await page.goto(`/financeiro/relatorios?unidade=${f.unitId}&mes=2026-10`);
  await page
    .getByRole("radio", { name: "Informativo por congregação", exact: true })
    .check();
  await expect(page.getByLabel("Mês inicial", { exact: true })).toBeVisible();
  await page.setViewportSize({ width: 375, height: 812 });
  await expect(page.getByRole("radio")).toHaveCount(2);
  await expect(
    page.getByRole("radio", {
      name: "Sintético — resumo por categorias",
      exact: true,
    }),
  ).toBeChecked();
  await expect(page.getByLabel("Mês inicial", { exact: true })).toHaveCount(0);
  await expect(
    page.getByRole("link", { name: /Entrega de relatórios/ }),
  ).toHaveCount(0);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: "tmp/reports/reports-mobile-simplified.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 1280, height: 800 });
  await expect(
    page.getByRole("radio", { name: "Por categoria", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: /Entrega de relatórios/ }),
  ).toBeVisible();
});

test("non-administrators cannot see or generate the administrative report", async ({
  browser,
}) => {
  const f = fixture();
  for (const role of ["treasurer", "secretary"]) {
    const context = await browser.newContext({
      storageState: `tmp/finance-${role}-session.json`,
    });
    const page = await context.newPage();
    const unit = role === "treasurer" ? f.unitId : f.headquartersId;
    await page.goto(`/financeiro/relatorios?unidade=${unit}&mes=2026-10`);
    await expect(
      page.getByRole("radio", {
        name: "Sintético — resumo por categorias",
        exact: true,
      }),
    ).toBeVisible();
    await expect(
      page.getByRole("radio", {
        name: "Informativo por congregação",
        exact: true,
      }),
    ).toHaveCount(0);
    const res = await context.request.post("/api/finance/reports/pdf", {
      data: {
        congregationId: unit,
        type: "INFORMATIVE",
        startMonth: "2026-08",
        endMonth: "2026-10",
        includePrebend: true,
        includeTransfer: true,
      },
    });
    expect(res.status()).toBe(403);
    await context.close();
  }
});
