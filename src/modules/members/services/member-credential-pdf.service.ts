import "server-only";

import { readFile } from "node:fs/promises";
import path from "node:path";
import { Resvg } from "@resvg/resvg-js";
import fontkit from "@pdf-lib/fontkit";
import { PDFDocument, PDFFont, PDFPage, StandardFonts, rgb } from "pdf-lib";
import sharp from "sharp";
import type { MemberCredentialPdfFormat, MemberCredentialPreview } from "../types/member-credential.types";
import { renderMemberCredentialPrintSvg } from "./member-credential-svg.service";

const MM_TO_PT = 72 / 25.4;
const mm = (value: number) => value * MM_TO_PT;
const BLEED_MM = 3;
const PRINT_DPI = 600;
const CARD_WIDTH_MM = 85.6;
const CARD_HEIGHT_MM = 53.98;
const FOLD_WIDTH_MM = CARD_WIDTH_MM * 2;
const FOLD_LEFT_MM = (210 - FOLD_WIDTH_MM) / 2;
const FOLD_BOTTOM_MM = 175;

export const PRINT_BLEED_PT = mm(BLEED_MM);
export const CR80_WIDTH_PT = mm(CARD_WIDTH_MM);
export const CR80_HEIGHT_PT = mm(CARD_HEIGHT_MM);
export const A4_WIDTH_PT = mm(210);
export const A4_HEIGHT_PT = mm(297);

const FONT_FILES = [
  path.join(process.cwd(), "public/fonts/credential/Rubik-400.ttf"),
  path.join(process.cwd(), "public/fonts/credential/Rubik-500.ttf"),
  path.join(process.cwd(), "public/fonts/credential/Rubik-550.ttf"),
  path.join(process.cwd(), "public/fonts/credential/Rubik-600.ttf"),
  path.join(process.cwd(), "public/fonts/credential/Rubik-650.ttf"),
  path.join(process.cwd(), "public/fonts/credential/Rubik-750.ttf"),
];
const FONT_WEIGHTS = [400, 500, 550, 600, 650, 750] as const;
let fontBytesPromise: Promise<Buffer[]> | null = null;

async function preparePrintPreview(preview: MemberCredentialPreview): Promise<MemberCredentialPreview> {
  const logo = preview.church.logoDataUri;
  const prefix = "data:image/webp;base64,";
  if (!logo?.startsWith(prefix)) return preview;
  const png = await sharp(Buffer.from(logo.slice(prefix.length), "base64"), {
    limitInputPixels: 20_000_000,
  }).resize(1200, 1200, { fit: "inside", withoutEnlargement: true }).png().toBuffer();
  return {
    ...preview,
    church: { ...preview.church, logoDataUri: `data:image/png;base64,${png.toString("base64")}` },
  };
}

function loadFontBytes() {
  fontBytesPromise ??= Promise.all([
    readFile(path.join(process.cwd(), "public/fonts/credential/Rubik-400.ttf")),
    readFile(path.join(process.cwd(), "public/fonts/credential/Rubik-500.ttf")),
    readFile(path.join(process.cwd(), "public/fonts/credential/Rubik-550.ttf")),
    readFile(path.join(process.cwd(), "public/fonts/credential/Rubik-600.ttf")),
    readFile(path.join(process.cwd(), "public/fonts/credential/Rubik-650.ttf")),
    readFile(path.join(process.cwd(), "public/fonts/credential/Rubik-750.ttf")),
  ]);
  return fontBytesPromise;
}

type SvgText = {
  value: string;
  x: number;
  y: number;
  size: number;
  weight: number;
  fill: string;
  anchor: string;
  tracking: number;
  textLength?: number;
};

function unescapeXml(value: string) {
  return value
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&");
}

function takeVectorElements(svg: string) {
  const texts: SvgText[] = [];
  let backgroundSvg = svg.replace(/<text\b([^>]*)>([\s\S]*?)<\/text>/g, (_, attrs: string, value: string) => {
    const attributes = Object.fromEntries(
      Array.from(attrs.matchAll(/([\w-]+)="([^"]*)"/g), ([, key, content]) => [key, content]),
    );
    texts.push({
      value: unescapeXml(value),
      x: Number(attributes.x),
      y: Number(attributes.y),
      size: Number(attributes["font-size"]),
      weight: Number(attributes["font-weight"]),
      fill: attributes.fill,
      anchor: attributes["text-anchor"],
      tracking: Number(attributes["letter-spacing"] ?? 0),
      textLength: attributes.textLength ? Number(attributes.textLength) : undefined,
    });
    return "";
  });
  backgroundSvg = backgroundSvg.replace(/<g fill="#000">[\s\S]*?<\/g>/, "");
  return { backgroundSvg, texts };
}

function svgColor(value: string) {
  const hex = value.replace("#", "");
  return rgb(
    parseInt(hex.slice(0, 2), 16) / 255,
    parseInt(hex.slice(2, 4), 16) / 255,
    parseInt(hex.slice(4, 6), 16) / 255,
  );
}

async function embedCredentialFonts(document: PDFDocument) {
  document.registerFontkit(fontkit);
  const bytes = await loadFontBytes();
  const fonts = await Promise.all(bytes.map((data) => document.embedFont(data, { subset: true })));
  return new Map<number, PDFFont>(FONT_WEIGHTS.map((weight, index) => [weight, fonts[index]]));
}

function drawSvgTexts(
  page: PDFPage,
  texts: SvgText[],
  fonts: Map<number, PDFFont>,
  trimLeft: number,
  trimBottom: number,
) {
  for (const item of texts) {
    const font = fonts.get(item.weight) ?? fonts.get(600)!;
    const size = mm(item.size / 10);
    const tracking = mm(item.tracking / 10);
    const characters = Array.from(item.value);
    const naturalWidth = font.widthOfTextAtSize(item.value, size) + tracking * Math.max(0, characters.length - 1);
    const targetWidth = item.textLength ? mm(item.textLength / 10) : naturalWidth;
    let x = trimLeft + mm(item.x / 10);
    if (item.anchor === "middle") x -= targetWidth / 2;
    if (item.anchor === "end") x -= targetWidth;
    const y = trimBottom + CR80_HEIGHT_PT - mm(item.y / 10);
    const color = svgColor(item.fill);
    if (item.tracking === 0 && !item.textLength) {
      page.drawText(item.value, { x, y, size, font, color });
      continue;
    }
    const scale = item.textLength && naturalWidth > 0 ? targetWidth / naturalWidth : 1;
    for (const character of characters) {
      page.drawText(character, { x, y, size, font, color });
      x += (font.widthOfTextAtSize(character, size) + tracking) * scale;
    }
  }
}

function drawQr(page: PDFPage, preview: MemberCredentialPreview, trimLeft: number, trimBottom: number) {
  const matrix = preview.validation.qrMatrix;
  if (!matrix.length) return;
  const moduleSize = 204 / (matrix.length + 8);
  for (let row = 0; row < matrix.length; row += 1) {
    for (let column = 0; column < matrix[row].length; column += 1) {
      if (!matrix[row][column]) continue;
      page.drawRectangle({
        x: trimLeft + mm((54 + (column + 4) * moduleSize) / 10),
        y: trimBottom + CR80_HEIGHT_PT - mm((254 + (row + 5) * moduleSize) / 10),
        width: mm((moduleSize + 0.04) / 10),
        height: mm((moduleSize + 0.04) / 10),
        color: rgb(0, 0, 0),
      });
    }
  }
}

function renderSvgToPng(svg: string, widthMm: number) {
  return new Resvg(svg, {
    fitTo: { mode: "width", value: Math.round((widthMm / 25.4) * PRINT_DPI) },
    font: {
      fontFiles: FONT_FILES,
      loadSystemFonts: false,
      defaultFontFamily: "CredentialRubik",
    },
    shapeRendering: 2,
    textRendering: 1,
    imageRendering: 0,
  }).render().asPng();
}

function mark(page: PDFPage, x1: number, y1: number, x2: number, y2: number) {
  page.drawLine({
    start: { x: mm(x1), y: mm(y1) },
    end: { x: mm(x2), y: mm(y2) },
    thickness: 0.35,
    color: rgb(0.11, 0.18, 0.29),
  });
}

function addCutAndFoldMarks(page: PDFPage) {
  const left = FOLD_LEFT_MM;
  const right = FOLD_LEFT_MM + FOLD_WIDTH_MM;
  const bottom = FOLD_BOTTOM_MM;
  const top = FOLD_BOTTOM_MM + CARD_HEIGHT_MM;
  for (const x of [left, right]) {
    for (const y of [bottom, top]) {
      const directionX = x === left ? -1 : 1;
      const directionY = y === bottom ? -1 : 1;
      mark(page, x + directionX * 4, y, x + directionX * 8, y);
      mark(page, x, y + directionY * 4, x, y + directionY * 8);
    }
  }
  const fold = left + CARD_WIDTH_MM;
  mark(page, fold, top + 4, fold, top + 8);
  mark(page, fold, bottom - 8, fold, bottom - 4);
}

async function addFoldSheet(document: PDFDocument, preview: MemberCredentialPreview, fonts: Map<number, PDFFont>) {
  const page = document.addPage([A4_WIDTH_PT, A4_HEIGHT_PT]);
  const backSvg = renderMemberCredentialPrintSvg(preview, "back", {
    left: BLEED_MM, right: 0, top: BLEED_MM, bottom: BLEED_MM,
  });
  const frontSvg = renderMemberCredentialPrintSvg(preview, "front", {
    left: 0, right: BLEED_MM, top: BLEED_MM, bottom: BLEED_MM,
  });
  const backArt = takeVectorElements(backSvg);
  const frontArt = takeVectorElements(frontSvg);
  const [back, front] = await Promise.all([
    document.embedPng(renderSvgToPng(backArt.backgroundSvg, CARD_WIDTH_MM + BLEED_MM)),
    document.embedPng(renderSvgToPng(frontArt.backgroundSvg, CARD_WIDTH_MM + BLEED_MM)),
  ]);
  page.drawImage(back, {
    x: mm(FOLD_LEFT_MM - BLEED_MM),
    y: mm(FOLD_BOTTOM_MM - BLEED_MM),
    width: mm(CARD_WIDTH_MM + BLEED_MM),
    height: mm(CARD_HEIGHT_MM + BLEED_MM * 2),
  });
  page.drawImage(front, {
    x: mm(FOLD_LEFT_MM + CARD_WIDTH_MM),
    y: mm(FOLD_BOTTOM_MM - BLEED_MM),
    width: mm(CARD_WIDTH_MM + BLEED_MM),
    height: mm(CARD_HEIGHT_MM + BLEED_MM * 2),
  });
  drawSvgTexts(page, backArt.texts, fonts, mm(FOLD_LEFT_MM), mm(FOLD_BOTTOM_MM));
  drawSvgTexts(page, frontArt.texts, fonts, mm(FOLD_LEFT_MM + CARD_WIDTH_MM), mm(FOLD_BOTTOM_MM));
  drawQr(page, preview, mm(FOLD_LEFT_MM + CARD_WIDTH_MM), mm(FOLD_BOTTOM_MM));
  addCutAndFoldMarks(page);

  const font = await document.embedFont(StandardFonts.Helvetica);
  const ink = rgb(0.16, 0.23, 0.36);
  const label = "DOBRA";
  const labelSize = 7;
  const labelWidth = font.widthOfTextAtSize(label, labelSize);
  page.drawText(label, {
    x: mm(FOLD_LEFT_MM + CARD_WIDTH_MM) - labelWidth / 2,
    y: mm(FOLD_BOTTOM_MM + CARD_HEIGHT_MM + 10.5),
    size: labelSize, font, color: ink,
  });
  page.drawText("Imprima em tamanho real (100%), sem ajustar à página.", {
    x: mm(FOLD_LEFT_MM), y: mm(FOLD_BOTTOM_MM - 19), size: 8.5, font, color: ink,
  });
  page.drawText("Recorte nas marcas externas e dobre na marca central, com a arte para fora.", {
    x: mm(FOLD_LEFT_MM), y: mm(FOLD_BOTTOM_MM - 25), size: 8.5, font, color: ink,
  });
}

async function addPvcPages(document: PDFDocument, preview: MemberCredentialPreview, fonts: Map<number, PDFFont>) {
  const width = CARD_WIDTH_MM + BLEED_MM * 2;
  const height = CARD_HEIGHT_MM + BLEED_MM * 2;
  for (const side of ["front", "back"] as const) {
    const svg = renderMemberCredentialPrintSvg(preview, side, {
      left: BLEED_MM, right: BLEED_MM, top: BLEED_MM, bottom: BLEED_MM,
    });
    const art = takeVectorElements(svg);
    const image = await document.embedPng(renderSvgToPng(art.backgroundSvg, width));
    const page = document.addPage([mm(width), mm(height)]);
    page.drawImage(image, { x: 0, y: 0, width: mm(width), height: mm(height) });
    drawSvgTexts(page, art.texts, fonts, PRINT_BLEED_PT, PRINT_BLEED_PT);
    if (side === "front") drawQr(page, preview, PRINT_BLEED_PT, PRINT_BLEED_PT);
    page.setTrimBox(PRINT_BLEED_PT, PRINT_BLEED_PT, CR80_WIDTH_PT, CR80_HEIGHT_PT);
    page.setBleedBox(0, 0, mm(width), mm(height));
  }
}

export async function createMemberCredentialPdf(
  preview: MemberCredentialPreview,
  format: MemberCredentialPdfFormat = "fold",
): Promise<Uint8Array> {
  const printPreview = await preparePrintPreview(preview);
  const document = await PDFDocument.create();
  const fonts = await embedCredentialFonts(document);
  if (format === "pvc") {
    await addPvcPages(document, printPreview, fonts);
  } else {
    await addFoldSheet(document, printPreview, fonts);
  }

  document.setTitle("Credencial física de membro");
  document.setAuthor("Eclésias");
  document.setSubject("Documento de identificação eclesiástica");
  document.setCreator("Eclésias");
  document.setProducer("Eclésias");
  document.setCreationDate(new Date(preview.issuedAt));

  return document.save({ useObjectStreams: false });
}
