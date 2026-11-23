import { readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";

test("configura os códigos, baixa o CSV e confirma a importação", async ({
  page,
}) => {
  test.skip(
    !process.env.E2E_FINANCE_FIXTURE || !process.env.E2E_STORAGE_STATE,
    "Requer sessão financeira e dados fictícios locais.",
  );
  expect(new URL(process.env.E2E_BASE_URL!).hostname).toBe("127.0.0.1");
  const f = JSON.parse(readFileSync(process.env.E2E_FINANCE_FIXTURE!, "utf8"));
  const box = f.boxes[f.headquartersId].cash;
  await page.goto(
    `/financeiro/contabilidade?unidade=${f.headquartersId}&mes=2026-10&caixa=${box}`,
  );
  const generate = page.getByRole("button", { name: "Gerar CSV Alterdata" });
  await expect(
    page.getByRole("heading", { name: "Contabilidade", exact: true }),
  ).toBeVisible();
  await page.getByText("Configurar códigos contábeis", { exact: true }).click();
  const config = page.locator("details").filter({
    has: page.getByText("Configurar códigos contábeis", { exact: true }),
  });
  for (const [kind, id, value] of [
    ["CASHBOX", box, "45"],
    ["CATEGORY", f.offeringId, "1420"],
    ["CATEGORY", f.missionsOfferingId, "1435"],
  ]) {
    await config.getByLabel("Tipo de cadastro").selectOption(kind);
    await config.getByLabel("Cadastro", { exact: true }).selectOption(id);
    const code = config.getByLabel("Código Alterdata");
    if ((await code.inputValue()) !== value) {
      await code.fill(value);
      const save = config.getByRole("button", { name: "Salvar código" });
      await save.click();
      await expect(
        config
          .locator("option:checked")
          .filter({ hasText: new RegExp(" · " + value + "$") }),
      ).toHaveCount(1);
    }
  }
  const repeat = page.getByRole("checkbox", { name: /Incluir novamente/ });
  if (await repeat.isVisible()) await repeat.check();
  await expect(generate).toBeEnabled();
  const downloaded = page.waitForEvent("download");
  await generate.click();
  const file = await downloaded;
  const csv = readFileSync((await file.path())!, "latin1");
  expect(csv.split("\n")[0].split(";")).toHaveLength(10);
  expect(csv).toContain(";45;1420;");
  expect(csv).toContain(";45;1435;");
  const confirm = page.getByRole("button", { name: "Confirmar importação" });
  const confirmed = page.getByText("Importação confirmada", { exact: true });
  await expect(confirm.or(confirmed).first()).toBeVisible();
  if (await confirm.first().isVisible()) await confirm.first().click();
  await expect(
    page.getByText("Importação confirmada", { exact: true }).first(),
  ).toBeVisible();
});

test("oculta a Contabilidade do operador sem a permissão e protege o endereço direto", async ({
  browser,
}) => {
  test.skip(
    !process.env.E2E_FINANCE_FIXTURE || !process.env.E2E_STORAGE_STATE,
    "Requer sessões financeiras locais.",
  );
  expect(new URL(process.env.E2E_BASE_URL!).hostname).toBe("127.0.0.1");
  const f = JSON.parse(readFileSync(process.env.E2E_FINANCE_FIXTURE!, "utf8"));
  const ctx = await browser.newContext({
    storageState: process.env.E2E_STORAGE_STATE!.replace(
      "admin-session",
      "treasurer-session",
    ),
  });
  try {
    const page = await ctx.newPage();
    await page.goto(`/financeiro?unidade=${f.unitId}&mes=2026-10`);
    await expect(
      page.getByRole("link", { name: "Lançamentos", exact: true }).first(),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: "Contabilidade", exact: true }),
    ).toHaveCount(0);
    await page.goto(
      `/financeiro/contabilidade?unidade=${f.unitId}&mes=2026-10`,
    );
    await expect(
      page.getByRole("button", { name: "Gerar CSV Alterdata" }),
    ).toHaveCount(0);
    await expect(page).not.toHaveURL(/\/financeiro\/contabilidade/);
  } finally {
    await ctx.close();
  }
});
