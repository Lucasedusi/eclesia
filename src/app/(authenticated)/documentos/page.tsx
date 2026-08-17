import { Suspense } from "react";
import { redirect } from "next/navigation";
import { PERMISSIONS } from "@/modules/auth/constants/permissions";
import { requireAccessContext } from "@/modules/auth/services/access-context.service";
import { DocumentManagement } from "@/modules/documents/components/document-management";
import {
  getDocumentWorkspaceCore,
  getDocumentWorkspaceStats,
} from "@/modules/documents/services/document.service";
import {
  DEFAULT_DOCUMENT_LIST_PARAMS,
  type DocumentListParams,
} from "@/modules/documents/types/document.types";
import { documentListParamsSchema } from "@/modules/documents/validations/document.schemas";
import LoadingDocuments from "./loading";

type Search = Promise<Record<string, string | string[] | undefined>>;

function value(input: string | string[] | undefined) {
  return Array.isArray(input) ? input[0] ?? "" : input ?? "";
}

function normalizeParams(query: Record<string, string | string[] | undefined>): DocumentListParams {
  const parsed = documentListParamsSchema.safeParse({
    search: value(query.search),
    categoryId: value(query.category),
    folderId: value(query.folder),
    tagId: value(query.tag),
    format: value(query.format),
    state: value(query.state).toUpperCase() || "ACTIVE",
    dateFrom: value(query.from),
    dateTo: value(query.to),
    uploadedBy: value(query.uploader),
    sort: value(query.sort).toUpperCase() || "RECENT",
    page: Number(value(query.page)) || 1,
    pageSize: Number(value(query.pageSize)) || 20,
  });
  return parsed.success ? parsed.data : DEFAULT_DOCUMENT_LIST_PARAMS;
}

async function DocumentsContent({
  corePromise,
  statsPromise,
}: {
  corePromise: ReturnType<typeof getDocumentWorkspaceCore>;
  statsPromise: ReturnType<typeof getDocumentWorkspaceStats>;
}) {
  const core = await corePromise;
  return <DocumentManagement initial={{
    ...core,
    stats: { active: 0, archived: 0, deleted: 0, categories: 0, folders: 0 },
  }} initialStats={statsPromise} />;
}

export default async function DocumentsPage({ searchParams }: { searchParams: Search }) {
  const context = await requireAccessContext(PERMISSIONS.documentsView);
  if (context.access.role !== "ADMIN" || context.access.scope !== "CHURCH") {
    redirect("/acesso-negado");
  }
  const params = normalizeParams(await searchParams);
  const corePromise = getDocumentWorkspaceCore(params);
  const statsPromise = getDocumentWorkspaceStats();

  return (
    <Suspense fallback={<LoadingDocuments />}>
      <DocumentsContent corePromise={corePromise} statsPromise={statsPromise} />
    </Suspense>
  );
}
