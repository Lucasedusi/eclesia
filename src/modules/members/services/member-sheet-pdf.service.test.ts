import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { PDFDocument, PDFPage } from "pdf-lib";
import sharp from "sharp";
import { afterEach, describe, expect, it, vi } from "vitest";
import { memberSheetFixture, completeMemberSheetFixture } from "./member-sheet.fixtures";
import { createMemberSheetPdf } from "./member-sheet-pdf.service";

vi.mock("server-only", () => ({}));
afterEach(() => vi.restoreAllMocks());

async function saveQa(name: string, bytes: Uint8Array) {
  const directory = process.env.MEMBER_SHEET_QA_DIR;
  if (directory) {
    await mkdir(directory, { recursive: true });
    await writeFile(path.join(directory, name), bytes);
  }
}

describe("createMemberSheetPdf", () => {
  it("mantém marca d'água proporcional a 5% e nomes pastorais em todas as páginas", async () => {
    const images = vi.spyOn(PDFPage.prototype, "drawImage");
    const drawn = vi.spyOn(PDFPage.prototype, "drawText");
    const rectangles = vi.spyOn(PDFPage.prototype, "drawRectangle");
    const logo = await sharp(Buffer.from('<svg width="600" height="400"><ellipse cx="300" cy="200" rx="280" ry="180" fill="#153f70"/><path d="M280 70h40v100h100v40H320v120h-40V210H180v-40h100z" fill="#dfb53d"/></svg>')).png().toBuffer();
    const input = { ...completeMemberSheetFixture(), church: { ...memberSheetFixture().church, pastorNames: ["Paulo de Teste", "Ana de Teste"], logoDataUri: `data:image/png;base64,${logo.toString("base64")}` } };
    const bytes = await createMemberSheetPdf(input);
    const pdf = await PDFDocument.load(bytes);
    const marks = images.mock.calls.flatMap(([, options], index) => options?.opacity === 0.05 ? [{ options, page: images.mock.instances[index] as PDFPage }] : []);
    expect(marks).toHaveLength(pdf.getPageCount());
    for (const { options, page } of marks) {
      expect(options.width! / options.height!).toBeCloseTo(1.5);
      expect(options.x! + options.width! / 2).toBeCloseTo(page.getWidth() / 2);
      expect(options.y! + options.height! / 2).toBeCloseTo(page.getHeight() / 2);
      const pageText = drawn.mock.calls.filter((_, index) => drawn.mock.instances[index] === page);
      expect(pageText.map(([text]) => text).join(" ")).toContain("Paulo de Teste e Ana de Teste");
      const church = pageText.find(([text]) => /IGREJA|Igreja/.test(text))![1]!;
      const pastors = pageText.find(([text]) => text.includes("Paulo de Teste"))![1]!;
      expect(pastors.y).toBeLessThan(church.y!);
    }
    for (const [options] of rectangles.mock.calls) {
      if (options?.color && "red" in options.color && options.color.red > 0.9) expect(options.opacity).toBeLessThanOrEqual(0.4);
    }
    await saveQa("ficha-identidade-visual.pdf", bytes);
  });

  it("diferencia rótulos dos valores e preserva dados pessoais extensos", async () => {
    const drawn = vi.spyOn(PDFPage.prototype, "drawText");
    const input = memberSheetFixture();
    input.groups[0].fields.find((field) => field.label === "Profissão")!.value = `${"Profissão com descrição extensa ".repeat(80)}FIM DA PROFISSÃO`;
    const bytes = await createMemberSheetPdf(input);
    const text = drawn.mock.calls.map(([value]) => value).join(" ");
    expect(text).toContain("FIM DA PROFISSÃO");
    const label = drawn.mock.calls.find(([text]) => text === "PROFISSÃO")![1]!;
    const content = drawn.mock.calls.find(([text]) => text.startsWith("Profissão com"))![1]!;
    expect(label.color).not.toEqual(content.color);
    for (const [value, options] of drawn.mock.calls) {
      expect(options?.y, value).toBeGreaterThanOrEqual(20);
      expect((options?.x ?? 0) + options!.font!.widthOfTextAtSize(value, options!.size!), value).toBeLessThanOrEqual(571);
    }
    await saveQa("ficha-dados-pessoais-longos.pdf", bytes);
  });

  it.each([null, "data:image/png;base64,aW52YWxpZA=="])("continua exportando sem logo válida nem nomes pastorais: %s", async (logoDataUri) => {
    const images = vi.spyOn(PDFPage.prototype, "drawImage");
    const drawn = vi.spyOn(PDFPage.prototype, "drawText");
    const input = { ...memberSheetFixture(), church: { ...memberSheetFixture().church, logoDataUri, pastorNames: [] } };
    const bytes = await createMemberSheetPdf(input);
    expect((await PDFDocument.load(bytes)).getPageCount()).toBeGreaterThan(0);
    expect(images).not.toHaveBeenCalled();
    expect(drawn.mock.calls.map(([text]) => text).join(" ")).not.toMatch(/Pastor(?:es)?:/);
  });

  it("gera a ficha básica em uma página A4 com texto vetorial e fonte incorporada", async () => {
    const drawn = vi.spyOn(PDFPage.prototype, "drawText");
    const bytes = await createMemberSheetPdf(memberSheetFixture());
    const pdf = await PDFDocument.load(bytes);
    expect(pdf.getPageCount()).toBe(1);
    expect(pdf.getPage(0).getWidth()).toBeCloseTo(595.28, 1);
    expect(pdf.getPage(0).getHeight()).toBeCloseTo(841.89, 1);
    expect(pdf.getTitle()).toBe("Ficha do membro");
    const text = drawn.mock.calls.map(([value]) => value).join(" ");
    expect(text).toContain("ANA MARIA DE OLIVEIRA");
    expect(text).toContain("HISTÓRICO DE FÉ");
    for (const field of ["NACIONALIDADE", "NATURALIDADE / UF", "PROFISSÃO", "ESCOLARIDADE", "Brasileira", "Goiânia / GO", "Professora", "Ensino superior completo"]) expect(text).toContain(field);
    expect(text).not.toContain("LINHA DO TEMPO");
    expect(text).not.toContain("EVENTOS");
    expect(text).toContain("Página 1 de 1");
    expect(Buffer.from(bytes).toString("latin1")).toContain("/FontFile2");
    await saveQa("ficha-basica.pdf", bytes);
  });

  it("pagina histórico e eventos completos sem perder o último registro", async () => {
    const drawn = vi.spyOn(PDFPage.prototype, "drawText");
    const bytes = await createMemberSheetPdf(completeMemberSheetFixture());
    const pdf = await PDFDocument.load(bytes);
    expect(pdf.getPageCount()).toBeGreaterThan(3);
    const text = drawn.mock.calls.map(([value]) => value).join(" ");
    expect(text).toContain("Registro de teste 26");
    expect(text).toContain("Evento de exemplo 28");
    expect(text).toContain(`Página ${pdf.getPageCount()} de ${pdf.getPageCount()}`);
    for (const [value, options] of drawn.mock.calls) {
      expect(options?.x, value).toBeGreaterThanOrEqual(25);
      expect(options?.y, value).toBeGreaterThanOrEqual(20);
      expect((options?.x ?? 0) + options!.font!.widthOfTextAtSize(value, options!.size!), value).toBeLessThanOrEqual(571);
      const supported = new Set(options!.font!.getCharacterSet());
      expect(Array.from(value).filter((character) => !supported.has(character.codePointAt(0)!)), value).toEqual([]);
    }
    await saveQa("ficha-completa.pdf", bytes);
  });

  it("mantém conteúdos muito longos dentro da página", async () => {
    const drawn = vi.spyOn(PDFPage.prototype, "drawText");
    const input = memberSheetFixture();
    input.church.name = "Igreja Evangélica de Nome Extenso para Verificação de Layout e Impressão";
    input.member.fullName = "Maria Aparecida de Oliveira dos Santos e Albuquerque Ferreira da Costa";
    input.groups[1].fields[1].value = `${"emailmuitolongo".repeat(8)}@example.invalid`;
    input.groups[2].fields[0].value = `${"Endereço extenso com complemento e localização. ".repeat(90)}FINAL DO ENDEREÇO`;
    input.history = [{ title: "Título extenso ".repeat(20), date: "01/10/2026", change: null, description: `${"Histórico longo. ".repeat(400)}FINAL DA DESCRIÇÃO` }];
    input.events = [{ name: "Conferência de teste ".repeat(50), date: "01/10/2026, 19:00", location: `${"Local extenso ".repeat(160)}FINAL DO LOCAL` }];
    const bytes = await createMemberSheetPdf(input);
    const text = drawn.mock.calls.map(([value]) => value).join(" ");
    expect(text).toContain("FINAL DO ENDEREÇO");
    expect(text).toContain("FINAL DA DESCRIÇÃO");
    expect(text).toContain("FINAL DO LOCAL");
    const addressHeading = drawn.mock.calls.findIndex(([text]) => text === "ENDEREÇO");
    const addressPage = drawn.mock.instances[addressHeading];
    expect(drawn.mock.calls.filter((_, index) => drawn.mock.instances[index] === addressPage).map(([text]) => text))
      .toContain("LOGRADOURO E NÚMERO");
    for (const [value, options] of drawn.mock.calls) {
      expect(options?.y, value).toBeGreaterThanOrEqual(20);
      expect((options?.x ?? 0) + options!.font!.widthOfTextAtSize(value, options!.size!), value).toBeLessThanOrEqual(571);
    }
    await saveQa("ficha-textos-longos.pdf", bytes);
  });

  it("indica ausência de dados nas seções selecionadas", async () => {
    const drawn = vi.spyOn(PDFPage.prototype, "drawText");
    await createMemberSheetPdf({ ...memberSheetFixture(), history: [], events: [] });
    const text = drawn.mock.calls.map(([value]) => value).join(" ");
    expect(text).toContain("Nenhum registro na linha do tempo.");
    expect(text).toContain("Nenhum evento vinculado ao membro.");
  });

  it.each(["png", "webp"] as const)("incorpora logotipo %s sem tornar o texto uma imagem", async (format) => {
    const image = await sharp({ create: { width: 120, height: 120, channels: 4, background: "#ddb33f" } })[format]().toBuffer();
    const input = memberSheetFixture();
    input.church.logoDataUri = `data:image/${format};base64,${image.toString("base64")}`;
    const bytes = await createMemberSheetPdf(input);
    expect((await PDFDocument.load(bytes)).getPageCount()).toBe(1);
    expect(Buffer.from(bytes).toString("latin1")).toContain("/Subtype /Image");
    await saveQa(`ficha-logo-${format}.pdf`, bytes);
  });
});
