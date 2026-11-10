import { z } from "zod";
const date = z.union([z.literal(""), z.iso.date()]).default("");
export const memberFinanceFiltersSchema = z
  .object({
    dateFrom: date,
    dateTo: date,
    categoryId: z.union([z.literal(""), z.uuid()]).default(""),
  })
  .strict()
  .refine(
    (v) => !v.dateFrom || !v.dateTo || v.dateFrom <= v.dateTo,
    "O início deve ser anterior ao fim do período.",
  );
export const memberFinanceExportSchema = z
  .object({
    memberId: z.uuid(),
    format: z.enum(["pdf", "xlsx"]),
    filters: memberFinanceFiltersSchema,
  })
  .strict();
export type MemberFinanceFilters = z.infer<typeof memberFinanceFiltersSchema>;
export const memberThermalStatementSchema = z
  .object({
    memberId: z.uuid(),
    filters: memberFinanceFiltersSchema,
    width: z.union([z.literal(80), z.literal(58)]),
    intent: z.enum(["preview", "print"]),
  })
  .strict();
