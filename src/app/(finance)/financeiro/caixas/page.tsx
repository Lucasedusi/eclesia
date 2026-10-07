import { FinanceSkeleton } from "@/modules/finance/components/finance-skeleton";
import { Suspense } from "react";
import {
  resolveFinancePage,
  type FinanceSearchParams,
} from "@/modules/finance/services/finance-page.service";
import { listFinanceCatalogs } from "@/modules/finance/services/finance-catalog.service";
import { FinanceCashboxes } from "@/modules/finance/components/finance-cashboxes";
async function Content({
  searchParams,
}: {
  searchParams: FinanceSearchParams;
}) {
  const { context, month } = await resolveFinancePage(searchParams);
  const catalogs = await listFinanceCatalogs(context);
  return (
    <FinanceCashboxes
      catalogs={catalogs}
      unit={context.congregationId}
      month={month}
      capabilities={context.capabilities}
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
