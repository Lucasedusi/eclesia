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
test("ranking uses all units and generates selected columns without the header unit filter", async ({
  page,
}) => {
  const f = fixture();
  await page.goto(`/financeiro/relatorios?unidade=${f.unitId}&mes=2026-10`);
  await page
    .getByRole("radio", {
      name: "Informativo geral por congregação",
      exact: true,
    })
    .check();
  await expect(page.getByLabel("Mês inicial", { exact: true })).toHaveValue(
    "2026-10",
  );
  await page
    .getByLabel("Incluir congregações inativas", { exact: true })
    .check();
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
  expect(res.request().postDataJSON()).toMatchObject({
    type: "RANKING",
    includeInactive: true,
  });
  expect(res.request().postDataJSON().congregationId).toBeUndefined();
  mkdirSync("tmp/reports", { recursive: true });
  writeFileSync("tmp/reports/ranking-browser.pdf", await readPdf(page));
  await (await popup).close();
  await page.getByLabel("Incluir repasse", { exact: true }).uncheck();
  await expect(
    page.getByRole("link", { name: "Abrir PDF", exact: true }),
  ).toHaveCount(0);
  await page.screenshot({
    path: "tmp/reports/ranking-desktop.png",
    fullPage: true,
  });
});
test("administrator records, corrects, filters, exports and undoes a receipt with history", async ({
  page,
}) => {
  const f = fixture();
  await page.goto(
    `/financeiro/relatorios/entregas?unidade=${f.headquartersId}&mes=2026-09`,
  );
  await expect(
    page.getByRole("heading", { name: "Entrega de relatórios", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("cell", { name: "Headquarters", exact: true }),
  ).toHaveCount(0);
  await page
    .getByRole("button", { name: "Registrar entrega", exact: true })
    .click();
  await page.getByLabel("Data da entrega", { exact: true }).fill("2026-10-07");
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Registrar entrega", exact: true })
    .click();
  await expect(
    page.getByRole("cell", { name: "07/10/2026", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Corrigir", exact: true }).click();
  await page.getByLabel("Data da entrega", { exact: true }).fill("2026-10-10");
  await page
    .getByLabel("Motivo da alteração")
    .fill("Correção da data informada");
  await page
    .getByRole("button", { name: "Corrigir entrega", exact: true })
    .click();
  await expect(
    page.getByRole("cell", { name: "Com atraso", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: /^Não entregues \(/ }).click();
  await expect(
    page.getByText("Nenhuma congregação encontrada", { exact: false }),
  ).toBeVisible();
  await page.getByRole("button", { name: /^Entregues \(/ }).click();
  const response = page.waitForResponse(
    (r) =>
      r.url().endsWith("/api/finance/reports/pdf") &&
      r.request().method() === "POST",
  );
  const popup = page.waitForEvent("popup");
  await page.getByRole("button", { name: "Gerar PDF", exact: true }).click();
  const res = await response;
  expect(res.status()).toBe(200);
  expect(res.request().postDataJSON().filter).toBe("DELIVERED");
  writeFileSync("tmp/reports/entregas-browser.pdf", await readPdf(page));
  await (await popup).close();
  await page.getByRole("button", { name: "Histórico", exact: true }).click();
  await expect(
    page.getByText("Correção da data informada", { exact: true }).first(),
  ).toBeVisible();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: /Fechar/ })
    .click();
  await page.getByRole("button", { name: "Corrigir", exact: true }).click();
  await page
    .getByRole("button", { name: "Desfazer registro de entrega", exact: true })
    .click();
  await page
    .getByLabel("Motivo da alteração")
    .fill("Recebimento registrado por engano");
  await page
    .getByRole("button", { name: "Desfazer entrega", exact: true })
    .click();
  await page.getByRole("button", { name: /^Não entregues \(/ }).click();
  await expect(
    page.getByRole("button", { name: "Registrar entrega", exact: true }),
  ).toBeVisible();
  await page.setViewportSize({ width: 375, height: 812 });
  await page.screenshot({
    path: "tmp/reports/entregas-mobile.png",
    fullPage: true,
  });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});
test("deadline setting changes only current/future reference months", async ({
  page,
}) => {
  const f = fixture();
  const current = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
  }).format(new Date());
  await page.goto(
    `/financeiro/configuracoes?unidade=${f.headquartersId}&mes=2026-09&area=entregas`,
  );
  await expect(
    page.getByRole("heading", { name: "Prazo de entrega dos relatórios" }),
  ).toBeVisible();
  await page.getByLabel("Dia limite de entrega", { exact: true }).filter({visible:true}).fill("12");
  await page
    .getByLabel("Aplicar a partir do mês de referência", { exact: true }).filter({visible:true})
    .fill(current);
  await page.getByRole("button", { name: "Salvar prazo", exact: true }).click();
  await expect(page.getByText(/: dia 12 do mês seguinte\./)).toBeVisible();
  await page.goto(
    `/financeiro/relatorios/entregas?unidade=${f.headquartersId}&mes=2026-09`,
  );
  await expect(
    page.getByText("Entrega até 08/10/2026", { exact: true }),
  ).toBeVisible();
});
test("treasurer cannot see administrative controls or call their PDF endpoints", async ({
  browser,
}) => {
  const f = fixture();
  const context = await browser.newContext({
    storageState: "tmp/finance-treasurer-session.json",
  });
  const page = await context.newPage();
  await page.goto(`/financeiro/relatorios?unidade=${f.unitId}&mes=2026-09`);
  await expect(
    page.getByRole("radio", {
      name: "Informativo geral por congregação",
      exact: true,
    }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("link", { name: "Acompanhar entregas" }),
  ).toHaveCount(0);
  const response = await context.request.post("/api/finance/reports/pdf", {
    data: {
      type: "DELIVERIES",
      month: "2026-09",
      includeInactive: false,
      filter: "ALL",
      search: "",
    },
  });
  expect(response.status()).toBe(403);
  await page.goto(
    `/financeiro/relatorios/entregas?unidade=${f.unitId}&mes=2026-09`,
  );
  await expect(
    page.getByRole("button", { name: "Registrar entrega", exact: true }),
  ).toHaveCount(0);
  await context.close();
});

async function readPdf(page: Page) {
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
  return bytes;
}
