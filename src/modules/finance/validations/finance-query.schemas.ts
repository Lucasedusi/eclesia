import { z } from "zod";
import { monthSchema } from "./finance-catalog.schemas";
export const financeFiltersSchema = z
  .object({
    month: monthSchema,
    search: z.string().trim().max(160).default(""),
    direction: z.enum(["ALL", "INCOME", "EXPENSE"]).default("ALL"),
    status: z.enum(["ALL", "CONFIRMED", "CANCELLED"]).default("ALL"),
    departmentId: z.uuid().optional(),
    categoryId: z.uuid().optional(),
    cashboxId: z.uuid().optional(),
    paymentMethodId: z.uuid().optional(),
    memberId: z.uuid().optional(),
    page: z.coerce.number().int().min(1).max(100000).default(1),
  })
  .strict();
export type FinanceFilters = z.infer<typeof financeFiltersSchema>;
