import { expect, test, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import { readFile } from "node:fs/promises";
import ExcelJS from "exceljs";
import { PDFDocument } from "pdf-lib";
const fixture = process.env.E2E_MEMBER_REPORT_FIXTURE
  ? JSON.parse(readFileSync(process.env.E2E_MEMBER_REPORT_FIXTURE, "utf8"))
  : null;
async function openMember(page: Page) {
  await page.goto("/membros");
  await page
    .getByRole("button", { name: "Ver ficha", exact: true })
    .first()
    .click();
  const dialog = page.getByRole("dialog", {
    name: "Ficha do membro",
    exact: true,
  });
  await expect(
    dialog.getByRole("heading", { name: "Ana de Teste", exact: true }),
  ).toBeVisible();
  return dialog;
}
test.describe("ajustes de membros", () => {
  test.skip(
    !fixture || !process.env.E2E_STORAGE_STATE,
    "Requer os dados fictícios locais de member-visual-local.",
  );
  test("total inclui arquivados, inicia em ativos e preserva filtros", async ({
    page,
  }, info) => {
    await page.goto("/membros");
    const summary = page.getByRole("region", {
      name: "Resumo dos membros",
      exact: true,
    });
    await expect(summary).toContainText("33Total de Cadastros");
    await expect(summary).toContainText("31Ativos");
    await expect(summary).toContainText("1Inativos");
    await expect(summary).toContainText("1Arquivados");
    expect(await summary.locator(":scope > *").count()).toBe(4);
    await expect(
      page.getByRole("columnheader", { name: "WhatsApp", exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("columnheader", { name: "Tipo", exact: true }),
    ).toHaveCount(0);
    const advanced = page.getByRole("button", { name: "Filtros avançados" });
    await expect(advanced).toHaveAttribute("aria-expanded", "false");
    const basicFilters = page.getByRole("combobox");
    await expect(basicFilters.nth(0)).toHaveAccessibleName(
      "Situação dos membros",
    );
    await expect(basicFilters.nth(1)).toHaveAccessibleName("Regional");
    await expect(basicFilters.nth(2)).toHaveAccessibleName("Congregação");
    const status = page.getByRole("combobox", { name: "Situação dos membros" });
    await expect(status).toHaveValue("ACTIVE");
    await status.selectOption("");
    await expect(page).toHaveURL(/status=/);
    await page.reload();
    await expect(advanced).toHaveAttribute("aria-expanded", "false");
    await expect(status).toHaveValue("");
    await advanced.click();
    const archive = page
      .locator("select")
      .filter({ has: page.locator('option[value="archived"]') });
    await archive.selectOption("archived");
    await expect(
      page.getByText("ARQUIVADO_TESTE", { exact: true }).first(),
    ).toBeVisible();
    await page.screenshot({
      animations: "disabled",
      path: info.outputPath("arquivados.png"),
    });
    await page.goto(`/membros?role=${fixture.role}`);
    await expect(advanced).toHaveAttribute("aria-expanded", "true");
    await expect(
      page.getByRole("combobox", { name: "Cargo", exact: true }),
    ).toHaveValue(fixture.role);
    await page
      .getByRole("button", { name: "Limpar filtros da listagem de membros" })
      .click();
    await expect(advanced).toHaveAttribute("aria-expanded", "false");
    await expect(status).toHaveValue("ACTIVE");
  });
  test("detalhes completos, cargos sanfona e histórico legível com altura estável", async ({
    page,
  }, info) => {
    const dialog = await openMember(page);
    const height = (await dialog.boundingBox())!.height;
    for (const field of [
      "Nacionalidade",
      "Naturalidade / UF",
      "Profissão",
      "Escolaridade",
      "Matrícula",
    ])
      await expect(dialog.getByText(field, { exact: true })).toBeVisible();
    const roles = dialog.locator("details");
    await expect(roles).not.toHaveAttribute("open", "");
    await expect(roles.locator("summary")).toContainText("Cargo");
    await expect(roles.locator("summary")).not.toContainText("Cargos");
    await expect(
      roles.locator("summary").getByText("Diaconisa", { exact: true }),
    ).toBeVisible();
    await roles.locator("summary").click();
    await expect(
      dialog.getByRole("button", { name: "Editar Cargo", exact: true }),
    ).toBeVisible();
    await page.screenshot({
      animations: "disabled",
      path: info.outputPath("dados-desktop.png"),
    });
    await dialog
      .getByRole("button", { name: "Histórico eclesiástico" })
      .click();
    await expect(
      dialog.getByText("Missionária", { exact: false }).first(),
    ).toBeVisible();
    await expect(
      dialog.getByText("Diaconisa", { exact: false }).first(),
    ).toBeVisible();
    await expect(
      dialog.getByText(/Recebimento atualizado: Batismo/),
    ).toBeVisible();
    await expect(dialog).not.toContainText("BAPTISM");
    expect(
      Math.abs((await dialog.boundingBox())!.height - height),
    ).toBeLessThan(1);
    await page.screenshot({
      animations: "disabled",
      path: info.outputPath("historico-desktop.png"),
    });
    await dialog
      .getByRole("button", { name: "Financeiro", exact: true })
      .click();
    await expect(dialog.getByText("Entradas", { exact: true })).toBeVisible();
    expect(
      Math.abs((await dialog.boundingBox())!.height - height),
    ).toBeLessThan(1);
  });
  test("financeiro consulta todas as páginas e exporta PDF e Excel do período", async ({
    page,
  }, info) => {
    const dialog = await openMember(page);
    await dialog
      .getByRole("button", { name: "Financeiro", exact: true })
      .click();
    await expect(
      dialog.getByText("Todo o período · 25 lançamento(s)", { exact: true }),
    ).toBeVisible();
    await expect(dialog.getByText(/R\$\s*240,00/)).toBeVisible();
    const summary = dialog.getByRole("region", {
      name: "Resumo financeiro do membro",
    });
    await expect(summary.locator("article")).toHaveCount(3);
    for (const label of ["Entradas", "Saídas", "Cancelados"]) {
      const card = summary.locator("article").filter({ hasText: label });
      await expect(card.locator("svg")).toBeVisible();
    }
    await expect(summary).not.toContainText("Não confirmados");
    await expect(dialog.locator("tbody tr")).toHaveCount(20);
    await expect(
      dialog.getByText("Entrada", { exact: true }).first(),
    ).toHaveCSS("background-color", "rgb(231, 248, 239)");
    await expect(
      dialog.getByText("Confirmado", { exact: true }).first(),
    ).toHaveCSS("background-color", "rgb(231, 248, 239)");
    await dialog.getByRole("button", { name: "Próxima", exact: true }).click();
    await expect(dialog.locator("tbody tr")).toHaveCount(5);
    for (const format of ["Excel", "PDF"]) {
      const promise = page.waitForEvent("download");
      await dialog.getByRole("button", { name: format, exact: true }).click();
      const download = await promise;
      const bytes = await readFile((await download.path())!);
      if (format === "Excel") {
        const wb = new ExcelJS.Workbook();
        await wb.xlsx.load(bytes as unknown as ExcelJS.Buffer);
        const sheet = wb.worksheets[0];
        expect(sheet.rowCount - 7).toBe(25);
        expect(JSON.stringify(sheet.getSheetValues())).not.toMatch(
          /OUTRA_IGREJA|SEGREDO_PASTORAL/,
        );
      } else
        expect((await PDFDocument.load(bytes)).getPageCount()).toBeGreaterThan(
          1,
        );
      await download.saveAs(
        info.outputPath(`financeiro.${format === "Excel" ? "xlsx" : "pdf"}`),
      );
    }
    await page.screenshot({
      animations: "disabled",
      path: info.outputPath("financeiro-desktop.png"),
    });
    await dialog.getByLabel("Data inicial", { exact: true }).fill("2026-11-02");
    await dialog.getByRole("button", { name: "Aplicar filtros" }).click();
    await expect(
      dialog.getByText("Nenhum lançamento encontrado para o período."),
    ).toBeVisible();
  });
  test("exportação financeira mostra carregamento no botão acionado e permite tentar novamente", async ({
    page,
  }) => {
    const dialog = await openMember(page);
    await dialog
      .getByRole("button", { name: "Financeiro", exact: true })
      .click();
    const pdf = dialog.getByRole("button", { name: "PDF", exact: true });
    const excel = dialog.getByRole("button", { name: "Excel", exact: true });
    await expect(pdf).toBeEnabled();
    await expect(
      dialog.getByRole("heading", {
        name: "Financeiro do membro",
        exact: true,
      }),
    ).toHaveCount(0);
    await expect(
      dialog.getByText(
        "Consulta dos lançamentos vinculados nas unidades autorizadas.",
        { exact: true },
      ),
    ).toHaveCount(0);
    await expect(dialog.locator("form")).toHaveCSS("margin-top", "20px");
    await expect(dialog.locator("form")).toHaveCSS("margin-bottom", "20px");
    for (const [active, other] of [
      [pdf, excel],
      [excel, pdf],
    ]) {
      let release!: () => void;
      const pending = new Promise<void>((resolve) => {
        release = resolve;
      });
      await page.route("**/api/members/finance/reports", async (route) => {
        await pending;
        await route.fulfill({
          status: 503,
          contentType: "application/json",
          body: JSON.stringify({ message: "Falha simulada na exportação." }),
        });
      });
      try {
        await active.click();
        await expect(active).toHaveAttribute("aria-busy", "true");
        await expect(active.locator("svg")).toHaveClass(/lucide-loader/);
        await expect(other).toHaveAttribute("aria-busy", "false");
        await expect(pdf).toBeDisabled();
        await expect(excel).toBeDisabled();
      } finally {
        release();
      }
      await expect(dialog.getByRole("alert")).toContainText(
        "Falha simulada na exportação.",
      );
      await expect(active).toHaveAttribute("aria-busy", "false");
      await expect(pdf).toBeEnabled();
      await expect(excel).toBeEnabled();
      await page.unroute("**/api/members/finance/reports");
    }
  });
  test("categoria filtra todas as páginas, totais e os dois formatos de exportação", async ({
    page,
    request,
  }, info) => {
    const dialog = await openMember(page);
    await dialog
      .getByRole("button", { name: "Financeiro", exact: true })
      .click();
    const category = dialog.getByRole("combobox", {
      name: "Categoria",
      exact: true,
    });
    await expect(category).toBeEnabled();
    await expect(category).toHaveValue("");
    expect(await category.locator("option").allTextContents()).not.toContain(
      "Categoria de outra igreja",
    );
    await category.selectOption(fixture.financeCategories.mission);
    await dialog
      .getByRole("button", { name: "Aplicar filtros", exact: true })
      .click();
    await expect(
      dialog.getByText(/22 lançamento\(s\).*Ofertas missionárias/),
    ).toBeVisible();
    await expect(dialog.getByText(/R\$\s*220,00/)).toBeVisible();
    await expect(dialog.locator("tbody tr")).toHaveCount(20);
    await dialog.getByRole("button", { name: "Próxima", exact: true }).click();
    await expect(dialog.locator("tbody tr")).toHaveCount(2);
    await category.selectOption(fixture.financeCategories.other);
    for (const format of ["Excel", "PDF"]) {
      const downloading = page.waitForEvent("download");
      const exporting = page.waitForRequest((r) =>
        r.url().endsWith("/api/members/finance/reports"),
      );
      await dialog.getByRole("button", { name: format, exact: true }).click();
      expect((await exporting).postDataJSON().filters.categoryId).toBe(
        fixture.financeCategories.mission,
      );
      const file = await downloading;
      const bytes = await readFile((await file.path())!);
      if (format === "Excel") {
        const wb = new ExcelJS.Workbook();
        await wb.xlsx.load(bytes as unknown as ExcelJS.Buffer);
        const sheet = wb.worksheets[0];
        expect(sheet.rowCount - 7).toBe(22);
        expect(sheet.getCell("A4").value).toContain(
          "Categoria: Ofertas missionárias",
        );
        for (let row = 8; row <= sheet.rowCount; row++)
          expect(sheet.getCell(row, 3).value).toBe("Ofertas missionárias");
      } else
        expect((await PDFDocument.load(bytes)).getPageCount()).toBeGreaterThan(
          1,
        );
      await file.saveAs(
        info.outputPath(`categoria.${format === "Excel" ? "xlsx" : "pdf"}`),
      );
    }
    await dialog
      .getByRole("button", { name: "Aplicar filtros", exact: true })
      .click();
    await expect(dialog.locator("tbody tr")).toHaveCount(3);
    await expect(dialog.getByText(/R\$\s*20,00/)).toBeVisible();
    await dialog.getByLabel("Data inicial", { exact: true }).fill("2026-11-02");
    await dialog
      .getByRole("button", { name: "Aplicar filtros", exact: true })
      .click();
    await expect(
      dialog.getByText("Nenhum lançamento encontrado para o período."),
    ).toBeVisible();
    await expect(category).toHaveValue(fixture.financeCategories.other);
    for (const format of ["pdf", "xlsx"]) {
      const response = await request.post("/api/members/finance/reports", {
        data: {
          memberId: fixture.members[0],
          format,
          filters: { categoryId: fixture.financeCategories.foreign },
        },
      });
      expect(response.status()).toBe(404);
    }
  });
  test("exportação financeira respeita igreja e permissão", async ({
    request,
    playwright,
  }) => {
    const input = {
      memberId: fixture.members[33],
      format: "xlsx",
      filters: {},
    };
    expect(
      (
        await request.post("/api/members/finance/reports", { data: input })
      ).status(),
    ).toBe(404);
    const viewer = await playwright.request.newContext({
      baseURL: process.env.E2E_BASE_URL,
      storageState: fixture.sessions.viewer,
    });
    try {
      expect(
        (
          await viewer.post("/api/members/finance/reports", {
            data: { ...input, memberId: fixture.members[0] },
          })
        ).status(),
      ).toBe(403);
    } finally {
      await viewer.dispose();
    }
  });
  test("formulário tem dois tipos e revisão completa com controles padronizados", async ({
    page,
  }, info) => {
    await page.goto("/membros/novo");
    const name = page.getByRole("textbox", {
      name: "Nome completo *",
      exact: true,
    });
    await name.fill("Maria de Teste Visual");
    await expect(name).toHaveCSS("height", "52px");
    await expect(name).toHaveCSS("border-radius", "6px");
    await expect(name).toHaveCSS("font-weight", "400");
    await page
      .getByRole("textbox", { name: "Nacionalidade", exact: true })
      .fill("Brasileira");
    await page
      .getByRole("textbox", { name: "Profissão", exact: true })
      .fill("Professora");
    await page.screenshot({
      animations: "disabled",
      path: info.outputPath("formulario-desktop.png"),
    });
    await page.getByRole("button", { name: "Próximo", exact: true }).click();
    await page.getByRole("button", { name: "Próximo", exact: true }).click();
    await page.getByRole("button", { name: "Próximo", exact: true }).click();
    const type = page.getByRole("combobox", {
      name: "Tipo de cadastro *",
      exact: true,
    });
    expect(await type.locator("option").allTextContents()).toEqual([
      "Selecione uma opção",
      "Membro",
      "Criança",
    ]);
    await page
      .getByRole("combobox", { name: "Congregação *", exact: true })
      .selectOption(fixture.congregations[0]);
    await page.getByRole("button", { name: "Próximo", exact: true }).click();
    await page.getByRole("button", { name: "Próximo", exact: true }).click();
    await expect(
      page.getByText("Maria de Teste Visual", { exact: true }),
    ).toBeVisible();
    await expect(page.getByText("Professora", { exact: true })).toBeVisible();
    await page.screenshot({
      animations: "disabled",
      path: info.outputPath("revisao-desktop.png"),
    });
  });
  test("detalhes e financeiro cabem no celular", async ({ page }, info) => {
    await page.setViewportSize({ width: 390, height: 844 });
    const dialog = await openMember(page);
    await page.screenshot({
      animations: "disabled",
      path: info.outputPath("dados-mobile.png"),
    });
    const rect = (await dialog.boundingBox())!;
    expect(rect.x).toBeGreaterThanOrEqual(0);
    expect(rect.y + rect.height).toBeLessThanOrEqual(844);
    await dialog
      .getByRole("button", { name: "Financeiro", exact: true })
      .click();
    await expect(dialog.getByText("Entradas", { exact: true })).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.screenshot({
      animations: "disabled",
      path: info.outputPath("financeiro-mobile.png"),
    });
  });
  test("campos administrativos seguem o padrão em organização, eventos e configurações", async ({
    page,
  }, info) => {
    for (const [slug, title] of [
      ["regionais", "Nova Regional"],
      ["congregacoes", "Nova Congregação"],
      ["cargos", "Novo Cargo"],
    ]) {
      await page.goto(`/estrutura-eclesiastica/${slug}`);
      await page.getByRole("button", { name: "Novo cadastro" }).click();
      const dialog = page.getByRole("dialog", { name: title, exact: true });
      const field = dialog.getByRole("textbox").first();
      await expect(field).toHaveCSS("height", "52px");
      await expect(field).toHaveCSS("font-weight", "400");
      await field.fill("Exemplo visual");
      await expect(dialog).toHaveCSS("opacity", "1");
      await expect(dialog.locator("..")).toHaveCSS("opacity", "1");
      await page.screenshot({
        animations: "disabled",
        path: info.outputPath(`${slug}-campos.png`),
      });
    }
    await page.goto("/eventos/novo");
    await expect(
      page.getByRole("textbox", { name: "Nome do evento *", exact: true }),
    ).toHaveCSS("height", "52px");
    await page.screenshot({
      animations: "disabled",
      path: info.outputPath("eventos-campos.png"),
    });
    await page.goto("/configuracoes");
    await expect(
      page.getByRole("textbox", {
        name: "Nome da igreja ou campo",
        exact: true,
      }),
    ).toHaveCSS("height", "52px");
    await page.screenshot({
      animations: "disabled",
      path: info.outputPath("configuracoes-campos.png"),
    });
  });
  test("cadastro de congregação mantém a altura em todas as etapas", async ({
    page,
  }, info) => {
    for (const viewport of [
      { width: 1440, height: 1000 },
      { width: 390, height: 844 },
    ]) {
      await page.setViewportSize(viewport);
      await page.goto("/estrutura-eclesiastica/congregacoes");
      await page.getByRole("button", { name: "Novo cadastro" }).click();
      const dialog = page.getByRole("dialog", {
        name: "Nova Congregação",
        exact: true,
      });
      await dialog
        .getByRole("textbox", { name: "Nome da Congregação *", exact: true })
        .fill("Congregação de teste visual");
      await dialog
        .getByRole("combobox", { name: "Regional *", exact: true })
        .selectOption(fixture.regions[0]);
      await expect(dialog).toHaveCSS("opacity", "1");
      const height = (await dialog.boundingBox())!.height;
      for (const step of ["Pastor/Dirigente", "CEP", "Salvar Congregação"]) {
        await dialog
          .getByRole("button", { name: "Continuar", exact: true })
          .click();
        if (step === "Salvar Congregação") {
          await expect(
            dialog.getByRole("button", { name: step, exact: true }),
          ).toBeVisible();
        } else {
          await expect(
            dialog.getByRole("textbox", { name: step, exact: true }),
          ).toBeVisible();
        }
        const rect = (await dialog.boundingBox())!;
        expect(Math.abs(rect.height - height)).toBeLessThan(1);
        expect(rect.x).toBeGreaterThanOrEqual(0);
        expect(rect.y + rect.height).toBeLessThanOrEqual(viewport.height);
        await expect(
          dialog.getByRole("button", { name: "Voltar", exact: true }),
        ).toBeInViewport();
      }
      await page.screenshot({
        animations: "disabled",
        path: info.outputPath(`congregacao-revisao-${viewport.width}.png`),
      });
      await dialog.getByRole("button", { name: "Voltar", exact: true }).click();
      expect(
        Math.abs((await dialog.boundingBox())!.height - height),
      ).toBeLessThan(1);
      await dialog
        .getByRole("button", { name: "Cancelar", exact: true })
        .click();
    }
  });
  test("edição preserva o tipo legado sem oferecê-lo em novos cadastros", async ({
    page,
  }) => {
    await page.goto(`/membros/${fixture.members[30]}/editar`);
    for (let i = 0; i < 3; i++)
      await page.getByRole("button", { name: "Próximo", exact: true }).click();
    const type = page.getByRole("combobox", {
      name: "Tipo de cadastro *",
      exact: true,
    });
    await expect(type).toHaveValue("CONGREGATED");
    expect(await type.locator("option").allTextContents()).toContain(
      "Congregado",
    );
  });
});
