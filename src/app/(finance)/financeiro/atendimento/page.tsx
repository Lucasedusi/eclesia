import {Suspense} from "react";
import {resolveFinancePage,type FinanceSearchParams} from "@/modules/finance/services/finance-page.service";
import {listFinanceCatalogs} from "@/modules/finance/services/finance-catalog.service";
import {FinanceAttendance} from "@/modules/finance/components/finance-attendance";
import {todayLocal} from "@/modules/finance/utils/finance-period";
async function Content({searchParams}:{searchParams:FinanceSearchParams}){const {context,month}=await resolveFinancePage(searchParams);if(!context.capabilities.create)throw new Error("FORBIDDEN");return <FinanceAttendance unit={context.congregationId} month={month} date={todayLocal()} catalogs={await listFinanceCatalogs(context)} capabilities={context.capabilities}/>;}
export default function Page(props:{searchParams:FinanceSearchParams}){return <Suspense fallback={<p>Preparando atendimento…</p>}><Content {...props}/></Suspense>;}
