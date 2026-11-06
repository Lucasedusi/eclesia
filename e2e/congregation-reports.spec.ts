import { readFile } from "node:fs/promises";
import path from "node:path";
import { expect, test } from "@playwright/test";
import { PDFDocument } from "pdf-lib";
import ExcelJS from "exceljs";
const name = "Congregação Central de Teste";
const endpoint = "/api/organization/congregations/reports";
test.describe("relatórios de congregações", () => {
  test.skip(!process.env.E2E_REPORT_FIXTURE || !process.env.E2E_STORAGE_STATE, "Requer dados fictícios e sessões locais do harness");
  test.beforeEach(async ({ page }) => { await page.goto("/estrutura-eclesiastica/congregacoes"); });
  test("exporta PDF/Excel, campos opcionais e todas as páginas", async ({ page }, testInfo) => {
    await page.getByRole("button", { name: "Relatório", exact: true }).click();
    const modal = page.getByRole("dialog", { name: "Relatórios de congregações", exact: true });
    await expect(modal).toHaveCSS("opacity", "1");
    await expect(modal.getByRole("checkbox", { name: "Telefone", exact: true })).toBeChecked();
    await expect(modal.getByRole("checkbox", { name: "Cônjuge", exact: true })).not.toBeChecked();
    let download = page.waitForEvent("download");
    await modal.getByRole("button", { name: "Baixar PDF", exact: true }).click();
    expect((await PDFDocument.load(await readFile((await (await download).path())!))).getPage(0).getWidth()).toBe(595.28);
    const before = await modal.boundingBox();
    await modal.getByRole("checkbox", { name: "Cônjuge", exact: true }).check();
    await modal.getByRole("checkbox", { name: "Endereço", exact: true }).check();
    expect((await modal.boundingBox())?.height).toBe(before?.height);
    await modal.screenshot({ path: testInfo.outputPath("lista-modal.png"), animations: "disabled" });
    download = page.waitForEvent("download");
    await modal.getByRole("button", { name: "Baixar PDF", exact: true }).click();
    expect((await PDFDocument.load(await readFile((await (await download).path())!))).getPage(0).getWidth()).toBe(841.89);
    await modal.getByRole("combobox", { name: "Formato", exact: true }).selectOption("xlsx");
    download = page.waitForEvent("download");
    await modal.getByRole("button", { name: "Baixar Excel", exact: true }).click();
    const workbook = new ExcelJS.Workbook(); await workbook.xlsx.readFile((await (await download).path())!);
    const sheet = workbook.worksheets[0];
    expect(sheet.rowCount).toBe(33);
    expect(sheet.getColumn(2).values).toContain("Congregação de Teste 24");
    expect(sheet.getColumn(5).values).toContain("Cônjuge de Teste");
    expect(sheet.getColumn(6).values).toContain("(11) 99999-8888");
    expect(sheet.getColumn(6).values).not.toContain("(11) 3333-4444");
  });
  test("exporta resultados filtrados e ficha diretamente dos detalhes", async ({ page }, testInfo) => {
    await page.getByRole("textbox", { name: "Buscar em Congregações" }).fill(name);
    await page.getByRole("button", { name: "Relatório", exact: true }).click();
    const modal = page.getByRole("dialog");
    await modal.getByRole("combobox", { name: "Abrangência", exact: true }).selectOption("FILTERED");
    await modal.getByRole("combobox", { name: "Formato", exact: true }).selectOption("xlsx");
    await modal.getByRole("checkbox", { name: "Telefone", exact: true }).uncheck();
    let download = page.waitForEvent("download");
    await modal.getByRole("button", { name: "Baixar Excel", exact: true }).click();
    const wb = new ExcelJS.Workbook(); await wb.xlsx.readFile((await (await download).path())!);
    expect(wb.worksheets[0].rowCount).toBe(7);
    expect(wb.worksheets[0].columnCount).toBe(4);
    await page.keyboard.press("Escape");
    await page.getByRole("button", { name: `Ver detalhes de ${name}`, exact: true }).first().click();
    await expect(page.getByRole("button", { name: "Imprimir / PDF", exact: true })).toBeEnabled();
    download = page.waitForEvent("download");
    await page.getByRole("button", { name: "Imprimir / PDF", exact: true }).click();
    const file = await download;
    expect(file.suggestedFilename()).toMatch(/^ficha-congregacao-/);
    const pdf = await PDFDocument.load(await readFile((await file.path())!));
    expect(pdf.getPageCount()).toBe(1);
    await expect(page.getByRole("dialog", { name: "Detalhes da Congregação", exact: true })).toBeVisible();
    await file.saveAs(testInfo.outputPath("ficha-congregacao.pdf"));
  });
  test("recupera de erro em tela móvel", async ({ page }, testInfo) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.getByRole("button", { name: "Relatório", exact: true }).click();
    const modal = page.getByRole("dialog");
    await expect(modal).toHaveCSS("opacity", "1"); await expect(modal.locator("..")).toHaveCSS("opacity", "1");
    await page.screenshot({ path: testInfo.outputPath("mobile.png"), animations: "disabled" });
    await page.route(`**${endpoint}`, (route) => route.fulfill({ status: 500, contentType: "application/json", body: JSON.stringify({ message: "Não foi possível gerar o relatório agora. Tente novamente." }) }));
    await modal.getByRole("button", { name: "Baixar PDF", exact: true }).click();
    await expect(modal.getByRole("alert")).toContainText("Tente novamente");
    await expect(modal.getByRole("button", { name: "Baixar PDF", exact: true })).toBeEnabled();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.keyboard.press("Escape"); await expect(modal).toHaveCount(0);
    await page.screenshot({ path: testInfo.outputPath("botao-relatorio-mobile.png"), animations: "disabled" });
  });
  test("respeita permissões e escopos e bloqueia dados de outra igreja", async ({ page, browser }) => {
    await expect(page.getByRole("button", { name: "Novo cadastro", exact: true })).toHaveCount(0);
    const fixture = JSON.parse(await readFile(process.env.E2E_REPORT_FIXTURE!, "utf8"));
    for (const scope of ["regional", "congregation", "viewer"]) {
      const ctx = await browser.newContext({ storageState: path.join(path.dirname(process.env.E2E_REPORT_FIXTURE!), `${scope}-session.json`) });
      try {
        const response = await ctx.request.post(endpoint, { data: { kind: "simplified", format: "xlsx" } });
        if (scope === "viewer") {
          expect(response.status()).toBe(403);
          const viewer = await ctx.newPage(); await viewer.goto("/estrutura-eclesiastica/congregacoes");
          await expect(viewer.getByRole("heading", { name: "Congregações", exact: true })).toBeVisible();
          await expect(viewer.getByRole("button", { name: "Relatório", exact: true })).toHaveCount(0);
        } else {
          expect(response.status()).toBe(200);
          const wb = new ExcelJS.Workbook(); await wb.xlsx.load(await response.body() as never);
          expect(wb.worksheets[0].rowCount).toBe(scope === "regional" ? 32 : 7);
          const forbidden = await ctx.request.post(endpoint, { data: { kind: "individual", format: "pdf", congregationId: fixture.otherCongregation } }); expect(forbidden.status()).toBe(404);
          if (scope === "congregation") expect((await ctx.request.post(endpoint, { data: { kind: "individual", format: "pdf", congregationId: fixture.secondCongregation } })).status()).toBe(404);
        }
      } finally { await ctx.close(); }
    }
  });
});
