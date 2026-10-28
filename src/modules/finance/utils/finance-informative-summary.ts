import type { z } from "zod";
import type { financeInformativeReportProjectionSchema } from "../validations/finance-informative-report.schemas";
import { financeMonthIndex } from "../validations/finance-informative-report.schemas";
import {
  FinanceReportError,
  type FinanceReportSummary,
} from "../types/finance-report.types";
export function summarizeInformativeProjection(
  projection: z.infer<typeof financeInformativeReportProjectionSchema>,
) {
  const sum = (values: number[]) =>
    values.reduce((a, b) => a + BigInt(b), BigInt(0));
  const { months } = projection;
  if (
    months.length !==
      financeMonthIndex(projection.endMonth) -
        financeMonthIndex(projection.startMonth) +
        1 ||
    months.some((row, index) => {
      const s = row.summary;
      return (
        (row.recorded.grossPrebendCents !== null) !== projection.includePrebend ||
        (row.recorded.transferCents !== null) !== projection.includeTransfer ||
        (row.recorded.grossPrebendCents ?? 0) > s.expenseCents ||
        financeMonthIndex(row.month) !==
          financeMonthIndex(projection.startMonth) + index ||
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
  return summary;
}
