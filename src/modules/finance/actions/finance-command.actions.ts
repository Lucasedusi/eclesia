"use server";
import { updateTag, revalidatePath } from "next/cache";
import { unstable_rethrow } from "next/navigation";
import { cacheTags } from "@/lib/cache-tags";
import { PERMISSIONS } from "@/modules/auth/constants/permissions";
import { requireFinanceContext } from "../services/finance-access.service";
import { executeFinanceCommand } from "../services/finance-command.service";
import { financeCommandSchema } from "../validations/finance-command.schemas";
import { financeFailure } from "../utils/finance-errors";
import type { FinanceActionResult } from "../types/finance.types";
import type { FinanceMutationResult } from "../types/finance-command.types";
export async function submitFinanceCommand(
  input: unknown,
): Promise<FinanceActionResult<FinanceMutationResult>> {
  try {
    const command = financeCommandSchema.parse(input);
    const permissions = {
      RECORD: PERMISSIONS.financeCreate,
      CORRECT_TRANSACTION: PERMISSIONS.financeUpdate,
      CANCEL_TRANSACTION: PERMISSIONS.financeCancel,
      CANCEL_ATTENDANCE: PERMISSIONS.financeCancel,
      TRANSFER: PERMISSIONS.financeTransfers,
      CORRECT_TRANSFER: PERMISSIONS.financeTransfers,
      CANCEL_TRANSFER: PERMISSIONS.financeTransfers,
      ADJUST_BALANCE: PERMISSIONS.financeSettings,
    };
    const context = await requireFinanceContext({
      congregationId: command.congregationId,
      permission: permissions[command.kind],
    });
    const data = await executeFinanceCommand(context, command);
    updateTag(cacheTags.financeUnit(context.churchId, context.congregationId));
    // Unit invalidation covers both old and new months of retroactive corrections.
    revalidatePath("/financeiro", "layout");
    revalidatePath("/membros", "layout");
    return { ok: true, data };
  } catch (error) {
    unstable_rethrow(error);
    return financeFailure(error);
  }
}
