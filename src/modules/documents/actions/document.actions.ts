"use server";

import { revalidatePath, updateTag } from "next/cache";
import { cacheTags } from "@/lib/cache-tags";
import { PERMISSIONS } from "@/modules/auth/constants/permissions";
import { requireAccessContext } from "@/modules/auth/services/access-context.service";
import {
  cancelDocumentReplacement,
  cancelDocumentUploads,
  changeAdministrativeDocumentState,
  changeDocumentCategoryState,
  changeDocumentFolderState,
  createAdministrativeDocumentUrl,
  createDocumentCategory,
  createDocumentFolder,
  deleteUnusedDocumentTag,
  finalizeDocumentReplacement,
  finalizeDocumentUploads,
  getDocumentWorkspace,
  listAdministrativeDocuments,
  permanentlyDeleteDocumentCategory,
  permanentlyDeleteDocumentFolder,
  permanentlyDeleteAdministrativeDocument,
  prepareDocumentReplacement,
  prepareDocumentUploads,
  toDocumentActionError,
  updateAdministrativeDocumentMetadata,
  updateDocumentCategory,
  updateDocumentFolder,
} from "../services/document.service";
import type {
  DocumentActionState,
  DocumentListResult,
  DocumentWorkspaceData,
  PreparedDocumentUpload,
  PreparedReplacement,
  UploadFinalizationResult,
} from "../types/document.types";
import {
  documentCategorySchema,
  documentContainerActionSchema,
  documentFolderSchema,
  documentIdSchema,
  documentLifecycleSchema,
  documentListParamsSchema,
  documentMetadataSchema,
  documentReplacementPrepareSchema,
  documentUploadIdsSchema,
  documentUploadPrepareSchema,
} from "../validations/document.schemas";

async function refreshDocuments() {
  const context = await requireAccessContext(PERMISSIONS.documentsView);
  updateTag(cacheTags.documentReferences(context.church.id));
  updateTag(cacheTags.documentStats(context.church.id));
  revalidatePath("/documentos");
}

export async function getDocumentWorkspaceAction(input: unknown): Promise<
  | { status: "success"; data: DocumentWorkspaceData }
  | { status: "error"; message: string }
> {
  const parsed = documentListParamsSchema.safeParse(input);
  if (!parsed.success) return { status: "error", message: "Filtros inválidos." };
  try {
    return { status: "success", data: await getDocumentWorkspace(parsed.data) };
  } catch (error) {
    return toDocumentActionError(error, "Não foi possível carregar o módulo.");
  }
}

export async function listAdministrativeDocumentsAction(input: unknown): Promise<
  | { status: "success"; data: DocumentListResult }
  | { status: "error"; message: string }
> {
  const parsed = documentListParamsSchema.safeParse(input);
  if (!parsed.success) return { status: "error", message: "Filtros inválidos." };
  try {
    return { status: "success", data: await listAdministrativeDocuments(parsed.data) };
  } catch (error) {
    return toDocumentActionError(error, "Não foi possível carregar os documentos.");
  }
}

export async function saveDocumentCategoryAction(input: unknown): Promise<DocumentActionState> {
  const parsed = documentCategorySchema.safeParse(input);
  if (!parsed.success) {
    return {
      status: "error",
      message: "Revise os dados da categoria.",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }
  try {
    if (parsed.data.id) await updateDocumentCategory({ ...parsed.data, id: parsed.data.id });
    else await createDocumentCategory(parsed.data);
    await refreshDocuments();
    return {
      status: "success",
      message: parsed.data.id ? "Categoria atualizada com sucesso." : "Categoria criada com sucesso.",
    };
  } catch (error) {
    return toDocumentActionError(error, "Não foi possível salvar a categoria.");
  }
}

export async function changeDocumentCategoryStateAction(input: unknown): Promise<DocumentActionState> {
  const parsed = documentContainerActionSchema.safeParse(input);
  if (!parsed.success) return { status: "error", message: "Categoria inválida." };
  try {
    if (parsed.data.action === "DELETE_PERMANENTLY") {
      await permanentlyDeleteDocumentCategory(parsed.data.id);
    } else {
      await changeDocumentCategoryState(parsed.data.id, parsed.data.action);
    }
    await refreshDocuments();
    const labels = {
      ARCHIVE: "Categoria arquivada com sucesso.",
      RESTORE: "Categoria restaurada com sucesso.",
      DELETE: "Categoria enviada para a lixeira.",
      RESTORE_DELETED: "Categoria recuperada com sucesso.",
      DELETE_PERMANENTLY: "Categoria excluída definitivamente.",
    };
    return { status: "success", message: labels[parsed.data.action] };
  } catch (error) {
    return toDocumentActionError(error, "Não foi possível alterar a categoria.");
  }
}

export async function saveDocumentFolderAction(input: unknown): Promise<DocumentActionState> {
  const parsed = documentFolderSchema.safeParse(input);
  if (!parsed.success) {
    return {
      status: "error",
      message: "Revise os dados da pasta.",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }
  try {
    if (parsed.data.id) await updateDocumentFolder({ ...parsed.data, id: parsed.data.id });
    else await createDocumentFolder(parsed.data);
    await refreshDocuments();
    return {
      status: "success",
      message: parsed.data.id ? "Pasta atualizada com sucesso." : "Pasta criada com sucesso.",
    };
  } catch (error) {
    return toDocumentActionError(error, "Não foi possível salvar a pasta.");
  }
}

export async function changeDocumentFolderStateAction(input: unknown): Promise<DocumentActionState> {
  const parsed = documentContainerActionSchema.safeParse(input);
  if (!parsed.success) return { status: "error", message: "Pasta inválida." };
  try {
    if (parsed.data.action === "DELETE_PERMANENTLY") {
      await permanentlyDeleteDocumentFolder(parsed.data.id);
    } else {
      await changeDocumentFolderState(parsed.data.id, parsed.data.action);
    }
    await refreshDocuments();
    const labels = {
      ARCHIVE: "Pasta arquivada com sucesso.",
      RESTORE: "Pasta restaurada com sucesso.",
      DELETE: "Pasta enviada para a lixeira.",
      RESTORE_DELETED: "Pasta recuperada com sucesso.",
      DELETE_PERMANENTLY: "Pasta excluída definitivamente.",
    };
    return { status: "success", message: labels[parsed.data.action] };
  } catch (error) {
    return toDocumentActionError(error, "Não foi possível alterar a pasta.");
  }
}

export async function deleteUnusedDocumentTagAction(id: string): Promise<DocumentActionState> {
  const parsed = documentIdSchema.safeParse(id);
  if (!parsed.success) return { status: "error", message: "Tag inválida." };
  try {
    await deleteUnusedDocumentTag(parsed.data);
    await refreshDocuments();
    return { status: "success", message: "Tag excluída com sucesso." };
  } catch (error) {
    return toDocumentActionError(error, "Não foi possível excluir a tag.");
  }
}

export async function prepareDocumentUploadsAction(input: unknown): Promise<
  | { status: "success"; files: PreparedDocumentUpload[] }
  | { status: "error"; message: string; fieldErrors?: Record<string, string[]> }
> {
  const parsed = documentUploadPrepareSchema.safeParse(input);
  if (!parsed.success) {
    return {
      status: "error",
      message: parsed.error.issues[0]?.message ?? "Revise os arquivos selecionados.",
      fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]>,
    };
  }
  try {
    return { status: "success", files: await prepareDocumentUploads(parsed.data) };
  } catch (error) {
    return toDocumentActionError(error, "Não foi possível preparar os arquivos.");
  }
}

export async function finalizeDocumentUploadsAction(ids: unknown): Promise<
  | { status: "success"; files: UploadFinalizationResult[] }
  | { status: "error"; message: string }
> {
  const parsed = documentUploadIdsSchema.safeParse(ids);
  if (!parsed.success) return { status: "error", message: "Arquivos inválidos." };
  try {
    const files = await finalizeDocumentUploads(parsed.data);
    await refreshDocuments();
    return { status: "success", files };
  } catch (error) {
    return toDocumentActionError(error, "Não foi possível confirmar os arquivos.");
  }
}

export async function cancelDocumentUploadsAction(ids: unknown) {
  const parsed = documentUploadIdsSchema.safeParse(ids);
  if (!parsed.success) return;
  await cancelDocumentUploads(parsed.data);
}

export async function updateAdministrativeDocumentMetadataAction(input: unknown): Promise<DocumentActionState> {
  const parsed = documentMetadataSchema.safeParse(input);
  if (!parsed.success) {
    return {
      status: "error",
      message: "Revise os dados do documento.",
      fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]>,
    };
  }
  try {
    await updateAdministrativeDocumentMetadata(parsed.data);
    await refreshDocuments();
    return { status: "success", message: "Documento atualizado com sucesso." };
  } catch (error) {
    return toDocumentActionError(error, "Não foi possível atualizar o documento.");
  }
}

export async function prepareDocumentReplacementAction(input: unknown): Promise<PreparedReplacement> {
  const parsed = documentReplacementPrepareSchema.safeParse(input);
  if (!parsed.success) {
    return {
      status: "error",
      message: parsed.error.issues[0]?.message ?? "Arquivo inválido.",
    };
  }
  try {
    return await prepareDocumentReplacement(parsed.data);
  } catch (error) {
    return toDocumentActionError(error, "Não foi possível preparar a substituição.");
  }
}

export async function finalizeDocumentReplacementAction(id: string): Promise<DocumentActionState> {
  const parsed = documentIdSchema.safeParse(id);
  if (!parsed.success) return { status: "error", message: "Documento inválido." };
  try {
    await finalizeDocumentReplacement(parsed.data);
    await refreshDocuments();
    return { status: "success", message: "Arquivo substituído com sucesso." };
  } catch (error) {
    return toDocumentActionError(error, "Não foi possível substituir o arquivo.");
  }
}

export async function cancelDocumentReplacementAction(id: string) {
  const parsed = documentIdSchema.safeParse(id);
  if (!parsed.success) return;
  await cancelDocumentReplacement(parsed.data);
}

export async function createAdministrativeDocumentUrlAction(input: {
  id: string;
  download: boolean;
}): Promise<{ status: "success"; url: string } | { status: "error"; message: string }> {
  const parsed = documentIdSchema.safeParse(input.id);
  if (!parsed.success) return { status: "error", message: "Documento inválido." };
  try {
    return {
      status: "success",
      url: await createAdministrativeDocumentUrl(parsed.data, Boolean(input.download)),
    };
  } catch (error) {
    return toDocumentActionError(error, "Não foi possível abrir o documento.");
  }
}

export async function changeAdministrativeDocumentStateAction(input: unknown): Promise<DocumentActionState> {
  const parsed = documentLifecycleSchema.safeParse(input);
  if (!parsed.success) return { status: "error", message: "Ação inválida." };
  try {
    if (parsed.data.action === "DELETE_PERMANENTLY") {
      await permanentlyDeleteAdministrativeDocument(parsed.data.id);
    } else {
      await changeAdministrativeDocumentState(parsed.data.id, parsed.data.action);
    }
    await refreshDocuments();
    const labels = {
      ARCHIVE: "Documento arquivado com sucesso.",
      RESTORE: "Documento restaurado com sucesso.",
      TRASH: "Documento enviado para a lixeira.",
      RESTORE_TRASH: "Documento recuperado da lixeira.",
      DELETE_PERMANENTLY: "Documento excluído definitivamente.",
    };
    return { status: "success", message: labels[parsed.data.action] };
  } catch (error) {
    return toDocumentActionError(error, "Não foi possível concluir a ação.");
  }
}
