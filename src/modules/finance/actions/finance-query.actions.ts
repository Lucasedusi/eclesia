"use server";
import { unstable_rethrow } from "next/navigation";
import { PERMISSIONS } from "@/modules/auth/constants/permissions";
import { requireFinanceContext } from "../services/finance-access.service";
import { getFinanceTransaction } from "../services/finance-query.service";
import { financeFailure } from "../utils/finance-errors";
import type { FinanceActionResult } from "../types/finance.types";
import type { FinanceTransactionDetail } from "../types/finance-query.types";
export async function getFinanceTransactionAction(
  unit: string,
  id: string,
): Promise<FinanceActionResult<FinanceTransactionDetail>> {
  try {
    const context = await requireFinanceContext({
      congregationId: unit,
      permission: PERMISSIONS.financeView,
    });
    return { ok: true, data: await getFinanceTransaction(context, id) };
  } catch (e) {
    unstable_rethrow(e);
    return financeFailure(e);
  }
}
