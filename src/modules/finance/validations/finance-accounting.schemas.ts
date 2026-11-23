import { z } from "zod";
import { isLocalDate } from "../utils/finance-period";

export const accountingFilters = z
  .object({
    unit: z.uuid().nullable(),
    box: z.uuid().nullable(),
    start: z.string().refine(isLocalDate),
    end: z.string().refine(isLocalDate),
    direction: z.enum(["ALL", "INCOME", "EXPENSE"]),
  })
  .refine(
    (f) => f.start <= f.end,
    "A data final deve ser igual ou posterior à inicial.",
  );

export const accountingCode = z
  .string()
  .regex(/^[0-9]{1,32}$/)
  .nullable();
export const accountingCodeChange = z.object({
  kind: z.enum(["CASHBOX", "CATEGORY"]),
  id: z.uuid(),
  code: accountingCode,
  previous: accountingCode,
});
export type AccountingFilters = z.infer<typeof accountingFilters>;
export type AccountingCodeChange = z.infer<typeof accountingCodeChange>;
