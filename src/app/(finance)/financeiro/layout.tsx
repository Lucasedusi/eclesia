import { logoutAction } from "@/modules/auth/actions/auth.actions";
import { Button } from "@/components/ui/button";
import { canManagePayables } from "@/modules/finance/utils/finance-payables";
import { resolveAccessContext } from "@/modules/auth/services/access-context.service";
import { getAccountingCatalog } from "@/modules/finance/services/finance-accounting.service";
import { Suspense } from "react";
import { isFinanceMobileRequest } from "@/modules/finance/utils/finance-mobile-request";
import type { Metadata, Viewport } from "next";
import {
  requireFinanceContext,
  listFinanceUnits,
} from "@/modules/finance/services/finance-access.service";
import { PERMISSIONS } from "@/modules/auth/constants/permissions";
import { FinanceShell } from "@/modules/finance/components/finance-shell";
import { todayLocal } from "@/modules/finance/utils/finance-period";
import Loading from "./loading";
export const metadata: Metadata = {
  title: "Financeiro | Eclesias",
  manifest: "/financeiro.webmanifest",
  icons: {
    icon: "/financeiro-icon-192.png",
    apple: "/financeiro-apple-icon.png",
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Financeiro",
  },
};
export const viewport: Viewport = { themeColor: "#0B3D32" };
async function AuthenticatedFinance({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await resolveAccessContext();
  if (
    session.status === "ready" &&
    session.context.access.role === "ACCOUNTANT"
  ) {
    const { catalog } = await getAccountingCatalog();
    const { profile, church, access } = session.context;
    const units = catalog.units.map((u) => ({
      ...u,
      isHeadquarters: Boolean(u.isHeadquarters),
    }));
    const selected =
      units.find((u) => u.id === access.congregationId) ?? units[0];
    return (
      <FinanceShell
        sessionControl={
          <form action={logoutAction}>
            <Button type="submit" variant="secondary">
              Sair
            </Button>
          </form>
        }
        context={{
          name: profile.displayName || profile.fullName,
          churchName: church.name,
          units,
          defaultUnitId: selected.id,
          defaultMonth: todayLocal().slice(0, 7),
          accountingOnly: true,
          canUseAccounting: true,
        }}
      >
        {children}
      </FinanceShell>
    );
  }
  const context = await requireFinanceContext({
    permission: PERMISSIONS.financeView,
  });
  const units = await listFinanceUnits(context.auth);
  const mobileDevice = await isFinanceMobileRequest();
  return (
    <FinanceShell
      context={{
        name: context.auth.profile.displayName || context.auth.profile.fullName,
        churchName: context.auth.church.name,
        units,
        defaultUnitId: context.congregationId,
        defaultMonth: todayLocal().slice(0, 7),
        mobileDevice,
        canUseAccounting: context.auth.permissions.includes(
          PERMISSIONS.financeAccounting,
        ),
        canManagePayables: !mobileDevice && canManagePayables(context.auth),
      }}
    >
      {children}
    </FinanceShell>
  );
}
export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={<Loading />}>
      <AuthenticatedFinance>{children}</AuthenticatedFinance>
    </Suspense>
  );
}
