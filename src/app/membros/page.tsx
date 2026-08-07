import Link from "next/link";
import { BadgeCheck, Plus } from "lucide-react";
import { AppShell } from "@/components/layout/app-shell";
import { PageHeader } from "@/components/ui/page-header";
import { PERMISSIONS } from "@/modules/auth/constants/permissions";
import { requireAccessContext } from "@/modules/auth/services/access-context.service";
import { MemberManagement } from "@/modules/members/components/member-management";
import {
  getMemberCapabilities,
  getMemberFilters,
  getMemberStats,
  listMembers,
  normalizeMemberListParams,
} from "@/modules/members/services/member.service";

type Search = Promise<Record<string, string | string[] | undefined>>;
function value(input: string | string[] | undefined) { return Array.isArray(input) ? input[0] ?? "" : input ?? ""; }

export default async function MembersPage({ searchParams }: { searchParams: Search }) {
  const context = await requireAccessContext(PERMISSIONS.membersViewBasic);
  const query = await searchParams;
  const params = normalizeMemberListParams({
    page: Number(value(query.page)), pageSize: Number(value(query.pageSize)) as 20 | 50 | 100,
    search: value(query.search), congregationId: value(query.congregation), regionId: value(query.region),
    roleId: value(query.role), status: value(query.status), memberType: value(query.type),
    archived: value(query.archived) === "true", sort: value(query.sort) as never,
  });
  const [initial, stats, filters] = await Promise.all([
    listMembers(context, params), getMemberStats(context), getMemberFilters(context),
  ]);
  const capabilities = getMemberCapabilities(context);

  return <AppShell authContext={context} title="Membros" subtitle="Cadastros, vínculos e histórico eclesiástico">
    <PageHeader title="Membros" subtitle="Gestão completa de membros, congregados, visitantes e crianças." badge="Administração" action={<div className="flex flex-wrap gap-2"><Link href="/membros/cargos" className="app-button-secondary"><BadgeCheck size={17} /> Cargos</Link>{capabilities.create && <Link href="/membros/novo" className="app-button-primary"><Plus size={17} /> Novo membro</Link>}</div>} />
    <MemberManagement initial={initial} params={params} stats={stats} filters={filters} capabilities={capabilities} />
  </AppShell>;
}
