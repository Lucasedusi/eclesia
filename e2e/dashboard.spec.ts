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
  const ranking = main.getByRole("region", { name: "Ranking de membros" });
  await expect(ranking.getByRole("listitem")).toHaveCount(10);
  await expect(ranking.getByRole("listitem").first()).toHaveText("Congregação de Teste 123");
  await ranking.getByRole("button", { name: "Ver todas (13)" }).click();
  await expect(ranking.getByRole("listitem")).toHaveCount(13);
  await ranking.getByRole("combobox").selectOption("regions");
  await expect(ranking.getByRole("listitem")).toHaveCount(2);
  await expect(ranking.getByRole("listitem").first()).toHaveText("Regional de Teste A26");
});

test("aniversariantes abrem em Dia e o período atualiza no celular", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 780 });
  await page.goto("/");
  const select = page.getByRole("combobox", { name: "Período dos aniversariantes" });
  const rows = page.getByRole("table", { name: "Aniversariantes do período" }).getByRole("row");
  await expect(select).toHaveValue("today");
  await expect(rows).toHaveCount(3);
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
      await expect(main.getByRole("article")).toHaveCount(1);
      await expect(main.getByRole("article")).toContainText("23");
      await expect(main.getByRole("heading", { name: "Membros por cargo" })).toBeVisible();
      await expect(main.getByRole("listitem")).toHaveText(["Diácono1"]);
      await expect(main.getByRole("columnheader")).toHaveText(["Nome", "Aniversário"]);
      await expect(main.getByRole("row")).toHaveCount(3);
      await expect(main.getByRole("combobox", { name: "Agrupar ranking por" })).toHaveCount(0);
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
