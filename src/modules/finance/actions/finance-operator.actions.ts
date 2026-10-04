"use server";
import { revalidatePath } from "next/cache";
import { unstable_rethrow } from "next/navigation";
import { PERMISSIONS } from "@/modules/auth/constants/permissions";
import { requireFinanceContext } from "../services/finance-access.service";
import {
  operatorAssignmentSchema,
  assignFinanceOperator,
} from "../services/finance-operator.service";
import { financeFailure } from "../utils/finance-errors";
import type { FinanceActionResult } from "../types/finance.types";
export async function assignFinanceOperatorAction(
  input: unknown,
): Promise<FinanceActionResult<null>> {
  try {
    const value = operatorAssignmentSchema.parse(input);
    const context = await requireFinanceContext({
      congregationId: value.congregationId,
      permission: PERMISSIONS.financeSettings,
    });
    await assignFinanceOperator(context, value);
    revalidatePath("/financeiro", "layout");
    return { ok: true, data: null };
  } catch (error) {
    unstable_rethrow(error);
    return financeFailure(error);
  }
}
