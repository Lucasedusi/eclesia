import type { z } from "zod";
import type {
  financeInformativeReportOptionsSchema,
  financeInformativeReportProjectionSchema,
} from "../validations/finance-informative-report.schemas";
import type {
  FinanceReportDocument,
  FinanceReportSummary,
} from "./finance-report.types";
export type FinanceInformativeReportOptions = z.infer<
  typeof financeInformativeReportOptionsSchema
>;
export type FinanceInformativeReportDocument = z.infer<
  typeof financeInformativeReportProjectionSchema
> &
  Pick<
    FinanceReportDocument,
    "church" | "congregationName" | "congregationAddress" | "emissionId"
  > & { summary: FinanceReportSummary };
