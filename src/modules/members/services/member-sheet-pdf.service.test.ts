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
    input.groups[1].fields[2].value = `${"Endereço extenso com complemento e localização. ".repeat(90)}FINAL DO ENDEREÇO`;
    input.history = [{ title: "Título extenso ".repeat(20), date: "01/10/2026", change: null, description: `${"Histórico longo. ".repeat(400)}FINAL DA DESCRIÇÃO` }];
    input.events = [{ name: "Conferência de teste ".repeat(50), date: "01/10/2026, 19:00", location: `${"Local extenso ".repeat(160)}FINAL DO LOCAL` }];
    const bytes = await createMemberSheetPdf(input);
    const text = drawn.mock.calls.map(([value]) => value).join(" ");
    expect(text).toContain("FINAL DO ENDEREÇO");
    expect(text).toContain("FINAL DA DESCRIÇÃO");
    expect(text).toContain("FINAL DO LOCAL");
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
