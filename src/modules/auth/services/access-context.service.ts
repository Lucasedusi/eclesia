import "server-only";

import { cache } from "react";
import { io } from "next/cache";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { measureServerOperation } from "@/lib/performance/server-performance";
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

type RpcAccessRow = Omit<AccessRow, "churches"> & {
  church: { id: string; name: string; logo_url: string | null } | null;
};

type AccessContextPayload = {
  profile: ProfileRow | null;
  accesses: RpcAccessRow[];
  selected_access_id: string | null;
  permissions: unknown[];
};

type AuthIdentity = {
  id: string;
  email: string;
  fullName: string | null;
};

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

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

function normalizePermissions(value: unknown[] | null | undefined) {
  return (value ?? []).map((item) =>
    typeof item === "string"
      ? item
      : String((item as { permission_key?: string }).permission_key ?? ""),
  ).filter(Boolean);
}

function getIdentityFromClaims(claims: Record<string, unknown>): AuthIdentity | null {
  if (typeof claims.sub !== "string" || !claims.sub) return null;
  const metadata = claims.user_metadata;
  const fullName = metadata && typeof metadata === "object"
    ? (metadata as Record<string, unknown>).full_name
    : null;
  return {
    id: claims.sub,
    email: typeof claims.email === "string" ? claims.email : "",
    fullName: typeof fullName === "string" ? fullName : null,
  };
}

async function loadLegacyContext(
  supabase: SupabaseServerClient,
  userId: string,
  preferredChurchId: string | undefined,
) {
  const [profileResult, accessResult] = await Promise.all([
    supabase
      .from("profiles")
      .select("id, full_name, display_name, email, avatar_url, status, deleted_at")
      .eq("id", userId)
      .maybeSingle(),
    supabase
      .from("user_church_access")
      .select("id, church_id, role, access_scope, status, region_id, congregation_id, ministry_id, churches!inner(id, name, logo_url)")
      .eq("profile_id", userId)
      .eq("status", "ACTIVE")
      .is("deleted_at", null)
      .order("accepted_at", { ascending: true, nullsFirst: false }),
  ]);

  const profile = profileResult.data as ProfileRow | null;
  const rows = (accessResult.data ?? []) as unknown as AccessRow[];
  const selectedRow = rows.find((row) => row.church_id === preferredChurchId) ?? rows[0];
  const permissionResult = selectedRow
    ? await supabase.rpc("get_my_permissions", { p_church_id: selectedRow.church_id })
    : { data: [] };

  return {
    profile,
    rows,
    selectedAccessId: selectedRow?.id ?? null,
    permissions: normalizePermissions(permissionResult.data),
  };
}

export const resolveAccessContext = cache(async (): Promise<AccessResolution> => {
  // getClaims() verifica a validade temporal do JWT internamente. No Next 16
  // com Cache Components, essa leitura deve acontecer depois do limite de I/O
  // para não ser capturada durante o prerender da interface autenticada.
  await io();

  const supabase = await createClient();
  const { data: claimsData, error: claimsError } = await measureServerOperation(
    "auth.getClaims",
    () => supabase.auth.getClaims(),
  );
  const identity = !claimsError && claimsData?.claims
    ? getIdentityFromClaims(claimsData.claims as Record<string, unknown>)
    : null;

  if (!identity) return { status: "anonymous" };

  const cookieStore = await cookies();
  const preferredChurchId = cookieStore.get(CHURCH_CONTEXT_COOKIE)?.value;
  const { data: payloadData, error: contextError } = await measureServerOperation(
    "access-context.rpc",
    () => supabase.rpc(
      "get_my_access_context",
      { p_preferred_church_id: preferredChurchId ?? null },
    ),
    { supabaseCalls: 1 },
  );

  let profile: ProfileRow | null;
  let rows: AccessRow[];
  let selectedAccessId: string | null;
  let permissions: string[];

  if (!contextError && payloadData) {
    const payload = payloadData as unknown as AccessContextPayload;
    profile = payload.profile;
    rows = (payload.accesses ?? []).map((row) => ({
      ...row,
      churches: row.church,
    }));
    selectedAccessId = payload.selected_access_id;
    permissions = normalizePermissions(payload.permissions);
  } else {
    if (process.env.NODE_ENV === "development") {
      console.warn("[access-context] RPC consolidada indisponível; usando fallback seguro.", {
        code: contextError?.code,
      });
    }
    const legacy = await loadLegacyContext(supabase, identity.id, preferredChurchId);
    profile = legacy.profile;
    rows = legacy.rows;
    selectedAccessId = legacy.selectedAccessId;
    permissions = legacy.permissions;
  }

  if (
    !profile ||
    profile.deleted_at ||
    profile.status === "BLOCKED" ||
    profile.status === "INACTIVE"
  ) {
    return { status: "profile-unavailable" };
  }

  if (rows.length === 0) {
    const { count } = await supabase
      .from("church_invitations")
      .select("id", { count: "exact", head: true })
      .eq("email_normalized", identity.email.trim().toLowerCase())
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

  const selectedRow =
    rows.find((row) => row.id === selectedAccessId) ??
    rows.find((row) => row.church_id === preferredChurchId) ??
    rows[0];
  const selectedChurch = getChurch(selectedRow);

  if (!selectedChurch) return { status: "profile-unavailable" };

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
        fullName: profile.full_name ?? identity.fullName ?? "Usuário",
        displayName:
          profile.display_name ??
          profile.full_name?.split(" ")[0] ??
          identity.fullName?.split(" ")[0] ??
          "Usuário",
        email: profile.email ?? identity.email,
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
