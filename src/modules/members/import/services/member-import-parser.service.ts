import "server-only";

import ExcelJS from "exceljs";
import {
  MEMBER_IMPORT_COLUMNS,
  MEMBER_IMPORT_HEADER_ALIASES,
  MEMBER_IMPORT_MAX_ROWS,
  MEMBER_IMPORT_REQUIRED_COLUMNS,
} from "../constants/member-import";
import type {
  MemberImportIssue,
  MemberImportSourceData,
  ParsedMemberImportFile,
  ParsedMemberImportRow,
} from "../types/member-import.types";
import {
  createImportIssue,
  hasFormulaValue,
  normalizeImportCpf,
  normalizeImportDate,
  normalizeImportHeader,
  normalizeImportPhone,
  normalizeImportZipCode,
  normalizeBrazilianState,
  normalizeGender,
  normalizeMaritalStatus,
  normalizeMemberName,
  normalizeNameKey,
} from "../utils/member-import-normalizers";

export class MemberImportParserError extends Error {
  constructor(public readonly code: string, message: string) {
    super(message);
  }
}

function rawCellValue(value: ExcelJS.CellValue) {
  if (value == null) return "";
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (typeof value === "object") {
    if ("richText" in value) return value.richText.map((part) => part.text).join("");
    if ("text" in value && typeof value.text === "string") return value.text;
    if ("result" in value && value.result != null) return String(value.result);
    return "";
  }
  return String(value).trim();
}

function hasAnyValue(values: ExcelJS.CellValue[]) {
  return values.some((value) => rawCellValue(value).trim().length > 0 || hasFormulaValue(value));
}

function classifyBaseRow(
  rowNumber: number,
  sourceData: MemberImportSourceData,
  cellValues: Record<keyof MemberImportSourceData, ExcelJS.CellValue>,
): ParsedMemberImportRow {
  const issues: MemberImportIssue[] = [];
  for (const field of MEMBER_IMPORT_COLUMNS) {
    if (hasFormulaValue(cellValues[field])) {
      issues.push(createImportIssue("FORMULA_NOT_ALLOWED", field, "ERROR", "Fórmulas não são permitidas nos campos da importação."));
    }
  }

  const fullName = normalizeMemberName(sourceData.nome);
  if (!fullName) issues.push(createImportIssue("NAME_REQUIRED", "nome", "ERROR", "Informe o nome do membro."));
  else if (fullName.length < 3 || fullName.length > 160) {
    issues.push(createImportIssue("NAME_LENGTH_INVALID", "nome", "ERROR", "O nome deve possuir entre 3 e 160 caracteres."));
  }

  const roleRaw = normalizeMemberName(sourceData.cargo);
  if (!roleRaw) issues.push(createImportIssue("ROLE_REQUIRED", "cargo", "ERROR", "Informe a sigla do Cargo atual."));

  const whatsapp = normalizeImportPhone(sourceData.fone);
  if (sourceData.fone && !whatsapp) {
    issues.push(createImportIssue("PHONE_INVALID", "fone", "WARNING", "O telefone não possui DDD e 11 dígitos e não será gravado."));
  }

  const birth = normalizeImportDate(cellValues.dtnascimento, "dtnascimento");
  if (birth.issue) issues.push(birth.issue);
  if (!sourceData.dtnascimento) {
    issues.push(createImportIssue("BIRTH_DATE_MISSING", "dtnascimento", "WARNING", "A data de nascimento não foi informada."));
  }

  const received = normalizeImportDate(cellValues.dtcadastro, "dtcadastro");
  if (received.issue) issues.push(received.issue);
  if (birth.value && received.value && birth.value > received.value) {
    issues.push(createImportIssue("RECEIVED_BEFORE_BIRTH", "dtcadastro", "ERROR", "A data de recebimento não pode ser anterior ao nascimento."));
  }

  const cpfResult = normalizeImportCpf(sourceData.cpf);
  if (!cpfResult.valid) {
    issues.push(createImportIssue("CPF_INVALID", "cpf", "ERROR", "O CPF informado é inválido."));
  }

  const maritalStatus = normalizeMaritalStatus(sourceData.estadocivil);
  if (sourceData.estadocivil && !maritalStatus) {
    issues.push(createImportIssue("MARITAL_STATUS_UNKNOWN", "estadocivil", "WARNING", "Selecione a equivalência para este estado civil."));
  }

  const gender = normalizeGender(sourceData.sexo);
  if (sourceData.sexo && !gender) {
    issues.push(createImportIssue("GENDER_UNKNOWN", "sexo", "WARNING", "O sexo deve ser Masculino, Feminino, M ou F e não será gravado."));
  }

  const zipCodeResult = normalizeImportZipCode(sourceData.cep);
  if (!zipCodeResult.valid) {
    issues.push(createImportIssue("ZIP_CODE_INVALID", "cep", "WARNING", "O CEP deve possuir oito dígitos e não será gravado."));
  }
  const city = normalizeMemberName(sourceData.cidade);
  if (city.length > 120) {
    issues.push(createImportIssue("CITY_TOO_LONG", "cidade", "ERROR", "A cidade do endereço deve possuir no máximo 120 caracteres."));
  }
  const state = normalizeBrazilianState(sourceData.estado);
  if (sourceData.estado && !state) {
    issues.push(createImportIssue("STATE_INVALID", "estado", "WARNING", "A UF do endereço é inválida e não será gravada."));
  }
  if (city && !state) {
    issues.push(createImportIssue("STATE_MISSING", "estado", "WARNING", "A cidade do endereço foi informada sem uma UF válida."));
  } else if (state && !city) {
    issues.push(createImportIssue("CITY_MISSING", "cidade", "WARNING", "A UF do endereço foi informada sem a cidade."));
  }

  const naturalCity = normalizeMemberName(sourceData.naturalidade_cidade);
  if (naturalCity.length > 120) {
    issues.push(createImportIssue("NATURAL_CITY_TOO_LONG", "naturalidade_cidade", "ERROR", "A cidade de naturalidade deve possuir no máximo 120 caracteres."));
  }
  const naturalState = normalizeBrazilianState(sourceData.naturalidade_uf);
  if (sourceData.naturalidade_uf && !naturalState) {
    issues.push(createImportIssue("NATURAL_STATE_INVALID", "naturalidade_uf", "WARNING", "A UF da naturalidade é inválida e não será gravada."));
  }
  if (naturalCity && !naturalState) {
    issues.push(createImportIssue("NATURAL_STATE_MISSING", "naturalidade_uf", "WARNING", "A cidade de naturalidade foi informada sem uma UF válida."));
  } else if (naturalState && !naturalCity) {
    issues.push(createImportIssue("NATURAL_CITY_MISSING", "naturalidade_cidade", "WARNING", "A UF da naturalidade foi informada sem a cidade."));
  }

  const fatherName = normalizeMemberName(sourceData.nome_pai);
  const motherName = normalizeMemberName(sourceData.nome_mae);
  if (fatherName.length > 160) {
    issues.push(createImportIssue("FATHER_NAME_TOO_LONG", "nome_pai", "ERROR", "O nome do pai deve possuir no máximo 160 caracteres."));
  }
  if (motherName.length > 160) {
    issues.push(createImportIssue("MOTHER_NAME_TOO_LONG", "nome_mae", "ERROR", "O nome da mãe deve possuir no máximo 160 caracteres."));
  }

  const baptism = normalizeImportDate(cellValues.data_batismo_agua, "data_batismo_agua");
  if (baptism.issue) issues.push(baptism.issue);
  if (birth.value && baptism.value && baptism.value < birth.value) {
    issues.push(createImportIssue("BAPTISM_BEFORE_BIRTH", "data_batismo_agua", "ERROR", "A data do batismo nas águas não pode ser anterior ao nascimento."));
  }

  const holySpiritBaptism = normalizeImportDate(cellValues.data_batismo_espirito, "data_batismo_espirito");
  if (holySpiritBaptism.issue) issues.push(holySpiritBaptism.issue);
  if (birth.value && holySpiritBaptism.value && holySpiritBaptism.value < birth.value) {
    issues.push(createImportIssue("HOLY_SPIRIT_BAPTISM_BEFORE_BIRTH", "data_batismo_espirito", "ERROR", "A data do batismo com o Espírito Santo não pode ser anterior ao nascimento."));
  }

  const conversion = normalizeImportDate(cellValues.data_conversao, "data_conversao");
  if (conversion.issue) issues.push(conversion.issue);
  if (birth.value && conversion.value && conversion.value < birth.value) {
    issues.push(createImportIssue("CONVERSION_BEFORE_BIRTH", "data_conversao", "ERROR", "A data da conversão não pode ser anterior ao nascimento."));
  }

  return {
    rowNumber,
    sourceData,
    fullName,
    normalizedNameKey: normalizeNameKey(fullName),
    phoneRaw: sourceData.fone,
    whatsapp,
    birthDate: birth.value,
    roleRaw,
    cpf: cpfResult.valid ? cpfResult.value : null,
    maritalStatusRaw: sourceData.estadocivil,
    maritalStatus,
    receivedDate: received.value,
    genderRaw: sourceData.sexo,
    gender,
    zipCode: zipCodeResult.value,
    city: city || null,
    state,
    naturalCity: naturalCity || null,
    naturalState,
    fatherName: fatherName || null,
    motherName: motherName || null,
    baptismDate: baptism.value,
    holySpiritBaptismDate: holySpiritBaptism.value,
    conversionDate: conversion.value,
    issues,
  };
}

export async function parseMemberImportWorkbook(buffer: Buffer): Promise<ParsedMemberImportFile> {
  const workbook = new ExcelJS.Workbook();
  try {
    await workbook.xlsx.load(Uint8Array.from(buffer).buffer);
  } catch {
    throw new MemberImportParserError("IMPORT_FILE_INVALID_TYPE", "Não foi possível ler o arquivo XLSX.");
  }

  const worksheet = workbook.worksheets.find((sheet) => {
    let found = false;
    sheet.eachRow({ includeEmpty: false }, (row) => {
      if (hasAnyValue((row.values as ExcelJS.CellValue[]).slice(1))) found = true;
    });
    return found;
  });
  if (!worksheet) throw new MemberImportParserError("IMPORT_WORKSHEET_EMPTY", "A planilha não possui linhas para importar.");

  let headerRowNumber = 0;
  const columnByHeader = new Map<string, number>();
  const canonicalHeaderByNormalizedValue = new Map(
    MEMBER_IMPORT_COLUMNS.map((column) => [normalizeImportHeader(column), column]),
  );
  Object.entries(MEMBER_IMPORT_HEADER_ALIASES).forEach(([alias, column]) => {
    canonicalHeaderByNormalizedValue.set(normalizeImportHeader(alias), column);
  });
  worksheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
    if (headerRowNumber) return;
    const values = (row.values as ExcelJS.CellValue[]).slice(1);
    if (!hasAnyValue(values)) return;
    headerRowNumber = rowNumber;
    values.forEach((value, index) => {
      const normalizedHeader = normalizeImportHeader(rawCellValue(value));
      const header = canonicalHeaderByNormalizedValue.get(normalizedHeader) ?? normalizedHeader;
      if (header && !columnByHeader.has(header)) columnByHeader.set(header, index + 1);
    });
  });
  if (!headerRowNumber) throw new MemberImportParserError("IMPORT_HEADER_MISSING", "Não foi possível localizar o cabeçalho da planilha.");

  const expectedHeaders = new Set<string>(MEMBER_IMPORT_COLUMNS);
  const missingRequired = MEMBER_IMPORT_REQUIRED_COLUMNS.filter((column) => !columnByHeader.has(column));
  if (missingRequired.length) {
    throw new MemberImportParserError(
      "IMPORT_HEADER_MISSING",
      `A planilha precisa conter as colunas obrigatórias: ${missingRequired.join(", ")}.`,
    );
  }

  const recognizedColumns = MEMBER_IMPORT_COLUMNS.filter((column) => columnByHeader.has(column));
  const ignoredColumns = [...columnByHeader.keys()].filter((column) => !expectedHeaders.has(column));
  const rows: ParsedMemberImportRow[] = [];
  let emptyRows = 0;

  for (let rowNumber = headerRowNumber + 1; rowNumber <= worksheet.rowCount; rowNumber += 1) {
    const row = worksheet.getRow(rowNumber);
    const supportedValues = {} as Record<keyof MemberImportSourceData, ExcelJS.CellValue>;
    const sourceData = {} as MemberImportSourceData;
    for (const column of MEMBER_IMPORT_COLUMNS) {
      const index = columnByHeader.get(column);
      const cellValue = index ? row.getCell(index).value : null;
      supportedValues[column] = cellValue;
      sourceData[column] = rawCellValue(cellValue);
    }
    if (!hasAnyValue(Object.values(supportedValues))) {
      emptyRows += 1;
      continue;
    }
    rows.push(classifyBaseRow(rowNumber, sourceData, supportedValues));
  }

  if (!rows.length) throw new MemberImportParserError("IMPORT_WORKSHEET_EMPTY", "A planilha não possui membros para importar.");
  if (rows.length > MEMBER_IMPORT_MAX_ROWS) {
    throw new MemberImportParserError("IMPORT_ROW_LIMIT_EXCEEDED", `O arquivo possui ${rows.length} linhas; o limite é ${MEMBER_IMPORT_MAX_ROWS}.`);
  }

  return { worksheetName: worksheet.name, recognizedColumns, ignoredColumns, emptyRows, rows };
}
