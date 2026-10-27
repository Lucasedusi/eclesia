import "server-only";
import { createClient } from "@/lib/supabase/server";
import {
  hashMemberCredentialToken,
  isMemberCredentialToken,
} from "@/modules/members/services/member-credential-token.service";
import {
  contributorSearchSchema,
  congregationSearchSchema,
  extractFinanceCredential,
} from "../utils/finance-contributor";
import { throwFinanceDatabaseError } from "../utils/finance-errors";
import type { FinanceContext } from "../types/finance.types";
import type {
  ContributorOption,
  ContributorSearch,
  FinanceCongregationOption,
} from "../types/finance-contributor.types";
export async function searchFinanceCongregations(
  context: FinanceContext,
  query: string,
): Promise<FinanceCongregationOption[]> {
  if (!context.capabilities.view) throw new Error("FORBIDDEN");
  const value = congregationSearchSchema.parse(query);
  const client = await createClient();
  const { data, error } = await client.rpc("lookup_finance_congregations", {
    p_church_id: context.churchId,
    p_unit: context.congregationId,
    p_query: value,
  });
  if (error) throwFinanceDatabaseError(error);
  return data as FinanceCongregationOption[];
}
export async function searchFinanceContributors(
  context: FinanceContext,
  input: ContributorSearch,
): Promise<ContributorOption[]> {
  if (!context.capabilities.lookupContributors) throw new Error("FORBIDDEN");
  const value = contributorSearchSchema.parse(input);
  let query = value.value;
  if (value.kind === "CREDENTIAL") {
    const token = extractFinanceCredential(query);
    if (!isMemberCredentialToken(token)) throw new Error("INVALID_INPUT");
    query = hashMemberCredentialToken(token);
  }
  const c = await createClient();
  const { data, error } = await c.rpc("lookup_finance_contributors", {
    p_church_id: context.churchId,
    p_unit: context.congregationId,
    p_kind: value.kind,
    p_value: query,
  });
  if (error) throwFinanceDatabaseError(error);
  return data as ContributorOption[];
}
