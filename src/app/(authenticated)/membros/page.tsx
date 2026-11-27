import { Suspense } from "react";
import { PageHeader } from "@/components/ui/page-header";
import { PERMISSIONS } from "@/modules/auth/constants/permissions";
import { requireAccessContext } from "@/modules/auth/services/access-context.service";
import { MemberListTabs } from "@/modules/members/components/member-list-tabs";
import { MemberManagement, MemberStatsCards } from "@/modules/members/components/member-management";
import {
  getMemberCapabilities,
  getMemberFilters,
  getMemberStats,
  getMemberListData,
  normalizeMemberListParams,
} from "@/modules/members/services/member.service";

type Search = Promise<Record<string, string | string[] | undefined>>;
function value(input: string | string[] | undefined) { return Array.isArray(input) ? input[0] ?? "" : input ?? ""; }

async function MemberStatsContent({ promise }: { promise: ReturnType<typeof getMemberStats> }) {
  return <MemberStatsCards stats={await promise} />;
}

function MemberStatsLoading() {
  return <div className="app-skeleton-stats" aria-busy="true" aria-label="Carregando resumo dos membros">{Array.from({ length: 4 }, (_, index) => <span key={index} className="app-skeleton-block app-skeleton-stat" />)}</div>;
}

export default async function MembersPage({ searchParams }: { searchParams: Search }) {
  const context = await requireAccessContext(PERMISSIONS.membersViewBasic);
  const query = await searchParams;
  const params = normalizeMemberListParams({
    page: Number(value(query.page)), pageSize: Number(value(query.pageSize)) as 20 | 50 | 100,
    search: value(query.search), congregationId: value(query.congregation), regionId: value(query.region),
    roleId: value(query.role), status: query.status === undefined ? (value(query.archived) === "true" ? "" : "ACTIVE") : value(query.status), memberType: value(query.type),
    importBatchId: value(query.importBatch),
    archived: value(query.archived) === "true", sort: value(query.sort) as never,
  });
  const capabilities = getMemberCapabilities(context);
  const statsPromise = getMemberStats(context).catch(() => null);
  const list = getMemberListData(context, params);
  const filters = getMemberFilters(context).catch(() => null);

  return <>
    <PageHeader title="Membros" subtitle="Gerencie os cadastros de membros e crianças." badge="Administração" />
    <MemberListTabs active="list" />
    <div className="grid gap-[18px]">
      <Suspense fallback={<MemberStatsLoading />}><MemberStatsContent promise={statsPromise} /></Suspense>
      <MemberManagement key={context.access.id} initial={list} params={params} filters={filters} capabilities={capabilities} />
    </div>
  </>;
}
