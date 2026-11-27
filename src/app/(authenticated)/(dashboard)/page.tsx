import { Suspense } from "react";
import { PERMISSIONS } from "@/modules/auth/constants/permissions";
import { requireAccessContext } from "@/modules/auth/services/access-context.service";
import { DashboardBirthdays, type DashboardParams } from "@/modules/dashboard/components/dashboard-birthdays";
import { getDashboardBirthdayContext } from "@/modules/dashboard/services/dashboard.service";

async function BirthdayContent({ searchParams }: { searchParams: DashboardParams }) {
  const context = await requireAccessContext(PERMISSIONS.dashboardView);
  let authorized;
  try {
    authorized = await getDashboardBirthdayContext(context);
  } catch {
    return <p role="alert" className="church-dashboard-empty">Não foi possível carregar os aniversariantes.</p>;
  }
  if (!authorized) return null;
  return <DashboardBirthdays context={authorized} searchParams={searchParams} />;
}

export default function DashboardPage({ searchParams }: { searchParams: DashboardParams }) {
  return <Suspense fallback={<div className="church-dashboard-panel" role="status">Carregando aniversariantes…</div>}>
    <BirthdayContent searchParams={searchParams} />
  </Suspense>;
}
