import "server-only";

import { readFile } from "node:fs/promises";
import path from "node:path";
import fontkit from "@pdf-lib/fontkit";
import { PDFDocument, type PDFFont, type PDFImage, type PDFPage, rgb } from "pdf-lib";
import sharp from "sharp";

export const PAGE_WIDTH = 595.28;
export const PAGE_HEIGHT = 841.89;
export const PAGE_MARGIN = 36;
export const CONTENT_WIDTH = PAGE_WIDTH - PAGE_MARGIN * 2;
export const CONTENT_BOTTOM = PAGE_HEIGHT - 57;
export const PDF_COLORS = {
  navy: rgb(0.04, 0.16, 0.31), gold: rgb(0.86, 0.69, 0.23), muted: rgb(0.36, 0.42, 0.51),
  border: rgb(0.80, 0.83, 0.87), paper: rgb(0.973, 0.974, 0.977), white: rgb(1, 1, 1),
};
export type ChurchDocumentIdentity = { name: string; logoDataUri: string | null; address: string; phone: string; document: string };
export type ChurchPdfAssets = { regular: PDFFont; bold: PDFFont; logo: PDFImage | null };

let fontBytes: Promise<Buffer[]> | undefined;
const fontCharacters = new WeakMap<PDFFont, Set<number>>();

export function wrapPdfText(text: string, font: PDFFont, size: number, width: number): string[] {
  let supported = fontCharacters.get(font);
  if (!supported) { supported = new Set(font.getCharacterSet()); fontCharacters.set(font, supported); }
  const clean = Array.from(text.replace(/→/g, "para").replace(/\r\n?/g, "\n").replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, ""))
    .map((character) => character === "\n" || supported.has(character.codePointAt(0)!) ? character : "?").join("");
  const lines: string[] = [];
  for (const paragraph of clean.split("\n")) {
    let line = "";
    for (const word of paragraph.trim().split(/\s+/).filter(Boolean)) {
      const candidate = line ? `${line} ${word}` : word;
      if (font.widthOfTextAtSize(candidate, size) <= width) { line = candidate; continue; }
      if (line) lines.push(line);
      line = "";
      for (const character of word) {
        if (line && font.widthOfTextAtSize(line + character, size) > width) { lines.push(line); line = ""; }
        line += character;
      }
    }
    lines.push(line);
  }
  return lines.length ? lines : [""];
}

export async function createChurchPdfAssets(document: PDFDocument, logoDataUri: string | null): Promise<ChurchPdfAssets> {
  document.registerFontkit(fontkit);
  fontBytes ??= Promise.all([
    readFile(path.join(process.cwd(), "public/fonts/credential/Rubik-400.ttf")),
    readFile(path.join(process.cwd(), "public/fonts/credential/Rubik-600.ttf")),
  ]);
  const [regularBytes, boldBytes] = await fontBytes;
  const regular = await document.embedFont(regularBytes, { subset: true });
  const bold = await document.embedFont(boldBytes, { subset: true });
  let logo: PDFImage | null = null;
  const match = logoDataUri && /^data:image\/(?:png|jpeg|webp);base64,([A-Za-z0-9+/=]+)$/.exec(logoDataUri);
  if (match) {
    try {
      const png = await sharp(Buffer.from(match[1], "base64"), { limitInputPixels: 20_000_000 })
        .resize(600, 600, { fit: "inside", withoutEnlargement: true }).png().toBuffer();
      logo = await document.embedPng(png);
    } catch { /* The identity remains printable when a configured logo is invalid. */ }
  }
  return { regular, bold, logo };
}

export function drawChurchHeader(page: PDFPage, church: ChurchDocumentIdentity, { regular, bold, logo }: ChurchPdfAssets) {
  const pageWidth = page.getWidth(), pageHeight = page.getHeight();
  const left = logo ? 115 : PAGE_MARGIN;
  const width = pageWidth - PAGE_MARGIN - left;
  const name = wrapPdfText(church.name.toLocaleUpperCase("pt-BR"), bold, 14, width);
  const address = wrapPdfText(church.address, regular, 9, width);
  const contacts = wrapPdfText([church.phone && `Fone: ${church.phone}`, church.document && `CNPJ: ${church.document}`].filter(Boolean).join(" · "), regular, 9, width);
  const height = Math.max(94, 22 + name.length * 17 + 8 + address.length * 12 + 5 + contacts.length * 12 + 15);
  page.drawRectangle({ x: 0, y: pageHeight - height, width: pageWidth, height, color: PDF_COLORS.navy });
  page.drawRectangle({ x: 0, y: pageHeight - height - 6, width: pageWidth, height: 6, color: PDF_COLORS.gold });
  if (logo) {
    page.drawCircle({ x: 68, y: pageHeight - height / 2, size: 32, color: PDF_COLORS.white });
    const dimensions = logo.scaleToFit(55, 55);
    page.drawImage(logo, { x: 68 - dimensions.width / 2, y: pageHeight - height / 2 - dimensions.height / 2, ...dimensions });
  }
  let top = 22;
  for (const line of name) { page.drawText(line, { x: left, y: pageHeight - top - 14, size: 14, font: bold, color: PDF_COLORS.white }); top += 17; }
  top += 8;
  for (const line of address) { page.drawText(line, { x: left, y: pageHeight - top - 9, size: 9, font: regular, color: PDF_COLORS.white }); top += 12; }
  top += 5;
  for (const line of contacts) { page.drawText(line, { x: left, y: pageHeight - top - 9, size: 9, font: regular, color: PDF_COLORS.white }); top += 12; }
  return height;
}

export function formatPdfIssuedAt(issuedAt: string) {
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: "America/Sao_Paulo" }).format(new Date(issuedAt));
}

export function finishChurchPdf(document: PDFDocument, regular: PDFFont, issuedAt: string, title: string) {
  const pages = document.getPages();
  pages.forEach((page, i) => {
    page.drawRectangle({ x: 0, y: 0, width: page.getWidth(), height: 13, color: PDF_COLORS.navy });
    page.drawText(`Emitido em ${formatPdfIssuedAt(issuedAt)}`, { x: PAGE_MARGIN, y: 28, size: 8, font: regular, color: PDF_COLORS.muted });
    const label = `Página ${i + 1} de ${pages.length}`;
    page.drawText(label, { x: page.getWidth() - PAGE_MARGIN - regular.widthOfTextAtSize(label, 8), y: 28, size: 8, font: regular, color: PDF_COLORS.muted });
  });
  document.setTitle(title); document.setAuthor("Eclésias"); document.setCreator("Eclésias"); document.setProducer("Eclésias");
  document.setCreationDate(new Date(issuedAt)); document.setModificationDate(new Date(issuedAt));
  return document.save({ useObjectStreams: false });
}
