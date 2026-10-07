import { FinanceSkeleton } from "@/modules/finance/components/finance-skeleton";
import { Suspense } from "react";
import {
  resolveFinancePage,
  type FinanceSearchParams,
} from "@/modules/finance/services/finance-page.service";
import { getFinanceReceipt } from "@/modules/finance/services/finance-receipt.service";
import { FinanceReceipt } from "@/modules/finance/components/finance-receipt";
async function Content({
  searchParams,
  params,
}: {
  searchParams: FinanceSearchParams;
  params: Promise<{ receiptId: string }>;
}) {
  const { context, search } = await resolveFinancePage(searchParams),
    { receiptId } = await params;
  const receipt = await getFinanceReceipt(context, receiptId);
  return (
    <FinanceReceipt
      receipt={receipt}
      unit={context.congregationId}
      autoPrint={search.imprimir === "1"}
    />
  );
}
export default function Page(props: {
  searchParams: FinanceSearchParams;
  params: Promise<{ receiptId: string }>;
}) {
  return (
    <Suspense fallback={<FinanceSkeleton />}>
      <Content {...props} />
    </Suspense>
  );
}
