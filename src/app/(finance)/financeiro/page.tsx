import {Suspense} from "react";
import {resolveFinancePage,type FinanceSearchParams} from "@/modules/finance/services/finance-page.service";
async function Content({searchParams}:{searchParams:FinanceSearchParams}){const {month}=await resolveFinancePage(searchParams);return <div className="stack"><div><p className="eyebrow">Seu financeiro, em um só lugar</p><h1>Visão geral</h1><p className="muted">Acompanhe a movimentação de {month.split("-").reverse().join("/")}.</p></div></div>;}
export default function Page(props:{searchParams:FinanceSearchParams}){return <Suspense fallback={<p>Carregando resumo…</p>}><Content {...props}/></Suspense>;}
