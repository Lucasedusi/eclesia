import { Suspense } from "react";
import { redirect, unstable_rethrow } from "next/navigation";
import { FinanceSkeleton } from "@/modules/finance/components/finance-skeleton";
import { FinancePayables } from "@/modules/finance/components/finance-payables";
import { queryFinancePayables, requirePayableContext } from "@/modules/finance/services/finance-payable.service";
import { listFinanceCatalogs } from "@/modules/finance/services/finance-catalog.service";
import { payableQuerySchema } from "@/modules/finance/validations/finance-payable.schemas";
import { todayLocal } from "@/modules/finance/utils/finance-period";
import type { FinanceSearchParams } from "@/modules/finance/services/finance-page.service";
async function load(searchParams: FinanceSearchParams) {
  const params = await searchParams;
  const context = await requirePayableContext();
  const query = payableQuerySchema.parse({ month: params.mes ?? todayLocal().slice(0, 7), status: params.status ?? "PENDING", search: params.search,
    dueStatus: params.dueStatus, categoryId: params.categoryId, dateFrom: params.dateFrom, dateTo: params.dateTo, page: params.page });
  if (query.status === "ALL") query.status = "PENDING";
  const [result, catalogs] = await Promise.all([queryFinancePayables(query), listFinanceCatalogs(context)]);
  return { result, query, catalogs, canCreateCategory: context.capabilities.manageSettings };
}
async function Content({ searchParams }: { searchParams: FinanceSearchParams }) {
  let data;
  try { data = await load(searchParams); } catch (error) {
    unstable_rethrow(error);
    if (error instanceof Error && error.message === "FORBIDDEN") redirect("/acesso-negado");
    return <section className="card stack"><h1>Contas a pagar</h1><p role="alert">{error instanceof Error && error.message === "CONFIGURATION_REQUIRED" ? "Confira o cadastro da Catedral para utilizar as contas a pagar." : "Não foi possível carregar as contas. Confira o período e tente novamente."}</p></section>;
  }
  return <FinancePayables {...data} />;
}
export default function Page(props: { searchParams: FinanceSearchParams }) {
  return <Suspense fallback={<FinanceSkeleton />}><Content {...props} /></Suspense>;
}
