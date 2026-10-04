import { test, expect } from "@playwright/test";
test("workspace has financial navigation and a scoped portal", async ({
  page,
}) => {
  test.skip(
    !process.env.E2E_STORAGE_STATE,
    "Requires local authenticated fixture",
  );
  await page.goto("/financeiro");
  await expect(
    page.getByRole("navigation", { name: "Navegação financeira" }),
  ).toBeVisible();
  await expect(page.locator("#finance-modal-root")).toHaveCount(1);
  await expect(page.getByLabel("Congregação")).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Voltar ao sistema" }),
  ).toHaveAttribute("href", "/");
});
