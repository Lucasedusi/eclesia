import "server-only";

import { createHash, randomBytes } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import type { AuthContext } from "@/modules/auth/types/auth.types";
import { MemberCredentialError } from "../types/member-credential.types";

const TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/;
const PENDING_LIFETIME_MS = 15 * 60 * 1000;

export function isMemberCredentialToken(value: string) {
  return TOKEN_PATTERN.test(value);
}

export function hashMemberCredentialToken(token: string) {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

export function buildCredentialValidationUrl(token: string, siteUrl: string) {
  if (!isMemberCredentialToken(token)) {
    throw new MemberCredentialError("MEMBER_CREDENTIAL_TOKEN_INVALID");
  }

  let origin: URL;
  try {
    origin = new URL(siteUrl);
  } catch {
    throw new MemberCredentialError("MEMBER_CREDENTIAL_SITE_URL_INVALID");
  }
  if (origin.protocol !== "https:" && origin.protocol !== "http:") {
    throw new MemberCredentialError("MEMBER_CREDENTIAL_SITE_URL_INVALID");
  }

  return new URL(`/verificar/membro/${token}`, origin.origin).toString();
}

export async function createMemberCredentialToken(
  context: AuthContext,
  memberId: string,
  now = new Date(),
  siteUrl = process.env.NEXT_PUBLIC_SITE_URL ??
    (process.env.NODE_ENV === "production" ? "" : "http://localhost:3000"),
) {
  const token = randomBytes(32).toString("base64url");
  const tokenHash = hashMemberCredentialToken(token);
  const pendingExpiresAt = new Date(now.getTime() + PENDING_LIFETIME_MS);
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("member_credential_tokens")
    .insert({
      church_id: context.church.id,
      member_id: memberId,
      token_hash: tokenHash,
      status: "PENDING",
      pending_expires_at: pendingExpiresAt.toISOString(),
      created_by: context.profile.id,
    })
    .select("id, created_at, pending_expires_at")
    .single();

  if (error || !data) {
    throw new MemberCredentialError("MEMBER_CREDENTIAL_TOKEN_CREATE_FAILED");
  }

  return {
    id: data.id,
    token,
    tokenHash,
    validationUrl: buildCredentialValidationUrl(token, siteUrl),
    createdAt: data.created_at,
    expiresAt: data.pending_expires_at,
  };
}

export async function loadActiveMemberCredentialIssuedAt(
  context: AuthContext,
  memberId: string,
) {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("member_credential_tokens")
    .select("issued_at")
    .eq("church_id", context.church.id)
    .eq("member_id", memberId)
    .eq("status", "ACTIVE")
    .maybeSingle();
  if (error) {
    throw new MemberCredentialError("MEMBER_CREDENTIAL_LOAD_FAILED");
  }
  return data?.issued_at ?? null;
}

export async function requireMemberCredentialTokenForIssue(
  context: AuthContext,
  memberId: string,
  token: string,
  now = new Date(),
) {
  if (!isMemberCredentialToken(token)) {
    throw new MemberCredentialError("MEMBER_CREDENTIAL_TOKEN_INVALID");
  }
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("member_credential_tokens")
    .select("id, status, pending_expires_at, issued_at")
    .eq("church_id", context.church.id)
    .eq("member_id", memberId)
    .eq("token_hash", hashMemberCredentialToken(token))
    .in("status", ["PENDING", "ACTIVE"])
    .maybeSingle();
  if (
    error ||
    !data ||
    (data.status === "PENDING" && new Date(data.pending_expires_at).getTime() <= now.getTime())
  ) {
    throw new MemberCredentialError("MEMBER_CREDENTIAL_TOKEN_INVALID");
  }
  return data as {
    id: string;
    status: "PENDING" | "ACTIVE";
    pending_expires_at: string;
    issued_at: string | null;
  };
}

export async function activateMemberCredentialToken(
  context: AuthContext,
  memberId: string,
  token: string,
  issuedAt: Date,
) {
  const admin = createAdminClient();
  const { data, error } = await admin.rpc("activate_member_credential_token", {
    p_church_id: context.church.id,
    p_member_id: memberId,
    p_token_hash: hashMemberCredentialToken(token),
    p_actor_id: context.profile.id,
    p_issued_at: issuedAt.toISOString(),
  });
  if (error || data !== true) {
    throw new MemberCredentialError("MEMBER_CREDENTIAL_TOKEN_ACTIVATE_FAILED");
  }
}

export async function revokeMemberCredentialToken(
  context: AuthContext,
  memberId: string,
) {
  const admin = createAdminClient();
  const { error } = await admin.rpc("revoke_member_credential_token", {
    p_church_id: context.church.id,
    p_member_id: memberId,
    p_actor_id: context.profile.id,
    p_revoked_at: new Date().toISOString(),
  });
  if (error) {
    throw new MemberCredentialError("MEMBER_CREDENTIAL_TOKEN_REVOKE_FAILED");
  }
}

export type PublicMemberCredentialValidation =
  | { valid: false }
  | {
      valid: true;
      memberName: string;
      churchName: string;
      congregationName: string;
      issuedDate: string;
    };

function publicIssuedDate(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  return match ? `${match[3]}/${match[2]}/${match[1]}` : "Não informado";
}

export async function loadPublicMemberCredentialValidation(
  token: string,
): Promise<PublicMemberCredentialValidation> {
  if (!isMemberCredentialToken(token)) return { valid: false };
  const admin = createAdminClient();
  const { data: credential, error: credentialError } = await admin
    .from("member_credential_tokens")
    .select("church_id, member_id, issued_at")
    .eq("token_hash", hashMemberCredentialToken(token))
    .eq("status", "ACTIVE")
    .maybeSingle();
  if (credentialError || !credential?.issued_at) return { valid: false };

  const [memberResult, churchResult, settingsResult] = await Promise.all([
    admin
      .from("members")
      .select("full_name, member_status, member_type, deleted_at, congregations!inner(name)")
      .eq("id", credential.member_id)
      .eq("church_id", credential.church_id)
      .is("deleted_at", null)
      .maybeSingle(),
    admin
      .from("churches")
      .select("name")
      .eq("id", credential.church_id)
      .is("deleted_at", null)
      .maybeSingle(),
    admin
      .from("app_settings")
      .select("display_church_name")
      .eq("church_id", credential.church_id)
      .is("deleted_at", null)
      .maybeSingle(),
  ]);
  const member = memberResult.data as unknown as {
    full_name: string | null;
    member_status: string;
    member_type: string;
    congregations: { name: string } | { name: string }[] | null;
  } | null;
  if (
    memberResult.error ||
    churchResult.error ||
    settingsResult.error ||
    !member ||
    !churchResult.data ||
    member.member_status !== "ACTIVE" ||
    member.member_type !== "MEMBER" ||
    !member.full_name
  ) {
    return { valid: false };
  }
  const congregation = Array.isArray(member.congregations)
    ? member.congregations[0]
    : member.congregations;
  if (!congregation?.name) return { valid: false };
  return {
    valid: true,
    memberName: member.full_name,
    churchName: settingsResult.data?.display_church_name?.trim() || churchResult.data.name,
    congregationName: congregation.name,
    issuedDate: publicIssuedDate(credential.issued_at),
  };
}
