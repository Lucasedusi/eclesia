import { FinancePayableSummary } from "@/modules/finance/components/finance-payable-summary";
import { queryFinancePayables } from "@/modules/finance/services/finance-payable.service";
import { canManagePayables } from "@/modules/finance/utils/finance-payables";
import { todayLocal } from "@/modules/finance/utils/finance-period";
import { unstable_rethrow } from "next/navigation";
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
  const canViewPayables = canManagePayables(context.auth);
  const payables = canViewPayables ? await queryFinancePayables({ month: todayLocal().slice(0, 7) }).catch((error) => { unstable_rethrow(error); return null; }) : null;
  return (<div className="stack">
    {canViewPayables && <FinancePayableSummary result={payables} unit={context.congregationId} month={month} />}
    <FinanceOverview
      overview={overview}
      recent={recent}
      unit={context.congregationId}
      month={month}
    />
  </div>);
}
export default function Page(props: { searchParams: FinanceSearchParams }) {
  return (
    <Suspense fallback={<FinanceSkeleton />}>
      <Content {...props} />
    </Suspense>
  );
}
