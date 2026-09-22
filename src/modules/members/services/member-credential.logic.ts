import type {
  MemberCredentialPreview,
  MemberCredentialSource,
  MemberCredentialWarning,
} from "../types/member-credential.types";
import { MemberCredentialError } from "../types/member-credential.types";

const FALLBACK_PRIMARY = "#415BA5";
const FALLBACK_DARK = "#354B8E";
const FALLBACK_TEXT = "Não informado";
const DARK_TEXT = "#101828" as const;
const LIGHT_TEXT = "#FFFFFF" as const;

function channels(hex: string) {
  return [1, 3, 5].map((index) =>
    Number.parseInt(hex.slice(index, index + 2), 16),
  ) as [number, number, number];
}

function toHex(values: [number, number, number]) {
  return `#${values
    .map((value) => Math.max(0, Math.min(255, Math.round(value))).toString(16).padStart(2, "0"))
    .join("")}`.toUpperCase();
}

function relativeLuminance(hex: string) {
  const linear = channels(hex).map((value) => {
    const channel = value / 255;
    return channel <= 0.04045
      ? channel / 12.92
      : ((channel + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2];
}

function contrastRatio(first: string, second: string) {
  const [lighter, darker] = [relativeLuminance(first), relativeLuminance(second)].sort(
    (a, b) => b - a,
  );
  return (lighter + 0.05) / (darker + 0.05);
}

function darken(hex: string, factor = 0.82) {
  return toHex(channels(hex).map((value) => value * factor) as [number, number, number]);
}

export function normalizeCredentialColor(value: string | null): {
  primaryColor: string;
  primaryDarkColor: string;
  foregroundColor: "#FFFFFF" | "#101828";
} {
  const candidate = value?.trim() ?? "";
  const primaryColor = /^#[0-9a-f]{6}$/i.test(candidate)
    ? candidate.toUpperCase()
    : FALLBACK_PRIMARY;
  let primaryDarkColor =
    primaryColor === FALLBACK_PRIMARY ? FALLBACK_DARK : darken(primaryColor);
  let lightContrast = contrastRatio(primaryDarkColor, LIGHT_TEXT);
  let darkContrast = contrastRatio(primaryDarkColor, DARK_TEXT);

  while (lightContrast < 4.5 && darkContrast < 4.5) {
    primaryDarkColor = darken(primaryDarkColor, 0.9);
    lightContrast = contrastRatio(primaryDarkColor, LIGHT_TEXT);
    darkContrast = contrastRatio(primaryDarkColor, DARK_TEXT);
  }

  return {
    primaryColor,
    primaryDarkColor,
    foregroundColor: darkContrast >= lightContrast ? DARK_TEXT : LIGHT_TEXT,
  };
}

function buildFakeQrPattern(size = 21) {
  const pattern = Array.from({ length: size }, (_, row) =>
    Array.from({ length: size }, (_, column) =>
      ((row * 7 + column * 11 + row * column) % 5) < 2,
    ),
  );
  const drawFinder = (top: number, left: number) => {
    for (let row = 0; row < 7; row += 1) {
      for (let column = 0; column < 7; column += 1) {
        const border = row === 0 || row === 6 || column === 0 || column === 6;
        const center = row >= 2 && row <= 4 && column >= 2 && column <= 4;
        pattern[top + row][left + column] = border || center;
      }
    }
  };
  drawFinder(0, 0);
  drawFinder(0, size - 7);
  drawFinder(size - 7, 0);
  for (let index = 8; index < 13; index += 1) {
    pattern[10][index] = index % 2 === 0;
    pattern[index][10] = index % 2 !== 0;
  }
  return pattern;
}

export const FAKE_QR_PATTERN: readonly (readonly boolean[])[] =
  buildFakeQrPattern();

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

function credentialFileName(memberCode: string) {
  const safeCode = memberCode
    .replace(/[^A-Za-z0-9_-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 48);
  return `credencial-${safeCode}.pdf`;
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
  if (!member.activeRole) warnings.push("MISSING_ROLE");
  if (!member.baptismDate) warnings.push("MISSING_BAPTISM_DATE");
  if (!member.motherName?.trim()) warnings.push("MISSING_MOTHER_NAME");
  if (!member.fatherName?.trim()) warnings.push("MISSING_FATHER_NAME");

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
    fileName: credentialFileName(memberCode),
    church: {
      name: source.churchName.trim(),
      ...normalizeCredentialColor(source.primaryColor),
    },
    member: {
      id: member.id,
      fullName,
      roleName,
      memberCode,
      congregationName,
      baptismDate: formatDateOnly(member.baptismDate),
      motherName: member.motherName?.trim() || FALLBACK_TEXT,
      fatherName: member.fatherName?.trim() || FALLBACK_TEXT,
    },
    warnings,
  };
}
