import { expect, test, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
const fixture = process.env.E2E_MEMBER_REPORT_FIXTURE
  ? JSON.parse(readFileSync(process.env.E2E_MEMBER_REPORT_FIXTURE, "utf8"))
  : null;
async function openFinance(page: Page) {
  await page.goto("/membros");
  await page
    .getByRole("button", { name: "Ver ficha", exact: true })
    .nth(1)
    .click();
  const dialog = page.getByRole("dialog", {
    name: "Ficha do membro",
    exact: true,
  });
  await expect(
    dialog.getByRole("heading", { name: "Membro de Teste 02", exact: true }),
  ).toBeVisible();
  await dialog.getByRole("button", { name: "Financeiro", exact: true }).click();
  await expect(
    dialog.getByRole("button", { name: "Imprimir extrato", exact: true }),
  ).toBeEnabled();
  return dialog;
}
test.describe("extrato térmico do contribuinte", () => {
  test.skip(
    !fixture || !process.env.E2E_STORAGE_STATE,
    "Requer fixtures fictícias locais de member-visual-local.",
  );
  test("inclui apenas entradas confirmadas de todas as páginas e cabe nas duas bobinas", async ({
    page,
  }, info) => {
    const finance = await openFinance(page);
    await finance
      .getByRole("button", { name: "Imprimir extrato", exact: true })
      .click();
    const modal = page.getByRole("dialog", {
      name: "Extrato do contribuinte",
      exact: true,
    });
    const preview = page.frameLocator(
      'iframe[title="Prévia do extrato térmico"]',
    );
    await expect(preview.locator(".item")).toHaveCount(24);
    await expect(preview.locator(".totals")).toContainText("240,00");
    await expect(preview.locator("article")).not.toContainText("1.000,00");
    await expect(preview.locator("article")).not.toContainText("2.000,00");
    await expect(preview.locator("article")).not.toContainText("3.000,00");
    for (const width of [80, 58]) {
      await modal
        .getByRole("combobox", { name: "Largura do papel" })
        .selectOption(String(width));
      await expect(
        modal.getByRole("button", { name: "Imprimir", exact: true }),
      ).toBeEnabled();
      await expect(preview.locator(".item")).toHaveCount(24);
      await preview.locator(".identity strong").evaluate((el) => {
        el.textContent = "Nome de contribuinte com sobrenomes extensos ".repeat(
          4,
        );
      });
      await preview
        .locator(".category")
        .first()
        .evaluate((el) => {
          el.textContent = "Categoria com nome muito extenso ".repeat(4);
        });
      await page.emulateMedia({ media: "print" });
      const size = await preview
        .locator("article")
        .evaluate((el) => ({
          width: el.getBoundingClientRect().width,
          scroll: el.scrollWidth,
          client: el.clientWidth,
        }));
      expect(
        Math.abs(size.width - ((width === 58 ? 47 : 74) * 96) / 25.4),
      ).toBeLessThan(1);
      expect(size.scroll).toBeLessThanOrEqual(size.client);
      await page.emulateMedia({ media: "screen" });
      await modal
        .locator("iframe")
        .screenshot({ path: info.outputPath(`extrato-${width}.png`) });
    }
    await page.setViewportSize({ width: 390, height: 844 });
    await expect(
      modal.getByRole("button", { name: "Imprimir", exact: true }),
    ).toBeInViewport();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.screenshot({
      path: info.outputPath("extrato-mobile.png"),
      animations: "disabled",
    });
  });
  test("usa os filtros aplicados, revalida ao imprimir e recupera falhas sem impressão", async ({
    page,
  }, info) => {
    let prints = 0;
    await page.exposeFunction("captureThermalPrint", () => {
      prints++;
    });
    await page.addInitScript(() => {
      window.print = () => {
        void (
          window.parent as unknown as {
            captureThermalPrint: () => Promise<void>;
          }
        ).captureThermalPrint();
      };
    });
    const finance = await openFinance(page);
    await finance
      .getByRole("combobox", { name: "Categoria", exact: true })
      .selectOption(fixture.financeCategories.mission);
    await finance
      .getByLabel("Data inicial", { exact: true })
      .fill("2026-11-01");
    await finance.getByLabel("Data final", { exact: true }).fill("2026-11-01");
    await finance
      .getByRole("button", { name: "Aplicar filtros", exact: true })
      .click();
    await expect(finance.getByText(/22 lançamento\(s\)/)).toBeVisible();
    await finance
      .getByRole("combobox", { name: "Categoria", exact: true })
      .selectOption(fixture.financeCategories.other);
    await finance
      .getByRole("button", { name: "Imprimir extrato", exact: true })
      .click();
    const modal = page.getByRole("dialog", {
      name: "Extrato do contribuinte",
      exact: true,
    });
    const preview = page.frameLocator(
      'iframe[title="Prévia do extrato térmico"]',
    );
    await expect(preview.locator(".item")).toHaveCount(22);
    await expect(preview.locator(".filters")).toContainText(
      "Ofertas missionárias",
    );
    await expect(preview.locator(".totals")).toContainText("220,00");
    await page.route("**/api/members/finance/statement", async (route) => {
      if (route.request().postDataJSON().intent === "print")
        await route.fulfill({
          status: 403,
          contentType: "application/json",
          body: JSON.stringify({
            message: "Acesso indisponível para impressão.",
          }),
        });
      else await route.continue();
    });
    await modal.getByRole("button", { name: "Imprimir", exact: true }).click();
    await expect(modal.getByRole("alert")).toContainText("Acesso indisponível");
    expect(prints).toBe(0);
    await page.unroute("**/api/members/finance/statement");
    const requested = page.waitForRequest(
      (r) =>
        r.url().endsWith("/api/members/finance/statement") &&
        r.postDataJSON().intent === "print",
    );
    await modal.getByRole("button", { name: "Imprimir", exact: true }).click();
    expect((await requested).postDataJSON().filters).toEqual({
      categoryId: fixture.financeCategories.mission,
      dateFrom: "2026-11-01",
      dateTo: "2026-11-01",
    });
    await expect.poll(() => prints).toBe(1);
    await expect(
      modal.getByRole("button", { name: "Imprimir", exact: true }),
    ).toBeEnabled();
    await modal
      .locator("iframe")
      .screenshot({ path: info.outputPath("extrato-filtrado.png") });
    await modal.getByRole("button", { name: "Fechar", exact: true }).click();
    await expect(finance).toBeVisible();
  });
  test("protege igreja, categoria, permissões e apresenta resultado vazio", async ({
    request,
    playwright,
  }) => {
    const input = {
      memberId: fixture.members[1],
      filters: {},
      width: 58,
      intent: "preview",
    };
    for (const change of [
      { memberId: fixture.members[33] },
      { filters: { categoryId: fixture.financeCategories.foreign } },
    ])
      expect(
        (
          await request.post("/api/members/finance/statement", {
            data: { ...input, ...change },
          })
        ).status(),
      ).toBe(404);
    const viewer = await playwright.request.newContext({
      baseURL: process.env.E2E_BASE_URL,
      storageState: fixture.sessions.viewer,
    });
    try {
      expect(
        (
          await viewer.post("/api/members/finance/statement", { data: input })
        ).status(),
      ).toBe(403);
    } finally {
      await viewer.dispose();
    }
    const empty = await request.post("/api/members/finance/statement", {
      data: { ...input, filters: { dateFrom: "2026-11-03" } },
    });
    expect(empty.status()).toBe(200);
    expect(empty.headers()["cache-control"]).toBe("private, no-store");
    expect(await empty.text()).toContain("Nenhuma entrada confirmada");
  });
});
