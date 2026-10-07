import { FinanceSkeleton } from "@/modules/finance/components/finance-skeleton";
import { Suspense } from "react";
import {
  resolveFinancePage,
  type FinanceSearchParams,
} from "@/modules/finance/services/finance-page.service";
import {
  getFinanceOverview,
  listFinanceTransactions,
} from "@/modules/finance/services/finance-query.service";
import { FinanceOverview } from "@/modules/finance/components/finance-overview";
async function Content({
  searchParams,
}: {
  searchParams: FinanceSearchParams;
}) {
  const { context, month } = await resolveFinancePage(searchParams);
  const [overview, recent] = await Promise.all([
    getFinanceOverview(context, { month }),
    listFinanceTransactions(context, { month }),
  ]);
  return (
    <FinanceOverview
      overview={overview}
      recent={recent}
      unit={context.congregationId}
      month={month}
      canCreate={context.capabilities.create}
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
