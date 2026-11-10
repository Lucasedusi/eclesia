import type { MemberFinanceItem, PaginatedTab } from "./member.types";
import type { ChurchDocumentIdentity } from "@/lib/pdf/church-document";
export type MemberFinanceSummary = {
  incomeCents: number;
  expenseCents: number;
  cancelledCents: number;
  pendingCents: number;
};
export type MemberFinancialData = {
  member: {
    id: string;
    name: string;
    code: string;
    congregationName: string | null;
  };
  items: MemberFinanceItem[];
  summary: MemberFinanceSummary;
  period: string;
  category: string | null;
  categories: { id: string; name: string }[];
};
export type MemberFinancialPage = PaginatedTab<MemberFinanceItem> &
  Pick<MemberFinancialData, "summary" | "period" | "category" | "categories">;
export type MemberFinancialDocument = MemberFinancialData & {
  church: ChurchDocumentIdentity;
  issuedAt: string;
};
export class MemberFinanceError extends Error {
  constructor(
    public readonly code:
      | "FORBIDDEN"
      | "NOT_FOUND"
      | "UNAVAILABLE"
      | "TOO_LARGE"
      | "AUDIT_FAILED",
  ) {
    super(code);
  }
}
