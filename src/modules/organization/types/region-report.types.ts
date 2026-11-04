export type { RegionReportOptions } from "../validations/region-report.schemas";

export type ReportChurchIdentity = {
  name: string;
  logoDataUri: string | null;
  address: string;
  phone: string;
  document: string;
};

export type ReportRegion = {
  id: string;
  name: string;
  coordinatorName: string;
  coordinatorPhone: string;
  description: string | null;
  status: string;
};

export type RegionReportDocument = {
  kind: "simplified" | "individual";
  issuedAt: string;
  church: ReportChurchIdentity;
  scopeLabel: string;
  filters: string[];
  regions: ReportRegion[];
  region: ReportRegion | null;
  congregations: { id: string; name: string; pastorName: string; contactPhone: string; status: string }[];
};

export class RegionReportError extends Error {
  constructor(readonly code:
    | "REGION_REPORT_PERMISSION_DENIED"
    | "REGION_REPORT_NOT_FOUND"
    | "REGION_REPORT_LOAD_FAILED"
    | "REGION_REPORT_TOO_LARGE"
    | "REGION_REPORT_AUDIT_FAILED"
  ) {
    super(code);
    this.name = "RegionReportError";
  }
}
