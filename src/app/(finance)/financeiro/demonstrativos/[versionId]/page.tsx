import {Suspense} from "react";
import {resolveFinancePage,type FinanceSearchParams} from "@/modules/finance/services/finance-page.service";
import {getStatementVersion,listStatements} from "@/modules/finance/services/finance-statement.service";
import {FinanceStatementDetail} from "@/modules/finance/components/finance-statement-detail";
import {FinanceStatementPrint} from "@/modules/finance/components/finance-statements";
async function Content({searchParams,params}:{searchParams:FinanceSearchParams;params:Promise<{versionId:string}>}){const {context}=await resolveFinancePage(searchParams),{versionId}=await params;const statement=await getStatementVersion(context,versionId),versions=await listStatements(context,{month:statement.month});return <div className="stack"><FinanceStatementPrint/><FinanceStatementDetail statement={statement} superseded={versions.some(v=>v.id===statement.id&&v.superseded)}/></div>;}
export default function Page(props:{searchParams:FinanceSearchParams;params:Promise<{versionId:string}>}){return <Suspense fallback={<p>Carregando esta versão…</p>}><Content {...props}/></Suspense>;}
