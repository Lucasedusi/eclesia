import type { ChurchDocumentIdentity } from "@/lib/pdf/church-document";
import type { MemberReportField, MemberReportFieldKey } from "../constants/member-report-fields";
import type { MemberReportOptions } from "../validations/member-report.schemas";
export type { MemberReportOptions } from "../validations/member-report.schemas";
export type MemberReportDocument = {
  kind: MemberReportOptions["kind"] | "birthdays"; issuedAt: string; church: ChurchDocumentIdentity; scopeLabel: string; filters: string[];
  columns: MemberReportField[]; rows: { id: string; values: Partial<Record<MemberReportFieldKey, string>> }[];
};
export class MemberReportError extends Error {
  constructor(public readonly code: "MEMBER_REPORT_PERMISSION_DENIED" | "MEMBER_REPORT_LOAD_FAILED" | "MEMBER_REPORT_TOO_LARGE" | "MEMBER_REPORT_AUDIT_FAILED") { super(code); this.name = "MemberReportError"; }
}
