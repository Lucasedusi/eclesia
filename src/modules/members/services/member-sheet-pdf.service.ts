import "server-only";

import { readFile } from "node:fs/promises";
import path from "node:path";
import fontkit from "@pdf-lib/fontkit";
import { PDFDocument, type PDFFont, type PDFImage, type PDFPage, rgb } from "pdf-lib";
import sharp from "sharp";
import type { MemberSheetDocument } from "../types/member-sheet.types";

const WIDTH = 595.28;
const HEIGHT = 841.89;
const MARGIN = 36;
const CONTENT_WIDTH = WIDTH - MARGIN * 2;
const BOTTOM = HEIGHT - 57;
const NAVY = rgb(0.04, 0.16, 0.31);
const GOLD = rgb(0.86, 0.69, 0.23);
const MUTED = rgb(0.36, 0.42, 0.51);
const BORDER = rgb(0.80, 0.83, 0.87);
const PAPER = rgb(0.973, 0.974, 0.977);
const WHITE = rgb(1, 1, 1);

let fontBytes: Promise<Buffer[]> | undefined;
function loadFonts() {
  fontBytes ??= Promise.all([
    readFile(path.join(process.cwd(), "public/fonts/credential/Rubik-400.ttf")),
    readFile(path.join(process.cwd(), "public/fonts/credential/Rubik-600.ttf")),
  ]);
  return fontBytes;
}

function wrap(text: string, font: PDFFont, size: number, width: number): string[] {
  const lines: string[] = [];
  for (const paragraph of text.replace(/→/g, "para").replace(/\r\n?/g, "\n").replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, "").split("\n")) {
    let line = "";
    for (const word of paragraph.trim().split(/\s+/).filter(Boolean)) {
      const candidate = line ? `${line} ${word}` : word;
      if (font.widthOfTextAtSize(candidate, size) <= width) { line = candidate; continue; }
      if (line) lines.push(line);
      line = "";
      // Long e-mail addresses and unbroken values must wrap too.
      for (const character of word) {
        if (line && font.widthOfTextAtSize(line + character, size) > width) {
          lines.push(line);
          line = "";
        }
        line += character;
      }
    }
    lines.push(line);
  }
  return lines.length ? lines : [""];
}

async function embedLogo(document: PDFDocument, dataUri: string | null): Promise<PDFImage | null> {
  if (!dataUri) return null;
  const match = /^data:image\/(?:png|jpeg|webp);base64,([A-Za-z0-9+/=]+)$/.exec(dataUri);
  if (!match) return null;
  try {
    const png = await sharp(Buffer.from(match[1], "base64"), { limitInputPixels: 20_000_000 })
      .resize(600, 600, { fit: "inside", withoutEnlargement: true }).png().toBuffer();
    return await document.embedPng(png);
  } catch { return null; }
}

export async function createMemberSheetPdf(data: MemberSheetDocument): Promise<Uint8Array> {
  const document = await PDFDocument.create();
  document.registerFontkit(fontkit);
  const [regularBytes, boldBytes] = await loadFonts();
  const regular = await document.embedFont(regularBytes, { subset: true });
  const bold = await document.embedFont(boldBytes, { subset: true });
  const logo = await embedLogo(document, data.church.logoDataUri);
  let page!: PDFPage;
  let cursor = 0;

  function draw(text: string, x: number, top: number, size = 10, font = regular, color = NAVY) {
    if (text) page.drawText(text, { x, y: HEIGHT - top - size, size, font, color });
  }

  function newPage(first = false) {
    page = document.addPage([WIDTH, HEIGHT]);
    if (first) {
      const left = logo ? 115 : MARGIN;
      const width = WIDTH - MARGIN - left;
      const name = wrap(data.church.name.toLocaleUpperCase("pt-BR"), bold, 14, width);
      const address = wrap(data.church.address, regular, 9, width);
      const contacts = wrap([data.church.phone && `Fone: ${data.church.phone}`, data.church.document && `CNPJ: ${data.church.document}`].filter(Boolean).join(" · "), regular, 9, width);
      const headerHeight = Math.max(94, 22 + name.length * 17 + 8 + address.length * 12 + 5 + contacts.length * 12 + 15);
      page.drawRectangle({ x: 0, y: HEIGHT - headerHeight, width: WIDTH, height: headerHeight, color: NAVY });
      page.drawRectangle({ x: 0, y: HEIGHT - headerHeight - 6, width: WIDTH, height: 6, color: GOLD });
      if (logo) {
        page.drawCircle({ x: 68, y: HEIGHT - headerHeight / 2, size: 32, color: WHITE });
        const dimensions = logo.scaleToFit(55, 55);
        page.drawImage(logo, { x: 68 - dimensions.width / 2, y: HEIGHT - headerHeight / 2 - dimensions.height / 2, ...dimensions });
      }
      let y = 22;
      for (const line of name) { draw(line, left, y, 14, bold, WHITE); y += 17; }
      y += 8;
      for (const line of address) { draw(line, left, y, 9, regular, WHITE); y += 12; }
      y += 5;
      for (const line of contacts) { draw(line, left, y, 9, regular, WHITE); y += 12; }
      cursor = headerHeight + 32;
      for (const line of wrap(data.member.fullName.toLocaleUpperCase("pt-BR"), bold, 20, CONTENT_WIDTH)) {
        draw(line, MARGIN, cursor, 20, bold); cursor += 25;
      }
      cursor += 5;
      const subtitle = [data.member.memberCode, data.member.role, data.member.congregationName].filter(Boolean).join(" · ");
      for (const line of wrap(subtitle, regular, 11, CONTENT_WIDTH)) { draw(line, MARGIN, cursor, 11); cursor += 15; }
      cursor += 34;
    } else {
      let y = 28;
      for (const line of wrap(data.church.name, bold, 10, CONTENT_WIDTH)) { draw(line, MARGIN, y, 10, bold); y += 13; }
      y += 5;
      for (const line of wrap(data.member.fullName, regular, 10, CONTENT_WIDTH)) { draw(line, MARGIN, y, 10); y += 13; }
      if (data.member.memberCode) { draw(data.member.memberCode, MARGIN, y + 3, 8.5, regular, MUTED); y += 15; }
      page.drawRectangle({ x: MARGIN, y: HEIGHT - y - 12, width: CONTENT_WIDTH, height: 2, color: GOLD });
      cursor = y + 32;
    }
  }

  function heading(title: string) {
    for (const line of wrap(title.toLocaleUpperCase("pt-BR"), bold, 13, CONTENT_WIDTH)) {
      draw(line, MARGIN, cursor, 13, bold); cursor += 17;
    }
    cursor += 16;
  }

  function continueSection(title: string) {
    newPage(); heading(`${title} · continuação`);
  }

  newPage(true);
  const gap = 14;
  const columnWidth = (CONTENT_WIDTH - gap * 2) / 3;
  for (const group of data.groups) {
    if (cursor + 95 > BOTTOM) newPage();
    heading(group.title);
    for (let index = 0; index < group.fields.length; index += 3) {
      const cells = group.fields.slice(index, index + 3).map((field) => ({
        labels: wrap(field.label.toLocaleUpperCase("pt-BR"), bold, 8.5, columnWidth - 24),
        lines: wrap(field.value, regular, 10, columnWidth - 24),
      }));
      const labelHeight = Math.max(...cells.map((cell) => cell.labels.length)) * 10;
      const topPadding = 10 + labelHeight + 5;
      const fullHeight = Math.max(48, topPadding + Math.max(...cells.map((cell) => cell.lines.length)) * 13 + 10);
      if (cursor + Math.min(fullHeight, 160) > BOTTOM) continueSection(group.title);
      while (cells.some((cell) => cell.lines.length)) {
        if (cursor + topPadding + 23 > BOTTOM) continueSection(group.title);
        const capacity = Math.max(1, Math.floor((BOTTOM - cursor - topPadding - 10) / 13));
        const portions = cells.map((cell) => cell.lines.splice(0, capacity));
        const height = Math.max(48, topPadding + Math.max(...portions.map((lines) => lines.length)) * 13 + 10);
        cells.forEach((cell, column) => {
          if (!portions[column].length) return;
          const x = MARGIN + column * (columnWidth + gap);
          page.drawRectangle({ x, y: HEIGHT - cursor - height, width: columnWidth, height, color: PAPER, borderColor: BORDER, borderWidth: 0.6 });
          cell.labels.forEach((line, i) => draw(line, x + 12, cursor + 10 + i * 10, 8.5, bold));
          portions[column].forEach((line, i) => draw(line, x + 12, cursor + topPadding + i * 13, 10));
        });
        cursor += height + 16;
        if (cells.some((cell) => cell.lines.length)) continueSection(group.title);
      }
    }
    cursor += 18;
  }

  if (data.history !== null) {
    newPage(); heading("Linha do tempo");
    if (!data.history.length) draw("Nenhum registro na linha do tempo.", MARGIN, cursor, 10, regular, MUTED);
    for (const item of data.history) {
      if (cursor + 65 > BOTTOM) continueSection("Linha do tempo");
      const left = MARGIN + 14;
      page.drawCircle({ x: MARGIN + 3, y: HEIGHT - cursor - 6, size: 3, color: GOLD });
      draw(item.date, left, cursor, 8.5, bold, MUTED); cursor += 16;
      for (const block of [
        { text: item.title, font: bold, size: 11, line: 15 },
        { text: item.change, font: regular, size: 9.5, line: 13 },
        { text: item.description, font: regular, size: 10, line: 14 },
      ]) {
        if (!block.text) continue;
        for (const line of wrap(block.text, block.font, block.size, CONTENT_WIDTH - 14)) {
          if (cursor + block.line > BOTTOM) continueSection("Linha do tempo");
          draw(line, left, cursor, block.size, block.font); cursor += block.line;
        }
        cursor += 4;
      }
      cursor += 16;
    }
  }

  if (data.events !== null) {
    const widths = [CONTENT_WIDTH * 0.43, CONTENT_WIDTH * 0.21, CONTENT_WIDTH * 0.36];
    function tableHeader() {
      page.drawRectangle({ x: MARGIN, y: HEIGHT - cursor - 28, width: CONTENT_WIDTH, height: 28, color: NAVY });
      let x = MARGIN;
      ["EVENTO", "DATA", "LOCAL"].forEach((label, i) => { draw(label, x + 10, cursor + 8, 8.5, bold, WHITE); x += widths[i]; });
      cursor += 28;
    }
    function eventPage(continuation: boolean) {
      newPage(); heading(continuation ? "Eventos · continuação" : "Eventos"); tableHeader();
    }
    eventPage(false);
    if (!data.events.length) { cursor += 16; draw("Nenhum evento vinculado ao membro.", MARGIN, cursor, 10, regular, MUTED); }
    data.events.forEach((event, index) => {
      const cells = [event.name, event.date, event.location].map((value, i) => wrap(value, regular, 9.5, widths[i] - 20));
      const height = Math.max(36, Math.max(...cells.map((cell) => cell.length)) * 13 + 18);
      if (cursor + Math.min(height, 160) > BOTTOM) eventPage(true);
      while (cells.some((cell) => cell.length)) {
        if (cursor + 36 > BOTTOM) eventPage(true);
        const capacity = Math.max(1, Math.floor((BOTTOM - cursor - 18) / 13));
        const portions = cells.map((cell) => cell.splice(0, capacity));
        const rowHeight = Math.max(36, Math.max(...portions.map((portion) => portion.length)) * 13 + 18);
        page.drawRectangle({ x: MARGIN, y: HEIGHT - cursor - rowHeight, width: CONTENT_WIDTH, height: rowHeight, color: index % 2 === 0 ? PAPER : WHITE });
        let x = MARGIN;
        portions.forEach((lines, i) => {
          lines.forEach((line, n) => draw(line, x + 10, cursor + 9 + n * 13, 9.5));
          x += widths[i];
        });
        cursor += rowHeight;
        page.drawLine({ start: { x: MARGIN, y: HEIGHT - cursor }, end: { x: WIDTH - MARGIN, y: HEIGHT - cursor }, thickness: 0.5, color: BORDER });
        if (cells.some((cell) => cell.length)) eventPage(true);
      }
    });
  }

  const issued = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: "America/Sao_Paulo" }).format(new Date(data.issuedAt));
  const pages = document.getPages();
  pages.forEach((current, i) => {
    page = current;
    page.drawRectangle({ x: 0, y: 0, width: WIDTH, height: 13, color: NAVY });
    draw(`Emitido em ${issued}`, MARGIN, HEIGHT - 36, 8, regular, MUTED);
    const label = `Página ${i + 1} de ${pages.length}`;
    draw(label, WIDTH - MARGIN - regular.widthOfTextAtSize(label, 8), HEIGHT - 36, 8, regular, MUTED);
  });
  document.setTitle("Ficha do membro");
  document.setAuthor("Eclésias");
  document.setCreator("Eclésias");
  document.setProducer("Eclésias");
  document.setCreationDate(new Date(data.issuedAt));
  document.setModificationDate(new Date(data.issuedAt));
  return document.save({ useObjectStreams: false });
}
