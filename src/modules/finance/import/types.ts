export type ParsedBankRow = {
  rowNumber: number;
  date: string | null;
  sourceDate: string;
  sourceValue: string;
  document: string;
  history: string;
  complement: string;
  amountCents: number | null;
  issue: string | null;
  fingerprint: string;
};
export type BankBalance = { date: string | null; label: string; amountCents: number | null };
export type ParsedBankStatement = {
  parserVersion: "SICOOB_XLSX_V1";
  rows: ParsedBankRow[];
  balances: BankBalance[];
  reconciliation: "MATCHED" | "MISMATCH" | "UNAVAILABLE";
};
export type BankImportStatus = "PENDING" | "POSTED" | "LINKED" | "IGNORED" | "DUPLICATE";
export type BankImportBatch = {
  id: string; cashboxId: string; cashboxName: string; fileName: string;
  createdAt: string; dateFrom: string | null; dateTo: string | null;
  total: number; pending: number; incomeCents: number; expenseCents: number;
  reconciliation: ParsedBankStatement["reconciliation"]; reconciliationReason: string | null; balances: BankBalance[];
};
export type BankImportItem = ParsedBankRow & {
  id: string; batchId: string; revision: number; status: BankImportStatus;
  draft: Record<string, unknown>; reason: string | null;
  stale: boolean; changed: boolean; cancelled: boolean; canonicalId: string | null;
  result: { transactionIds?: string[]; attendanceId?: string | null; transferId?: string | null; receiptId?: string | null } | null;
  historyEvents: { action: string; reason: string | null; at: string; actor: string }[];
};
export type BankImportWorkspace = {
  batch: BankImportBatch; items: BankImportItem[]; page: number; pageCount: number;
  counts: { pending: number; completed: number; ignored: number; total: number };
};
export type BankImportCandidate = {
  kind: "ITEM" | "TRANSACTION" | "ATTENDANCE" | "TRANSFER";
  id: string; label: string; date: string; amountCents: number;
  strong: boolean; compatible: boolean; status: string;
};
