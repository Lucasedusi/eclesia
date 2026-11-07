import "server-only";
import ExcelJS from "exceljs";
import type { CongregationReportDocument } from "../types/congregation-report.types";
import { formatPdfIssuedAt } from "@/lib/pdf/church-document";

export async function createCongregationReportWorkbook(data: CongregationReportDocument): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook(); workbook.creator = "Eclésias"; workbook.created = new Date(data.issuedAt);
  const headers = ["Nº", "Congregação", "Regional", "Dirigente", ...(data.fields.spouse ? ["Cônjuge"] : []), ...(data.fields.phone ? ["WhatsApp"] : []), ...(data.fields.address ? ["Endereço"] : [])];
  const widths = [8, 36, 30, 30, ...(data.fields.spouse ? [30] : []), ...(data.fields.phone ? [23] : []), ...(data.fields.address ? [65] : [])];
  const sheet = workbook.addWorksheet("Congregações", { views: [{ state: "frozen", ySplit: 6 }],
    pageSetup: { paperSize: 9, orientation: data.fields.address ? "landscape" : "portrait", fitToPage: true, fitToWidth: 1, fitToHeight: 0, printTitlesRow: "1:6" },
    headerFooter: { oddFooter: "&LLista de congregações&R Página &P de &N" } });
  sheet.columns = widths.map((width) => ({ width }));
  [data.church.name, "Lista de Congregações", `Emitido em ${formatPdfIssuedAt(data.issuedAt)} · ${data.congregations.length} ${data.congregations.length === 1 ? "congregação" : "congregações"}`, data.filters.join(" · "), data.scopeLabel].forEach((text, index) => {
    sheet.mergeCells(index + 1, 1, index + 1, headers.length);
    const cell = sheet.getCell(index + 1, 1); cell.value = text;
    cell.font = { name: "Calibri", size: index === 0 ? 16 : 11, bold: index < 2, color: { argb: index < 2 ? "FFFFFFFF" : "FF5C6B82" } };
    cell.alignment = { vertical: "middle", wrapText: true };
    if (index < 2) cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF0A294F" } };
    sheet.getRow(index + 1).height = index === 0 ? 36 : 30;
  });
  sheet.getCell("A2").border = { bottom: { style: "medium", color: { argb: "FFDBB03B" } } };
  sheet.addRow(headers); sheet.getRow(6).height = 30;
  sheet.getRow(6).eachCell((cell) => { cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF0A294F" } }; cell.font = { name: "Calibri", size: 11, bold: true, color: { argb: "FFFFFFFF" } }; });
  data.congregations.forEach((item, index) => {
    const values = [item.name, item.regionName, item.pastorName, ...(data.fields.spouse ? [item.spouseName || "Não informado"] : []), ...(data.fields.phone ? [item.contactPhone || "Não informado"] : []), ...(data.fields.address ? [item.address?.full || "Não informado"] : [])];
    const row = sheet.addRow([index + 1, ...values]);
    row.height = Math.min(409, Math.max(30, ...values.map((text, i) => Math.ceil(text.length / (widths[i + 1] - 3)) * 16 + 12)));
    row.eachCell((cell, column) => { if (column > 1) cell.numFmt = "@"; cell.font = { name: "Calibri", size: 11, color: { argb: "FF0A294F" } }; cell.alignment = { vertical: "middle", wrapText: true }; if (index % 2 === 0) cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF8F8F9" } }; });
  });
  if (!data.congregations.length) { sheet.addRow(["Nenhuma congregação encontrada para este relatório."]); sheet.mergeCells(7, 1, 7, headers.length); sheet.getRow(7).height = 30; }
  sheet.autoFilter = { from: { row: 6, column: 1 }, to: { row: Math.max(6, 6 + data.congregations.length), column: headers.length } };
  sheet.pageSetup.printArea = `A1:${sheet.getColumn(headers.length).letter}${sheet.rowCount}`;
  return Buffer.from(await workbook.xlsx.writeBuffer());
}
