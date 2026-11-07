import "server-only";

import { PDFDocument, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import { createChurchPdfAssets, drawChurchHeader, drawChurchWatermark, finishChurchPdf, PAGE_HEIGHT, PAGE_MARGIN, PAGE_WIDTH, PDF_COLORS, wrapPdfText } from "@/lib/pdf/church-document";
import type { CongregationReportDocument, ReportCongregation } from "../types/congregation-report.types";

export async function createCongregationReportPdf(data: CongregationReportDocument): Promise<Uint8Array> {
  const document = await PDFDocument.create();
  const assets = await createChurchPdfAssets(document, data.church.logoDataUri);
  const { regular, bold } = assets;
  const landscape = data.kind === "simplified" && data.fields.address;
  const width = landscape ? PAGE_HEIGHT : PAGE_WIDTH, height = landscape ? PAGE_WIDTH : PAGE_HEIGHT;
  const contentWidth = width - PAGE_MARGIN * 2, bottom = height - 57;
  const title = data.kind === "simplified" ? "Lista de Congregações" : data.congregations[0]?.name || "Congregação";
  const congregation = data.kind === "individual" ? data.congregations[0] : undefined;
  const presidents = (data.church.pastorNames ?? []).map((name) => name.trim()).filter(Boolean);
  const detailLines = [
    ...(presidents.length ? [`Presidentes: ${presidents.join(" e ")}`] : []),
    ...(congregation ? [`Dirigente: ${congregation.pastorName} · Cônjuge: ${congregation.spouseName || "Não informado"} · WhatsApp: ${congregation.whatsapp || "Não informado"}`] : []),
  ];
  let page: PDFPage, cursor = 0;
  function draw(text: string, x: number, top: number, size = 10, font = regular, color = PDF_COLORS.navy) {
    if (text) page.drawText(text, { x, y: height - top - size, size, font, color });
  }
  function newPage() {
    page = document.addPage([width, height]);
    drawChurchWatermark(page, assets);
    cursor = drawChurchHeader(page, data.church, assets, { detailLines }) + 28;
  }
  function paragraph(text: string, size = 10, font = regular, color = PDF_COLORS.navy, gapAfter = 8) {
    for (const line of wrapPdfText(text, font, size, contentWidth)) {
      if (cursor + size + 5 > bottom) newPage();
      draw(line, PAGE_MARGIN, cursor, size, font, color); cursor += size + 5;
    }
    cursor += gapAfter;
  }
  function heading(text: string) {
    if (cursor + 70 > bottom) newPage();
    paragraph(text.toLocaleUpperCase("pt-BR"), 12, bold);
  }
  type Line = { text: string; size: number; font: PDFFont; muted?: boolean };
  function list() {
    type Column = { label: string; weight: number; fixed?: number; value: (r: ReportCongregation, index: number) => string };
    const columns: Column[] = [
      { label: "Nº", weight: 0, fixed: 40, value: (_, i) => String(i + 1) },
      { label: "Congregação", weight: 1.6, value: (r) => r.name },
      { label: "Dirigente", weight: 1.2, value: (r) => r.pastorName },
      ...(data.fields.spouse ? [{ label: "Cônjuge", weight: 1, value: (r: ReportCongregation) => r.spouseName || "Não informado" }] : []),
      ...(data.fields.phone ? [{ label: "WhatsApp", weight: 0, fixed: 108, value: (r: ReportCongregation) => r.contactPhone || "Não informado" }] : []),
      ...(data.fields.address ? [{ label: "Endereço", weight: 2.1, value: (r: ReportCongregation) => r.address?.full || "Não informado" }] : []),
    ];
    const remaining = contentWidth - columns.reduce((sum, c) => sum + (c.fixed ?? 0), 0);
    const weights = columns.reduce((sum, c) => sum + c.weight, 0);
    const widths = columns.map((c) => c.fixed ?? remaining * c.weight / weights);
    const padding = (i: number) => i === 0 ? 4 : 8;
    function header() {
      if (cursor + 60 > bottom) newPage();
      const labels = columns.map((c, i) => wrapPdfText(c.label.toLocaleUpperCase("pt-BR"), bold, 8, widths[i] - padding(i) * 2));
      const h = Math.max(...labels.map((l) => l.length)) * 11 + 18;
      page.drawRectangle({ x: PAGE_MARGIN, y: height - cursor - h, width: contentWidth, height: h, color: PDF_COLORS.navy });
      let x = PAGE_MARGIN;
      labels.forEach((lines, i) => { lines.forEach((line, n) => draw(line, x + padding(i), cursor + 8 + n * 11, 8, bold, PDF_COLORS.white)); x += widths[i]; });
      cursor += h;
    }
    header();
    if (!data.congregations.length) { cursor += 14; paragraph("Nenhuma congregação encontrada para este relatório.", 10, regular, PDF_COLORS.muted); return; }
    data.congregations.forEach((row, index) => {
      const cells = columns.map((column, i): Line[] => {
        const lines = wrapPdfText(column.value(row, index), regular, 9.5, widths[i] - padding(i) * 2).map((text) => ({ text, size: 9.5, font: regular }));
        if (i === 1) return [...lines, ...wrapPdfText(row.regionName, regular, 8, widths[i] - 16).map((text) => ({ text, size: 8, font: regular, muted: true }))];
        return lines;
      });
      const fullHeight = Math.max(36, Math.max(...cells.map((c) => c.length)) * 13 + 18);
      if (cursor + Math.min(fullHeight, 160) > bottom) { newPage(); header(); }
      while (cells.some((c) => c.length)) {
        if (cursor + 36 > bottom) { newPage(); header(); }
        const capacity = Math.max(1, Math.floor((bottom - cursor - 18) / 13));
        const portions = cells.map((c) => c.splice(0, capacity));
        const h = Math.max(36, Math.max(...portions.map((c) => c.length)) * 13 + 18);
        page.drawRectangle({ x: PAGE_MARGIN, y: height - cursor - h, width: contentWidth, height: h, color: index % 2 === 0 ? PDF_COLORS.paper : PDF_COLORS.white, opacity: assets.logo ? 0.3 : 1 });
        let x = PAGE_MARGIN;
        portions.forEach((lines, i) => { lines.forEach((line, n) => draw(line.text, x + padding(i), cursor + 9 + n * 13, line.size, line.font, line.muted ? PDF_COLORS.muted : PDF_COLORS.navy)); x += widths[i]; });
        cursor += h;
        page.drawLine({ start: { x: PAGE_MARGIN, y: height - cursor }, end: { x: width - PAGE_MARGIN, y: height - cursor }, thickness: 0.5, color: PDF_COLORS.border });
        if (cells.some((c) => c.length)) { newPage(); header(); }
      }
    });
  }
  function fields(section: string, values: [string, string | undefined][]) {
    heading(section);
    const gap = 20, cellWidth = (contentWidth - gap * 2) / 3;
    for (let index = 0; index < values.length; index += 3) {
      const cells = values.slice(index, index + 3).map(([label, value]) => ({ label, lines: wrapPdfText(value || "Não informado", regular, 10, cellWidth) }));
      const fullHeight = 18 + Math.max(...cells.map((c) => c.lines.length)) * 14 + 16;
      if (cursor + Math.min(fullHeight, 160) > bottom) { newPage(); heading(`${section} · continuação`); }
      while (cells.some((c) => c.lines.length)) {
        if (cursor + 48 > bottom) { newPage(); heading(`${section} · continuação`); }
        const capacity = Math.max(1, Math.floor((bottom - cursor - 34) / 14));
        const portions = cells.map((c) => c.lines.splice(0, capacity));
        cells.forEach((cell, i) => {
          if (!portions[i].length) return;
          const x = PAGE_MARGIN + i * (cellWidth + gap);
          draw(cell.label.toLocaleUpperCase("pt-BR"), x, cursor, 8, regular, rgb(0.46, 0.46, 0.46));
          portions[i].forEach((line, n) => draw(line, x, cursor + 18 + n * 14, 10, regular, rgb(0.08, 0.10, 0.14)));
        });
        cursor += 34 + Math.max(...portions.map((p) => p.length)) * 14;
      }
    }
    cursor += 10;
  }
  newPage();
  if (data.kind === "simplified") {
    paragraph(title.toLocaleUpperCase("pt-BR"), 18, bold, PDF_COLORS.navy, 0);
    paragraph(`${data.congregations.length} ${data.congregations.length === 1 ? "congregação" : "congregações"}`, 9, regular, PDF_COLORS.muted, 24);
    if (data.scopeLabel) paragraph(data.scopeLabel, 9, regular, PDF_COLORS.muted);
    if (data.filters.length) paragraph(data.filters.join(" · "), 9, regular, PDF_COLORS.muted);
    list();
  } else {
    const row = data.congregations[0];
    paragraph(title.toLocaleUpperCase("pt-BR"), 18, bold, PDF_COLORS.navy, 0);
    paragraph(row?.regionName || "Sem regional", 10, regular, PDF_COLORS.muted, 24);
    if (data.scopeLabel) paragraph(data.scopeLabel, 9, regular, PDF_COLORS.muted);
    fields("Endereço", [["Logradouro e número", row?.address?.street], ...(row?.address?.complement ? [["Complemento", row.address.complement] as [string, string]] : []), ["Bairro", row?.address?.district], ["Cidade", row?.address?.city], ["Estado", row?.address?.state], ["CEP", row?.address?.zipCode]]);
    if (row?.notes) { heading("Observação"); paragraph(row.notes); }
  }
  return finishChurchPdf(document, regular, data.issuedAt, title);
}
