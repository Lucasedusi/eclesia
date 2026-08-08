import { Suspense } from "react";
import { AppShell } from "@/components/layout/app-shell";
import { AuthenticatedShellSkeleton } from "@/components/ui/page-skeleton";
import { requireAccessContext } from "@/modules/auth/services/access-context.service";

async function AuthenticatedShell({ children }: { children: React.ReactNode }) {
  const context = await requireAccessContext();
  return <AppShell authContext={context}>{children}</AppShell>;
}

export default function AuthenticatedLayout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={<AuthenticatedShellSkeleton />}>
      <AuthenticatedShell>{children}</AuthenticatedShell>
    </Suspense>
  );
}
