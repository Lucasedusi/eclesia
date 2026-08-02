import "server-only";

import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getInitialRegistrationAvailability } from "./initial-registration.service";
import type {
  AccessRole,
  AccessScope,
  AccessStatus,
  AuthContext,
  ChurchSummary,
  ProfileStatus,
} from "../types/auth.types";

const CHURCH_CONTEXT_COOKIE = "eclesias_church_id";

type ProfileRow = {
  id: string;
  full_name: string | null;
  display_name: string | null;
  email: string | null;
  avatar_url: string | null;
  status: ProfileStatus;
  deleted_at: string | null;
};

type AccessRow = {
  id: string;
  church_id: string;
  role: AccessRole;
  access_scope: AccessScope;
  status: AccessStatus;
  region_id: string | null;
  congregation_id: string | null;
  ministry_id: string | null;
  churches:
    | { id: string; name: string; logo_url: string | null }
    | { id: string; name: string; logo_url: string | null }[]
    | null;
};

export type AccessResolution =
  | { status: "anonymous" }
  | { status: "profile-unavailable" }
  | { status: "onboarding" }
  | { status: "pending-invite" }
  | { status: "ready"; context: AuthContext };

function getChurch(row: AccessRow): ChurchSummary | null {
  const church = Array.isArray(row.churches) ? row.churches[0] : row.churches;
  if (!church) return null;

  return { id: church.id, name: church.name, logoUrl: church.logo_url };
}

export const resolveAccessContext = cache(async (): Promise<AccessResolution> => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { status: "anonymous" };

  const { data: profileData } = await supabase
    .from("profiles")
    .select(
      "id, full_name, display_name, email, avatar_url, status, deleted_at",
    )
    .eq("id", user.id)
    .maybeSingle();

  const profile = profileData as ProfileRow | null;

  if (
    !profile ||
    profile.deleted_at ||
    profile.status === "BLOCKED" ||
    profile.status === "INACTIVE"
  ) {
    return { status: "profile-unavailable" };
  }

  const { data: accessData } = await supabase
    .from("user_church_access")
    .select(
      "id, church_id, role, access_scope, status, region_id, congregation_id, ministry_id, churches!inner(id, name, logo_url)",
    )
    .eq("profile_id", user.id)
    .eq("status", "ACTIVE")
    .is("deleted_at", null)
    .order("accepted_at", { ascending: true, nullsFirst: false });

  const rows = (accessData ?? []) as unknown as AccessRow[];

  if (rows.length === 0) {
    const { count } = await supabase
      .from("church_invitations")
      .select("id", { count: "exact", head: true })
      .eq("email_normalized", user.email?.trim().toLowerCase() ?? "")
      .eq("status", "PENDING")
      .gt("expires_at", new Date().toISOString())
      .is("deleted_at", null);

    if (count && count > 0) return { status: "pending-invite" };

    try {
      const { hasChurch } = await getInitialRegistrationAvailability();
      return hasChurch
        ? { status: "profile-unavailable" }
        : { status: "onboarding" };
    } catch {
      return { status: "profile-unavailable" };
    }
  }

  const cookieStore = await cookies();
  const preferredChurchId = cookieStore.get(CHURCH_CONTEXT_COOKIE)?.value;
  const selectedRow =
    rows.find((row) => row.church_id === preferredChurchId) ?? rows[0];
  const selectedChurch = getChurch(selectedRow);

  if (!selectedChurch) return { status: "profile-unavailable" };

  const { data: permissionData } = await supabase.rpc("get_my_permissions", {
    p_church_id: selectedRow.church_id,
  });

  const permissions = (permissionData ?? []).map((item: unknown) =>
    typeof item === "string"
      ? item
      : String((item as { permission_key?: string }).permission_key ?? ""),
  ).filter(Boolean);

  const churchMap = new Map<string, ChurchSummary>();
  rows.forEach((row) => {
    const church = getChurch(row);
    if (church) churchMap.set(church.id, church);
  });

  return {
    status: "ready",
    context: {
      profile: {
        id: profile.id,
        fullName: profile.full_name ?? user.user_metadata.full_name ?? "Usuário",
        displayName:
          profile.display_name ??
          profile.full_name?.split(" ")[0] ??
          user.user_metadata.full_name?.split(" ")[0] ??
          "Usuário",
        email: profile.email ?? user.email ?? "",
        avatarUrl: profile.avatar_url,
        status: profile.status,
      },
      church: selectedChurch,
      access: {
        id: selectedRow.id,
        churchId: selectedRow.church_id,
        role: selectedRow.role,
        scope: selectedRow.access_scope,
        status: selectedRow.status,
        regionId: selectedRow.region_id,
        congregationId: selectedRow.congregation_id,
        ministryId: selectedRow.ministry_id,
      },
      accesses: rows.map((row) => ({
        id: row.id,
        churchId: row.church_id,
        role: row.role,
        scope: row.access_scope,
        status: row.status,
        regionId: row.region_id,
        congregationId: row.congregation_id,
        ministryId: row.ministry_id,
      })),
      availableChurches: [...churchMap.values()],
      permissions,
    },
  };
});

export async function getAuthenticatedDestination() {
  const result = await resolveAccessContext();

  switch (result.status) {
    case "anonymous":
      return "/login";
    case "profile-unavailable":
      return "/acesso-indisponivel";
    case "pending-invite":
      return "/aguardando-liberacao";
    case "onboarding":
      return "/onboarding";
    case "ready":
      return "/";
  }
}

export async function requireAccessContext(
  permission?: string,
): Promise<AuthContext> {
  const result = await resolveAccessContext();

  if (result.status === "anonymous") redirect("/login");
  if (result.status === "profile-unavailable") redirect("/acesso-indisponivel");
  if (result.status === "pending-invite") redirect("/aguardando-liberacao");
  if (result.status === "onboarding") redirect("/onboarding");

  if (permission && !result.context.permissions.includes(permission)) {
    redirect("/acesso-negado");
  }

  return result.context;
}

export async function requireAuthenticatedUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");
  return user;
}

export { CHURCH_CONTEXT_COOKIE };
