import "server-only";
import { createHash } from "node:crypto";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import type { Json } from "@/lib/supabase/database.types";
import type { FinanceContext } from "../types/finance.types";
import { throwFinanceDatabaseError } from "../utils/finance-errors";
import { BANK_IMPORT_MAX_BYTES, parseBankStatement } from "./parser.service";
import {
  bankImportFiltersSchema,
  bankImportMutationSchema,
  bankImportLifecycleSchema,
} from "./schemas";
import type {
  BankImportLifecycleResult,
  BankImportBatch,
  BankImportCandidate,
  BankImportItem,
  BankImportWorkspace,
} from "./types";

function requireImport(context: FinanceContext) {
  if (!context.capabilities.view || !context.capabilities.create)
    throw new Error("FORBIDDEN");
}
export async function prepareBankImport(
  context: FinanceContext,
  cashboxId: string,
  file: File,
) {
  requireImport(context);
  z.uuid().parse(cashboxId);
  if (
    !(file instanceof File) ||
    !/\.xlsx$/i.test(file.name) ||
    !file.size ||
    file.size > BANK_IMPORT_MAX_BYTES
  )
    throw new Error("BANK_IMPORT_FILE");
  const c = await createClient();
  const account = await c
    .from("financial_cashboxes")
    .select("id")
    .eq("church_id", context.churchId)
    .eq("congregation_id", context.congregationId)
    .eq("id", cashboxId)
    .eq("cashbox_type", "BANK_ACCOUNT")
    .eq("status", "ACTIVE")
    .is("deleted_at", null)
    .single();
  if (account.error && account.error.code !== "PGRST116")
    throwFinanceDatabaseError(account.error);
  if (!account.data) throw new Error("INACTIVE_REFERENCE");
  const bytes = Buffer.from(await file.arrayBuffer());
  let parsed;
  try {
    parsed = await parseBankStatement(bytes);
  } catch {
    throw new Error("BANK_IMPORT_FILE");
  }
  const fileName = file.name
    .split(/[\\/]/)
    .pop()!
    .replace(/[\x00-\x1f\x7f]/g, "")
    .slice(0, 180);
  const { data, error } = await c.rpc("prepare_finance_bank_import", {
    p_church_id: context.churchId,
    p_unit: context.congregationId,
    p_cashbox: cashboxId,
    p_file_hash: createHash("sha256").update(bytes).digest("hex"),
    p_file_name: fileName,
    p_data: parsed as unknown as Json,
  });
  if (error) throwFinanceDatabaseError(error);
  return data as { id: string; replayed: boolean };
}
export async function listBankImports(
  context: FinanceContext,
  cashboxId?: string,
  page = 1,
) {
  requireImport(context);
  if (cashboxId) z.uuid().parse(cashboxId);
  z.number().int().min(1).max(10000).parse(page);
  const c = await createClient();
  const { data, error } = await c.rpc("list_finance_bank_imports", {
    p_church_id: context.churchId,
    p_unit: context.congregationId,
    ...(cashboxId ? { p_cashbox: cashboxId } : {}),
    p_page: page,
  });
  if (error) throwFinanceDatabaseError(error);
  return data as unknown as {
    batches: BankImportBatch[];
    page: number;
    pageCount: number;
  };
}
export async function getBankImport(
  context: FinanceContext,
  batchId: string,
  filters: unknown,
): Promise<BankImportWorkspace> {
  requireImport(context);
  z.uuid().parse(batchId);
  const c = await createClient();
  const { data, error } = await c.rpc("get_finance_bank_import", {
    p_church_id: context.churchId,
    p_unit: context.congregationId,
    p_batch: batchId,
    p_filters: bankImportFiltersSchema.parse(filters),
  });
  if (error) throwFinanceDatabaseError(error);
  return data as unknown as BankImportWorkspace;
}
export async function mutateBankImport(
  context: FinanceContext,
  input: unknown,
): Promise<BankImportItem> {
  requireImport(context);
  const value = bankImportMutationSchema.parse(input);
  if (value.unit !== context.congregationId) throw new Error("FORBIDDEN");
  const c = await createClient();
  const { data, error } = await c.rpc("finance_bank_import_item", {
    p_church_id: context.churchId,
    p_unit: context.congregationId,
    p_item: value.itemId,
    p_revision: value.revision,
    p_operation_key: value.operationKey,
    p_action: value.action,
    p_payload: value.payload,
  });
  if (error) throwFinanceDatabaseError(error);
  return data as unknown as BankImportItem;
}
export async function getBankImportCandidates(
  context: FinanceContext,
  itemId: string,
  query: string,
): Promise<BankImportCandidate[]> {
  requireImport(context);
  z.uuid().parse(itemId);
  z.string().max(100).parse(query);
  const c = await createClient();
  const { data, error } = await c.rpc("finance_bank_import_candidates", {
    p_church_id: context.churchId,
    p_unit: context.congregationId,
    p_item: itemId,
    p_query: query,
  });
  if (error) throwFinanceDatabaseError(error);
  return data as unknown as BankImportCandidate[];
}

export async function manageBankImport(
  context: FinanceContext,
  input: unknown,
): Promise<BankImportLifecycleResult> {
  requireImport(context);
  const value = bankImportLifecycleSchema.parse(input);
  if (value.unit !== context.congregationId) throw new Error("FORBIDDEN");
  const c = await createClient();
  const { data, error } = await c.rpc("manage_finance_bank_import", {
    p_church_id: context.churchId,
    p_unit: context.congregationId,
    p_batch: value.batchId,
    p_item: value.action === "DELETE_BATCH" ? null! : value.itemId,
    p_revision: value.action === "DELETE_BATCH" ? null! : value.revision,
    p_operation_key: value.operationKey,
    p_action: value.action,
  });
  if (error) throwFinanceDatabaseError(error);
  return data as unknown as BankImportLifecycleResult;
}
