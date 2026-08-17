import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { LinkPendingIndicator } from "@/components/navigation/navigation-feedback";
import { PERMISSIONS } from "@/modules/auth/constants/permissions";
import { requireAccessContext } from "@/modules/auth/services/access-context.service";
import { MemberCreateForm } from "@/modules/members/components/member-create-form/member-create-form";
import { getMemberFormOptions } from "@/modules/members/services/member-form-options.service";
import { getMemberEditData } from "@/modules/members/services/member.service";

export default async function EditMemberPage({ params }: { params: Promise<{ memberId: string }> }) {
  const { memberId } = await params;
  const context = await requireAccessContext(PERMISSIONS.membersUpdate);
  const [options, initialData] = await Promise.all([getMemberFormOptions(context), getMemberEditData(context, memberId)]);
  if (!initialData) notFound();
  return <>
    <PageHeader title={`Editar ${initialData.full_name}`} subtitle="A versão do cadastro será verificada ao salvar para evitar sobrescritas." action={<Link href="/membros" className="app-button-secondary"><ArrowLeft size={17} /> Voltar para membros <LinkPendingIndicator /></Link>} />
    <MemberCreateForm options={options} mode="edit" initialData={initialData} />
  </>;
}
