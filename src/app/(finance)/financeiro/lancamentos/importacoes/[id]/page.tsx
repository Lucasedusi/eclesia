import { Suspense } from "react";
import { notFound } from "next/navigation";
import { z } from "zod";
import { resolveFinancePage, type FinanceSearchParams } from "@/modules/finance/services/finance-page.service";
import { listFinanceCatalogs } from "@/modules/finance/services/finance-catalog.service";
import { FinanceSkeleton } from "@/modules/finance/components/finance-skeleton";
import { getBankImport } from "@/modules/finance/import/service";
import { bankImportFiltersSchema } from "@/modules/finance/import/schemas";
import { BankImportWorkspace } from "@/modules/finance/import/bank-import-workspace";
type Props = { params: Promise<{ id: string }>; searchParams: FinanceSearchParams };
async function Content({ params, searchParams }: Props) {
  const { context, month, search } = await resolveFinancePage(searchParams);
  const parsedId = z.uuid().safeParse((await params).id);
  if (!context.capabilities.create || !parsedId.success) notFound();
  const parsedFilters = bankImportFiltersSchema.safeParse(Object.fromEntries(Object.entries(search).filter(([key]) => key in bankImportFiltersSchema.shape)));
  const filters = parsedFilters.success ? parsedFilters.data : bankImportFiltersSchema.parse({});
  const [catalogs, workspace] = await Promise.all([listFinanceCatalogs(context), getBankImport(context, parsedId.data, filters).catch((error: unknown) => {
    if (error instanceof Error && error.message === "FORBIDDEN") notFound();
    throw error;
  })]);
  return <BankImportWorkspace key={`${context.congregationId}-${parsedId.data}`} unit={context.congregationId} month={month} catalogs={catalogs} workspace={workspace} filters={filters} capabilities={context.capabilities} />;
}
export default function Page(props: Props) { return <Suspense fallback={<FinanceSkeleton />}><Content {...props} /></Suspense>; }
