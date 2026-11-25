import { PERMISSIONS } from "@/modules/auth/constants/permissions";
import { listFinanceDeliveryRules } from "@/modules/finance/services/finance-administrative.service";
import { FinanceSkeleton } from "@/modules/finance/components/finance-skeleton";
import { isFinanceMobileRequest } from "@/modules/finance/utils/finance-mobile-request";
import { FinanceDesktopAccess } from "@/modules/finance/components/finance-desktop-access";
import { Suspense } from "react";
import { createClient } from "@/lib/supabase/server";
import {
  resolveFinancePage,
  type FinanceSearchParams,
} from "@/modules/finance/services/finance-page.service";
import { listFinanceCatalogs } from "@/modules/finance/services/finance-catalog.service";
import { listFinanceUnits } from "@/modules/finance/services/finance-access.service";
import {
  listStatementRules,
  latestStatementMonth,
} from "@/modules/finance/services/finance-statement.service";
import { FinanceSettings } from "@/modules/finance/components/finance-settings";
import { todayLocal } from "@/modules/finance/utils/finance-period";
async function Content({
  searchParams,
}: {
  searchParams: FinanceSearchParams;
}) {
  const { context, month, search } = await resolveFinancePage(searchParams, true);
  const access = { title: "Configurações financeiras", message: "Acesse pelo computador para alterar as configurações financeiras." };
  if (await isFinanceMobileRequest()) return <FinanceDesktopAccess {...access} mobileDevice />;
  const client = await createClient();
  const [catalogs, rules, units, roles, latestMonth, deliveryRules] =
    await Promise.all([
      listFinanceCatalogs(context),
      listStatementRules(context),
      listFinanceUnits(context.auth),
      client
        .from("roles")
        .select("id,name")
        .eq("church_id", context.churchId)
        .is("deleted_at", null)
        .eq("status", "ACTIVE")
        .order("name"),
      latestStatementMonth(context),
      listFinanceDeliveryRules(context),
    ]);
  if (roles.error) throw new Error("UNAVAILABLE");
  return (
    <FinanceDesktopAccess {...access}>
      <FinanceSettings
        canConfigureAccounting={context.auth.access.role === "ADMIN" && context.auth.access.scope === "CHURCH" && context.auth.permissions.includes(PERMISSIONS.financeAccounting) && context.auth.permissions.includes(PERMISSIONS.financeView)}
        initialArea={search.area === "entregas" ? "DELIVERY" : undefined}
        deliveryRules={deliveryRules}
        latestStatementMonth={latestMonth}
        currentMonth={todayLocal().slice(0, 7)}
        catalogs={catalogs}
        unit={context.congregationId}
        month={month}
        roles={roles.data ?? []}
        rules={rules}
        units={units}
      />
    </FinanceDesktopAccess>
  );
}
export default function Page(props: { searchParams: FinanceSearchParams }) {
  return (
    <Suspense fallback={<FinanceSkeleton />}>
      <Content {...props} />
    </Suspense>
  );
}
