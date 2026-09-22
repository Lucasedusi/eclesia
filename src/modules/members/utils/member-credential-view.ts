import type { MemberCredentialWarning } from "../types/member-credential.types";

const WARNING_LABELS: Record<MemberCredentialWarning, string> = {
  MISSING_ROLE: "Cargo não cadastrado",
  MISSING_BAPTISM_DATE: "Data do batismo não informada",
  MISSING_MOTHER_NAME: "Nome da mãe não informado",
  MISSING_FATHER_NAME: "Nome do pai não informado",
};

export function credentialWarningLabel(warning: MemberCredentialWarning) {
  return WARNING_LABELS[warning];
}

export function credentialDownloadUrl(memberId: string) {
  return `/api/members/${encodeURIComponent(memberId)}/credential/pdf`;
}
