import { z } from "zod";
import { monthSchema } from "./finance-catalog.schemas";
export const financeReportOptionsSchema = z.strictObject({
  type: z.enum(["ANALYTIC", "SYNTHETIC"]),
  month: monthSchema,
  cashboxId: z.uuid().optional(),
});
const cents = z.number().int().safe();
const count = z.number().int().nonnegative().safe();
export const financeReportSummarySchema = z.object({
  openingCents: cents,
  incomeCents: cents,
  expenseCents: cents,
  openingMovementCents: cents,
  adjustmentCents: cents,
  transferNetCents: cents,
  closingCents: cents,
  count,
});
const category = z.object({
  categoryId: z.string(),
  categoryName: z.string(),
  classificationId: z.string().nullable(),
  classificationName: z.string().nullable(),
  direction: z.enum(["INCOME", "EXPENSE"]),
  amountCents: cents,
  count,
});
const row = category.omit({ count: true }).extend({
  id: z.uuid(),
  date: z.string(),
  personName: z.string().nullable(),
  description: z.string().nullable(),
  documentNumber: z.string().nullable(),
  departmentName: z.string(),
  cashboxId: z.uuid(),
  cashboxName: z.string(),
  paymentMethodName: z.string(),
});
const common = {
  month: monthSchema,
  generatedAt: z.string(),
  cashboxId: z.uuid().nullable(),
  cashboxName: z.string().nullable(),
  summary: financeReportSummarySchema,
  departments: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      incomeCents: cents,
      expenseCents: cents,
    }),
  ),
  cashboxes: z.array(
    financeReportSummarySchema.extend({
      id: z.uuid(),
      name: z.string(),
      bankDetails: z
        .object({
          bankName: z.string().nullable(),
          agency: z.string().nullable(),
          accountNumber: z.string().nullable(),
        })
        .nullable()
        .optional(),
    }),
  ),
  movements: z.array(
    z.object({
      id: z.uuid(),
      date: z.string(),
      kind: z.enum(["OPENING", "ADJUSTMENT", "TRANSFER"]),
      description: z.string(),
      amountCents: cents,
    }),
  ),
};
export const financeReportProjectionSchema = z.discriminatedUnion("type", [
  z.object({ ...common, type: z.literal("ANALYTIC"), rows: z.array(row) }),
  z.object({
    ...common,
    type: z.literal("SYNTHETIC"),
    categories: z.array(category),
    cashboxCategories: z.array(category.extend({ cashboxId: z.uuid() })),
  }),
]);
