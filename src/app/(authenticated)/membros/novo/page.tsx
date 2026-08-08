import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { AppShell } from "@/components/layout/app-shell";
import { PageHeader } from "@/components/ui/page-header";
import { LinkPendingIndicator } from "@/components/navigation/navigation-feedback";
import { MemberCreateForm } from "@/modules/members/components/member-create-form/member-create-form";
import { getMemberFormOptions } from "@/modules/members/services/member-form-options.service";
import { requireAccessContext } from "@/modules/auth/services/access-context.service";
import { PERMISSIONS } from "@/modules/auth/constants/permissions";

export default async function NewMemberPage() {
  const context = await requireAccessContext(PERMISSIONS.membersCreate);
  const options = await getMemberFormOptions(context);

  return (
    <AppShell
      authContext={context}
      title="Novo membro"
      subtitle="Cadastro multifases do módulo de Membros"
    >
      <PageHeader
        title="Cadastrar Membro"
        subtitle="Preencha a ficha por etapas sem perder os dados ao avançar ou voltar."
        action={
          <Link href="/membros" className="app-button-secondary">
            <ArrowLeft size={18} aria-hidden="true" />
            Voltar para membros <LinkPendingIndicator />
          </Link>
        }
      />

      <MemberCreateForm options={options} />
    </AppShell>
  );
}
