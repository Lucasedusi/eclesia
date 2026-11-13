import { z } from "zod";
import { isLocalDate } from "../utils/finance-period";
import type { FinanceReportDocument } from "../types/finance-report.types";

export const dailyReportOptions = z.strictObject({
  type: z.literal("DAILY"),
  date: z.string().refine(isLocalDate),
  box: z.uuid().optional(),
  presentation: z.enum(["SUMMARY", "DETAIL"]),
  includePayments: z.boolean(),
});
const totals = z.object({
  opening: z.int(),
  income: z.int().nonnegative(),
  expense: z.int().nonnegative(),
  closing: z.int(),
});
const item = z.object({
  identity: z.string(),
  description: z.string().nullable(),
  department: z.string(),
  method: z.string(),
  cents: z.int().nonnegative(),
});
const category = z.object({
  name: z.string(),
  direction: z.enum(["INCOME", "EXPENSE"]),
  count: z.int().positive(),
  cents: z.int().nonnegative(),
  items: z.array(item),
});
const box = totals.extend({
  id: z.uuid(),
  name: z.string(),
  bankDetails: z
    .object({
      bankName: z.string().nullable(),
      agency: z.string().nullable(),
      accountNumber: z.string().nullable(),
    })
    .nullable(),
  categories: z.array(category),
  movements: z.array(z.object({ label: z.string(), cents: z.int() })),
});
export const dailyReportSnapshot = z.object({
  date: z.string(),
  box: z.uuid().nullable(),
  unitId: z.uuid(),
  generatedAt: z.iso.datetime({ offset: true }),
  boxes: z.array(box),
  payments: z.array(
    z.object({
      method: z.string(),
      income: z.int().nonnegative(),
      expense: z.int().nonnegative(),
    }),
  ),
});
export type DailyReportOptions = z.infer<typeof dailyReportOptions>;
export type DailyTotals = z.infer<typeof totals>;
export type DailyReportDocument = z.infer<typeof dailyReportSnapshot> &
  Pick<DailyReportOptions, "type" | "presentation" | "includePayments"> &
  Pick<
    FinanceReportDocument,
    "church" | "congregationName" | "congregationAddress" | "emissionId"
  > & { summary: DailyTotals };
export function dailyReportFilename(
  date: string,
  presentation: DailyReportOptions["presentation"],
) {
  return `fluxo-diario-${presentation === "SUMMARY" ? "resumido" : "detalhado"}-${date}.pdf`;
}
