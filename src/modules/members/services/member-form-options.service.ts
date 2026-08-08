import "server-only";

import { createClient } from "@/lib/supabase/server";
import { measureServerOperation } from "@/lib/performance/server-performance";
import { PERMISSIONS, hasPermission } from "@/modules/auth/constants/permissions";
import type { AuthContext } from "@/modules/auth/types/auth.types";
import type { MemberFormOptions, SelectOption } from "../types/member-form.types";

type CongregationRow = { id: string; name: string; city: string | null; state: string | null };
type RoleRow = { id: string; name: string; female_name: string | null; category: string };

function congregationOption(row: CongregationRow): SelectOption {
  return {
    value: row.id,
    label: row.name,
    description: [row.city, row.state].filter(Boolean).join(" - ") || undefined,
  };
}

function roleOption(row: RoleRow): SelectOption {
  return {
    value: row.id,
    label: row.female_name ? `${row.name} / ${row.female_name}` : row.name,
    description: row.category,
  };
}

export async function getMemberFormOptions(context: AuthContext): Promise<MemberFormOptions> {
  const supabase = await createClient();
  let congregationsQuery = supabase
    .from("congregations")
    .select("id, name, city, state")
    .eq("church_id", context.church.id)
    .eq("status", "ACTIVE")
    .is("deleted_at", null);

  if (context.access.scope === "REGION" && context.access.regionId) {
    congregationsQuery = congregationsQuery.eq("region_id", context.access.regionId);
  }
  if (context.access.scope === "CONGREGATION" && context.access.congregationId) {
    congregationsQuery = congregationsQuery.eq("id", context.access.congregationId);
  }

  const [congregationsResult, rolesResult] = await measureServerOperation(
    "members.form-options",
    () => Promise.all([
      congregationsQuery.order("name"),
      supabase
        .from("roles")
        .select("id, name, female_name, category")
        .eq("church_id", context.church.id)
        .eq("status", "ACTIVE")
        .is("deleted_at", null)
        .order("display_order")
        .order("name"),
    ]),
    { supabaseCalls: 2, route: "/membros/novo" },
  );

  const errors = [congregationsResult.error, rolesResult.error].filter(Boolean);
  if (errors.length) {
    console.error("Erro ao carregar opções de membros:", errors.map((item) => item?.message).join(" | "));
  }

  return {
    churchName: context.church.name,
    congregations: ((congregationsResult.data ?? []) as CongregationRow[]).map(congregationOption),
    roles: ((rolesResult.data ?? []) as RoleRow[]).map(roleOption),
    canManageSensitiveIdentity: hasPermission(context.permissions, PERMISSIONS.membersManageSensitiveIdentity),
    canEditPastoralNotes: hasPermission(context.permissions, PERMISSIONS.membersEditPastoralNotes),
    canManageRoles: hasPermission(context.permissions, PERMISSIONS.memberRolesManage),
    hasLoadError: errors.length > 0,
    loadErrorMessage: errors.length
      ? "Algumas opções não puderam ser carregadas. Tente atualizar a página."
      : undefined,
  };
}
