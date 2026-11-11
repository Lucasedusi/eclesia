import "server-only";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import type { AuthContext } from "@/modules/auth/types/auth.types";
import { dashboardAudience } from "../dashboard";

const count = z.number().int().nonnegative();
const ranking = z.array(z.object({ id: z.uuid(), name: z.string(), count })).nullable();
const summary = z.object({
  total: count, male: count, female: count,
  congregationName: z.string().nullable(), congregations: ranking, regions: ranking, roles: ranking,
});
export type DashboardSummary = z.infer<typeof summary>;

export async function getDashboardSummary(context: AuthContext) {
  if (!dashboardAudience(context)) return null;
  const client = await createClient();
  const { data, error } = await client.rpc("get_dashboard_member_summary", { p_access_id: context.access.id });
  if (error) throw new Error("Não foi possível carregar o resumo do Dashboard.");
  return summary.nullable().parse(data);
}
