"use server";
import { z } from "zod";
import { revalidatePath, updateTag } from "next/cache";
import { unstable_rethrow } from "next/navigation";
import { PERMISSIONS } from "@/modules/auth/constants/permissions";
import { cacheTags } from "@/lib/cache-tags";
import { requireFinanceContext } from "../services/finance-access.service";
import { financeFailure } from "../utils/finance-errors";
import type { FinanceActionResult } from "../types/finance.types";
import { bankImportMutationSchema } from "./schemas";
import {
  getBankImportCandidates,
  mutateBankImport,
  prepareBankImport,
} from "./service";
import type { BankImportCandidate, BankImportItem } from "./types";

export async function prepareBankImportAction(
  form: FormData,
): Promise<FinanceActionResult<{ id: string; replayed: boolean }>> {
  try {
    const unit = z.uuid().parse(form.get("unit")),
      cashbox = z.uuid().parse(form.get("cashboxId")),
      file = form.get("file");
    const context = await requireFinanceContext({
      congregationId: unit,
      permission: PERMISSIONS.financeCreate,
    });
    if (!(file instanceof File)) throw new Error("BANK_IMPORT_FILE");
    const data = await prepareBankImport(context, cashbox, file);
    revalidatePath("/financeiro/lancamentos/importacoes");
    return { ok: true, data };
  } catch (error) {
    unstable_rethrow(error);
    return financeFailure(error);
  }
}
export async function mutateBankImportAction(
  input: unknown,
): Promise<FinanceActionResult<BankImportItem>> {
  try {
    const value = bankImportMutationSchema.parse(input);
    const context = await requireFinanceContext({
      congregationId: value.unit,
      permission: PERMISSIONS.financeCreate,
    });
    const data = await mutateBankImport(context, value);
    updateTag(cacheTags.financeUnit(context.churchId, context.congregationId));
    revalidatePath("/financeiro", "layout");
    if (value.action === "POST") revalidatePath("/membros", "layout");
    return { ok: true, data };
  } catch (error) {
    unstable_rethrow(error);
    return financeFailure(error);
  }
}
export async function getBankImportCandidatesAction(
  unit: string,
  itemId: string,
  query = "",
): Promise<FinanceActionResult<BankImportCandidate[]>> {
  try {
    const context = await requireFinanceContext({
      congregationId: z.uuid().parse(unit),
      permission: PERMISSIONS.financeCreate,
    });
    return {
      ok: true,
      data: await getBankImportCandidates(context, itemId, query),
    };
  } catch (error) {
    unstable_rethrow(error);
    return financeFailure(error);
  }
}
