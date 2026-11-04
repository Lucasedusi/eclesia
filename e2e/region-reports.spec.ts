import { readFile } from "node:fs/promises";
import path from "node:path";
import { expect, test } from "@playwright/test";
import { PDFDocument } from "pdf-lib";
import ExcelJS from "exceljs";

const regionName = process.env.E2E_REPORT_REGION_NAME;
test.describe("relatórios de regionais", () => {
  test.skip(!process.env.E2E_STORAGE_STATE || !regionName, "Requer sessão autorizada e E2E_REPORT_REGION_NAME de uma regional de teste");
  test.beforeEach(async ({ page }) => { await page.goto("/estrutura-eclesiastica/regionais"); });

  test("exporta lista PDF e Excel com filtros, sem limitar à página atual", async ({ page }, testInfo) => {
    await page.getByRole("button", { name: "Relatórios de regionais", exact: true }).click();
    const modal = page.getByRole("dialog", { name: "Relatórios de regionais", exact: true });
    await expect(modal).toBeVisible();
    await expect(modal).toHaveCSS("opacity", "1");
    const before = await modal.boundingBox();
    await modal.getByRole("radio", { name: /Ficha da regional/ }).check();
    const after = await modal.boundingBox();
    expect(after?.height).toBe(before?.height);
    expect(after?.y).toBe(before?.y);
    await expect(modal.getByRole("button", { name: "Fechar", exact: true })).toHaveCount(0);
    await expect(modal.getByText(/O contato das congregações prioriza/)).toHaveCount(0);
    await modal.getByRole("radio", { name: /Lista simplificada/ }).check();
    await expect(modal.getByRole("combobox").first()).toHaveCSS("border-top-color", "rgb(65, 91, 165)");
    await expect(modal.getByRole("combobox").first()).toHaveCSS("box-shadow", "none");
    await modal.screenshot({ path: testInfo.outputPath("modal-relatorios.png"), animations: "disabled" });
    let download = page.waitForEvent("download");
    await modal.getByRole("button", { name: "Baixar PDF", exact: true }).click();
    const pdf = await PDFDocument.load(await readFile((await (await download).path())!));
    expect(pdf.getPage(0).getSize()).toEqual({ width: 595.28, height: 841.89 });
    await modal.getByRole("combobox", { name: "Formato", exact: true }).selectOption("xlsx");
    download = page.waitForEvent("download");
    await modal.getByRole("button", { name: "Baixar Excel", exact: true }).click();
    const workbook = new ExcelJS.Workbook(); await workbook.xlsx.readFile((await (await download).path())!);
    expect(workbook.getWorksheet("Regionais")!.getColumn(1).values).toContain(regionName);
    if (process.env.E2E_REPORT_FIXTURE) {
      expect(workbook.getWorksheet("Regionais")!.rowCount).toBe(31);
      expect(workbook.getWorksheet("Regionais")!.getColumn(1).values).toContain("Regional de Teste 24");
    }
    await modal.getByRole("button", { name: "Fechar modal", exact: true }).click();

    await page.getByRole("textbox", { name: "Buscar em Regionais" }).fill(regionName!);
    await page.getByRole("button", { name: "Relatórios de regionais", exact: true }).click();
    await modal.getByRole("combobox", { name: "Abrangência", exact: true }).selectOption("FILTERED");
    await modal.getByRole("combobox", { name: "Formato", exact: true }).selectOption("xlsx");
    const request = page.waitForRequest((r) => r.url().endsWith("/regions/reports"));
    download = page.waitForEvent("download");
    await modal.getByRole("button", { name: "Baixar Excel", exact: true }).click();
    expect((await request).postDataJSON().search).toBe(regionName);
    const filtered = new ExcelJS.Workbook(); await filtered.xlsx.readFile((await (await download).path())!);
    expect(filtered.getWorksheet("Regionais")!.rowCount).toBe(7);
  });

  test("gera ficha pelo modal geral e pelos detalhes e preserva retorno", async ({ page }, testInfo) => {
    await page.getByRole("button", { name: "Relatórios de regionais", exact: true }).click();
    await page.getByRole("radio", { name: /Ficha da regional/ }).check();
    await page.getByRole("combobox", { name: "Regional", exact: true }).selectOption({ label: regionName! });
    let download = page.waitForEvent("download");
    await page.getByRole("button", { name: "Baixar PDF", exact: true }).click();
    expect((await download).suggestedFilename()).toMatch(/^ficha-regional-.*\.pdf$/);
    await page.getByRole("button", { name: "Fechar modal", exact: true }).click();
    await page.getByRole("textbox", { name: "Buscar em Regionais" }).fill(regionName!);
    await page.getByRole("button", { name: `Ver detalhes de ${regionName}`, exact: true }).first().click();
    await page.getByRole("button", { name: "Imprimir / PDF", exact: true }).click();
    await expect(page.getByRole("dialog")).toHaveCount(1);
    const modal = page.getByRole("dialog", { name: "Ficha da regional em PDF", exact: true });
    await expect(modal).toBeVisible();
    await modal.screenshot({ path: testInfo.outputPath("modal-ficha.png"), animations: "disabled" });
    download = page.waitForEvent("download");
    await modal.getByRole("button", { name: "Baixar PDF", exact: true }).click();
    const pdf = await PDFDocument.load(await readFile((await (await download).path())!));
    expect(pdf.getPageCount()).toBeGreaterThanOrEqual(1);
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog", { name: "Detalhes da Regional", exact: true })).toBeVisible();
  });

  test("recupera de erro em tela estreita", async ({ page }, testInfo) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.getByRole("button", { name: "Relatórios de regionais", exact: true }).click();
    await expect(page.getByRole("radio", { name: /Lista simplificada/ })).toBeVisible();
    await expect(page.getByRole("dialog")).toHaveCSS("opacity", "1");
    await expect(page.getByRole("dialog").locator("..")).toHaveCSS("opacity", "1");
    await page.screenshot({ path: testInfo.outputPath("modal-mobile.png"), animations: "disabled" });
    await page.route("**/api/organization/regions/reports", (route) => route.fulfill({ status: 500, contentType: "application/json", body: JSON.stringify({ message: "Não foi possível gerar o relatório agora. Tente novamente." }) }));
    await page.getByRole("button", { name: "Baixar PDF", exact: true }).click();
    await expect(page.getByRole("dialog").getByRole("alert")).toHaveText("Não foi possível gerar o relatório agora. Tente novamente.");
    await expect(page.getByRole("button", { name: "Baixar PDF", exact: true })).toBeEnabled();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog")).toHaveCount(0);
  });

  test("secretaria exporta sem editar; acesso de consulta não exporta", async ({ page, browser }) => {
    test.skip(!process.env.E2E_REPORT_FIXTURE, "Requer as contas fictícias locais do harness");
    await expect(page.getByRole("button", { name: "Novo cadastro", exact: true })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Relatórios de regionais", exact: true })).toBeVisible();
    const denied = await browser.newContext({ storageState: path.join(path.dirname(process.env.E2E_REPORT_FIXTURE!), "viewer-session.json") });
    try {
      const viewer = await denied.newPage();
      await viewer.goto("/estrutura-eclesiastica/regionais");
      await expect(viewer.getByRole("heading", { name: "Regionais", exact: true })).toBeVisible();
      await expect(viewer.getByRole("button", { name: "Relatórios de regionais", exact: true })).toHaveCount(0);
      const response = await denied.request.post("/api/organization/regions/reports", { data: { kind: "simplified", format: "pdf" } });
      expect(response.status()).toBe(403);
    } finally { await denied.close(); }
  });

  test("endpoint restringe regionais e bloqueia outra igreja", async ({ browser }) => {
    test.skip(!process.env.E2E_REPORT_FIXTURE, "Requer as contas fictícias locais do harness");
    const fixture = JSON.parse(await readFile(process.env.E2E_REPORT_FIXTURE!, "utf8"));
    for (const scope of ["regional", "congregation"]) {
      const scoped = await browser.newContext({ storageState: path.join(path.dirname(process.env.E2E_REPORT_FIXTURE!), `${scope}-session.json`) });
      try {
        const response = await scoped.request.post("/api/organization/regions/reports", { data: { kind: "simplified", format: "xlsx" } });
        expect(response.status()).toBe(200);
        const workbook = new ExcelJS.Workbook(); await workbook.xlsx.load(await response.body() as never);
        const sheet = workbook.getWorksheet("Regionais")!;
        expect(sheet.rowCount).toBe(7);
        expect(sheet.getCell("A7").value).toBe(regionName);
        expect(sheet.getCell("A5").text).toContain("registros autorizados");
        const forbidden = await scoped.request.post("/api/organization/regions/reports", { data: { kind: "individual", format: "pdf", regionId: fixture.otherRegion } });
        expect(forbidden.status()).toBe(404);
      } finally { await scoped.close(); }
    }
  });
});
