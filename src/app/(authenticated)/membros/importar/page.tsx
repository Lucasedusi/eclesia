import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { AppShell } from "@/components/layout/app-shell";
import { LinkPendingIndicator } from "@/components/navigation/navigation-feedback";
import { PageHeader } from "@/components/ui/page-header";
import { PERMISSIONS } from "@/modules/auth/constants/permissions";
import { requireAccessContext } from "@/modules/auth/services/access-context.service";
import { MemberImportWorkspace } from "@/modules/members/import/components/member-import-workspace";
import { getMemberImportWorkspace } from "@/modules/members/import/services/member-import.service";

type Props = {
  searchParams: Promise<{ batch?: string }>;
};

export default async function MemberImportPage({ searchParams }: Props) {
  const context = await requireAccessContext(PERMISSIONS.membersImport);
  const { batch } = await searchParams;
  const workspace = await getMemberImportWorkspace(context, batch);

  return (
    <AppShell
      authContext={context}
      title="Importar membros"
      subtitle="Importação em lote com validação e rastreabilidade"
    >
      <PageHeader
        title="Importar membros por planilha"
        subtitle="Analise, revise e confirme até 500 membros em uma única operação segura."
        badge="Membros"
        action={(
          <Link href="/membros" className="app-button-secondary">
            <ArrowLeft size={18} aria-hidden="true" />
            Voltar para membros <LinkPendingIndicator />
          </Link>
        )}
      />
      <MemberImportWorkspace initial={workspace} />
    </AppShell>
  );
}
