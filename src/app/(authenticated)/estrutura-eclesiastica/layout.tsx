import { Suspense } from "react";
import { PageHeader } from "@/components/ui/page-header";
import { PERMISSIONS } from "@/modules/auth/constants/permissions";
import { requireAccessContext } from "@/modules/auth/services/access-context.service";
import { OrganizationTabs } from "@/modules/organization/components/organization-tabs";
import { OrganizationWorkspace } from "@/modules/organization/components/organization-workspace";
import { getOrganizationData } from "@/modules/organization/services/organization.service";
import LoadingEcclesiasticalStructure from "./loading";

async function EcclesiasticalStructureContent() {
  await requireAccessContext(PERMISSIONS.organizationView);
  const data = await getOrganizationData();
  return (
    <>
      <PageHeader
        title="Estrutura eclesiástica"
        subtitle="Organize a estrutura territorial da igreja por Regionais e Congregações."
        badge="Administração"
      />
      <OrganizationTabs />
      <OrganizationWorkspace data={data} />
    </>
  );
}

export default function EcclesiasticalStructureLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <>
      <Suspense fallback={<LoadingEcclesiasticalStructure />}>
        <EcclesiasticalStructureContent />
      </Suspense>
      {children}
    </>
  );
}
