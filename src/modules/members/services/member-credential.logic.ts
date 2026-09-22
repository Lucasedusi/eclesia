import { formatBrazilPhone, formatCnpj, formatCpf } from "@/utils/input-masks";
import type {
  MemberCredentialPreview,
  MemberCredentialSource,
  MemberCredentialWarning,
} from "../types/member-credential.types";
import { MemberCredentialError } from "../types/member-credential.types";

const FALLBACK_TEXT = "Não informado";

export const MEMBER_CREDENTIAL_COLORS = {
  navy: "#082A5B",
  navyDeep: "#041D43",
  gold: "#D4A72C",
  goldLight: "#F0D26F",
  lightBlue: "#68C6E8",
  ivory: "#FBF8F0",
  white: "#FFFFFF",
} as const;

export function isCredentialMemberId(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  );
}

function formatDateOnly(value: string | null) {
  if (!value) return FALLBACK_TEXT;
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  return match ? `${match[3]}/${match[2]}/${match[1]}` : FALLBACK_TEXT;
}

function cleanRequired(value: string | null) {
  return value?.trim() ?? "";
}

function cleanOptional(value: string | null) {
  return value?.trim() || FALLBACK_TEXT;
}

function credentialFileName(memberCode: string) {
  const safeCode = memberCode
    .replace(/[^A-Za-z0-9_-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 48);
  return `credencial-${safeCode}.pdf`;
}

function addressLine(source: MemberCredentialSource) {
  const street = source.churchAddress?.trim();
  if (!street) return FALLBACK_TEXT;
  const streetAndNumber = source.churchNumber?.trim()
    ? `${street}, ${source.churchNumber.trim()}`
    : street;
  const district = source.churchDistrict?.trim();
  const city = source.churchCity?.trim();
  const state = source.churchState?.trim();
  const cityState = city && state ? `${city}/${state}` : city || state;
  return [streetAndNumber, district, cityState].filter(Boolean).join(" - ");
}

function naturality(city: string | null, state: string | null) {
  const cleanCity = city?.trim();
  const cleanState = state?.trim();
  if (!cleanCity && !cleanState) return FALLBACK_TEXT;
  return [cleanCity, cleanState].filter(Boolean).join(" - ");
}

export function buildMemberCredentialPreview(
  source: MemberCredentialSource,
): MemberCredentialPreview {
  const { member } = source;
  if (
    member.memberStatus !== "ACTIVE" ||
    member.memberType !== "MEMBER" ||
    member.deletedAt
  ) {
    throw new MemberCredentialError("MEMBER_CREDENTIAL_INELIGIBLE");
  }

  const fullName = cleanRequired(member.fullName);
  const memberCode = cleanRequired(member.memberCode);
  const congregationName = cleanRequired(member.congregationName);
  if (!fullName || !memberCode || !congregationName) {
    throw new MemberCredentialError("MEMBER_CREDENTIAL_INCOMPLETE");
  }

  const warnings: MemberCredentialWarning[] = [];
  if (!source.churchLogoDataUri) warnings.push("MISSING_CHURCH_LOGO");
  if (!source.churchAddress?.trim()) warnings.push("MISSING_CHURCH_ADDRESS");
  if (!source.churchPhone?.trim()) warnings.push("MISSING_CHURCH_PHONE");
  if (!source.churchDocument?.trim()) warnings.push("MISSING_CHURCH_DOCUMENT");
  if (!member.activeRole) warnings.push("MISSING_ROLE");
  if (!member.cpf?.trim()) warnings.push("MISSING_CPF");
  if (!member.birthDate) warnings.push("MISSING_BIRTH_DATE");
  if (!member.baptismDate) warnings.push("MISSING_BAPTISM_DATE");
  if (!member.motherName?.trim()) warnings.push("MISSING_MOTHER_NAME");
  if (!member.fatherName?.trim()) warnings.push("MISSING_FATHER_NAME");
  if (!member.naturalCity?.trim() && !member.naturalState?.trim()) {
    warnings.push("MISSING_NATURALITY");
  }

  const role = member.activeRole;
  const useFemaleTitle =
    role?.titleVariant === "FEMALE" ||
    (role?.titleVariant === "AUTO" && member.gender === "FEMALE");
  const roleName = role
    ? useFemaleTitle && role.femaleName?.trim()
      ? role.femaleName.trim()
      : role.name.trim()
    : "Sem cargo cadastrado";

  return {
    issuedAt: source.issuedAt,
    issuedDate: formatDateOnly(source.issuedAt),
    fileName: credentialFileName(memberCode),
    church: {
      name: source.churchName.trim(),
      logoDataUri: source.churchLogoDataUri,
      addressLine: addressLine(source),
      phone: source.churchPhone?.trim()
        ? formatBrazilPhone(source.churchPhone)
        : FALLBACK_TEXT,
      document: source.churchDocument?.trim()
        ? formatCnpj(source.churchDocument)
        : FALLBACK_TEXT,
    },
    member: {
      fullName,
      roleName,
      memberCode,
      congregationName,
      cpf: member.cpf?.trim() ? formatCpf(member.cpf) : FALLBACK_TEXT,
      birthDate: formatDateOnly(member.birthDate),
      baptismDate: formatDateOnly(member.baptismDate),
      motherName: cleanOptional(member.motherName),
      fatherName: cleanOptional(member.fatherName),
      naturality: naturality(member.naturalCity, member.naturalState),
    },
    validation: {
      token: source.credentialToken,
      url: source.validationUrl,
      qrMatrix: source.qrMatrix,
      activeIssuedAt: source.activeCredentialIssuedAt,
    },
    warnings,
  };
}
