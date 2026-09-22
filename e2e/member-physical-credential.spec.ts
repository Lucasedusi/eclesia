import { expect, test } from "@playwright/test";

const memberCode = process.env.E2E_CREDENTIAL_MEMBER_CODE;

test.describe("credencial física de membro", () => {
  test.skip(
    !process.env.E2E_STORAGE_STATE || !memberCode,
    "Requer sessão e membro de teste autorizados",
  );

  test("vira a credencial e baixa os formatos A4 e PVC", async ({ page }) => {
    await page.goto(`/membros?search=${encodeURIComponent(memberCode!)}`);
    await page.getByRole("button", { name: "Ver ficha" }).first().click();
    await page.getByRole("button", { name: "Gerar credencial" }).click();

    const showBack = page.getByRole("button", {
      name: "Mostrar verso da credencial",
    });
    await expect(showBack).toBeVisible();
    await expect(page.getByText("Clique para ver o verso")).toBeVisible();

    await showBack.click();
    const showFront = page.getByRole("button", {
      name: "Mostrar frente da credencial",
    });
    await expect(showFront).toBeVisible();
    await expect(page.getByText("Clique para ver a frente")).toBeVisible();

    await showFront.press("Enter");
    await expect(
      page.getByRole("button", { name: "Mostrar verso da credencial" }),
    ).toBeVisible();

    const download = page.waitForEvent("download");
    await page.getByRole("button", { name: "Imprimir e dobrar (A4)" }).click();
    expect((await download).suggestedFilename()).toMatch(
      /^credencial-[A-Za-z0-9_-]+\.pdf$/,
    );
    const pvcDownload = page.waitForEvent("download");
    await page.getByRole("button", { name: "PDF para gráfica/PVC" }).click();
    expect((await pvcDownload).suggestedFilename()).toMatch(
      /^credencial-[A-Za-z0-9_-]+-pvc\.pdf$/,
    );
  });
});
