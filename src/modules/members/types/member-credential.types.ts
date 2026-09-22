export type MemberCredentialWarning =
  | "MISSING_CHURCH_LOGO"
  | "MISSING_CHURCH_ADDRESS"
  | "MISSING_CHURCH_PHONE"
  | "MISSING_CHURCH_DOCUMENT"
  | "MISSING_ROLE"
  | "MISSING_CPF"
  | "MISSING_BIRTH_DATE"
  | "MISSING_BAPTISM_DATE"
  | "MISSING_MOTHER_NAME"
  | "MISSING_FATHER_NAME"
  | "MISSING_NATURALITY";

export type MemberCredentialPdfFormat = "fold" | "pvc";

export type MemberCredentialPreview = {
  issuedAt: string;
  issuedDate: string;
  fileName: string;
  church: {
    name: string;
    logoDataUri: string | null;
    addressLine: string;
    phone: string;
    document: string;
  };
  member: {
    fullName: string;
    roleName: string;
    memberCode: string;
    congregationName: string;
    cpf: string;
    birthDate: string;
    baptismDate: string;
    motherName: string;
    fatherName: string;
    naturality: string;
  };
  validation: {
    token: string;
    url: string;
    qrMatrix: boolean[][];
    activeIssuedAt: string | null;
  };
  warnings: MemberCredentialWarning[];
};

export type MemberCredentialSource = {
  issuedAt: string;
  credentialToken: string;
  validationUrl: string;
  qrMatrix: boolean[][];
  activeCredentialIssuedAt: string | null;
  churchName: string;
  churchLogoDataUri: string | null;
  churchAddress: string | null;
  churchNumber: string | null;
  churchDistrict: string | null;
  churchCity: string | null;
  churchState: string | null;
  churchPhone: string | null;
  churchDocument: string | null;
  member: {
    id: string;
    fullName: string | null;
    gender: string | null;
    memberCode: string | null;
    memberStatus: string;
    memberType: string;
    deletedAt: string | null;
    congregationName: string | null;
    cpf: string | null;
    birthDate: string | null;
    baptismDate: string | null;
    motherName: string | null;
    fatherName: string | null;
    naturalCity: string | null;
    naturalState: string | null;
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
  | "MEMBER_CREDENTIAL_AUDIT_FAILED"
  | "MEMBER_CREDENTIAL_TOKEN_CREATE_FAILED"
  | "MEMBER_CREDENTIAL_TOKEN_INVALID"
  | "MEMBER_CREDENTIAL_TOKEN_ACTIVATE_FAILED"
  | "MEMBER_CREDENTIAL_TOKEN_REVOKE_FAILED"
  | "MEMBER_CREDENTIAL_SITE_URL_INVALID";

export class MemberCredentialError extends Error {
  constructor(public readonly code: MemberCredentialErrorCode) {
    super(code);
    this.name = "MemberCredentialError";
  }
}
