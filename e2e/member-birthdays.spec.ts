import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";
import { PDFDocument } from "pdf-lib";

type Fixture = { otherBirthdayMonth?: number; regions: string[]; sessions: Record<string, string> };
const path = process.env.E2E_MEMBER_REPORT_FIXTURE;
const fixture: Fixture | null = path ? JSON.parse(readFileSync(path, "utf8")) : null;
const url = "/membros/aniversariantes";
test.skip(!process.env.E2E_STORAGE_STATE || !fixture?.otherBirthdayMonth, "Requer sessões locais e member-reports-local.mjs setup --birthdays.");

test("abre em Hoje, filtra por mês e matrícula e mantém o WhatsApp no celular", async ({ page }, info) => {
  await page.goto("/membros");
  await page.getByRole("link", { name: "Aniversariantes", exact: true }).click();
  const table = page.getByRole("table", { name: "Aniversariantes" });
  await expect(page.getByRole("link", { name: "Dia", exact: true })).toHaveAttribute("aria-current", "page");
  await expect(table.getByRole("row")).toHaveCount(3);
  const headers = table.getByRole("columnheader");
  await expect(headers).toHaveText(["Membro", "Congregação", "Cargo", "Data de nascimento", "WhatsApp"]);
  await expect(headers.last()).toHaveCSS("text-align", "left");
  const contact = table.getByRole("row").nth(1).getByRole("cell").last();
  await expect(contact).toHaveCSS("text-align", "left");
  await expect(contact.getByRole("link")).toHaveAttribute("href", "https://wa.me/5511999998888");
  await expect(table).toContainText("Diaconisa");
  await expect(table).toContainText("00002");
  await expect(table.getByRole("link")).toHaveCount(1);
  await page.getByRole("link", { name: "Mês", exact: true }).click();
  await page.getByLabel("Mês do aniversário").selectOption(String(fixture!.otherBirthdayMonth));
  await expect(page.getByRole("main").getByText(/25 aniversariantes/)).toBeVisible();
  await page.getByRole("link", { name: "Todos", exact: true }).click();
  await expect(page.getByRole("main").getByText(/28 aniversariantes/)).toBeVisible();
  await page.getByRole("link", { name: "Próxima" }).click();
  await expect(page.getByRole("main").getByText("Página 2 de 2")).toBeVisible();
  await page.getByRole("textbox", { name: "Pesquisar aniversariantes" }).fill("00001");
  await expect(table.getByRole("row")).toHaveCount(2);
  const periods = page.getByRole("navigation", { name: "Período dos aniversários" });
  const pdf = page.getByRole("button", { name: "Exportar PDF" });
  for (const width of [320, 390]) {
    await page.setViewportSize({ width, height: 844 });
    await expect(async () => {
      const group = (await periods.boundingBox())!;
      const button = (await pdf.boundingBox())!;
      const last = (await periods.getByRole("link", { name: "Todos" }).boundingBox())!;
      expect(Math.abs((group.y + group.height / 2) - (button.y + button.height / 2))).toBeLessThan(3);
      expect(button.x).toBeGreaterThanOrEqual(group.x + group.width);
      expect(last.x + last.width).toBeLessThanOrEqual(group.x + group.width);
    }).toPass({ timeout: 3000 });
  }
  await expect(table).toBeHidden();
  await expect(page.getByRole("link", { name: /Abrir WhatsApp de Ana/ })).toBeVisible();
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await expect(page.getByRole("textbox", { name: "Pesquisar aniversariantes" })).toBeVisible();
  await page.screenshot({ path: info.outputPath("aniversariantes-celular.png"), animations: "disabled" });
});

test("consulta e exporta a semana inteira, com a aba ativa no cabeçalho", async ({ page }, info) => {
  await page.goto(url);
  const week = page.getByRole("link", { name: "Semana", exact: true });
  const header = page.locator("header").filter({ has: week });
  await expect(header.getByRole("button", { name: "Exportar PDF" })).toBeVisible();
  await week.click();
  await page.mouse.move(0, 0);
  await expect(week).toHaveAttribute("aria-current", "page");
  await expect(week).toHaveCSS("background-color", await page.getByRole("link", { name: "Aniversariantes", exact: true }).evaluate((tab) => getComputedStyle(tab).backgroundColor));
  const table = page.getByRole("table", { name: "Aniversariantes" });
  await expect(table.getByRole("row")).toHaveCount(4);
  await expect(table).toContainText("00007");
  const requested = page.waitForRequest((request) => request.method() === "POST" && request.url().endsWith("/api/members/reports"));
  const file = page.waitForEvent("download");
  await header.getByRole("button", { name: "Exportar PDF" }).click();
  expect((await requested).postDataJSON().filters.period).toBe("week");
  await (await file).saveAs(info.outputPath("aniversariantes-semana.pdf"));
});

test("pesquisa a partir de três caracteres, sinaliza carregamento e mantém o foco", async ({ page }) => {
  await page.goto(url + "?period=all");
  const input = page.getByRole("textbox", { name: "Pesquisar aniversariantes" });
  const table = page.getByRole("table", { name: "Aniversariantes" });
  await expect(table).toBeVisible();
  await input.fill("00");
  await expect(page.getByText("Mínimo de 3 caracteres")).toBeVisible();
  await expect(page).not.toHaveURL(/search=/);
  await expect(table.getByRole("row")).toHaveCount(21);
  await expect(page.getByRole("button", { name: "Filtrar", exact: true })).toHaveCount(0);

  const gate = Promise.withResolvers<void>();
  await page.route("**/membros/aniversariantes?**", async (route) => {
    if (new URL(route.request().url()).searchParams.get("search") === "000") await gate.promise;
    await route.continue();
  });
  await input.press("0");
  try {
    await expect(page.getByText("Buscando...", { exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Exportar PDF" })).toBeDisabled();
  } finally { gate.resolve(); }
  await expect(page).toHaveURL(/search=000(?:&|$)/);
  await expect(table).toBeVisible();
  await expect(input).toBeFocused();
  await input.pressSequentially("07");
  await expect(table.getByRole("row")).toHaveCount(2);
  await expect(table).toContainText("00007");
  await input.fill("00");
  await expect(table.getByRole("row")).toHaveCount(21);
  await page.getByRole("button", { name: "Limpar pesquisa", exact: true }).click();
  await expect(input).toHaveValue("");
});

test("exporta o PDF de todas as páginas e mantém os filtros", async ({ page }, info) => {
  await page.goto(url + "?period=all&page=2");
  await expect(page.getByRole("main").getByText("Página 2 de 2")).toBeVisible();
  const downloadEvent = page.waitForEvent("download");
  await page.getByRole("button", { name: "Exportar PDF" }).click();
  const file = await downloadEvent;
  expect(file.suggestedFilename()).toBe("aniversariantes.pdf");
  const pdf = await PDFDocument.load(readFileSync((await file.path())!));
  expect(pdf.getPageCount()).toBeGreaterThan(1);
  await file.saveAs(info.outputPath("aniversariantes.pdf"));
  await page.getByRole("combobox", { name: "Regional", exact: true }).selectOption(fixture!.regions[1]);
  await expect(page.getByRole("main").getByText(/3 aniversariantes/)).toBeVisible();
  const filteredEvent = page.waitForEvent("download");
  await page.getByRole("button", { name: "Exportar PDF" }).click();
  const filtered = await filteredEvent;
  expect((await PDFDocument.load(readFileSync((await filtered.path())!))).getPageCount()).toBe(1);
  await filtered.saveAs(info.outputPath("aniversariantes-filtrados.pdf"));
  await page.screenshot({ path: info.outputPath("aniversariantes-desktop.png") });
});

for (const [scope, count] of [["region", 25], ["congregation", 22], ["ministry", 2]] as const) {
  test(`aplica escopo ${scope} à lista e às opções de filtro`, async ({ browser }) => {
    const page = await browser.newPage({ storageState: fixture!.sessions[scope] });
    try {
      await page.goto(url + "?period=all");
      await expect(page.getByRole("main").getByText(new RegExp(`· ${count} aniversariantes$`))).toBeVisible();
      await expect(page.getByRole("option", { name: "Regional de Teste B" })).toHaveCount(0);
      await page.goto(url + "?period=all&regionId=" + fixture!.regions[1]);
      await expect(page.getByRole("heading", { name: "Nenhum aniversariante encontrado" })).toBeVisible();
    } finally { await page.close(); }
  });
}

test("mostra nascimento à esquerda na última coluna quando o WhatsApp é restrito", async ({ browser }) => {
  const page = await browser.newPage({ storageState: fixture!.sessions.viewer });
  try {
    await page.goto(url);
    const table = page.getByRole("table", { name: "Aniversariantes" });
    await expect(table.getByRole("columnheader", { name: "WhatsApp" })).toHaveCount(0);
    const lastHeader = table.getByRole("columnheader").last();
    await expect(lastHeader).toHaveText("Data de nascimento");
    await expect(lastHeader).toHaveCSS("text-align", "left");
    const lastCell = table.getByRole("row").nth(1).getByRole("cell").last();
    await expect(lastCell.locator("time")).toBeVisible();
    await expect(lastCell).toHaveCSS("text-align", "left");
  } finally { await page.close(); }
});

test("restringe o PDF sem permissão de exportação", async ({ playwright }) => {
  const api = await playwright.request.newContext({ baseURL: process.env.E2E_BASE_URL, storageState: fixture!.sessions.viewer });
  try {
    expect((await api.post("/api/members/reports", { data: { kind: "birthdays", format: "pdf", filters: {} } })).status()).toBe(403);
  } finally { await api.dispose(); }
});


test("oferece a consulta mensal quando não há aniversariante hoje na congregação", async ({ page }) => {
  await page.goto(url + "?regionId=" + fixture!.regions[1]);
  await expect(page.getByRole("heading", { name: "Nenhum aniversariante hoje" })).toBeVisible();
  await page.getByRole("link", { name: "Ver aniversariantes do mês" }).click();
  await expect(page.getByRole("combobox", { name: "Mês do aniversário" })).toBeVisible();
  await expect(page.getByRole("combobox", { name: "Regional", exact: true })).toHaveValue(fixture!.regions[1]);
});
