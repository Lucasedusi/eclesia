import "server-only";

import { PDFDocument, type PDFFont, type PDFPage } from "pdf-lib";
import { CONTENT_BOTTOM, CONTENT_WIDTH, createChurchPdfAssets, drawChurchHeader, finishChurchPdf, PAGE_HEIGHT, PAGE_MARGIN, PAGE_WIDTH, PDF_COLORS, wrapPdfText } from "@/lib/pdf/church-document";
import type { RegionReportDocument } from "../types/region-report.types";

export async function createRegionReportPdf(data: RegionReportDocument): Promise<Uint8Array> {
  const document = await PDFDocument.create();
  const assets = await createChurchPdfAssets(document, data.church.logoDataUri);
  const { regular, bold } = assets;
  const title = data.kind === "simplified" ? "Lista de Regionais" : data.region?.name ?? "Regional";
  const identity = data.region?.name ?? title;
  let page: PDFPage;
  let cursor = 0;

  function draw(text: string, x: number, top: number, size = 10, font: PDFFont = regular, color = PDF_COLORS.navy) {
    if (text) page.drawText(text, { x, y: PAGE_HEIGHT - top - size, size, font, color });
  }
  function newPage(first = false) {
    page = document.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
    if (first) cursor = drawChurchHeader(page, data.church, assets) + 28;
    else {
      cursor = 28;
      for (const line of wrapPdfText(data.church.name, bold, 10, CONTENT_WIDTH)) { draw(line, PAGE_MARGIN, cursor, 10, bold); cursor += 13; }
      for (const line of wrapPdfText(identity, regular, 10, CONTENT_WIDTH)) { draw(line, PAGE_MARGIN, cursor + 5); cursor += 13; }
      cursor += 17;
      page.drawRectangle({ x: PAGE_MARGIN, y: PAGE_HEIGHT - cursor, width: CONTENT_WIDTH, height: 2, color: PDF_COLORS.gold });
      cursor += 18;
    }
  }
  function paragraph(text: string, size = 10, font: PDFFont = regular, color = PDF_COLORS.navy) {
    for (const line of wrapPdfText(text, font, size, CONTENT_WIDTH)) {
      if (cursor + size + 5 > CONTENT_BOTTOM) newPage();
      draw(line, PAGE_MARGIN, cursor, size, font, color); cursor += size + 5;
    }
    cursor += 8;
  }
  function heading(text: string) {
    if (cursor + 65 > CONTENT_BOTTOM) newPage();
    paragraph(text.toLocaleUpperCase("pt-BR"), 12, bold);
  }
  function table(headers: string[], rows: string[][], empty: string) {
    const dataWidth = CONTENT_WIDTH - 44;
    const widths = [44, dataWidth * 0.38, dataWidth * 0.36, dataWidth * 0.26];
    const padding = (column: number) => column === 0 ? 6 : 10;
    function header() {
      if (cursor + 65 > CONTENT_BOTTOM) newPage();
      const labels = ["Nº", ...headers].map((label, i) => wrapPdfText(label.toLocaleUpperCase("pt-BR"), bold, 8, widths[i] - padding(i) * 2));
      const height = Math.max(...labels.map((lines) => lines.length)) * 11 + 18;
      page.drawRectangle({ x: PAGE_MARGIN, y: PAGE_HEIGHT - cursor - height, width: CONTENT_WIDTH, height, color: PDF_COLORS.navy });
      let x = PAGE_MARGIN;
      labels.forEach((lines, i) => { lines.forEach((line, n) => draw(line, x + padding(i), cursor + 8 + n * 11, 8, bold, PDF_COLORS.white)); x += widths[i]; });
      cursor += height;
    }
    header();
    if (!rows.length) { cursor += 14; paragraph(empty, 10, regular, PDF_COLORS.muted); return; }
    rows.forEach((row, index) => {
      const cells = [String(index + 1), ...row].map((value, i) => wrapPdfText(value, regular, 9.5, widths[i] - padding(i) * 2));
      const height = Math.max(36, Math.max(...cells.map((cell) => cell.length)) * 13 + 18);
      if (cursor + Math.min(height, 160) > CONTENT_BOTTOM) { newPage(); header(); }
      while (cells.some((cell) => cell.length)) {
        if (cursor + 36 > CONTENT_BOTTOM) { newPage(); header(); }
        const capacity = Math.max(1, Math.floor((CONTENT_BOTTOM - cursor - 18) / 13));
        const portions = cells.map((cell) => cell.splice(0, capacity));
        const rowHeight = Math.max(36, Math.max(...portions.map((lines) => lines.length)) * 13 + 18);
        page.drawRectangle({ x: PAGE_MARGIN, y: PAGE_HEIGHT - cursor - rowHeight, width: CONTENT_WIDTH, height: rowHeight, color: index % 2 === 0 ? PDF_COLORS.paper : PDF_COLORS.white });
        let x = PAGE_MARGIN;
        portions.forEach((lines, i) => { lines.forEach((line, n) => draw(line, x + padding(i), cursor + 9 + n * 13, 9.5)); x += widths[i]; });
        cursor += rowHeight;
        page.drawLine({ start: { x: PAGE_MARGIN, y: PAGE_HEIGHT - cursor }, end: { x: PAGE_WIDTH - PAGE_MARGIN, y: PAGE_HEIGHT - cursor }, thickness: 0.5, color: PDF_COLORS.border });
        if (cells.some((cell) => cell.length)) { newPage(); header(); }
      }
    });
  }

  newPage(true);
  paragraph(title.toLocaleUpperCase("pt-BR"), 18, bold);
  const count = data.kind === "simplified" ? data.regions.length : data.congregations.length;
  const countLabel = data.kind === "simplified" ? (count === 1 ? "regional" : "regionais") : (count === 1 ? "congregação" : "congregações");
  paragraph(`${count} ${countLabel}`, 9, regular, PDF_COLORS.muted);
  if (data.scopeLabel) paragraph(data.scopeLabel, 9, regular, PDF_COLORS.muted);
  if (data.kind === "simplified") {
    const activeFilters = data.filters.filter((filter) => filter !== "Ativas e inativas");
    if (activeFilters.length) paragraph(activeFilters.join(" · "), 9, regular, PDF_COLORS.muted);
    table(["Nome da regional", "Coordenador", "Telefone"], data.regions.map((r) => [r.name, r.coordinatorName, r.coordinatorPhone]), "Nenhuma regional encontrada para este relatório.");
  } else if (data.region) {
    const region = data.region;
    paragraph(`Coordenador: ${region.coordinatorName}`);
    paragraph(`Telefone do coordenador: ${region.coordinatorPhone}`);
    cursor += 18;
    if (region.description) { heading("Descrição"); paragraph(region.description); }
    const activeFilters = data.filters.filter((filter) => !/^(Congregações: )?ativas e inativas$/i.test(filter));
    if (activeFilters.length) paragraph(activeFilters.join(" · "), 9, regular, PDF_COLORS.muted);
    table(["Congregação", "Dirigente", "Telefone de contato"], data.congregations.map((c) => [`${c.name}${c.status === "INACTIVE" ? " (Inativa)" : ""}`, c.pastorName, c.contactPhone]), "Nenhuma congregação encontrada para este relatório.");
  }
  return finishChurchPdf(document, regular, data.issuedAt, title);
}
