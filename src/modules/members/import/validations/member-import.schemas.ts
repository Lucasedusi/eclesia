import { z } from "zod";

export const memberImportReviewSchema = z.object({
  batchId: z.string().uuid(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.union([z.literal(20), z.literal(50), z.literal(100)]).default(20),
  search: z.string().trim().max(80).default(""),
  classification: z.enum(["", "VALID", "WARNING", "ERROR", "SKIPPED", "IMPORTED"]).default(""),
});

export const memberImportMappingSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("ROLE"), batchId: z.string().uuid(), rawValue: z.string().min(1).max(120), value: z.string().uuid() }),
  z.object({
    kind: z.literal("MARITAL_STATUS"),
    batchId: z.string().uuid(),
    rawValue: z.string().min(1).max(120),
    value: z.enum(["SINGLE", "MARRIED", "DIVORCED", "SEPARATED", "WIDOWED", "STABLE_UNION", "OTHER"]),
  }),
]);

export const memberImportItemResolutionSchema = z.object({
  batchId: z.string().uuid(),
  itemId: z.string().uuid(),
  resolution: z.enum([
    "SKIP",
    "RESTORE",
    "IMPORT_WITHOUT_CPF",
    "IMPORT_WITHOUT_BIRTH_DATE",
    "IMPORT_WITHOUT_RECEIVED_DATE",
    "IMPORT_WITHOUT_BAPTISM_DATE",
    "IMPORT_WITHOUT_HOLY_SPIRIT_BAPTISM_DATE",
    "IMPORT_WITHOUT_CONVERSION_DATE",
    "IMPORT_AS_NEW",
  ]),
});
