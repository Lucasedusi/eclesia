"use server";
import { revalidatePath, updateTag } from "next/cache";
import { unstable_rethrow } from "next/navigation";
import { cacheTags } from "@/lib/cache-tags";
import { PERMISSIONS } from "@/modules/auth/constants/permissions";
import { requireFinanceContext } from "../services/finance-access.service";
import {
  saveStatementRules,
  copyStatementRules,
  generateStatement,
} from "../services/finance-statement.service";
import {
  statementRulesSchema,
  copyStatementRulesSchema,
  generateStatementSchema,
} from "../validations/finance-statement.schemas";
import { financeFailure } from "../utils/finance-errors";
import type { FinanceActionResult } from "../types/finance.types";
import type { StatementVersionDTO } from "../types/finance-statement.types";
export async function saveStatementRulesAction(
  input: unknown,
): Promise<FinanceActionResult<{ ruleSetId: string; revision: number }>> {
  try {
    const value = statementRulesSchema.parse(input);
    const context = await requireFinanceContext({
      congregationId: value.congregationId,
      permission: PERMISSIONS.financeSettings,
    });
    const data = await saveStatementRules(context, value);
    updateTag(cacheTags.financeUnit(context.churchId, context.congregationId));
    revalidatePath("/financeiro", "layout");
    return { ok: true, data };
  } catch (e) {
    unstable_rethrow(e);
    return financeFailure(e);
  }
}
export async function copyStatementRulesAction(
  input: unknown,
): Promise<FinanceActionResult<{ ruleSetId: string; revision: number }>> {
  try {
    const value = copyStatementRulesSchema.parse(input);
    const context = await requireFinanceContext({
      congregationId: value.toCongregationId,
      permission: PERMISSIONS.financeSettings,
    });
    const data = await copyStatementRules(context, value);
    updateTag(cacheTags.financeUnit(context.churchId, context.congregationId));
    revalidatePath("/financeiro", "layout");
    return { ok: true, data };
  } catch (e) {
    unstable_rethrow(e);
    return financeFailure(e);
  }
}
export async function generateStatementAction(
  input: unknown,
): Promise<FinanceActionResult<StatementVersionDTO>> {
  try {
    const value = generateStatementSchema.parse(input);
    const context = await requireFinanceContext({
      congregationId: value.congregationId,
      permission: PERMISSIONS.financeStatements,
    });
    const data = await generateStatement(context, value);
    revalidatePath("/financeiro/demonstrativos");
    return { ok: true, data };
  } catch (e) {
    unstable_rethrow(e);
    return financeFailure(e);
  }
}
