import { Suspense } from "react";
import { PageHeader } from "@/components/ui/page-header";
import { PERMISSIONS } from "@/modules/auth/constants/permissions";
import { requireAccessContext } from "@/modules/auth/services/access-context.service";
import { MemberManagement, MemberStatsCards } from "@/modules/members/components/member-management";
import type { MemberFilters, MemberListResult } from "@/modules/members/types/member.types";
import {
  getMemberCapabilities,
  getMemberFilters,
  getMemberStats,
  listMembers,
  normalizeMemberListParams,
} from "@/modules/members/services/member.service";

type Search = Promise<Record<string, string | string[] | undefined>>;
function value(input: string | string[] | undefined) { return Array.isArray(input) ? input[0] ?? "" : input ?? ""; }

async function MemberStatsContent({ promise }: { promise: ReturnType<typeof getMemberStats> }) {
  return <MemberStatsCards stats={await promise} />;
}

async function MemberListContent({
  promise,
  params,
  capabilities,
}: {
  promise: Promise<[MemberListResult, MemberFilters]>;
  params: ReturnType<typeof normalizeMemberListParams>;
  capabilities: ReturnType<typeof getMemberCapabilities>;
}) {
  const [initial, filters] = await promise;
  const resultVersion = [
    initial.page,
    initial.total,
    ...initial.items.map((item) => `${item.id}:${item.updatedAt}:${item.role ?? ""}`),
  ].join("|");
  return <MemberManagement key={resultVersion} initial={initial} params={params} filters={filters} capabilities={capabilities} />;
}

function MemberStatsLoading() {
  return <div className="app-skeleton-stats" aria-busy="true" aria-label="Carregando resumo dos membros">{Array.from({ length: 5 }, (_, index) => <span key={index} className="app-skeleton-block app-skeleton-stat" />)}</div>;
}

function MemberListLoading() {
  return <div className="app-skeleton-panel" aria-busy="true" aria-label="Carregando relação de membros"><span className="app-skeleton-block app-skeleton-toolbar" />{Array.from({ length: 6 }, (_, index) => <span key={index} className="app-skeleton-block app-skeleton-row" />)}</div>;
}

export default async function MembersPage({ searchParams }: { searchParams: Search }) {
  const context = await requireAccessContext(PERMISSIONS.membersViewBasic);
  const query = await searchParams;
  const params = normalizeMemberListParams({
    page: Number(value(query.page)), pageSize: Number(value(query.pageSize)) as 20 | 50 | 100,
    search: value(query.search), congregationId: value(query.congregation), regionId: value(query.region),
    roleId: value(query.role), status: value(query.status), memberType: value(query.type),
    importBatchId: value(query.importBatch),
    archived: value(query.archived) === "true", sort: value(query.sort) as never,
  });
  const capabilities = getMemberCapabilities(context);
  const statsPromise = getMemberStats(context);
  const listPromise = Promise.all([listMembers(context, params), getMemberFilters(context)]);

  return <>
    <PageHeader title="Membros" subtitle="Gestão completa de membros, congregados, visitantes e crianças." badge="Administração" />
    <div className="grid gap-[18px]">
      <Suspense fallback={<MemberStatsLoading />}><MemberStatsContent promise={statsPromise} /></Suspense>
      <Suspense fallback={<MemberListLoading />}><MemberListContent promise={listPromise} params={params} capabilities={capabilities} /></Suspense>
    </div>
  </>;
}
