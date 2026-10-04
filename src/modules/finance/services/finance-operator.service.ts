import "server-only";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import type { FinanceContext } from "../types/finance.types";
import { throwFinanceDatabaseError } from "../utils/finance-errors";
export type FinanceOperator = {
  id: string;
  name: string;
  scope: "CHURCH" | "REGION" | "MINISTRY";
  unitId: string | null;
  allowedUnitIds: string[];
};
export const operatorAssignmentSchema = z
  .object({
    congregationId: z.uuid(),
    accessId: z.uuid(),
    operatingUnit: z.uuid().nullable(),
  })
  .strict();
export async function listFinanceOperators(
  context: FinanceContext,
): Promise<FinanceOperator[]> {
  if (!context.capabilities.manageSettings) throw new Error("FORBIDDEN");
  const client = await createClient();
  const { data, error } = await client.rpc("list_finance_operators", {
    p_church_id: context.churchId,
    p_unit: context.congregationId,
  });
  if (error) throwFinanceDatabaseError(error);
  return data as FinanceOperator[];
}
export async function assignFinanceOperator(
  context: FinanceContext,
  input: unknown,
) {
  if (!context.capabilities.manageSettings) throw new Error("FORBIDDEN");
  const value = operatorAssignmentSchema.parse(input);
  if (value.congregationId !== context.congregationId)
    throw new Error("FORBIDDEN");
  const client = await createClient();
  const { error } = await client.rpc("assign_finance_operator", {
    p_church_id: context.churchId,
    p_unit: context.congregationId,
    p_access_id: value.accessId,
    p_operating_unit: value.operatingUnit!,
  });
  if (error) throwFinanceDatabaseError(error);
}
