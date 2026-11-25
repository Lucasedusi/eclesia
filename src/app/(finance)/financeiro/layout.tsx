import { logoutAction } from "@/modules/auth/actions/auth.actions";
import { Button } from "@/components/ui/button";
import { canManagePayables } from "@/modules/finance/utils/finance-payables";
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
  const context = await requireFinanceContext({
    permission: PERMISSIONS.financeView,
  });
  const units = await listFinanceUnits(context.auth);
  const financeOnly = context.auth.access.role === "ACCOUNTANT";
  const mobileDevice = await isFinanceMobileRequest();
  return (
    <FinanceShell
      sessionControl={
        financeOnly && (
          <form action={logoutAction}>
            <Button type="submit" variant="secondary">
              Sair
            </Button>
          </form>
        )
      }
      context={{
        name: context.auth.profile.displayName || context.auth.profile.fullName,
        churchName: context.auth.church.name,
        units,
        defaultUnitId: context.congregationId,
        defaultMonth: todayLocal().slice(0, 7),
        mobileDevice,
        financeOnly,
        canUseAccounting: context.auth.permissions.includes(
          PERMISSIONS.financeAccounting,
        ),
        canManagePayables:
          !mobileDevice &&
          (canManagePayables(context.auth) ||
            (financeOnly &&
              units.some(
                (unit) => unit.isHeadquarters && unit.capabilities?.view,
              ))),
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
