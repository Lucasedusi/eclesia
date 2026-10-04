import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";
test("continuous entry preserves defaults, then supports correction and cancellation", async ({
  page,
}) => {
  test.skip(!process.env.E2E_FINANCE_FIXTURE, "Local fixture required");
  const f = JSON.parse(readFileSync(process.env.E2E_FINANCE_FIXTURE!, "utf8")),
    name = `Visitante ${Date.now()}`;
  await page.goto(`/financeiro/lancamentos?unidade=${f.unitId}&mes=2026-10`);
  await page.getByRole("button", { name: "Nova entrada", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Data", { exact: true }).fill("2026-10-04");
  await dialog
    .getByRole("combobox", { name: "Caixa ou conta", exact: true })
    .selectOption(f.boxes[f.unitId].cash);
  await dialog
    .getByRole("combobox", { name: "Identificação", exact: true })
    .selectOption("UNREGISTERED");
  await dialog.getByLabel("Nome da pessoa", { exact: true }).fill(name);
  await dialog
    .getByRole("combobox", { name: "Categoria", exact: true })
    .selectOption(f.offeringId);
  await dialog.getByLabel("Valor (R$)", { exact: true }).fill("150,00");
  await dialog
    .getByRole("button", { name: "Salvar e continuar", exact: true })
    .click();
  await expect(dialog.getByRole("status")).toContainText("confirmado");
  await expect(
    dialog.getByRole("combobox", { name: "Categoria", exact: true }),
  ).toHaveValue(f.offeringId);
  await expect(dialog.getByLabel("Valor (R$)", { exact: true })).toHaveValue(
    "",
  );
  page.on("dialog", (d) => d.accept());
  await page.getByLabel("Fechar modal").click();
  await page.getByLabel("Buscar", { exact: true }).fill(name);
  await page.getByRole("button", { name: "Filtrar", exact: true }).click();
  await page
    .getByRole("button", {
      name: `Detalhes Oferta de culto ${name}`,
      exact: true,
    })
    .click();
  await page.getByRole("button", { name: "Corrigir", exact: true }).click();
  await page
    .getByRole("dialog")
    .getByLabel("Valor (R$)", { exact: true })
    .fill("100,00");
  await page
    .getByLabel("Justificativa da correção")
    .fill("Conferência do valor recebido");
  await page.getByRole("button", { name: "Salvar correção" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.getByRole("cell", { name: "+ R$ 100,00" })).toBeVisible();
  await page
    .getByRole("button", {
      name: `Detalhes Oferta de culto ${name}`,
      exact: true,
    })
    .click();
  await page
    .getByRole("button", { name: "Cancelar lançamento", exact: true })
    .click();
  await page
    .getByLabel("Justificativa", { exact: true })
    .fill("Registro de teste duplicado");
  await page.getByRole("button", { name: "Confirmar cancelamento" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.getByText("Cancelado", { exact: true })).toBeVisible();
});
