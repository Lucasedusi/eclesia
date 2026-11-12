import { expect, test } from "@playwright/test";

test.use({ storageState: { cookies: [], origins: [] } });

for (const width of [1440, 390]) {
  test(`login e recuperação compartilham a apresentação em ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 844 });

    for (const [path, heading] of [
      ["/login", "Acesse sua conta"],
      ["/recuperar-senha", "Esqueceu a senha?"],
      ["/redefinir-senha", "Defina uma nova senha"],
    ]) {
      await page.goto(path);
      await expect(page).toHaveTitle("EKLESIAS");
      const title = page.getByRole("heading", { name: heading, exact: true });
      await expect(title).toBeVisible();
      const card = title.locator("..");
      await expect(card).toHaveCSS("background-color", "rgb(255, 255, 255)");
      const cardBounds = (await card.boundingBox())!;
      const brand = page.locator("main section").getByText("EKLESIAS", { exact: true }).locator("../..");
      const brandBounds = (await brand.boundingBox())!;
      expect(Math.abs(brandBounds.x + brandBounds.width / 2 - cardBounds.x - cardBounds.width / 2)).toBeLessThan(1);
      const panel = page.locator("aside");
      if (width === 1440) {
        expect(cardBounds.width).toBe(480);
        expect((await panel.boundingBox())?.width).toBe(width / 2);
        await expect(panel.getByRole("listitem")).toHaveText(["Membros", "Congregações", "Financeiro"]);
      } else {
        await expect(panel).toBeHidden();
        expect(cardBounds.x + cardBounds.width).toBeLessThanOrEqual(width);
      }
    }
  });
}

test("voltar da recuperação mantém o rótulo associado ao e-mail do formulário ativo", async ({ page }) => {
  await page.goto("/login");
  await page.getByRole("link", { name: "Esqueci minha senha" }).click();
  await page.getByText("E-mail", { exact: true }).filter({ visible: true }).click();
  await expect(page.getByRole("textbox", { name: "E-mail", exact: true })).toBeFocused();
  await page.getByRole("link", { name: "Voltar para o login" }).click();
  await page.getByText("E-mail", { exact: true }).filter({ visible: true }).click();
  await expect(page.getByRole("textbox", { name: "E-mail", exact: true })).toBeFocused();
});

test("entrar e sair duas vezes mantém o login utilizável e a barra de navegação inativa", async ({ page }) => {
  const email = process.env.E2E_AUTH_EMAIL;
  const password = process.env.E2E_AUTH_PASSWORD;
  test.skip(!email || !password, "Requer uma conta administrativa de teste descartável.");
  await page.goto("/login");

  for (let cycle = 0; cycle < 2; cycle++) {
    await page.getByRole("textbox", { name: "E-mail", exact: true }).fill(email!);
    await page.locator("form").filter({ visible: true }).getByLabel("Senha", { exact: true }).fill(password!);
    await page.getByRole("button", { name: "Entrar no sistema" }).click();
    await expect(page.getByRole("heading", { name: "Dashboard", exact: true })).toBeVisible();
    await page.getByLabel("Menu do perfil", { exact: true }).filter({ visible: true }).click();
    await page.getByRole("button", { name: "Encerrar sessão" }).click();
    await expect(page.getByRole("heading", { name: "Acesse sua conta" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Entrar no sistema" })).toBeEnabled();
    await expect(page.locator(".app-navigation-progress")).toHaveAttribute("data-visible", "false");
    await expect(page).toHaveURL(/\/login$/);
  }
});
