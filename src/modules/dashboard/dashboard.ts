import type { AuthContext } from "@/modules/auth/types/auth.types";
import { hasPermission, PERMISSIONS } from "@/modules/auth/constants/permissions";

export type RankingRow = { id: string; name: string; count: number };
export type DashboardPeriod = "today" | "week" | "month";

export function dashboardAudience({ access, church, permissions }: AuthContext) {
  if (access.status !== "ACTIVE" || access.churchId !== church.id ||
      !hasPermission(permissions, PERMISSIONS.dashboardView) ||
      !hasPermission(permissions, PERMISSIONS.membersViewBasic)) return null;
  if (access.role === "ADMIN" && access.scope === "CHURCH") return "field";
  if (access.scope === "CONGREGATION" && access.congregationId &&
      ["SECRETARY", "TREASURER", "VIEWER"].includes(access.role)) return "congregation";
  return null;
}

export function dashboardPeriod(value: unknown): DashboardPeriod {
  return value === "week" || value === "month" ? value : "today";
}

export function orderedRanking(rows: RankingRow[]) {
  return [...rows].sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, "pt-BR") || a.id.localeCompare(b.id));
}

export function rankingPreview(rows: RankingRow[], limit: number) {
  const full = orderedRanking(rows);
  return { full, top: full.filter(row => row.count > 0).slice(0, limit) };
}
