import { test, expect } from "@playwright/test";
test("admin creates categories and classifications", async ({ page }) => {
  test.skip(
    !process.env.E2E_FINANCE_FIXTURE,
    "Local financial fixture required",
  );
  await page.goto("/financeiro/configuracoes");
  await page.getByRole("button", { name: "Categorias", exact: true }).click();
  await page.getByRole("button", { name: "Novo cadastro" }).click();
  const name = `Oferta teste ${Date.now()}`;
  await page.getByLabel("Nome", { exact: true }).fill(name);
  await page.getByRole("button", { name: "Salvar cadastro" }).click();
  await expect(page.getByText(name, { exact: true })).toBeVisible();
  await page
    .getByRole("button", { name: "Classificações", exact: true })
    .click();
  await page.getByRole("button", { name: "Novo cadastro" }).click();
  await page
    .getByLabel("Nome", { exact: true })
    .fill(`Diácono teste ${Date.now()}`);
  await page.getByRole("button", { name: "Salvar cadastro" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
});

test("admin assigns an operational congregation within regional scope", async ({
  page,
}) => {
  test.skip(!process.env.E2E_FINANCE_FIXTURE, "Local fixture required");
  await page.goto("/financeiro/configuracoes");
  await expect(page.getByRole("button", { name: "Operadores", exact: true })).toHaveCount(0);
  await page.goto("/usuarios");
  const access = page.locator("article").filter({ hasText: "Region A" }).filter({ has: page.getByRole("button", { name: "Editar acesso" }) });
  await access.getByRole("button", { name: "Editar acesso" }).click();
  const unit = access.getByRole("combobox", { name: "Congregação de operação", exact: true });
  await expect(unit).toBeVisible();
  await expect(unit.locator("option")).toHaveCount(2);
  const originalOperation = await unit.inputValue();
  try {
    await unit.selectOption({ label: "Unit A" });
    await access.getByRole("button", { name: "Salvar operação financeira", exact: true }).click();
    await expect(access.getByRole("status")).toContainText("Congregação de operação atualizada.");
    await page.reload();
    await access.getByRole("button", { name: "Editar acesso" }).click();
    await expect(unit.locator("option:checked")).toHaveText("Unit A");
    await access.getByRole("combobox", { name: "Escopo", exact: true }).selectOption("CHURCH");
    await expect(unit).toBeDisabled();
    await expect(access.getByRole("button", { name: "Salvar operação financeira" })).toBeDisabled();
  } finally {
    // This regional user is also the read-only mobile fixture until assigned.
    await page.reload();
    await access.getByRole("button", { name: "Editar acesso" }).click();
    await unit.selectOption(originalOperation);
    await access.getByRole("button", { name: "Salvar operação financeira", exact: true }).click();
    await expect(access.getByRole("status")).toContainText("Congregação de operação atualizada.");
    await page.reload();
    await access.getByRole("button", { name: "Editar acesso" }).click();
    await expect(unit).toHaveValue(originalOperation);
  }
});

test("category mapping for informative reports persists independently of its name", async ({ page }) => {
  test.skip(!process.env.E2E_FINANCE_FIXTURE, "Local financial fixture required");
  const name = `Repasse configurado ${Date.now()}`;
  await page.goto("/financeiro/configuracoes");
  await page.getByRole("button", { name: "Categorias", exact: true }).click();
  await page.getByRole("button", { name: "Novo cadastro" }).click();
  await page.getByLabel("Nome", { exact: true }).fill(name);
  await page.getByRole("combobox", { name: "Natureza", exact: true }).selectOption("BOTH");
  await page.getByRole("combobox", { name: "Uso nos informativos", exact: true }).selectOption("TRANSFER");
  await page.getByRole("button", { name: "Salvar cadastro" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.getByRole("button", { name: `Editar ${name}`, exact: true }).click();
  await expect(page.getByRole("combobox", { name: "Uso nos informativos", exact: true })).toHaveValue("TRANSFER");
  await page.getByLabel("Nome", { exact: true }).fill(`${name} renomeado`);
  await page.getByRole("button", { name: "Salvar cadastro" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.reload();
  await page.getByRole("button", { name: "Categorias", exact: true }).click();
  await page.getByRole("button", { name: `Editar ${name} renomeado`, exact: true }).click();
  await expect(page.getByRole("combobox", { name: "Uso nos informativos", exact: true })).toHaveValue("TRANSFER");
  await page.screenshot({ path: "tmp/reports/category-informative-role.png", fullPage: true, animations: "disabled" });
});
