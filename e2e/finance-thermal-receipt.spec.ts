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
  await expect(receipt).toContainText("Maria Aparecida");
  await expect(receipt.locator("time").first()).toHaveText("15/10/2026");
  const registered = receipt.locator("time").nth(1);
  await expect(registered).toHaveText(/^\d{2}:\d{2}$/);
  await expect(receipt).toContainText(/Data: 15\/10\/2026 às \d{2}:\d{2}/);
  await expect(receipt).not.toContainText("Registrado em:");
  const timestamp = await registered.getAttribute("datetime");
  const text = await registered.innerText();
  const name = await header.getByRole("heading").innerText();
  const logo = header.getByRole("img", { name: "Logo da igreja" });
  if (f.receiptHeader) {
    await expect(header.getByRole("heading")).toHaveText(f.receiptHeader.churchName);
    await expect(receipt.locator("footer address")).toContainText(f.receiptHeader.address);
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
    // A driver may report A4 even for a thermal roll. Never center the receipt
    // across that wider page, outside the printer's left-hand printable strip.
    await page.setViewportSize({ width: 794, height: 1123 });
    const bounds = (await receipt.boundingBox())!;
    const mainBounds = (await page.locator(".finance-main").boundingBox())!;
    expect(Math.abs(bounds.x - mainBounds.x)).toBeLessThan(1);
    // A 58 mm roll only has 48 mm of printable width on the tested printer.
    expect(Math.abs(bounds.width - (mm === 58 ? 47 : 74) * 96 / 25.4)).toBeLessThan(1);
    const sideMargins = await page.evaluate(() => {
      for (const sheet of Array.from(document.styleSheets)) {
        for (const rule of Array.from(sheet.cssRules)) {
          if (!(rule instanceof CSSMediaRule) || rule.conditionText !== "print") continue;
          for (const pageRule of Array.from(rule.cssRules)) {
            if (pageRule instanceof CSSPageRule) {
              return [pageRule.style.marginLeft, pageRule.style.marginRight];
            }
          }
        }
      }
      return [];
    });
    expect(sideMargins).toEqual(mm === 58 ? ["5mm", "6mm"] : ["3mm", "3mm"]);
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
    });
    if (mm === 58) {
      await page.pdf({
        path: test.info().outputPath("receipt-58-a4-driver.pdf"),
        format: "A4",
        printBackground: true,
      });
    }
    await page.emulateMedia({ media: "screen" });
    await page.setViewportSize({ width: 390, height: 844 });
  }
  await page.evaluate(() => { window.print = () => { document.body.dataset.printRequested = "true"; }; });
  await page.getByRole("button", { name: "Imprimir comprovante" }).click();
  await expect(page.locator("body")).toHaveAttribute("data-print-requested", "true");
  await page.reload();
  await expect(registered).toHaveAttribute("datetime", timestamp!);
  await expect(registered).toHaveText(text);
  await expect(header.getByRole("heading")).toHaveText(name);
  await page.setViewportSize({ width: 1440, height: 1000 });
  await expect(receipt).toContainText("Maria Aparecida");
});
