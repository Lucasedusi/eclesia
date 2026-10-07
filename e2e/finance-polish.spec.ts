import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";
test.beforeEach(() =>
  test.skip(!process.env.E2E_FINANCE_FIXTURE, "Local fixture required"),
);
function fixture() {
  return JSON.parse(readFileSync(process.env.E2E_FINANCE_FIXTURE!, "utf8"));
}

test("attendance identifies first, masks currency and resets native validation", async ({
  page,
}) => {
  const f = fixture();
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto(`/financeiro/atendimento?unidade=${f.unitId}&mes=2026-10`);
  const name = page.getByRole("textbox", {
    name: "Nome para busca",
    exact: true,
  });
  const date = page.getByRole("textbox", { name: "Data", exact: true });
  expect((await name.boundingBox())!.y).toBeLessThan(
    (await date.boundingBox())!.y,
  );
  await name.fill("Pessoa Financeiro");
  await page
    .getByRole("button", { name: "Buscar pessoa", exact: true })
    .click();
  await page.getByRole("button", { name: /Pessoa Financeiro Teste/ }).click();
  await date.fill("2026-10-07");
  await page
    .getByRole("combobox", { name: "Caixa ou conta", exact: true })
    .selectOption(f.boxes[f.unitId].cash);
  await page
    .getByRole("combobox", { name: "Categoria", exact: true })
    .selectOption(f.titheId);
  const money = page.getByRole("textbox", { name: "Valor (R$)", exact: true });
  await money.fill("1234,5");
  await money.blur();
  await expect(money).toHaveValue("1.234,50");
  await page
    .getByRole("combobox", { name: "Classificação do dízimo", exact: true })
    .selectOption(f.classificationId);
  await page
    .getByRole("button", { name: "Salvar e continuar", exact: true })
    .click();
  await expect(
    page.getByText("Atendimento confirmado.", { exact: false }),
  ).toBeVisible();
  await expect(name).toHaveValue("");
  await expect(name).toBeFocused();
  await expect(page.locator("form :user-invalid")).toHaveCount(0);
  await expect(money).toHaveValue("");
  await page.screenshot({
    path: "tmp/finance-polish-attendance.png",
    fullPage: true,
  });
});

test("filter and detail loading have stable feedback and payment identification", async ({
  page,
}) => {
  const f = fixture();
  await page.goto(
    `/financeiro/lancamentos?unidade=${f.headquartersId}&mes=2026-10`,
  );
  await expect(
    page.getByRole("button", { name: /^Detalhes / }).first(),
  ).toBeVisible();
  await page.route("**/financeiro/lancamentos?**", async (route) => {
    if (route.request().method() === "GET" && route.request().headers().rsc)
      await new Promise((r) => setTimeout(r, 900));
    await route.continue();
  });
  await page.getByText("Mais filtros", { exact: true }).click();
  await page
    .getByRole("combobox", { name: "Situação", exact: true })
    .selectOption("CONFIRMED");
  await page.getByRole("button", { name: "Filtrar", exact: true }).click();
  await expect(
    page.getByRole("status", { name: "Carregando lançamentos" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Filtrar", exact: true }),
  ).toBeEnabled();
  const eye = page.getByRole("button", { name: /^Detalhes / }).first();
  const before = await eye.boundingBox();
  await page.route("**/financeiro/lancamentos?**", async (route) => {
    if (route.request().method() === "POST")
      await new Promise((r) => setTimeout(r, 700));
    await route.continue();
  });
  await eye.click();
  await expect(eye).toHaveAttribute("aria-busy", "true");
  expect((await eye.boundingBox())!.width).toBe(before!.width);
  await expect(
    page.getByRole("dialog", { name: "Detalhes do lançamento" }),
  ).toBeVisible();
  await expect(
    page.getByRole("dialog").getByText("Dinheiro", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("dialog").getByText("Caixa principal", { exact: true }),
  ).toBeVisible();
});

test("payment tiles are selectable by keyboard and bank cards expose bank data", async ({
  page,
}) => {
  const f = fixture();
  await page.goto(`/financeiro/caixas?unidade=${f.unitId}&mes=2026-10`);
  await page
    .getByRole("button", { name: "Novo caixa ou conta", exact: true })
    .click();
  const dialog = page.getByRole("dialog");
  await dialog
    .getByRole("combobox", { name: "Tipo", exact: true })
    .selectOption("BANK_ACCOUNT");
  const pix = dialog.getByRole("checkbox", { name: "Pix", exact: true });
  await pix.focus();
  await page.keyboard.press("Space");
  await expect(pix).toBeChecked();
  await dialog.screenshot({ path: "tmp/finance-polish-payment-tiles.png" });
  const boxName = `Conta revisão ${Date.now()}`;
  await dialog.getByLabel("Nome", { exact: true }).fill(boxName);
  await dialog.getByLabel("Banco", { exact: true }).fill("Banco de teste");
  await dialog.getByLabel("Agência", { exact: true }).fill("1234");
  await dialog.getByLabel("Conta", { exact: true }).fill("56789-0");
  await dialog.getByRole("button", { name: "Salvar cadastro" }).click();
  await expect(
    page.locator(".finance-bank-card").filter({ hasText: boxName }),
  ).toContainText("1234");
  await expect(
    page.locator(".finance-bank-card").filter({ hasText: boxName }),
  ).toContainText("56789-0");
  await page.screenshot({
    path: "tmp/finance-polish-cashboxes.png",
    fullPage: true,
  });
});

test("gross ceiling and fixed accountant are saved for the chosen congregation and period", async ({
  page,
}) => {
  const f = fixture();
  await page.goto(`/financeiro/configuracoes?unidade=${f.unitId}&mes=2031-01`);
  await page
    .getByRole("button", { name: "Regras do demonstrativo", exact: true })
    .click();
  await expect(
    page.getByText("Histórico de configurações", { exact: true }),
  ).toHaveCount(0);
  const cap = page.getByRole("textbox", {
    name: /Teto mensal da prebenda bruta/,
  });
  await cap.fill("4000");
  await cap.blur();
  await expect(cap).toHaveValue("4.000,00");
  const accountant = page
    .locator("fieldset")
    .filter({ has: page.locator('input[value="Contador"]') });
  await accountant
    .getByRole("textbox", { name: "Valor (R$)", exact: true })
    .fill("123,45");
  await page
    .getByRole("button", { name: "Salvar regras", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Salvar regras", exact: true }),
  ).toBeEnabled();
  await expect(
    page.getByRole("alert").filter({ hasText: /Confira|erro/i }),
  ).toHaveCount(0);
  await expect(page.locator(".finance-progress")).toHaveCount(0);
  await page.reload();
  await page
    .getByRole("button", { name: "Regras do demonstrativo", exact: true })
    .click();
  await expect(cap).toHaveValue("4.000,00");
  await expect(
    accountant.getByRole("textbox", { name: "Valor (R$)", exact: true }),
  ).toHaveValue("123,45");
  await page.goto(
    `/financeiro/configuracoes?unidade=${f.headquartersId}&mes=2031-01`,
  );
  await page
    .getByRole("button", { name: "Regras do demonstrativo", exact: true })
    .click();
  await expect(cap).toHaveValue("1.000.000,00");
  await expect(
    accountant.getByRole("textbox", { name: "Valor (R$)", exact: true }),
  ).toHaveValue("150,00");
});
