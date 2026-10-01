import { expect, test } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { PDFDocument } from "pdf-lib";

const memberCode = process.env.E2E_SHEET_MEMBER_CODE;

test.describe("ficha do membro em PDF", () => {
  test.skip(!process.env.E2E_STORAGE_STATE || !memberCode, "Requer sessão autorizada e E2E_SHEET_MEMBER_CODE de um membro de teste, com permissão para histórico e eventos");

  test.beforeEach(async ({ page }) => {
    await page.goto(`/membros?search=${encodeURIComponent(memberCode!)}`);
    await page.getByRole("button", { name: "Ver ficha" }).first().click();
    await page.getByRole("button", { name: "Baixar ficha em PDF" }).click();
    await expect(page.getByRole("dialog", { name: "Ficha do membro em PDF" })).toBeVisible();
    await expect(page.getByRole("dialog")).toHaveCount(1);
  });

  test("baixa cadastro por padrão e acrescenta apenas as seções selecionadas", async ({ page }) => {
    const history = page.getByRole("checkbox", { name: "Linha do tempo", exact: true });
    const events = page.getByRole("checkbox", { name: "Eventos", exact: true });
    await expect(history).not.toBeChecked();
    await expect(events).not.toBeChecked();
    const basicRequest = page.waitForRequest((request) => request.url().includes("/sheet/pdf"));
    const basicDownload = page.waitForEvent("download");
    await page.getByRole("button", { name: "Baixar PDF", exact: true }).click();
    const basic = await basicDownload;
    expect((await basicRequest).postDataJSON()).toEqual({ includeHistory: false, includeEvents: false });
    expect(basic.suggestedFilename()).toMatch(/^ficha-membro-[A-Za-z0-9_-]+\.pdf$/);
    const basicPdf = await PDFDocument.load(await readFile((await basic.path())!));
    expect(basicPdf.getPages()[0].getSize()).toEqual({ width: 595.28, height: 841.89 });
    await expect(page.getByRole("status")).toHaveText("Ficha pronta. O download foi iniciado.");

    await history.check();
    await events.check();
    const fullRequest = page.waitForRequest((request) => request.url().includes("/sheet/pdf"));
    const fullDownload = page.waitForEvent("download");
    await page.getByRole("button", { name: "Baixar PDF", exact: true }).click();
    const full = await fullDownload;
    expect((await fullRequest).postDataJSON()).toEqual({ includeHistory: true, includeEvents: true });
    const fullPdf = await PDFDocument.load(await readFile((await full.path())!));
    expect(fullPdf.getPageCount()).toBeGreaterThanOrEqual(basicPdf.getPageCount() + 2);
  });

  test("permite tentar novamente após erro e volta à consulta ao fechar em tela estreita", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.route("**/api/members/*/sheet/pdf", (route) => route.fulfill({ status: 500, contentType: "application/json", body: JSON.stringify({ message: "Não foi possível gerar a ficha agora. Tente novamente." }) }));
    await page.getByRole("button", { name: "Baixar PDF", exact: true }).click();
    await expect(page.getByRole("alert")).toHaveText("Não foi possível gerar a ficha agora. Tente novamente.");
    await expect(page.getByRole("button", { name: "Baixar PDF", exact: true })).toBeEnabled();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog", { name: "Ficha do membro", exact: true })).toBeVisible();
  });
});
