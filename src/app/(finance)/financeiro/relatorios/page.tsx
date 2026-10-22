import { Suspense } from "react";
import { listFinanceReportCashboxes } from "@/modules/finance/services/finance-report.service";
import {
  resolveFinancePage,
  type FinanceSearchParams,
} from "@/modules/finance/services/finance-page.service";
import { FinanceSkeleton } from "@/modules/finance/components/finance-skeleton";
import { FinanceReports } from "@/modules/finance/components/finance-reports";
import { canViewInformativeReport } from "@/modules/finance/utils/finance-report-access";
async function Content({
  searchParams,
}: {
  searchParams: FinanceSearchParams;
}) {
  const { context, month } = await resolveFinancePage(searchParams);
  const data = await listFinanceReportCashboxes(context);
  return (
    <FinanceReports
      key={`${context.congregationId}-${month}`}
      unit={context.congregationId}
      month={month}
      cashboxes={data ?? []}
      canViewInformative={canViewInformativeReport(context)}
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
