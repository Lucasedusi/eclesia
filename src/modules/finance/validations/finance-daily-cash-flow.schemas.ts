import { z } from "zod";
import { isLocalDate } from "../utils/finance-period";

export const dailyCashFlowQuery = z.strictObject({
  date: z.string().refine(isLocalDate),
  box: z.uuid().optional(),
  direction: z.enum(["ALL", "INCOME", "EXPENSE"]).default("ALL"),
  search: z.string().trim().max(160).default(""),
  department: z.uuid().optional(),
  category: z.uuid().optional(),
  method: z.uuid().optional(),
  page: z.coerce.number().int().min(1).max(100000).default(1),
});

const option = z.object({ id: z.uuid(), name: z.string() });
export const dailyCashFlowPage = z.object({
  date: z.string().refine(isLocalDate),
  box: z.uuid().nullable(),
  summary: z.object({
    opening: z.int(), income: z.int().nonnegative(), expense: z.int().nonnegative(), closing: z.int(),
  }),
  cashboxes: z.array(option.extend({ status: z.string() })),
  departments: z.array(option),
  categories: z.array(option),
  methods: z.array(option),
  total: z.int().nonnegative(),
  page: z.int().positive(),
  items: z.array(z.object({
    id: z.uuid(),
    kind: z.enum(["INCOME", "EXPENSE", "TRANSFER", "OPENING", "ADJUSTMENT"]),
    title: z.string(), detail: z.string().nullable(), boxName: z.string(),
    methodName: z.string().nullable(), departmentName: z.string().nullable(),
    amount: z.int().nonnegative(),
    sign: z.enum(["NEUTRAL", "MINUS", "PLUS"]),
  })).max(20),
});

export type DailyCashFlowQuery = z.infer<typeof dailyCashFlowQuery>;
export type DailyCashFlowPage = z.infer<typeof dailyCashFlowPage>;
