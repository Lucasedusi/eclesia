import { z } from "zod";
import { isLocalDate } from "../utils/finance-period";
const date = z.string().refine(isLocalDate, "Informe uma data válida.");
const cents = z.number().int().nonnegative().safe();
export const categoryReportOptionsSchema = z
  .strictObject({
    type: z.literal("CATEGORY"),
    dateFrom: date,
    dateTo: date,
    direction: z.enum(["INCOME", "EXPENSE"]),
    presentation: z.enum(["SUMMARY", "DETAILED"]),
    categoryIds: z
      .array(z.uuid())
      .min(1, "Selecione ao menos uma categoria.")
      .max(50, "Selecione até 50 categorias.")
      .refine(
        (ids) => new Set(ids).size === ids.length,
        "Não repita categorias.",
      ),
    cashboxId: z.uuid().optional(),
  })
  .refine((v) => v.dateFrom <= v.dateTo, {
    path: ["dateTo"],
    message: "A data final deve ser igual ou posterior à inicial.",
  });
export const categoryReportProjectionSchema = z.object({
  ...categoryReportOptionsSchema.shape,
  cashboxId: z.uuid().nullable(),
  cashboxName: z.string().nullable(),
  generatedAt: z.iso.datetime({ offset: true }),
  totalCents: cents,
  count: cents,
  categories: z.array(
    z.object({
      id: z.uuid(),
      name: z.string(),
      status: z.string(),
      amountCents: cents,
      count: cents,
    }),
  ),
  rows: z.array(
    z.object({
      id: z.uuid(),
      categoryId: z.uuid(),
      date,
      amountCents: cents,
      description: z.string().nullable(),
      personName: z.string().nullable(),
      cashboxId: z.uuid(),
      cashboxName: z.string(),
      classificationName: z.string().nullable(),
    }),
  ),
});
