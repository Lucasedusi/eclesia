import "server-only";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { requireAccessContext } from "@/modules/auth/services/access-context.service";
import { PERMISSIONS } from "@/modules/auth/constants/permissions";
import { listFinanceUnits } from "./finance-access.service";
import { canManagePayables } from "../utils/finance-payables";
import { throwFinanceDatabaseError } from "../utils/finance-errors";
import type { FinanceContext } from "../types/finance.types";
import { payableCommandSchema, payableQuerySchema, payablePageSchema, payableDetailSchema, payableResultSchema } from "../validations/finance-payable.schemas";

export async function requirePayableContext(): Promise<FinanceContext> {
  const auth = await requireAccessContext(PERMISSIONS.financePayables);
  if (!canManagePayables(auth)) throw new Error("FORBIDDEN");
  const headquarters = (await listFinanceUnits(auth)).filter((u) => u.isHeadquarters);
  if (headquarters.length !== 1 || !headquarters[0].capabilities?.view) throw new Error("CONFIGURATION_REQUIRED");
  return { auth, churchId: auth.church.id, congregationId: headquarters[0].id, capabilities: headquarters[0].capabilities };
}
export async function queryFinancePayables(input: unknown) {
  const query = payableQuerySchema.parse(input), context = await requirePayableContext(), client = await createClient();
  const { data, error } = await client.rpc("query_finance_payables", { p_church_id: context.churchId, p_options: query });
  if (error) throwFinanceDatabaseError(error);
  const result = payablePageSchema.safeParse(data);
  if (!result.success || result.data.churchId !== context.churchId || result.data.headquartersId !== context.congregationId) throw new Error("UNAVAILABLE");
  return result.data;
}
export async function getFinancePayable(input: unknown) {
  const id = z.uuid().parse(input), context = await requirePayableContext(), client = await createClient();
  const { data, error } = await client.rpc("get_finance_payable", { p_church_id: context.churchId, p_id: id });
  if (error) throwFinanceDatabaseError(error);
  const result = payableDetailSchema.safeParse(data);
  if (!result.success || result.data.item.id !== id) throw new Error("UNAVAILABLE");
  return result.data;
}
export async function submitFinancePayable(input: unknown) {
  const command = payableCommandSchema.parse(input), context = await requirePayableContext(), client = await createClient();
  const { data, error } = await client.rpc("execute_finance_payable", { p_church_id: context.churchId, p_command: command });
  if (error) throwFinanceDatabaseError(error);
  const result = payableResultSchema.safeParse(data);
  if (!result.success) throw new Error("UNAVAILABLE");
  return { data: result.data, churchId: context.churchId };
}
