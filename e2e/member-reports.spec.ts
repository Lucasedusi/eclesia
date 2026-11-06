import { expect, test, type APIRequestContext } from "@playwright/test";
import { readFileSync } from "node:fs";
import { readFile as readFileAsync } from "node:fs/promises";
import ExcelJS from "exceljs";
import { PDFDocument } from "pdf-lib";

type Fixture = { total: number; congregations: string[]; regions: string[]; role: string; sessions: Record<string, string> };
const fixture: Fixture | null = process.env.E2E_MEMBER_REPORT_FIXTURE ? JSON.parse(readFileSync(process.env.E2E_MEMBER_REPORT_FIXTURE, "utf8")) : null;
async function workbook(bytes: Buffer) { const book = new ExcelJS.Workbook(); await book.xlsx.load(bytes as unknown as ExcelJS.Buffer); return book.worksheets[0]; }
async function exportSheet(api: APIRequestContext, input: object) {
  const response = await api.post("/api/members/reports", { data: input }); expect(response.status(), response.status() === 200 ? "" : await response.text()).toBe(200);
  expect(response.headers()["cache-control"]).toContain("no-store"); return workbook(await response.body());
}

test.describe("listagens de membros", () => {
  test.skip(!process.env.E2E_STORAGE_STATE || !fixture, "Requer sessão e E2E_MEMBER_REPORT_FIXTURE com dados fictícios e sessões por escopo.");
  test("baixa simplificada PDF e Excel com todas as páginas", async ({ page }, info) => {
    await page.goto("/membros"); await page.getByRole("button", { name: "Relatório", exact: true }).click();
    const dialog = page.getByRole("dialog", { name: "Listagem de membros", exact: true });
    await dialog.getByLabel("Formato", { exact: true }).selectOption("xlsx");
    const promise = page.waitForEvent("download"); await dialog.getByRole("button", { name: "Baixar Excel" }).click(); const download = await promise;
    expect(download.suggestedFilename()).toBe("lista-membros-simplificada.xlsx");
    const sheet = await workbook(await readFileAsync((await download.path())!));
    expect(sheet.rowCount - 6).toBe(fixture!.total); expect(sheet.columnCount).toBe(5);
    expect(sheet.getCell("A7").value).toBe("00001"); expect(sheet.getCell("E7").value).toBe("Diaconisa");
    expect(JSON.stringify(sheet.getSheetValues())).not.toMatch(/OUTRA_IGREJA|ARQUIVADO|SEGREDO_PASTORAL/);
    await download.saveAs(info.outputPath("simplificada.xlsx"));
    await dialog.getByLabel("Formato", { exact: true }).selectOption("pdf");
    const pdfPromise = page.waitForEvent("download"); await dialog.getByRole("button", { name: "Baixar PDF" }).click(); const pdfDownload = await pdfPromise;
    const pdf = await PDFDocument.load(await readFileAsync((await pdfDownload.path())!)); expect(pdf.getPageCount()).toBeGreaterThan(1); expect(pdf.getPage(0).getSize()).toEqual({ width: 595.28, height: 841.89 });
    await pdfDownload.saveAs(info.outputPath("simplificada.pdf")); await expect(dialog.getByRole("status")).toContainText("download foi iniciado");
    await page.screenshot({ path: info.outputPath("modal-simplificada.png") });
    await page.keyboard.press("Escape"); await page.screenshot({ path: info.outputPath("botoes-desktop.png") });
  });
  test("completa permite somente Excel e inclui cadastro sem notas pastorais", async ({ page }, info) => {
    await page.goto("/membros"); await page.getByRole("button", { name: "Relatório", exact: true }).click();
    const dialog = page.getByRole("dialog", { name: "Listagem de membros", exact: true });
    await dialog.getByLabel("Modelo", { exact: true }).selectOption("complete"); await expect(dialog.getByLabel("Formato", { exact: true })).toBeDisabled();
    const promise = page.waitForEvent("download"); await dialog.getByRole("button", { name: "Baixar Excel" }).click(); const download = await promise;
    const sheet = await workbook(await readFileAsync((await download.path())!)); const headers = sheet.getRow(6).values as string[];
    for (const name of ["Nacionalidade", "Naturalidade", "UF de nascimento", "Profissão", "Escolaridade", "CPF", "RG", "Observações gerais"]) expect(headers).toContain(name);
    expect(sheet.getCell(7, headers.indexOf("Observações gerais")).value).toBe("=1+1"); expect(sheet.getCell(7, headers.indexOf("Nascimento")).value).toBeInstanceOf(Date);
    expect(JSON.stringify(sheet.getSheetValues())).not.toMatch(/pastoral|SEGREDO_PASTORAL/i);
    await download.saveAs(info.outputPath("completa.xlsx")); await page.screenshot({ path: info.outputPath("modal-completa.png") });
  });
  test("personalizada fixa duas colunas, limita quatro extras e evita download duplicado", async ({ page }, info) => {
    await page.goto("/membros"); await page.getByRole("button", { name: "Relatório", exact: true }).click();
    const dialog = page.getByRole("dialog", { name: "Listagem de membros", exact: true });
    const initialHeight = await dialog.evaluate((element) => getComputedStyle(element).height); await dialog.getByLabel("Modelo", { exact: true }).selectOption("custom");
    expect(await dialog.evaluate((element) => getComputedStyle(element).height)).toBe(initialHeight);
    await expect(dialog.getByRole("checkbox", { name: /^Matrícula/ })).toBeDisabled(); await expect(dialog.getByRole("checkbox", { name: /^Nome do membro/ })).toBeChecked();
    await dialog.getByRole("checkbox", { name: "Nascimento", exact: true }).check(); await dialog.getByRole("checkbox", { name: "Observações gerais", exact: true }).check();
    await expect(dialog.getByRole("checkbox", { name: "E-mail", exact: true })).toBeDisabled();
    await dialog.getByRole("checkbox", { name: /^WhatsApp/ }).uncheck(); await dialog.getByRole("checkbox", { name: "E-mail", exact: true }).check();
    let requests = 0; await page.route("**/api/members/reports", async (route) => { requests++; expect(route.request().postDataJSON().fields).toEqual(["congregation", "birth_date", "notes", "email"]); await route.continue(); });
    const promise = page.waitForEvent("download"); await dialog.getByRole("button", { name: "Baixar PDF" }).evaluate((button: HTMLButtonElement) => { button.click(); button.click(); }); const download = await promise;
    await expect(dialog.getByRole("status")).toContainText("download foi iniciado"); expect(requests).toBe(1);
    const pdf = await PDFDocument.load(await readFileAsync((await download.path())!)); expect(pdf.getPage(0).getSize()).toEqual({ width: 841.89, height: 595.28 }); await download.saveAs(info.outputPath("personalizada.pdf"));
    await dialog.getByLabel("Modelo", { exact: true }).scrollIntoViewIfNeeded(); await page.screenshot({ path: info.outputPath("modal-personalizada.png") });
  });
  test("resultados filtrados mantêm a seleção da tela e incluem todas as páginas", async ({ page }) => {
    await page.goto(`/membros?congregation=${fixture!.congregations[1]}`); await page.getByRole("button", { name: "Relatório", exact: true }).click();
    const dialog = page.getByRole("dialog", { name: "Listagem de membros", exact: true }); await dialog.getByLabel("Abrangência", { exact: true }).selectOption("FILTERED"); await dialog.getByLabel("Formato", { exact: true }).selectOption("xlsx");
    const requested = page.waitForRequest((r) => r.url().endsWith("/api/members/reports")); const promise = page.waitForEvent("download"); await dialog.getByRole("button", { name: "Baixar Excel" }).click();
    expect((await requested).postDataJSON().filters.congregationId).toBe(fixture!.congregations[1]); const file = await promise; expect((await workbook(await readFileAsync((await file.path())!))).rowCount - 6).toBe(3);
  });
  test("aplica escopo, igreja, arquivo e filtros no servidor", async ({ playwright, request }) => {
    for (const [name, count] of [["region",29],["congregation",26],["ministry",2]] as const) {
      const api = await playwright.request.newContext({ baseURL: process.env.E2E_BASE_URL, storageState: fixture!.sessions[name] });
      try { const sheet = await exportSheet(api, { kind: "simplified", format: "xlsx" }); expect(sheet.rowCount - 6, name).toBe(count); } finally { await api.dispose(); }
    }
    expect((await exportSheet(request, { kind: "simplified", format: "xlsx", filters: { regionId: fixture!.regions[1] } })).rowCount - 6).toBe(3);
    expect((await exportSheet(request, { kind: "simplified", format: "xlsx", filters: { roleId: fixture!.role } })).rowCount - 6).toBe(1);
    expect((await exportSheet(request, { kind: "simplified", format: "xlsx", filters: { archived: true } })).getCell("B7").value).toBe("ARQUIVADO_TESTE");
    const empty = await exportSheet(request, { kind: "simplified", format: "xlsx", filters: { congregationId: fixture!.congregations[3] } }); expect(empty.getCell("A7").value).toContain("Nenhum membro");
    const cpf = await exportSheet(request, { kind: "custom", format: "xlsx", fields: [], filters: { search: "00000000191" } }); expect(cpf.rowCount - 6).toBe(1); expect(cpf.columnCount).toBe(2);
  });
  test("protege dados sensíveis e rejeita solicitações sem permissão", async ({ playwright }) => {
    const limited = await playwright.request.newContext({ baseURL: process.env.E2E_BASE_URL, storageState: fixture!.sessions.limited });
    try {
      const full = await exportSheet(limited, { kind: "complete", format: "xlsx" }), headers = full.getRow(6).values;
      for (const field of ["CPF", "RG", "Cargo", "Início no cargo"]) expect(headers).not.toContain(field);
      expect(JSON.stringify(full.getSheetValues())).not.toMatch(/000\.000\.001-91|RG-TESTE|SEGREDO_PASTORAL/);
      expect((await exportSheet(limited, { kind: "simplified", format: "xlsx" })).getCell("E7").value).toBe("Informação restrita");
      for (const fields of [["cpf"],["role"]]) expect((await limited.post("/api/members/reports", { data: { kind: "custom", format: "xlsx", fields } })).status()).toBe(403);
      expect((await limited.post("/api/members/reports", { data: { kind: "simplified", format: "xlsx", filters: { archived: true } } })).status()).toBe(403);
    } finally { await limited.dispose(); }
    const viewer = await playwright.request.newContext({ baseURL: process.env.E2E_BASE_URL, storageState: fixture!.sessions.viewer });
    try { expect((await viewer.post("/api/members/reports", { data: { kind: "simplified", format: "xlsx" } })).status()).toBe(403); } finally { await viewer.dispose(); }
  });
  test("permite nova tentativa após erro e cabe na tela pequena", async ({ page }, info) => {
    await page.setViewportSize({ width: 390, height: 844 }); await page.goto("/membros"); await page.getByRole("button", { name: "Relatório", exact: true }).click();
    const dialog = page.getByRole("dialog", { name: "Listagem de membros", exact: true });
    await page.route("**/api/members/reports", (route) => route.fulfill({ status: 500, contentType: "application/json", body: JSON.stringify({ message: "Não foi possível gerar a listagem agora. Tente novamente." }) }));
    await dialog.getByRole("button", { name: "Baixar PDF" }).click(); await expect(dialog.getByRole("alert")).toContainText("Tente novamente"); await expect(dialog.getByRole("button", { name: "Baixar PDF" })).toBeEnabled();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true); await page.screenshot({ path: info.outputPath("modal-mobile.png") });
    await page.unroute("**/api/members/reports"); const promise = page.waitForEvent("download"); await dialog.getByRole("button", { name: "Baixar PDF" }).click(); await promise;
    await page.keyboard.press("Escape"); await expect(dialog).not.toBeVisible(); await expect(page.getByRole("button", { name: "Relatório", exact: true })).toBeFocused();
    await page.screenshot({ path: info.outputPath("botoes-mobile.png") });
  });
});
