import { Suspense } from "react";
import { notFound } from "next/navigation";
import {
  resolveFinancePage,
  type FinanceSearchParams,
} from "@/modules/finance/services/finance-page.service";
import { canViewInformativeReport } from "@/modules/finance/utils/finance-report-access";
import { listFinanceDeliveries } from "@/modules/finance/services/finance-administrative.service";
import { FinanceDeliveries } from "@/modules/finance/components/finance-deliveries";
import { FinanceSkeleton } from "@/modules/finance/components/finance-skeleton";
async function Content({
  searchParams,
}: {
  searchParams: FinanceSearchParams;
}) {
  const { context, month } = await resolveFinancePage(searchParams);
  if (!canViewInformativeReport(context)) notFound();
  const data = await listFinanceDeliveries(context, {
    month,
    includeInactive: false,
  });
  return (
    <FinanceDeliveries
      key={`${context.congregationId}-${month}`}
      initial={data}
      unit={context.congregationId}
      canConfigure={context.capabilities.manageSettings}
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
