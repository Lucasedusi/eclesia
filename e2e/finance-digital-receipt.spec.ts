import { expect, test, type Page } from "@playwright/test";
import { readFileSync, writeFileSync } from "node:fs";

test.beforeEach(() => {
  test.skip(!process.env.E2E_STORAGE_STATE || !process.env.E2E_FINANCE_FIXTURE, "Requires local financial fixture");
});

async function createEntry(page: Page) {
  const f = JSON.parse(readFileSync(process.env.E2E_FINANCE_FIXTURE!, "utf8"));
  const name = `Pessoa Comprovante Digital ${Date.now()}`;
  await page.goto(`/financeiro/lancamentos?unidade=${f.unitId}&mes=2026-11`);
  await page.getByRole("button", { name: "Nova entrada", exact: true }).click();
  const form = page.getByRole("dialog");
  await expect(form.getByRole("button", { name: "Comprovante digital", exact: true })).toHaveCount(0);
  await form.getByLabel("Data", { exact: true }).fill("2026-11-02");
  await form.getByRole("combobox", { name: "Caixa ou conta", exact: true }).selectOption(f.boxes[f.unitId].cash);
  await form.getByRole("combobox", { name: /Identificação/ }).selectOption("UNREGISTERED");
  await form.getByLabel("Nome da pessoa", { exact: true }).fill(name);
  await form.getByRole("combobox", { name: "Categoria", exact: true }).selectOption(f.offeringId);
  await form.getByLabel("Valor (R$)", { exact: true }).fill("150,00");
  await expect(form.getByRole("button", { name: /imprimir/i })).toBeVisible();
  await form.getByRole("button", { name: "Salvar", exact: true }).click();
  await expect(form).toHaveCount(0);
  return name;
}

async function details(page: Page, name: string, mobile = false) {
  if (mobile) await page.getByRole("list", { name: "Lançamentos em cartões" }).getByRole("button").filter({ hasText: name }).click();
  else await page.getByRole("button", { name: `Detalhes Oferta de culto ${name}`, exact: true }).click();
  await expect(page.getByRole("dialog", { name: "Detalhes do lançamento" })).toBeVisible();
}

for (const mobile of [false, true]) {
  test(`manual WhatsApp link and anonymous receipt work on ${mobile ? "mobile" : "desktop"}`, async ({ page, context, browser }) => {
    const name = await createEntry(page);
    if (mobile) await page.setViewportSize({ width: 390, height: 844 });
    await details(page, name, mobile);
    await expect(page.getByRole("link", { name: "Imprimir comprovante", exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Comprovante digital", exact: true }).click();
    const dialog = page.getByRole("dialog", { name: "Comprovante digital", exact: true });
    await expect(dialog).toBeVisible();
    await dialog.getByLabel("Telefone do destinatário").fill("123");
    await dialog.getByRole("button", { name: "Abrir WhatsApp", exact: true }).click();
    await expect(dialog.getByRole("alert")).toContainText("telefone válido");
    await dialog.getByLabel("Telefone do destinatário").fill("(62) 99999-1234");
    const url = (await dialog.getByRole("link", { name: "Visualizar comprovante" }).getAttribute("href"))!;
    await page.screenshot({ path: test.info().outputPath("dialog.png") });
    await context.route("https://wa.me/**", (route) => route.fulfill({ body: "WhatsApp simulado: nenhum envio real." }));
    const popupEvent = context.waitForEvent("page");
    await dialog.getByRole("button", { name: "Abrir WhatsApp", exact: true }).click();
    const popup = await popupEvent;
    await popup.waitForLoadState();
    expect(new URL(popup.url()).pathname).toBe("/5562999991234");
    expect(new URL(popup.url()).searchParams.get("text")).toContain(url);
    await popup.close();
    await expect(dialog).toBeVisible();
    const anon = await browser.newContext({ storageState: { cookies: [], origins: [] }, viewport: mobile ? { width: 390, height: 844 } : { width: 1440, height: 1000 } });
    const recipient = await anon.newPage();
    const response = await recipient.goto(url);
    expect(response?.status()).toBe(200);
    expect(response?.headers()["cache-control"]).toContain("no-store");
    expect(response?.headers()["referrer-policy"]).toBe("no-referrer");
    await expect(recipient.getByRole("heading", { name: "Comprovante de contribuição" })).toBeVisible();
    await expect(recipient.getByText(name, { exact: true })).toBeVisible();
    await expect(recipient.locator(".total")).toContainText("150,00");
    expect(await recipient.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
    await recipient.screenshot({ path: test.info().outputPath("receipt.png"), fullPage: true });
    const pdf = await anon.request.get(`${url}/pdf`);
    expect(pdf.status()).toBe(200);
    expect(pdf.headers()["content-type"]).toBe("application/pdf");
    expect((await pdf.body()).subarray(0, 4).toString()).toBe("%PDF");
    writeFileSync(test.info().outputPath("receipt.pdf"), await pdf.body());
    await anon.close();
    await dialog.getByRole("button", { name: "Voltar aos detalhes" }).click();
    await expect(page.getByRole("dialog", { name: "Detalhes do lançamento" })).toBeVisible();
  });
}

test("correction and cancellation invalidate previously shared links", async ({ page, playwright }) => {
  const name = await createEntry(page);
  await details(page, name);
  await page.getByRole("button", { name: "Comprovante digital", exact: true }).click();
  const oldUrl = (await page.getByRole("link", { name: "Visualizar comprovante" }).getAttribute("href"))!;
  await page.getByRole("button", { name: "Voltar aos detalhes" }).click();
  await page.getByRole("button", { name: "Corrigir", exact: true }).click();
  await page.getByRole("dialog").getByLabel("Valor (R$)", { exact: true }).fill("125,00");
  await page.getByLabel("Justificativa da correção").fill("Conferência fictícia de teste");
  await page.getByRole("button", { name: "Salvar correção" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  const anon = await playwright.request.newContext();
  expect((await anon.get(oldUrl)).status()).toBe(404);
  expect((await anon.get(`${oldUrl}/pdf`)).status()).toBe(404);
  await details(page, name);
  await expect(page.getByRole("button", { name: "Comprovante digital", exact: true })).toHaveCount(1);
  await page.getByRole("button", { name: "Comprovante digital", exact: true }).click();
  const newUrl = (await page.getByRole("link", { name: "Visualizar comprovante" }).getAttribute("href"))!;
  expect((await anon.get(newUrl)).status()).toBe(200);
  await page.getByRole("button", { name: "Voltar aos detalhes" }).click();
  await page.getByRole("button", { name: "Cancelar lançamento", exact: true }).click();
  await page.getByLabel("Justificativa", { exact: true }).fill("Cancelamento fictício de teste");
  await page.getByRole("button", { name: "Confirmar cancelamento" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  const unavailable = await anon.get(newUrl);
  expect(unavailable.status()).toBe(404);
  expect(await unavailable.text()).not.toContain(name);
  await details(page, name);
  await expect(page.getByRole("button", { name: "Comprovante digital", exact: true })).toHaveCount(0);
  await anon.dispose();
});

test("grouped attendance keeps all contributions in the shared document", async ({ page, playwright }) => {
  const f = JSON.parse(readFileSync(process.env.E2E_FINANCE_FIXTURE!, "utf8"));
  const name = `Atendimento Digital ${Date.now()}`;
  await page.goto(`/financeiro/atendimento?unidade=${f.unitId}&mes=2026-11`);
  await expect(page.getByRole("button", { name: "Comprovante digital", exact: true })).toHaveCount(0);
  await page.getByRole("combobox", { name: "Caixa ou conta" }).selectOption(f.boxes[f.unitId].cash);
  await page.getByRole("combobox", { name: "Identificação" }).selectOption("UNREGISTERED");
  await page.getByLabel("Nome da pessoa", { exact: true }).fill(name);
  await page.getByLabel("Data", { exact: true }).fill("2026-11-02");
  await page.getByRole("combobox", { name: "Categoria", exact: true }).selectOption(f.offeringId);
  await page.getByLabel("Valor (R$)", { exact: true }).fill("200,00");
  await page.getByRole("button", { name: "Adicionar contribuição" }).click();
  await page.getByRole("combobox", { name: "Categoria", exact: true }).nth(1).selectOption(f.missionsOfferingId);
  await page.getByLabel("Valor (R$)", { exact: true }).nth(1).fill("50,00");
  await page.getByRole("button", { name: "Confirmar atendimento" }).click();
  await expect(page.getByRole("link", { name: "Comprovante", exact: true })).toBeVisible();
  await page.goto(`/financeiro/lancamentos?unidade=${f.unitId}&mes=2026-11`);
  await details(page, name);
  await page.getByRole("button", { name: "Comprovante digital", exact: true }).click();
  await expect(page.getByText("Reúne todas as contribuições deste atendimento.")).toBeVisible();
  const url = (await page.getByRole("link", { name: "Visualizar comprovante" }).getAttribute("href"))!;
  const anon = await playwright.request.newContext();
  const response = await anon.get(url);
  const html = await response.text();
  expect(response.status()).toBe(200);
  expect(html).toContain("250,00");
  expect(html).toContain("Oferta de culto");
  expect(html).toContain("Oferta de missões");
  await anon.dispose();
});

test("network failure keeps details usable and allows retry", async ({ page }) => {
  const name = await createEntry(page);
  await details(page, name);
  await page.route("**/financeiro/lancamentos**", (route) => route.request().method() === "POST" ? route.abort() : route.continue());
  await page.getByRole("button", { name: "Comprovante digital", exact: true }).click();
  await expect(page.getByRole("dialog", { name: "Detalhes do lançamento" }).getByRole("alert")).toContainText("Não foi possível");
  await page.unroute("**/financeiro/lancamentos**");
  await page.getByRole("button", { name: "Comprovante digital", exact: true }).click();
  await expect(page.getByRole("dialog", { name: "Comprovante digital", exact: true })).toBeVisible();
});
