import { test, expect, type Page } from "@playwright/test";
import { PDFDocument } from "pdf-lib";
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
    .getByRole("radio", { name: "Comparativo individual por congregação", exact: true })
    .check();
  await page.getByLabel("Incluir gráfico de evolução financeira", { exact: true }).check();
  await page
    .getByRole("radio", {
      name: "Informativo geral por congregação",
      exact: true,
    })
    .check();
  await expect(page.getByLabel("Incluir gráfico de evolução financeira", { exact: true })).toHaveCount(0);
  await expect(page.getByLabel("Mês inicial", { exact: true })).toHaveValue(
    "10/2026",
  );
  await expect(
    page.getByLabel("Incluir congregações inativas", { exact: true }),
  ).toHaveCount(0);
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
    includeInactive: false,
  });
  expect(res.request().postDataJSON().congregationId).toBeUndefined();
  expect(res.request().postDataJSON().includeChart).toBeUndefined();
  mkdirSync("tmp/reports", { recursive: true });
  const bytes = await readPdf(page);
  const document = await PDFDocument.load(bytes);
  expect(document.getPage(0).getWidth()).toBeCloseTo(841.89);
  writeFileSync("tmp/reports/ranking-browser.pdf", bytes);
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
  const actions: string[] = [];
  page.on("request", request => { if (request.headers()["next-action"]) actions.push(request.url()); });
  await page.getByRole("dialog").getByRole("button", { name: "Cancelar" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  const region = page.locator(".finance-list-results");
  const height = (await region.boundingBox())!.height;
  const search = page.getByLabel("Buscar congregação");
  await search.fill("Sem correspondência");
  await expect(region).toContainText("Nenhuma congregação encontrada.");
  expect((await region.boundingBox())!.height).toBe(height);
  await search.fill("");
  expect(actions).toHaveLength(0);
  await page.route("**/financeiro/relatorios/entregas?**", async route => {
    if (route.request().headers()["next-action"]) await new Promise(resolve => setTimeout(resolve, 400));
    await route.continue();
  });
  const month = page.getByLabel("Mês de referência", { exact: true });
  await month.fill("08/2026");
  await expect(region.getByRole("status", { name: "Carregando entregas" })).toBeVisible();
  expect((await region.boundingBox())!.height).toBe(height);
  await expect(region.getByRole("status")).toHaveCount(0);
  await month.fill("09/2026");
  await page.unroute("**/financeiro/relatorios/entregas?**");
  await page.getByRole("button", { name: "Registrar entrega", exact: true }).click();
  await expect(page.getByRole("button", { name: "Fechar modal" })).toBeFocused();
  await page.getByLabel("Data da entrega", { exact: true }).fill("07/10/2026");
  await expect(page.getByLabel("Data da entrega", { exact: true })).toHaveValue("07/10/2026");
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Registrar entrega", exact: true })
    .click();
  await expect(
    page.getByRole("cell", { name: "07/10/2026", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Corrigir", exact: true }).click();
  await expect(page.getByRole("button", { name: "Fechar modal" })).toBeFocused();
  await page.getByLabel("Data da entrega", { exact: true }).fill("10/10/2026");
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
    page.getByText("Nenhuma entrega pendente.", { exact: true }),
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
  await expect(
    page.getByText("Acesse pelo computador para acompanhar as entregas."),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Registrar entrega", exact: true }),
  ).toHaveCount(0);
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
  await page
    .getByLabel("Dia limite de entrega", { exact: true })
    .filter({ visible: true })
    .fill("12");
  await page
    .getByLabel("Aplicar a partir do mês de referência", { exact: true })
    .filter({ visible: true })
    .fill(current);
  const saved = page.waitForResponse((r) => r.request().method() === "POST" && Boolean(r.request().headers()["next-action"]));
  await page.getByRole("button", { name: "Salvar prazo", exact: true }).click();
  await saved;
  await page.reload();
  await expect(page.getByLabel("Dia limite de entrega")).toHaveValue("12");
  await page.goto(
    `/financeiro/relatorios/entregas?unidade=${f.headquartersId}&mes=2026-09`,
  );
  await expect(
    page.getByText(/Entrega até/),
  ).toHaveCount(0);
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
    page.getByRole("link", { name: /Entrega de relatórios/ }),
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

test("a cathedral repasse delivers the payer's report and allows a manual date", async ({ page }) => {
  const f = fixture();
  const deliveries = `/financeiro/relatorios/entregas?unidade=${f.headquartersId}&mes=2026-08`;
  await page.goto(`/financeiro/lancamentos?novo=entrada&unidade=${f.headquartersId}&mes=2026-10`);
  const form = page.getByRole("dialog", { name: "Nova entrada" });
  await form.getByRole("combobox", { name: /Identificação/ }).selectOption("CONGREGATION");
  await form.getByLabel("Nome da congregação").fill("Unit A");
  await form.getByRole("button", { name: "Buscar congregação" }).click();
  await form.getByRole("button", { name: "Unit A", exact: true }).click();
  await form.getByLabel("Data", { exact: true }).fill("05/10/2026");
  await form.getByLabel("Caixa ou conta", { exact: true }).selectOption(f.boxes[f.headquartersId].cash);
  await form.getByLabel("Categoria", { exact: true }).selectOption(f.repasseId);
  await expect(form.getByText(/escolha um mês de referência anterior/)).toBeVisible();
  await form.getByLabel("Mês de referência", { exact: true }).fill("08/2026");
  await expect(form.getByText(/conta para a entrega do relatório de 08\/2026/)).toBeVisible();
  await form.getByLabel("Valor (R$)", { exact: true }).fill("123,45");
  await form.getByRole("button", { name: "Salvar", exact: true }).click();
  await expect(form).toHaveCount(0);

  await page.goto(deliveries);
  const row = page.getByRole("row").filter({ hasText: "Unit A" });
  await expect(row).toContainText("Automática por repasse");
  await expect(row).toContainText("05/10/2026");
  const view = row.getByRole("link", { name: "Ver lançamento" });
  await expect(view).toHaveText("Ver");
  const register = row.getByRole("button", { name: "Registrar data manual" });
  const history = row.getByRole("button", { name: "Histórico" });
  await expect(register).toHaveText("");
  await expect(history).toHaveText("");
  const [left, right] = await Promise.all([register.boundingBox(), history.boundingBox()]);
  expect(left!.y).toBeCloseTo(right!.y, 0);
  expect(right!.x).toBeGreaterThan(left!.x);
  await expect(page.getByRole("link", { name: "Configurar prazo" })).toHaveCount(0);
  await view.click();
  const details = page.getByRole("dialog", { name: "Detalhes do lançamento" });
  await expect(details).toContainText("123,45");
  await expect(details).toContainText("08/2026");
  await page.goto(deliveries);
  await row.getByRole("button", { name: "Registrar data manual" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Data da entrega", { exact: true }).fill("07/09/2026");
  await dialog.getByRole("button", { name: "Registrar data manual" }).click();
  await expect(row.getByRole("cell", { name: "Manual", exact: true })).toBeVisible();
  await expect(row).toContainText("No prazo");
  await row.getByRole("button", { name: "Histórico" }).click();
  await expect(dialog).toContainText("Repasse considerado");
  await expect(dialog).toContainText("Entrega registrada");
  await dialog.getByRole("button", { name: /Fechar/ }).click();
  await row.getByRole("button", { name: "Corrigir" }).click();
  await dialog.getByRole("button", { name: "Desfazer registro de entrega" }).click();
  await dialog.getByLabel("Motivo da alteração").fill("Conferido o repasse de origem");
  await dialog.getByRole("button", { name: "Desfazer entrega", exact: true }).click();
  await expect(row).toContainText("Automática por repasse");
  await expect(row).toContainText("05/10/2026");
});
