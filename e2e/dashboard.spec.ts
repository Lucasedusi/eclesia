import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";

type Fixture = { otherBirthdayMonth?: number; sessions: Record<string, string> };
const path = process.env.E2E_MEMBER_REPORT_FIXTURE;
const fixture: Fixture | null = path ? JSON.parse(readFileSync(path, "utf8")) : null;
test.skip(!process.env.E2E_STORAGE_STATE || !fixture?.otherBirthdayMonth || !fixture.sessions.localTreasurer,
  "Requer member-reports-local.mjs setup --birthdays --dashboard e sessões locais.");

test("administrador vê membros e crianças, alterna o ranking e expande todas as congregações", async ({ page }) => {
  await page.goto("/");
  const main = page.getByRole("main");
  await expect(main.getByRole("article", { name: "Total de membros" })).toContainText("29");
  await expect(main.getByRole("article", { name: "Regionais" })).toContainText("2");
  await expect(main.getByRole("article", { name: "Congregações" })).toContainText("13");
  await expect(main.getByRole("article")).toHaveCount(4);
  const genders = main.getByRole("article", { name: "Membros por sexo" });
  await expect(genders.getByRole("term")).toHaveText(["Masculino", "Feminino"]);
  await expect(genders.getByRole("definition")).toHaveText(["0", "29"]);
  const ranking = main.getByRole("region", { name: "Membros por congregação" });
  const roles = main.getByRole("region", { name: "Membros por cargo" });
  const bounds = async (name: string, role: "article" | "region") => {
    const box = await main.getByRole(role, { name, exact: true }).boundingBox();
    if (!box) throw new Error(`Painel ausente: ${name}`);
    return box;
  };
  const left = await bounds("Membros por congregação", "region");
  const right = await bounds("Membros por cargo", "region");
  const cards = await Promise.all(["Total de membros", "Membros por sexo", "Regionais", "Congregações"]
    .map(name => bounds(name, "article")));
  expect(cards.map(card => card.y)).toEqual(cards.map(() => cards[0].y));
  expect(left.y).toBe(right.y);
  expect(left.x).toBeCloseTo(cards[0].x, 0);
  expect(left.x + left.width).toBeCloseTo(cards[1].x + cards[1].width, 0);
  expect(right.x).toBeCloseTo(cards[2].x, 0);
  expect(right.x + right.width).toBeCloseTo(cards[3].x + cards[3].width, 0);
  await expect(ranking.getByRole("listitem")).toHaveCount(3);
  await expect(ranking.getByRole("listitem").first()).toContainText("Congregação de Teste 1");
  await expect(ranking.getByRole("listitem").first().getByText("23", { exact: true })).toBeVisible();
  await expect(roles.getByRole("listitem")).toHaveCount(5);
  await expect(roles).toContainText("22 membros sem cargo ativo");
  await ranking.getByRole("button", { name: "Ver todas (13)" }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByRole("listitem")).toHaveCount(13);
  await expect(dialog.getByRole("listitem").last().getByText("0", { exact: true })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(ranking.getByRole("button", { name: "Ver todas (13)" })).toBeFocused();
  await ranking.getByRole("button", { name: "Regionais" }).click();
  const regions = main.getByRole("region", { name: "Membros por regional" });
  await expect(regions.getByRole("listitem")).toHaveCount(2);
  await expect(regions.getByRole("listitem").first()).toContainText("26Regional de Teste A");
  await roles.getByRole("button", { name: "Ver todos (7)" }).click();
  await expect(dialog.getByRole("listitem")).toHaveCount(7);
  await expect(dialog).toContainText("Diácono");
  await dialog.getByRole("button", { name: "Fechar modal" }).click();
  await expect(regions).toBeVisible();
});

test("aniversariantes abrem em Dia e o período atualiza no celular", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 780 });
  await page.goto("/");
  const select = page.getByRole("combobox", { name: "Período dos aniversariantes" });
  const rows = page.getByRole("table", { name: "Aniversariantes do período" }).getByRole("row");
  const group = page.getByRole("group", { name: "Exibir ranking por" });
  await group.getByRole("button", { name: "Cargos" }).click();
  await expect(page.getByRole("heading", { name: "Membros por cargo" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Membros por congregação" })).toHaveCount(0);
  await group.getByRole("button", { name: "Regionais" }).click();
  await expect(page.getByRole("heading", { name: "Membros por regional" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Membros por cargo" })).toHaveCount(0);
  await expect(select).toHaveValue("today");
  await expect(rows).toHaveCount(3);
  const birthdayHeader = page.getByRole("columnheader", { name: "Aniversário", exact: true });
  expect(await birthdayHeader.evaluate(header => {
    const text = document.createRange();
    text.selectNodeContents(header);
    return text.getClientRects().length;
  })).toBe(1);
  await select.selectOption("week");
  await expect(rows).toHaveCount(4);
  await select.selectOption("month");
  await expect(page).toHaveURL(/period=month/);
  await expect(select).toHaveValue("month");
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

for (const role of ["congregation", "localTreasurer", "localViewer"]) {
  test(`${role} vê apenas membros, cargos e aniversários da congregação`, async ({ browser, baseURL }) => {
    const page = await browser.newPage({ baseURL, storageState: fixture!.sessions[role] });
    try {
      await page.goto("/?scope=CHURCH&congregationId=outra");
      const main = page.getByRole("main");
      await expect(main.getByRole("article")).toHaveCount(2);
      await expect(main.getByRole("article", { name: "Total de membros" })).toContainText("23");
      await expect(main.getByRole("article", { name: "Membros por sexo" }).getByRole("definition")).toHaveText(["0", "23"]);
      await expect(main.getByRole("heading", { name: "Membros por cargo" })).toBeVisible();
      await expect(main.getByRole("listitem")).toHaveText(["Diácono1"]);
      await expect(main.getByText("22 membros sem cargo ativo")).toBeVisible();
      await expect(main.getByRole("columnheader")).toHaveText(["Aniversário", "Nome"]);
      await expect(main.getByRole("row")).toHaveCount(3);
      await expect(main.getByRole("group", { name: "Exibir ranking por" })).toHaveCount(0);
    } finally { await page.close(); }
  });
}

test("um acesso regional não recebe os indicadores do campo", async ({ browser, baseURL }) => {
  const page = await browser.newPage({ baseURL, storageState: fixture!.sessions.region });
  try {
    await page.goto("/");
    await expect(page.getByText("Seu perfil não possui indicadores disponíveis neste painel.")).toBeVisible();
    await expect(page.getByRole("main").getByRole("article")).toHaveCount(0);
  } finally { await page.close(); }
});

test("a resposta autenticada do Dashboard mantém os dados pessoais e os rankings dentro do escopo", async ({ playwright, baseURL }) => {
  for (const session of ["full", "congregation", "localTreasurer", "localViewer", "region"]) {
    const api = await playwright.request.newContext({ baseURL, storageState: fixture!.sessions[session] });
    try {
      const response = await api.get("/?period=week&scope=CHURCH&congregationId=outra");
      expect(response.status()).toBe(200);
      const html = await response.text();
      expect(html).not.toMatch(/OUTRA_IGREJA_TESTE|SEGREDO_PASTORAL_NUNCA_EXPORTAR|11999998888|RG-TESTE/);
      if (session === "full") {
        expect(html).toContain("Regional de Teste B");
      } else {
        expect(html).not.toMatch(/Regional de Teste B|Congregação de Teste 2/);
        if (session === "region") expect(html).not.toContain("Ana de Teste");
        else expect(html).toContain("Membros por cargo");
      }
    } finally { await api.dispose(); }
  }
});
