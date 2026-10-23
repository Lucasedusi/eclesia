import "server-only";
import { createHash } from "node:crypto";
import { inflateRawSync } from "node:zlib";
import ExcelJS from "exceljs";
import type { BankBalance, ParsedBankRow, ParsedBankStatement } from "./types";

export const BANK_IMPORT_MAX_BYTES = 5 * 1024 * 1024;
export const BANK_IMPORT_MAX_ROWS = 5000;
const MAX_EXPANDED_BYTES = 24 * 1024 * 1024;
const headers = ["DATA", "DOCUMENTO", "HISTORICO", "INFORMACOES COMPLEMENTARES", "VALOR"];
const balanceLabels = new Set(["SALDO DO DIA", "SALDO ANTERIOR", "SALDO BLOQUEADO ANTERIOR"]);
const normalize = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, " ").trim().toUpperCase();
const invalid = () => new Error("Envie um arquivo XLSX válido do Sicoob.");

// Inspect actual inflated bytes before ExcelJS allocates workbook objects. Never extract to disk.
function inspectZip(buffer: Buffer) {
  if (buffer.length < 22 || buffer.length > BANK_IMPORT_MAX_BYTES) throw new Error("O XLSX deve possuir no máximo 5 MB.");
  if (buffer.readUInt32LE(0) !== 0x04034b50) throw invalid();
  let end = -1;
  for (let i = buffer.length - 22; i >= Math.max(0, buffer.length - 65557); i--) {
    if (buffer.readUInt32LE(i) === 0x06054b50 && i + 22 + buffer.readUInt16LE(i + 20) === buffer.length) { end = i; break; }
  }
  if (end < 0 || buffer.readUInt16LE(end + 4) !== 0 || buffer.readUInt16LE(end + 6) !== 0) throw invalid();
  const count = buffer.readUInt16LE(end + 10);
  if (count > 128 || count < 4) throw new Error("A estrutura deste XLSX excede o limite permitido.");
  let offset = buffer.readUInt32LE(end + 16), expanded = 0, cells = 0;
  const names = new Set<string>();
  for (let i = 0; i < count; i++) {
    if (offset + 46 > end || buffer.readUInt32LE(offset) !== 0x02014b50) throw invalid();
    const flags = buffer.readUInt16LE(offset + 8), method = buffer.readUInt16LE(offset + 10);
    const compressedSize = buffer.readUInt32LE(offset + 20), size = buffer.readUInt32LE(offset + 24);
    const nameSize = buffer.readUInt16LE(offset + 28), extra = buffer.readUInt16LE(offset + 30), comment = buffer.readUInt16LE(offset + 32);
    const local = buffer.readUInt32LE(offset + 42);
    const next = offset + 46 + nameSize + extra + comment;
    if (next > end || local + 30 > buffer.length || (flags & 1) || ![0, 8].includes(method)) throw invalid();
    const name = buffer.subarray(offset + 46, offset + 46 + nameSize).toString("utf8");
    if (names.has(name) || /\.\.|\\|^\//.test(name)) throw invalid();
    names.add(name);
    if (/vbaProject|externalLinks|embeddings|\/media\//i.test(name)) throw new Error("O extrato não pode conter macros, vínculos externos ou conteúdo incorporado.");
    if (buffer.readUInt32LE(local) !== 0x04034b50) throw invalid();
    const start = local + 30 + buffer.readUInt16LE(local + 26) + buffer.readUInt16LE(local + 28);
    if (start + compressedSize > offset || size > MAX_EXPANDED_BYTES - expanded) throw new Error("O conteúdo descompactado do XLSX excede o limite permitido.");
    const bytes = method === 0 ? buffer.subarray(start, start + compressedSize) : inflateRawSync(buffer.subarray(start, start + compressedSize), { maxOutputLength: MAX_EXPANDED_BYTES - expanded });
    if (bytes.length !== size) throw invalid();
    expanded += bytes.length;
    if (expanded > MAX_EXPANDED_BYTES) throw invalid();
    if (name.endsWith(".xml") || name.endsWith(".rels")) {
      const xml = bytes.toString("utf8");
      if (/<!DOCTYPE|<!ENTITY|TargetMode\s*=\s*["']External/i.test(xml)) throw new Error("O extrato contém conteúdo externo não permitido.");
      if (/^xl\/worksheets\/sheet\d+\.xml$/.test(name)) {
        if (/<(?:\w+:)?f(?:\s|>)/.test(xml)) throw new Error("O extrato não pode conter fórmulas.");
        cells += [...xml.matchAll(/<c(?:\s|>)/g)].length;
        if (cells > 30000 || [...xml.matchAll(/<row\b[^>]*\br="(\d+)"/g)].some(m => Number(m[1]) > 5200)) throw new Error("O extrato deve conter no máximo 5.000 movimentos.");
      }
    }
    offset = next;
  }
  if (!names.has("[Content_Types].xml") || !names.has("xl/workbook.xml")) throw invalid();
}

function cellText(cell: ExcelJS.Cell) {
  const value = cell.value;
  if (value == null) return "";
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (typeof value === "object") {
    if ("richText" in value) return value.richText.map(part => part.text).join("").trim();
    throw new Error("O extrato contém uma célula incompatível.");
  }
  return String(value).trim();
}
function parseDate(text: string) {
  const match = /^(\d{2})\/(\d{2})\/(20\d{2})$/.exec(text);
  if (!match) return null;
  const iso = `${match[3]}-${match[2]}-${match[1]}`;
  const date = new Date(`${iso}T12:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === iso ? iso : null;
}
function cents(value: ExcelJS.CellValue) {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  const result = Math.round(value * 100);
  return Math.abs(value * 100 - result) < 0.000001 && Math.abs(result) <= 999999999999 ? result : null;
}

export async function parseBankStatement(buffer: Buffer): Promise<ParsedBankStatement> {
  try { inspectZip(buffer); } catch (error) {
    if (error instanceof Error && /XLSX|extrato|fórmulas|5\.000/.test(error.message)) throw error;
    throw invalid();
  }
  const workbook = new ExcelJS.Workbook();
  try { await workbook.xlsx.load(Uint8Array.from(buffer).buffer); } catch { throw invalid(); }
  if (workbook.worksheets.length !== 1) throw new Error("Envie um extrato com uma única aba de lançamentos.");
  const sheet = workbook.worksheets[0];
  if (sheet.columnCount > 5) throw new Error("As colunas do extrato não correspondem ao formato Sicoob esperado.");
  const rows: ParsedBankRow[] = [], balances: BankBalance[] = [];
  let foundHeader = false;
  for (let i = 1; i <= sheet.rowCount; i++) {
    const row = sheet.getRow(i), values = [1, 2, 3, 4, 5].map(n => cellText(row.getCell(n)));
    if (!values.some(Boolean)) continue;
    if (values.some(v => v.length > 6000)) throw new Error("O extrato contém um campo maior que o limite permitido.");
    if (values.every((v, j) => normalize(v) === headers[j])) { foundHeader = true; continue; }
    if (!foundHeader) {
      if (values.filter(Boolean).every(v => normalize(v) === "EXTRATO CONTA CORRENTE")) continue;
      throw new Error("Cabeçalhos do extrato Sicoob não reconhecidos.");
    }
    const [rawDate, document, history, complement] = values;
    const date = parseDate(rawDate), amountCents = cents(row.getCell(5).value);
    const label = normalize(history);
    if (balanceLabels.has(label) && !document && !complement) {
      balances.push({ date, label, amountCents });
      continue;
    }
    const issue = !date ? "Data inválida ou linha não reconhecida." : amountCents === null || amountCents === 0 ? "Valor inválido para movimentação." : !history ? "Histórico ausente." : null;
    const fingerprint = createHash("sha256").update(JSON.stringify([date ?? rawDate, normalize(document), normalize(history), normalize(complement), amountCents ?? values[4]])).digest("hex");
    rows.push({ rowNumber: i, date, sourceDate: rawDate, sourceValue: values[4], document, history, complement, amountCents, issue, fingerprint });
  }
  if (!foundHeader || rows.length === 0) throw new Error("O extrato não contém movimentos para conferir.");
  if (rows.length > BANK_IMPORT_MAX_ROWS) throw new Error("O extrato deve conter no máximo 5.000 movimentos.");
  let reconciliation: ParsedBankStatement["reconciliation"] = "UNAVAILABLE";
  const start = balances.filter(b => b.label === "SALDO ANTERIOR"), end = balances.filter(b => b.label === "SALDO DO DIA");
  const dates = rows.map(r => r.date).filter((v): v is string => !!v).sort();
  if (!rows.some(r => r.issue) && start.length === 1 && end.length === 1 && start[0].date === dates[0] && end[0].date === dates.at(-1) && start[0].amountCents !== null && end[0].amountCents !== null) {
    const total = rows.reduce((sum, r) => sum + r.amountCents!, start[0].amountCents);
    if (Number.isSafeInteger(total)) reconciliation = total === end[0].amountCents ? "MATCHED" : "MISMATCH";
  }
  return { parserVersion: "SICOOB_XLSX_V1", rows, balances, reconciliation };
}
