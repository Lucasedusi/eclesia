import "server-only";
import {createClient} from "@/lib/supabase/server";
import {hashMemberCredentialToken,isMemberCredentialToken} from "@/modules/members/services/member-credential-token.service";
import {contributorSearchSchema,extractFinanceCredential} from "../utils/finance-contributor";
import {throwFinanceDatabaseError} from "../utils/finance-errors";
import type {FinanceContext} from "../types/finance.types";
import type {ContributorOption,ContributorSearch} from "../types/finance-contributor.types";
export async function searchFinanceContributors(context:FinanceContext,input:ContributorSearch):Promise<ContributorOption[]> {
 if(!context.capabilities.lookupContributors) throw new Error("FORBIDDEN");
 const value=contributorSearchSchema.parse(input);let query=value.value;
 if(value.kind==="CREDENTIAL") {const token=extractFinanceCredential(query);if(!isMemberCredentialToken(token)) throw new Error("INVALID_INPUT");query=hashMemberCredentialToken(token);}
 const c=await createClient();const {data,error}=await c.rpc("lookup_finance_contributors",{p_church_id:context.churchId,p_unit:context.congregationId,p_kind:value.kind,p_value:query});
 if(error) throwFinanceDatabaseError(error);return data as ContributorOption[];
}
