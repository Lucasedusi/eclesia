import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";

test.use({ serviceWorkers: "block" });
test.beforeEach(() =>
  test.skip(
    !process.env.E2E_FINANCE_FIXTURE || !process.env.E2E_STORAGE_STATE,
    "Requires local finance fixtures",
  ),
);

for (const width of [390, 1280]) {
  test.describe(`finance pickers at ${width}px`, () => {
    test.use({ viewport: { width, height: 844 }, hasTouch: width === 390 });
    test("entry supports the styled options, typed dates and calendar keyboard navigation", async ({
      page,
    }) => {
      const { unitId } = JSON.parse(
        readFileSync(process.env.E2E_FINANCE_FIXTURE!, "utf8"),
      );
      await page.goto(`/financeiro/lancamentos?unidade=${unitId}&mes=2026-10`);
      await page
        .getByRole("button", {
          name: width === 390 ? "Entrada" : "Nova entrada",
          exact: true,
        })
        .click();
      const form = page.getByRole("dialog", { name: "Nova entrada" });
      const kind = form.getByRole("combobox", { name: "Buscar por" });
      if (width === 390) await kind.tap();
      else await kind.press("ArrowDown");
      const list = form.getByRole("listbox", { name: "Buscar por" });
      await expect(list).toBeVisible();
      await list.press("ArrowDown");
      await list.press("Enter");
      await expect(kind).toHaveValue("CPF");
      await expect(kind).toBeFocused();
      await kind.click();
      await expect(list.getByRole("option", { name: "CPF" })).toHaveAttribute(
        "aria-selected",
        "true",
      );
      await list.press("Escape");
      await expect(form).toBeVisible();

      const date = form.getByLabel("Data", { exact: true });
      await date.fill("31/02/2028");
      expect(
        await date.evaluate((input) =>
          (input as HTMLInputElement).checkValidity(),
        ),
      ).toBe(false);
      await date.fill("28/02/2028");
      await expect(form.getByLabel("Mês de referência")).toHaveValue("2028-02");
      const trigger = form.getByRole("button", {
        name: "Abrir calendário de data",
      });
      if (width === 390) await trigger.tap();
      else await trigger.click();
      const calendar = form.getByRole("dialog", { name: "Escolher data" });
      const day = calendar.getByRole("button", {
        name: /28 de fevereiro de 2028/,
      });
      await expect(day).toBeVisible();
      await day.press("ArrowRight");
      await page.keyboard.press("Enter");
      await expect(date).toHaveValue("29/02/2028");
      await expect(trigger).toBeFocused();
      await trigger.click();
      await calendar
        .getByRole("button", { name: /29 de fevereiro de 2028/ })
        .press("Escape");
      await expect(calendar).toHaveCount(0);
      await expect(form).toBeVisible();
    });

    test("period applies two calendar dates only after confirmation", async ({
      page,
    }) => {
      const { unitId } = JSON.parse(
        readFileSync(process.env.E2E_FINANCE_FIXTURE!, "utf8"),
      );
      const url = `/financeiro/lancamentos?unidade=${unitId}&mes=2026-10&dateFrom=2026-10-01&dateTo=2026-10-02`;
      await page.goto(url);
      const trigger = page.getByRole("button", { name: /^Período:/ });
      await trigger.click();
      const dialog = page.getByRole("dialog", {
        name: "Período dos lançamentos",
      });
      await expect(dialog.getByRole("grid")).toHaveCount(width === 390 ? 1 : 2);
      await dialog
        .getByRole("button", { name: /30 de outubro de 2026/ })
        .click();
      await expect(
        dialog.getByRole("button", { name: "Aplicar" }),
      ).toBeDisabled();
      if (width === 390)
        await dialog.getByRole("button", { name: "Próximo mês" }).click();
      await dialog
        .getByRole("button", { name: /, 2 de novembro de 2026/ })
        .click();
      await expect(dialog.getByLabel("Data final")).toHaveValue("02/11/2026");
      await expect(page).toHaveURL(new RegExp("dateTo=2026-10-02"));
      await dialog.getByRole("button", { name: "Aplicar" }).click();
      await expect(page).toHaveURL(/dateFrom=2026-10-30/);
      await expect(page).toHaveURL(/dateTo=2026-11-02/);
      await trigger.click();
      await dialog
        .getByRole("button", { name: /31 de outubro de 2026/ })
        .click();
      await dialog.getByRole("button", { name: "Fechar modal" }).click();
      await expect(trigger).toContainText("30/10 a 02/11/2026");
    });
  });
}

test("long category lists support accent-insensitive local search and selection", async ({
  page,
}) => {
  const { unitId } = JSON.parse(
    readFileSync(process.env.E2E_FINANCE_FIXTURE!, "utf8"),
  );
  const context = `?unidade=${unitId}&mes=2026-10`;
  await page.goto("/financeiro/atendimento" + context);
  const category = page.getByRole("combobox", {
    name: "Categoria",
    exact: true,
  });
  const initial = await category.locator("option").count();
  await page.goto("/financeiro/configuracoes" + context);
  await page.getByRole("button", { name: "Categorias", exact: true }).click();
  const prefix = "Doação piloto " + Date.now();
  for (let i = 0; i < Math.max(1, 9 - initial); i++) {
    await page.getByRole("button", { name: "Novo cadastro" }).click();
    const form = page.getByRole("dialog");
    await form.getByLabel("Nome", { exact: true }).fill(prefix + " " + i);
    await form.getByLabel("Natureza").selectOption("INCOME");
    await form.getByRole("button", { name: "Salvar cadastro" }).click();
    await expect(form).toHaveCount(0);
  }
  await page.goto("/financeiro/atendimento" + context);
  await category.click();
  const search = page.getByRole("combobox", { name: "Buscar em Categoria" });
  await search.fill("sem correspondência");
  await expect(
    page.getByRole("status").filter({ hasText: "Nenhuma opção encontrada." }),
  ).toBeVisible();
  await search.fill(prefix.replace("Doação", "doacao") + " 0");
  await expect(page.getByRole("listbox").getByRole("option")).toHaveCount(1);
  await search.press("Enter");
  await expect(category.locator("option:checked")).toHaveText(prefix + " 0");
});

test("Escape during calendar loading returns to the entry", async ({
  page,
}) => {
  const { unitId } = JSON.parse(
    readFileSync(process.env.E2E_FINANCE_FIXTURE!, "utf8"),
  );
  await page.goto(`/financeiro/lancamentos?unidade=${unitId}&mes=2026-10`);
  await page.getByRole("button", { name: "Nova entrada", exact: true }).click();
  const entry = page.getByRole("dialog", { name: "Nova entrada" });
  const trigger = entry.getByRole("button", {
    name: "Abrir calendário de data",
  });
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route("**/_next/static/chunks/*.js*", async (route) => {
    await gate;
    await route.continue();
  });
  try {
    await trigger.click();
    await expect(entry.getByText("Abrindo calendário…")).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(trigger).toBeFocused();
    await expect(
      entry.getByRole("dialog", { name: "Escolher data" }),
    ).toHaveCount(0);
  } finally {
    release();
  }
});
