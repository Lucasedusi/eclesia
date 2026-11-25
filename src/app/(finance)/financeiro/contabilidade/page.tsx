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
import { getAccountingCatalog } from "@/modules/finance/services/finance-accounting.service";
import { todayLocal } from "@/modules/finance/utils/finance-period";

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
  const box = catalog.boxes.find((item) => item.id === search.caixa);
  if (search.caixa && !box) notFound();
  return (
    <FinanceAccounting
      key={JSON.stringify([selected, month, box?.id])}
      currentMonth={todayLocal().slice(0, 7)}
      initialBox={box?.id ?? null}
      catalog={catalog}
      canConfigure={canConfigure}
      canConfirm={auth.access.role !== "ACCOUNTANT"}
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
