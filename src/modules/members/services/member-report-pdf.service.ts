import "server-only";
import { PDFDocument, type PDFPage } from "pdf-lib";
import { createChurchPdfAssets, churchPastorsLabel, drawChurchHeader, drawChurchWatermark, finishChurchPdf, PAGE_HEIGHT, PAGE_MARGIN, PAGE_WIDTH, PDF_COLORS, wrapPdfText } from "@/lib/pdf/church-document";
import { MEMBER_REPORT_TITLES } from "../constants/member-report-fields";
import type { MemberReportDocument } from "../types/member-report.types";

export async function createMemberReportPdf(data: MemberReportDocument): Promise<Uint8Array> {
  const document = await PDFDocument.create(), assets = await createChurchPdfAssets(document, data.church.logoDataUri);
  const { regular, bold } = assets;
  const landscape = data.kind === "custom" && (data.columns.length === 6 || data.columns.some((c) => ["full_address", "notes", "inactive_reason"].includes(c.key)));
  const width = landscape ? PAGE_HEIGHT : PAGE_WIDTH, height = landscape ? PAGE_WIDTH : PAGE_HEIGHT;
  const contentWidth = width - PAGE_MARGIN * 2, bottom = height - 57, title = MEMBER_REPORT_TITLES[data.kind];
  const minimums = data.columns.map((column) => {
    const sample = column.key === "member_code" ? "MEM000000" : column.key === "cpf" ? "000.000.000-00" : column.key === "whatsapp" ? "(00) 00000-0000" : column.format === "date" ? "00/00/0000" : "";
    const heading = Math.max(...column.label.toLocaleUpperCase("pt-BR").split(/\s+/).map((word) => bold.widthOfTextAtSize(word, 8)));
    return Math.max(48, heading + 16, regular.widthOfTextAtSize(sample, 9) + 16);
  });
  const widths = data.columns.map(() => 0), flexible = new Set(data.columns.map((_, i) => i));
  let remainingWidth = contentWidth;
  while (flexible.size) {
    const weights = [...flexible].reduce((sum, i) => sum + data.columns[i].weight, 0);
    const narrow = [...flexible].filter((i) => remainingWidth * data.columns[i].weight / weights < minimums[i]);
    if (!narrow.length) { for (const i of flexible) widths[i] = remainingWidth * data.columns[i].weight / weights; break; }
    for (const i of narrow) { widths[i] = minimums[i]; remainingWidth -= widths[i]; flexible.delete(i); }
  }
  let page: PDFPage, cursor = 0;
  function draw(text: string, x: number, top: number, size = 9, font = regular, color = PDF_COLORS.navy) {
    if (text) page.drawText(text, { x, y: height - top - size, size, font, color });
  }
  function newPage(first = false) {
    page = document.addPage([width, height]); drawChurchWatermark(page, assets);
    if (first) cursor = drawChurchHeader(page, data.church, assets) + 24;
    else {
      cursor = 28;
      for (const line of wrapPdfText(data.church.name, bold, 10, contentWidth)) { draw(line, PAGE_MARGIN, cursor, 10, bold); cursor += 13; }
      for (const line of wrapPdfText(churchPastorsLabel(data.church), regular, 9, contentWidth)) { draw(line, PAGE_MARGIN, cursor); cursor += 12; }
      for (const line of wrapPdfText(title, regular, 10, contentWidth)) { draw(line, PAGE_MARGIN, cursor + 5, 10); cursor += 13; }
      cursor += 17;
      page.drawRectangle({ x: PAGE_MARGIN, y: height - cursor, width: contentWidth, height: 2, color: PDF_COLORS.gold }); cursor += 18;
    }
  }
  function paragraph(text: string, size = 9, font = regular, color = PDF_COLORS.muted) {
    if (!text) return;
    for (const line of wrapPdfText(text, font, size, contentWidth)) {
      if (cursor + size + 5 > bottom) newPage();
      draw(line, PAGE_MARGIN, cursor, size, font, color); cursor += size + 5;
    }
    cursor += 7;
  }
  const headerLines = data.columns.map((c, i) => wrapPdfText(c.label.toLocaleUpperCase("pt-BR"), bold, 8, widths[i] - 14));
  const headerHeight = Math.max(...headerLines.map((lines) => lines.length)) * 11 + 16;
  function header(firstRowSpace = 38) {
    // Keep the heading with at least the first row (or the empty-state message).
    if (cursor + headerHeight + firstRowSpace > bottom) newPage();
    page.drawRectangle({ x: PAGE_MARGIN, y: height - cursor - headerHeight, width: contentWidth, height: headerHeight, color: PDF_COLORS.navy });
    let x = PAGE_MARGIN;
    headerLines.forEach((lines, i) => { lines.forEach((line, n) => draw(line, x + 7, cursor + 8 + n * 11, 8, bold, PDF_COLORS.white)); x += widths[i]; });
    cursor += headerHeight;
  }
  newPage(true);
  paragraph(title.toLocaleUpperCase("pt-BR"), 17, bold, PDF_COLORS.navy);
  paragraph(`${data.rows.length} ${data.rows.length === 1 ? "membro" : "membros"}`);
  paragraph(data.scopeLabel); paragraph(data.filters.join(" · "));
  const firstRow = data.rows[0];
  const firstRowHeight = firstRow ? Math.max(34, Math.max(...data.columns.map((c, i) => wrapPdfText(firstRow.values[c.key] || "Não informado", regular, 9, widths[i] - 14).length)) * 12 + 18) : 38;
  header(Math.min(firstRowHeight, 160));
  if (!data.rows.length) { cursor += 14; paragraph("Nenhum membro encontrado para este relatório.", 10); }
  data.rows.forEach((row, index) => {
    const cells = data.columns.map((c, i) => wrapPdfText(row.values[c.key] || "Não informado", regular, 9, widths[i] - 14));
    const fullHeight = Math.max(34, Math.max(...cells.map((lines) => lines.length)) * 12 + 18);
    if (cursor + Math.min(fullHeight, 160) > bottom) { newPage(); header(); }
    while (cells.some((lines) => lines.length)) {
      if (cursor + 34 > bottom) { newPage(); header(); }
      const capacity = Math.max(1, Math.floor((bottom - cursor - 18) / 12));
      const portions = cells.map((lines) => lines.splice(0, capacity));
      const h = Math.max(34, Math.max(...portions.map((lines) => lines.length)) * 12 + 18);
      page.drawRectangle({ x: PAGE_MARGIN, y: height - cursor - h, width: contentWidth, height: h, color: index % 2 === 0 ? PDF_COLORS.paper : PDF_COLORS.white, opacity: assets.logo ? .3 : 1 });
      let x = PAGE_MARGIN;
      portions.forEach((lines, i) => { lines.forEach((line, n) => draw(line, x + 7, cursor + 9 + n * 12)); x += widths[i]; });
      cursor += h;
      page.drawLine({ start: { x: PAGE_MARGIN, y: height - cursor }, end: { x: width - PAGE_MARGIN, y: height - cursor }, thickness: .5, color: PDF_COLORS.border });
      if (cells.some((lines) => lines.length)) { newPage(); header(); }
    }
  });
  return finishChurchPdf(document, regular, data.issuedAt, title);
}
