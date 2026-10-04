"use server";
import { z } from "zod";
import { unstable_rethrow } from "next/navigation";
import { PERMISSIONS } from "@/modules/auth/constants/permissions";
import { requireFinanceContext } from "../services/finance-access.service";
import {
  prepareFinanceDocument,
  finalizeFinanceDocument,
  discardFinanceDocument,
  getFinanceDocumentUrl,
} from "../services/finance-document.service";
import { financeUploadSchema } from "../utils/finance-documents";
import { financeFailure } from "../utils/finance-errors";
import type { FinanceActionResult } from "../types/finance.types";
import type { PreparedFinanceDocument } from "../types/finance-document.types";
export async function prepareFinanceDocumentAction(
  congregationId: string,
  input: unknown,
): Promise<FinanceActionResult<PreparedFinanceDocument>> {
  try {
    const value = financeUploadSchema.parse(input);
    const context = await requireFinanceContext({
      congregationId: z.uuid().parse(congregationId),
      permission: PERMISSIONS.financeView,
    });
    return { ok: true, data: await prepareFinanceDocument(context, value) };
  } catch (e) {
    unstable_rethrow(e);
    return financeFailure(e);
  }
}
export async function finalizeFinanceDocumentAction(
  congregationId: string,
  uploadId: string,
): Promise<FinanceActionResult<{ documentId: string }>> {
  try {
    const context = await requireFinanceContext({
      congregationId: z.uuid().parse(congregationId),
      permission: PERMISSIONS.financeView,
    });
    return { ok: true, data: await finalizeFinanceDocument(context, uploadId) };
  } catch (e) {
    unstable_rethrow(e);
    return financeFailure(e);
  }
}
export async function discardFinanceDocumentAction(
  congregationId: string,
  uploadId: string,
): Promise<FinanceActionResult<null>> {
  try {
    const context = await requireFinanceContext({
      congregationId: z.uuid().parse(congregationId),
      permission: PERMISSIONS.financeView,
    });
    await discardFinanceDocument(context, uploadId);
    return { ok: true, data: null };
  } catch (e) {
    unstable_rethrow(e);
    return financeFailure(e);
  }
}
export async function getFinanceDocumentUrlAction(
  congregationId: string,
  documentId: string,
): Promise<FinanceActionResult<{ url: string; expiresAt: string }>> {
  try {
    const context = await requireFinanceContext({
      congregationId: z.uuid().parse(congregationId),
      permission: PERMISSIONS.financeView,
    });
    return { ok: true, data: await getFinanceDocumentUrl(context, documentId) };
  } catch (e) {
    unstable_rethrow(e);
    return financeFailure(e);
  }
}
