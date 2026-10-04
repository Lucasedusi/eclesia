import {Suspense} from "react";
import {createClient} from "@/lib/supabase/server";
import {resolveFinancePage,type FinanceSearchParams} from "@/modules/finance/services/finance-page.service";
import {listFinanceCatalogs} from "@/modules/finance/services/finance-catalog.service";
import {listFinanceUnits} from "@/modules/finance/services/finance-access.service";
import {listStatementRules} from "@/modules/finance/services/finance-statement.service";
import {FinanceSettings} from "@/modules/finance/components/finance-settings";
import {listFinanceOperators} from "@/modules/finance/services/finance-operator.service";
async function Content({searchParams}:{searchParams:FinanceSearchParams}){
 const {context,month}=await resolveFinancePage(searchParams,true),client=await createClient();
 const [catalogs,rules,units,roles,operators]=await Promise.all([listFinanceCatalogs(context),listStatementRules(context),listFinanceUnits(context.auth),client.from("roles").select("id,name").eq("church_id",context.churchId).is("deleted_at",null).eq("status","ACTIVE").order("name"),listFinanceOperators(context)]);
 if(roles.error)throw new Error("UNAVAILABLE");
 return <FinanceSettings catalogs={catalogs} unit={context.congregationId} month={month} roles={roles.data??[]} rules={rules} units={units} operators={operators}/>;
}
export default function Page(props:{searchParams:FinanceSearchParams}){return <Suspense fallback={<p>Carregando configurações…</p>}><Content {...props}/></Suspense>;}
