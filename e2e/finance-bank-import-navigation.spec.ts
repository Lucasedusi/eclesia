import { test, expect, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import ExcelJS from "exceljs";

test.setTimeout(60_000);

function fixture() {
  test.skip(
    !process.env.E2E_FINANCE_FIXTURE,
    "Local financial fixture required",
  );
  expect(process.env.E2E_BASE_URL).toBe("http://127.0.0.1:3217");
  return JSON.parse(readFileSync(process.env.E2E_FINANCE_FIXTURE!, "utf8"));
}
async function statement(expenses = 1) {
  const name = `navegacao-${randomUUID()}.xlsx`;
  const book = new ExcelJS.Workbook(),
    sheet = book.addWorksheet("LANÇAMENTOS");
  sheet.addRow(["EXTRATO CONTA CORRENTE"]);
  sheet.addRow([
    "DATA",
    "DOCUMENTO",
    "HISTÓRICO",
    "INFORMAÇÕES COMPLEMENTARES",
    "VALOR",
  ]);
  sheet.addRow(["22/10/2026", "PIX", "PIX RECEBIDO", name, 100]);
  for (let i = 0; i < expenses; i++)
    sheet.addRow(["22/10/2026", "PIX", "PIX ENVIADO", `${name} ${i}`, -25 - i]);
  return {
    name,
    mimeType:
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    buffer: Buffer.from(await book.xlsx.writeBuffer()),
  };
}
async function openUpload(page: Page, unit: string) {
  await page.goto(
    `/financeiro/lancamentos/importacoes?unidade=${unit}&mes=2026-10`,
  );
  await expect(
    page.getByRole("heading", {
      name: "Importar extrato bancário",
      exact: true,
    }),
  ).toBeVisible({ timeout: 15_000 });
}
async function goThroughTransactions(page: Page) {
  await page.getByRole("link", { name: "Lançamentos", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Importar extrato", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Importar extrato", exact: true })
    .click();
  await expect(
    page.getByRole("heading", {
      name: "Importar extrato bancário",
      exact: true,
    }),
  ).toBeVisible({ timeout: 15_000 });
}

test("clears the uploaded file on success and on leaving, but retains it after a failed upload", async ({
  page,
}) => {
  const f = fixture(),
    file = await statement();
  await openUpload(page, f.unitId);
  const input = page.getByLabel("Extrato XLSX do Sicoob");
  const account = await page
    .getByRole("combobox", { name: "Conta bancária", exact: true })
    .boundingBox();
  const upload = await page
    .locator(".bank-import-upload-control")
    .boundingBox();
  expect(upload!.height).toBe(account!.height);
  expect(upload!.y).toBe(account!.y);
  await input.setInputFiles({
    ...file,
    buffer: Buffer.from("invalid workbook"),
  });
  await page
    .getByRole("button", { name: "Preparar importação", exact: true })
    .click();
  await expect(
    page.getByRole("alert").filter({ hasText: "Envie um XLSX do Sicoob" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Remover arquivo selecionado" }),
  ).toBeVisible();
  await input.setInputFiles(file);
  await page
    .getByRole("button", { name: "Preparar importação", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Todas as importações", exact: true })
    .click();
  await expect(
    page.getByRole("heading", {
      name: "Importar extrato bancário",
      exact: true,
    }),
  ).toBeVisible({ timeout: 15_000 });
  await expect(
    page.getByRole("button", { name: "Remover arquivo selecionado" }),
  ).toHaveCount(0);
  await expect(input).toHaveValue("");
  await input.setInputFiles(file);
  await goThroughTransactions(page);
  await expect(
    page.getByRole("button", { name: "Remover arquivo selecionado" }),
  ).toHaveCount(0);
  await expect(input).toHaveValue("");
  const row = page.getByRole("row").filter({ hasText: file.name });
  await row
    .getByRole("button", { name: "Ações da importação", exact: true })
    .click();
  await expect(
    page.getByRole("menuitem", { name: "Excluir importação", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("menuitem", { name: "Excluir importação", exact: true }),
  ).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(
    page.getByRole("menuitem", { name: "Excluir importação", exact: true }),
  ).not.toBeVisible();
  await row
    .getByRole("button", { name: "Ações da importação", exact: true })
    .click();
  await goThroughTransactions(page);
  await expect(
    page.getByRole("menuitem", { name: "Excluir importação", exact: true }),
  ).not.toBeVisible();
  await page.screenshot({
    path: "tmp/import-navigation-upload.png",
    fullPage: true,
  });
  await input.setInputFiles(file);
  await page.setViewportSize({ width: 1024, height: 900 });
  await expect(page.locator("body")).toHaveJSProperty("scrollWidth", 1024);
  await expect(page.locator(".bank-import-upload-control")).toHaveCSS(
    "height",
    "42px",
  );
  await page.screenshot({ path: "tmp/import-navigation-upload-medium.png" });
});

test("returning through Continue or browser history opens the queue after discarding an edit", async ({
  page,
}) => {
  const f = fixture(),
    file = await statement();
  await openUpload(page, f.unitId);
  await page.getByLabel("Extrato XLSX do Sicoob").setInputFiles(file);
  await page
    .getByRole("button", { name: "Preparar importação", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Conferir linha 3", exact: true })
    .click();
  await page
    .getByRole("combobox", { name: "Categoria", exact: true })
    .selectOption(f.offeringId);
  await page
    .getByRole("button", { name: "Todas as importações", exact: true })
    .click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Descartar", exact: true })
    .click();
  await page
    .getByRole("row")
    .filter({ hasText: file.name })
    .getByRole("button", { name: "Continuar", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Conferir linha 3", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Conferir linha 3", exact: true }),
  ).toHaveCount(0);
  await page
    .getByRole("button", { name: "Conferir linha 3", exact: true })
    .click();
  await expect(
    page.getByRole("combobox", { name: "Categoria", exact: true }),
  ).toHaveValue("");
  await page
    .getByRole("button", { name: "Todas as importações", exact: true })
    .click();
  await expect(
    page.getByRole("heading", {
      name: "Importar extrato bancário",
      exact: true,
    }),
  ).toBeVisible({ timeout: 15_000 });
  await page.goBack();
  await expect(
    page.getByRole("button", { name: "Conferir linha 3", exact: true }),
  ).toBeVisible();
  await page.goForward();
  await page
    .getByRole("row")
    .filter({ hasText: file.name })
    .getByRole("button", { name: "Continuar", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Conferir linha 3", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Conferir linha 3", exact: true })
    .click();
  await page
    .getByRole("combobox", { name: "Categoria", exact: true })
    .selectOption(f.offeringId);
  await page.getByRole("link", { name: "Lançamentos", exact: true }).click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Descartar", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Importar extrato", exact: true })
    .click();
  await page
    .getByRole("row")
    .filter({ hasText: file.name })
    .getByRole("button", { name: "Continuar", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Conferir linha 3", exact: true }),
  ).toBeVisible();
});

test("one Save posts and returns to the filtered queue, while More options saves an incomplete draft", async ({
  page,
}) => {
  const f = fixture(),
    file = await statement();
  await openUpload(page, f.unitId);
  await page.getByLabel("Extrato XLSX do Sicoob").setInputFiles(file);
  await page
    .getByRole("button", { name: "Preparar importação", exact: true })
    .click();
  await page
    .getByRole("combobox", { name: "Direção", exact: true })
    .selectOption("INCOME");
  await page.getByRole("button", { name: "Filtrar", exact: true }).click();
  await page
    .getByRole("button", { name: "Conferir linha 3", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Salvar rascunho", exact: true }),
  ).not.toBeVisible();
  await page.getByText("Mais opções", { exact: true }).click();
  await page
    .getByRole("button", { name: "Salvar rascunho", exact: true })
    .click();
  await expect(
    page.getByText("Rascunho salvo.", { exact: true }),
  ).toBeVisible();
  await page
    .getByRole("combobox", { name: "Categoria", exact: true })
    .selectOption(f.offeringId);
  await page
    .getByRole("combobox", { name: /Identificação/ })
    .selectOption("COLLECTIVE");
  await page
    .getByRole("button", { name: "Salvar rascunho", exact: true })
    .click();
  await expect(
    page.getByText("Rascunho salvo.", { exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Todas as importações", exact: true })
    .click();
  await page
    .getByRole("row")
    .filter({ hasText: file.name })
    .getByRole("button", { name: "Continuar", exact: true })
    .click();
  await page
    .getByRole("combobox", { name: "Direção", exact: true })
    .selectOption("INCOME");
  await page.getByRole("button", { name: "Filtrar", exact: true }).click();
  await expect(page).toHaveURL(/direction=INCOME/);
  const filteredUrl = page.url();
  await page
    .getByRole("button", { name: "Conferir linha 3", exact: true })
    .click();
  await expect(
    page.getByRole("combobox", { name: "Categoria", exact: true }),
  ).toHaveValue(f.offeringId);
  await expect(
    page.locator(".finance-attendance-summary").getByRole("button"),
  ).toHaveCount(1);
  await page.getByRole("button", { name: "Salvar", exact: true }).click();
  await expect(
    page.getByText("Lançamento salvo.", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("combobox", { name: "Direção", exact: true }),
  ).toHaveValue("INCOME");
  await expect(page).toHaveURL(filteredUrl);
  await expect(
    page.getByRole("button", { name: "Conferir linha 3", exact: true }),
  ).toHaveCount(0);
  await expect(page.getByText("1 concluído", { exact: false })).toBeVisible();
  await page
    .getByRole("button", { name: "Todas as importações", exact: true })
    .click();
  await page
    .getByRole("row")
    .filter({ hasText: file.name })
    .getByRole("button", { name: "Ações da importação", exact: true })
    .click();
  await expect(
    page.getByRole("menuitem", { name: "Excluir importação", exact: true }),
  ).toBeDisabled();
  await page.keyboard.press("Escape");
  await page
    .getByRole("row")
    .filter({ hasText: file.name })
    .getByRole("button", { name: "Continuar", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Conferir linha 4", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Conferir linha 4", exact: true })
    .click();
  await page
    .getByRole("combobox", { name: "Categoria", exact: true })
    .selectOption(f.expenseId);
  await page.screenshot({
    path: "tmp/import-navigation-expense.png",
    fullPage: true,
  });
  await page.getByRole("button", { name: "Salvar", exact: true }).click();
  await expect(page.getByText("2 concluído", { exact: false })).toBeVisible();
  await expect(
    page.getByRole("combobox", { name: "Situação", exact: true }),
  ).toBeVisible();
});

test("Enter in the entry form saves the movement even with More options open", async ({
  page,
}) => {
  const f = fixture(),
    file = await statement();
  await openUpload(page, f.unitId);
  await page.getByLabel("Extrato XLSX do Sicoob").setInputFiles(file);
  await page
    .getByRole("button", { name: "Preparar importação", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Conferir linha 3", exact: true })
    .click();
  await page
    .getByRole("combobox", { name: "Categoria", exact: true })
    .selectOption(f.offeringId);
  await page
    .getByRole("combobox", { name: /Identificação/ })
    .selectOption("COLLECTIVE");
  await page.getByText("Mais opções", { exact: true }).click();
  await page
    .getByRole("textbox", { name: "Descrição da contribuição", exact: true })
    .fill("Oferta local via teclado");
  await page
    .getByRole("textbox", { name: "Descrição da contribuição", exact: true })
    .press("Enter");
  await expect(
    page.getByText("Lançamento salvo.", { exact: true }),
  ).toBeVisible();
  await expect(page.getByText("1 concluído", { exact: false })).toBeVisible();
});

test("saving the last row on page two keeps the expense filter and shows the remaining first page", async ({
  page,
}) => {
  const f = fixture(),
    file = await statement(51);
  await openUpload(page, f.unitId);
  await page.getByLabel("Extrato XLSX do Sicoob").setInputFiles(file);
  await page
    .getByRole("button", { name: "Preparar importação", exact: true })
    .click();
  await page
    .getByRole("combobox", { name: "Direção", exact: true })
    .selectOption("EXPENSE");
  await page.getByRole("button", { name: "Filtrar", exact: true }).click();
  await expect(page).toHaveURL(/direction=EXPENSE/);
  await page.getByRole("button", { name: "Próxima", exact: true }).click();
  await expect(page.getByText("Página 2 de 2", { exact: true })).toBeVisible();
  await page
    .getByRole("button", { name: "Conferir linha 54", exact: true })
    .click();
  await page
    .getByRole("combobox", { name: "Categoria", exact: true })
    .selectOption(f.expenseId);
  await page.getByRole("button", { name: "Salvar", exact: true }).click();
  await expect(
    page.getByText("Lançamento salvo.", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("combobox", { name: "Direção", exact: true }),
  ).toHaveValue("EXPENSE");
  await expect(
    page.getByRole("button", { name: "Conferir linha 4", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Conferir linha 54", exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("navigation", { name: "Páginas do extrato", exact: true }),
  ).toHaveCount(0);
  await expect(page.getByText("1 concluído", { exact: false })).toBeVisible();
});
