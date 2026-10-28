import { summarizeInformativeProjection } from "../utils/finance-informative-summary";
import "server-only";
import { randomUUID } from "node:crypto";
import { createClient } from "@/lib/supabase/server";
import type { FinanceContext } from "../types/finance.types";
import { FinanceReportError } from "../types/finance-report.types";
import type {
  FinanceInformativeReportDocument,
  FinanceInformativeReportOptions,
} from "../types/finance-informative-report.types";
import {
  financeInformativeReportOptionsSchema,
  financeInformativeReportProjectionSchema,
} from "../validations/finance-informative-report.schemas";
import { canViewInformativeReport } from "../utils/finance-report-access";
import { loadFinanceReportIdentity } from "./finance-report.service";

export async function getFinanceInformativeReport(
  context: FinanceContext,
  input: FinanceInformativeReportOptions,
): Promise<FinanceInformativeReportDocument> {
  if (!canViewInformativeReport(context))
    throw new FinanceReportError("FORBIDDEN");
  const options = financeInformativeReportOptionsSchema.parse(input);
  const client = await createClient();
  const { data, error } = await client.rpc("get_finance_informative_report", {
    p_church_id: context.churchId,
    p_unit: context.congregationId,
    p_options: options,
  });
  if (error)
    throw new FinanceReportError(
      [
        "REPORT_CONFIGURATION_REQUIRED",
        "REPORT_TOO_LARGE",
        "REPORT_RECONCILIATION_REQUIRED",
        "FORBIDDEN",
      ].includes(error.message)
        ? (error.message as
            | "REPORT_CONFIGURATION_REQUIRED"
            | "REPORT_TOO_LARGE"
            | "REPORT_RECONCILIATION_REQUIRED"
            | "FORBIDDEN")
        : "UNAVAILABLE",
    );
  const parsed = financeInformativeReportProjectionSchema.safeParse(data);
  if (!parsed.success) throw new FinanceReportError("UNAVAILABLE");
  const projection = parsed.data;
  if (
    projection.startMonth !== options.startMonth ||
    projection.endMonth !== options.endMonth ||
    projection.includePrebend !== options.includePrebend ||
    projection.includeTransfer !== options.includeTransfer
  )
    throw new FinanceReportError("UNAVAILABLE");
  const summary = summarizeInformativeProjection(projection);
  return {
    ...projection,
    summary,
    emissionId: randomUUID(),
    ...(await loadFinanceReportIdentity(context)),
  };
}
