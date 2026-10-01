export type MemberSheetOptions = {
  includeHistory: boolean;
  includeEvents: boolean;
};

export type MemberSheetDocument = {
  issuedAt: string;
  fileName: string;
  church: {
    name: string;
    logoDataUri: string | null;
    address: string;
    phone: string;
    document: string;
  };
  member: {
    fullName: string;
    memberCode: string | null;
    role: string | null;
    congregationName: string;
  };
  groups: { title: string; fields: { label: string; value: string }[] }[];
  history: { date: string; title: string; change: string | null; description: string | null }[] | null;
  events: { name: string; date: string; location: string }[] | null;
};

export class MemberSheetError extends Error {
  constructor(readonly code:
    | "MEMBER_SHEET_PERMISSION_DENIED"
    | "MEMBER_SHEET_NOT_FOUND"
    | "MEMBER_SHEET_LOAD_FAILED"
    | "MEMBER_SHEET_TOO_LARGE"
    | "MEMBER_SHEET_AUDIT_FAILED"
  ) {
    super(code);
    this.name = "MemberSheetError";
  }
}
