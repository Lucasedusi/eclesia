import { z } from "zod";
import { monthSchema } from "./finance-catalog.schemas";
import { financeReportSummarySchema } from "./finance-report.schemas";

export const MAX_INFORMATIVE_MONTHS = 60;
export function financeMonthIndex(month: string) {
  const [year, part] = month.split("-").map(Number);
  return year * 12 + part - 1;
}
export function informativeStartMonth(month: string) {
  const index = Math.max(2000 * 12, financeMonthIndex(month) - 2);
  return `${Math.floor(index / 12)}-${String((index % 12) + 1).padStart(2, "0")}`;
}
export const financeInformativeReportOptionsSchema = z
  .strictObject({
    type: z.literal("INFORMATIVE"),
    startMonth: monthSchema,
    endMonth: monthSchema,
    includePrebend: z.boolean(),
    includeTransfer: z.boolean(),
  })
  .refine((v) => v.startMonth <= v.endMonth, {
    message: "O mês final deve ser igual ou posterior ao mês inicial.",
    path: ["endMonth"],
  })
  .refine(
    (v) =>
      financeMonthIndex(v.endMonth) - financeMonthIndex(v.startMonth) <
      MAX_INFORMATIVE_MONTHS,
    {
      message: "Selecione um período de até 60 meses.",
      path: ["endMonth"],
    },
  );
export const financeInformativeReportProjectionSchema = z.object({
  source: z.literal("TRANSACTIONS"),
  type: z.literal("INFORMATIVE"),
  startMonth: monthSchema,
  endMonth: monthSchema,
  includePrebend: z.boolean(),
  includeTransfer: z.boolean(),
  generatedAt: z.iso.datetime({ offset: true }),
  months: z
    .array(
      z.object({
        month: monthSchema,
        summary: financeReportSummarySchema,
        recorded: z.object({
          grossPrebendCents: z.number().int().nonnegative().safe().nullable(),
          transferCents: z.number().int().nonnegative().safe().nullable(),
        }),
      }),
    )
    .min(1)
    .max(MAX_INFORMATIVE_MONTHS),
});
