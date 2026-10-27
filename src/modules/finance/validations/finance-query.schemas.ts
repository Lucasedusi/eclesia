import { z } from "zod";
import { monthSchema } from "./finance-catalog.schemas";
import { isLocalDate } from "../utils/finance-period";
export const financeFiltersSchema = z
  .object({
    month: monthSchema,
    dateFrom: z.string().refine(isLocalDate, "Informe uma data válida.").optional(),
    dateTo: z.string().refine(isLocalDate, "Informe uma data válida.").optional(),
    search: z.string().trim().max(160).default(""),
    direction: z.enum(["ALL", "INCOME", "EXPENSE"]).default("ALL"),
    status: z.enum(["ALL", "CONFIRMED", "CANCELLED"]).default("ALL"),
    departmentId: z.uuid().optional(),
    categoryId: z.uuid().optional(),
    cashboxId: z.uuid().optional(),
    paymentMethodId: z.uuid().optional(),
    titheClassificationId: z.uuid().optional(),
    memberId: z.uuid().optional(),
    contributorCongregationId: z.uuid().optional(),
    page: z.coerce.number().int().min(1).max(100000).default(1),
  })
  .strict()
  .refine(({ dateFrom, dateTo }) =>
    (dateFrom === undefined && dateTo === undefined) ||
    (dateFrom !== undefined && dateTo !== undefined && dateFrom <= dateTo),
  { path: ["dateTo"], message: "Informe as duas datas, com o fim igual ou posterior ao início." });
export type FinanceFilters = z.infer<typeof financeFiltersSchema>;
