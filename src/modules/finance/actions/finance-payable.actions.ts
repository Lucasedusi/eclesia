"use server";
import { revalidatePath, updateTag } from "next/cache";
import { unstable_rethrow } from "next/navigation";
import { cacheTags } from "@/lib/cache-tags";
import { getFinancePayable, queryFinancePayables, submitFinancePayable } from "../services/finance-payable.service";
import { financeFailure } from "../utils/finance-errors";
import type { FinanceActionResult } from "../types/finance.types";
import type { PayableDetail, PayablePage, PayableResult } from "../types/finance-payable.types";

export async function queryFinancePayablesAction(input: unknown): Promise<FinanceActionResult<PayablePage>> {
  try { return { ok: true, data: await queryFinancePayables(input) }; }
  catch (error) { unstable_rethrow(error); return financeFailure(error); }
}
export async function getFinancePayableAction(id: string): Promise<FinanceActionResult<PayableDetail>> {
  try { return { ok: true, data: await getFinancePayable(id) }; }
  catch (error) { unstable_rethrow(error); return financeFailure(error); }
}
export async function submitFinancePayableAction(input: unknown): Promise<FinanceActionResult<PayableResult>> {
  try {
    const result = await submitFinancePayable(input);
    updateTag(cacheTags.financePayables(result.churchId));
    revalidatePath("/financeiro", "layout");
    return { ok: true, data: result.data };
  } catch (error) { unstable_rethrow(error); return financeFailure(error); }
}
