import "server-only";
import { randomUUID } from "node:crypto";
import { createClient } from "@/lib/supabase/server";
import { FinanceReportError } from "../types/finance-report.types";
import type { FinanceContext } from "../types/finance.types";
import { hasFinanceAdminAccess } from "../utils/finance-report-access";
import { sumCents } from "../utils/finance-money";
import {
  dailyReportOptions,
  dailyReportSnapshot,
  type DailyReportOptions,
  type DailyReportDocument,
} from "../validations/finance-daily-report.schemas";
import { loadFinanceReportIdentity } from "./finance-report.service";

export async function getDailyCashFlowReport(
  context: FinanceContext,
  input: DailyReportOptions,
): Promise<DailyReportDocument> {
  if (!hasFinanceAdminAccess(context))
    throw new FinanceReportError("FORBIDDEN");
  const options = dailyReportOptions.parse(input);
  const client = await createClient();
  const { data, error } = await client.rpc(
    "get_finance_daily_cash_flow_report",
    {
      p_church_id: context.churchId,
      p_day: options.date,
      p_box: options.box,
      p_detail: options.presentation === "DETAIL",
      p_payments: options.includePayments,
    },
  );
  if (error) {
    const code = error.message;
    if (
      code === "FORBIDDEN" ||
      code === "INVALID_INPUT" ||
      code === "REPORT_CONFIGURATION_REQUIRED" ||
      code === "REPORT_RECONCILIATION_REQUIRED"
    )
      throw new FinanceReportError(code);
    throw new FinanceReportError("UNAVAILABLE");
  }
  const parsed = dailyReportSnapshot.safeParse(data);
  if (
    !parsed.success ||
    parsed.data.date !== options.date ||
    parsed.data.box !== (options.box ?? null)
  )
    throw new FinanceReportError("UNAVAILABLE");
  const snapshot = parsed.data;
  if (
    options.box &&
    (snapshot.boxes.length !== 1 || snapshot.boxes[0].id !== options.box)
  )
    throw new FinanceReportError("UNAVAILABLE");
  const summary = { opening: 0, income: 0, expense: 0, closing: 0 };
  for (const box of snapshot.boxes) {
    for (const key of ["opening", "income", "expense", "closing"] as const)
      summary[key] = sumCents(summary[key], box[key]);
  }
  // The authorized SQL snapshot resolves the headquarters, even if the UI's current unit is different.
  const identity = await loadFinanceReportIdentity({
    ...context,
    congregationId: snapshot.unitId,
  });
  return {
    ...snapshot,
    ...identity,
    type: "DAILY",
    presentation: options.presentation,
    includePayments: options.includePayments,
    summary,
    emissionId: randomUUID(),
  };
}
