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
  await page.getByRole("button", { name: "Consultar exportações" }).click();
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
    await page.goto(`/financeiro/lancamentos?unidade=${f.unitId}&mes=2026-10`);
    await page
      .getByRole("button", { name: "Nova entrada", exact: true })
      .click();
    const form = page.getByRole("dialog", { name: "Nova entrada" });
    const choices = form.getByRole("combobox", {
      name: "Categoria",
      exact: true,
    });
    const offering = choices.locator(`option[value="${f.offeringId}"]`);
    await expect(offering).toHaveText(/Oferta/i);
    await expect(offering).not.toHaveText(/1420/);
    await expect(form.getByText(/Chamada|Código Alterdata/)).toHaveCount(0);
  } finally {
    await ctx.close();
  }
});

test("revisa o plano e os vínculos antes de criar uma categoria", async ({
  page,
}) => {
  test.skip(
    !process.env.E2E_FINANCE_FIXTURE || !process.env.E2E_STORAGE_STATE,
    "Requer ambiente financeiro local.",
  );
  expect(new URL(process.env.E2E_BASE_URL!).hostname).toBe("127.0.0.1");
  const f = JSON.parse(readFileSync(process.env.E2E_FINANCE_FIXTURE!, "utf8"));
  await page.goto(
    `/financeiro/configuracoes?unidade=${f.headquartersId}&mes=2026-10`,
  );
  const tab = page.getByRole("button", { name: "Contabilidade", exact: true });
  await tab.click();
  const open = page.getByRole("button", { name: "Gerenciar plano de contas" });
  await open.click();
  const upload = page.getByLabel("Importar plano em PDF");
  const { PDFDocument, StandardFonts } = await import("pdf-lib");
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const sheet = doc.addPage();
  const rows = [
    ["Classificação", "Nome da Conta", "Chamada"],
    ["3", "Receitas", "01"],
    ["3.01", "Doações", "0102"],
  ];
  rows.forEach((row, i) =>
    row.forEach((value, j) =>
      sheet.drawText(value, {
        x: [24, 160, 510][j],
        y: 720 - i * 18,
        font,
        size: 10,
      }),
    ),
  );
  await upload.setInputFiles({
    name: "plano.pdf",
    mimeType: "application/pdf",
    buffer: Buffer.from(await doc.save()),
  });
  await expect(
    page.getByText("PDF lido. 2 contas para conferência."),
  ).toBeVisible();
  await page.getByRole("button", { name: "Adicionar vínculo" }).click();
  const name = `Doação fictícia ${Date.now()}`;
  await page
    .getByRole("textbox", { name: "Categoria", exact: true })
    .or(page.getByRole("combobox", { name: "Categoria", exact: true }))
    .fill(name);
  await page.getByLabel("Chamada", { exact: true }).fill("0102");
  await page.getByRole("checkbox", { name: /Criar esta categoria/ }).check();
  await page.getByRole("button", { name: "Revisar alterações" }).click();
  await expect(
    page.getByRole("heading", { name: "Revisar alterações" }),
  ).toBeVisible();
  await expect(
    page.getByText("Nova categoria", { exact: false }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Voltar à edição" }).click();
  await page.getByRole("button", { name: "Revisar alterações" }).click();
  await page.getByRole("button", { name: "Confirmar alterações" }).click();
  await expect(page.getByText("Alterações contábeis aplicadas.")).toBeVisible();
  await page.reload();
  await tab.click();
  await open.click();
  await page.getByText(/^Consultar vínculos atuais/).click();
  const saved = page
    .getByRole("row")
    .filter({ has: page.getByRole("cell", { name, exact: true }) });
  await expect(
    saved.getByRole("cell", { name: "0102", exact: true }),
  ).toBeVisible();
});

test("contador entra apenas na Contabilidade da congregação autorizada", async ({
  browser,
}) => {
  test.skip(
    !process.env.E2E_FINANCE_FIXTURE || !process.env.E2E_STORAGE_STATE,
    "Requer contas fictícias no banco local.",
  );
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  expect(new URL(url).hostname).toBe("127.0.0.1");
  expect(new URL(process.env.E2E_BASE_URL!).hostname).toBe("127.0.0.1");
  const f = JSON.parse(readFileSync(process.env.E2E_FINANCE_FIXTURE!, "utf8"));
  const state = process.env.E2E_STORAGE_STATE!;
  const { createServerClient } = await import("@supabase/ssr");
  const admin = createServerClient(
    url,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll: () => JSON.parse(readFileSync(state, "utf8")).cookies,
        setAll: () => {},
      },
    },
  );
  const { data: access, error } = await admin
    .from("user_church_access")
    .select("id,role,access_scope,region_id")
    .eq("church_id", f.churchId)
    .eq("profile_id", f.sessions.observer)
    .single();
  expect(error).toBeNull();
  const ctx = await browser.newContext({
    storageState: state.replace("admin-session", "observer-session"),
  });
  try {
    const change = await admin.rpc("update_church_access", {
      p_access_id: access!.id,
      p_role: "ACCOUNTANT",
      p_scope: "CONGREGATION",
      p_status: "ACTIVE",
      p_congregation_id: f.unitId,
    });
    expect(change.error).toBeNull();
    const page = await ctx.newPage();
    for (const url of [
      "/",
      "/financeiro/lancamentos",
      "/financeiro/configuracoes",
    ]) {
      await page.goto(url);
      await expect(
        page.getByRole("heading", { name: "Contabilidade", exact: true }),
      ).toBeVisible();
      await expect(page).toHaveURL(/\/financeiro\/contabilidade/);
    }
    await expect(page.getByText("Configurar códigos contábeis")).toHaveCount(0);
    await expect(
      page.getByRole("link", { name: "Lançamentos", exact: true }),
    ).toHaveCount(0);
    await expect(
      page.getByRole("button", { name: "Sair", exact: true }),
    ).toBeVisible();
    await page.goto(`/financeiro/contabilidade?unidade=${f.headquartersId}`);
    await expect(
      page.getByText(
        "Seu acesso à Contabilidade não inclui a congregação selecionada.",
      ),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Gerar CSV Alterdata" }),
    ).toHaveCount(0);
  } finally {
    const restored = await admin.rpc("update_church_access", {
      p_access_id: access!.id,
      p_role: access!.role,
      p_scope: access!.access_scope,
      p_status: "ACTIVE",
      p_region_id: access!.region_id,
    });
    await ctx.close();
    expect(restored.error).toBeNull();
  }
});

test("filtro de conta e prévia contábil em tela estreita", async ({ page }) => {
  test.skip(
    !process.env.E2E_FINANCE_FIXTURE || !process.env.E2E_STORAGE_STATE,
    "Requer dados locais.",
  );
  expect(new URL(process.env.E2E_BASE_URL!).hostname).toBe("127.0.0.1");
  const f = JSON.parse(readFileSync(process.env.E2E_FINANCE_FIXTURE!, "utf8"));
  await page.setViewportSize({ width: 320, height: 700 });
  await page.goto(
    `/financeiro/contabilidade?unidade=${f.headquartersId}&mes=2026-10`,
  );
  const field = page.getByLabel("Caixa ou conta", { exact: true });
  await field.focus();
  await field.press("ArrowDown");
  const list = page.getByRole("listbox", { name: "Caixa ou conta" });
  const box = list.getByRole("option", { name: /Caixa principal/ });
  await expect(box.locator("strong").first()).toHaveText(/\S/);
  await box.click();
  await expect(field).toHaveValue(f.boxes[f.headquartersId].cash);
  const bounds = await field.boundingBox();
  expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(320);
  await expect(
    page.getByRole("columnheader", { name: "Plano de contas" }),
  ).toBeVisible();
  await expect(
    page.getByRole("columnheader", { name: "Documento" }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("heading", { name: "Exportações da seleção" }),
  ).toHaveCount(0);
});
