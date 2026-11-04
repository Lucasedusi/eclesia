import "server-only";

import ExcelJS from "exceljs";
import type { RegionReportDocument } from "../types/region-report.types";

export async function createRegionReportWorkbook(data: RegionReportDocument): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Eclésias"; workbook.created = new Date(data.issuedAt);
  const sheet = workbook.addWorksheet("Regionais", {
    views: [{ state: "frozen", ySplit: 6 }],
    pageSetup: { paperSize: 9, orientation: "portrait", fitToPage: true, fitToWidth: 1, fitToHeight: 0, printTitlesRow: "1:6" },
    headerFooter: { oddFooter: "&LLista de regionais&R Página &P de &N" },
  });
  sheet.columns = [{ width: 42 }, { width: 38 }, { width: 27 }];
  const issued = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: "America/Sao_Paulo" }).format(new Date(data.issuedAt));
  const rows = [data.church.name, "Lista simplificada de regionais", `Emitido em ${issued} · ${data.regions.length} ${data.regions.length === 1 ? "regional" : "regionais"}`, data.filters.join(" · "), data.scopeLabel || "Contatos da coordenação regional"];
  rows.forEach((value, index) => {
    sheet.mergeCells(index + 1, 1, index + 1, 3);
    const cell = sheet.getCell(index + 1, 1);
    cell.value = value;
    cell.font = { name: "Calibri", size: index === 0 ? 16 : 11, bold: index < 2, color: { argb: index < 2 ? "FFFFFFFF" : "FF5C6B82" } };
    cell.alignment = { vertical: "middle", wrapText: true };
    if (index < 2) cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF0A294F" } };
    sheet.getRow(index + 1).height = index === 0 ? 36 : 30;
  });
  sheet.getRow(2).getCell(1).border = { bottom: { style: "medium", color: { argb: "FFDBB03B" } } };
  sheet.addRow(["Nome da regional", "Coordenador", "Telefone do coordenador"]);
  sheet.getRow(6).height = 30;
  sheet.getRow(6).eachCell((cell) => {
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF0A294F" } };
    cell.font = { name: "Calibri", bold: true, color: { argb: "FFFFFFFF" }, size: 11 };
    cell.alignment = { vertical: "middle", wrapText: true };
  });
  data.regions.forEach((region, index) => {
    // Strings remain literal cells, including names beginning with '='.
    const row = sheet.addRow([region.name, region.coordinatorName, region.coordinatorPhone]);
    row.height = Math.max(30, Math.ceil(Math.max(region.name.length / 38, region.coordinatorName.length / 34)) * 16 + 12);
    row.eachCell((cell) => {
      cell.numFmt = "@";
      cell.font = { name: "Calibri", size: 11, color: { argb: "FF0A294F" } };
      cell.alignment = { vertical: "middle", wrapText: true };
      if (index % 2 === 0) cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF8F8F9" } };
    });
  });
  if (!data.regions.length) { sheet.addRow(["Nenhuma regional encontrada para este relatório."]); sheet.mergeCells("A7:C7"); sheet.getRow(7).height = 30; }
  sheet.autoFilter = { from: { row: 6, column: 1 }, to: { row: Math.max(6, 6 + data.regions.length), column: 3 } };
  sheet.pageSetup.printArea = `A1:C${sheet.rowCount}`;
  return Buffer.from(await workbook.xlsx.writeBuffer());
}
