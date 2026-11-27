import "server-only";

import { importIncludedPhone } from "../utils/member-import-normalizers";
import ExcelJS from "exceljs";
import type { MemberImportBatch, MemberImportItem } from "../types/member-import.types";
import {
  BRAZILIAN_STATE_OPTIONS,
  CONGREGATION_COLUMNS,
  IMPORTED_MEMBER_STATUS_LABELS,
  MEMBER_IMPORT_STATUS_LABELS,
} from "../constants/member-import";

const HEADER_FILL = "415BA5";
const HEADER_FONT = { color: { argb: "FFFFFFFF" }, bold: true };

function styleHeader(row: ExcelJS.Row) {
  row.height = 24;
  row.eachCell((cell) => {
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: `FF${HEADER_FILL}` } };
    cell.font = HEADER_FONT;
    cell.alignment = { vertical: "middle", horizontal: "center" };
    cell.border = { bottom: { style: "thin", color: { argb: "FFD8DEEC" } } };
  });
}

function fitColumns(worksheet: ExcelJS.Worksheet, max = 48) {
  worksheet.columns.forEach((column) => {
    let width = 12;
    column.eachCell?.({ includeEmpty: false }, (cell) => {
      width = Math.max(width, String(cell.value ?? "").length + 2);
    });
    column.width = Math.min(max, width);
  });
}

function asExcelDate(value: string | null) {
  return value ? new Date(`${value}T00:00:00.000Z`) : null;
}

function genderLabel(value: MemberImportItem["gender"]) {
  return value === "MALE" ? "Masculino" : value === "FEMALE" ? "Feminino" : "";
}

function maskedCpf(value: string | null) {
  return value ? `***.***.***-${value.slice(-2)}` : "";
}

export async function generateMemberImportTemplate() {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "EKLESIA";
  const worksheet = workbook.addWorksheet("Membros", { views: [{ state: "frozen", ySplit: 1 }] });
  worksheet.columns = CONGREGATION_COLUMNS.map(([header, key]) => ({
    header, key, width: Math.max(18, header.length + 4),
  }));
  for (const key of ["nome", "endereco", "nome_pai", "nome_mae"]) worksheet.getColumn(key).width = 36;
  for (const key of ["cep", "cpf"]) worksheet.getColumn(key).numFmt = "@";
  for (const key of ["dtnascimento", "cadastro_legado", "data_conversao", "data_batismo_agua"]) {
    worksheet.getColumn(key).numFmt = "dd/mm/yyyy";
  }
  styleHeader(worksheet.getRow(1));
  worksheet.autoFilter = "A1:T1";
  worksheet.getCell("P1").note = "Data do cadastro no sistema de origem.";
  for (let row = 2; row <= 501; row++) {
    for (const [column, options] of [
      ["C", "Masculino,Feminino,M,F"], ["H", BRAZILIAN_STATE_OPTIONS.join(",")],
      ["L", "Solteiro(a),Casado(a),Divorciado(a),Separado(a),Viúvo(a),União estável,Outro"],
    ]) {
      worksheet.getCell(column + row).dataValidation = { type: "list", allowBlank: true, formulae: [`"${options}"`] };
    }
  }
  return Buffer.from(await workbook.xlsx.writeBuffer());
}

function issueText(item: MemberImportItem) {
  return item.issues.map((issue) => issue.message).join(" | ");
}

export async function generateMemberImportReport(batch: MemberImportBatch, items: MemberImportItem[]) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "EKLESIA";
  workbook.created = new Date();

  const summary = workbook.addWorksheet("Resumo");
  summary.addRow(["Relatório de importação de membros"]);
  summary.mergeCells("A1:B1");
  summary.getCell("A1").font = { size: 16, bold: true, color: { argb: `FF${HEADER_FILL}` } };
  summary.addRows([
    ["Lote", batch.id],
    ["Igreja", batch.churchName],
    ["Congregação", batch.congregationName],
    ["Arquivo", batch.originalFilename],
    ["Aba", batch.worksheetName],
    ["Responsável", batch.createdByName],
    ["Status", MEMBER_IMPORT_STATUS_LABELS[batch.status] ?? batch.status],
    ["Situação dos membros", IMPORTED_MEMBER_STATUS_LABELS[batch.memberStatus]],
    ["Linhas", batch.totalRows],
    ["Importados", batch.importedRows],
    ["Pulados", batch.skippedRows],
    ["Alertas", batch.warningRows],
    ["Hash SHA-256", batch.fileSha256],
  ]);
  summary.getColumn(1).font = { bold: true };
  summary.getColumn(1).width = 24;
  summary.getColumn(2).width = 74;

  const imported = workbook.addWorksheet("Importados", { views: [{ state: "frozen", ySplit: 1 }] });
  const rejected = workbook.addWorksheet("Não importados", { views: [{ state: "frozen", ySplit: 1 }] });
  if (batch.settingsSnapshot.workbook_schema === "congregation") {
    const includePhone = importIncludedPhone(batch.settingsSnapshot);
    const headers: string[] = CONGREGATION_COLUMNS.map(([label]) => label);
    if (includePhone) headers.splice(10, 0, "Telefone");
    for (const sheet of [imported, rejected]) {
      sheet.addRow([...headers, "Linha", "Situação", "Avisos"]);
      styleHeader(sheet.getRow(1));
      sheet.autoFilter = includePhone ? "A1:X1" : "A1:W1";
      for (const column of includePhone ? ["D", "Q", "R", "S"] : ["D", "P", "Q", "R"]) sheet.getColumn(column).numFmt = "dd/mm/yyyy";
    }
    for (const item of items) {
      const sheet = item.classification === "IMPORTED" ? imported : rejected;
      sheet.addRow([
        item.fullName, item.roleName ?? item.roleRaw, genderLabel(item.gender), asExcelDate(item.birthDate),
        item.address, item.district, item.city, item.state, item.country, item.zipCode,
        ...(includePhone ? [item.landline ?? item.whatsapp ?? item.phoneRaw] : []), maskedCpf(item.cpfSuffix), item.maritalStatusRaw,
        item.profession, [item.naturalCity, item.naturalState].filter(Boolean).join(" / "), item.nationality,
        asExcelDate(item.legacyRegistrationDate), asExcelDate(item.conversionDate), asExcelDate(item.baptismDate),
        item.fatherName, item.motherName, item.rowNumber, item.classification, issueText(item),
      ]);
    }
    fitColumns(imported);
    fitColumns(rejected);
  } else {
    imported.addRow([
      "Linha", "Código", "Nome", "Telefone", "Nascimento", "Sexo", "CPF", "Estado civil",
      "CEP", "Cidade", "Estado", "Naturalidade", "UF", "Nome do pai", "Nome da mãe",
      "Batismo nas águas", "Batismo com o Espírito Santo", "Conversão", "Recebimento", "Cargo", "Avisos",
    ]);
    styleHeader(imported.getRow(1));
    items.filter((item) => item.classification === "IMPORTED").forEach((item) => {
      imported.addRow([
        item.rowNumber,
        item.importedMemberCode ?? "",
        item.fullName,
        item.whatsapp ?? item.phoneRaw ?? "",
        asExcelDate(item.birthDate),
        genderLabel(item.gender),
        maskedCpf(item.cpfSuffix),
        item.maritalStatusRaw ?? "",
        item.zipCode ?? "",
        item.city ?? "",
        item.state ?? "",
        item.naturalCity ?? "",
        item.naturalState ?? "",
        item.fatherName ?? "",
        item.motherName ?? "",
        asExcelDate(item.baptismDate),
        asExcelDate(item.holySpiritBaptismDate),
        asExcelDate(item.conversionDate),
        asExcelDate(item.receivedDate),
        item.roleName ?? item.roleRaw,
        issueText(item),
      ]);
    });
    imported.autoFilter = { from: "A1", to: "U1" };
    ["E", "P", "Q", "R", "S"].forEach((column) => { imported.getColumn(column).numFmt = "dd/mm/yyyy"; });
    fitColumns(imported, 36);

    rejected.addRow([
      "Linha", "Nome", "Telefone", "Nascimento", "Sexo", "CPF", "CEP", "Cidade", "Estado", "Naturalidade", "UF",
      "Nome do pai", "Nome da mãe", "Batismo nas águas", "Batismo com o Espírito Santo", "Conversão",
      "Recebimento", "Cargo", "Situação", "Motivo",
    ]);
    styleHeader(rejected.getRow(1));
    items.filter((item) => item.classification !== "IMPORTED").forEach((item) => {
      rejected.addRow([
        item.rowNumber,
        item.fullName,
        item.whatsapp ?? item.phoneRaw ?? "",
        asExcelDate(item.birthDate),
        genderLabel(item.gender),
        maskedCpf(item.cpfSuffix),
        item.zipCode ?? "",
        item.city ?? "",
        item.state ?? "",
        item.naturalCity ?? "",
        item.naturalState ?? "",
        item.fatherName ?? "",
        item.motherName ?? "",
        asExcelDate(item.baptismDate),
        asExcelDate(item.holySpiritBaptismDate),
        asExcelDate(item.conversionDate),
        asExcelDate(item.receivedDate),
        item.roleName ?? item.roleRaw,
        item.classification === "SKIPPED" ? "Pulado" : item.classification,
        issueText(item),
      ]);
    });
    rejected.autoFilter = { from: "A1", to: "T1" };
    ["D", "N", "O", "P", "Q"].forEach((column) => { rejected.getColumn(column).numFmt = "dd/mm/yyyy"; });
    fitColumns(rejected, 36);
  }

  const decisions = workbook.addWorksheet("Decisões", { views: [{ state: "frozen", ySplit: 1 }] });
  decisions.addRow(["Linha", "Nome", "Decisão", "Resoluções registradas"]);
  styleHeader(decisions.getRow(1));
  items.filter((item) => item.decision === "IMPORT_ANYWAY" || item.decision === "SKIP").forEach((item) => {
    const resolutions = item.issues
      .filter((issue) => issue.resolved || item.decision === "SKIP")
      .map((issue) => issue.resolution ?? issue.code)
      .join(" | ");
    decisions.addRow([item.rowNumber, item.fullName, item.decision, resolutions]);
  });
  decisions.autoFilter = { from: "A1", to: "D1" };
  fitColumns(decisions);

  return Buffer.from(await workbook.xlsx.writeBuffer());
}
