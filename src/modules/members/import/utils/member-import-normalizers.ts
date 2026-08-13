import { isValidCpf } from "@/utils/input-masks";
import { BRAZILIAN_STATE_OPTIONS } from "../constants/member-import";
import type { MemberImportIssue } from "../types/member-import.types";

const ACCENTS = "áàâãäéèêëíìîïóòôõöúùûüçñÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇÑ";
const PLAIN = "aaaaaeeeeiiiiooooouuuucnAAAAAEEEEIIIIOOOOOUUUUCN";

export function normalizeImportHeader(value: string) {
  return normalizeNameKey(value).replace(/[\s._-]+/g, "");
}

export function normalizeMemberName(value: string) {
  return value.trim().replace(/\s+/g, " ");
}

export function normalizeNameKey(value: string) {
  const translated = [...value].map((char) => {
    const index = ACCENTS.indexOf(char);
    return index >= 0 ? PLAIN[index] : char;
  }).join("");
  return translated.toLocaleLowerCase("pt-BR").trim().replace(/\s+/g, " ");
}

export function normalizeRoleKey(value: string) {
  return normalizeNameKey(value).replace(/^[\s._-]+|[\s._-]+$/g, "").replace(/[.\s_-]+/g, "");
}

export function normalizeImportPhone(value: string) {
  const digits = value.replace(/\D/g, "");
  const local = digits.length === 13 && digits.startsWith("55") ? digits.slice(2) : digits;
  return local.length === 11 ? local : null;
}

export function normalizeImportCpf(value: string) {
  const digits = value.replace(/\D/g, "");
  if (!digits) return { value: null, valid: true };
  return { value: digits, valid: isValidCpf(digits) };
}

export function normalizeMaritalStatus(value: string) {
  const key = normalizeNameKey(value)
    .replace(/\(a\)/g, "")
    .replace(/[()]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  const mappings: Record<string, string> = {
    solteiro: "SINGLE",
    solteira: "SINGLE",
    casado: "MARRIED",
    casada: "MARRIED",
    divorciado: "DIVORCED",
    divorciada: "DIVORCED",
    separado: "SEPARATED",
    separada: "SEPARATED",
    desquitado: "SEPARATED",
    desquitada: "SEPARATED",
    viuvo: "WIDOWED",
    viuva: "WIDOWED",
    "uniao estavel": "STABLE_UNION",
    outro: "OTHER",
    outra: "OTHER",
  };
  return key ? mappings[key] ?? null : null;
}

export function normalizeGender(value: string): "MALE" | "FEMALE" | null {
  const key = normalizeNameKey(value).replace(/[._-]+/g, "").trim();
  if (["m", "masculino", "male"].includes(key)) return "MALE";
  if (["f", "feminino", "female"].includes(key)) return "FEMALE";
  return null;
}

export function normalizeBrazilianState(value: string) {
  const state = value.trim().toLocaleUpperCase("pt-BR");
  return (BRAZILIAN_STATE_OPTIONS as readonly string[]).includes(state) ? state : null;
}

export function normalizeImportZipCode(value: string) {
  const digits = value.replace(/\D/g, "");
  if (!digits) return { value: null, valid: true };
  return { value: digits.length === 8 ? digits : null, valid: digits.length === 8 };
}

function issue(code: string, field: string, severity: "INFO" | "WARNING" | "ERROR", message: string): MemberImportIssue {
  return { code, field, severity, message, resolved: false, resolution: null };
}

function isoDate(year: number, month: number, day: number) {
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() + 1 !== month || date.getUTCDate() !== day) return null;
  return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

type ImportDateField =
  | "dtnascimento"
  | "dtcadastro"
  | "data_batismo_agua"
  | "data_batismo_espirito"
  | "data_conversao";

const DATE_ISSUES: Record<ImportDateField, { invalid: string; future: string }> = {
  dtnascimento: { invalid: "BIRTH_DATE_INVALID", future: "BIRTH_DATE_FUTURE" },
  dtcadastro: { invalid: "RECEIVED_DATE_INVALID", future: "RECEIVED_DATE_FUTURE" },
  data_batismo_agua: { invalid: "BAPTISM_DATE_INVALID", future: "BAPTISM_DATE_FUTURE" },
  data_batismo_espirito: { invalid: "HOLY_SPIRIT_BAPTISM_DATE_INVALID", future: "HOLY_SPIRIT_BAPTISM_DATE_FUTURE" },
  data_conversao: { invalid: "CONVERSION_DATE_INVALID", future: "CONVERSION_DATE_FUTURE" },
};

export function normalizeImportDate(value: unknown, field: ImportDateField) {
  if (value == null || value === "") return { value: null as string | null, issue: null as MemberImportIssue | null };
  let parsed: string | null = null;
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    parsed = isoDate(value.getUTCFullYear(), value.getUTCMonth() + 1, value.getUTCDate());
  } else if (typeof value === "number" && Number.isFinite(value)) {
    const excelEpoch = Date.UTC(1899, 11, 30);
    const date = new Date(excelEpoch + Math.floor(value) * 86_400_000);
    parsed = isoDate(date.getUTCFullYear(), date.getUTCMonth() + 1, date.getUTCDate());
  } else {
    const text = String(value).trim();
    let match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(text);
    if (match) parsed = isoDate(Number(match[3]), Number(match[2]), Number(match[1]));
    match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text);
    if (match) parsed = isoDate(Number(match[1]), Number(match[2]), Number(match[3]));
  }
  if (!parsed) {
    return {
      value: null,
      issue: issue(
        DATE_ISSUES[field].invalid,
        field,
        "ERROR",
        "A data informada não possui um formato válido.",
      ),
    };
  }
  const today = new Date().toISOString().slice(0, 10);
  if (parsed > today) {
    return {
      value: null,
      issue: issue(
        DATE_ISSUES[field].future,
        field,
        "ERROR",
        "A data informada não pode estar no futuro.",
      ),
    };
  }
  if (field === "dtnascimento" && parsed < "1900-01-01") {
    return { value: null, issue: issue("BIRTH_DATE_TOO_OLD", field, "ERROR", "Revise a data de nascimento anterior a 1900.") };
  }
  return { value: parsed, issue: null };
}

export function createImportIssue(
  code: string,
  field: string,
  severity: "INFO" | "WARNING" | "ERROR",
  message: string,
): MemberImportIssue {
  return issue(code, field, severity, message);
}

export function hasFormulaValue(value: unknown): value is { formula: string } {
  return Boolean(value && typeof value === "object" && "formula" in value);
}
