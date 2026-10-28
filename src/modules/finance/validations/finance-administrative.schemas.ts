import { z } from "zod";
import { monthSchema } from "./finance-catalog.schemas";
import { isLocalDate, monthRange, todayLocal } from "../utils/finance-period";
import {
  financeInformativeReportOptionsSchema,
  financeInformativeReportProjectionSchema,
} from "./finance-informative-report.schemas";

const cents = z.number().int().safe();
const civilDate = z.string().refine(isLocalDate, "Informe uma data válida.");
export const rankingOptionsSchema = z
  .strictObject({
    ...financeInformativeReportOptionsSchema.shape,
    type: z.literal("RANKING"),
    includeInactive: z.boolean(),
  })
  .superRefine((v, ctx) => {
    const parsed = financeInformativeReportOptionsSchema.safeParse({
      type: "INFORMATIVE",
      startMonth: v.startMonth,
      endMonth: v.endMonth,
      includePrebend: v.includePrebend,
      includeTransfer: v.includeTransfer,
    });
    if (!parsed.success)
      for (const issue of parsed.error.issues)
        ctx.addIssue({
          code: "custom",
          path: issue.path,
          message: issue.message,
        });
  });
export const transferReviewSchema = z.object({
  receivedCents: cents.nonnegative(),
  unidentifiedCents: cents.nonnegative(),
  outsideReportCents: cents.nonnegative(),
});
export const rankingProjectionSchema = z.object({
  source: z.literal("TRANSACTIONS"),
  transferReview: transferReviewSchema.nullable(),
  type: z.literal("RANKING"),
  startMonth: monthSchema,
  endMonth: monthSchema,
  includePrebend: z.boolean(),
  includeTransfer: z.boolean(),
  includeInactive: z.boolean(),
  generatedAt: z.iso.datetime({ offset: true }),
  units: z.array(
    z.object({
      id: z.uuid(),
      name: z.string(),
      status: z.string(),
      isHeadquarters: z.boolean(),
      report: financeInformativeReportProjectionSchema,
    }),
  ),
});
export const deliveryOptionsSchema = z.strictObject({
  type: z.literal("DELIVERIES"),
  month: monthSchema,
  includeInactive: z.boolean(),
  filter: z.enum(["ALL", "DELIVERED", "PENDING"]),
  search: z.string().trim().max(100).default(""),
});
export const deliveryQuerySchema = z.strictObject({
  month: monthSchema,
  includeInactive: z.boolean(),
});
export const deliveryRuleSchema = z.object({
  effectiveMonth: monthSchema,
  day: z.number().int().min(1).max(31),
  revision: z.number().int().positive(),
});
export const deliveryRowSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  status: z.string(),
  deliveryDate: civilDate.nullable(),
  revision: z.number().int().nonnegative(),
  history: z.array(
    z.object({
      action: z.enum(["RECEIVE", "CORRECT", "UNDO"]),
      deliveryDate: civilDate.nullable(),
      dueDate: civilDate,
      reason: z.string(),
      revision: z.number().int().positive(),
      createdAt: z.iso.datetime({ offset: true }),
      actor: z.string(),
    }),
  ),
});
export const deliveryProjectionSchema = z.object({
  month: monthSchema,
  includeInactive: z.boolean(),
  dueDate: civilDate,
  today: civilDate,
  generatedAt: z.iso.datetime({ offset: true }),
  rows: z.array(deliveryRowSchema),
  rules: z.array(deliveryRuleSchema),
});
export const recordDeliverySchema = z
  .strictObject({
    congregationId: z.uuid(),
    month: monthSchema,
    deliveryDate: civilDate.nullable(),
    action: z.enum(["RECEIVE", "CORRECT", "UNDO"]),
    reason: z.string().trim().max(500),
    expectedRevision: z.number().int().nonnegative(),
    operationKey: z.uuid(),
  })
  .superRefine((v, ctx) => {
    if (
      v.action === "UNDO"
        ? v.deliveryDate !== null
        : !v.deliveryDate ||
          v.deliveryDate < monthRange(v.month).end ||
          v.deliveryDate > todayLocal()
    )
      ctx.addIssue({
        code: "custom",
        path: ["deliveryDate"],
        message: "Informe uma data após o mês de referência e até hoje.",
      });
    if (v.action !== "RECEIVE" && v.reason.length < 5)
      ctx.addIssue({
        code: "custom",
        path: ["reason"],
        message: "Informe o motivo com pelo menos 5 caracteres.",
      });
  });
export const deliveryDeadlineSchema = z
  .strictObject({
    effectiveMonth: monthSchema,
    day: z.number().int().min(1).max(31),
    expectedRevision: z.number().int().nonnegative(),
    operationKey: z.uuid(),
  })
  .refine((v) => v.effectiveMonth >= todayLocal().slice(0, 7), {
    path: ["effectiveMonth"],
    message:
      "Escolha o mês de referência atual ou um mês futuro para preservar o histórico.",
  });
export const rankingAmountsSchema = z.object({
  incomeCents: cents,
  expenseCents: cents,
  closingCents: cents,
  grossPrebendCents: cents,
  transferCents: cents,
});
