import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";
import { seedLegacyGroup } from "./finance-legacy-group";

test("old attendance bookmarks open the selected ledger; new entries accept one contribution", async ({
  page,
}) => {
  test.skip(!process.env.E2E_FINANCE_FIXTURE, "Local fixture required");
  const f = JSON.parse(readFileSync(process.env.E2E_FINANCE_FIXTURE!, "utf8"));
  const query = `?unidade=${f.unitId}&mes=2026-09`;
  await page.goto("/financeiro/atendimento" + query);
  await expect(page).toHaveURL(
    process.env.E2E_BASE_URL + "/financeiro/lancamentos" + query,
  );
  await expect(
    page
      .getByRole("navigation")
      .getByRole("link", { name: "Atendimento", exact: true }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "Nova entrada", exact: true }).click();
  const form = page.getByRole("dialog", { name: "Nova entrada" });
  await expect(form.getByLabel("Valor (R$)", { exact: true })).toBeVisible();
  await expect(
    form.getByRole("button", { name: "Adicionar contribuição" }),
  ).toHaveCount(0);
});

test("historical grouped receipts still print every contribution", async ({
  page,
}) => {
  test.skip(!process.env.E2E_FINANCE_FIXTURE, "Local fixture required");
  const f = JSON.parse(readFileSync(process.env.E2E_FINANCE_FIXTURE!, "utf8"));
  const receipt = await seedLegacyGroup("Comprovante histórico", "2026-10-04");
  await page.goto(
    `/financeiro/comprovantes/${receipt}?unidade=${f.unitId}&mes=2026-10`,
  );
  await expect(page.getByTestId("receipt-item")).toHaveCount(2);
  await expect(page.getByText("R$ 250,00", { exact: true })).toBeVisible();
  const paperControl = (await page
    .getByRole("combobox", { name: "Largura do papel", exact: true })
    .boundingBox())!;
  const printControl = (await page
    .getByRole("button", { name: "Imprimir comprovante" })
    .boundingBox())!;
  expect(paperControl.x + paperControl.width).toBeLessThanOrEqual(
    printControl.x,
  );
  expect(
    Math.abs(
      paperControl.y +
        paperControl.height -
        printControl.y -
        printControl.height,
    ),
  ).toBeLessThan(2);
  await page.screenshot({
    path: "tmp/finance-final-receipt-controls.png",
    fullPage: true,
  });
  await page.evaluate(() => {
    window.print = () => {};
  });
  await page.getByRole("button", { name: "Imprimir comprovante" }).click();
  await page
    .getByRole("combobox", { name: "Largura do papel", exact: true })
    .selectOption("58");
  await page.getByRole("button", { name: "Imprimir comprovante" }).click();
  await expect(page.getByTestId("receipt-item")).toHaveCount(2);
  for (const paper of [80, 58]) {
    await page
      .getByRole("combobox", { name: "Largura do papel", exact: true })
      .selectOption(String(paper));
    await page.emulateMedia({ media: "print" });
    const receipt = page.locator(".financial-receipt");
    expect(await receipt.evaluate((e) => e.scrollWidth)).toBeLessThanOrEqual(
      Math.ceil(((paper === 58 ? 48 : 80) * 96) / 25.4) + 1,
    );
    await page.pdf({
      path: `tmp/finance-receipt-${paper}.pdf`,
      width: `${paper}mm`,
      height: "220mm",
      printBackground: false,
    });
    await receipt.screenshot({ path: `tmp/finance-receipt-${paper}.png` });
    await page.emulateMedia({ media: "screen" });
  }
});
