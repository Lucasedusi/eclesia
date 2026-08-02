import "server-only";

import { createHash } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import type {
  AccessRole,
  AccessScope,
} from "@/modules/auth/types/auth.types";

const INVITATION_TOKEN_PATTERN = /^[a-f0-9]{64}$/i;

type ChurchRelation = { name: string } | { name: string }[] | null;

type InvitationRow = {
  id: string;
  church_id: string;
  invited_name: string;
  email: string;
  email_normalized: string;
  role: AccessRole;
  access_scope: AccessScope;
  status: "PENDING" | "ACCEPTED" | "EXPIRED" | "CANCELLED";
  expires_at: string;
  deleted_at: string | null;
  churches: ChurchRelation;
};

type ProfileRow = {
  id: string;
  status: "PENDING" | "ACTIVE" | "INACTIVE" | "BLOCKED";
};

export type InvitationDetails = {
  id: string;
  churchId: string;
  churchName: string;
  invitedName: string;
  email: string;
  role: AccessRole;
  scope: AccessScope;
  expiresAt: string;
};

export type InvitationAccount =
  | { mode: "CREATE" }
  | {
      mode: "RECOVER_INVITATION";
      userId: string;
      userMetadata: Record<string, unknown>;
    }
  | { mode: "SIGN_IN"; userId: string };

function first<T>(value: T | T[] | null): T | null {
  return Array.isArray(value) ? value[0] ?? null : value;
}

function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export function isInvitationToken(token: string) {
  return INVITATION_TOKEN_PATTERN.test(token);
}

export async function getInvitationByToken(
  token: string,
): Promise<InvitationDetails | null> {
  if (!isInvitationToken(token)) return null;

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("church_invitations")
    .select(
      "id, church_id, invited_name, email, email_normalized, role, access_scope, status, expires_at, deleted_at, churches!inner(name)",
    )
    .eq("token_hash", hashToken(token))
    .eq("status", "PENDING")
    .gt("expires_at", new Date().toISOString())
    .is("deleted_at", null)
    .maybeSingle();

  if (error || !data) return null;

  const row = data as unknown as InvitationRow;
  const church = first(row.churches);
  if (!church) return null;

  return {
    id: row.id,
    churchId: row.church_id,
    churchName: church.name,
    invitedName: row.invited_name,
    email: row.email_normalized || row.email.toLowerCase(),
    role: row.role,
    scope: row.access_scope,
    expiresAt: row.expires_at,
  };
}

export async function resolveInvitationAccount(
  invitation: InvitationDetails,
): Promise<InvitationAccount> {
  const admin = createAdminClient();
  const { data: profileData } = await admin
    .from("profiles")
    .select("id, status")
    .eq("email", invitation.email)
    .is("deleted_at", null)
    .maybeSingle();

  const profile = profileData as ProfileRow | null;
  if (!profile) return { mode: "CREATE" };

  const [{ data: authData, error: authError }, { count: activeAccessCount }] =
    await Promise.all([
      admin.auth.admin.getUserById(profile.id),
      admin
        .from("user_church_access")
        .select("id", { count: "exact", head: true })
        .eq("profile_id", profile.id)
        .eq("status", "ACTIVE")
        .is("deleted_at", null),
    ]);

  if (authError || !authData.user) return { mode: "SIGN_IN", userId: profile.id };

  const metadata = authData.user.user_metadata ?? {};
  const unfinishedLegacyInvitation =
    metadata.account_origin === "INVITATION" &&
    !metadata.credentials_configured_at &&
    (activeAccessCount ?? 0) === 0;

  if (unfinishedLegacyInvitation) {
    return {
      mode: "RECOVER_INVITATION",
      userId: profile.id,
      userMetadata: metadata,
    };
  }

  return { mode: "SIGN_IN", userId: profile.id };
}
