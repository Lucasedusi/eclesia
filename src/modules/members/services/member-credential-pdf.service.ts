import "server-only";

import {
  PDFDocument,
  StandardFonts,
  rgb,
  type PDFFont,
  type PDFPage,
} from "pdf-lib";
import type { MemberCredentialPreview } from "../types/member-credential.types";
import { FAKE_QR_PATTERN } from "./member-credential.logic";

const MM_TO_PT = 72 / 25.4;
export const CR80_WIDTH_PT = 85.6 * MM_TO_PT;
export const CR80_HEIGHT_PT = 53.98 * MM_TO_PT;
const SAFE = 3.2 * MM_TO_PT;
const HEADER_HEIGHT = 12 * MM_TO_PT;
const INK = rgb(16 / 255, 24 / 255, 40 / 255);
const MUTED = rgb(71 / 255, 84 / 255, 103 / 255);
const SURFACE = rgb(242 / 255, 244 / 255, 247 / 255);

type Fonts = { regular: PDFFont; bold: PDFFont };

function hexToRgb(hex: string) {
  return rgb(
    Number.parseInt(hex.slice(1, 3), 16) / 255,
    Number.parseInt(hex.slice(3, 5), 16) / 255,
    Number.parseInt(hex.slice(5, 7), 16) / 255,
  );
}

function cleanText(text: string) {
  return text
    .normalize("NFC")
    .replace(/[\u2010-\u2015]/g, "-")
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/\u2026/g, "...")
    .replace(/\u2022/g, "-")
    .replace(/[^\u0009\u000A\u000D\u0020-\u007E\u00A0-\u00FF]/g, "?");
}

function fitText(text: string, font: PDFFont, size: number, maxWidth: number) {
  const clean = cleanText(text);
  if (font.widthOfTextAtSize(clean, size) <= maxWidth) return clean;
  let value = clean;
  while (
    value.length &&
    font.widthOfTextAtSize(`${value}...`, size) > maxWidth
  ) {
    value = value.slice(0, -1);
  }
  return `${value}...`;
}

function wrapText(
  text: string,
  font: PDFFont,
  size: number,
  width: number,
  maxLines: number,
) {
  const words = cleanText(text).trim().split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  for (const word of words) {
    const candidate = lines.length ? `${lines.at(-1)} ${word}` : word;
    if (font.widthOfTextAtSize(candidate, size) <= width) {
      if (lines.length) lines[lines.length - 1] = candidate;
      else lines.push(candidate);
    } else if (lines.length < maxLines) {
      lines.push(fitText(word, font, size, width));
    } else {
      lines[lines.length - 1] = fitText(
        `${lines.at(-1)} ${word}`,
        font,
        size,
        width,
      );
    }
  }
  return lines.slice(0, maxLines);
}

function drawDecorativeCurves(
  page: PDFPage,
  preview: MemberCredentialPreview,
) {
  page.drawEllipse({
    x: CR80_WIDTH_PT - 8,
    y: 9,
    xScale: 44,
    yScale: 28,
    color: hexToRgb(preview.church.primaryColor),
    opacity: 0.08,
  });
  page.drawEllipse({
    x: 8,
    y: CR80_HEIGHT_PT - HEADER_HEIGHT - 5,
    xScale: 32,
    yScale: 18,
    color: hexToRgb(preview.church.primaryDarkColor),
    opacity: 0.06,
  });
}

function drawHeader(
  page: PDFPage,
  preview: MemberCredentialPreview,
  fonts: Fonts,
) {
  const background = hexToRgb(preview.church.primaryDarkColor);
  const foreground = hexToRgb(preview.church.foregroundColor);
  page.drawRectangle({
    x: 0,
    y: CR80_HEIGHT_PT - HEADER_HEIGHT,
    width: CR80_WIDTH_PT,
    height: HEADER_HEIGHT,
    color: background,
  });
  page.drawText(
    fitText(
      preview.church.name.toUpperCase(),
      fonts.bold,
      8.2,
      CR80_WIDTH_PT - SAFE * 2,
    ),
    {
      x: SAFE,
      y: CR80_HEIGHT_PT - HEADER_HEIGHT + 12,
      size: 8.2,
      font: fonts.bold,
      color: foreground,
    },
  );
}

function drawFakeQr(page: PDFPage, x: number, y: number, size: number) {
  const moduleSize = size / FAKE_QR_PATTERN.length;
  page.drawRectangle({
    x,
    y,
    width: size,
    height: size,
    color: rgb(1, 1, 1),
    borderColor: INK,
    borderWidth: 0.6,
  });
  FAKE_QR_PATTERN.forEach((row, rowIndex) =>
    row.forEach((filled, columnIndex) => {
      if (!filled) return;
      page.drawRectangle({
        x: x + columnIndex * moduleSize,
        y: y + size - (rowIndex + 1) * moduleSize,
        width: moduleSize,
        height: moduleSize,
        color: INK,
      });
    }),
  );
}

function drawLabelValue(
  page: PDFPage,
  fonts: Fonts,
  label: string,
  value: string,
  x: number,
  y: number,
  width: number,
) {
  page.drawText(cleanText(label).toUpperCase(), {
    x,
    y,
    size: 4.5,
    font: fonts.bold,
    color: MUTED,
  });
  page.drawText(fitText(value, fonts.bold, 7.2, width), {
    x,
    y: y - 9,
    size: 7.2,
    font: fonts.bold,
    color: INK,
  });
}

function drawFront(
  page: PDFPage,
  preview: MemberCredentialPreview,
  fonts: Fonts,
) {
  page.drawRectangle({
    x: 0,
    y: 0,
    width: CR80_WIDTH_PT,
    height: CR80_HEIGHT_PT,
    color: rgb(1, 1, 1),
  });
  drawDecorativeCurves(page, preview);
  drawHeader(page, preview, fonts);

  const contentTop = CR80_HEIGHT_PT - HEADER_HEIGHT - 9;
  const leftWidth = (CR80_WIDTH_PT - SAFE * 2) * 0.67;
  const nameLines = wrapText(
    preview.member.fullName,
    fonts.bold,
    10.5,
    leftWidth,
    2,
  );
  nameLines.forEach((line, index) =>
    page.drawText(line, {
      x: SAFE,
      y: contentTop - index * 11,
      size: 10.5,
      font: fonts.bold,
      color: INK,
    }),
  );

  const detailsTop = contentTop - nameLines.length * 11 - 3;
  drawLabelValue(
    page,
    fonts,
    "Cargo",
    preview.member.roleName,
    SAFE,
    detailsTop,
    leftWidth,
  );
  drawLabelValue(
    page,
    fonts,
    "Matrícula",
    preview.member.memberCode,
    SAFE,
    detailsTop - 22,
    leftWidth * 0.42,
  );
  drawLabelValue(
    page,
    fonts,
    "Congregação",
    preview.member.congregationName,
    SAFE + leftWidth * 0.46,
    detailsTop - 22,
    leftWidth * 0.54,
  );

  const qrSize = 42;
  const qrX = CR80_WIDTH_PT - SAFE - qrSize;
  drawFakeQr(page, qrX, 37, qrSize);
  page.drawText("VALIDAÇÃO EM BREVE", {
    x: qrX - 1,
    y: 27,
    size: 4.2,
    font: fonts.bold,
    color: MUTED,
  });
}

function drawBack(
  page: PDFPage,
  preview: MemberCredentialPreview,
  fonts: Fonts,
) {
  page.drawRectangle({
    x: 0,
    y: 0,
    width: CR80_WIDTH_PT,
    height: CR80_HEIGHT_PT,
    color: SURFACE,
  });
  drawDecorativeCurves(page, preview);
  drawHeader(page, preview, fonts);
  const width = CR80_WIDTH_PT - SAFE * 2;
  drawLabelValue(
    page,
    fonts,
    "Data do batismo",
    preview.member.baptismDate,
    SAFE,
    105,
    width,
  );
  drawLabelValue(
    page,
    fonts,
    "Nome da mãe",
    preview.member.motherName,
    SAFE,
    76,
    width,
  );
  drawLabelValue(
    page,
    fonts,
    "Nome do pai",
    preview.member.fatherName,
    SAFE,
    47,
    width,
  );
  page.drawText("Documento de identificação eclesiástica", {
    x: SAFE,
    y: SAFE,
    size: 4.5,
    font: fonts.regular,
    color: MUTED,
  });
}

export async function createMemberCredentialPdf(
  preview: MemberCredentialPreview,
): Promise<Uint8Array> {
  const document = await PDFDocument.create();
  const fonts = {
    regular: await document.embedFont(StandardFonts.Helvetica),
    bold: await document.embedFont(StandardFonts.HelveticaBold),
  };
  const front = document.addPage([CR80_WIDTH_PT, CR80_HEIGHT_PT]);
  const back = document.addPage([CR80_WIDTH_PT, CR80_HEIGHT_PT]);

  drawFront(front, preview, fonts);
  drawBack(back, preview, fonts);

  document.setTitle("Credencial física de membro");
  document.setAuthor("Eclésias");
  document.setSubject("Documento de identificação eclesiástica");
  document.setCreator("Eclésias");
  document.setProducer("Eclésias");
  document.setCreationDate(new Date(preview.issuedAt));

  return document.save();
}
