import "server-only";
import ExcelJS from "exceljs";
import { formatPdfIssuedAt, churchPastorsLabel } from "@/lib/pdf/church-document";
import { MEMBER_REPORT_TITLES } from "../constants/member-report-fields";
import type { MemberReportDocument } from "../types/member-report.types";

export async function createMemberReportWorkbook(data: MemberReportDocument): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook(); workbook.creator = "Eclésias"; workbook.created = new Date(data.issuedAt);
  const count = data.columns.length;
  const sheet = workbook.addWorksheet("Membros", { views: [{ state: "frozen", ySplit: 6 }],
    pageSetup: { paperSize: 9, orientation: count > 5 ? "landscape" : "portrait", fitToPage: true, fitToWidth: 1, fitToHeight: 0, printTitlesRow: "1:6" },
    headerFooter: { oddFooter: "&LListagem de membros&R Página &P de &N" } });
  sheet.columns = data.columns.map((column) => ({ width: column.width }));
  [data.church.name, MEMBER_REPORT_TITLES[data.kind], `Emitido em ${formatPdfIssuedAt(data.issuedAt)} · ${data.rows.length} ${data.rows.length === 1 ? "membro" : "membros"}`, data.filters.join(" · "), [churchPastorsLabel(data.church), data.scopeLabel].filter(Boolean).join(" · ")].forEach((text, index) => {
    sheet.mergeCells(index + 1, 1, index + 1, count);
    const cell = sheet.getCell(index + 1, 1); cell.value = text;
    cell.font = { name: "Calibri", size: index === 0 ? 16 : 11, bold: index < 2, color: { argb: index < 2 ? "FFFFFFFF" : "FF5C6B82" } };
    cell.alignment = { vertical: "middle", wrapText: true };
    if (index < 2) cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF0A294F" } };
    sheet.getRow(index + 1).height = index === 0 ? 36 : 30;
  });
  sheet.getCell("A2").border = { bottom: { style: "medium", color: { argb: "FFDBB03B" } } };
  sheet.addRow(data.columns.map((c) => c.label)); sheet.getRow(6).height = 36;
  sheet.getRow(6).eachCell((cell) => { cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF0A294F" } }; cell.font = { name: "Calibri", size: 11, bold: true, color: { argb: "FFFFFFFF" } }; cell.alignment = { vertical: "middle", wrapText: true }; });
  data.rows.forEach((item, index) => {
    const values = data.columns.map((column) => item.values[column.key] ?? "");
    const row = sheet.addRow(values);
    row.height = Math.min(409, Math.max(30, ...values.map((text, i) => Math.ceil(text.length / (data.columns[i].width - 3)) * 16 + 12)));
    row.eachCell({ includeEmpty: true }, (cell, columnIndex) => {
      const column = data.columns[columnIndex - 1], text = values[columnIndex - 1];
      cell.numFmt = "@";
      if (column.format === "date" && /^\d{2}\/\d{2}\/\d{4}$/.test(text)) {
        const [day, month, year] = text.split("/"); const date = new Date(`${year}-${month}-${day}T00:00:00Z`);
        if (!Number.isNaN(date.getTime())) { cell.value = date; cell.numFmt = "dd/mm/yyyy"; }
      }
      cell.font = { name: "Calibri", size: 11, color: { argb: "FF0A294F" } }; cell.alignment = { vertical: "middle", wrapText: true };
      if (index % 2 === 0) cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF8F8F9" } };
    });
  });
  if (!data.rows.length) { sheet.addRow(["Nenhum membro encontrado para este relatório."]); sheet.mergeCells(7, 1, 7, count); sheet.getRow(7).height = 30; }
  sheet.autoFilter = { from: { row: 6, column: 1 }, to: { row: Math.max(6, 6 + data.rows.length), column: count } };
  sheet.pageSetup.printArea = `A1:${sheet.getColumn(count).letter}${sheet.rowCount}`;
  return Buffer.from(await workbook.xlsx.writeBuffer());
}
