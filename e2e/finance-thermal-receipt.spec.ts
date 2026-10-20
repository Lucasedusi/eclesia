import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";

test.beforeEach(() => {
  test.skip(!process.env.E2E_STORAGE_STATE || !process.env.E2E_FINANCE_FIXTURE,
    "Requires authenticated local financial fixture");
});

test("thermal receipt preserves registration time and fits both paper widths", async ({ page }) => {
  const f = JSON.parse(readFileSync(process.env.E2E_FINANCE_FIXTURE!, "utf8"));
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`/financeiro/atendimento?unidade=${f.unitId}&mes=2026-10`);
  await page.getByRole("combobox", { name: "Caixa ou conta" }).selectOption(f.boxes[f.unitId].cash);
  await page.getByRole("combobox", { name: "Identificação" }).selectOption("UNREGISTERED");
  await page.getByRole("textbox", { name: "Nome da pessoa" }).fill("Maria Aparecida dos Santos Oliveira — pessoa fictícia");
  await page.getByLabel("Data", { exact: true }).fill("2026-10-15");
  await page.getByRole("combobox", { name: "Categoria" }).selectOption(f.offeringId);
  await page.getByLabel("Valor (R$)").fill("123456");
  await page.getByRole("button", { name: "Salvar", exact: true }).click();
  const link = page.getByRole("link", { name: "Comprovante", exact: true });
  await expect(link).toBeVisible();
  await page.goto((await link.getAttribute("href"))!);
  const receipt = page.locator(".financial-receipt");
  const header = receipt.locator("header");
  await expect(header).not.toContainText(/eclesias/i);
  await expect(header.getByRole("heading")).not.toBeEmpty();
  await expect(receipt.locator("footer")).toContainText("Eclesias");
  await expect(receipt.locator("footer")).toContainText("Obrigado por sua contribuição.");
  await expect(receipt).toContainText("Nome: Maria Aparecida");
  await expect(receipt.locator("time").first()).toHaveText("15/10/2026");
  const registered = receipt.locator("time").nth(1);
  await expect(registered).toHaveText(/\d{2}\/\d{2}\/\d{4} às \d{2}:\d{2}/);
  const timestamp = await registered.getAttribute("datetime");
  const text = await registered.innerText();
  const name = await header.getByRole("heading").innerText();
  const logo = header.getByRole("img", { name: "Logo da igreja" });
  if (f.receiptHeader) {
    await expect(header.getByRole("heading")).toHaveText(f.receiptHeader.churchName);
    await expect(header.locator("address")).toContainText(f.receiptHeader.address);
    await expect(logo).toBeVisible();
    await expect(logo).toHaveCSS("filter", "grayscale(1) contrast(1.2)");
  }
  for (const mm of [58, 80]) {
    await page.getByRole("combobox", { name: "Largura do papel" }).selectOption(String(mm));
    await page.emulateMedia({ media: "print" });
    await page.evaluate(async () => {
      await document.fonts.ready;
      await Promise.all(Array.from(document.querySelectorAll(".financial-receipt img")).map((img) =>
        (img as HTMLImageElement).decode()));
    });
    const bounds = (await receipt.boundingBox())!;
    expect(Math.abs(bounds.width - (mm - 6) * 96 / 25.4)).toBeLessThan(1);
    const overflow = await receipt.evaluate((el) => {
      const bounds = el.getBoundingClientRect();
      return Array.from(el.querySelectorAll("*")).some((child) => {
        const rect = child.getBoundingClientRect();
        return rect.width > 0 && (rect.left < bounds.left - 1 || rect.right > bounds.right + 1);
      });
    });
    expect(overflow).toBe(false);
    await receipt.screenshot({ path: test.info().outputPath(`receipt-${mm}.png`) });
    await page.pdf({
      path: test.info().outputPath(`receipt-${mm}.pdf`),
      width: `${mm}mm`,
      height: `${Math.ceil(bounds.height * 25.4 / 96 + 8)}mm`,
      printBackground: true,
      margin: { top: "3mm", bottom: "3mm", left: "3mm", right: "3mm" },
    });
    await page.emulateMedia({ media: "screen" });
  }
  await page.evaluate(() => { window.print = () => { document.body.dataset.printRequested = "true"; }; });
  await page.getByRole("button", { name: "Imprimir comprovante" }).click();
  await expect(page.locator("body")).toHaveAttribute("data-print-requested", "true");
  await page.reload();
  await expect(registered).toHaveAttribute("datetime", timestamp!);
  await expect(registered).toHaveText(text);
  await expect(header.getByRole("heading")).toHaveText(name);
  await page.setViewportSize({ width: 1440, height: 1000 });
  await expect(receipt).toContainText("Nome: Maria Aparecida");
});
