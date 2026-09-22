import "server-only";

import QRCode from "qrcode";
import { createClient } from "@/lib/supabase/server";
import type { AuthContext } from "@/modules/auth/types/auth.types";
import type { MemberCredentialPdfFormat, MemberCredentialSource } from "../types/member-credential.types";
import { MemberCredentialError } from "../types/member-credential.types";
import { buildMemberCredentialPreview } from "./member-credential.logic";
import { createMemberCredentialPdf } from "./member-credential-pdf.service";
import {
  activateMemberCredentialToken,
  buildCredentialValidationUrl,
  createMemberCredentialToken,
  loadActiveMemberCredentialIssuedAt,
  requireMemberCredentialTokenForIssue,
} from "./member-credential-token.service";

// Relation shapes are dynamic because the shared client is not parameterized
// with the generated database type. Keep the cast isolated at this boundary.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyRow = Record<string, any>;

const MEMBER_CREDENTIAL_SELECT = [
  "id",
  "full_name",
  "gender",
  "member_code",
  "member_status",
  "member_type",
  "deleted_at",
  "birth_date",
  "baptism_date",
  "mother_name",
  "father_name",
  "natural_city",
  "natural_state",
  "congregations!inner(name)",
  "active_roles:member_roles!member_roles_member_id_fkey(status, deleted_at, title_variant, role:roles!member_roles_role_id_fkey(name, female_name))",
].join(", ");

const LOGO_MAX_BYTES = 2 * 1024 * 1024;
const ALLOWED_LOGO_TYPES = new Set(["image/png", "image/jpeg", "image/webp"]);

function first<T>(value: T | T[] | null | undefined): T | null {
  return Array.isArray(value) ? value[0] ?? null : value ?? null;
}

function qrMatrix(value: string) {
  const qr = QRCode.create(value, { errorCorrectionLevel: "M" });
  const result: boolean[][] = [];
  for (let row = 0; row < qr.modules.size; row += 1) {
    result.push([]);
    for (let column = 0; column < qr.modules.size; column += 1) {
      result[row].push(Boolean(qr.modules.data[row * qr.modules.size + column]));
    }
  }
  return result;
}

function allowedLogoHost(url: URL) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    return Boolean(supabaseUrl && url.host === new URL(supabaseUrl).host);
  } catch {
    return false;
  }
}

async function loadLogoDataUri(value: string | null) {
  if (!value) return null;
  if (/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(value)) {
    if (value.length > LOGO_MAX_BYTES * 1.4) return null;
    const [header, payload] = value.split(",", 2);
    const mimeType = header.slice(5, header.indexOf(";"));
    const bytes = Buffer.from(payload, "base64");
    return hasImageSignature(bytes, mimeType) ? value : null;
  }
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return null;
  }
  if (url.protocol !== "https:" || !allowedLogoHost(url)) return null;

  try {
    const response = await fetch(url, {
      cache: "no-store",
      signal: AbortSignal.timeout(4_000),
    });
    const contentType = response.headers.get("content-type")?.split(";")[0] ?? "";
    const contentLength = Number(response.headers.get("content-length") ?? "0");
    if (!response.ok || !ALLOWED_LOGO_TYPES.has(contentType) || contentLength > LOGO_MAX_BYTES) {
      return null;
    }
    const bytes = new Uint8Array(await response.arrayBuffer());
    if (bytes.byteLength > LOGO_MAX_BYTES || !hasImageSignature(bytes, contentType)) return null;
    return `data:${contentType};base64,${Buffer.from(bytes).toString("base64")}`;
  } catch {
    return null;
  }
}

function hasImageSignature(bytes: Uint8Array, mimeType: string) {
  if (mimeType === "image/png") {
    return bytes.length >= 8 && [137, 80, 78, 71, 13, 10, 26, 10]
      .every((value, index) => bytes[index] === value);
  }
  if (mimeType === "image/jpeg") {
    return bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  }
  if (mimeType === "image/webp") {
    return bytes.length >= 12 && Buffer.from(bytes.slice(0, 4)).toString("ascii") === "RIFF"
      && Buffer.from(bytes.slice(8, 12)).toString("ascii") === "WEBP";
  }
  return false;
}

type CredentialPresentation = {
  token: string;
  validationUrl: string;
  issuedAt: string;
  activeIssuedAt: string | null;
};

async function loadMemberCredentialSource(
  context: AuthContext,
  memberId: string,
  presentation: CredentialPresentation,
): Promise<MemberCredentialSource> {
  const supabase = await createClient();
  const [memberResult, settingsResult, churchResult, identityResult] = await Promise.all([
    supabase
      .from("members")
      .select(MEMBER_CREDENTIAL_SELECT)
      .eq("id", memberId)
      .eq("church_id", context.church.id)
      .is("deleted_at", null)
      .eq("active_roles.status", "ACTIVE")
      .is("active_roles.deleted_at", null)
      .maybeSingle(),
    supabase
      .from("app_settings")
      .select("display_church_name, logo_url")
      .eq("church_id", context.church.id)
      .is("deleted_at", null)
      .maybeSingle(),
    supabase
      .from("churches")
      .select("name, logo_url, address, number, district, city, state, phone, document")
      .eq("id", context.church.id)
      .is("deleted_at", null)
      .maybeSingle(),
    supabase
      .from("member_sensitive_identity")
      .select("cpf")
      .eq("member_id", memberId)
      .eq("church_id", context.church.id)
      .is("deleted_at", null)
      .maybeSingle(),
  ]);

  if (memberResult.error || settingsResult.error || churchResult.error || identityResult.error) {
    throw new MemberCredentialError("MEMBER_CREDENTIAL_LOAD_FAILED");
  }
  if (!memberResult.data || !churchResult.data) {
    throw new MemberCredentialError("MEMBER_CREDENTIAL_NOT_FOUND");
  }

  const row = memberResult.data as unknown as AnyRow;
  const settings = (settingsResult.data ?? {}) as AnyRow;
  const church = churchResult.data as unknown as AnyRow;
  const identity = (identityResult.data ?? {}) as AnyRow;
  const congregation = first<AnyRow>(row.congregations);
  const activeRoleLink = ((row.active_roles ?? []) as AnyRow[]).find(
    (link) => link.status === "ACTIVE" && !link.deleted_at,
  );
  const role = first<AnyRow>(activeRoleLink?.role);
  const logoDataUri = await loadLogoDataUri(
    settings.logo_url?.trim() || church.logo_url?.trim() || context.church.logoUrl,
  );

  return {
    issuedAt: presentation.issuedAt,
    credentialToken: presentation.token,
    validationUrl: presentation.validationUrl,
    qrMatrix: qrMatrix(presentation.validationUrl),
    activeCredentialIssuedAt: presentation.activeIssuedAt,
    churchName: settings.display_church_name?.trim() || church.name || context.church.name,
    churchLogoDataUri: logoDataUri,
    churchAddress: church.address ?? null,
    churchNumber: church.number ?? null,
    churchDistrict: church.district ?? null,
    churchCity: church.city ?? null,
    churchState: church.state ?? null,
    churchPhone: church.phone ?? null,
    churchDocument: church.document ?? null,
    member: {
      id: row.id,
      fullName: row.full_name,
      gender: row.gender,
      memberCode: row.member_code,
      memberStatus: row.member_status,
      memberType: row.member_type,
      deletedAt: row.deleted_at,
      congregationName: congregation?.name ?? null,
      cpf: identity.cpf ?? null,
      birthDate: row.birth_date,
      baptismDate: row.baptism_date,
      motherName: row.mother_name,
      fatherName: row.father_name,
      naturalCity: row.natural_city,
      naturalState: row.natural_state,
      activeRole: role
        ? {
            titleVariant: activeRoleLink?.title_variant ?? null,
            name: role.name,
            femaleName: role.female_name,
          }
        : null,
    },
  };
}

export async function assertMemberCredentialAccessible(context: AuthContext, memberId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("members")
    .select("id")
    .eq("id", memberId)
    .eq("church_id", context.church.id)
    .is("deleted_at", null)
    .maybeSingle();
  if (error) throw new MemberCredentialError("MEMBER_CREDENTIAL_LOAD_FAILED");
  if (!data) throw new MemberCredentialError("MEMBER_CREDENTIAL_NOT_FOUND");
}

export async function loadMemberCredentialPreview(
  context: AuthContext,
  memberId: string,
  now = new Date(),
) {
  await assertMemberCredentialAccessible(context, memberId);
  const token = await createMemberCredentialToken(context, memberId, now);
  const activeIssuedAt = await loadActiveMemberCredentialIssuedAt(context, memberId);
  const source = await loadMemberCredentialSource(context, memberId, {
    token: token.token,
    validationUrl: token.validationUrl,
    issuedAt: now.toISOString(),
    activeIssuedAt,
  });
  return buildMemberCredentialPreview(source);
}

export async function generateMemberCredentialDownload(
  context: AuthContext,
  memberId: string,
  token: string,
  format: MemberCredentialPdfFormat = "fold",
) {
  const now = new Date();
  const storedToken = await requireMemberCredentialTokenForIssue(context, memberId, token, now);
  const validationUrl = buildCredentialValidationUrl(
    token,
    process.env.NEXT_PUBLIC_SITE_URL ??
      (process.env.NODE_ENV === "production" ? "" : "http://localhost:3000"),
  );
  const source = await loadMemberCredentialSource(context, memberId, {
    token,
    validationUrl,
    issuedAt: storedToken.issued_at ?? now.toISOString(),
    activeIssuedAt: storedToken.issued_at,
  });
  const preview = buildMemberCredentialPreview(source);
  const body = await createMemberCredentialPdf(preview, format);
  if (storedToken.status === "PENDING") {
    await activateMemberCredentialToken(context, memberId, token, now);
  }
  return {
    body,
    fileName: format === "pvc"
      ? preview.fileName.replace(/\.pdf$/i, "-pvc.pdf")
      : preview.fileName,
  };
}
