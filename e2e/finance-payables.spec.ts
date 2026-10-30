import { test, expect, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";

test.setTimeout(90_000);
test.use({ actionTimeout: 15_000 });
function fixture() {
  test.skip(!process.env.E2E_FINANCE_FIXTURE, "Local fixture required");
  expect(process.env.E2E_BASE_URL).toBe("http://127.0.0.1:3217");
  return JSON.parse(readFileSync(process.env.E2E_FINANCE_FIXTURE!, "utf8"));
}
async function create(page: Page, name: string, category: string, dueDate: string) {
  await page.getByRole("button", { name: "Nova conta", exact: true }).click();
  const form = page.getByRole("dialog", { name: "Nova conta" });
  await form.getByLabel("Nome da conta").fill(name);
  await form.getByRole("combobox", { name: "Categoria", exact: true }).selectOption(category);
  await form.getByLabel("Vencimento", { exact: true }).fill(dueDate);
  await form.getByRole("button", { name: "Salvar conta", exact: true }).click();
  await expect(form).toHaveCount(0);
}
async function search(page: Page, name: string) {
  await page.getByRole("searchbox").fill(name);
  await page.getByRole("button", { name: "Filtrar", exact: true }).click();
  await expect(page).toHaveURL((url) => url.searchParams.get("search") === name);
}
for (const width of [1280, 390, 320]) {
  test(`checklist lifecycle at ${width}px preserves Cathedral scope and history`, async ({ page }) => {
    const f = fixture(), name = `Energia ${randomUUID()}`;
    await page.setViewportSize({ width, height: 900 });
    await page.goto(`/financeiro/contas-a-pagar?unidade=${f.unitId}&mes=2026-10`);
    await expect(page.getByRole("heading", { name: "Contas a pagar" })).toBeVisible();
    await expect(page.getByRole("combobox", { name: "Congregação", exact: true })).toHaveCount(0);
    expect(await page.locator(".finance-payables-context .finance-single-unit").evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(true);
    await create(page, name, f.expenseId, "2026-10-10");
    await search(page, name);
    await expect(page.getByText("Não informado", { exact: true }).filter({ visible: true })).toBeVisible();
    await page.getByRole("button", { name: `Pagar: ${name}`, exact: true }).filter({ visible: true }).click();
    const pay = page.getByRole("dialog", { name: "Confirmar pagamento" });
    await pay.getByLabel("Data do pagamento").fill("2026-10-11");
    page.once("dialog", (dialog) => dialog.dismiss());
    await pay.getByRole("button", { name: "Cancelar", exact: true }).click();
    await expect(pay).toHaveCount(1);
    await pay.getByRole("button", { name: "Confirmar pagamento", exact: true }).click();
    await expect(pay).toHaveCount(0);
    await page.getByRole("tab", { name: /^Pagas/ }).click();
    await page.getByRole("button", { name: `Detalhes: ${name}`, exact: true }).filter({ visible: true }).click();
    const detail = page.getByRole("dialog", { name: "Detalhes da conta" });
    await expect(detail).toContainText("11/10/2026");
    await detail.getByText("Histórico de alterações", { exact: false }).click();
    await expect(detail.getByText("Pagamento confirmado", { exact: true })).toBeVisible();
    await detail.getByRole("button", { name: "Desfazer confirmação", exact: true }).click();
    const reopen = page.getByRole("dialog", { name: "Desfazer confirmação" });
    await reopen.getByLabel("Justificativa").fill("Confirmação informada por engano");
    await reopen.getByRole("button", { name: "Desfazer confirmação", exact: true }).click();
    await expect(reopen).toHaveCount(0);
    await page.getByRole("tab", { name: /^A pagar/ }).click();
    await page.getByRole("button", { name: `Ações: ${name}`, exact: true }).filter({ visible: true }).click();
    await page.getByRole("button", { name: "Editar", exact: true }).filter({ visible: true }).click();
    const edit = page.getByRole("dialog", { name: "Editar conta" });
    await edit.getByLabel("Valor (R$)").fill("235,90");
    await edit.getByRole("button", { name: "Salvar conta", exact: true }).click();
    await expect(edit).toHaveCount(0);
    await expect(page.getByText(/^R\$\s235,90$/)).toBeVisible();
    await expect(page.getByRole("main")).toHaveAttribute("aria-busy", "false");
    await page.screenshot({ path: `tmp/payables-${width}.png`, fullPage: true });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.getByRole("button", { name: `Ações: ${name}`, exact: true }).filter({ visible: true }).click();
    await page.getByRole("button", { name: "Excluir", exact: true }).filter({ visible: true }).click();
    await page.getByRole("dialog", { name: "Excluir conta" }).getByRole("button", { name: "Excluir conta", exact: true }).click();
    await expect(page.getByRole("dialog", { name: "Excluir conta" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: `Detalhes: ${name}`, exact: true })).toHaveCount(0);
  });
}

test("category creation retains form; monthly copies clamp dates and skip duplicates", async ({ page }) => {
  const f = fixture(), name = `Internet ${randomUUID()}`;
  await page.goto(`/financeiro/contas-a-pagar?unidade=${f.unitId}&mes=2028-01`);
  await page.getByRole("button", { name: "Nova conta", exact: true }).click();
  const form = page.getByRole("dialog", { name: "Nova conta" });
  await form.getByLabel("Nome da conta").fill(name);
  await form.getByLabel("Vencimento", { exact: true }).fill("2028-01-31");
  await form.getByRole("button", { name: "Nova categoria", exact: true }).click();
  const category = page.getByRole("dialog", { name: "Novo categoria" });
  await category.getByLabel("Nome", { exact: true }).fill(`Categoria ${name}`);
  await category.getByRole("combobox", { name: "Natureza", exact: true }).selectOption("EXPENSE");
  await category.getByRole("button", { name: "Salvar cadastro", exact: true }).click();
  await expect(category).toHaveCount(0);
  await expect(form.getByLabel("Nome da conta")).toHaveValue(name);
  await form.getByRole("combobox", { name: "Categoria", exact: true }).selectOption({ label: `Categoria ${name}` });
  await form.getByRole("button", { name: "Salvar conta", exact: true }).click();
  await expect(form).toHaveCount(0);
  await page.getByRole("button", { name: "Copiar para o próximo mês", exact: true }).click();
  const copy = page.getByRole("dialog", { name: "Copiar para o próximo mês" });
  await copy.getByRole("checkbox", { name, exact: true }).check();
  await copy.getByRole("button", { name: "Conferir cópias", exact: true }).click();
  await expect(copy.getByLabel(`Vencimento: ${name}`)).toHaveValue("2028-02-29");
  await copy.getByRole("button", { name: "Salvar cópias", exact: true }).click();
  await expect(copy).toHaveCount(0);
  await page.getByRole("button", { name: "Copiar para o próximo mês", exact: true }).click();
  await expect(copy.getByRole("checkbox", { name, exact: true })).toBeDisabled();
  await copy.getByRole("button", { name: "Fechar", exact: true }).click();
  await page.getByLabel("Mês do vencimento", { exact: true }).fill("2028-02");
  await expect(page.getByRole("button", { name: `Detalhes: ${name}`, exact: true }).filter({ visible: true })).toBeVisible();
});

test("old pending bills remain visible outside search and overview stays focused on finances", async ({ page }) => {
  const f = fixture(), name = `Antiga ${randomUUID()}`;
  await page.goto(`/financeiro/contas-a-pagar?unidade=${f.unitId}&mes=2025-01`);
  await create(page, name, f.expenseId, "2025-01-02");
  await page.getByLabel("Mês do vencimento", { exact: true }).fill("2026-10");
  await search(page, "nothing-found");
  await expect(page.getByRole("button", { name: "Ver pendências anteriores", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Ver pendências anteriores", exact: true }).click();
  await expect(page.getByRole("button", { name: `Detalhes: ${name}`, exact: true }).filter({ visible: true })).toBeVisible();
  await page.goto(`/financeiro?unidade=${f.unitId}&mes=2028-12`);
  await expect(page.getByRole("heading", { name: "Contas da Catedral", exact: true })).toHaveCount(0);
});

test("treasurer cannot access payables or administrative summary", async ({ browser }) => {
  const f = fixture();
  const context = await browser.newContext({ storageState: "tmp/finance-treasurer-session.json" });
  try {
    const page = await context.newPage();
    await page.goto(`/financeiro?unidade=${f.unitId}&mes=2026-10`);
    await expect(page.getByRole("heading", { name: "Visão geral" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Contas da Catedral" })).toHaveCount(0);
    await expect(page.getByRole("link", { name: "Contas a pagar", exact: true })).toHaveCount(0);
    await page.goto(`/financeiro/contas-a-pagar?unidade=${f.headquartersId}&mes=2026-10`);
    await expect(page).toHaveURL(/acesso-negado/);
  } finally { await context.close(); }
});

test("lost response retries the same creation without duplication", async ({ page }) => {
  const f = fixture(), name = `Rede ${randomUUID()}`;
  await page.goto(`/financeiro/contas-a-pagar?unidade=${f.unitId}&mes=2026-10`);
  await page.getByRole("button", { name: "Nova conta", exact: true }).click();
  const form = page.getByRole("dialog", { name: "Nova conta" });
  await form.getByLabel("Nome da conta").fill(name);
  await form.getByRole("combobox", { name: "Categoria", exact: true }).selectOption(f.expenseId);
  let intercepted = false;
  await page.route("**/financeiro/contas-a-pagar**", async (route) => {
    if (!intercepted && route.request().method() === "POST") {
      intercepted = true;
      await route.fetch();
      await route.abort("failed");
    } else await route.continue();
  });
  await form.getByRole("button", { name: "Salvar conta", exact: true }).click();
  await expect(form.getByRole("button", { name: "Conferir gravação", exact: true })).toBeVisible();
  await expect(form.getByLabel("Nome da conta")).toBeDisabled();
  await page.unroute("**/financeiro/contas-a-pagar**");
  await form.getByRole("button", { name: "Conferir gravação", exact: true }).click();
  await expect(form).toHaveCount(0);
  await search(page, name);
  await expect(page.getByRole("tab", { name: "A pagar (1)", exact: true })).toBeVisible();
});

test("concurrent edits preserve the winning revision and require review", async ({ page }) => {
  const f = fixture(), name = `Concorrência ${randomUUID()}`;
  await page.goto(`/financeiro/contas-a-pagar?unidade=${f.unitId}&mes=2026-10`);
  await create(page, name, f.expenseId, "2026-10-25");
  await search(page, name);
  const other = await page.context().newPage();
  try {
    await other.goto(page.url());
    for (const current of [page, other]) {
      await current.getByRole("button", { name: `Ações: ${name}`, exact: true }).click();
      await current.getByRole("button", { name: "Editar", exact: true }).click();
    }
    const first = page.getByRole("dialog", { name: "Editar conta" });
    const second = other.getByRole("dialog", { name: "Editar conta" });
    await first.getByLabel("Valor (R$)").fill("10,00");
    await first.getByRole("button", { name: "Salvar conta", exact: true }).click();
    await expect(first).toHaveCount(0);
    await second.getByLabel("Valor (R$)").fill("20,00");
    await second.getByRole("button", { name: "Salvar conta", exact: true }).click();
    await expect(second.getByRole("alert")).toContainText("Este registro mudou", { timeout: 15_000 });
    await expect(second.getByLabel("Valor (R$)")).toHaveValue("20,00");
    other.once("dialog", (dialog) => dialog.accept());
    await second.getByRole("button", { name: "Cancelar", exact: true }).click();
    await expect(other.getByText(/^R\$\s10,00$/)).toBeVisible();
    await other.getByRole("button", { name: `Detalhes: ${name}`, exact: true }).click();
    await other.getByRole("dialog", { name: "Detalhes da conta" }).getByText("Histórico de alterações", { exact: false }).click();
    await expect(other.getByRole("dialog", { name: "Detalhes da conta" }).getByText("Conta editada", { exact: true })).toBeVisible();
  } finally { await other.close(); }
});

test("monthly copy keeps selection across pages", async ({ page }) => {
  const f = fixture(), prefix = `Página ${randomUUID()}`;
  await page.goto(`/financeiro/contas-a-pagar?unidade=${f.unitId}&mes=2032-03`);
  for (let day = 1; day <= 21; day++) await create(page, `${prefix} ${day}`, f.expenseId, `2032-03-${String(day).padStart(2, "0")}`);
  await search(page, prefix);
  await expect(page.getByText("21 conta(s) · Página 1 de 2")).toBeVisible();
  await page.getByRole("button", { name: "Próxima", exact: true }).click();
  await expect(page.getByRole("button", { name: `Detalhes: ${prefix} 21`, exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Copiar para o próximo mês", exact: true }).click();
  const copy = page.getByRole("dialog", { name: "Copiar para o próximo mês" });
  await expect(copy).toBeVisible();
  for (;;) {
    for (const name of [`${prefix} 1`, `${prefix} 21`]) {
      const choice = copy.getByRole("checkbox", { name, exact: true });
      if (await choice.count()) await choice.check();
    }
    const next = copy.getByRole("button", { name: "Próxima", exact: true });
    if (await next.isDisabled()) break;
    const current = await copy.getByText(/^Página \d+ de/).textContent();
    await next.click();
    await expect(copy.getByText(/^Página \d+ de/)).not.toHaveText(current!);
  }
  await expect(copy.getByText("2 selecionada(s), até 100 por vez.")).toBeVisible();
  await copy.getByRole("button", { name: "Conferir cópias", exact: true }).click();
  await expect(copy.getByLabel(`Vencimento: ${prefix} 1`, { exact: true })).toHaveValue("2032-04-01");
  await expect(copy.getByLabel(`Vencimento: ${prefix} 21`, { exact: true })).toHaveValue("2032-04-21");
  await copy.getByRole("button", { name: "Salvar cópias", exact: true }).click();
  await expect(copy).toHaveCount(0);
  await expect(page.getByRole("status").filter({ hasText: "2 conta(s) copiada(s)." })).toBeVisible();
});
