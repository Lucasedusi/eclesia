import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import ExcelJS from "exceljs";

test("statement review persists a draft, posts once, advances and restores an ignored row", async ({
  page,
}) => {
  test.skip(
    !process.env.E2E_FINANCE_FIXTURE,
    "Local financial fixture required",
  );
  const f = JSON.parse(readFileSync(process.env.E2E_FINANCE_FIXTURE!, "utf8"));
  const workbook = new ExcelJS.Workbook(),
    sheet = workbook.addWorksheet("LANÇAMENTOS");
  const reference = randomUUID();
  sheet.addRow(["EXTRATO CONTA CORRENTE"]);
  sheet.addRow([
    "DATA",
    "DOCUMENTO",
    "HISTÓRICO",
    "INFORMAÇÕES COMPLEMENTARES",
    "VALOR",
  ]);
  sheet.addRow([
    "21/10/2026",
    "PIX",
    "PIX RECEBIDO",
    `Oferta fictícia ${reference}`,
    100,
  ]);
  sheet.addRow(["21/10/2026", "PIX", "PIX ENVIADO", "Despesa fictícia", -25]);
  sheet.addRow([
    "21/10/2026",
    "PIX",
    "PIX RECEBIDO",
    "Transferência fictícia",
    50,
  ]);
  sheet.addRow(["21/10/2026", "", "SALDO ANTERIOR", "", 100]);
  sheet.addRow(["21/10/2026", "", "SALDO DO DIA", "", 225]);
  const bytes = Buffer.from(await workbook.xlsx.writeBuffer());
  const list = `/financeiro/lancamentos/importacoes?unidade=${f.unitId}&mes=2026-10`;
  await page.goto(list);
  await expect(
    page.getByRole("heading", { name: "Importar extrato bancário" }),
  ).toBeVisible();
  await page
    .getByRole("combobox", { name: "Conta bancária", exact: true })
    .selectOption(f.boxes[f.unitId].bank);
  await page
    .getByLabel("Extrato XLSX do Sicoob")
    .setInputFiles({
      name: "teste-banco.xlsx",
      mimeType:
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      buffer: bytes,
    });
  await page
    .getByRole("button", { name: "Preparar importação", exact: true })
    .click();
  await expect(page.getByText("3 movimentos", { exact: false })).toBeVisible();
  await page
    .getByText("Referências de saldo do extrato", { exact: true })
    .click();
  await expect(
    page.getByText("Saldos do arquivo conferem.", { exact: true }),
  ).toBeVisible();
  const batchUrl = page.url();
  await page
    .getByRole("button", { name: "Conferir linha 3", exact: true })
    .click();
  await expect(page.getByLabel("Data", { exact: true })).toBeDisabled();
  await expect(
    page.getByRole("combobox", { name: "Caixa ou conta", exact: true }),
  ).toBeDisabled();
  await page
    .getByRole("combobox", { name: "Categoria", exact: true })
    .selectOption(f.offeringId);
  await page
    .getByRole("button", { name: "Salvar rascunho", exact: true })
    .click();
  await expect(
    page.getByText("Rascunho salvo.", { exact: true }),
  ).toBeVisible();
  await page.reload();
  await page
    .getByRole("button", { name: "Conferir linha 3", exact: true })
    .click();
  await expect(
    page.getByRole("combobox", { name: "Categoria", exact: true }),
  ).toHaveValue(f.offeringId);
  await page
    .getByRole("combobox", { name: "Identificação", exact: true })
    .selectOption("COLLECTIVE");
  await page
    .getByRole("button", { name: "Finalizar e próximo", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Conferir linha 4", exact: true }),
  ).toBeVisible();
  await page
    .getByLabel("Motivo da decisão")
    .fill("Conferência adiada no teste local");
  await page.getByRole("button", { name: "Ignorar item", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Restaurar pendência", exact: true }),
  ).toBeVisible();
  await page
    .getByLabel("Motivo da decisão")
    .fill("Retomar conferência no teste local");
  await page
    .getByRole("button", { name: "Restaurar pendência", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Finalizar", exact: true }),
  ).toBeVisible();
  await page.screenshot({
    path: "tmp/finance-bank-import-review.png",
    fullPage: true,
  });
  await page.goto(list);
  await page
    .getByRole("combobox", { name: "Conta bancária", exact: true })
    .selectOption(f.boxes[f.unitId].bank);
  await page
    .getByLabel("Extrato XLSX do Sicoob")
    .setInputFiles({
      name: "mesmo-arquivo.xlsx",
      mimeType:
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      buffer: bytes,
    });
  await page
    .getByRole("button", { name: "Preparar importação", exact: true })
    .click();
  await expect(page).toHaveURL(batchUrl);
  await expect(page.getByText("1 concluído", { exact: false })).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(
    page
      .getByText("Use um computador para conferir e importar extratos.")
      .filter({ visible: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Conferir linha 4", exact: true }),
  ).not.toBeVisible();
  await page.screenshot({
    path: "tmp/finance-bank-import-mobile.png",
    fullPage: true,
  });
});

test("links a manual expense, creates a transfer and recognizes an overlapping statement", async ({ page }) => {
  test.skip(!process.env.E2E_FINANCE_FIXTURE, "Local financial fixture required");
  test.setTimeout(60000);
  const f = JSON.parse(readFileSync(process.env.E2E_FINANCE_FIXTURE!, "utf8"));
  const reference = randomUUID(), cents = 3000 + Math.floor(Math.random() * 10000), value = (cents / 100).toFixed(2).replace(".", ",");
  page.on("dialog", dialog => dialog.accept());
  await page.goto(`/financeiro/lancamentos?unidade=${f.unitId}&mes=2026-10`);
  await page.getByRole("button", { name: "Nova saída", exact: true }).click();
  const manual = page.getByRole("dialog");
  await manual.getByLabel("Data", { exact: true }).fill("2026-10-22");
  await manual.getByRole("combobox", { name: "Caixa ou conta", exact: true }).selectOption(f.boxes[f.unitId].bank);
  await manual.getByRole("combobox", { name: "Categoria", exact: true }).selectOption(f.expenseId);
  await manual.getByLabel("Valor (R$)", { exact: true }).fill(value);
  await manual.getByRole("button", { name: "Salvar", exact: true }).click();
  await expect(manual).toHaveCount(0);
  const workbook = new ExcelJS.Workbook(), sheet = workbook.addWorksheet("LANÇAMENTOS");
  sheet.addRow(["EXTRATO CONTA CORRENTE"]);
  sheet.addRow(["DATA", "DOCUMENTO", "HISTÓRICO", "INFORMAÇÕES COMPLEMENTARES", "VALOR"]);
  sheet.addRow(["22/10/2026", "PIX", "PIX ENVIADO", `Despesa fictícia ${reference}`, -cents / 100]);
  sheet.addRow(["22/10/2026", "TRF", "TRANSFERÊNCIA", `Transferência fictícia ${reference}`, 52.37]);
  async function upload() {
    await page.goto(`/financeiro/lancamentos/importacoes?unidade=${f.unitId}&mes=2026-10`);
    await page.getByLabel("Extrato XLSX do Sicoob").setInputFiles({ name: `vinculos-${reference}.xlsx`, mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", buffer: Buffer.from(await workbook.xlsx.writeBuffer()) });
    await page.getByRole("button", { name: "Preparar importação", exact: true }).click();
    await expect(page.getByText("2 movimentos", { exact: false })).toBeVisible();
  }
  await upload();
  await page.getByRole("button", { name: "Conferir linha 3", exact: true }).click();
  await page.getByRole("button", { name: "Vincular este registro", exact: true }).filter({ hasNot: page.locator("[disabled]") }).first().click();
  await expect(page.getByRole("button", { name: "Desfazer vínculo", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Voltar à fila", exact: true }).click();
  await page.getByRole("button", { name: "Conferir linha 4", exact: true }).click();
  await page.getByRole("button", { name: "Transferência interna", exact: true }).click();
  await page.getByRole("combobox", { name: "Outra conta ou caixa", exact: true }).selectOption(f.boxes[f.unitId].cash);
  await page.getByLabel("Descrição da transferência").fill(`Transferência de teste ${reference}`);
  await page.getByRole("button", { name: "Confirmar transferência", exact: true }).click();
  await expect(page.getByText("Este item possui uma referência financeira registrada.")).toBeVisible();
  // Change workbook metadata, retaining the exact source rows, to simulate a second export.
  workbook.created = new Date("2026-10-22T11:00:00Z");
  await upload();
  await page.getByRole("button", { name: "Conferir linha 4", exact: true }).click();
  await expect(page.getByLabel("Motivo para tratar como movimento distinto")).toBeVisible();
  await page.getByRole("button", { name: "É o mesmo movimento", exact: true }).click();
  await expect(page.getByRole("button", { name: "Desfazer vínculo", exact: true })).toBeVisible();
  await expect(page.getByText("Mesmo movimento", { exact: false }).filter({ visible: true }).first()).toBeVisible();
});
