import "server-only";
import { randomUUID } from "node:crypto";
import { createClient } from "@/lib/supabase/server";
import type { FinanceContext } from "../types/finance.types";
import {
  FinanceReportError,
  type FinanceReportSummary,
} from "../types/finance-report.types";
import type {
  FinanceInformativeReportDocument,
  FinanceInformativeReportOptions,
} from "../types/finance-informative-report.types";
import {
  financeInformativeReportOptionsSchema,
  financeInformativeReportProjectionSchema,
  financeMonthIndex,
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
        "REPORT_TOO_LARGE",
        "REPORT_RECONCILIATION_REQUIRED",
        "FORBIDDEN",
      ].includes(error.message)
        ? (error.message as
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
  const sum = (values: number[]) =>
    values.reduce((a, b) => a + BigInt(b), BigInt(0));
  const { months } = projection;
  if (
    months.length !==
      financeMonthIndex(options.endMonth) -
        financeMonthIndex(options.startMonth) +
        1 ||
    months.some((row, index) => {
      const s = row.summary;
      return (
        financeMonthIndex(row.month) !==
          financeMonthIndex(options.startMonth) + index ||
        (index > 0 &&
          s.openingCents !== months[index - 1].summary.closingCents) ||
        s.transferNetCents !== 0 ||
        sum([
          s.openingCents,
          s.incomeCents,
          -s.expenseCents,
          s.openingMovementCents,
          s.adjustmentCents,
          s.transferNetCents,
        ]) !== BigInt(s.closingCents)
      );
    })
  )
    throw new FinanceReportError("REPORT_RECONCILIATION_REQUIRED");
  const summary = {
    ...months[0].summary,
    closingCents: months.at(-1)!.summary.closingCents,
  };
  for (const key of [
    "incomeCents",
    "expenseCents",
    "openingMovementCents",
    "adjustmentCents",
    "transferNetCents",
    "count",
  ] as const satisfies readonly (keyof FinanceReportSummary)[]) {
    const value = sum(months.map((r) => r.summary[key]));
    if (
      value > BigInt(Number.MAX_SAFE_INTEGER) ||
      value < BigInt(Number.MIN_SAFE_INTEGER)
    )
      throw new FinanceReportError("REPORT_TOO_LARGE");
    summary[key] = Number(value);
  }
  return {
    ...projection,
    summary,
    emissionId: randomUUID(),
    ...(await loadFinanceReportIdentity(context)),
  };
}
