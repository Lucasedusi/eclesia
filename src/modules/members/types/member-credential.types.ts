export type MemberCredentialWarning =
  | "MISSING_ROLE"
  | "MISSING_BAPTISM_DATE"
  | "MISSING_MOTHER_NAME"
  | "MISSING_FATHER_NAME";

export type MemberCredentialPreview = {
  issuedAt: string;
  fileName: string;
  church: {
    name: string;
    primaryColor: string;
    primaryDarkColor: string;
    foregroundColor: "#FFFFFF" | "#101828";
  };
  member: {
    id: string;
    fullName: string;
    roleName: string;
    memberCode: string;
    congregationName: string;
    baptismDate: string;
    motherName: string;
    fatherName: string;
  };
  warnings: MemberCredentialWarning[];
};

export type MemberCredentialSource = {
  issuedAt: string;
  churchName: string;
  primaryColor: string | null;
  member: {
    id: string;
    fullName: string | null;
    gender: string | null;
    memberCode: string | null;
    memberStatus: string;
    memberType: string;
    deletedAt: string | null;
    congregationName: string | null;
    baptismDate: string | null;
    motherName: string | null;
    fatherName: string | null;
    activeRole: {
      titleVariant: string | null;
      name: string;
      femaleName: string | null;
    } | null;
  };
};

export type MemberCredentialErrorCode =
  | "MEMBER_CREDENTIAL_NOT_FOUND"
  | "MEMBER_CREDENTIAL_INELIGIBLE"
  | "MEMBER_CREDENTIAL_INCOMPLETE"
  | "MEMBER_CREDENTIAL_LOAD_FAILED"
  | "MEMBER_CREDENTIAL_AUDIT_FAILED";

export class MemberCredentialError extends Error {
  constructor(public readonly code: MemberCredentialErrorCode) {
    super(code);
    this.name = "MemberCredentialError";
  }
}
