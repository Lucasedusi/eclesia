import { z } from "zod";
import { financeCommandSchema } from "../validations/finance-command.schemas";
import { monthSchema } from "../validations/finance-catalog.schemas";
const selection = z.union([z.uuid(), z.literal("")]);
const line = z
  .object({
    categoryId: selection,
    departmentId: selection,
    amount: z.string().max(24),
    titheClassificationId: z.uuid().nullable(),
    description: z.string().max(1000),
    notes: z.string().max(1000),
    documentNumber: z.string().max(80),
  })
  .strict();
export const bankImportDraftSchema = z
  .object({
    state: line
      .extend({
        operationKey: z.string().max(36),
        date: z.string().max(10),
        referenceMonth: z.union([monthSchema, z.literal("")]).optional(),
        referenceMonthManual: z.boolean().optional(),
        cashboxId: selection,
        paymentMethodId: selection,
        contributor: z
          .discriminatedUnion("kind", [
            z
              .object({
                kind: z.literal("CONGREGATION"),
                congregationId: z.uuid(),
              })
              .strict(),
            z
              .object({
                kind: z.literal("ORGANIZATION"),
                name: z.string().max(160),
              })
              .strict(),
            z
              .object({ kind: z.literal("MEMBER"), memberId: z.uuid() })
              .strict(),
            z
              .object({
                kind: z.literal("UNREGISTERED"),
                name: z.string().max(160),
              })
              .strict(),
            z.object({ kind: z.literal("COLLECTIVE") }).strict(),
          ])
          .nullable(),
        personLabel: z.string().max(160),
        beneficiaryName: z.string().max(160),
        paymentReference: z.string().max(160),
        documentIds: z.array(z.uuid()).max(10),
        detailsOpen: z.boolean(),
      })
      .strict()
      .transform((state) => ({
        ...state,
        referenceMonth: state.referenceMonth ?? state.date.slice(0, 7),
        referenceMonthManual: state.referenceMonthManual ??
          (state.referenceMonth !== undefined && state.referenceMonth !== state.date.slice(0, 7)),
      })),
    extra: z.array(line).max(49),
  })
  .strict();
export type BankImportDraft = z.infer<typeof bankImportDraftSchema>;
const common = {
  unit: z.uuid(),
  itemId: z.uuid(),
  revision: z.number().int().positive(),
  operationKey: z.uuid(),
};
const reason = z
  .string()
  .trim()
  .min(5, "Informe um motivo com pelo menos 5 caracteres.")
  .max(1000);
const decisions = {
  duplicateReason: reason.optional(),
  reconciliationReason: reason.optional(),
};
export const bankImportMutationSchema = z.discriminatedUnion("action", [
  z
    .object({
      ...common,
      action: z.literal("SAVE_DRAFT"),
      payload: bankImportDraftSchema,
    })
    .strict(),
  z
    .object({
      ...common,
      action: z.literal("POST"),
      payload: z
        .object({
          command: financeCommandSchema.refine(
            (c) => c.kind === "RECORD" || c.kind === "TRANSFER",
          ),
          ...decisions,
        })
        .strict(),
    })
    .strict(),
  z
    .object({
      ...common,
      action: z.literal("LINK"),
      payload: z
        .object({
          targetKind: z.enum(["TRANSACTION", "ATTENDANCE", "TRANSFER"]),
          targetId: z.uuid(),
          ...decisions,
        })
        .strict(),
    })
    .strict(),
  z
    .object({
      ...common,
      action: z.literal("DUPLICATE"),
      payload: z.object({ targetId: z.uuid(), reason }).strict(),
    })
    .strict(),
  z
    .object({
      ...common,
      action: z.enum(["IGNORE", "RESTORE", "REOPEN", "UNLINK"]),
      payload: z.object({ reason }).strict(),
    })
    .strict(),
]);
export type BankImportMutation = z.infer<typeof bankImportMutationSchema>;
export const bankImportFiltersSchema = z
  .object({
    page: z.coerce.number().int().min(1).max(10000).default(1),
    status: z
      .enum(["PENDING", "COMPLETED", "IGNORED", "ALL", "DELETED"])
      .default("PENDING"),
    direction: z.enum(["INCOME", "EXPENSE", "ALL"]).default("ALL"),
    query: z.string().trim().max(100).default(""),
  })
  .strict();
export type BankImportFilters = z.infer<typeof bankImportFiltersSchema>;

const lifecycleBase = {
  unit: z.uuid(),
  batchId: z.uuid(),
  operationKey: z.uuid(),
};
export const bankImportLifecycleSchema = z.discriminatedUnion("action", [
  z.object({ ...lifecycleBase, action: z.literal("DELETE_BATCH") }).strict(),
  z
    .object({
      ...lifecycleBase,
      action: z.enum(["DELETE_ITEM", "RESTORE_ITEM"]),
      itemId: z.uuid(),
      revision: z.number().int().positive(),
    })
    .strict(),
]);
export type BankImportLifecycle = z.infer<typeof bankImportLifecycleSchema>;
