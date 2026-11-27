import "server-only";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import type { AuthContext } from "@/modules/auth/types/auth.types";
import { PERMISSIONS } from "@/modules/auth/constants/permissions";
import { dashboardAudience } from "../dashboard";

const count = z.number().int().nonnegative();
const ranking = z.array(z.object({ id: z.uuid(), name: z.string(), count })).nullable();
const summary = z.object({
  total: count, male: count, female: count,
  congregationName: z.string().nullable(), congregations: ranking, regions: ranking, roles: ranking,
  fieldRoles: ranking,
});
export type DashboardSummary = z.infer<typeof summary>;

export async function getDashboardSummary(context: AuthContext) {
  if (!dashboardAudience(context)) return null;
  const client = await createClient();
  const { data, error } = await client.rpc("get_dashboard_member_summary", { p_access_id: context.access.id });
  if (error) throw new Error("Não foi possível carregar o resumo do Dashboard.");
  return summary.nullable().parse(data);
}

const birthdayScope = z.object({
  church_id: z.uuid(),
  congregation_id: z.uuid().nullable(),
  is_field: z.boolean(),
  view_organization: z.boolean(),
  view_contact: z.boolean(),
});

export async function getDashboardBirthdayContext(context: AuthContext) {
  const audience = dashboardAudience(context);
  if (!audience) return null;

  const client = await createClient();
  const { data, error } = await client.rpc("get_dashboard_member_scope", { p_access_id: context.access.id }).maybeSingle();
  if (error) throw new Error("Não foi possível carregar os aniversariantes.");
  const scope = birthdayScope.nullable().parse(data);
  if (!scope || scope.church_id !== context.church.id || scope.is_field !== (audience === "field") ||
      scope.congregation_id !== context.access.congregationId) return null;

  // The church context may combine grants from multiple accesses. Birthday columns
  // also require the permission on the selected dashboard access.
  const permissions = context.permissions.filter(key =>
    (key !== PERMISSIONS.organizationView || scope.view_organization) &&
    (key !== PERMISSIONS.membersViewFull || scope.view_contact));
  return { ...context, permissions };
}
