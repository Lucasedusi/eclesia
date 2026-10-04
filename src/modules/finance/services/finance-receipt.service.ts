import "server-only";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import type { FinanceContext } from "../types/finance.types";
import type { ReceiptDTO } from "../types/finance-command.types";
import { throwFinanceDatabaseError } from "../utils/finance-errors";
export async function getFinanceReceipt(
  context: FinanceContext,
  receiptId: string,
): Promise<ReceiptDTO> {
  if (!context.capabilities.view) throw new Error("FORBIDDEN");
  const c = await createClient();
  const { data, error } = await c
    .from("financial_receipts")
    .select("id,snapshot,receipt_status,receipt_type")
    .eq("church_id", context.churchId)
    .eq("congregation_id", context.congregationId)
    .eq("id", z.uuid().parse(receiptId))
    .is("deleted_at", null)
    .maybeSingle();
  if (error) throwFinanceDatabaseError(error);
  if (!data) throw new Error("FORBIDDEN");
  if (!data.snapshot) throw new Error("LEGACY_DATA_REQUIRES_REVIEW");
  return {
    ...(data.snapshot as Omit<ReceiptDTO, "status">),
    direction: data.receipt_type === "EXPENSE" ? "EXPENSE" : "INCOME",
    status: data.receipt_status,
  };
}
export async function recordPrintRequest(
  context: FinanceContext,
  receiptId: string,
): Promise<void> {
  await getFinanceReceipt(context, receiptId);
  const c = await createClient();
  const { error } = await c.rpc("record_finance_print_request", {
    p_church_id: context.churchId,
    p_receipt_id: receiptId,
  });
  if (error) throwFinanceDatabaseError(error);
}
