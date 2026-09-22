import { expect, test } from "@playwright/test";

const memberCode = process.env.E2E_CREDENTIAL_MEMBER_CODE;

test.describe("credencial física de membro", () => {
  test.skip(
    !process.env.E2E_STORAGE_STATE || !memberCode,
    "Requer sessão e membro de teste autorizados",
  );

  test("pré-visualiza frente e verso e baixa PDF", async ({ page }) => {
    await page.goto(`/membros?search=${encodeURIComponent(memberCode!)}`);
    await page.getByRole("button", { name: "Ver ficha" }).first().click();
    await page.getByRole("button", { name: "Gerar credencial" }).click();

    await expect(page.getByLabel("Frente da credencial")).toBeVisible();
    await expect(page.getByLabel("Verso da credencial")).toBeVisible();

    const download = page.waitForEvent("download");
    await page.getByRole("button", { name: "Baixar PDF" }).click();
    expect((await download).suggestedFilename()).toMatch(
      /^credencial-[A-Za-z0-9_-]+\.pdf$/,
    );
  });
});
