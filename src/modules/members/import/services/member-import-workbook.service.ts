import "server-only";

import ExcelJS from "exceljs";
import type { MemberImportBatch, MemberImportItem } from "../types/member-import.types";
import {
  BRAZILIAN_STATE_OPTIONS,
  MEMBER_IMPORT_COLUMNS,
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
  worksheet.addRow([...MEMBER_IMPORT_COLUMNS]);
  styleHeader(worksheet.getRow(1));
  worksheet.autoFilter = { from: "A1", to: "R1" };
  worksheet.getCell("A1").note = "Obrigatório. Nome completo do membro.";
  worksheet.getCell("D1").note = "Obrigatório. Use a sigla de um Cargo ativo no EKLESIA.";
  worksheet.getCell("B1").note = "Opcional. Informe DDD e 9 dígitos.";
  worksheet.getCell("C1").note = "Opcional. Formato dd/MM/aaaa.";
  worksheet.getCell("E1").note = "Opcional. O CPF será validado antes da importação.";
  worksheet.getCell("F1").note = "Opcional. Ex.: Solteiro(a), Casado(a), Separado(a).";
  worksheet.getCell("G1").note = "Opcional. Data em que a pessoa foi recebida como membro.";
  worksheet.getCell("H1").note = "Opcional. Use Masculino, Feminino, M ou F.";
  worksheet.getCell("I1").note = "Opcional. CEP do endereço atual, com oito dígitos.";
  worksheet.getCell("J1").note = "Opcional. Cidade do endereço atual.";
  worksheet.getCell("K1").note = "Opcional. UF do endereço atual, com duas letras.";
  worksheet.getCell("L1").note = "Opcional. Cidade onde a pessoa nasceu.";
  worksheet.getCell("M1").note = "Opcional. UF da naturalidade, com duas letras.";
  worksheet.getCell("N1").note = "Opcional. Nome completo do pai.";
  worksheet.getCell("O1").note = "Opcional. Nome completo da mãe.";
  worksheet.getCell("P1").note = "Opcional. Data do batismo nas águas, no formato dd/MM/aaaa.";
  worksheet.getCell("Q1").note = "Opcional. Data do batismo com o Espírito Santo, no formato dd/MM/aaaa.";
  worksheet.getCell("R1").note = "Opcional. Data da conversão, no formato dd/MM/aaaa.";
  worksheet.addRow([
    "Maria da Silva", "(62) 99999-8888", "10/05/1985", "Mb", "529.982.247-25", "Casado(a)",
    "15/03/2010", "Feminino", "76550-000", "Porangatu", "GO", "Porangatu", "GO",
    "José da Silva", "Ana da Silva", "20/06/1998", "10/08/2001", "15/05/1997",
  ]);
  for (let row = 2; row <= 501; row += 1) {
    worksheet.getCell(`F${row}`).dataValidation = {
      type: "list",
      allowBlank: true,
      formulae: ['"Solteiro(a),Casado(a),Divorciado(a),Separado(a),Viúvo(a),União estável,Outro"'],
    };
    worksheet.getCell(`H${row}`).dataValidation = {
      type: "list",
      allowBlank: true,
      formulae: ['"Masculino,Feminino,M,F"'],
    };
    worksheet.getCell(`K${row}`).dataValidation = {
      type: "list",
      allowBlank: true,
      formulae: [`"${BRAZILIAN_STATE_OPTIONS.join(",")}"`],
    };
    worksheet.getCell(`M${row}`).dataValidation = {
      type: "list",
      allowBlank: true,
      formulae: [`"${BRAZILIAN_STATE_OPTIONS.join(",")}"`],
    };
    worksheet.getCell(`C${row}`).numFmt = "dd/mm/yyyy";
    worksheet.getCell(`G${row}`).numFmt = "dd/mm/yyyy";
    worksheet.getCell(`P${row}`).numFmt = "dd/mm/yyyy";
    worksheet.getCell(`Q${row}`).numFmt = "dd/mm/yyyy";
    worksheet.getCell(`R${row}`).numFmt = "dd/mm/yyyy";
  }
  worksheet.columns = [
    { key: "nome", width: 34 },
    { key: "fone", width: 20 },
    { key: "dtnascimento", width: 18 },
    { key: "cargo", width: 14 },
    { key: "cpf", width: 18 },
    { key: "estadocivil", width: 20 },
    { key: "dtcadastro", width: 18 },
    { key: "sexo", width: 14 },
    { key: "cep", width: 14 },
    { key: "cidade", width: 24 },
    { key: "estado", width: 14 },
    { key: "naturalidade_cidade", width: 24 },
    { key: "naturalidade_uf", width: 17 },
    { key: "nome_pai", width: 30 },
    { key: "nome_mae", width: 30 },
    { key: "data_batismo_agua", width: 20 },
    { key: "data_batismo_espirito", width: 22 },
    { key: "data_conversao", width: 18 },
  ];
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
      maskedCpf(item.cpf),
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

  const rejected = workbook.addWorksheet("Não importados", { views: [{ state: "frozen", ySplit: 1 }] });
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
      maskedCpf(item.cpf),
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
