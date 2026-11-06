import type { ChurchDocumentIdentity } from "@/lib/pdf/church-document";
import type { CongregationReportFields } from "../validations/congregation-report.schemas";
export type { CongregationReportOptions, CongregationReportFields } from "../validations/congregation-report.schemas";

export type CongregationReportAddress = { street: string; complement: string; district: string; city: string; state: string; zipCode: string; full: string };
export type ReportCongregation = {
  id: string; name: string; regionName: string; pastorName: string;
  spouseName?: string; contactPhone?: string; address?: CongregationReportAddress;
  whatsapp?: string; notes?: string;
};
export type CongregationReportDocument = {
  kind: "simplified" | "individual"; issuedAt: string; church: ChurchDocumentIdentity;
  scopeLabel: string; filters: string[]; fields: CongregationReportFields;
  congregations: ReportCongregation[];
};
export class CongregationReportError extends Error {
  constructor(readonly code: "CONGREGATION_REPORT_PERMISSION_DENIED" | "CONGREGATION_REPORT_NOT_FOUND" | "CONGREGATION_REPORT_LOAD_FAILED" | "CONGREGATION_REPORT_TOO_LARGE" | "CONGREGATION_REPORT_AUDIT_FAILED") {
    super(code); this.name = "CongregationReportError";
  }
}
