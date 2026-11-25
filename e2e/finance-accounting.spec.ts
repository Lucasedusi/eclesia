import { readFileSync } from "node:fs";
import { expect, test, type Page } from "@playwright/test";

async function consultFixtureMonth(page: Page) {
  await page.getByLabel("Período da consulta").selectOption("custom");
  await page.getByRole("textbox", { name: "Data final", exact: true }).fill("");
  await page
    .getByRole("textbox", { name: "Data inicial", exact: true })
    .fill("01/10/2026");
  await page
    .getByRole("textbox", { name: "Data final", exact: true })
    .fill("31/10/2026");
  await page.getByRole("button", { name: "Consultar", exact: true }).click();
}

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
  await consultFixtureMonth(page);
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
  await expect(repeat).toBeVisible();
  const mark = await repeat.boundingBox();
  const caption = await page.getByText(/^Incluir novamente/).boundingBox();
  expect(caption!.x).toBeGreaterThanOrEqual(mark!.x + mark!.width);
  expect(
    Math.abs(caption!.y + caption!.height / 2 - (mark!.y + mark!.height / 2)),
  ).toBeLessThan(2);
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

test("contador consulta o painel e gera PDF apenas para a congregação autorizada", async ({
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
    .is("deleted_at", null)
    .single();
  expect(error).toBeNull();
  test.setTimeout(60000);
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
    await page.goto("/");
    await expect(page).toHaveURL(/\/financeiro(?:\?|$)/);
    await expect(
      page.getByRole("link", { name: "Lançamentos", exact: true }).first(),
    ).toBeVisible();
    await page.goto("/financeiro/lancamentos");
    await expect(
      page.getByRole("heading", { name: "Lançamentos", exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", {
        name: /Nova entrada|Nova saída|Importar extrato/i,
      }),
    ).toHaveCount(0);
    await page.goto("/financeiro/configuracoes");
    await expect(page).toHaveURL(/\/financeiro(?:\?|$)/);
    await page.goto("/financeiro/relatorios");
    await expect(
      page.getByRole("heading", { name: /Relatórios/i }).first(),
    ).toBeVisible();
    const pdf = await page.request.post("/api/finance/reports/pdf", {
      data: { type: "SYNTHETIC", month: "2026-10", congregationId: f.unitId },
    });
    expect(pdf.status()).toBe(200);
    expect(pdf.headers()["content-type"]).toContain("application/pdf");
    const forbidden = await page.request.post("/api/finance/reports/pdf", {
      data: {
        type: "SYNTHETIC",
        month: "2026-10",
        congregationId: f.headquartersId,
      },
    });
    expect(forbidden.status()).toBe(403);
    await page.goto("/financeiro/contabilidade");
    await expect(page.getByText("Configurar códigos contábeis")).toHaveCount(0);
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
    const adminContext = await browser.newContext({ storageState: state });
    try {
      const manager = await adminContext.newPage();
      const { data: profile } = await admin
        .from("profiles")
        .select("email")
        .eq("id", f.sessions.observer)
        .single();
      await manager.goto("/usuarios");
      await manager
        .getByRole("searchbox", { name: "Buscar nome ou e-mail" })
        .fill(profile!.email);
      await manager.getByRole("button", { name: "Editar acesso" }).click();
      const choices = manager.getByRole("group", {
        name: "Congregações autorizadas",
      });
      await expect(choices.locator(`input[value="${f.unitId}"]`)).toBeChecked();
      await choices.locator(`input[value="${f.headquartersId}"]`).check();
      await manager.getByRole("button", { name: "Salvar alterações" }).click();
      await expect(choices).toHaveCount(0);
      await page.goto("/financeiro/contas-a-pagar");
      await expect(
        page.getByRole("heading", { name: "Contas a pagar", exact: true }),
      ).toBeVisible();
      await expect(
        page.getByRole("button", { name: "Nova conta" }),
      ).toHaveCount(0);
      await page.goto("/financeiro/fluxo-de-caixa");
      await expect(
        page.getByRole("heading", {
          name: "Fluxo de caixa diário",
          exact: true,
        }),
      ).toBeVisible();
      await expect(
        page.getByRole("button", { name: /relatório/i }).first(),
      ).toBeVisible();
      await page.goto("/financeiro/relatorios/entregas");
      await expect(
        page.getByRole("button", {
          name: /Registrar entrega|Registrar data manual|Corrigir/,
        }),
      ).toHaveCount(0);
      await manager.getByRole("button", { name: "Editar acesso" }).click();
      await choices.locator(`input[value="${f.headquartersId}"]`).uncheck();
      await manager.getByRole("button", { name: "Salvar alterações" }).click();
      await expect(choices).toHaveCount(0);
      await page.goto("/financeiro/contas-a-pagar");
      await expect(page).toHaveURL(/acesso-negado/);
    } finally {
      await adminContext.close();
    }
  } finally {
    const { data: grants } = await admin
      .from("user_church_access")
      .select("id")
      .eq("profile_id", f.sessions.observer)
      .eq("church_id", f.churchId)
      .eq("role", "ACCOUNTANT")
      .is("deleted_at", null);
    const restored = grants?.length
      ? await admin.rpc("update_accountant_scope", {
          p_church: f.churchId,
          p_access: grants[0].id,
          p_expected: grants.map((a) => a.id),
          p_units: [],
          p_role: access!.role,
          p_scope: access!.access_scope,
          p_status: "ACTIVE",
          p_target: access!.region_id,
          p_notes: "",
        })
      : { error: null };
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
  await page.goto(`/financeiro/contabilidade?unidade=${f.unitId}&mes=2026-10`);
  const prompt = page.getByText(
    "Selecione o caixa ou conta e o período para consultar os lançamentos.",
  );
  await expect(prompt).toBeVisible();
  await expect(page.getByLabel("Período da consulta")).toHaveValue("previous");
  await page.getByLabel("Período da consulta").selectOption("current");
  await expect(prompt).toBeVisible();
  await expect(page.getByRole("columnheader")).toHaveCount(0);
  const field = page.getByLabel("Caixa ou conta", { exact: true });
  const list = page.getByRole("listbox", { name: "Caixa ou conta" });
  await expect(async () => {
    if (!(await list.isVisible())) await field.press("ArrowDown");
    await expect(list).toBeVisible({ timeout: 500 });
  }).toPass({ timeout: 5000 });
  const box = list.getByRole("option", {
    name: "Caixa principal · Headquarters",
    exact: true,
  });
  await expect(box.locator("strong").first()).toHaveText(/\S/);
  await box.click();
  await expect(field).toHaveValue(f.boxes[f.headquartersId].cash);
  await expect(prompt).toBeVisible();
  await consultFixtureMonth(page);
  await expect(page.getByText("Saldo anterior", { exact: true })).toBeVisible();
  await expect(
    page.getByText("Saldo do período", { exact: true }),
  ).toBeVisible();
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
  await page
    .getByRole("textbox", { name: "Data inicial", exact: true })
    .fill("02/10/2026");
  let resume!: () => void;
  const paused = new Promise<void>((resolve) => {
    resume = resolve;
  });
  await page.route("**/financeiro/contabilidade**", async (route) => {
    if (route.request().method() === "POST") await paused;
    await route.continue();
  });
  try {
    await page.getByRole("button", { name: "Consultar", exact: true }).click();
    await expect(
      page.getByRole("status", { name: "Consultando prévia contábil" }),
    ).toBeVisible();
    await expect(field).toBeVisible();
  } finally {
    resume();
  }
  await expect(
    page.getByText("Nenhum lançamento confirmado no período."),
  ).toBeVisible();
  const opening = page
    .getByText("Saldo anterior", { exact: true })
    .locator("../..");
  await expect(opening).toContainText(/18\.000,00/);
  const net = page
    .getByText("Saldo do período", { exact: true })
    .locator("../..");
  await expect(net).toContainText(/R\$\s*0,00/);
  await page.reload();
  await expect(prompt).toBeVisible();
  await expect(page.getByRole("columnheader")).toHaveCount(0);
});
