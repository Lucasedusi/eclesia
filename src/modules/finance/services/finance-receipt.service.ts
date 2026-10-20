import "server-only";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { loadChurchLogoDataUri } from "@/modules/auth/services/church-logo.service";
import type { FinanceContext } from "../types/finance.types";
import type { ReceiptDTO } from "../types/finance-command.types";
import { throwFinanceDatabaseError } from "../utils/finance-errors";
async function findFinanceReceipt(
  context: FinanceContext,
  receiptId: string,
) {
  if (!context.capabilities.view) throw new Error("FORBIDDEN");
  const c = await createClient();
  const { data, error } = await c
    .from("financial_receipts")
    .select("id,snapshot,receipt_status,receipt_type,created_at")
    .eq("church_id", context.churchId)
    .eq("congregation_id", context.congregationId)
    .eq("id", z.uuid().parse(receiptId))
    .is("deleted_at", null)
    .maybeSingle();
  if (error) throwFinanceDatabaseError(error);
  if (!data) throw new Error("FORBIDDEN");
  if (!data.snapshot) throw new Error("LEGACY_DATA_REQUIRES_REVIEW");
  return { data, client: c };
}
export async function getFinanceReceipt(
  context: FinanceContext,
  receiptId: string,
): Promise<ReceiptDTO> {
  const { data, client } = await findFinanceReceipt(context, receiptId);
  const [church, settings, unit] = await Promise.all([
    client.from("churches")
      .select("name,logo_url")
      .eq("id", context.churchId)
      .is("deleted_at", null)
      .maybeSingle(),
    client.from("app_settings")
      .select("display_church_name,logo_url")
      .eq("church_id", context.churchId)
      .is("deleted_at", null)
      .maybeSingle(),
    client.from("congregations")
      .select("address,number,complement,district,city,state,zip_code")
      .eq("church_id", context.churchId)
      .eq("id", context.congregationId)
      .is("deleted_at", null)
      .maybeSingle(),
  ]);
  if (church.error || settings.error || unit.error || !church.data || !unit.data) {
    throw new Error("UNAVAILABLE");
  }
  const logoDataUri = await loadChurchLogoDataUri(
    settings.data?.logo_url || church.data.logo_url || context.auth.church.logoUrl,
    context.churchId,
    client,
  );
  return {
    ...(data.snapshot as Omit<ReceiptDTO, "status">),
    direction: data.receipt_type === "EXPENSE" ? "EXPENSE" : "INCOME",
    status: data.receipt_status,
    churchName: settings.data?.display_church_name?.trim() || church.data.name,
    logoDataUri,
    congregationAddress: [
      [unit.data.address, unit.data.number].filter(Boolean).join(", "),
      unit.data.complement,
      unit.data.district,
      [unit.data.city, unit.data.state].filter(Boolean).join(" / "),
      unit.data.zip_code ? `CEP ${unit.data.zip_code}` : null,
    ].filter(Boolean).join(" · ") || null,
    // Persisted creation time of this receipt version, never the current print time.
    registeredAt: data.created_at,
  };
}
export async function recordPrintRequest(
  context: FinanceContext,
  receiptId: string,
): Promise<void> {
  const { client } = await findFinanceReceipt(context, receiptId);
  const { error } = await client.rpc("record_finance_print_request", {
    p_church_id: context.churchId,
    p_receipt_id: receiptId,
  });
  if (error) throwFinanceDatabaseError(error);
}
