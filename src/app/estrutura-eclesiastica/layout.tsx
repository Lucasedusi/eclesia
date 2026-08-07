import { AppShell } from "@/components/layout/app-shell";
import { PageHeader } from "@/components/ui/page-header";
import { PERMISSIONS } from "@/modules/auth/constants/permissions";
import { requireAccessContext } from "@/modules/auth/services/access-context.service";
import { OrganizationTabs } from "@/modules/organization/components/organization-tabs";

export default async function EcclesiasticalStructureLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const context = await requireAccessContext(PERMISSIONS.organizationView);
  return (
    <AppShell authContext={context} title="Estrutura eclesiástica" subtitle="Regionais e congregações">
      <PageHeader
        title="Estrutura eclesiástica"
        subtitle="Organize a estrutura territorial da igreja por Regionais e Congregações."
        badge="Administração"
      />
      <OrganizationTabs />
      {children}
    </AppShell>
  );
}
