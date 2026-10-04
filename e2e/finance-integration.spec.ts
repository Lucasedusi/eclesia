import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";

test("admin configures, restricted operator receives and monthly versions preserve history", async ({
  page,
  browser,
}) => {
  test.skip(
    !process.env.E2E_FINANCE_FIXTURE,
    "Local financial fixture required",
  );
  test.setTimeout(90000);
  const f = JSON.parse(readFileSync(process.env.E2E_FINANCE_FIXTURE!, "utf8"));
  const suffix = Date.now(),
    boxName = `Caixa conferência ${suffix}`;
  await page.goto(`/financeiro/caixas?unidade=${f.unitId}&mes=2026-10`);
  await page.getByRole("button", { name: "Novo caixa ou conta" }).click();
  let dialog = page.getByRole("dialog");
  await dialog.getByLabel("Nome", { exact: true }).fill(boxName);
  await dialog.getByLabel("Saldo de abertura (R$)").fill("100,00");
  await dialog.getByRole("checkbox", { name: "Dinheiro", exact: true }).check();
  const mutation = page.waitForRequest(
    (r) => r.method() === "POST" && Boolean(r.headers()["next-action"]),
  );
  await dialog.getByRole("button", { name: "Salvar cadastro" }).click();
  const request = await mutation;
  await expect(
    page.getByRole("heading", { name: boxName, exact: true }),
  ).toBeVisible();
  const restricted = await browser.newContext({
    storageState: "tmp/finance-treasurer-session.json",
  });
  // Replay the actual Server Action with another authenticated caller: no reliance on hidden buttons.
  const denied = await restricted.request.post(request.url(), {
    headers: {
      "next-action": request.headers()["next-action"],
      "content-type": request.headers()["content-type"],
      origin: new URL(request.url()).origin,
    },
    data: request.postData()!,
  });
  expect(await denied.text()).toMatch(/permissão|autorizad|FORBIDDEN/i);
  const operator = await restricted.newPage();
  await operator.goto(
    `/financeiro/lancamentos?unidade=${f.unitId}&mes=2026-10`,
  );
  await expect(
    operator.getByRole("link", { name: "Configurações", exact: true }),
  ).toHaveCount(0);
  await operator
    .getByRole("button", { name: "Nova saída", exact: true })
    .click();
  dialog = operator.getByRole("dialog");
  await dialog
    .getByRole("combobox", { name: "Caixa ou conta", exact: true })
    .selectOption(f.boxes[f.unitId].cash);
  await dialog
    .getByLabel("Favorecido (opcional)")
    .fill(`Fornecedor <script> ${suffix}`);
  await dialog
    .getByRole("combobox", { name: "Categoria", exact: true })
    .selectOption(f.expenseId);
  await dialog.getByLabel("Valor (R$)", { exact: true }).fill("123,45");
  await dialog
    .getByText("Documento, descrição, observações e anexos", { exact: true })
    .click();
  await dialog
    .getByLabel("Descrição", { exact: true })
    .fill(`Reparo ${suffix}`);
  await dialog.locator("input[type=file]").setInputFiles({
    name: "comprovante.pdf",
    mimeType: "application/pdf",
    buffer: Buffer.from("%PDF-1.4\n1 0 obj\n<<>>\nendobj\n%%EOF"),
  });
  await expect(
    dialog.getByText("comprovante.pdf", { exact: true }),
  ).toBeVisible();
  await dialog.getByRole("button", { name: "Salvar", exact: true }).click();
  await expect(dialog).toHaveCount(0);
  await operator
    .getByRole("button", {
      name: `Detalhes Despesa predial Fornecedor <script> ${suffix}`,
      exact: true,
    })
    .click();
  await expect(
    operator.getByRole("button", { name: "comprovante.pdf", exact: true }),
  ).toBeVisible();
  await expect(
    operator
      .locator("script")
      .filter({ hasText: `Fornecedor <script> ${suffix}` }),
  ).toHaveCount(0);
  await operator
    .getByRole("button", { name: "Fechar modal", exact: true })
    .click();
  await operator
    .getByRole("button", { name: "Transferir", exact: true })
    .click();
  dialog = operator.getByRole("dialog");
  await dialog
    .getByRole("combobox", { name: "Origem", exact: true })
    .selectOption(f.boxes[f.unitId].cash);
  await dialog
    .getByRole("combobox", { name: "Destino", exact: true })
    .selectOption(f.boxes[f.unitId].bank);
  await dialog.getByLabel("Valor (R$)", { exact: true }).fill("100,00");
  await dialog
    .getByLabel("Descrição", { exact: true })
    .fill(`Transferência ${suffix}`);
  await operator.route(
    operator.url(),
    async (route) => {
      await route.fetch();
      await route.abort("connectionfailed");
    },
    { times: 1 },
  );
  await dialog.getByRole("button", { name: "Confirmar transferência" }).click();
  await expect(dialog.getByRole("alert")).toBeVisible();
  await expect(dialog.getByLabel("Valor (R$)", { exact: true })).toBeDisabled();
  await dialog.getByRole("button", { name: "Confirmar transferência" }).click();
  await expect(dialog).toHaveCount(0);
  await expect(
    operator.getByText(`Transferência ${suffix}`, { exact: true }),
  ).toBeVisible();
  await operator.goto(
    `/financeiro/atendimento?unidade=${f.unitId}&mes=2026-10`,
  );
  await operator.evaluate(() =>
    Object.defineProperty(navigator.mediaDevices, "getUserMedia", {
      value: () =>
        Promise.reject(new DOMException("Denied", "NotAllowedError")),
    }),
  );
  await operator
    .getByRole("button", { name: "Ler credencial com a câmera" })
    .click();
  await expect(operator.getByRole("dialog").getByRole("alert")).toContainText(
    /câmera/i,
  );
  await operator
    .getByRole("button", { name: "Fechar modal", exact: true })
    .click();
  await expect(
    operator.getByRole("textbox", { name: "Nome para busca", exact: true }),
  ).toBeVisible();
  await operator.goto(
    `/financeiro/demonstrativos?unidade=${f.unitId}&mes=2026-10`,
  );
  await operator
    .getByRole("button", { name: /Gerar (demonstrativo|nova versão)/ })
    .click();
  await expect(operator.getByTestId("statement-cathedral-total")).toBeVisible();
  const versionCount = await operator
    .getByRole("link", { name: "Ver demonstrativo" })
    .count();
  const oldLink = await operator
    .getByRole("link", { name: "Ver demonstrativo" })
    .first()
    .getAttribute("href");
  await page.goto(`/financeiro/configuracoes?unidade=${f.unitId}&mes=2026-10`);
  await page
    .getByRole("button", { name: "Regras do demonstrativo", exact: true })
    .click();
  const rule = page
    .getByRole("textbox", { name: "Valor (R$)", exact: true })
    .first();
  const ruleValue = Number((await rule.inputValue()).replace(",", ".")) + 1;
  await rule.fill(ruleValue.toFixed(2).replace(".", ","));
  await page
    .getByLabel("Justificativa para revisão de período anterior")
    .fill("Atualização de regra para conferência integrada");
  const rulesSaved = page.waitForResponse(
    (r) =>
      r.request().method() === "POST" &&
      Boolean(r.request().headers()["next-action"]),
  );
  await page
    .getByRole("button", { name: "Salvar regras", exact: true })
    .click();
  await rulesSaved;
  await expect(page.locator("main").getByRole("alert")).toHaveCount(0);
  await operator.reload();
  await expect(
    operator.getByText("Desatualizado", { exact: true }),
  ).toBeVisible();
  await operator
    .getByRole("button", { name: "Gerar nova versão", exact: true })
    .click();
  await expect(
    operator.getByRole("link", { name: "Ver demonstrativo" }),
  ).toHaveCount(versionCount + 1);
  await operator.goto(oldLink!);
  await expect(
    operator
      .getByText("Substituído", { exact: true })
      .filter({ visible: true }),
  ).toBeVisible();
  await operator.goto(`/financeiro?unidade=${f.headquartersId}&mes=2026-10`);
  await expect(operator.getByTestId("statement-cathedral-total")).toHaveCount(
    0,
  );
  await expect(
    operator.getByText(/acesso|permissão|indisponível|carregar/i).first(),
  ).toBeVisible();
  await restricted.close();
});
