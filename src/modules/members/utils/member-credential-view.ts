import type {
  MemberCredentialPreview,
  MemberCredentialWarning,
} from "../types/member-credential.types";

export type CredentialPreviewState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; preview: MemberCredentialPreview };

type CredentialPreviewActionResult =
  | { success: true; data: MemberCredentialPreview }
  | { success: false; message: string };

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

export async function resolveCredentialPreviewState(
  request: Promise<CredentialPreviewActionResult>,
): Promise<CredentialPreviewState> {
  try {
    const result = await request;
    return result.success
      ? { status: "ready", preview: result.data }
      : { status: "error", message: result.message };
  } catch {
    return {
      status: "error",
      message: "Não foi possível preparar a credencial agora.",
    };
  }
}
