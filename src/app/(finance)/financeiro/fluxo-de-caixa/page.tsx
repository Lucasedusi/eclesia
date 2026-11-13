import { Suspense } from "react";
import Link from "next/link";
import { redirect, unstable_rethrow } from "next/navigation";
import { ZodError } from "zod";
import { FinanceDailyCashFlow } from "@/modules/finance/components/finance-daily-cash-flow";
import { FinanceSkeleton } from "@/modules/finance/components/finance-skeleton";
import { getDailyCashFlow } from "@/modules/finance/services/finance-daily-cash-flow.service";
import type { FinanceSearchParams } from "@/modules/finance/services/finance-page.service";

async function DailyFlow({ searchParams }: { searchParams: FinanceSearchParams }) {
  let result;
  try {
    result = await getDailyCashFlow(await searchParams);
  } catch (error) {
    unstable_rethrow(error);
    if (error instanceof Error && error.message === "FORBIDDEN") redirect("/acesso-negado");
    let message = "Não foi possível consultar o fluxo de caixa.";
    if (error instanceof ZodError) message = "Confira a data e os filtros informados.";
    if (error instanceof Error && error.message === "CONFIGURATION_REQUIRED")
      message = "Confira o cadastro da Catedral para consultar o fluxo diário.";
    if (error instanceof Error && error.message === "REPORT_RECONCILIATION_REQUIRED")
      message = "Os lançamentos e o histórico dos caixas divergem. Confira os movimentos desta data.";
    return <section className="card stack"><h1>Fluxo de caixa diário</h1><p role="alert">{message}</p>
      <Link href="/financeiro/fluxo-de-caixa">Consultar hoje</Link></section>;
  }
  return <FinanceDailyCashFlow {...result} />;
}

export default function Page(props: { searchParams: FinanceSearchParams }) {
  return <Suspense fallback={<FinanceSkeleton />}><DailyFlow {...props} /></Suspense>;
}
