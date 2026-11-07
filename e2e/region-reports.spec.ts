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
    await page.getByRole("button", { name: "Relatório", exact: true }).click();
    const modal = page.getByRole("dialog", { name: "Relatórios de regionais", exact: true });
    await expect(modal).toBeVisible();
    await expect(modal.getByRole("combobox", { name: /Situação/ })).toHaveCount(0);
    await expect(modal).toHaveCSS("opacity", "1");
    const before = await modal.boundingBox();
    await modal.getByRole("radio", { name: /Ficha da regional/ }).check();
    const after = await modal.boundingBox();
    expect(after?.height).toBe(before?.height);
    expect(after?.y).toBe(before?.y);
    await expect(modal.getByRole("button", { name: "Fechar", exact: true })).toHaveCount(0);
    await expect(modal.getByText(/O contato das congregações prioriza/)).toHaveCount(0);
    await modal.getByRole("radio", { name: /Lista simplificada/ }).check();
    const firstSelect = modal.getByRole("combobox").first();
    await expect(firstSelect).toHaveCSS("border-top-color", "rgb(217, 222, 234)");
    await firstSelect.focus();
    await expect(firstSelect).toHaveCSS("border-top-color", "rgb(65, 91, 165)");
    await expect(firstSelect).toHaveCSS("border-top-width", "1px");
    await expect(firstSelect).toHaveCSS("box-shadow", "none");
    await expect(firstSelect).toHaveCSS("outline-style", "none");
    await modal.getByRole("radio", { name: /Lista simplificada/ }).focus();
    await expect(firstSelect).toHaveCSS("border-top-color", "rgb(217, 222, 234)");
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
    await page.getByRole("button", { name: "Relatório", exact: true }).click();
    await modal.getByRole("combobox", { name: "Filtros", exact: true }).selectOption("FILTERED");
    await modal.getByRole("combobox", { name: "Formato", exact: true }).selectOption("xlsx");
    const request = page.waitForRequest((r) => r.url().endsWith("/regions/reports"));
    download = page.waitForEvent("download");
    await modal.getByRole("button", { name: "Baixar Excel", exact: true }).click();
    expect((await request).postDataJSON().search).toBe(regionName);
    const filtered = new ExcelJS.Workbook(); await filtered.xlsx.readFile((await (await download).path())!);
    expect(filtered.getWorksheet("Regionais")!.rowCount).toBe(7);
  });

  test("gera ficha pelo modal geral e diretamente nos detalhes", async ({ page }, testInfo) => {
    await page.getByRole("button", { name: "Relatório", exact: true }).click();
    await page.getByRole("radio", { name: /Ficha da regional/ }).check();
    await page.getByRole("combobox", { name: "Regional", exact: true }).selectOption({ label: regionName! });
    let download = page.waitForEvent("download");
    await page.getByRole("button", { name: "Baixar PDF", exact: true }).click();
    expect((await download).suggestedFilename()).toMatch(/^ficha-regional-.*\.pdf$/);
    await page.getByRole("button", { name: "Fechar modal", exact: true }).click();
    await page.getByRole("textbox", { name: "Buscar em Regionais" }).fill(regionName!);
    await page.getByRole("button", { name: `Ver detalhes de ${regionName}`, exact: true }).first().click();
    const modal = page.getByRole("dialog", { name: "Detalhes da Regional", exact: true });
    await expect(modal.getByText("Última atualização", { exact: true })).toHaveCount(0);
    download = page.waitForEvent("download");
    const request = page.waitForRequest((r) => r.url().endsWith("/regions/reports"));
    await modal.getByRole("button", { name: "Imprimir / PDF", exact: true }).click();
    expect((await request).postDataJSON().congregationStatus).toBe("ALL");
    const pdf = await PDFDocument.load(await readFile((await (await download).path())!));
    expect(pdf.getPageCount()).toBeGreaterThanOrEqual(1);
    await expect(modal).toBeVisible();
    await expect(page.getByRole("dialog")).toHaveCount(1);
    await modal.screenshot({ path: testInfo.outputPath("detalhes-regional.png"), animations: "disabled" });

  });

  test("herda situação e ordenação da tela e permite voltar a todas as regionais", async ({ page }) => {
    await page.getByRole("combobox", { name: "Filtrar por status", exact: true }).selectOption("INACTIVE");
    await page.getByRole("combobox", { name: "Ordenar resultados", exact: true }).selectOption("NAME");
    await page.getByRole("button", { name: "Relatório", exact: true }).click();
    const modal = page.getByRole("dialog", { name: "Relatórios de regionais", exact: true });
    await modal.getByRole("combobox", { name: "Filtros", exact: true }).selectOption("FILTERED");
    await modal.getByRole("combobox", { name: "Formato", exact: true }).selectOption("xlsx");
    for (const filtered of [true, false]) {
      if (!filtered) await modal.getByRole("combobox", { name: "Filtros", exact: true }).selectOption("ALL");
      const request = page.waitForRequest((r) => r.url().endsWith("/regions/reports"));
      const download = page.waitForEvent("download");
      await modal.getByRole("button", { name: "Baixar Excel", exact: true }).click();
      expect((await request).postDataJSON()).toMatchObject({ status: filtered ? "INACTIVE" : "ALL", sort: filtered ? "NAME" : "ORDER" });
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.readFile((await (await download).path())!);
      if (process.env.E2E_REPORT_FIXTURE) {
        expect(workbook.getWorksheet("Regionais")!.rowCount).toBe(filtered ? 7 : 31);
        expect(workbook.getWorksheet("Regionais")!.getCell("A7").text).toBe(filtered ? "Regional de Teste 24" : regionName);
      }
    }
  });

  test("mantém os detalhes abertos quando a impressão falha e permite tentar novamente", async ({ page }) => {
    await page.getByRole("textbox", { name: "Buscar em Regionais" }).fill(regionName!);
    await page.getByRole("button", { name: `Ver detalhes de ${regionName}`, exact: true }).first().click();
    const modal = page.getByRole("dialog", { name: "Detalhes da Regional", exact: true });
    await page.route("**/api/organization/regions/reports", (route) => route.fulfill({ status: 500, contentType: "application/json", body: JSON.stringify({ message: "Falha temporária ao gerar relatório." }) }));
    await modal.getByRole("button", { name: "Imprimir / PDF", exact: true }).click();
    await expect(modal.getByRole("alert")).toHaveText("Falha temporária ao gerar relatório.");
    await expect(modal.getByRole("button", { name: "Imprimir / PDF", exact: true })).toBeEnabled();
    await page.unroute("**/api/organization/regions/reports");
    const download = page.waitForEvent("download");
    await modal.getByRole("button", { name: "Imprimir / PDF", exact: true }).click();
    expect((await download).suggestedFilename()).toMatch(/^ficha-regional-.*\.pdf$/);
    await expect(modal.getByRole("alert")).toHaveCount(0);
    await expect(modal).toBeVisible();
  });

  test("organiza criação e edição em duas colunas e adapta detalhes ao celular", async ({ browser }, testInfo) => {
    test.skip(!process.env.E2E_REPORT_FIXTURE, "Requer administrador fictício local");
    const context = await browser.newContext({ storageState: path.join(path.dirname(process.env.E2E_REPORT_FIXTURE!), "admin-session.json") });
    try {
      const page = await context.newPage();
      await page.goto("/estrutura-eclesiastica/regionais");
      const report = page.getByRole("button", { name: "Relatório", exact: true });
      await expect(report).toHaveCSS("border-top-color", "rgb(217, 222, 234)");
      await expect(report).toHaveCSS("color", "rgb(71, 84, 103)");
      await page.getByRole("button", { name: "Novo cadastro", exact: true }).first().click();
      for (const title of ["Nova Regional", "Editar Regional"]) {
        const modal = page.getByRole("dialog", { name: title, exact: true });
        await expect(modal).toHaveCSS("opacity", "1");
        const name = (await modal.getByRole("textbox", { name: "Nome da Regional" }).boundingBox())!;
        const status = (await modal.getByRole("combobox", { name: "Status" }).boundingBox())!;
        const coordinator = (await modal.getByRole("textbox", { name: "Nome do Coordenador" }).boundingBox())!;
        const phone = (await modal.getByRole("textbox", { name: "Telefone do Coordenador" }).boundingBox())!;
        const description = (await modal.getByRole("textbox", { name: "Descrição" }).boundingBox())!;
        expect(name.y).toBe(status.y);
        expect(coordinator.y).toBe(phone.y);
        expect(description.width).toBeGreaterThan(name.width * 1.9);
        await modal.screenshot({ path: testInfo.outputPath(`${title}-desktop.png`), animations: "disabled" });
        await page.keyboard.press("Escape");
        if (title === "Nova Regional") {
          await page.getByRole("textbox", { name: "Buscar em Regionais" }).fill(regionName!);
          await page.getByRole("button", { name: `Ver detalhes de ${regionName}`, exact: true }).first().click();
          const details = page.getByRole("dialog", { name: "Detalhes da Regional", exact: true });
          await expect(details.getByText("Cadastrada em", { exact: true })).toBeVisible();
          const labels = await Promise.all(["Nome", "Coordenador", "Telefone do coordenador", "Cadastrada em"].map((label) => details.getByText(label, { exact: true }).boundingBox()));
          expect(new Set(labels.map((box) => box!.y)).size).toBe(1);
          await page.setViewportSize({ width: 390, height: 844 });
          await expect(details).toHaveCSS("opacity", "1");
          expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
          await details.screenshot({ path: testInfo.outputPath("detalhes-mobile.png"), animations: "disabled" });
          await page.setViewportSize({ width: 1280, height: 720 });
          await details.getByRole("button", { name: "Editar Regional", exact: true }).click();
        }
      }
      await page.setViewportSize({ width: 390, height: 844 });
      await page.getByRole("button", { name: "Novo cadastro", exact: true }).first().click();
      const modal = page.getByRole("dialog", { name: "Nova Regional", exact: true });
      await expect(modal).toHaveCSS("opacity", "1");
      const name = (await modal.getByRole("textbox", { name: "Nome da Regional" }).boundingBox())!;
      const status = (await modal.getByRole("combobox", { name: "Status" }).boundingBox())!;
      expect(status.y).toBeGreaterThan(name.y);
      await modal.screenshot({ path: testInfo.outputPath("cadastro-mobile.png"), animations: "disabled" });
    } finally { await context.close(); }
  });

  test("recupera de erro em tela estreita", async ({ page }, testInfo) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.getByRole("button", { name: "Relatório", exact: true }).click();
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
    await page.screenshot({ path: testInfo.outputPath("botao-relatorio-mobile.png"), animations: "disabled" });
  });

  test("secretaria exporta sem editar; acesso de consulta não exporta", async ({ page, browser }) => {
    test.skip(!process.env.E2E_REPORT_FIXTURE, "Requer as contas fictícias locais do harness");
    await expect(page.getByRole("button", { name: "Novo cadastro", exact: true })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Relatório", exact: true })).toBeVisible();
    const denied = await browser.newContext({ storageState: path.join(path.dirname(process.env.E2E_REPORT_FIXTURE!), "viewer-session.json") });
    try {
      const viewer = await denied.newPage();
      await viewer.goto("/estrutura-eclesiastica/regionais");
      await expect(viewer.getByRole("heading", { name: "Regionais", exact: true })).toBeVisible();
      await expect(viewer.getByRole("button", { name: "Relatório", exact: true })).toHaveCount(0);
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
