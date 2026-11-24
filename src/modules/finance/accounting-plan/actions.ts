"use server";

import { z } from "zod";
import { unstable_rethrow } from "next/navigation";
import { revalidatePath, updateTag } from "next/cache";
import { cacheTags } from "@/lib/cache-tags";
import { createClient } from "@/lib/supabase/server";
import { requireAccessContext } from "@/modules/auth/services/access-context.service";
import { PERMISSIONS } from "@/modules/auth/constants/permissions";
import {
  financeFailure,
  throwFinanceDatabaseError,
} from "../utils/finance-errors";
import type { FinanceActionResult } from "../types/finance.types";
import {
  accountsSchema,
  linkSchema,
  type Account,
  type PlanState,
} from "./plan";

async function withAdmin<T>(
  work: (church: string) => Promise<T>,
): Promise<FinanceActionResult<T>> {
  try {
    const auth = await requireAccessContext(PERMISSIONS.financeAccounting);
    if (
      auth.access.role !== "ADMIN" ||
      auth.access.scope !== "CHURCH" ||
      !auth.permissions.includes(PERMISSIONS.financeSettings) ||
      !auth.permissions.includes(PERMISSIONS.financeView)
    )
      throw new Error("FORBIDDEN");
    return { ok: true, data: await work(auth.church.id) };
  } catch (error) {
    unstable_rethrow(error);
    return financeFailure(error);
  }
}

export async function loadAccountingPlan() {
  return withAdmin<PlanState>(async (church) => {
    const client = await createClient();
    const { data, error } = await client.rpc("finance_accounting_plan", {
      p_church: church,
    });
    if (error) throwFinanceDatabaseError(error);
    return data as unknown as PlanState;
  });
}
export async function previewPlanFile(form: FormData) {
  return withAdmin<Account[]>(async () => {
    const file = form.get("file");
    if (!(file instanceof File) || !file.size || file.size > 5 * 1024 * 1024)
      throw new Error("ACCOUNTING_PLAN_FILE");
    const { parseChartPdf } = await import("./pdf");
    try {
      return await parseChartPdf(new Uint8Array(await file.arrayBuffer()));
    } catch {
      throw new Error("ACCOUNTING_PLAN_FILE");
    }
  });
}
export async function applyAccountingPlan(input: unknown) {
  return withAdmin<PlanState>(async (church) => {
    const { accounts, links, revision } = z
      .object({
        accounts: accountsSchema,
        links: z.array(linkSchema).max(2000),
        revision: z.string().regex(/^[a-f0-9]{32}$/),
      })
      .parse(input);
    const client = await createClient();
    const { data, error } = await client.rpc("apply_finance_accounting_plan", {
      p_church: church,
      p_revision: revision,
      p_accounts: accounts,
      p_links: links,
    });
    if (error) throwFinanceDatabaseError(error);
    updateTag(cacheTags.financeCatalogs(church));
    revalidatePath("/financeiro", "layout");
    return data as unknown as PlanState;
  });
}
