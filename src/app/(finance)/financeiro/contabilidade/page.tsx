import { Suspense } from "react";
import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { requireAccessContext } from "@/modules/auth/services/access-context.service";
import { PERMISSIONS } from "@/modules/auth/constants/permissions";
import { financeLocation } from "@/modules/finance/utils/finance-navigation";
import { FinanceSkeleton } from "@/modules/finance/components/finance-skeleton";
import { FinanceAccounting } from "@/modules/finance/components/finance-accounting";
import {
  financePageMonth,
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
  const [search, { catalog, canConfigure }, auth] = await Promise.all([
    searchParams,
    getAccountingCatalog(),
    requireAccessContext(PERMISSIONS.financeAccounting),
  ]);
  const month = financePageMonth(search.mes);
  const range = monthRange(month);
  if (Array.isArray(search.unidade)) notFound();
  const selected =
    search.unidade ??
    catalog.units.find((u) => u.id === auth.access.congregationId)?.id ??
    catalog.units.find((u) => u.isHeadquarters)?.id ??
    catalog.units[0].id;
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
    search.historico
      ? getAccountingHistory(filters.unit, filters.box, historyPage)
      : null,
  ]);
  return (
    <FinanceAccounting
      canConfirm={auth.access.role !== "ACCOUNTANT"}
      key={JSON.stringify(filters)}
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
