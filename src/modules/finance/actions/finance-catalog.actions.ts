"use server";
import { revalidatePath } from "next/cache";
import { unstable_rethrow } from "next/navigation";
import { PERMISSIONS } from "@/modules/auth/constants/permissions";
import { requireFinanceContext } from "../services/finance-access.service";
import { saveFinanceCatalog } from "../services/finance-catalog.service";
import { financeCatalogSchema } from "../validations/finance-catalog.schemas";
import { financeFailure } from "../utils/finance-errors";
import type { FinanceActionResult } from "../types/finance.types";
export async function saveFinanceCatalogAction(input:unknown):Promise<FinanceActionResult<{id:string}>> {
 try {
  const value=financeCatalogSchema.parse(input);
  const context=await requireFinanceContext({congregationId:value.congregationId,permission:PERMISSIONS.financeSettings});
  const data=await saveFinanceCatalog(context,value);revalidatePath("/financeiro","layout");return {ok:true,data};
 } catch(error) { unstable_rethrow(error); return financeFailure(error); }
}
