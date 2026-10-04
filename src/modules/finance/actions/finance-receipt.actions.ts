"use server";
import {unstable_rethrow} from "next/navigation";
import {PERMISSIONS} from "@/modules/auth/constants/permissions";
import {requireFinanceContext} from "../services/finance-access.service";
import {recordPrintRequest} from "../services/finance-receipt.service";
import {financeFailure} from "../utils/finance-errors";
import type {FinanceActionResult} from "../types/finance.types";
export async function recordFinancePrintAction(unit:string,id:string):Promise<FinanceActionResult<null>>{
 try{const context=await requireFinanceContext({congregationId:unit,permission:PERMISSIONS.financeView});await recordPrintRequest(context,id);return {ok:true,data:null};}catch(e){unstable_rethrow(e);return financeFailure(e);}
}
