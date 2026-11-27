import { expect, test, type Page } from "@playwright/test";

import { readFileSync } from "node:fs";

const fixturePath = process.env.E2E_MEMBER_REPORT_FIXTURE;
const fixture = fixturePath ? JSON.parse(readFileSync(fixturePath, "utf8")) as { feedbackBatch?: string } : null;
test.skip(!process.env.E2E_STORAGE_STATE || !fixture?.feedbackBatch,
  "Requer member-reports-local.mjs setup --birthdays --dashboard --admin-feedback e sessão local.");

async function holdRequests(page: Page, match: (headers: Record<string, string>) => boolean) {
  let release!: () => void;
  const gate = new Promise<void>(resolve => { release = resolve; });
  await page.route("**/*", async route => {
    if (match(route.request().headers())) await gate;
    await route.continue();
  });
  return release;
}

test("a sidebar respeita a preferência salva e aceita o primeiro clique disponível", async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("eclesias-sidebar-collapsed", "true"));
  let resume!: () => void;
  const gate = new Promise<void>(resolve => { resume = resolve; });
  await page.route("**/_next/static/**/*.js*", async route => { await gate; await route.continue(); });
  try {
    await page.goto("/", { waitUntil: "commit" });
    await expect(page.locator("aside").getByRole("link", { name: "Membros", exact: true }).first()).toBeVisible();
    await expect(page.getByRole("button", { name: "Recolher sidebar" })).toHaveCount(0);
  } finally { resume(); }
  await page.getByRole("button", { name: "Expandir sidebar" }).click();
  await expect(page.getByRole("button", { name: "Recolher sidebar" })).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem("eclesias-sidebar-collapsed"))).toBe("false");
});

test("a ficha mantém o mesmo diálogo desde o primeiro clique e reaproveita as abas", async ({ page }) => {
  await page.goto("/membros");
  const open = page.getByRole("button", { name: "Ver ficha", exact: true }).first();
  await expect(open).toBeVisible();
  const release = await holdRequests(page, headers => Boolean(headers["next-action"]));
  const dialog = page.getByRole("dialog", { name: "Ficha do membro", exact: true });
  try {
    await open.click();
    await expect(dialog.getByLabel("Carregando ficha do membro")).toBeVisible();
    await expect(dialog.getByRole("button", { name: "Fechar modal" })).toBeEnabled();
    await dialog.evaluate(element => element.setAttribute("data-first-open", "true"));
  } finally { release(); }
  await expect(dialog.getByText("Identificação e vínculo")).toBeVisible();
  await expect(dialog).toHaveAttribute("data-first-open", "true");
  await page.unrouteAll({ behavior: "wait" });
  const history = dialog.getByRole("button", { name: "Histórico eclesiástico" });
  const showHistory = await holdRequests(page, headers => Boolean(headers["next-action"]));
  try {
    await history.click();
    await expect(dialog.getByRole("status", { name: "Carregando seção da ficha" })).toBeVisible();
    await dialog.getByRole("button", { name: "Dados de cadastro" }).click();
    await expect(dialog.getByText("Identificação e vínculo")).toBeVisible();
  } finally { showHistory(); }
  await history.click();
  await expect(dialog.getByRole("status", { name: "Carregando seção da ficha" })).toHaveCount(0);
});

for (const [path, field, label] of [
  ["/membros", "Pesquisar membros", "Carregando membros"],
  ["/membros/aniversariantes", "Pesquisar aniversariantes", "Carregando aniversariantes"],
  ["/documentos", "Pesquisar documentos", "Atualizando documentos"],
  ["/eventos", "Pesquisar", "Carregando eventos"],
]) {
  test(`a busca em ${path} mantém o foco e exibe o skeleton`, async ({ page }) => {
    await page.goto(path);
    const input = page.getByRole("textbox", { name: field, exact: true });
    await expect(input).toBeVisible();
    const release = await holdRequests(page, headers => Boolean(headers["next-action"] || headers.rsc));
    const loading = page.getByRole("status", { name: label, exact: true });
    try {
      await input.fill("teste");
      await expect(loading).toBeVisible();
      await expect(input).toBeFocused();
      await input.fill("Ana");
    } finally { release(); }
    await expect(loading).toHaveCount(0);
    await expect(input).toHaveValue("Ana");
    await expect(page).toHaveURL(/search=Ana/);
  });
}

test("o filtro do dashboard atualiza somente os aniversariantes", async ({ page }) => {
  await page.goto("/");
  const select = page.getByRole("combobox", { name: "Período dos aniversariantes" });
  await expect(select).toBeVisible();
  const release = await holdRequests(page, headers => Boolean(headers.rsc));
  try {
    await select.selectOption("week");
    await expect(page.getByRole("status", { name: "Carregando aniversariantes" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Membros por cargo" })).toBeVisible();
  } finally { release(); }
  await expect(select).toHaveValue("week");
  await expect(page).toHaveURL(/period=week/);
});

test("o atalho do cadastro leva ao fim da etapa e desaparece ao alcançar o rodapé", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 700 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/membros/novo");
  await page.getByRole("button", { name: "Ir para o fim da etapa" }).click();
  await expect(page.getByRole("button", { name: "Próximo", exact: true })).toBeInViewport();
  await expect(page.getByRole("button", { name: "Ir para o fim da etapa" })).toHaveCount(0);
});


test("a revisão de importação aceita filtros enquanto aguarda os resultados", async ({ page }) => {
  await page.goto(`/membros/importar?batch=${fixture!.feedbackBatch}`);
  const search = page.getByRole("main").getByRole("textbox");
  await expect(search).toBeVisible();
  const release = await holdRequests(page, headers => Boolean(headers["next-action"]));
  try {
    await search.fill("Ana");
    await expect(page.getByRole("status", { name: "Carregando revisão dos membros" })).toBeVisible();
    await expect(search).toBeFocused();
  } finally { release(); }
  await expect(page.getByRole("status", { name: "Carregando revisão dos membros" })).toHaveCount(0);
});
