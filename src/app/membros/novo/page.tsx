import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { AppShell } from "@/components/layout/app-shell";
import { PageHeader } from "@/components/ui/page-header";
import { MemberCreateForm } from "@/modules/members/components/member-create-form/member-create-form";
import { getMemberFormOptions } from "@/modules/members/services/member-form-options.service";

export default async function NewMemberPage() {
  const options = await getMemberFormOptions();

  return (
    <AppShell
      title="Novo membro"
      subtitle="Cadastro multi etapas do módulo de membros"
    >
      <PageHeader
        title="Cadastrar Membro"
        subtitle="Preencha as informações por etapas."
        action={
          <Link href="/membros" className="app-button-secondary">
            <ArrowLeft size={18} aria-hidden="true" />
            Voltar para membros
          </Link>
        }
      />

      <MemberCreateForm options={options} />
    </AppShell>
  );
}
