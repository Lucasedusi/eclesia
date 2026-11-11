import { Suspense } from "react";
import { PageHeader } from "@/components/ui/page-header";
import { PageSkeleton } from "@/components/ui/page-skeleton";
import { PERMISSIONS } from "@/modules/auth/constants/permissions";
import { requireAccessContext } from "@/modules/auth/services/access-context.service";
import { DashboardBirthdays, type DashboardParams } from "@/modules/dashboard/components/dashboard-birthdays";
import { DashboardCards } from "@/modules/dashboard/components/dashboard-cards";
import { DashboardRanking } from "@/modules/dashboard/components/dashboard-ranking";
import { getDashboardSummary, type DashboardSummary } from "@/modules/dashboard/services/dashboard.service";

import "@/modules/dashboard/components/dashboard.css";

async function Dashboard({ searchParams }: { searchParams: DashboardParams }) {
  const context = await requireAccessContext(PERMISSIONS.dashboardView);
  let summary: DashboardSummary | null;
  try {
    summary = await getDashboardSummary(context);
  } catch {
    return <>
      <PageHeader title="Dashboard" subtitle={context.church.name} />
      <p role="alert">Não foi possível carregar o Dashboard. Atualize a página para tentar novamente.</p>
    </>;
  }
  if (!summary) return <>
    <PageHeader title="Dashboard" subtitle={context.church.name} />
    <p className="church-dashboard-empty">Seu perfil não possui indicadores disponíveis neste painel.</p>
  </>;
  const field = context.access.scope === "CHURCH";
  return <div className="church-dashboard">
    <PageHeader className="church-dashboard-heading" title="Dashboard" subtitle={field ? context.church.name : summary.congregationName ?? "Minha congregação"} />
    <div className="church-dashboard-grid" data-organization={summary.congregations !== null && summary.regions !== null}>
      <DashboardCards summary={summary} />
      <DashboardRanking congregations={summary.congregations} regions={summary.regions}
        roles={field ? summary.fieldRoles : summary.roles} total={summary.total} />
      <Suspense fallback={<div className="church-dashboard-panel" role="status">Carregando aniversariantes…</div>}>
        <DashboardBirthdays context={context} searchParams={searchParams}
          showCongregation={field && summary.congregations !== null} />
      </Suspense>
    </div>
  </div>;
}

export default function Home({ searchParams }: { searchParams: DashboardParams }) {
  return <Suspense fallback={<PageSkeleton variant="dashboard" label="Carregando painel" />}>
    <Dashboard searchParams={searchParams} />
  </Suspense>;
}
