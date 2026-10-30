import { z } from "zod";
import { localDateSchema, monthSchema, centsSchema } from "./finance-catalog.schemas";
import { todayLocal } from "../utils/finance-period";
import { nextPayableDate } from "../utils/finance-payables";

export const payableValuesSchema = z.object({
  name: z.string().trim().min(1).max(120), categoryId: z.uuid(), dueDate: localDateSchema,
  amountCents: centsSchema.nullable(), notes: z.string().trim().max(1000).default(""),
}).strict();
const commandBase = { requestId: z.uuid() };
const target = { ...commandBase, id: z.uuid(), revision: z.number().int().positive() };
export const payableCommandSchema = z.discriminatedUnion("kind", [
  z.object({ ...commandBase, kind: z.literal("CREATE"), values: payableValuesSchema }).strict(),
  z.object({ ...target, kind: z.literal("UPDATE"), values: payableValuesSchema }).strict(),
  z.object({ ...target, kind: z.literal("PAY"), paidDate: localDateSchema.refine((v) => v <= todayLocal(), "O pagamento não pode estar no futuro.") }).strict(),
  z.object({ ...target, kind: z.literal("REOPEN"), reason: z.string().trim().min(5).max(1000) }).strict(),
  z.object({ ...target, kind: z.literal("DELETE") }).strict(),
  z.object({ ...commandBase, kind: z.literal("COPY"), sourceMonth: monthSchema,
    items: z.array(z.object({ sourceId: z.uuid(), revision: z.number().int().positive(),
      categoryId: z.uuid(), amountCents: centsSchema.nullable(), dueDate: localDateSchema }).strict()).min(1).max(100),
  }).strict().refine((v) => new Set(v.items.map((i) => i.sourceId)).size === v.items.length &&
    v.items.every((i) => i.dueDate.slice(0, 7) === nextPayableDate(`${v.sourceMonth}-01`).slice(0, 7)), "Confira as contas e os vencimentos do próximo mês."),
]);
export const payableQuerySchema = z.object({
  dueStatus: z.enum(["ALL", "OVERDUE", "TODAY", "UPCOMING"]).default("ALL"),
  month: monthSchema, status: z.enum(["PENDING", "PAID", "ALL"]).default("PENDING"),
  search: z.string().trim().max(120).default(""), categoryId: z.uuid().optional(),
  dateFrom: localDateSchema.optional(), dateTo: localDateSchema.optional(),
  page: z.coerce.number().int().min(1).max(100000).default(1),
}).strict().refine((v) => (!v.dateFrom && !v.dateTo) || Boolean(v.dateFrom && v.dateTo && v.dateFrom <= v.dateTo), "Informe um intervalo válido.");

export const payableRowSchema = z.object({
  id: z.uuid(), name: z.string(), categoryId: z.uuid(), categoryName: z.string(),
  dueDate: localDateSchema, amountCents: z.number().int().nullable(), notes: z.string(),
  status: z.enum(["PENDING", "PAID"]), paidDate: localDateSchema.nullable(),
  revision: z.number().int().positive(), copiedNextMonth: z.boolean(),
});
export const payableSummarySchema = z.object({ overdue: z.number().int(), today: z.number().int(), upcoming: z.number().int() });
export const payablePageSchema = z.object({
  churchId: z.uuid(), headquartersId: z.uuid(), headquartersName: z.string(), today: localDateSchema,
  start: localDateSchema, end: localDateSchema, page: z.number().int().positive(),
  items: z.array(payableRowSchema), count: z.number().int(), pendingCount: z.number().int(), paidCount: z.number().int(),
  previousOverdue: z.object({ count: z.number().int(), firstDate: localDateSchema.nullable(), lastDate: localDateSchema.nullable() }),
  summary: payableSummarySchema,
});
export const payableDetailSchema = z.object({
  item: payableRowSchema,
  history: z.array(z.object({ id: z.uuid(), action: z.enum(["CREATE", "UPDATE", "PAY", "REOPEN", "DELETE", "COPY"]),
    at: z.string(), actorName: z.string(), reason: z.string().nullable(),
    before: z.record(z.string(), z.unknown()).nullable(), after: z.record(z.string(), z.unknown()),
  })),
});
export const payableResultSchema = z.object({ id: z.uuid().optional(), created: z.number().int().optional(), skipped: z.number().int().optional() });
