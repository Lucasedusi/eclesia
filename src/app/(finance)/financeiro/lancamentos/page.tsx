import { FinanceSkeleton } from "@/modules/finance/components/finance-skeleton";
import { Suspense } from "react";
import Link from "next/link";
import { financeLocation } from "@/modules/finance/utils/finance-navigation";
import {
  resolveFinancePage,
  type FinanceSearchParams,
} from "@/modules/finance/services/finance-page.service";
import { listFinanceCatalogs } from "@/modules/finance/services/finance-catalog.service";
import {
  listFinanceTransactions,
  listFinanceTransfers,
} from "@/modules/finance/services/finance-query.service";
import { financeFiltersSchema } from "@/modules/finance/validations/finance-query.schemas";
import { FinanceTransactionsWorkspace } from "@/modules/finance/components/finance-transactions-workspace";
import { todayLocal } from "@/modules/finance/utils/finance-period";
async function Content({
  searchParams,
}: {
  searchParams: FinanceSearchParams;
}) {
  const { context, month, search } = await resolveFinancePage(searchParams);
  const filters = financeFiltersSchema.parse(
    Object.fromEntries(
      Object.entries({ ...search, month }).filter(
        ([key]) => key in financeFiltersSchema.shape,
      ),
    ),
  );
  const [catalogs, result, transfers] = await Promise.all([
    listFinanceCatalogs(context),
    listFinanceTransactions(context, filters).catch((error: unknown) => {
      if (error instanceof Error && error.message === "FINANCE_DATE_RANGE_UNAVAILABLE") return null;
      throw error;
    }),
    listFinanceTransfers(context, month, Number(search.transferPage ?? 1), filters),
  ]);
  if (!result) return <section className="card stack" role="alert">
    <p>A consulta por intervalo precisa de uma atualização do financeiro neste ambiente. A consulta por mês continua disponível.</p>
    <Link href={financeLocation("/financeiro/lancamentos", context.congregationId, month)}>Consultar por mês</Link>
  </section>;
  return (
    <FinanceTransactionsWorkspace
      catalogs={catalogs}
      result={result}
      transfers={transfers}
      capabilities={context.capabilities}
      date={todayLocal()}
      initialEntry={
        search.novo === "entrada"
          ? "INCOME"
          : search.novo === "saida"
            ? "EXPENSE"
            : null
      }
      unit={context.congregationId}
      month={month}
      filters={filters}
    />
  );
}
export default function Page(props: { searchParams: FinanceSearchParams }) {
  return (
    <Suspense fallback={<FinanceSkeleton />}>
      <Content {...props} />
    </Suspense>
  );
}
