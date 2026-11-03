import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { loadChurchLogoDataUri } from "@/modules/auth/services/church-logo.service";
import type { FinanceContext } from "../types/finance.types";
import type { DigitalReceipt, DigitalReceiptLink } from "../types/finance-digital-receipt.types";
import { digitalReceiptSnapshotSchema } from "../validations/finance-digital-receipt.schemas";
import { DIGITAL_RECEIPT_TOKEN, SHAREABLE_RECEIPT_STATUSES, buildDigitalReceiptUrl } from "../utils/finance-digital-receipt";
import { getFinanceReceipt } from "./finance-receipt.service";

function tokenHash(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export async function createFinanceDigitalReceiptLink(context: FinanceContext, receiptId: string): Promise<DigitalReceiptLink> {
  z.uuid().parse(receiptId);
  const receipt = await getFinanceReceipt(context, receiptId);
  if (!SHAREABLE_RECEIPT_STATUSES.includes(receipt.status)) throw new Error("RECEIPT_UNAVAILABLE");
  const token = randomBytes(32).toString("base64url");
  const url = buildDigitalReceiptUrl(token, process.env.NEXT_PUBLIC_SITE_URL ?? "");
  const client = await createClient();
  const { data, error } = await client.rpc("issue_finance_receipt_link", {
    p_church_id: context.churchId,
    p_receipt_id: receiptId,
    p_token_hash: tokenHash(token),
  });
  if (error || typeof data !== "string") {
    if (error?.message === "RECEIPT_LINK_LIMIT") throw new Error("RECEIPT_LINK_LIMIT");
    throw new Error("RECEIPT_UNAVAILABLE");
  }
  return { url, expiresAt: data };
}

export async function loadPublicFinanceReceipt(token: string): Promise<DigitalReceipt | null> {
  if (!DIGITAL_RECEIPT_TOKEN.test(token)) return null;
  const client = createAdminClient();
  // This RPC only resolves a hash while enforcing expiry, receipt status and a read budget.
  const access = await client.rpc("consume_finance_receipt_link", { p_token_hash: tokenHash(token) });
  if (access.error) throw new Error("RECEIPT_UNAVAILABLE");
  const scope = access.data?.[0];
  if (!scope) return null;
  const { data: receipt, error } = await client.from("financial_receipts")
    .select("snapshot,receipt_type,receipt_status,created_at")
    .eq("church_id", scope.church_id).eq("congregation_id", scope.congregation_id).eq("id", scope.receipt_id)
    .is("deleted_at", null).in("receipt_status", SHAREABLE_RECEIPT_STATUSES).maybeSingle();
  if (error) throw new Error("RECEIPT_UNAVAILABLE");
  if (!receipt || !SHAREABLE_RECEIPT_STATUSES.includes(receipt.receipt_status)) return null;
  const parsed = digitalReceiptSnapshotSchema.safeParse(receipt.snapshot);
  if (!parsed.success || !Number.isFinite(Date.parse(receipt.created_at))) return null;
  const [church, settings, unit] = await Promise.all([
    client.from("churches").select("name,logo_url,document").eq("id", scope.church_id).is("deleted_at", null).maybeSingle(),
    client.from("app_settings").select("display_church_name,logo_url").eq("church_id", scope.church_id).is("deleted_at", null).maybeSingle(),
    client.from("congregations").select("address,number,complement,district,city,state,zip_code")
      .eq("church_id", scope.church_id).eq("id", scope.congregation_id).is("deleted_at", null).maybeSingle(),
  ]);
  if (church.error || settings.error || unit.error) throw new Error("RECEIPT_UNAVAILABLE");
  if (!church.data || !unit.data) return null;
  const logoDataUri = await loadChurchLogoDataUri(settings.data?.logo_url || church.data.logo_url, scope.church_id, client);
  return {
    ...parsed.data,
    direction: receipt.receipt_type === "EXPENSE" ? "EXPENSE" : "INCOME",
    churchName: settings.data?.display_church_name?.trim() || church.data.name,
    churchDocument: church.data.document?.trim() || null,
    logoDataUri,
    registeredAt: receipt.created_at,
    congregationAddress: [
      [unit.data.address, unit.data.number].filter(Boolean).join(", "), unit.data.complement, unit.data.district,
      [unit.data.city, unit.data.state].filter(Boolean).join(" / "), unit.data.zip_code ? `CEP ${unit.data.zip_code}` : null,
    ].filter(Boolean).join(" · ") || null,
  };
}
