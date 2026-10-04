import "server-only";
import {createClient} from "@/lib/supabase/server";
import {z} from "zod";
import type {FinanceContext} from "../types/finance.types";
import type {StatementRuleSet,StatementVersionDTO,StatementListItem} from "../types/finance-statement.types";
import {statementRulesSchema,copyStatementRulesSchema,generateStatementSchema} from "../validations/finance-statement.schemas";
import {throwFinanceDatabaseError} from "../utils/finance-errors";
export async function saveStatementRules(context:FinanceContext,input:z.infer<typeof statementRulesSchema>):Promise<{ruleSetId:string;revision:number}> {
 const value=statementRulesSchema.parse(input);if(!context.capabilities.manageSettings||value.congregationId!==context.congregationId) throw new Error("FORBIDDEN");
 const c=await createClient();const {data,error}=await c.rpc("save_finance_statement_rules",{p_church_id:context.churchId,p_payload:value});if(error) throwFinanceDatabaseError(error);return data as {ruleSetId:string;revision:number};
}
export async function copyStatementRules(context:FinanceContext,input:z.infer<typeof copyStatementRulesSchema>):Promise<{ruleSetId:string;revision:number}> {
 const value=copyStatementRulesSchema.parse(input);if(!context.capabilities.manageSettings||value.toCongregationId!==context.congregationId) throw new Error("FORBIDDEN");
 const c=await createClient();const {data,error}=await c.rpc("copy_finance_statement_rules",{p_church_id:context.churchId,p_from:value.fromCongregationId,p_to:context.congregationId,p_month:value.effectiveMonth,p_reason:value.retroactiveReason??null});if(error) throwFinanceDatabaseError(error);return data as {ruleSetId:string;revision:number};
}
export async function generateStatement(context:FinanceContext,input:{month:string;operationKey:string}):Promise<StatementVersionDTO> {
 const value=generateStatementSchema.parse({...input,congregationId:context.congregationId});if(!context.capabilities.generateStatement) throw new Error("FORBIDDEN");
 const c=await createClient();const {data,error}=await c.rpc("generate_finance_statement",{p_church_id:context.churchId,p_unit:context.congregationId,p_month:value.month,p_operation_key:value.operationKey});if(error) throwFinanceDatabaseError(error);return data as StatementVersionDTO;
}
export async function getStatementVersion(context:FinanceContext,versionId:string):Promise<StatementVersionDTO> {
 const c=await createClient();const id=z.uuid().parse(versionId);
 const existing=await c.from("report_delivery_versions").select("id").eq("church_id",context.churchId).eq("congregation_id",context.congregationId).eq("id",id).is("deleted_at",null).maybeSingle();
 if(existing.error) throwFinanceDatabaseError(existing.error);if(!existing.data) throw new Error("FORBIDDEN");
 const {data,error}=await c.rpc("get_finance_statement",{p_church_id:context.churchId,p_version_id:id});if(error) throwFinanceDatabaseError(error);return data as StatementVersionDTO;
}
export async function listStatementRules(context:FinanceContext):Promise<StatementRuleSet[]> {
 const c=await createClient();const {data,error}=await c.from("report_delivery_rule_sets").select("id,effective_month,revision,items").eq("church_id",context.churchId).eq("congregation_id",context.congregationId).is("deleted_at",null).order("effective_month",{ascending:false}).order("revision",{ascending:false}).limit(100);
 if(error) throwFinanceDatabaseError(error);return (data??[]).map(v=>({id:v.id,effectiveMonth:v.effective_month.slice(0,7),revision:v.revision,items:v.items as StatementRuleSet["items"]}));
}
export async function listStatementVersions(context:FinanceContext,month:string) {
 generateStatementSchema.shape.month.parse(month);
 const c=await createClient();const {data,error}=await c.from("report_delivery_versions").select("id,revision,created_at").eq("church_id",context.churchId).eq("congregation_id",context.congregationId).eq("month",`${month}-01`).is("deleted_at",null).order("revision",{ascending:false}).limit(100);
 if(error) throwFinanceDatabaseError(error);return (data??[]).map(v=>({id:v.id,revision:v.revision,createdAt:v.created_at}));
}

export async function listStatements(context:FinanceContext,input:{month:string}):Promise<StatementListItem[]>{
 if(!context.capabilities.view)throw new Error("FORBIDDEN");generateStatementSchema.shape.month.parse(input.month);const c=await createClient();
 const {data,error}=await c.rpc("list_finance_statements",{p_church_id:context.churchId,p_unit:context.congregationId,p_month:input.month});if(error)throwFinanceDatabaseError(error);return data as StatementListItem[];
}
