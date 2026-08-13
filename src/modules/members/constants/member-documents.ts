export const MEMBER_DOCUMENT_BUCKET = "member-documents";
export const MEMBER_DOCUMENT_MAX_SIZE = 10 * 1024 * 1024;

export const MEMBER_DOCUMENT_TYPES = [
  ["PHOTO", "Foto"],
  ["CPF", "CPF"],
  ["RG", "RG"],
  ["BIRTH_CERTIFICATE", "Certidão de nascimento"],
  ["MARRIAGE_CERTIFICATE", "Certidão de casamento"],
  ["TRANSFER_LETTER", "Carta de transferência"],
  ["ADDRESS_PROOF", "Comprovante de endereço"],
  ["BAPTISM_CERTIFICATE", "Certificado de batismo"],
  ["MEMBERSHIP_FORM", "Ficha de membro"],
  ["OTHER", "Outro"],
] as const;

export const MEMBER_DOCUMENT_ACCEPT = [
  ".pdf",
  ".jpg",
  ".jpeg",
  ".png",
  ".webp",
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
].join(",");

export type MemberDocumentType = (typeof MEMBER_DOCUMENT_TYPES)[number][0];

export function getMemberDocumentTypeLabel(value: string) {
  return (
    MEMBER_DOCUMENT_TYPES.find(([type]) => type === value)?.[1] ?? "Outro"
  );
}
