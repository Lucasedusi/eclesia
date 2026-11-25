"use server";
import { unstable_rethrow } from "next/navigation";
import { financeFailure } from "../utils/finance-errors";
import type { FinanceActionResult } from "../types/finance.types";
import {
  confirmAccountingImport,
  exportAccounting,
  getAccountingHistory,
  getAccountingPreview,
  updateAccountingCode,
} from "../services/finance-accounting.service";
import type {
  AccountingCodeChange,
  AccountingFilters,
} from "../validations/finance-accounting.schemas";

async function result<T>(
  work: () => Promise<T>,
): Promise<FinanceActionResult<T>> {
  try {
    return { ok: true, data: await work() };
  } catch (error) {
    unstable_rethrow(error);
    return financeFailure(error);
  }
}
export async function consultAccountingAction(
  filters: AccountingFilters,
  page: number,
) {
  return result(() => getAccountingPreview(filters, page));
}

export async function accountingHistoryAction(
  filters: AccountingFilters,
  page: number,
) {
  return result(() => getAccountingHistory(filters.unit, filters.box, page));
}

export async function exportAccountingAction(
  filters: AccountingFilters,
  fingerprint: string,
  repeat: boolean,
) {
  return result(() => exportAccounting(filters, fingerprint, repeat));
}
export async function saveAccountingCodeAction(change: AccountingCodeChange) {
  return result(() => updateAccountingCode(change));
}
export async function confirmAccountingAction(id: string) {
  return result(() => confirmAccountingImport(id));
}
