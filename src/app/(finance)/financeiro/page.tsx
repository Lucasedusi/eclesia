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
import { hasFinanceAdminAccess } from "@/modules/finance/utils/finance-report-access";
import { listFinanceUnits } from "@/modules/finance/services/finance-access.service";
async function Content({
  searchParams,
}: {
  searchParams: FinanceSearchParams;
}) {
  const { context, month } = await resolveFinancePage(searchParams);
  const units = await listFinanceUnits(context.auth);
  const canViewDailyFlow = hasFinanceAdminAccess(context) && units.some((unit) => unit.isHeadquarters && unit.capabilities?.view);
  const [overview, recent] = await Promise.all([
    getFinanceOverview(context, { month }),
    listFinanceTransactions(context, { month }),
  ]);
  return (<div className="stack">
    <FinanceOverview
      canViewDailyFlow={canViewDailyFlow}
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
