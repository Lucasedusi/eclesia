import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { FinanceContext } from "../types/finance.types";
import type { FinanceCatalogs, FinanceCatalogMutation } from "../types/finance-catalog.types";
import { financeCatalogSchema } from "../validations/finance-catalog.schemas";
import { decimalToCents } from "../utils/finance-money";
import { throwFinanceDatabaseError } from "../utils/finance-errors";
export async function listFinanceCatalogs(context:FinanceContext):Promise<FinanceCatalogs> {
 if(!context.capabilities.view) throw new Error("FORBIDDEN");
 const c=await createClient();const church=context.churchId;
 const results=await Promise.all([
 c.from("financial_departments").select("id,name,status").eq("church_id",church).is("deleted_at",null).is("congregation_id",null).order("name"),
 c.from("financial_categories").select("id,name,status,category_type,department_id,is_tithe,is_offering,requires_member").eq("church_id",church).is("deleted_at",null).order("name"),
 c.from("financial_tithe_classifications").select("id,name,status,role_id").eq("church_id",church).is("deleted_at",null).order("name"),
 c.from("financial_payment_methods").select("id,name,status,method_type").eq("church_id",church).is("deleted_at",null).order("name"),
 c.from("financial_cashboxes").select("id,name,status,congregation_id,cashbox_type,opening_date,opening_balance,current_balance,bank_name,agency,account_number").eq("church_id",church).eq("congregation_id",context.congregationId).is("deleted_at",null).order("name"),
 c.from("financial_cashbox_payment_methods").select("cashbox_id,payment_method_id").eq("church_id",church).is("deleted_at",null),
 c.from("financial_department_base_versions").select("id,department_id,effective_month,revision,participates_in_base").eq("church_id",church).is("deleted_at",null).order("effective_month",{ascending:false}).order("revision",{ascending:false}),
 ]);
 for(const result of results) if(result.error) throwFinanceDatabaseError(result.error);
 const departments=results[0].data??[];
 const categories=results[1].data??[];
 const classifications=results[2].data??[];
 const methods=results[3].data??[];
 const boxes=results[4].data??[];
 const links=results[5].data??[];
 const versions=results[6].data??[];
 return {
  departments:departments.map(d=>({id:d.id,name:d.name,status:d.status,baseVersions:versions.filter(v=>v.department_id===d.id).map(v=>({id:v.id,effectiveMonth:v.effective_month.slice(0,7),revision:v.revision,participatesInBase:v.participates_in_base}))})),
  categories:categories.map(v=>({id:v.id,name:v.name,status:v.status,direction:v.category_type,departmentId:v.department_id,isTithe:v.is_tithe,isOffering:v.is_offering,requiresPerson:v.requires_member})),
  classifications:classifications.map(v=>({id:v.id,name:v.name,status:v.status,roleId:v.role_id})),
  paymentMethods:methods.map(v=>({id:v.id,name:v.name,status:v.status,kind:v.method_type})),
  cashboxes:boxes.map(v=>({id:v.id,name:v.name,status:v.status,congregationId:v.congregation_id,kind:v.cashbox_type,openingDate:v.opening_date,openingCents:decimalToCents(v.opening_balance),balanceCents:decimalToCents(v.current_balance),paymentMethodIds:links.filter(l=>l.cashbox_id===v.id).map(l=>l.payment_method_id),bankName:v.bank_name,agency:v.agency,accountNumber:v.account_number})),
 };
}
export async function saveFinanceCatalog(context:FinanceContext,input:FinanceCatalogMutation):Promise<{id:string}> {
 if(!context.capabilities.manageSettings) throw new Error("FORBIDDEN");const value=financeCatalogSchema.parse(input);
 if(value.congregationId!==context.congregationId) throw new Error("FORBIDDEN");
 const c=await createClient();const {data,error}=await c.rpc("save_finance_catalog",{p_church_id:context.churchId,p_payload:value});
 if(error) throwFinanceDatabaseError(error);return data as {id:string};
}
