import { test, expect, type Page, type Locator } from "@playwright/test";
import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import ExcelJS from "exceljs";

test.setTimeout(90_000);
function fixture() {
  test.skip(!process.env.E2E_FINANCE_FIXTURE, "Local fixture required");
  expect(process.env.E2E_BASE_URL).toBe("http://127.0.0.1:3217");
  return JSON.parse(readFileSync(process.env.E2E_FINANCE_FIXTURE!, "utf8"));
}
async function chooseCongregation(scope: Page | Locator) {
  await scope
    .getByRole("combobox", { name: /Identificação/ })
    .selectOption("CONGREGATION");
  await scope.getByLabel("Nome da congregação").fill("Headquarters");
  await scope
    .getByRole("button", { name: "Buscar congregação", exact: true })
    .click();
  await scope
    .getByRole("button", { name: "Headquarters", exact: true })
    .click();
}

test("manual income and expense share identity and retain congregation through correction and filtering", async ({
  page,
}) => {
  const f = fixture();
  await page.goto(`/financeiro/lancamentos?unidade=${f.unitId}&mes=2026-10`);
  await page.getByRole("button", { name: "Nova entrada", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await chooseCongregation(dialog);
  await dialog.getByLabel("Data", { exact: true }).fill("2026-10-05");
  await dialog
    .getByRole("combobox", { name: "Caixa ou conta", exact: true })
    .selectOption(f.boxes[f.unitId].cash);
  await dialog
    .getByRole("combobox", { name: "Categoria", exact: true })
    .selectOption(f.offeringId);
  await dialog.getByLabel("Valor (R$)", { exact: true }).fill("73,00");
  await expect(dialog.locator(".finance-entry-review")).toContainText(
    "Recebido de",
  );
  await expect(dialog.locator(".finance-entry-review")).toContainText(
    "Headquarters",
  );
  await dialog.getByRole("button", { name: "Salvar", exact: true }).click();
  await expect(dialog).toHaveCount(0);
  await page
    .getByRole("button", { name: "Filtros avançados", exact: true })
    .click();
  await page.getByLabel("Nome da congregação").fill("Headquarters");
  await page
    .getByRole("button", { name: "Buscar congregação", exact: true })
    .click();
  await page.getByRole("button", { name: "Headquarters", exact: true }).click();
  await page.getByRole("button", { name: "Filtrar", exact: true }).click();
  await expect(page).toHaveURL(
    new RegExp(`contributorCongregationId=${f.headquartersId}`),
  );
  await page
    .getByRole("row")
    .filter({ hasText: "05/10/2026" })
    .getByRole("button", {
      name: "Detalhes Oferta de culto Headquarters",
      exact: true,
    })
    .first()
    .click();
  await page.getByRole("button", { name: "Corrigir", exact: true }).click();
  await expect(
    dialog.getByRole("combobox", { name: /Identificação/ }),
  ).toHaveValue("CONGREGATION");
  await expect(
    dialog.getByText("Headquarters", { exact: true }).first(),
  ).toBeVisible();
  await dialog.getByLabel("Valor (R$)", { exact: true }).fill("74,00");
  await dialog
    .getByLabel("Justificativa da correção")
    .fill("Conferência do pagamento da congregação");
  await dialog
    .getByRole("button", { name: "Salvar correção", exact: true })
    .click();
  await expect(dialog).toHaveCount(0);
  await page.getByRole("button", { name: "Nova saída", exact: true }).click();
  await dialog
    .getByRole("combobox", { name: /Pago a/ })
    .selectOption("ORGANIZATION");
  const vendor = `Energia ${randomUUID()}`;
  await dialog.getByLabel("Nome ou identificação").fill(vendor);
  await dialog.getByLabel("Data", { exact: true }).fill("2026-10-05");
  await dialog
    .getByRole("combobox", { name: "Caixa ou conta", exact: true })
    .selectOption(f.boxes[f.unitId].cash);
  await dialog
    .getByRole("combobox", { name: "Categoria", exact: true })
    .selectOption(f.expenseId);
  await dialog.getByLabel("Valor (R$)", { exact: true }).fill("25,00");
  await expect(dialog.locator(".finance-entry-review")).toContainText(vendor);
  await dialog.getByRole("button", { name: "Salvar e continuar", exact: true }).click();
  await expect(dialog.getByRole("combobox", { name: /Pago a/ })).toHaveValue("COLLECTIVE");
  await expect(dialog.locator(".finance-entry-review")).not.toContainText(vendor);
  await dialog.getByLabel("Valor (R$)", { exact: true }).fill("12,00");
  await dialog.getByRole("button", { name: "Salvar", exact: true }).click();
  await expect(dialog).toHaveCount(0);
  await page.goto(
    `/financeiro/lancamentos?unidade=${f.unitId}&mes=2026-10&search=${encodeURIComponent(vendor)}`,
  );
  await expect(page.getByRole("table")).toContainText(vendor);
  await page
    .getByRole("button", { name: new RegExp(`Detalhes.*${vendor}`) })
    .click();
  await page.getByRole("button", { name: "Corrigir", exact: true }).click();
  await expect(dialog.getByLabel("Nome ou identificação")).toHaveValue(vendor);
  await expect(dialog.getByRole("combobox", { name: /Pago a/ })).toHaveValue(
    "ORGANIZATION",
  );
});

test("bank import saves congregation draft and returns focus and scroll to queue after posting", async ({
  page,
}) => {
  const f = fixture(),
    name = `identificacao-${randomUUID()}.xlsx`;
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
  for (let i = 0; i < 18; i++)
    sheet.addRow([
      "22/10/2026",
      `PIX-${i}`,
      "PIX RECEBIDO",
      `${name} ${i}`,
      10 + i,
    ]);
  await page.goto(
    `/financeiro/lancamentos/importacoes?unidade=${f.unitId}&mes=2026-10`,
  );
  await page
    .getByLabel("Extrato XLSX do Sicoob")
    .setInputFiles({
      name,
      mimeType:
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      buffer: Buffer.from(await book.xlsx.writeBuffer()),
    });
  await page
    .getByRole("button", { name: "Preparar importação", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Conferir linha 20", exact: true })
    .click();
  await chooseCongregation(page);
  await page.getByText("Mais opções", { exact: true }).click();
  await page
    .getByRole("button", { name: "Salvar rascunho", exact: true })
    .click();
  await expect(
    page.getByText("Rascunho salvo.", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Conferir linha 20", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Voltar à fila", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Conferir linha 20", exact: true })
    .click();
  await expect(
    page.getByRole("combobox", { name: /Identificação/ }),
  ).toHaveValue("CONGREGATION");
  await page
    .getByRole("combobox", { name: "Categoria", exact: true })
    .selectOption(f.offeringId);
  const save = page.getByRole("button", { name: "Salvar", exact: true });
  await expect(save.locator(".finance-action-icon")).toHaveCSS(
    "border-right-width",
    "0px",
  );
  await expect(save).toHaveCSS("justify-content", "center");
  await save.click();
  const anchor = page.getByLabel("Início da listagem do extrato", {
    exact: true,
  });
  await expect(anchor).toBeFocused();
  await expect
    .poll(async () => (await anchor.boundingBox())?.y)
    .toBeLessThan(180);
  await expect(
    page.getByText("Lançamento salvo.", { exact: true }),
  ).toBeInViewport();
  await expect(
    page.getByRole("combobox", { name: "Situação", exact: true }),
  ).toBeInViewport();
  await expect(
    page.getByRole("button", { name: "Conferir linha 20", exact: true }),
  ).toHaveCount(0);
});

test("attendance accepts congregation and prints its identity; mobile expense accepts other organizations", async ({
  page,
}) => {
  const f = fixture();
  await page.goto(`/financeiro/atendimento?unidade=${f.unitId}&mes=2026-10`);
  await chooseCongregation(page);
  await page
    .getByLabel("Data", { exact: true })
    .filter({ visible: true })
    .fill("2026-10-06");
  await page
    .getByRole("combobox", { name: "Caixa ou conta", exact: true })
    .selectOption(f.boxes[f.unitId].cash);
  await page
    .getByRole("combobox", { name: "Categoria", exact: true })
    .selectOption(f.offeringId);
  await page.getByLabel("Valor (R$)", { exact: true }).fill("41,00");
  await page.screenshot({
    path: "tmp/identity-attendance.png",
    fullPage: true,
  });
  await page
    .getByRole("button", { name: "Confirmar atendimento", exact: true })
    .click();
  await expect(
    page.getByText("Atendimento confirmado.", { exact: false }),
  ).toBeVisible();
  const href = await page
    .getByRole("link", { name: "Comprovante", exact: true })
    .getAttribute("href");
  await page.goto(href!);
  await expect(page.locator(".financial-receipt")).toContainText(
    "Headquarters",
  );
  await expect(page.locator(".financial-receipt")).toContainText("R$ 41,00");
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(
    `/financeiro/lancamentos?unidade=${f.unitId}&mes=2026-10&novo=saida`,
  );
  const dialog = page.getByRole("dialog");
  await dialog
    .getByRole("combobox", { name: /Pago a/ })
    .selectOption("ORGANIZATION");
  await dialog
    .getByLabel("Nome ou identificação")
    .fill("Concessionária de água exemplo");
  await dialog.getByLabel("Data", { exact: true }).fill("2026-10-06");
  await dialog
    .getByRole("combobox", { name: "Caixa ou conta", exact: true })
    .selectOption(f.boxes[f.unitId].cash);
  await dialog
    .getByRole("combobox", { name: "Categoria", exact: true })
    .selectOption(f.expenseId);
  await dialog.getByLabel("Valor (R$)", { exact: true }).fill("19,50");
  expect(await dialog.evaluate((e) => e.scrollWidth <= e.clientWidth)).toBe(
    true,
  );
  await dialog.getByLabel("Nome ou identificação").scrollIntoViewIfNeeded();
  await page.screenshot({ path: "tmp/identity-mobile.png" });
  await dialog.getByRole("button", { name: "Salvar", exact: true }).click();
  await expect(dialog).toHaveCount(0);
});
