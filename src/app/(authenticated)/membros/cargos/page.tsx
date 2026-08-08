import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { AppShell } from "@/components/layout/app-shell";
import { PageHeader } from "@/components/ui/page-header";
import { LinkPendingIndicator } from "@/components/navigation/navigation-feedback";
import { PERMISSIONS } from "@/modules/auth/constants/permissions";
import { requireAccessContext } from "@/modules/auth/services/access-context.service";
import { OrganizationPage } from "@/modules/organization/components/organization-page";

export default async function MemberRolesPage() {
  const context = await requireAccessContext(PERMISSIONS.organizationView);
  return <AppShell authContext={context} title="Cargos" subtitle="Catálogo eclesiástico utilizado pelos membros">
    <PageHeader title="Cargos" subtitle="Cadastre e organize as nomenclaturas atribuídas aos membros. Cargos não concedem acesso ao sistema." badge="Membros" action={<Link href="/membros" className="app-button-secondary"><ArrowLeft size={17} /> Voltar para membros <LinkPendingIndicator /></Link>} />
    <OrganizationPage tab="positions" />
  </AppShell>;
}
