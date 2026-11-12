import { expect, type Locator, type Page, test } from "@playwright/test";
import { instant } from "@next/playwright";

test.skip(
  !process.env.E2E_STORAGE_STATE,
  "Defina E2E_STORAGE_STATE com uma sessão de Administrador da Igreja.",
);

async function requireVisibleLink(link: Locator, reason: string) {
  if (await link.count() === 0) test.skip(true, reason);
  await expect(link).toBeVisible();
}

async function expectInstantLinkNavigation({
  page,
  link,
  pathname,
  heading,
  loadingLabel,
}: {
  page: Page;
  link: Locator;
  pathname: string | RegExp;
  heading: string | RegExp;
  loadingLabel: string;
}) {
  await requireVisibleLink(link, `A sessão não expõe a navegação para ${String(pathname)}.`);
  await instant(page, async () => {
    await link.click();
    await page.waitForURL((url) => typeof pathname === "string"
      ? url.pathname === pathname
      : pathname.test(url.pathname));
    await expect(page.locator("[data-app-shell]").filter({ visible: true })).toHaveCount(1);
    await expect(
      page.getByRole("heading", { name: heading }).or(page.getByLabel(loadingLabel)).filter({ visible: true }).first(),
    ).toBeVisible();
  });
  await expect(page.getByRole("heading", { name: heading }).first()).toBeVisible();
}

test.describe("navegação autenticada instantânea", () => {
  for (const width of [1440, 390]) {
    test(`abre as configurações pelo menu do perfil em ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 844 });
      await page.goto("/");
      const header = page.locator("header").filter({ visible: true });
      const profile = header.getByLabel("Menu do perfil");
      await profile.click();
      await page.getByRole("heading", { name: "Dashboard", exact: true }).click();
      await expect(header.locator("details[open]")).toHaveCount(0);
      await profile.click();
      await page.keyboard.press("Escape");
      await expect(profile).toBeFocused();
      await expect(header.locator("details[open]")).toHaveCount(0);
      await profile.click();
      const links = header.locator("details[open] a");
      await expect(links.nth(0)).toHaveText("Meu perfil");
      await expect(links.nth(1)).toHaveText("Configurações");
      await links.nth(1).click();
      await expect(page).toHaveURL(/\/configuracoes$/);
      await expect(page.getByRole("heading", { name: "Configurações da igreja" })).toBeVisible();
    });
  }

  test("sino de aniversariantes respeita a contagem do dia", async ({ page, request }) => {
    const response = await request.get("/api/members/birthdays/today");
    expect(response.ok()).toBe(true);
    const { count } = await response.json();
    await page.goto("/");
    const bell = page.getByLabel(/^Notificações/);
    await bell.click();
    const message = count === 0 ? "Nenhum aniversariante hoje." :
      count === 1 ? "Hoje há 1 aniversariante." : `Hoje há ${count} aniversariantes.`;
    await expect(page.getByRole("status").filter({ hasText: message })).toBeVisible();
    const link = page.getByRole("link", { name: "Ver aniversariantes", exact: true }).filter({ visible: true });
    if (count > 0) {
      await link.click();
      await expect(page).toHaveURL(/\/membros\/aniversariantes$/);
    } else {
      await expect(link).toHaveCount(0);
    }
  });

  test("Dashboard → Membros", async ({ page }) => {
    await page.goto("/");
    await expectInstantLinkNavigation({
      page,
      link: page.locator('a[href="/membros"]').filter({ visible: true }).first(),
      pathname: "/membros",
      heading: "Membros",
      loadingLabel: "Carregando membros",
    });
  });

  test("Membros → Novo membro", async ({ page }) => {
    await page.goto("/membros");
    await expectInstantLinkNavigation({
      page,
      link: page.locator('a[href="/membros/novo"]').filter({ visible: true }).first(),
      pathname: "/membros/novo",
      heading: "Cadastrar Membro",
      loadingLabel: "Preparando cadastro de membro",
    });
  });

  test("Membros → Editar membro", async ({ page }) => {
    await page.goto("/membros");
    const editLink = page.locator('a[href^="/membros/"][href$="/editar"]').filter({ visible: true }).first();
    await requireVisibleLink(editLink, "A igreja precisa ter ao menos um membro editável para este cenário.");
    await expectInstantLinkNavigation({
      page,
      link: editLink,
      pathname: /^\/membros\/[^/]+\/editar$/,
      heading: /^Editar /,
      loadingLabel: "Carregando ficha do membro",
    });
  });

  test("Membros → Importação", async ({ page }) => {
    await page.goto("/membros");
    await expectInstantLinkNavigation({
      page,
      link: page.locator('a[href="/membros/importar"]').filter({ visible: true }).first(),
      pathname: "/membros/importar",
      heading: "Importar membros por planilha",
      loadingLabel: "Carregando importação de membros",
    });
  });

  test("Estrutura → Regionais", async ({ page }) => {
    await page.goto("/");
    await expectInstantLinkNavigation({
      page,
      link: page.locator('a[href="/estrutura-eclesiastica"]').filter({ visible: true }).first(),
      pathname: "/estrutura-eclesiastica/regionais",
      heading: "Estrutura eclesiástica",
      loadingLabel: "Carregando estrutura eclesiástica",
    });
    await expect(page.locator('a[href="/estrutura-eclesiastica/regionais"][aria-current="page"]')).toBeVisible();
  });

  test("Regionais → Congregações", async ({ page }) => {
    await page.goto("/estrutura-eclesiastica/regionais");
    await expectInstantLinkNavigation({
      page,
      link: page.locator('a[href="/estrutura-eclesiastica/congregacoes"]').filter({ visible: true }).first(),
      pathname: "/estrutura-eclesiastica/congregacoes",
      heading: "Estrutura eclesiástica",
      loadingLabel: "Carregando estrutura eclesiástica",
    });
    await expect(page.getByRole("heading", { name: "Congregações", exact: true })).toBeVisible();
  });

  test("Congregações → Cargos", async ({ page }) => {
    await page.goto("/estrutura-eclesiastica/congregacoes");
    await expectInstantLinkNavigation({
      page,
      link: page.locator('a[href="/estrutura-eclesiastica/cargos"]').filter({ visible: true }).first(),
      pathname: "/estrutura-eclesiastica/cargos",
      heading: "Estrutura eclesiástica",
      loadingLabel: "Carregando estrutura eclesiástica",
    });
    await expect(page.getByRole("heading", { name: "Cargos", exact: true })).toBeVisible();
  });

  test("Sidebar → Usuários", async ({ page }) => {
    await page.goto("/");
    await expectInstantLinkNavigation({
      page,
      link: page.locator('a[href="/usuarios"]').filter({ visible: true }).first(),
      pathname: "/usuarios",
      heading: "Usuários e permissões",
      loadingLabel: "Carregando usuários",
    });
  });

  test("Sidebar → Documentos", async ({ page }) => {
    await page.goto("/");
    await expectInstantLinkNavigation({
      page,
      link: page.locator('a[href="/documentos"]').filter({ visible: true }).first(),
      pathname: "/documentos",
      heading: "Documentos",
      loadingLabel: "Carregando documentos administrativos",
    });
  });

  test("Voltar e avançar mantêm o App Shell", async ({ page }) => {
    await page.goto("/membros");
    await expect(page.getByRole("heading", { name: "Membros", exact: true })).toBeVisible();
    const documentsLink = page.locator('a[href="/documentos"]').filter({ visible: true }).first();
    await requireVisibleLink(documentsLink, "A sessão não possui acesso a Documentos.");
    await documentsLink.click();
    await expect(page).toHaveURL(/\/documentos$/);

    await instant(page, async () => {
      await page.goBack();
      await expect(page).toHaveURL(/\/membros$/);
      await expect(page.locator("[data-app-shell]").filter({ visible: true })).toHaveCount(1);
    });
    await expect(page.getByRole("heading", { name: "Membros", exact: true })).toBeVisible();

    await instant(page, async () => {
      await page.goForward();
      await expect(page).toHaveURL(/\/documentos$/);
      await expect(page.locator("[data-app-shell]").filter({ visible: true })).toHaveCount(1);
    });
    await expect(page.getByRole("heading", { name: "Documentos", exact: true })).toBeVisible();
  });

  test("React Activity preserva o filtro ao voltar", async ({ page }) => {
    await page.goto("/estrutura-eclesiastica/regionais");
    const search = page.getByRole("textbox", { name: "Buscar em Regionais" });
    await search.fill("central");
    await page.locator('a[href="/membros"]').filter({ visible: true }).first().click();
    await expect(page).toHaveURL(/\/membros$/);
    await page.goBack();
    await expect(page).toHaveURL(/\/estrutura-eclesiastica\/regionais$/);
    await expect(search).toHaveValue("central");
  });
});

test.describe("regressões de feedback e modais", () => {
  test("abre o cadastro de Regional com um único clique", async ({ page }) => {
    await page.goto("/estrutura-eclesiastica/regionais");
    const trigger = page.getByRole("button", { name: "Novo cadastro" }).filter({ visible: true }).first();
    await requireVisibleLink(trigger, "A sessão não possui permissão para cadastrar Regionais.");

    await trigger.click();

    const dialog = page.getByRole("dialog").filter({ visible: true });
    await expect(dialog).toHaveCount(1);
    await expect(dialog.getByRole("heading", { name: "Nova Regional" })).toBeVisible();
  });

  test("abre as ações de um membro com um único clique", async ({ page }) => {
    await page.goto("/membros");
    const trigger = page.getByTitle("Outras ações").filter({ visible: true }).first();
    await requireVisibleLink(trigger, "A igreja precisa ter ao menos um membro para este cenário.");

    await trigger.click();

    const dialog = page.getByRole("dialog").filter({ visible: true });
    await expect(dialog).toHaveCount(1);
    await expect(dialog.getByRole("heading", { name: /^Ações de / })).toBeVisible();
  });

  test("abre a ficha pesada de membro já no primeiro clique", async ({ page }) => {
    await page.goto("/membros");
    const trigger = page.getByTitle("Ver ficha").filter({ visible: true }).first();
    await requireVisibleLink(trigger, "A igreja precisa ter ao menos um membro para este cenário.");

    await trigger.click();

    await expect(page.getByRole("dialog").filter({ visible: true })).toHaveCount(1);
  });

  test("abre o gerenciador de documentos com um único clique", async ({ page }) => {
    await page.goto("/documentos");
    const trigger = page.getByRole("button", { name: "Categorias e tags" }).filter({ visible: true }).first();
    await requireVisibleLink(trigger, "A sessão não possui acesso ao gerenciador de documentos.");

    await trigger.click();

    const dialog = page.getByRole("dialog").filter({ visible: true });
    await expect(dialog).toHaveCount(1);
    await expect(dialog.getByRole("heading", { name: "Categorias e tags" })).toBeVisible();
  });

  test("logout não deixa a barra global ativa", async ({ page }) => {
    await page.goto("/");
    await page.getByLabel("Menu do perfil", { exact: true }).filter({visible:true}).click();
    await page.getByRole("button", { name: "Encerrar sessão" }).click();
    await page.waitForURL((url) => url.pathname === "/login");

    await expect(page.locator(".app-navigation-progress")).toHaveAttribute("data-visible", "false");
    await expect(page.getByRole("heading", { name: "Acesse sua conta" })).toBeVisible();
  });
});
