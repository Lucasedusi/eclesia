import type { z } from "zod";
import type { payableCommandSchema, payableQuerySchema, payablePageSchema, payableRowSchema, payableDetailSchema, payableValuesSchema, payableResultSchema } from "../validations/finance-payable.schemas";
export type PayableCommand = z.infer<typeof payableCommandSchema>;
export type PayableQuery = z.infer<typeof payableQuerySchema>;
export type PayablePage = z.infer<typeof payablePageSchema>;
export type PayableRow = z.infer<typeof payableRowSchema>;
export type PayableDetail = z.infer<typeof payableDetailSchema>;
export type PayableValues = z.infer<typeof payableValuesSchema>;
export type PayableResult = z.infer<typeof payableResultSchema>;
