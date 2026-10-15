import { test, expect } from "@playwright/test";
import { readFileSync, writeFileSync } from "node:fs";
import { PDFDocument } from "pdf-lib";
test.use({ channel: "chromium" });
test.beforeEach(() =>
  test.skip(!process.env.E2E_FINANCE_FIXTURE, "Local finance fixture required"),
);
for (const mode of ["SINGLE", "ATTENDANCE"] as const) {
  test(`collective description is early, unique and saved in ${mode}`, async ({
    page,
  }) => {
    const f = JSON.parse(
      readFileSync(process.env.E2E_FINANCE_FIXTURE!, "utf8"),
    );
    await page.goto(
      `/financeiro/${mode === "SINGLE" ? "lancamentos" : "atendimento"}?unidade=${f.unitId}&mes=2026-10`,
    );
    if (mode === "SINGLE")
      await page
        .getByRole("button", { name: "Nova entrada", exact: true })
        .click();
    const form =
      mode === "SINGLE"
        ? page.getByRole("dialog")
        : page.locator(".finance-attendance-form");
    const identification = form.getByRole("combobox", {
      name: "Identificação",
      exact: true,
    });
    await identification.selectOption("COLLECTIVE");
    const description = form.getByLabel("Descrição da contribuição", {
      exact: true,
    });
    await expect(description).toBeVisible();
    const a = await description.boundingBox(),
      b = await form.getByLabel("Data", { exact: true }).boundingBox();
    expect(a!.y).toBeLessThan(b!.y);
    await expect(description).not.toHaveAttribute("required");
    const label = `Oferta do culto de ensino ${mode} ${Date.now()}`;
    await description.fill(label);
    await identification.selectOption("UNREGISTERED");
    await form
      .locator("summary")
      .filter({ hasText: "Documento, descrição" })
      .click();
    await expect(form.getByLabel("Descrição", { exact: true })).toHaveValue(
      label,
    );
    await identification.selectOption("COLLECTIVE");
    await expect(description).toHaveValue(label);
    await expect(form.getByLabel("Descrição", { exact: true })).toHaveCount(0);
    await form.getByLabel("Data", { exact: true }).fill("2026-10-14");
    await form
      .getByRole("combobox", { name: "Caixa ou conta", exact: true })
      .selectOption(f.boxes[f.unitId].cash);
    await form
      .getByRole("combobox", { name: "Categoria", exact: true })
      .selectOption(f.offeringId);
    await form.getByLabel("Valor (R$)", { exact: true }).fill("15,00");
    if (mode === "ATTENDANCE") {
      await form
        .getByRole("button", { name: "Adicionar contribuição" })
        .click();
      await form
        .getByLabel("Descrição da contribuição 2", { exact: true })
        .fill(`${label} missões`);
      await form
        .getByRole("combobox", { name: "Categoria", exact: true })
        .nth(1)
        .selectOption(f.missionsOfferingId);
      await form.getByLabel("Valor (R$)", { exact: true }).nth(1).fill("5,00");
    }
    await page.screenshot({
      path: `tmp/reports/collective-${mode}.png`,
      fullPage: true,
    });
    await form
      .getByRole("button", {
        name:
          mode === "SINGLE" ? "Salvar e continuar" : "Confirmar atendimento",
        exact: true,
      })
      .click();
    await expect(
      form.getByText(
        mode === "SINGLE"
          ? "Lançamento confirmado."
          : "Atendimento confirmado.",
        { exact: false },
      ),
    ).toBeVisible();
    await identification.selectOption("COLLECTIVE");
    await expect(description).toHaveValue("");
    // Reload persisted records through the authorized endpoint, not the submitted payload.
    const response = await page.request.post("/api/finance/reports/pdf", {
      data: { congregationId: f.unitId, type: "ANALYTIC", month: "2026-10" },
    });
    expect(response.status()).toBe(200);
    const bytes = await response.body();
    writeFileSync(`tmp/reports/collective-${mode}.pdf`, bytes);
    const pdf = await PDFDocument.load(bytes);
    expect(pdf.getPageCount()).toBeGreaterThan(0);
    // Verify descriptions in the persisted transaction details as well as a valid PDF.
    await page.goto(`/financeiro/lancamentos?unidade=${f.unitId}&mes=2026-10`);
    await expect(page.getByRole("table").getByText(label, { exact: true })).toBeVisible();
    if (mode === "ATTENDANCE")
      await expect(
        page.getByRole("table").getByText(`${label} missões`, { exact: true }),
      ).toBeVisible();
  });
}
