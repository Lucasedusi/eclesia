import { Suspense } from "react";
import { notFound } from "next/navigation";
import { z } from "zod";
import { resolveFinancePage, type FinanceSearchParams } from "@/modules/finance/services/finance-page.service";
import { listFinanceCatalogs } from "@/modules/finance/services/finance-catalog.service";
import { FinanceSkeleton } from "@/modules/finance/components/finance-skeleton";
import { listBankImports } from "@/modules/finance/import/service";
import { BankImportList } from "@/modules/finance/import/bank-import-list";
async function Content({ searchParams }: { searchParams: FinanceSearchParams }) {
  const { context, month, search } = await resolveFinancePage(searchParams);
  if (!context.capabilities.create) notFound();
  const page = z.coerce.number().int().min(1).max(10000).catch(1).parse(search.pagina);
  const [catalogs, history] = await Promise.all([listFinanceCatalogs(context), listBankImports(context, undefined, page)]);
  return <BankImportList key={context.congregationId} unit={context.congregationId} month={month} catalogs={catalogs} history={history} />;
}
export default function Page(props: { searchParams: FinanceSearchParams }) {
  return <Suspense fallback={<FinanceSkeleton />}><Content {...props} /></Suspense>;
}
