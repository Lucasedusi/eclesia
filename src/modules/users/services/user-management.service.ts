import "server-only";

import { createClient } from "@/lib/supabase/server";
import { requireAccessContext } from "@/modules/auth/services/access-context.service";
import { PERMISSIONS } from "@/modules/auth/constants/permissions";
import type { AccessRole, AccessScope, AccessStatus } from "@/modules/auth/types/auth.types";

type NamedRelation = { name: string } | { name: string }[] | null;
type ProfileRelation = {
  full_name: string | null;
  display_name: string | null;
  email: string | null;
  avatar_url: string | null;
} | {
  full_name: string | null;
  display_name: string | null;
  email: string | null;
  avatar_url: string | null;
}[];

type AccessRow = {
  id: string; profile_id: string; role: AccessRole; access_scope: AccessScope; status: AccessStatus;
  region_id: string | null; congregation_id: string | null; ministry_id: string | null;
  invited_at: string | null; accepted_at: string | null; last_access_at: string | null; notes: string | null;
  profiles: ProfileRelation; regions: NamedRelation; congregations: NamedRelation; ministries: NamedRelation;
};

type InvitationRow = {
  id: string; invited_name: string; email: string; role: AccessRole; access_scope: AccessScope;
  status: "PENDING" | "ACCEPTED" | "EXPIRED" | "CANCELLED"; invited_at: string; expires_at: string;
  region_id: string | null; congregation_id: string | null; ministry_id: string | null;
  regions: NamedRelation; congregations: NamedRelation; ministries: NamedRelation;
};

function first<T>(value: T | T[] | null): T | null {
  return Array.isArray(value) ? value[0] ?? null : value;
}

export type UserAccessItem = {
  id: string; profileId: string; name: string; email: string; avatarUrl: string | null;
  role: AccessRole; scope: AccessScope; status: AccessStatus; targetName: string;
  regionId: string | null; congregationId: string | null; ministryId: string | null;
  invitedAt: string | null; acceptedAt: string | null; lastAccessAt: string | null; notes: string | null;
  overrides: Record<string, "ALLOW" | "DENY">;
};

export type InvitationItem = {
  id: string; name: string; email: string; role: AccessRole; scope: AccessScope;
  status: "PENDING" | "ACCEPTED" | "EXPIRED" | "CANCELLED"; targetName: string;
  invitedAt: string; expiresAt: string;
};

export type ScopeOption = { id: string; name: string };
export type PermissionOption = { key: string; name: string; module: string; sensitive: boolean };

export type UserManagementData = {
  accesses: UserAccessItem[];
  invitations: InvitationItem[];
  regions: ScopeOption[];
  congregations: ScopeOption[];
  ministries: ScopeOption[];
  permissions: PermissionOption[];
};

export async function getUserManagementData(): Promise<UserManagementData> {
  const context = await requireAccessContext(PERMISSIONS.usersView);
  const supabase = await createClient();

  const [accessResult, invitationsResult, regionsResult, congregationsResult, ministriesResult, permissionsResult] = await Promise.all([
    supabase.from("user_church_access").select(
      "id, profile_id, role, access_scope, status, region_id, congregation_id, ministry_id, invited_at, accepted_at, last_access_at, notes, profiles!user_church_access_profile_id_fkey(full_name, display_name, email, avatar_url), regions(name), congregations(name), ministries(name)",
    ).eq("church_id", context.church.id).is("deleted_at", null).order("created_at", { ascending: true }),
    supabase.from("church_invitations").select(
      "id, invited_name, email, role, access_scope, status, invited_at, expires_at, region_id, congregation_id, ministry_id, regions(name), congregations(name), ministries(name)",
    ).eq("church_id", context.church.id).eq("status", "PENDING").is("deleted_at", null).order("invited_at", { ascending: false }),
    supabase.from("regions").select("id, name").eq("church_id", context.church.id).eq("status", "ACTIVE").is("deleted_at", null).order("name"),
    supabase.from("congregations").select("id, name").eq("church_id", context.church.id).eq("status", "ACTIVE").is("deleted_at", null).order("name"),
    supabase.from("ministries").select("id, name").eq("church_id", context.church.id).eq("status", "ACTIVE").is("deleted_at", null).order("name"),
    supabase.from("permissions").select("key, name, module, is_sensitive").eq("status", "ACTIVE").is("deleted_at", null).order("module").order("name"),
  ]);

  const queryErrors = [
    { query: "accesses", error: accessResult.error },
    { query: "invitations", error: invitationsResult.error },
    { query: "regions", error: regionsResult.error },
    { query: "congregations", error: congregationsResult.error },
    { query: "ministries", error: ministriesResult.error },
    { query: "permissions", error: permissionsResult.error },
  ].filter((entry) => Boolean(entry.error));

  if (queryErrors.length > 0) {
    console.error(
      "[user-management] Failed to load data",
      queryErrors.map(({ query, error }) => ({
        query,
        code: error?.code,
        message: error?.message,
      })),
    );
    throw new Error("USER_MANAGEMENT_DATA_LOAD_FAILED");
  }

  const rows = (accessResult.data ?? []) as unknown as AccessRow[];
  const accessIds = rows.map((row) => row.id);
  const overrideResult = accessIds.length
    ? await supabase.from("user_permission_overrides").select("access_id, effect, permissions!inner(key)").in("access_id", accessIds).is("deleted_at", null)
    : { data: [], error: null };

  if (overrideResult.error) {
    console.error("[user-management] Failed to load permission overrides", {
      code: overrideResult.error.code,
      message: overrideResult.error.message,
    });
    throw new Error("USER_MANAGEMENT_OVERRIDES_LOAD_FAILED");
  }

  const overridesByAccess = new Map<string, Record<string, "ALLOW" | "DENY">>();
  for (const raw of overrideResult.data ?? []) {
    const row = raw as unknown as { access_id: string; effect: "ALLOW" | "DENY"; permissions: { key: string } | { key: string }[] };
    const permission = first(row.permissions);
    if (!permission) continue;
    const current = overridesByAccess.get(row.access_id) ?? {};
    current[permission.key] = row.effect;
    overridesByAccess.set(row.access_id, current);
  }

  return {
    accesses: rows.map((row) => {
      const profile = first(row.profiles);
      const target = first(row.regions) ?? first(row.congregations) ?? first(row.ministries);
      return {
        id: row.id, profileId: row.profile_id,
        name: profile?.full_name ?? profile?.display_name ?? "Usuário",
        email: profile?.email ?? "", avatarUrl: profile?.avatar_url ?? null,
        role: row.role, scope: row.access_scope, status: row.status,
        targetName: row.access_scope === "CHURCH" ? "Toda a igreja" : target?.name ?? "Escopo indisponível",
        regionId: row.region_id, congregationId: row.congregation_id, ministryId: row.ministry_id,
        invitedAt: row.invited_at, acceptedAt: row.accepted_at, lastAccessAt: row.last_access_at,
        notes: row.notes, overrides: overridesByAccess.get(row.id) ?? {},
      };
    }),
    invitations: ((invitationsResult.data ?? []) as unknown as InvitationRow[]).map((row) => {
      const target = first(row.regions) ?? first(row.congregations) ?? first(row.ministries);
      return {
        id: row.id, name: row.invited_name, email: row.email, role: row.role, scope: row.access_scope,
        status: row.status, targetName: row.access_scope === "CHURCH" ? "Toda a igreja" : target?.name ?? "Escopo indisponível",
        invitedAt: row.invited_at, expiresAt: row.expires_at,
      };
    }),
    regions: (regionsResult.data ?? []) as ScopeOption[],
    congregations: (congregationsResult.data ?? []) as ScopeOption[],
    ministries: (ministriesResult.data ?? []) as ScopeOption[],
    permissions: (permissionsResult.data ?? []).map((row) => ({ key: row.key, name: row.name, module: row.module, sensitive: row.is_sensitive })),
  };
}
