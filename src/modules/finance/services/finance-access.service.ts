import "server-only";
import { cache } from "react";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { requireAccessContext } from "@/modules/auth/services/access-context.service";
import type { AuthContext } from "@/modules/auth/types/auth.types";
import type { PermissionKey } from "@/modules/auth/constants/permissions";
import { FINANCE_PERMISSIONS } from "../constants/finance-permissions";
import type { FinanceContext, FinanceUnit } from "../types/finance.types";
import { selectFinanceUnit } from "../utils/finance-access";
const loadUnits = cache(async (churchId: string): Promise<FinanceUnit[]> => {
  const client = await createClient();
  const { data, error } = await client.rpc("list_finance_units", { p_church_id: churchId });
  if (error) throw new Error("UNAVAILABLE");
  return data as FinanceUnit[];
});
export async function listFinanceUnits(auth: AuthContext) { return loadUnits(auth.church.id); }
export async function requireFinanceContext(input: { congregationId?: string; permission: PermissionKey }): Promise<FinanceContext> {
  const auth = await requireAccessContext(input.permission);
  const requested = input.congregationId === undefined ? undefined : z.uuid().parse(input.congregationId);
  const units = await listFinanceUnits(auth);
  const congregationId = selectFinanceUnit(auth, units, requested);
  const capabilities = units.find(unit => unit.id === congregationId)?.capabilities;
  const capability = Object.entries(FINANCE_PERMISSIONS).find(([, value]) => value === input.permission)?.[0] as keyof NonNullable<typeof capabilities> | undefined;
  if (!capabilities || !capability || !capabilities[capability]) throw new Error("FORBIDDEN");
  return { auth, churchId: auth.church.id, congregationId, capabilities };
}
