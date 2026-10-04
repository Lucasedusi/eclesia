import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { FinanceContext } from "../types/finance.types";
import type {
  FinanceCommand,
  FinanceMutationResult,
} from "../types/finance-command.types";
import { financeCommandSchema } from "../validations/finance-command.schemas";
import { throwFinanceDatabaseError } from "../utils/finance-errors";
export async function executeFinanceCommand(
  context: FinanceContext,
  input: FinanceCommand,
): Promise<FinanceMutationResult> {
  const command = financeCommandSchema.parse(input);
  if (command.congregationId !== context.congregationId)
    throw new Error("FORBIDDEN");
  const c = await createClient();
  const { data, error } = await c.rpc("execute_finance_command", {
    p_church_id: context.churchId,
    p_payload: command,
  });
  if (error) throwFinanceDatabaseError(error);
  return data as FinanceMutationResult;
}
