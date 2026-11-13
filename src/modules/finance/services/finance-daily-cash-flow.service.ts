import "server-only";
import { createClient } from "@/lib/supabase/server";
import { PERMISSIONS } from "@/modules/auth/constants/permissions";
import { requireFinanceContext } from "./finance-access.service";
import { hasFinanceAdminAccess } from "../utils/finance-report-access";
import { todayLocal } from "../utils/finance-period";
import { throwFinanceDatabaseError } from "../utils/finance-errors";
import { dailyCashFlowPage, dailyCashFlowQuery } from "../validations/finance-daily-cash-flow.schemas";

export async function getDailyCashFlow(params: Record<string, string | string[] | undefined>) {
  const context = await requireFinanceContext({ permission: PERMISSIONS.financeView });
  if (!hasFinanceAdminAccess(context)) throw new Error("FORBIDDEN");
  const today = todayLocal();
  const filters = dailyCashFlowQuery.parse({ ...params, date: params.date ?? today });
  const client = await createClient();
  const { data, error } = await client.rpc("get_finance_daily_cash_flow", {
    p_church_id: context.churchId,
    p_filters: filters,
  });
  if (error?.message === "REPORT_RECONCILIATION_REQUIRED") throw new Error("REPORT_RECONCILIATION_REQUIRED");
  if (error) throwFinanceDatabaseError(error);
  const result = dailyCashFlowPage.safeParse(data);
  if (!result.success || result.data.date !== filters.date || result.data.box !== (filters.box ?? null))
    throw new Error("UNAVAILABLE");
  return { data: result.data, filters, today };
}
