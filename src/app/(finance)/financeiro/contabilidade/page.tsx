import { Suspense } from "react";
import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { financeLocation } from "@/modules/finance/utils/finance-navigation";
import { FinanceSkeleton } from "@/modules/finance/components/finance-skeleton";
import { FinanceAccounting } from "@/modules/finance/components/finance-accounting";
import {
  resolveFinancePage,
  type FinanceSearchParams,
} from "@/modules/finance/services/finance-page.service";
import {
  getAccountingCatalog,
  getAccountingPreview,
  getAccountingHistory,
} from "@/modules/finance/services/finance-accounting.service";
import { accountingFilters } from "@/modules/finance/validations/finance-accounting.schemas";
import {
  monthRange,
  shiftCivilDate,
} from "@/modules/finance/utils/finance-period";

function pageNumber(value: unknown) {
  return typeof value === "string" && /^[1-9]\d{0,8}$/.test(value)
    ? Number(value)
    : 1;
}
async function AccountingPage({
  searchParams,
}: {
  searchParams: FinanceSearchParams;
}) {
  const [{ context, month, search }, { catalog, canConfigure }] =
    await Promise.all([
      resolveFinancePage(searchParams),
      getAccountingCatalog(),
    ]);
  const range = monthRange(month);
  const selected = context.congregationId;
  if (!catalog.units.some((unit) => unit.id === selected)) {
    const first = catalog.units[0];
    const href = financeLocation("/financeiro/contabilidade", first.id, month);
    if (!search.unidade) redirect(href);
    return (
      <section className="card stack">
        <h1>Contabilidade</h1>
        <p>Seu acesso à Contabilidade não inclui a congregação selecionada.</p>
        <Link href={href}>Consultar {first.name}</Link>
      </section>
    );
  }
  const parsed = accountingFilters.safeParse({
    unit: search.escopo === "todas" ? null : selected,
    box: search.caixa || null,
    start: search.inicio ?? range.start,
    end: search.fim ?? shiftCivilDate(range.end, -1),
    direction: search.movimento ?? "ALL",
  });
  if (
    !parsed.success ||
    (parsed.data.box &&
      !catalog.boxes.some(
        (b) =>
          b.id === parsed.data.box &&
          (!parsed.data.unit || b.unit === parsed.data.unit),
      ))
  )
    notFound();
  const filters = parsed.data;
  const historyPage = pageNumber(search.historico);
  const [preview, history] = await Promise.all([
    getAccountingPreview(filters, pageNumber(search.pagina)),
    getAccountingHistory(filters.unit, filters.box, historyPage),
  ]);
  return (
    <FinanceAccounting
      key={JSON.stringify([filters, preview.page, historyPage])}
      {...{
        filters,
        preview,
        history,
        historyPage,
        catalog,
        canConfigure,
        month,
        selected,
      }}
    />
  );
}
export default function Page(props: { searchParams: FinanceSearchParams }) {
  return (
    <Suspense fallback={<FinanceSkeleton />}>
      <AccountingPage {...props} />
    </Suspense>
  );
}
