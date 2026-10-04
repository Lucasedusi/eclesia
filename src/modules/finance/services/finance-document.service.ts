import "server-only";
import { createHash } from "node:crypto";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  FINANCE_DOCUMENT_BUCKET as bucket,
  validateFinanceUpload,
  verifyFinanceFile,
  financeUploadSchema,
} from "../utils/finance-documents";
import { throwFinanceDatabaseError } from "../utils/finance-errors";
import type { FinanceContext } from "../types/finance.types";
import type { PreparedFinanceDocument } from "../types/finance-document.types";
function requireDocumentWrite(context: FinanceContext) {
  if (!context.capabilities.create && !context.capabilities.update)
    throw new Error("FORBIDDEN");
}
async function loadUpload(context: FinanceContext, id: string) {
  const c = await createClient();
  const { data, error } = await c
    .from("financial_document_uploads")
    .select(
      "id,created_by,file_name,mime_type,file_size,pending_path,storage_path,status,content_hash",
    )
    .eq("church_id", context.churchId)
    .eq("congregation_id", context.congregationId)
    .eq("id", z.uuid().parse(id))
    .is("deleted_at", null)
    .maybeSingle();
  if (error) throwFinanceDatabaseError(error);
  if (!data || data.created_by !== context.auth.profile.id)
    throw new Error("FORBIDDEN");
  return data;
}
export async function prepareFinanceDocument(
  context: FinanceContext,
  input: z.infer<typeof financeUploadSchema>,
): Promise<PreparedFinanceDocument> {
  requireDocumentWrite(context);
  const v = validateFinanceUpload(input);
  const c = await createClient();
  const { data, error } = await c.rpc("prepare_finance_upload", {
    p_church_id: context.churchId,
    p_unit: context.congregationId,
    p_name: v.name,
    p_type: v.type,
    p_size: v.size,
  });
  if (error) throwFinanceDatabaseError(error);
  const prepared = data as { uploadId: string; path: string };
  const signed = await c.storage
    .from(bucket)
    .createSignedUploadUrl(prepared.path, { upsert: false });
  if (signed.error || !signed.data) throw new Error("UNAVAILABLE");
  return { ...prepared, token: signed.data.token };
}
export async function finalizeFinanceDocument(
  context: FinanceContext,
  uploadId: string,
): Promise<{ documentId: string }> {
  requireDocumentWrite(context);
  const upload = await loadUpload(context, uploadId);
  if (["READY", "LINKED"].includes(upload.status))
    return { documentId: upload.id };
  if (upload.status !== "PENDING") throw new Error("CONFLICT");
  const c = await createClient();
  const pending = await c.storage.from(bucket).download(upload.pending_path);
  if (pending.error || !pending.data) throw new Error("UNAVAILABLE");
  if (pending.data.size !== Number(upload.file_size))
    throw new Error("INVALID_INPUT");
  const bytes = new Uint8Array(await pending.data.arrayBuffer());
  verifyFinanceFile(bytes, upload.mime_type);
  const hash = createHash("sha256").update(bytes).digest("hex");
  // A distinct final object prevents a signed pending-upload URL from replacing verified bytes.
  const admin = createAdminClient();
  const written = await admin.storage
    .from(bucket)
    .upload(upload.storage_path, bytes, {
      contentType: upload.mime_type,
      upsert: false,
    });
  if (written.error) {
    const latest = await loadUpload(context, uploadId);
    if (
      ["READY", "LINKED"].includes(latest.status) &&
      latest.content_hash === hash
    )
      return { documentId: upload.id };
    if (latest.status !== "PENDING") throw new Error("CONFLICT");
    const existing = await admin.storage
      .from(bucket)
      .download(upload.storage_path);
    if (existing.error || !existing.data || existing.data.size !== bytes.length)
      throw new Error("UNAVAILABLE");
    const existingHash = createHash("sha256")
      .update(new Uint8Array(await existing.data.arrayBuffer()))
      .digest("hex");
    if (existingHash !== hash) throw new Error("UNAVAILABLE");
  }
  const marked = await admin
    .from("financial_document_uploads")
    .update({
      status: "READY",
      content_hash: hash,
      updated_at: new Date().toISOString(),
    })
    .eq("church_id", context.churchId)
    .eq("congregation_id", context.congregationId)
    .eq("id", upload.id)
    .eq("created_by", context.auth.profile.id)
    .eq("status", "PENDING")
    .is("deleted_at", null)
    .select("id")
    .maybeSingle();
  if (marked.error || !marked.data) {
    // Never remove a verified file after an ambiguous metadata response; a retry resolves its state.
    throw new Error("UNAVAILABLE");
  }
  return { documentId: upload.id };
}
export async function discardFinanceDocument(
  context: FinanceContext,
  uploadId: string,
) {
  requireDocumentWrite(context);
  const c = await createClient();
  const { data, error } = await c.rpc("discard_finance_upload", {
    p_church_id: context.churchId,
    p_unit: context.congregationId,
    p_upload_id: z.uuid().parse(uploadId),
  });
  if (error) throwFinanceDatabaseError(error);
  const paths = data as { pendingPath: string; storagePath: string };
  // The RPC locks and marks only an unattached upload; financial commands can no longer link it.
  const admin = createAdminClient();
  const removed = await admin.storage
    .from(bucket)
    .remove([paths.pendingPath, paths.storagePath]);
  if (removed.error) throw new Error("UNAVAILABLE");
}
export async function getFinanceDocumentUrl(
  context: FinanceContext,
  documentId: string,
): Promise<{ url: string; expiresAt: string }> {
  if (!context.capabilities.view) throw new Error("FORBIDDEN");
  const c = await createClient();
  const { data, error } = await c
    .from("financial_documents")
    .select("id,storage_path,storage_bucket,status")
    .eq("church_id", context.churchId)
    .eq("congregation_id", context.congregationId)
    .eq("id", z.uuid().parse(documentId))
    .is("deleted_at", null)
    .maybeSingle();
  if (error) throwFinanceDatabaseError(error);
  if (
    !data ||
    data.status !== "ACTIVE" ||
    data.storage_bucket !== bucket ||
    !data.storage_path.startsWith(
      `${context.churchId}/${context.congregationId}/`,
    )
  )
    throw new Error("FORBIDDEN");
  const signed = await c.storage
    .from(bucket)
    .createSignedUrl(data.storage_path, 60, { download: true });
  if (signed.error || !signed.data) throw new Error("UNAVAILABLE");
  return {
    url: signed.data.signedUrl,
    expiresAt: new Date(Date.now() + 60000).toISOString(),
  };
}
