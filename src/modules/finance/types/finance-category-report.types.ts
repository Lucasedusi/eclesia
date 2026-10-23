import type { z } from "zod";
import type {
  categoryReportOptionsSchema,
  categoryReportProjectionSchema,
} from "../validations/finance-category-report.schemas";
import type { FinanceReportDocument } from "./finance-report.types";
export type CategoryReportOptions = z.infer<typeof categoryReportOptionsSchema>;
export type CategoryReportDocument = z.infer<
  typeof categoryReportProjectionSchema
> &
  Pick<
    FinanceReportDocument,
    "church" | "congregationName" | "congregationAddress" | "emissionId"
  >;
export type ReportCategory = {
  id: string;
  name: string;
  status: string;
  direction: string;
};
