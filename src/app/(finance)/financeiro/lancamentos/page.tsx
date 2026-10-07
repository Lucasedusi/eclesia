import { FinanceSkeleton } from "@/modules/finance/components/finance-skeleton";
import { Suspense } from "react";
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
    listFinanceTransactions(context, filters),
    listFinanceTransfers(context, month, Number(search.transferPage ?? 1)),
  ]);
  return (
    <FinanceTransactionsWorkspace
      catalogs={catalogs}
      result={result}
      transfers={transfers}
      capabilities={context.capabilities}
      date={todayLocal()}
      newEntry={search.novo === "entrada"}
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
