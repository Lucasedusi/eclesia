import { test, expect, type Locator } from "@playwright/test";
import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import ExcelJS from "exceljs";

test.setTimeout(90_000);
function fixture() {
  test.skip(!process.env.E2E_FINANCE_FIXTURE, "Local fixture required");
  expect(process.env.E2E_BASE_URL).toBe("http://127.0.0.1:3217");
  return JSON.parse(readFileSync(process.env.E2E_FINANCE_FIXTURE!, "utf8"));
}
const reference = (scope: Locator) => scope.getByLabel(/^Mês de referência/);

for (const direction of ["entrada", "saída"] as const) {
  test(`${direction}: independent reference survives save and correction; long identity wraps separately`, async ({ page }) => {
    const f = fixture();
    const name = `Inscrição Madureira KIDS Congregação de Nome Muito Extenso ${randomUUID()}`;
    await page.goto(`/financeiro/lancamentos?unidade=${f.unitId}&mes=2026-11`);
    await page.getByRole("button", { name: `Nova ${direction}`, exact: true }).click();
    const form = page.getByRole("dialog");
    await form.getByRole("combobox", { name: /Identificação/ }).selectOption("ORGANIZATION");
    await form.getByLabel("Nome ou identificação").fill(name);
    await form.getByLabel("Data", { exact: true }).fill("2026-11-05");
    await expect(reference(form)).toHaveValue("2026-11");
    await form.getByLabel("Data", { exact: true }).fill("2026-12-05");
    await expect(reference(form)).toHaveValue("2026-12");
    await reference(form).fill("2026-10");
    await form.getByLabel("Data", { exact: true }).fill("2026-11-05");
    await expect(reference(form)).toHaveValue("2026-10");
    await form.getByRole("combobox", { name: "Caixa ou conta", exact: true }).selectOption(f.boxes[f.unitId].cash);
    await form.getByRole("combobox", { name: "Categoria", exact: true }).selectOption(direction === "entrada" ? f.repasseId : f.prebendId);
    await form.getByLabel("Valor (R$)", { exact: true }).fill("113,00");
    await expect(form.locator(".finance-entry-review")).toContainText("10/2026");
    await form.getByRole("button", { name: "Salvar", exact: true }).click();
    await expect(form).toHaveCount(0);
    await page.getByRole("button", { name: new RegExp(`Detalhes.*${name}`) }).click();
    await expect(form).toContainText("05/11/2026");
    await expect(form).toContainText("10/2026");
    const identity = form.locator(".finance-detail-identity");
    for (const width of [1280, 390]) {
      await page.setViewportSize({ width, height: 844 });
      await identity.scrollIntoViewIfNeeded();
      const boxes = await Promise.all([identity.locator("p").boundingBox(), identity.locator("span").boundingBox(), identity.locator("small").boundingBox()]);
      expect(boxes[1]!.y).toBeGreaterThanOrEqual(boxes[0]!.y + boxes[0]!.height + 5);
      expect(boxes[2]!.y).toBeGreaterThanOrEqual(boxes[1]!.y + boxes[1]!.height + 5);
      expect(await identity.evaluate(e => e.scrollWidth <= e.clientWidth)).toBe(true);
    }
    await page.screenshot({ path: `tmp/reference-${direction}-mobile.png` });
    await page.setViewportSize({ width: 1280, height: 900 });
    await form.getByRole("button", { name: "Corrigir", exact: true }).click();
    await expect(reference(form)).toHaveValue("2026-10");
    await form.getByLabel("Data", { exact: true }).fill("2026-11-06");
    await expect(reference(form)).toHaveValue("2026-10");
    await reference(form).fill("2026-09");
    await form.getByLabel("Justificativa da correção").fill("Conferir mês ao qual o pagamento se refere");
    await form.getByRole("button", { name: "Salvar correção", exact: true }).click();
    await expect(form).toHaveCount(0);
    await page.reload();
    await page.getByRole("button", { name: new RegExp(`Detalhes.*${name}`) }).click();
    await expect(form).toContainText("06/11/2026");
    await expect(form).toContainText("09/2026");
    await page.goto(`/financeiro/lancamentos?unidade=${f.unitId}&mes=2026-10&search=${encodeURIComponent(name)}`);
    await expect(page.getByRole("button", { name: new RegExp(`Detalhes.*${name}`) })).toHaveCount(0);
  });
}

test("congregation lookup shows a spinner; attendance saves reference; month filter describes movements", async ({ page }) => {
  const f = fixture();
  await page.goto(`/financeiro/atendimento?unidade=${f.unitId}&mes=2026-11`);
  const form = page.locator("form.finance-attendance-form");
  await form.getByRole("combobox", { name: /Identificação/ }).selectOption("CONGREGATION");
  await form.getByLabel("Nome da congregação").fill("Headquarters");
  let release!: () => void;
  const gate = new Promise<void>(resolve => { release = resolve; });
  await page.route("**/financeiro/atendimento**", async route => {
    if (route.request().method() === "POST") await gate;
    await route.continue();
  });
  const search = form.getByRole("button", { name: "Buscar congregação", exact: true });
  try {
    await search.click();
    await expect(search).toHaveAttribute("aria-busy", "true");
    await expect(search.locator(".finance-spin")).toBeVisible();
  } finally { release(); }
  await form.getByRole("button", { name: "Headquarters", exact: true }).click();
  await page.unroute("**/financeiro/atendimento**");
  await expect(search).toHaveCount(0);
  await form.getByLabel("Data", { exact: true }).fill("2026-11-07");
  await reference(form).fill("2026-10");
  const dateBox = (await form.getByLabel("Data", { exact: true }).boundingBox())!;
  const referenceBox = (await reference(form).boundingBox())!;
  expect(Math.abs(dateBox.y - referenceBox.y)).toBeLessThanOrEqual(1);
  expect(Math.abs(dateBox.height - referenceBox.height)).toBeLessThanOrEqual(1);
  await form.getByRole("combobox", { name: "Caixa ou conta", exact: true }).selectOption(f.boxes[f.unitId].cash);
  await form.getByRole("combobox", { name: "Categoria", exact: true }).selectOption(f.offeringId);
  await form.getByLabel("Valor (R$)", { exact: true }).fill("41,23");
  await page.screenshot({ path: "tmp/reference-attendance.png", fullPage: true });
  await form.getByRole("button", { name: "Confirmar atendimento", exact: true }).click();
  await expect(page.getByText("Atendimento confirmado.", { exact: false })).toBeVisible();
  await page.goto(`/financeiro/lancamentos?unidade=${f.unitId}&mes=2026-11&search=Headquarters`);
  await page.getByRole("row").filter({ hasText: "41,23" }).getByRole("button", { name: /Detalhes/ }).click();
  await expect(page.getByRole("dialog")).toContainText("10/2026");
  await page.getByLabel("Fechar modal").click();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole("button", { name: /^Período:/ }).click();
  await expect(page.getByLabel("Mês da movimentação", { exact: true })).toHaveValue("2026-11");
});

test("bank draft preserves reference through reload, then posts using statement date", async ({ page }) => {
  const f = fixture(), name = `referencia-${randomUUID()}.xlsx`;
  const book = new ExcelJS.Workbook(), sheet = book.addWorksheet("LANÇAMENTOS");
  sheet.addRow(["EXTRATO CONTA CORRENTE"]);
  sheet.addRow(["DATA", "DOCUMENTO", "HISTÓRICO", "INFORMAÇÕES COMPLEMENTARES", "VALOR"]);
  sheet.addRow(["05/11/2026", name, "PIX RECEBIDO", "Referência de outubro", 17.45]);
  await page.goto(`/financeiro/lancamentos/importacoes?unidade=${f.unitId}&mes=2026-11`);
  await page.getByLabel("Extrato XLSX do Sicoob").setInputFiles({ name, mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", buffer: Buffer.from(await book.xlsx.writeBuffer()) });
  await page.getByRole("button", { name: "Preparar importação", exact: true }).click();
  await page.getByRole("button", { name: "Conferir linha 3", exact: true }).click();
  const form = page.locator("form.finance-attendance-form");
  await expect(form.getByLabel("Data", { exact: true })).toBeDisabled();
  await expect(reference(form)).toHaveValue("2026-11");
  await reference(form).fill("2026-10");
  await form.getByRole("combobox", { name: /Identificação/ }).selectOption("ORGANIZATION");
  await form.getByLabel("Nome ou identificação").fill(name);
  await form.getByRole("combobox", { name: "Categoria", exact: true }).selectOption(f.offeringId);
  await page.getByText("Mais opções", { exact: true }).click();
  await page.getByRole("button", { name: "Salvar rascunho", exact: true }).click();
  await expect(page.getByText("Rascunho salvo.", { exact: true })).toBeVisible();
  await page.reload();
  await page.getByRole("button", { name: "Conferir linha 3", exact: true }).click();
  await expect(reference(form)).toHaveValue("2026-10");
  await expect(form.getByLabel("Data", { exact: true })).toHaveValue("2026-11-05");
  await form.getByRole("button", { name: "Salvar", exact: true }).click();
  await expect(page.getByText("Lançamento salvo.", { exact: true })).toBeVisible();
  await page.goto(`/financeiro/lancamentos?unidade=${f.unitId}&mes=2026-11&search=${encodeURIComponent(name)}`);
  await page.getByRole("button", { name: new RegExp(`Detalhes.*referencia-`) }).click();
  await expect(page.getByRole("dialog")).toContainText("05/11/2026");
  await expect(page.getByRole("dialog")).toContainText("10/2026");
});
