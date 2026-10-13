import type { z } from "zod";
import type {
  financeReportOptionsSchema,
  financeReportProjectionSchema,
  financeReportSummarySchema,
} from "../validations/finance-report.schemas";
export type FinanceReportOptions = z.infer<typeof financeReportOptionsSchema>;
export type FinanceReportProjection = z.infer<
  typeof financeReportProjectionSchema
>;
export type FinanceReportSummary = z.infer<typeof financeReportSummarySchema>;
export type FinanceReportDocument = FinanceReportProjection & {
  emissionId: string;
  church: {
    name: string;
    document: string | null;
    city: string | null;
    logoDataUri: string | null;
  };
  congregationName: string;
};
export class FinanceReportError extends Error {
  constructor(
    public code:
      | "UNAVAILABLE"
      | "FORBIDDEN"
      | "INVALID_INPUT"
      | "REPORT_TOO_LARGE"
      | "REPORT_RECONCILIATION_REQUIRED",
  ) {
    super(code);
  }
}
