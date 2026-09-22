import type {
  MemberCredentialPdfFormat,
  MemberCredentialPreview,
  MemberCredentialWarning,
} from "../types/member-credential.types";

export type CredentialPreviewState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; preview: MemberCredentialPreview };

export type CredentialSide = "front" | "back";

export function credentialFlipView(side: CredentialSide) {
  const showingFront = side === "front";
  return {
    side,
    nextSide: showingFront ? ("back" as const) : ("front" as const),
    buttonLabel: showingFront
      ? "Mostrar verso da credencial"
      : "Mostrar frente da credencial",
    hint: showingFront
      ? "Clique para ver o verso"
      : "Clique para ver a frente",
  };
}

type CredentialPreviewActionResult =
  | { success: true; data: MemberCredentialPreview }
  | { success: false; message: string };

const WARNING_LABELS: Record<MemberCredentialWarning, string> = {
  MISSING_CHURCH_LOGO: "Logo da igreja não configurada; será usado um monograma",
  MISSING_CHURCH_ADDRESS: "Endereço da igreja não informado",
  MISSING_CHURCH_PHONE: "Telefone da igreja não informado",
  MISSING_CHURCH_DOCUMENT: "CNPJ da igreja não informado",
  MISSING_ROLE: "Cargo não cadastrado",
  MISSING_CPF: "CPF não informado",
  MISSING_BIRTH_DATE: "Data de nascimento não informada",
  MISSING_BAPTISM_DATE: "Data do batismo não informada",
  MISSING_MOTHER_NAME: "Nome da mãe não informado",
  MISSING_FATHER_NAME: "Nome do pai não informado",
  MISSING_NATURALITY: "Naturalidade não informada",
};

export function credentialWarningLabel(warning: MemberCredentialWarning) {
  return WARNING_LABELS[warning];
}

export function credentialDownloadUrl(memberId: string) {
  return `/api/members/${encodeURIComponent(memberId)}/credential/pdf`;
}

export function credentialPdfFileName(fileName: string, format: MemberCredentialPdfFormat) {
  return format === "pvc" ? fileName.replace(/\.pdf$/i, "-pvc.pdf") : fileName;
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
