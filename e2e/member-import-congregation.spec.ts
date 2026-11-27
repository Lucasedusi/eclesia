import { expect, test } from "@playwright/test";
import ExcelJS from "exceljs";
import { randomUUID } from "node:crypto";

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
  await page.goto("/membros/importar");
  await page.getByRole("combobox").first().selectOption(destination!);
  await page.getByRole("button", { name: /Arraste a planilha/ }).setInputFiles({
    name: "congregacao.xlsx", mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    buffer: Buffer.from(await book.xlsx.writeBuffer()),
  });
  await page.getByRole("button", { name: "Analisar planilha" }).click();
  await expect(page.getByText(/20 campos reconhecidos/)).toBeVisible();
  await page.getByRole("button", { name: "Revisar membros" }).click();
  await expect(page.getByRole("row").filter({ hasText: name })).toContainText("Portuguesa");
  await page.getByRole("button", { name: "Revisar confirmação" }).click();
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "Confirmar importação" }).click();
  await expect(page.getByRole("link", { name: "Ver membros" })).toBeVisible();
  const batch = new URL(page.url()).searchParams.get("batch");
  const report = await request.get(`/api/members/imports/${batch}/report`);
  expect(report.status()).toBe(200);
  const result = new ExcelJS.Workbook();
  await result.xlsx.load(Uint8Array.from(await report.body()).buffer);
  const imported = result.getWorksheet("Importados")!;
  expect(imported.getCell("A2").value).toBe(name);
  expect(imported.getCell("B2").value).toBe("Diaconisa");
  expect(imported.getRow(1).values).not.toContain("Telefone");
  expect(imported.getCell("K1").value).toBe("CPF");
  expect(imported.getCell("P2").value).toEqual(new Date("2015-03-10T00:00:00Z"));
});
