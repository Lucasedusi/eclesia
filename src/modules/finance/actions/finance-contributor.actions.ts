"use server";
import { z } from "zod";
import { unstable_rethrow } from "next/navigation";
import { PERMISSIONS } from "@/modules/auth/constants/permissions";
import { requireFinanceContext } from "../services/finance-access.service";
import {
  searchFinanceContributors,
  searchFinanceCongregations,
} from "../services/finance-contributor.service";
import {
  contributorSearchSchema,
  congregationSearchSchema,
} from "../utils/finance-contributor";
import { financeFailure } from "../utils/finance-errors";
import type { ContributorOption } from "../types/finance-contributor.types";
import type { FinanceActionResult } from "../types/finance.types";
import type { FinanceCongregationOption } from "../types/finance-contributor.types";
export async function searchFinanceCongregationsAction(
  unitId: string,
  input: unknown,
): Promise<FinanceActionResult<FinanceCongregationOption[]>> {
  try {
    const congregationId = z.uuid().parse(unitId);
    const query = congregationSearchSchema.parse(input);
    const context = await requireFinanceContext({
      congregationId,
      permission: PERMISSIONS.financeView,
    });
    return { ok: true, data: await searchFinanceCongregations(context, query) };
  } catch (error) {
    unstable_rethrow(error);
    return financeFailure(error);
  }
}
export async function searchFinanceContributorsAction(
  congregationId: string,
  input: unknown,
): Promise<FinanceActionResult<ContributorOption[]>> {
  try {
    const unit = z.uuid().parse(congregationId);
    const value = contributorSearchSchema.parse(input);
    const context = await requireFinanceContext({
      congregationId: unit,
      permission: PERMISSIONS.financeContributors,
    });
    return { ok: true, data: await searchFinanceContributors(context, value) };
  } catch (e) {
    unstable_rethrow(e);
    return financeFailure(e);
  }
}
