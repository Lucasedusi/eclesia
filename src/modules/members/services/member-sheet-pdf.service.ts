import "server-only";

import { PDFDocument, type PDFPage } from "pdf-lib";
import { CONTENT_BOTTOM as BOTTOM, CONTENT_WIDTH, createChurchPdfAssets, drawChurchHeader, finishChurchPdf, PAGE_HEIGHT as HEIGHT, PAGE_MARGIN as MARGIN, PAGE_WIDTH as WIDTH, PDF_COLORS, wrapPdfText as wrap } from "@/lib/pdf/church-document";
import type { MemberSheetDocument } from "../types/member-sheet.types";

const { navy: NAVY, gold: GOLD, muted: MUTED, border: BORDER, paper: PAPER, white: WHITE } = PDF_COLORS;

export async function createMemberSheetPdf(data: MemberSheetDocument): Promise<Uint8Array> {
  const document = await PDFDocument.create();
  const assets = await createChurchPdfAssets(document, data.church.logoDataUri);
  const { regular, bold } = assets;
  let page!: PDFPage;
  let cursor = 0;

  function draw(text: string, x: number, top: number, size = 10, font = regular, color = NAVY) {
    if (text) page.drawText(text, { x, y: HEIGHT - top - size, size, font, color });
  }

  function newPage(first = false) {
    page = document.addPage([WIDTH, HEIGHT]);
    if (first) {
      const headerHeight = drawChurchHeader(page, data.church, assets);
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

  return finishChurchPdf(document, regular, data.issuedAt, "Ficha do membro");
}
