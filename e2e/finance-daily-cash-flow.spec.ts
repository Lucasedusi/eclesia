import { readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";

test.beforeEach(() => {
  test.skip(!process.env.E2E_FINANCE_FIXTURE || !process.env.E2E_STORAGE_STATE, "Requer a fixture e a sessão financeiras locais.");
  expect(process.env.E2E_BASE_URL).toBe("http://127.0.0.1:3217");
});

for (const width of [390, 1280]) {
  test(`consulta o fluxo diário da Catedral a ${width}px`, async ({ page }) => {
    const f = JSON.parse(readFileSync(process.env.E2E_FINANCE_FIXTURE!, "utf8"));
    await page.setViewportSize({ width, height: 900 });
    await page.goto(`/financeiro?unidade=${f.unitId}&mes=2026-10`);
    await page.getByRole("link", { name: "Fluxo de caixa diário" }).click();
    const header = page.locator(".finance-daily-heading");
    const title = header.getByRole("heading", { name: "Fluxo de caixa diário" });
    const date = header.getByLabel("Data de movimento");
    const account = header.getByLabel("Caixa ou conta", { exact: true });
    await expect(title).toBeVisible();
    await expect(header.getByText("Acompanhe as entradas, saídas e saldos da Catedral.")).toBeVisible();
    await expect(page.locator("main").getByRole("link", { name: /visão geral/i })).toHaveCount(0);
    await expect(header.getByText("Caixa ou conta", { exact: true })).toHaveCount(0);
    await expect(date).toBeVisible();
    await expect(account).toBeVisible();
    const [dateBox, accountBox, titleBox] = await Promise.all([date.boundingBox(), account.boundingBox(), title.boundingBox()]);
    if (!dateBox || !accountBox || !titleBox) throw new Error("Cabeçalho do fluxo diário indisponível");
    expect(dateBox.x + dateBox.width).toBeLessThanOrEqual(accountBox.x);
    expect(Math.abs(dateBox.y - accountBox.y)).toBeLessThanOrEqual(1);
    expect(Math.abs(dateBox.width - accountBox.width)).toBeLessThanOrEqual(1);
    expect(dateBox.height).toBe(48);
    expect(accountBox.height).toBe(48);
    if (width >= 768) expect(titleBox.x + titleBox.width).toBeLessThan(dateBox.x);
    if (width >= 768) expect(titleBox.y).toBeLessThan(dateBox.y + dateBox.height);
    await expect(page.getByRole("button", { name: "Hoje", exact: true })).toBeDisabled();
    await page.getByLabel("Data de movimento").fill("2026-10-01");
    await page.getByLabel("Caixa ou conta", { exact: true }).selectOption(f.boxes[f.headquartersId].cash);
    const summary = page.locator(".finance-overview-summaries");
    await expect(page).toHaveURL(url => url.searchParams.get("box") === f.boxes[f.headquartersId].cash);
    const before = await summary.innerText();
    await expect(page.locator(".finance-daily").getByText("Oferta de culto", { exact: true }).first()).toBeAttached();
    await page.getByRole("searchbox").fill("sem-correspondencia-e2e");
    await page.getByRole("button", { name: "Filtrar", exact: true }).click();
    await expect(page.getByText("Nenhuma movimentação corresponde aos filtros.")).toBeVisible();
    expect(await summary.innerText()).toBe(before);
    await page.getByRole("button", { name: "Limpar filtros" }).click();
    await page.getByRole("button", { name: "Dia anterior" }).click();
    await expect(page.getByLabel("Data de movimento")).toHaveValue("2026-09-30");
    await page.getByRole("button", { name: "Próximo dia" }).click();
    await expect(page.getByLabel("Data de movimento")).toHaveValue("2026-10-01");
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy();
  });
}

test("tesoureiro não recebe atalho e o endereço direto exige administrador", async ({ browser }) => {
  const context = await browser.newContext({
    baseURL: process.env.E2E_BASE_URL,
    storageState: process.env.E2E_STORAGE_STATE!.replace("admin-session", "treasurer-session"),
  });
  try {
    const page = await context.newPage();
    await page.goto("/financeiro");
    await expect(page.getByRole("heading", { name: "Visão geral" })).toBeAttached();
    await expect(page.getByRole("link", { name: "Fluxo de caixa diário" })).toHaveCount(0);
    await page.goto("/financeiro/fluxo-de-caixa");
    await expect(page).toHaveURL(/acesso-negado/);
  } finally {
    await context.close();
  }
});

test("a página compilada protege o acesso direto e mantém o saldo ao filtrar a listagem", async ({ request, playwright }) => {
  const path = "/financeiro/fluxo-de-caixa?date=2026-10-01";
  const original = await (await request.get(path)).text();
  expect(original).toContain("Movimentações do dia");
  expect(original).toContain("Oferta de culto");
  const filtered = await (await request.get(path + "&search=sem-correspondencia-e2e")).text();
  expect(filtered).toContain("Nenhuma movimentação corresponde aos filtros.");
  const section = /<div class="grid finance-overview-summaries">[\s\S]+?<\/section><\/div>/;
  const cards = original.match(section)?.[0];
  expect(cards).toBeTruthy();
  expect(filtered.match(section)?.[0]).toBe(cards);
  const treasurer = await playwright.request.newContext({
    baseURL: process.env.E2E_BASE_URL,
    storageState: process.env.E2E_STORAGE_STATE!.replace("admin-session", "treasurer-session"),
  });
  try {
    const response = await treasurer.get(path, { maxRedirects: 0 });
    const body = await response.text();
    expect(response.headers().location ?? body).toContain("/acesso-negado");
    expect(body).not.toContain("Oferta de culto");
  } finally {
    await treasurer.dispose();
  }
});

test("emite os dois PDFs pelo modal sem herdar os filtros da listagem", async ({
  page,
}) => {
  const fixture = JSON.parse(
    readFileSync(process.env.E2E_FINANCE_FIXTURE!, "utf8"),
  );
  const box = fixture.boxes[fixture.headquartersId].cash;
  await page.goto(
    `/financeiro/fluxo-de-caixa?date=2026-10-01&box=${box}&search=inexistente`,
  );
  await page.getByRole("button", { name: "Relatórios", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByText("01/10/2026")).toBeVisible();
  await expect(dialog.getByLabel("Caixas e contas")).toHaveValue("");
  await expect(dialog.getByRole("radio", { name: /Resumido/ })).toBeChecked();
  const payments = dialog.getByLabel("Incluir resumo por forma de pagamento");
  await expect(payments).not.toBeChecked();
  await expect(dialog.getByText(/todas as movimentações do dia/)).toBeVisible();
  for (const mode of ["resumido", "detalhado"]) {
    if (mode === "detalhado") {
      await dialog.getByRole("radio", { name: /Detalhado/ }).check();
      await dialog.getByLabel("Caixas e contas").selectOption(box);
      await payments.check();
    }
    const response = page.waitForResponse((r) =>
      r.url().endsWith("/api/finance/reports/pdf"),
    );
    await dialog.getByRole("button", { name: "Gerar PDF" }).click();
    const pdf = await response;
    expect(pdf.status()).toBe(200);
    expect(pdf.headers()["content-disposition"]).toContain(
      `fluxo-diario-${mode}-2026-10-01.pdf`,
    );
    expect((await pdf.body()).subarray(0, 5).toString()).toBe("%PDF-");
    await expect(
      dialog.getByRole("link", { name: "Baixar PDF" }),
    ).toBeVisible();
  }
});

test("a API compilada gera ambos os PDFs e protege a emissão direta", async ({
  request,
  playwright,
}) => {
  const fixture = JSON.parse(
    readFileSync(process.env.E2E_FINANCE_FIXTURE!, "utf8"),
  );
  const route = "/api/finance/reports/pdf";
  const daily = {
    type: "DAILY",
    date: "2026-10-01",
    presentation: "SUMMARY",
    includePayments: false,
  };
  for (const options of [
    daily,
    {
      ...daily,
      presentation: "DETAIL",
      includePayments: true,
      box: fixture.boxes[fixture.headquartersId].cash,
    },
  ]) {
    const pdf = await request.post(route, { data: options });
    expect(pdf.status(), pdf.ok() ? undefined : await pdf.text()).toBe(200);
    expect(pdf.headers()["cache-control"]).toContain("private, no-store");
    expect((await pdf.body()).subarray(0, 5).toString()).toBe("%PDF-");
  }
  const denied = await request.post(route, {
    data: { ...daily, box: fixture.boxes[fixture.unitId].cash },
  });
  expect(denied.status()).toBe(403);
  const treasurer = await playwright.request.newContext({
    baseURL: process.env.E2E_BASE_URL,
    storageState: process.env.E2E_STORAGE_STATE!.replace(
      "admin-session",
      "treasurer-session",
    ),
  });
  try {
    expect((await treasurer.post(route, { data: daily })).status()).toBe(403);
  } finally {
    await treasurer.dispose();
  }
});
