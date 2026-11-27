import { expect, test, type Page } from "@playwright/test";
import ExcelJS from "exceljs";
import { randomUUID } from "node:crypto";

async function expectSingleLineMetrics(page: Page, count: number) {
  const labels = page.locator("article:has(> span > svg) > div > small");
  await expect(labels).toHaveCount(count);
  const overflowing = await labels.evaluateAll(nodes => nodes.filter(label => {
    const range = document.createRange();
    range.selectNodeContents(label);
    const lines = range.getClientRects();
    const card = label.closest("article")!.getBoundingClientRect();
    return lines.length !== 1 || lines[0].right > card.right;
  }).map(label => label.textContent));
  expect(overflowing).toEqual([]);
}

test("importa a planilha oficial e permite conferir o resultado no relatório", async ({ page, request }) => {
  const destination = process.env.E2E_IMPORT_CONGREGATION;
  test.skip(!destination || !process.env.E2E_STORAGE_STATE || !/^http:\/\/(localhost|127\.0\.0\.1):/.test(process.env.E2E_BASE_URL ?? ""),
    "Requer congregação fictícia, aplicação local e sessão com permissão de importação.");
  const template = await request.get("/api/members/imports/template");
  expect(template.status()).toBe(200);
  const book = new ExcelJS.Workbook();
  await book.xlsx.load(Uint8Array.from(await template.body()).buffer);
  const sheet = book.worksheets[0];
  const name = "Pessoa de teste " + randomUUID();
  sheet.getRow(2).values = [name, "Diaconisa", "Feminino", "10/05/1985", "Rua de Teste, 10", "Centro", "Goiânia", "GO",
    "Portugal", "01234-000", "", "Casado(a)", "Docente", "Goiânia GO", "Portuguesa",
    "10/03/2015", "10/03/2000", "10/03/2001", "Pai de Teste", "Mãe de Teste"];
  const otherNames = Array.from({ length: 9 }, () => "Membro de teste " + randomUUID());
  otherNames.forEach((otherName, index) => {
    sheet.getRow(index + 3).values = [otherName, "", index === 0 ? "" : "Masculino"];
    if (index < 2) {
      sheet.getCell(`B${index + 3}`).value = "Cargo da origem";
      sheet.getCell(`L${index + 3}`).value = "Estado da origem";
    }
  });
  await page.goto("/membros/importar");
  await expect(page.getByRole("button", { name: "Modelo", exact: true })).toBeVisible();
  await page.getByRole("combobox").first().selectOption(destination!);
  const memberStatus = page.getByRole("combobox", { name: "Situação dos membros" });
  await expect(memberStatus).toHaveValue("ACTIVE");
  await memberStatus.selectOption("INACTIVE");
  await page.getByRole("button", { name: /Arraste a planilha/ }).setInputFiles({
    name: "congregacao.xlsx", mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    buffer: Buffer.from(await book.xlsx.writeBuffer()),
  });
  await page.getByRole("button", { name: "Analisar planilha" }).click();
  await expect(page.getByText(/20 campos reconhecidos/)).toBeVisible();
  await expectSingleLineMetrics(page, 5);
  await expect(page.getByText(/Equivalência de (Cargos|estado civil)/)).toHaveCount(0);
  await page.getByRole("button", { name: "Revisar membros" }).click();
  await expect(page.getByRole("columnheader")).toHaveText(["Linha", "Membro", "Cargos", "Pendências", "Ação"]);
  const steps = page.getByRole("list", { name: "Etapas da importação de membros" });
  const [firstStep, secondStep] = await steps.getByRole("listitem").evaluateAll(items =>
    items.slice(0, 2).map(item => item.getBoundingClientRect().toJSON())
  );
  expect(secondStep.top).toBeGreaterThanOrEqual(firstStep.bottom);
  const progress = await page.getByRole("complementary", { name: "Etapa 3 de 4" }).boundingBox();
  const table = await page.getByRole("table").boundingBox();
  expect(table!.x).toBeGreaterThanOrEqual(progress!.x + progress!.width);
  const member = page.getByRole("row").filter({ hasText: name });
  await member.getByText("Detalhes da ficha", { exact: true }).click();
  await expect(member.getByText("Nascimento: 10/05/1985")).toBeVisible();
  await expect(member.getByText(/Portuguesa/)).toBeVisible();
  const situation = page.getByRole("combobox", { name: "Filtrar por situação" });
  await situation.selectOption("ERROR");
  await expect(page.getByRole("button", { name: "Resolver cargo", exact: true })).toHaveCount(2);
  await page.getByRole("button", { name: "Resolver cargo", exact: true }).first().click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toContainText("2 linhas");
  await dialog.getByRole("combobox").click();
  await dialog.getByRole("listbox").getByRole("option", { name: "Diácono", exact: true }).click();
  await dialog.getByRole("button", { name: "Aplicar" }).click();
  await expect(dialog).toHaveCount(0);
  await expect(situation).toHaveValue("ERROR");
  await situation.selectOption("");
  const desktop = page.viewportSize()!;
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.getByRole("button", { name: "Resolver estado civil", exact: true })).toHaveCount(2);
  await page.getByRole("button", { name: "Resolver estado civil", exact: true }).first().click();
  await dialog.getByRole("combobox").selectOption("MARRIED");
  await dialog.getByRole("button", { name: "Aplicar" }).click();
  await expect(dialog).toHaveCount(0);
  await expect(page.getByRole("button", { name: /^Resolver/ })).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.setViewportSize(desktop);
  for (const otherName of otherNames.slice(0, 2)) {
    const resolvedRow = page.getByRole("row").filter({ hasText: otherName });
    await expect(resolvedRow.getByRole("cell").nth(2)).toContainText("Diácono");
    await expect(resolvedRow.getByRole("cell").nth(1)).toContainText("Casado");
  }
  await member.getByRole("button", { name: "Pular esta linha" }).click();
  await member.getByRole("button", { name: "Restaurar linha" }).click();
  await expect(page.getByRole("row").filter({ hasText: name })).toContainText("Feminino");
  await expect(page.getByRole("checkbox")).toHaveCount(0);
  await expect(page.getByRole("row").filter({ hasText: name }).getByRole("combobox")).toHaveCount(0);
  const missingGender = page.getByRole("combobox", { name: `Sexo de ${otherNames[0]}` });
  await missingGender.selectOption("FEMALE");
  await expect(missingGender).toHaveValue("FEMALE");
  await page.getByRole("button", { name: "Revisar confirmação" }).click();
  await expect(page.getByText("Inativos", { exact: true })).toBeVisible();
  await expectSingleLineMetrics(page, 5);
  await page.setViewportSize({ width: 390, height: 844 });
  await expectSingleLineMetrics(page, 5);
  await page.setViewportSize(desktop);
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "Confirmar importação" }).click();
  await expect(page.getByRole("link", { name: "Ver membros" })).toBeVisible();
  await expectSingleLineMetrics(page, 5);
  const batch = new URL(page.url()).searchParams.get("batch");
  const report = await request.get(`/api/members/imports/${batch}/report`);
  expect(report.status()).toBe(200);
  const result = new ExcelJS.Workbook();
  await result.xlsx.load(Uint8Array.from(await report.body()).buffer);
  const imported = result.getWorksheet("Importados")!;
  expect(imported.actualRowCount).toBe(11);
  expect(imported.getCell("A2").value).toBe(name);
  expect(imported.getCell("B2").value).toBe("Diaconisa");
  expect(imported.getRow(1).values).not.toContain("Telefone");
  expect(imported.getCell("K1").value).toBe("CPF");
  expect(imported.getCell("P2").value).toEqual(new Date("2015-03-10T00:00:00Z"));
  expect(imported.getCell("C2").value).toBe("Feminino");
  expect(imported.getCell("C3").value).toBe("Feminino");
  expect(imported.getCell("C4").value).toBe("Masculino");
  const summary = result.getWorksheet("Resumo")!;
  expect(summary.getRows(1, summary.rowCount)?.some(row =>
    row.getCell(1).value === "Situação dos membros" && row.getCell(2).value === "Inativos"
  )).toBe(true);
  await page.getByRole("link", { name: "Ver membros" }).click();
  await expect(page.getByRole("row").filter({ hasText: name })).toContainText("Inativo");
  await page.goto("/membros/importar");
  await page.getByRole("tab", { name: "Histórico" }).click();
  await expectSingleLineMetrics(page, 4);
});
