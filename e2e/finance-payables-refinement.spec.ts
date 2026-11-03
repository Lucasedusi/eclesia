import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";

test("closing an untouched payable modal makes no route refresh", async ({ page }) => {
  test.skip(!process.env.E2E_FINANCE_FIXTURE, "Local fixture required");
  expect(process.env.E2E_BASE_URL).toBe("http://127.0.0.1:3217");
  const f = JSON.parse(readFileSync(process.env.E2E_FINANCE_FIXTURE!, "utf8"));
  await page.goto(`/financeiro/contas-a-pagar?unidade=${f.unitId}&mes=2026-10`);
  await page.getByRole("button", { name: "Nova conta", exact: true }).click();
  const requests: string[] = [];
  page.on("request", (request) => { if (request.url().includes("/financeiro/contas-a-pagar") && request.resourceType() === "fetch") requests.push(request.url()); });
  await page.getByRole("dialog", { name: "Nova conta" }).getByRole("button", { name: "Cancelar", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  // Observe a full second: catching an unwanted request requires a bounded quiet window.
  await page.waitForTimeout(1000);
  expect(requests).toEqual([]);
  await expect(page.getByRole("main")).toHaveAttribute("aria-busy", "false");
});

for (const width of [1280, 1024]) {
  test(`payable filters, details and stable tabs at ${width}px`, async ({ page }) => {
    test.setTimeout(90_000);
    test.skip(!process.env.E2E_FINANCE_FIXTURE, "Local fixture required");
    expect(process.env.E2E_BASE_URL).toBe("http://127.0.0.1:3217");
    const f = JSON.parse(readFileSync(process.env.E2E_FINANCE_FIXTURE!, "utf8"));
    const prefix = `Refinamento ${width} ${Date.now()}`;
    await page.setViewportSize({ width, height: 900 });
    await page.goto(`/financeiro/contas-a-pagar?unidade=${f.unitId}&mes=2026-10`);
    for (const suffix of ["Energia da administração com descrição longa para conferir a quebra", "Internet"]) {
      await page.getByRole("button", { name: "Nova conta", exact: true }).click();
      const form = page.getByRole("dialog", { name: "Nova conta" });
      await form.getByLabel("Nome da conta").fill(`${prefix} ${suffix}`);
      await form.getByRole("combobox", { name: "Categoria", exact: true }).selectOption(f.expenseId);
      await form.getByLabel("Vencimento", { exact: true }).fill("2026-10-10");
      await form.getByLabel("Valor (R$)").fill("235,90");
      await form.getByLabel("Observação").fill("Conferência visual com dados fictícios.");
      await form.getByRole("button", { name: "Salvar conta", exact: true }).click();
      await expect(form).toHaveCount(0);
    }
    await page.getByRole("searchbox").fill(prefix);
    const clear = page.getByRole("button", { name: "Limpar busca", exact: true });
    const searchBox = await page.getByRole("searchbox").boundingBox(), clearBox = await clear.boundingBox();
    expect(clearBox!.x + clearBox!.width).toBeGreaterThan(searchBox!.x + searchBox!.width - 8);
    await page.getByRole("button", { name: "Filtrar", exact: true }).click();
    await expect(page.getByRole("tab", { name: "A pagar (2)", exact: true })).toBeVisible();
    await expect(page.getByLabel("Vencimento de", { exact: true })).toHaveCount(0);
    await expect(page.getByLabel("Vencimento até", { exact: true })).toHaveCount(0);
    const name = `${prefix} Internet`;
    // A close must be quiet for every non-mutating dialog, not just creation.
    for (const kind of ["Detalhes", "Editar", "Excluir", "Pagar", "Copiar"] as const) {
      if (kind === "Copiar") await page.getByRole("button", { name: "Copiar para o próximo mês", exact: true }).click();
      else if (kind === "Pagar") await page.getByRole("button", { name: `Pagar: ${name}`, exact: true }).click();
      else if (kind === "Detalhes") await page.getByRole("button", { name: `Detalhes: ${name}`, exact: true }).click();
      else {
        await page.getByRole("button", { name: `Ações: ${name}`, exact: true }).click();
        await page.getByRole("button", { name: kind, exact: true }).click();
      }
      const modal = page.getByRole("dialog");
      await expect(modal).toBeVisible();
      if (kind === "Detalhes") {
        await expect(modal.getByRole("heading", { name, exact: true })).toBeVisible();
        await expect(modal.locator(".badge")).toHaveText("Em atraso");
        await expect(modal.getByText("Conta cadastrada", { exact: true })).toBeHidden();
        await modal.getByText("Histórico de alterações", { exact: false }).click();
        await expect(modal.getByText("Conta cadastrada", { exact: true })).toBeVisible();
        // Full-page capture can transiently resize Chromium to 1x1 and trigger the mobile access boundary.
        await page.screenshot({ path: `tmp/payables-refinement-details-${width}.png` });
      }
      const requests: string[] = [];
      const listener = (request: import("@playwright/test").Request) => { if (request.url().includes("/financeiro/contas-a-pagar") && request.resourceType() === "fetch") requests.push(request.url()); };
      page.on("request", listener);
      await modal.getByRole("button", { name: kind === "Detalhes" || kind === "Copiar" ? "Fechar" : "Cancelar", exact: true }).click();
      await expect(modal).toHaveCount(0);
      await page.waitForTimeout(300);
      page.off("request", listener);
      expect(requests, `closing ${kind}`).toEqual([]);
    }
    await page.getByRole("combobox", { name: "Situação", exact: true }).selectOption("OVERDUE");
    await page.getByRole("button", { name: "Filtrar", exact: true }).click();
    await expect(page).toHaveURL(/dueStatus=OVERDUE/);
    if (width > 767) {
      const payBox = await page.getByRole("button", { name: `Pagar: ${name}`, exact: true }).boundingBox();
      const menuBox = await page.getByRole("button", { name: `Ações: ${name}`, exact: true }).boundingBox();
      expect(Math.abs(payBox!.y - menuBox!.y), "actions should share the same line").toBeLessThan(1);
    }
    const columns = await page.locator(".finance-payable-table th").evaluateAll((els) => els.map((el) => ({ x: el.getBoundingClientRect().x, width: el.getBoundingClientRect().width })));
    const active = page.getByRole("tab", { name: "A pagar (2)", exact: true });
    await expect(active).toHaveCSS("background-color", "rgb(237, 245, 239)");
    await expect(active).toHaveCSS("color", "rgb(23, 99, 72)");
    await expect(active).toHaveCSS("font-weight", "500");
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path: `tmp/payables-refinement-list-${width}.png` });
    await page.getByRole("button", { name: `Pagar: ${name}`, exact: true }).click();
    await page.getByRole("dialog", { name: "Confirmar pagamento" }).getByRole("button", { name: "Confirmar pagamento", exact: true }).click();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await page.getByRole("tab", { name: /^Pagas/ }).click();
    await expect(page.getByRole("button", { name: `Detalhes: ${name}`, exact: true })).toBeVisible();
    await expect(page.getByRole("combobox", { name: "Situação", exact: true })).toBeDisabled();
    await expect(page.getByRole("combobox", { name: "Situação", exact: true })).toHaveValue("PAID");
    if (width > 767) {
      const paidColumns = await page.locator(".finance-payable-table th").evaluateAll((els) => els.map((el) => ({ x: el.getBoundingClientRect().x, width: el.getBoundingClientRect().width })));
      expect(paidColumns).toEqual(columns);
    }
    await page.getByRole("tab", { name: /^A pagar/ }).click();
    await expect(page.getByRole("combobox", { name: "Situação", exact: true })).toHaveValue("OVERDUE");
  });
}

test("closing after a lost write response reconciles the saved account", async ({ page }) => {
  test.skip(!process.env.E2E_FINANCE_FIXTURE, "Local fixture required");
  expect(process.env.E2E_BASE_URL).toBe("http://127.0.0.1:3217");
  const f = JSON.parse(readFileSync(process.env.E2E_FINANCE_FIXTURE!, "utf8"));
  const name = `Resposta perdida ${Date.now()}`;
  await page.goto(`/financeiro/contas-a-pagar?mes=2026-10&search=${encodeURIComponent(name)}`);
  await page.getByRole("button", { name: "Nova conta", exact: true }).click();
  const modal = page.getByRole("dialog", { name: "Nova conta" });
  await modal.getByLabel("Nome da conta").fill(name);
  await modal.getByRole("combobox", { name: "Categoria", exact: true }).selectOption(f.expenseId);
  let intercepted = false;
  await page.route("**/financeiro/contas-a-pagar**", async (route) => {
    if (!intercepted && route.request().method() === "POST") {
      intercepted = true;
      await route.fetch();
      await route.abort("failed");
    } else await route.continue();
  });
  await modal.getByRole("button", { name: "Salvar conta", exact: true }).click();
  await expect(modal.getByRole("button", { name: "Conferir gravação", exact: true })).toBeVisible();
  await page.unroute("**/financeiro/contas-a-pagar**");
  page.once("dialog", (dialog) => dialog.accept());
  await modal.getByRole("button", { name: "Cancelar", exact: true }).click();
  await expect(modal).toHaveCount(0);
  await expect(page.getByRole("button", { name: `Detalhes: ${name}`, exact: true })).toBeVisible();
  await expect(page.getByRole("tab", { name: "A pagar (1)", exact: true })).toBeVisible();
});
