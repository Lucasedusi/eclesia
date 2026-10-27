import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { execFileSync } from "node:child_process";
import ExcelJS from "exceljs";

test("preserves an old split draft until the operator explicitly unifies it", async ({
  page,
}) => {
  test.skip(!process.env.E2E_FINANCE_FIXTURE, "Local fixture required");
  expect(process.env.E2E_BASE_URL).toBe("http://127.0.0.1:3217");
  const f = JSON.parse(readFileSync(process.env.E2E_FINANCE_FIXTURE!, "utf8"));
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
  sheet.addRow(["22/10/2026", "PIX", "PIX RECEBIDO", randomUUID(), 100]);
  await page.goto(
    `/financeiro/lancamentos/importacoes?unidade=${f.unitId}&mes=2026-10`,
  );
  await page.getByLabel("Extrato XLSX do Sicoob").setInputFiles({
    name: "rascunho-antigo.xlsx",
    mimeType:
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    buffer: Buffer.from(await book.xlsx.writeBuffer()),
  });
  await page
    .getByRole("button", { name: "Preparar importação", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Conferir linha 3", exact: true })
    .click();
  await page
    .getByRole("combobox", { name: "Categoria", exact: true })
    .selectOption(f.offeringId);
  await page.getByText("Mais opções", { exact: true }).click();
  await page
    .getByRole("button", { name: "Salvar rascunho", exact: true })
    .click();
  await expect(
    page.getByText("Rascunho salvo.", { exact: true }),
  ).toBeVisible();
  const batch = new URL(page.url()).pathname.split("/").at(-1)!;
  for (const id of [batch, f.churchId])
    expect(id).toMatch(/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/);
  // Simulate a draft created by the prior UI, exclusively in the local Docker fixture.
  execFileSync(
    "docker",
    [
      "exec",
      "-i",
      "supabase_db_eclesia",
      "psql",
      "-X",
      "-v",
      "ON_ERROR_STOP=1",
      "-U",
      "postgres",
      "-d",
      "postgres",
    ],
    {
      env: {
        ...process.env,
        DOCKER_HOST: "unix:///Users/mac/.colima/eclesia/docker.sock",
      },
      input: `update public.finance_bank_import_items set draft=jsonb_set(jsonb_set(draft,'{state,amount}','"60,00"'),'{extra}',jsonb_build_array(jsonb_build_object('categoryId',draft#>>'{state,categoryId}','departmentId',draft#>>'{state,departmentId}','amount','40,00','titheClassificationId',null,'description','Classificação antiga','notes','','documentNumber',''))) where church_id='${f.churchId}' and batch_id='${batch}' and row_number=3;`,
      stdio: ["pipe", "ignore", "pipe"],
    },
  );
  await page.reload();
  await page
    .getByRole("button", { name: "Conferir linha 3", exact: true })
    .click();
  const amounts = page.getByLabel("Valor (R$)", { exact: true });
  await expect(amounts).toHaveCount(2);
  await expect(amounts.nth(0)).toHaveValue("60,00");
  await expect(amounts.nth(1)).toHaveValue("40,00");
  await expect(
    page.getByText("As classificações foram preservadas.", { exact: false }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", {
      name: /Adicionar contribuição|Remover contribuição/,
    }),
  ).toHaveCount(0);
  page.once("dialog", (dialog) => dialog.dismiss());
  await page
    .getByRole("button", { name: "Usar uma classificação", exact: true })
    .click();
  await expect(amounts).toHaveCount(2);
  page.once("dialog", (dialog) => dialog.accept());
  await page
    .getByRole("button", { name: "Usar uma classificação", exact: true })
    .click();
  await expect(amounts).toHaveCount(1);
  await expect(amounts).toHaveValue("100,00");
  await expect(amounts).toHaveAttribute("readonly", "");
  await page.getByText("Mais opções", { exact: true }).click();
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
  await expect(amounts).toHaveCount(1);
  await expect(amounts).toHaveValue("100,00");
});

test("statement review persists a draft, posts once, returns to the queue and restores an ignored row", async ({
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
  await page.getByLabel("Extrato XLSX do Sicoob").setInputFiles({
    name: "teste-banco.xlsx",
    mimeType:
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    buffer: bytes,
  });
  await page
    .getByRole("button", { name: "Preparar importação", exact: true })
    .click();
  await expect(page.getByText("3 movimentos", { exact: false })).toBeVisible();
  await expect(
    page.getByText("Referências de saldo do extrato", { exact: true }),
  ).toHaveCount(0);
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
  await page.getByText("Mais opções", { exact: true }).click();
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
    .getByRole("combobox", { name: /Identificação/ })
    .selectOption("COLLECTIVE");
  await page.getByRole("button", { name: "Salvar", exact: true }).click();
  await page
    .getByRole("button", { name: "Conferir linha 4", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Conferir linha 4", exact: true }),
  ).toBeVisible();
  await page.getByText("Mais opções", { exact: true }).click();
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
    page.getByRole("button", { name: "Salvar", exact: true }),
  ).toBeVisible();
  await page.screenshot({
    path: "tmp/finance-bank-import-review.png",
    fullPage: true,
  });
  await page.goto(list);
  await page
    .getByRole("combobox", { name: "Conta bancária", exact: true })
    .selectOption(f.boxes[f.unitId].bank);
  await page.getByLabel("Extrato XLSX do Sicoob").setInputFiles({
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

test("a lost confirmation response retries the same posting and retains invalid rows", async ({
  page,
}) => {
  test.skip(
    !process.env.E2E_FINANCE_FIXTURE,
    "Local financial fixture required",
  );
  const f = JSON.parse(readFileSync(process.env.E2E_FINANCE_FIXTURE!, "utf8"));
  const workbook = new ExcelJS.Workbook(),
    sheet = workbook.addWorksheet("LANÇAMENTOS");
  sheet.addRow(["EXTRATO CONTA CORRENTE"]);
  sheet.addRow([
    "DATA",
    "DOCUMENTO",
    "HISTÓRICO",
    "INFORMAÇÕES COMPLEMENTARES",
    "VALOR",
  ]);
  sheet.addRow([
    "22/10/2026",
    "PIX",
    "PIX RECEBIDO",
    `Retentativa fictícia ${randomUUID()}`,
    27.19,
  ]);
  sheet.addRow([
    "22/10/2026",
    "INVÁLIDO",
    "AJUSTE A CONFERIR",
    "Linha fictícia sem valor",
    0,
  ]);
  await page.goto(
    `/financeiro/lancamentos/importacoes?unidade=${f.unitId}&mes=2026-10`,
  );
  await page.getByLabel("Extrato XLSX do Sicoob").setInputFiles({
    name: "retentativa-ficticia.xlsx",
    mimeType:
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    buffer: Buffer.from(await workbook.xlsx.writeBuffer()),
  });
  await page
    .getByRole("button", { name: "Preparar importação", exact: true })
    .click();
  await expect(
    page.getByText("Conferir leitura", { exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Conferir linha 3", exact: true })
    .click();
  await page
    .getByRole("combobox", { name: /Identificação/ })
    .selectOption("COLLECTIVE");
  await page
    .getByRole("combobox", { name: "Categoria", exact: true })
    .selectOption(f.offeringId);
  let dropped = false;
  await page.route("**/financeiro/**", async (route) => {
    const request = route.request();
    if (
      !dropped &&
      request.method() === "POST" &&
      request.headers()["next-action"] &&
      request.postData()?.includes('"action":"POST"')
    ) {
      dropped = true;
      await route.fetch(); // The server commits, then the browser loses the response.
      await route.abort("failed");
    } else await route.continue();
  });
  await page.getByRole("button", { name: "Salvar", exact: true }).click();
  await expect(
    page.getByRole("button", {
      name: "Conferir a mesma tentativa",
      exact: true,
    }),
  ).toBeVisible();
  expect(dropped).toBe(true);
  await page
    .getByRole("button", { name: "Conferir a mesma tentativa", exact: true })
    .click();
  await expect(
    page.getByText("Lançamento salvo.", { exact: true }),
  ).toBeVisible();
  await expect(page.getByText("1 concluído", { exact: false })).toBeVisible();
  await page
    .getByRole("button", { name: "Conferir linha 4", exact: true })
    .click();
  await expect(
    page.getByRole("alert").filter({ hasText: "Valor inválido" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Salvar", exact: true }),
  ).toHaveCount(0);
});

test("links a manual expense, creates a transfer and recognizes an overlapping statement", async ({
  page,
}) => {
  test.skip(
    !process.env.E2E_FINANCE_FIXTURE,
    "Local financial fixture required",
  );
  test.setTimeout(60000);
  const f = JSON.parse(readFileSync(process.env.E2E_FINANCE_FIXTURE!, "utf8"));
  const reference = randomUUID(),
    cents = 3000 + Math.floor(Math.random() * 10000),
    value = (cents / 100).toFixed(2).replace(".", ",");
  page.on("dialog", (dialog) => dialog.accept());
  await page.goto(`/financeiro/lancamentos?unidade=${f.unitId}&mes=2026-10`);
  await page.getByRole("button", { name: "Nova saída", exact: true }).click();
  const manual = page.getByRole("dialog");
  await manual.getByLabel("Data", { exact: true }).fill("2026-10-22");
  await manual
    .getByRole("combobox", { name: "Caixa ou conta", exact: true })
    .selectOption(f.boxes[f.unitId].bank);
  await manual
    .getByRole("combobox", { name: "Categoria", exact: true })
    .selectOption(f.expenseId);
  await manual.getByLabel("Valor (R$)", { exact: true }).fill(value);
  await manual.getByRole("button", { name: "Salvar", exact: true }).click();
  await expect(manual).toHaveCount(0);
  const workbook = new ExcelJS.Workbook(),
    sheet = workbook.addWorksheet("LANÇAMENTOS");
  sheet.addRow(["EXTRATO CONTA CORRENTE"]);
  sheet.addRow([
    "DATA",
    "DOCUMENTO",
    "HISTÓRICO",
    "INFORMAÇÕES COMPLEMENTARES",
    "VALOR",
  ]);
  sheet.addRow([
    "22/10/2026",
    "PIX",
    "PIX ENVIADO",
    `Despesa fictícia ${reference}`,
    -cents / 100,
  ]);
  sheet.addRow([
    "22/10/2026",
    "TRF",
    "TRANSFERÊNCIA",
    `Transferência fictícia ${reference}`,
    52.37,
  ]);
  async function upload() {
    await page.goto(
      `/financeiro/lancamentos/importacoes?unidade=${f.unitId}&mes=2026-10`,
    );
    await page.getByLabel("Extrato XLSX do Sicoob").setInputFiles({
      name: `vinculos-${reference}.xlsx`,
      mimeType:
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      buffer: Buffer.from(await workbook.xlsx.writeBuffer()),
    });
    await page
      .getByRole("button", { name: "Preparar importação", exact: true })
      .click();
    await expect(
      page.getByText("2 movimentos", { exact: false }),
    ).toBeVisible();
  }
  await upload();
  await page
    .getByRole("button", { name: "Conferir linha 3", exact: true })
    .click();
  await page.getByText("Mais opções", { exact: true }).click();
  await page
    .getByRole("button", { name: "Vincular este registro", exact: true })
    .filter({ hasNot: page.locator("[disabled]") })
    .first()
    .click();
  await page
    .getByRole("combobox", { name: "Situação", exact: true })
    .selectOption("COMPLETED");
  await page.getByRole("button", { name: "Filtrar", exact: true }).click();
  await page
    .getByRole("button", { name: "Conferir linha 3", exact: true })
    .click();
  await page.getByText("Mais opções", { exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Desfazer vínculo", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Voltar à fila", exact: true })
    .click();
  await page
    .getByRole("combobox", { name: "Situação", exact: true })
    .selectOption("PENDING");
  await page.getByRole("button", { name: "Filtrar", exact: true }).click();
  await page
    .getByRole("button", { name: "Conferir linha 4", exact: true })
    .click();
  await page.getByText("Mais opções", { exact: true }).click();
  await page
    .getByRole("button", { name: "Transferência interna", exact: true })
    .click();
  await page
    .getByRole("combobox", { name: "Outra conta ou caixa", exact: true })
    .selectOption(f.boxes[f.unitId].cash);
  await page
    .getByLabel("Descrição da transferência")
    .fill(`Transferência de teste ${reference}`);
  await page
    .getByRole("button", { name: "Confirmar transferência", exact: true })
    .click();
  await expect(
    page.getByText("Lançamento salvo.", { exact: true }),
  ).toBeVisible();
  await expect(page.getByText("2 concluído", { exact: false })).toBeVisible();
  // Change workbook metadata, retaining the exact source rows, to simulate a second export.
  workbook.created = new Date("2026-10-22T11:00:00Z");
  await upload();
  await page
    .getByRole("button", { name: "Conferir linha 4", exact: true })
    .click();
  await page
    .getByText("Possível duplicidade — revisar antes de finalizar", {
      exact: true,
    })
    .click();
  await page.getByText("Mais opções", { exact: true }).click();
  await expect(
    page.getByLabel("Motivo para tratar como movimento distinto"),
  ).toBeVisible();
  await page
    .locator(".bank-import-choice")
    .filter({ hasText: reference })
    .getByRole("button", { name: "É o mesmo movimento", exact: true })
    .click();
  await page
    .getByRole("combobox", { name: "Situação", exact: true })
    .selectOption("COMPLETED");
  await page.getByRole("button", { name: "Filtrar", exact: true }).click();
  await page
    .getByRole("button", { name: "Conferir linha 4", exact: true })
    .click();
  await page.getByText("Mais opções", { exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Desfazer vínculo", exact: true }),
  ).toBeVisible();
  await expect(
    page
      .getByText("Mesmo movimento", { exact: false })
      .filter({ visible: true })
      .first(),
  ).toBeVisible();
});

test("removes and recovers review rows, updates totals and removes an unused batch", async ({
  page,
}) => {
  test.skip(!process.env.E2E_FINANCE_FIXTURE, "Local fixture required");
  const f = JSON.parse(readFileSync(process.env.E2E_FINANCE_FIXTURE!, "utf8"));
  const name = `remocao-${randomUUID()}.xlsx`;
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
  sheet.addRow(["22/10/2026", "PIX", "PIX ENVIADO", name, -25]);
  const list = `/financeiro/lancamentos/importacoes?unidade=${f.unitId}&mes=2026-10`;
  await page.goto(list);
  await expect(page.getByText("Selecionar ou arrastar extrato")).toBeVisible();
  await page.getByLabel("Extrato XLSX do Sicoob").setInputFiles({
    name,
    mimeType:
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    buffer: Buffer.from(await book.xlsx.writeBuffer()),
  });
  await expect(page.getByText(name, { exact: true })).toBeVisible();
  await page
    .getByRole("button", { name: "Preparar importação", exact: true })
    .click();
  await expect(page.getByText("2 movimentos", { exact: false })).toBeVisible();
  await expect(page.locator(".bank-import-metric")).toHaveCount(3);
  await page
    .getByRole("button", { name: "Excluir linha 3", exact: true })
    .click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Excluir item", exact: true })
    .click();
  await expect(page.getByText("1 movimento", { exact: false })).toBeVisible();
  await expect(
    page
      .locator(".bank-import-metric")
      .filter({ hasText: "Entradas consideradas" }),
  ).toContainText("0,00");
  await page
    .getByRole("combobox", { name: "Situação", exact: true })
    .selectOption("DELETED");
  await page.getByRole("button", { name: "Filtrar", exact: true }).click();
  await page
    .getByRole("button", { name: "Restaurar linha 3", exact: true })
    .click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Restaurar item", exact: true })
    .click();
  await expect(page.getByText("2 movimentos", { exact: false })).toBeVisible();
  await page
    .getByRole("combobox", { name: "Situação", exact: true })
    .selectOption("PENDING");
  await page.getByRole("button", { name: "Filtrar", exact: true }).click();
  await page
    .getByRole("button", { name: "Conferir linha 4", exact: true })
    .click();
  await expect(page.locator("form.finance-attendance-form")).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Conferir antes de confirmar" }),
  ).toBeVisible();
  await expect(page.getByLabel("Valor (R$)", { exact: true })).toHaveAttribute(
    "readonly",
    "",
  );
  await expect(
    page.getByRole("button", { name: "Adicionar contribuição", exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Transferência interna", exact: true }),
  ).not.toBeVisible();
  await page.getByText("Mais opções", { exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Transferência interna", exact: true }),
  ).toBeVisible();
  await page.getByText("Mais opções", { exact: true }).click();
  await page.screenshot({
    path: "tmp/import-refinement-expense.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 1024, height: 900 });
  await expect(page.locator("form.finance-attendance-form")).toBeVisible();
  await expect(page.locator("body")).toHaveJSProperty("scrollWidth", 1024);
  await page.screenshot({
    path: "tmp/import-refinement-medium.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto(list);
  const row = page.getByRole("row").filter({ hasText: name });
  await row
    .getByRole("button", { name: "Ações da importação", exact: true })
    .click();
  await page
    .getByRole("menuitem", { name: "Excluir importação", exact: true })
    .click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Excluir importação", exact: true })
    .click();
  await expect(page.getByRole("row").filter({ hasText: name })).toHaveCount(0);
  await page.screenshot({
    path: "tmp/import-refinement-list.png",
    fullPage: true,
  });
});
