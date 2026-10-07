import { z } from "zod";
import { monthSchema } from "./finance-catalog.schemas";
import { MAX_AMOUNT_CENTS } from "../utils/finance-money";
export const statementRuleSchema = z
  .object({
    name: z.string().trim().min(1).max(120),
    destination: z.enum(["CATHEDRAL", "LOCAL_PASTOR"]),
    role: z.enum(["DISTRIBUTION", "GROSS_PREBEND", "PREBEND_DEDUCTION"]),
    calculation: z.enum([
      "ELIGIBLE_INCOME_PERCENT",
      "GROSS_PREBEND_PERCENT",
      "FIXED",
    ]),
    percentage: z
      .string()
      .regex(/^\d{1,3}(\.\d{1,4})?$/)
      .refine((v) => Number(v) <= 100)
      .optional(),
    capCents: z.number().int().min(0).max(MAX_AMOUNT_CENTS).optional(),
    amountCents: z.number().int().min(0).max(MAX_AMOUNT_CENTS).optional(),
  })
  .strict()
  .refine(
    (v) =>
      v.role === "GROSS_PREBEND"
        ? v.capCents !== undefined
        : v.capCents === undefined,
    { message: "Informe o teto mensal da prebenda bruta.", path: ["capCents"] },
  )
  .refine(
    (v) =>
      v.calculation === "FIXED"
        ? v.amountCents !== undefined
        : v.percentage !== undefined,
    "Informe o valor ou percentual.",
  )
  .refine(
    (v) =>
      v.role === "GROSS_PREBEND"
        ? v.destination === "LOCAL_PASTOR" &&
          v.calculation !== "GROSS_PREBEND_PERCENT"
        : v.destination === "CATHEDRAL",
    "Confira o destino e a base do item.",
  );
export const statementRulesSchema = z
  .object({
    congregationId: z.uuid(),
    effectiveMonth: monthSchema,
    items: z.array(statementRuleSchema).min(1).max(40),
    retroactiveReason: z.string().trim().min(5).max(1000).optional(),
  })
  .strict()
  .refine(
    (v) => v.items.filter((i) => i.role === "GROSS_PREBEND").length <= 1,
    "Use apenas uma prebenda bruta.",
  )
  .refine(
    (v) =>
      !v.items.some(
        (i) =>
          i.role === "PREBEND_DEDUCTION" ||
          i.calculation === "GROSS_PREBEND_PERCENT",
      ) || v.items.some((i) => i.role === "GROSS_PREBEND"),
    "Cadastre a prebenda bruta antes dos descontos.",
  );
export const generateStatementSchema = z
  .object({
    congregationId: z.uuid(),
    month: monthSchema,
    operationKey: z.uuid(),
  })
  .strict();
export const copyStatementRulesSchema = z
  .object({
    fromCongregationId: z.uuid(),
    toCongregationId: z.uuid(),
    effectiveMonth: monthSchema,
    retroactiveReason: z.string().trim().min(5).max(1000).optional(),
  })
  .strict();
