import "server-only";

import { Buffer } from "node:buffer";
import { randomUUID } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { PERMISSIONS } from "@/modules/auth/constants/permissions";
import { requireAccessContext } from "@/modules/auth/services/access-context.service";
import {
  ADMINISTRATIVE_DOCUMENT_BUCKET,
  ADMINISTRATIVE_DOCUMENT_MAX_SIZE,
  ADMINISTRATIVE_DOCUMENT_MIME_TYPES,
  ADMINISTRATIVE_DOCUMENT_PENDING_TTL_MS,
} from "../constants/documents";
import type {
  AdministrativeDocumentItem,
  DocumentActionState,
  DocumentCategoryItem,
  DocumentContainerStatus,
  DocumentFolderItem,
  DocumentListParams,
  DocumentListResult,
  DocumentStats,
  DocumentTagItem,
  DocumentUploaderItem,
  DocumentWorkspaceData,
  PreparedDocumentUpload,
  PreparedReplacement,
  UploadFinalizationResult,
} from "../types/document.types";

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;
type DocumentAccess = Awaited<ReturnType<typeof requireDocumentAccess>>;

type FileCandidate = {
  originalFileName: string;
  extension: keyof typeof ADMINISTRATIVE_DOCUMENT_MIME_TYPES;
  mimeType: string;
  size: number;
};

type DocumentRow = {
  id: string;
  church_id: string;
  folder_id: string;
  title: string;
  description: string | null;
  document_date: string | null;
  reference_number: string | null;
  physical_location: string | null;
  notes: string | null;
  original_file_name: string;
  storage_bucket: string;
  storage_path: string;
  mime_type: string;
  file_extension: string;
  file_size: number;
  upload_status: "PENDING" | "ACTIVE";
  status: DocumentContainerStatus;
  uploaded_by: string;
  uploaded_at: string;
  updated_at: string;
  deleted_at: string | null;
  pending_storage_path: string | null;
  pending_original_file_name: string | null;
  pending_mime_type: string | null;
  pending_file_extension: string | null;
  pending_file_size: number | null;
  pending_started_at: string | null;
  pending_by: string | null;
};

const DOCUMENT_SELECT = [
  "id",
  "church_id",
  "folder_id",
  "title",
  "description",
  "document_date",
  "reference_number",
  "physical_location",
  "notes",
  "original_file_name",
  "storage_bucket",
  "storage_path",
  "mime_type",
  "file_extension",
  "file_size",
  "upload_status",
  "status",
  "uploaded_by",
  "uploaded_at",
  "updated_at",
  "deleted_at",
  "pending_storage_path",
  "pending_original_file_name",
  "pending_mime_type",
  "pending_file_extension",
  "pending_file_size",
  "pending_started_at",
  "pending_by",
].join(", ");

export class DocumentServiceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DocumentServiceError";
  }
}

function logServiceError(
  operation: string,
  error: { code?: string; message?: string } | unknown,
) {
  const detail = error && typeof error === "object"
    ? {
        code: "code" in error ? String(error.code ?? "") : undefined,
        message: "message" in error ? String(error.message ?? "") : undefined,
      }
    : { message: String(error) };
  console.error(`[administrative-documents] ${operation} failed`, detail);
}

function translateDatabaseError(error: { code?: string; message?: string }, fallback: string) {
  if (error.code === "23505") {
    return new DocumentServiceError(
      "Já existe um registro ativo com esse nome neste local.",
    );
  }
  if (error.message?.includes("possui pastas vinculadas")) {
    return new DocumentServiceError(
      "A categoria não pode ser excluída porque possui pastas vinculadas.",
    );
  }
  if (error.message?.includes("possui documentos vinculados")) {
    return new DocumentServiceError(
      "A pasta não pode ser excluída porque possui documentos vinculados.",
    );
  }
  return new DocumentServiceError(fallback);
}

async function requireDocumentAccess(manage = false) {
  const permission = manage ? PERMISSIONS.documentsManage : PERMISSIONS.documentsView;
  const context = await requireAccessContext(permission);
  const strictlyAuthorized =
    context.access.role === "ADMIN" &&
    context.access.scope === "CHURCH" &&
    context.access.status === "ACTIVE" &&
    context.permissions.includes(permission);

  if (!strictlyAuthorized) {
    throw new DocumentServiceError(
      "O módulo de Documentos é exclusivo do Administrador da Igreja.",
    );
  }

  return { context, supabase: await createClient() };
}

function cleanOriginalFileName(value: string) {
  const baseName = value.replace(/\\/g, "/").split("/").pop() ?? "";
  return baseName.replace(/[\u0000-\u001f\u007f]/g, "").trim().slice(0, 255);
}

function validateUploadCandidate(originalName: string, size: number): FileCandidate {
  if (!Number.isSafeInteger(size) || size <= 0) {
    throw new DocumentServiceError("Selecione um arquivo válido.");
  }
  if (size > ADMINISTRATIVE_DOCUMENT_MAX_SIZE) {
    throw new DocumentServiceError("Cada arquivo deve ter no máximo 10 MB.");
  }

  const originalFileName = cleanOriginalFileName(originalName);
  const extension = originalFileName.split(".").pop()?.toLowerCase() as
    | keyof typeof ADMINISTRATIVE_DOCUMENT_MIME_TYPES
    | undefined;
  const mimeType = extension ? ADMINISTRATIVE_DOCUMENT_MIME_TYPES[extension] : undefined;
  if (!originalFileName || !extension || !mimeType) {
    throw new DocumentServiceError(
      "Formato não permitido. Envie PDF, JPG, PNG, WEBP, DOC, DOCX, XLS ou XLSX.",
    );
  }
  return { originalFileName, extension, mimeType, size };
}

function startsWith(buffer: Buffer, signature: number[]) {
  return signature.every((value, index) => buffer[index] === value);
}

function isZipWithEntry(buffer: Buffer, entry: string) {
  return startsWith(buffer, [0x50, 0x4b, 0x03, 0x04]) && buffer.includes(Buffer.from(entry));
}

function validateFileContent(buffer: Buffer, candidate: FileCandidate) {
  let valid = false;
  switch (candidate.extension) {
    case "pdf":
      valid = startsWith(buffer, [0x25, 0x50, 0x44, 0x46, 0x2d]);
      break;
    case "jpg":
    case "jpeg":
      valid = startsWith(buffer, [0xff, 0xd8, 0xff]);
      break;
    case "png":
      valid = startsWith(buffer, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
      break;
    case "webp":
      valid = buffer.length >= 12 &&
        buffer.subarray(0, 4).toString("ascii") === "RIFF" &&
        buffer.subarray(8, 12).toString("ascii") === "WEBP";
      break;
    case "doc":
    case "xls":
      valid = startsWith(buffer, [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]);
      break;
    case "docx":
      valid = isZipWithEntry(buffer, "[Content_Types].xml") &&
        buffer.includes(Buffer.from("word/"));
      break;
    case "xlsx":
      valid = isZipWithEntry(buffer, "[Content_Types].xml") &&
        buffer.includes(Buffer.from("xl/"));
      break;
  }

  if (!valid) {
    throw new DocumentServiceError(
      `O conteúdo de “${candidate.originalFileName}” não corresponde ao formato informado.`,
    );
  }
}

async function loadFolder(access: DocumentAccess, folderId: string, activeOnly = true) {
  let query = access.supabase
    .from("document_folders")
    .select("id, church_id, category_id, name, status, deleted_at")
    .eq("id", folderId)
    .eq("church_id", access.context.church.id)
    .is("deleted_at", null);
  if (activeOnly) query = query.eq("status", "ACTIVE");
  const { data: folder, error } = await query.maybeSingle();
  if (error) {
    logServiceError("load folder", error);
    throw new DocumentServiceError("Não foi possível validar a pasta selecionada.");
  }
  if (!folder) throw new DocumentServiceError("A pasta selecionada não está disponível.");

  const { data: category } = await access.supabase
    .from("document_categories")
    .select("id, status, deleted_at")
    .eq("id", folder.category_id)
    .eq("church_id", access.context.church.id)
    .is("deleted_at", null)
    .maybeSingle();
  if (!category || (activeOnly && category.status !== "ACTIVE")) {
    throw new DocumentServiceError("A categoria da pasta não está disponível.");
  }
  return { ...folder, category };
}

async function loadDocument(
  access: DocumentAccess,
  id: string,
  options: { uploadStatus?: "PENDING" | "ACTIVE"; includeDeleted?: boolean } = {},
) {
  let query = access.supabase
    .from("administrative_documents")
    .select(DOCUMENT_SELECT)
    .eq("id", id)
    .eq("church_id", access.context.church.id);
  if (options.uploadStatus) query = query.eq("upload_status", options.uploadStatus);
  if (!options.includeDeleted) query = query.is("deleted_at", null);
  const { data, error } = await query.maybeSingle();
  if (error) {
    logServiceError("load document", error);
    throw new DocumentServiceError("Não foi possível localizar o documento.");
  }
  if (!data) throw new DocumentServiceError("Documento não encontrado.");
  return data as unknown as DocumentRow;
}

async function removeStorageObject(
  supabase: SupabaseServerClient,
  bucket: string,
  path: string | null,
) {
  if (!path) return true;
  const { error } = await supabase.storage.from(bucket).remove([path]);
  if (error) {
    logServiceError("remove storage object", error);
    return false;
  }
  return true;
}

async function discardPendingDocument(access: DocumentAccess, document: DocumentRow) {
  const storageRemoved = await removeStorageObject(
    access.supabase,
    document.storage_bucket,
    document.storage_path,
  );
  if (!storageRemoved) return;
  const { error } = await access.supabase
    .from("administrative_documents")
    .update({ deleted_at: new Date().toISOString(), deleted_by: access.context.profile.id })
    .eq("id", document.id)
    .eq("church_id", access.context.church.id)
    .eq("upload_status", "PENDING")
    .is("deleted_at", null);
  if (error) logServiceError("discard pending metadata", error);
}

async function clearPendingReplacement(access: DocumentAccess, document: DocumentRow) {
  const storageRemoved = await removeStorageObject(
    access.supabase,
    document.storage_bucket,
    document.pending_storage_path,
  );
  if (!storageRemoved) return;
  const { error } = await access.supabase
    .from("administrative_documents")
    .update({
      pending_storage_path: null,
      pending_original_file_name: null,
      pending_mime_type: null,
      pending_file_extension: null,
      pending_file_size: null,
      pending_started_at: null,
      pending_by: null,
      updated_by: access.context.profile.id,
    })
    .eq("id", document.id)
    .eq("church_id", access.context.church.id);
  if (error) logServiceError("clear pending replacement", error);
}

async function cleanupStaleUploads(access: DocumentAccess) {
  if (!access.context.permissions.includes(PERMISSIONS.documentsManage)) return;
  const cutoff = new Date(Date.now() - ADMINISTRATIVE_DOCUMENT_PENDING_TTL_MS).toISOString();
  const [uploads, replacements] = await Promise.all([
    access.supabase
      .from("administrative_documents")
      .select(DOCUMENT_SELECT)
      .eq("church_id", access.context.church.id)
      .eq("upload_status", "PENDING")
      .is("deleted_at", null)
      .lt("uploaded_at", cutoff),
    access.supabase
      .from("administrative_documents")
      .select(DOCUMENT_SELECT)
      .eq("church_id", access.context.church.id)
      .eq("upload_status", "ACTIVE")
      .not("pending_storage_path", "is", null)
      .lt("pending_started_at", cutoff),
  ]);

  for (const document of (uploads.data ?? []) as unknown as DocumentRow[]) {
    await discardPendingDocument(access, document);
  }
  for (const document of (replacements.data ?? []) as unknown as DocumentRow[]) {
    await clearPendingReplacement(access, document);
  }
}

function mapCategory(row: Record<string, unknown>): DocumentCategoryItem {
  return {
    id: String(row.id),
    name: String(row.name),
    description: row.description ? String(row.description) : null,
    color: row.color ? String(row.color) : null,
    icon: row.icon ? String(row.icon) : null,
    status: row.status as DocumentContainerStatus,
    archivedAt: row.archived_at ? String(row.archived_at) : null,
    deletedAt: row.deleted_at ? String(row.deleted_at) : null,
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}

function mapFolder(row: Record<string, unknown>): DocumentFolderItem {
  return {
    id: String(row.id),
    categoryId: String(row.category_id),
    name: String(row.name),
    description: row.description ? String(row.description) : null,
    physicalLocation: row.physical_location ? String(row.physical_location) : null,
    status: row.status as DocumentContainerStatus,
    archivedAt: row.archived_at ? String(row.archived_at) : null,
    deletedAt: row.deleted_at ? String(row.deleted_at) : null,
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}

function mapDocument(row: Record<string, unknown>): AdministrativeDocumentItem {
  const tags = Array.isArray(row.tags) ? row.tags : [];
  return {
    id: String(row.id),
    folderId: String(row.folder_id),
    folderName: String(row.folder_name),
    categoryId: String(row.category_id),
    categoryName: String(row.category_name),
    title: String(row.title),
    description: row.description ? String(row.description) : null,
    documentDate: row.document_date ? String(row.document_date) : null,
    referenceNumber: row.reference_number ? String(row.reference_number) : null,
    physicalLocation: row.physical_location ? String(row.physical_location) : null,
    notes: row.notes ? String(row.notes) : null,
    originalFileName: String(row.original_file_name),
    mimeType: String(row.mime_type),
    fileExtension: String(row.file_extension),
    fileSize: Number(row.file_size),
    status: row.status as DocumentContainerStatus,
    effectiveStatus: row.effective_status as AdministrativeDocumentItem["effectiveStatus"],
    uploadedBy: String(row.uploaded_by),
    uploadedByName: String(row.uploaded_by_name ?? "Usuário"),
    uploadedAt: String(row.uploaded_at),
    updatedAt: String(row.updated_at),
    tags: tags.map((tag) => ({
      id: String((tag as Record<string, unknown>).id),
      name: String((tag as Record<string, unknown>).name),
    })),
  };
}

async function listReferenceData(access: DocumentAccess) {
  const [categories, folders, tags, accessRows] = await Promise.all([
    access.supabase
      .from("document_categories")
      .select("id, name, description, color, icon, status, archived_at, deleted_at, created_at, updated_at")
      .eq("church_id", access.context.church.id)
      .order("name"),
    access.supabase
      .from("document_folders")
      .select("id, category_id, name, description, physical_location, status, archived_at, deleted_at, created_at, updated_at")
      .eq("church_id", access.context.church.id)
      .order("name"),
    access.supabase
      .from("document_tags")
      .select("id, name")
      .eq("church_id", access.context.church.id)
      .is("deleted_at", null)
      .order("name"),
    access.supabase
      .from("user_church_access")
      .select(
        "profile_id, profiles!user_church_access_profile_id_fkey(id, full_name, display_name, email)",
      )
      .eq("church_id", access.context.church.id)
      .eq("status", "ACTIVE")
      .is("deleted_at", null),
  ]);
  const firstError = categories.error ?? folders.error ?? tags.error ?? accessRows.error;
  if (firstError) {
    logServiceError("list reference data", firstError);
    throw new DocumentServiceError("Não foi possível carregar a estrutura de documentos.");
  }

  const uploaderMap = new Map<string, DocumentUploaderItem>();
  for (const row of accessRows.data ?? []) {
    const rawProfile = Array.isArray(row.profiles) ? row.profiles[0] : row.profiles;
    if (!rawProfile) continue;
    uploaderMap.set(row.profile_id, {
      id: row.profile_id,
      name: rawProfile.display_name ?? rawProfile.full_name ?? rawProfile.email ?? "Usuário",
    });
  }

  return {
    categories: (categories.data ?? []).map((row) => mapCategory(row)),
    folders: (folders.data ?? []).map((row) => mapFolder(row)),
    tags: (tags.data ?? []).map((row) => ({ id: row.id, name: row.name })) as DocumentTagItem[],
    uploaders: [...uploaderMap.values()].sort((a, b) => a.name.localeCompare(b.name, "pt-BR")),
  };
}

export async function listAdministrativeDocuments(
  params: DocumentListParams,
  accessInput?: DocumentAccess,
): Promise<DocumentListResult> {
  const access = accessInput ?? await requireDocumentAccess(false);
  const { data, error } = await access.supabase.rpc("search_administrative_documents", {
    p_church_id: access.context.church.id,
    p_search: params.search || null,
    p_category_id: params.categoryId || null,
    p_folder_id: params.folderId || null,
    p_tag_id: params.tagId || null,
    p_format: params.format || null,
    p_state: params.state,
    p_date_from: params.dateFrom || null,
    p_date_to: params.dateTo || null,
    p_uploaded_by: params.uploadedBy || null,
    p_sort: params.sort,
    p_page: params.page,
    p_page_size: params.pageSize,
  });
  if (error) {
    logServiceError("search documents", error);
    throw new DocumentServiceError("Não foi possível carregar os documentos.");
  }
  const rows = (data ?? []) as unknown as Record<string, unknown>[];
  const total = rows.length ? Number(rows[0].total_count) : 0;
  return {
    items: rows.map(mapDocument),
    total,
    page: params.page,
    pageSize: params.pageSize,
    pageCount: Math.max(1, Math.ceil(total / params.pageSize)),
  };
}

async function countState(access: DocumentAccess, state: "ACTIVE" | "ARCHIVED" | "DELETED") {
  const { data, error } = await access.supabase.rpc("search_administrative_documents", {
    p_church_id: access.context.church.id,
    p_search: null,
    p_category_id: null,
    p_folder_id: null,
    p_tag_id: null,
    p_format: null,
    p_state: state,
    p_date_from: null,
    p_date_to: null,
    p_uploaded_by: null,
    p_sort: "RECENT",
    p_page: 1,
    p_page_size: 1,
  });
  if (error) return 0;
  const first = (data as unknown as Record<string, unknown>[] | null)?.[0];
  return first ? Number(first.total_count) : 0;
}

export async function getDocumentWorkspace(
  params: DocumentListParams,
): Promise<DocumentWorkspaceData> {
  const access = await requireDocumentAccess(false);
  await cleanupStaleUploads(access);
  const [references, documents, active, archived, deleted] = await Promise.all([
    listReferenceData(access),
    listAdministrativeDocuments(params, access),
    countState(access, "ACTIVE"),
    countState(access, "ARCHIVED"),
    countState(access, "DELETED"),
  ]);
  const stats: DocumentStats = {
    active,
    archived,
    deleted,
    categories: references.categories.filter((item) => !item.deletedAt && item.status === "ACTIVE").length,
    folders: references.folders.filter((item) => !item.deletedAt && item.status === "ACTIVE").length,
  };
  return { ...references, stats, documents, params };
}

export async function createDocumentCategory(input: {
  name: string;
  description?: string;
  color?: string;
  icon?: string;
}) {
  const access = await requireDocumentAccess(true);
  const { error } = await access.supabase.from("document_categories").insert({
    church_id: access.context.church.id,
    name: input.name,
    description: input.description || null,
    color: input.color || null,
    icon: input.icon || null,
    created_by: access.context.profile.id,
    updated_by: access.context.profile.id,
  });
  if (error) {
    logServiceError("create category", error);
    throw translateDatabaseError(error, "Não foi possível criar a categoria.");
  }
}

export async function updateDocumentCategory(input: {
  id: string;
  name: string;
  description?: string;
  color?: string;
  icon?: string;
}) {
  const access = await requireDocumentAccess(true);
  const { count, error } = await access.supabase
    .from("document_categories")
    .update({
      name: input.name,
      description: input.description || null,
      color: input.color || null,
      icon: input.icon || null,
      updated_by: access.context.profile.id,
    }, { count: "exact" })
    .eq("id", input.id)
    .eq("church_id", access.context.church.id);
  if (error) {
    logServiceError("update category", error);
    throw translateDatabaseError(error, "Não foi possível atualizar a categoria.");
  }
  if (count !== 1) throw new DocumentServiceError("Categoria não encontrada.");
}

export async function changeDocumentCategoryState(
  id: string,
  action: "ARCHIVE" | "RESTORE" | "DELETE" | "RESTORE_DELETED",
) {
  const access = await requireDocumentAccess(true);
  const changes = action === "ARCHIVE"
    ? { status: "ARCHIVED" }
    : action === "RESTORE"
      ? { status: "ACTIVE" }
      : action === "DELETE"
        ? { deleted_at: new Date().toISOString(), deleted_by: access.context.profile.id }
        : { deleted_at: null, deleted_by: null };
  const { count, error } = await access.supabase
    .from("document_categories")
    .update({ ...changes, updated_by: access.context.profile.id }, { count: "exact" })
    .eq("id", id)
    .eq("church_id", access.context.church.id);
  if (error) {
    logServiceError("change category state", error);
    throw translateDatabaseError(error, "Não foi possível alterar a situação da categoria.");
  }
  if (count !== 1) throw new DocumentServiceError("Categoria não encontrada.");
}

export async function createDocumentFolder(input: {
  categoryId: string;
  name: string;
  description?: string;
  physicalLocation?: string;
}) {
  const access = await requireDocumentAccess(true);
  await loadFolderCategory(access, input.categoryId);
  const { error } = await access.supabase.from("document_folders").insert({
    church_id: access.context.church.id,
    category_id: input.categoryId,
    name: input.name,
    description: input.description || null,
    physical_location: input.physicalLocation || null,
    created_by: access.context.profile.id,
    updated_by: access.context.profile.id,
  });
  if (error) {
    logServiceError("create folder", error);
    throw translateDatabaseError(error, "Não foi possível criar a pasta.");
  }
}

async function loadFolderCategory(access: DocumentAccess, categoryId: string) {
  const { data, error } = await access.supabase
    .from("document_categories")
    .select("id")
    .eq("id", categoryId)
    .eq("church_id", access.context.church.id)
    .eq("status", "ACTIVE")
    .is("deleted_at", null)
    .maybeSingle();
  if (error || !data) throw new DocumentServiceError("A categoria selecionada não está disponível.");
}

export async function updateDocumentFolder(input: {
  id: string;
  categoryId: string;
  name: string;
  description?: string;
  physicalLocation?: string;
}) {
  const access = await requireDocumentAccess(true);
  await loadFolderCategory(access, input.categoryId);
  const { count, error } = await access.supabase
    .from("document_folders")
    .update({
      category_id: input.categoryId,
      name: input.name,
      description: input.description || null,
      physical_location: input.physicalLocation || null,
      updated_by: access.context.profile.id,
    }, { count: "exact" })
    .eq("id", input.id)
    .eq("church_id", access.context.church.id);
  if (error) {
    logServiceError("update folder", error);
    throw translateDatabaseError(error, "Não foi possível atualizar a pasta.");
  }
  if (count !== 1) throw new DocumentServiceError("Pasta não encontrada.");
}

export async function changeDocumentFolderState(
  id: string,
  action: "ARCHIVE" | "RESTORE" | "DELETE" | "RESTORE_DELETED",
) {
  const access = await requireDocumentAccess(true);
  const changes = action === "ARCHIVE"
    ? { status: "ARCHIVED" }
    : action === "RESTORE"
      ? { status: "ACTIVE" }
      : action === "DELETE"
        ? { deleted_at: new Date().toISOString(), deleted_by: access.context.profile.id }
        : { deleted_at: null, deleted_by: null };
  const { count, error } = await access.supabase
    .from("document_folders")
    .update({ ...changes, updated_by: access.context.profile.id }, { count: "exact" })
    .eq("id", id)
    .eq("church_id", access.context.church.id);
  if (error) {
    logServiceError("change folder state", error);
    throw translateDatabaseError(error, "Não foi possível alterar a situação da pasta.");
  }
  if (count !== 1) throw new DocumentServiceError("Pasta não encontrada.");
}

export async function deleteUnusedDocumentTag(id: string) {
  const access = await requireDocumentAccess(true);
  const { count } = await access.supabase
    .from("administrative_document_tags")
    .select("document_id", { count: "exact", head: true })
    .eq("church_id", access.context.church.id)
    .eq("tag_id", id);
  if (count) throw new DocumentServiceError("A tag está em uso e não pode ser excluída.");
  const { count: changed, error } = await access.supabase
    .from("document_tags")
    .update({ deleted_at: new Date().toISOString(), deleted_by: access.context.profile.id }, { count: "exact" })
    .eq("id", id)
    .eq("church_id", access.context.church.id)
    .is("deleted_at", null);
  if (error || changed !== 1) throw new DocumentServiceError("Não foi possível excluir a tag.");
}

export async function prepareDocumentUploads(input: {
  folderId: string;
  files: Array<{ clientId: string; title: string; originalFileName: string; fileSize: number }>;
}): Promise<PreparedDocumentUpload[]> {
  const access = await requireDocumentAccess(true);
  const folder = await loadFolder(access, input.folderId);
  const results: PreparedDocumentUpload[] = [];

  for (const file of input.files) {
    let documentId: string | null = null;
    try {
      const candidate = validateUploadCandidate(file.originalFileName, file.fileSize);
      documentId = randomUUID();
      const path = [
        access.context.church.id,
        folder.category_id,
        folder.id,
        documentId,
        `${randomUUID()}.${candidate.extension}`,
      ].join("/");
      const { error: insertError } = await access.supabase
        .from("administrative_documents")
        .insert({
          id: documentId,
          church_id: access.context.church.id,
          folder_id: folder.id,
          title: file.title,
          original_file_name: candidate.originalFileName,
          storage_bucket: ADMINISTRATIVE_DOCUMENT_BUCKET,
          storage_path: path,
          mime_type: candidate.mimeType,
          file_extension: candidate.extension,
          file_size: candidate.size,
          upload_status: "PENDING",
          uploaded_by: access.context.profile.id,
          updated_by: access.context.profile.id,
        });
      if (insertError) throw insertError;

      const { data, error: signedError } = await access.supabase.storage
        .from(ADMINISTRATIVE_DOCUMENT_BUCKET)
        .createSignedUploadUrl(path, { upsert: false });
      if (signedError || !data) throw signedError ?? new Error("SIGNED_UPLOAD_UNAVAILABLE");
      results.push({
        clientId: file.clientId,
        documentId,
        path,
        token: data.token,
        contentType: candidate.mimeType,
        status: "success",
        message: "Pronto para envio.",
      });
    } catch (error) {
      logServiceError("prepare upload", error);
      if (documentId) {
        try {
          const pending = await loadDocument(access, documentId, { uploadStatus: "PENDING" });
          await discardPendingDocument(access, pending);
        } catch {
          // A preparação pode falhar antes da criação dos metadados.
        }
      }
      results.push({
        clientId: file.clientId,
        status: "error",
        message: error instanceof DocumentServiceError
          ? error.message
          : "Não foi possível preparar este arquivo.",
      });
    }
  }
  return results;
}

export async function finalizeDocumentUploads(ids: string[]): Promise<UploadFinalizationResult[]> {
  const access = await requireDocumentAccess(true);
  const results: UploadFinalizationResult[] = [];
  for (const id of ids) {
    try {
      const document = await loadDocument(access, id, { uploadStatus: "PENDING" });
      const { data, error: downloadError } = await access.supabase.storage
        .from(document.storage_bucket)
        .download(document.storage_path);
      if (downloadError || !data) throw new DocumentServiceError("O arquivo não foi recebido.");
      const buffer = Buffer.from(await data.arrayBuffer());
      const candidate = validateUploadCandidate(document.original_file_name, buffer.length);
      validateFileContent(buffer, candidate);
      const { count, error } = await access.supabase
        .from("administrative_documents")
        .update({
          mime_type: candidate.mimeType,
          file_extension: candidate.extension,
          file_size: buffer.length,
          upload_status: "ACTIVE",
          updated_by: access.context.profile.id,
        }, { count: "exact" })
        .eq("id", document.id)
        .eq("church_id", access.context.church.id)
        .eq("upload_status", "PENDING")
        .is("deleted_at", null);
      if (error || count !== 1) throw new DocumentServiceError("O arquivo não pôde ser confirmado.");
      results.push({ documentId: id, status: "success", message: "Documento enviado." });
    } catch (error) {
      logServiceError("finalize upload", error);
      try {
        const pending = await loadDocument(access, id, { uploadStatus: "PENDING" });
        await discardPendingDocument(access, pending);
      } catch {
        // O registro pode já ter sido descartado.
      }
      results.push({
        documentId: id,
        status: "error",
        message: error instanceof DocumentServiceError ? error.message : "Falha ao validar o arquivo.",
      });
    }
  }
  return results;
}

export async function cancelDocumentUploads(ids: string[]) {
  const access = await requireDocumentAccess(true);
  for (const id of ids) {
    try {
      const document = await loadDocument(access, id, { uploadStatus: "PENDING" });
      await discardPendingDocument(access, document);
    } catch (error) {
      logServiceError("cancel upload", error);
    }
  }
}

export async function updateAdministrativeDocumentMetadata(input: {
  id: string;
  title: string;
  description?: string;
  documentDate?: string;
  referenceNumber?: string;
  physicalLocation?: string;
  notes?: string;
  tagNames: string[];
}) {
  const access = await requireDocumentAccess(true);
  const { error } = await access.supabase.rpc("update_administrative_document_metadata", {
    p_document_id: input.id,
    p_title: input.title,
    p_description: input.description || null,
    p_document_date: input.documentDate || null,
    p_reference_number: input.referenceNumber || null,
    p_physical_location: input.physicalLocation || null,
    p_notes: input.notes || null,
    p_tag_names: input.tagNames,
  });
  if (error) {
    logServiceError("update document metadata", error);
    throw translateDatabaseError(error, "Não foi possível atualizar o documento.");
  }
}

export async function prepareDocumentReplacement(input: {
  id: string;
  originalFileName: string;
  fileSize: number;
}): Promise<PreparedReplacement> {
  const access = await requireDocumentAccess(true);
  let document = await loadDocument(access, input.id, { uploadStatus: "ACTIVE" });
  if (document.pending_storage_path) {
    await clearPendingReplacement(access, document);
    document = await loadDocument(access, input.id, { uploadStatus: "ACTIVE" });
  }
  const candidate = validateUploadCandidate(input.originalFileName, input.fileSize);
  const folder = await loadFolder(access, document.folder_id, false);
  const path = [
    access.context.church.id,
    folder.category_id,
    folder.id,
    document.id,
    `replacement-${randomUUID()}.${candidate.extension}`,
  ].join("/");
  const { count, error: prepareError } = await access.supabase
    .from("administrative_documents")
    .update({
      pending_storage_path: path,
      pending_original_file_name: candidate.originalFileName,
      pending_mime_type: candidate.mimeType,
      pending_file_extension: candidate.extension,
      pending_file_size: candidate.size,
      pending_started_at: new Date().toISOString(),
      pending_by: access.context.profile.id,
      updated_by: access.context.profile.id,
    }, { count: "exact" })
    .eq("id", document.id)
    .eq("church_id", access.context.church.id)
    .is("deleted_at", null);
  if (prepareError || count !== 1) {
    throw new DocumentServiceError("Não foi possível preparar a substituição.");
  }

  const { data, error } = await access.supabase.storage
    .from(ADMINISTRATIVE_DOCUMENT_BUCKET)
    .createSignedUploadUrl(path, { upsert: false });
  if (error || !data) {
    const prepared = await loadDocument(access, document.id, { uploadStatus: "ACTIVE" });
    await clearPendingReplacement(access, prepared);
    throw new DocumentServiceError("Não foi possível preparar o envio do novo arquivo.");
  }
  return {
    status: "success",
    message: "Substituição preparada.",
    documentId: document.id,
    path,
    token: data.token,
    contentType: candidate.mimeType,
  };
}

export async function finalizeDocumentReplacement(id: string) {
  const access = await requireDocumentAccess(true);
  const document = await loadDocument(access, id, { uploadStatus: "ACTIVE" });
  if (!document.pending_storage_path || !document.pending_original_file_name) {
    throw new DocumentServiceError("Não há uma substituição pendente.");
  }
  const { data, error: downloadError } = await access.supabase.storage
    .from(document.storage_bucket)
    .download(document.pending_storage_path);
  if (downloadError || !data) {
    await clearPendingReplacement(access, document);
    throw new DocumentServiceError("O novo arquivo não foi recebido. O arquivo atual foi preservado.");
  }
  const buffer = Buffer.from(await data.arrayBuffer());
  const candidate = validateUploadCandidate(document.pending_original_file_name, buffer.length);
  try {
    validateFileContent(buffer, candidate);
  } catch (error) {
    await clearPendingReplacement(access, document);
    throw error;
  }

  const oldPath = document.storage_path;
  const newPath = document.pending_storage_path;
  const { count, error } = await access.supabase
    .from("administrative_documents")
    .update({
      storage_path: newPath,
      original_file_name: candidate.originalFileName,
      mime_type: candidate.mimeType,
      file_extension: candidate.extension,
      file_size: buffer.length,
      pending_storage_path: null,
      pending_original_file_name: null,
      pending_mime_type: null,
      pending_file_extension: null,
      pending_file_size: null,
      pending_started_at: null,
      pending_by: null,
      updated_by: access.context.profile.id,
    }, { count: "exact" })
    .eq("id", document.id)
    .eq("church_id", access.context.church.id)
    .is("deleted_at", null);
  if (error || count !== 1) {
    await removeStorageObject(access.supabase, document.storage_bucket, newPath);
    throw new DocumentServiceError("A substituição falhou. O arquivo atual foi preservado.");
  }
  await removeStorageObject(access.supabase, document.storage_bucket, oldPath);
}

export async function cancelDocumentReplacement(id: string) {
  const access = await requireDocumentAccess(true);
  const document = await loadDocument(access, id, { uploadStatus: "ACTIVE" });
  if (document.pending_storage_path) await clearPendingReplacement(access, document);
}

export async function createAdministrativeDocumentUrl(id: string, download: boolean) {
  const access = await requireDocumentAccess(false);
  const document = await loadDocument(access, id, {
    uploadStatus: "ACTIVE",
    includeDeleted: false,
  });
  const { data, error } = await access.supabase.storage
    .from(document.storage_bucket)
    .createSignedUrl(document.storage_path, 60, {
      download: download ? document.original_file_name : false,
    });
  if (error || !data) throw new DocumentServiceError("Não foi possível abrir o documento.");
  if (download) {
    const { error: auditError } = await createAdminClient().from("audit_logs").insert({
      church_id: access.context.church.id,
      actor_profile_id: access.context.profile.id,
      actor_email: access.context.profile.email,
      module: "documents",
      action: "ADMINISTRATIVE_DOCUMENT_DOWNLOADED",
      entity_type: "administrative_document",
      entity_id: document.id,
      entity_label: document.title,
      description: "Documento administrativo baixado.",
      severity: "INFO",
    });
    if (auditError) logServiceError("audit document download", auditError);
  }
  return data.signedUrl;
}

export async function changeAdministrativeDocumentState(
  id: string,
  action: "ARCHIVE" | "RESTORE" | "TRASH" | "RESTORE_TRASH",
) {
  const access = await requireDocumentAccess(true);
  const changes = action === "ARCHIVE"
    ? { status: "ARCHIVED" }
    : action === "RESTORE"
      ? { status: "ACTIVE" }
      : action === "TRASH"
        ? { deleted_at: new Date().toISOString(), deleted_by: access.context.profile.id }
        : { deleted_at: null, deleted_by: null };
  const { count, error } = await access.supabase
    .from("administrative_documents")
    .update({ ...changes, updated_by: access.context.profile.id }, { count: "exact" })
    .eq("id", id)
    .eq("church_id", access.context.church.id)
    .eq("upload_status", "ACTIVE");
  if (error) {
    logServiceError("change document state", error);
    throw translateDatabaseError(error, "Não foi possível alterar a situação do documento.");
  }
  if (count !== 1) throw new DocumentServiceError("Documento não encontrado.");
}

export async function permanentlyDeleteAdministrativeDocument(id: string) {
  const access = await requireDocumentAccess(true);
  const document = await loadDocument(access, id, {
    uploadStatus: "ACTIVE",
    includeDeleted: true,
  });
  if (!document.deleted_at) {
    throw new DocumentServiceError("Envie o documento para a lixeira antes da exclusão definitiva.");
  }
  const paths = [document.storage_path, document.pending_storage_path].filter(Boolean) as string[];
  if (paths.length) {
    const { error: storageError } = await access.supabase.storage
      .from(document.storage_bucket)
      .remove(paths);
    if (storageError) {
      logServiceError("permanent storage deletion", storageError);
      throw new DocumentServiceError("Não foi possível remover o arquivo do armazenamento.");
    }
  }

  const admin = createAdminClient();
  const { error: deleteError } = await admin
    .from("administrative_documents")
    .delete()
    .eq("id", document.id)
    .eq("church_id", access.context.church.id)
    .not("deleted_at", "is", null);
  if (deleteError) {
    logServiceError("permanent metadata deletion", deleteError);
    throw new DocumentServiceError("Não foi possível concluir a exclusão definitiva.");
  }
  const { error: auditError } = await admin.from("audit_logs").insert({
    church_id: access.context.church.id,
    actor_profile_id: access.context.profile.id,
    actor_email: access.context.profile.email,
    module: "documents",
    action: "ADMINISTRATIVE_DOCUMENT_PERMANENTLY_DELETED",
    entity_type: "administrative_document",
    entity_id: document.id,
    entity_label: document.title,
    description: "Documento administrativo excluído fisicamente.",
    old_values: {
      original_file_name: document.original_file_name,
      mime_type: document.mime_type,
      file_size: document.file_size,
    },
    severity: "CRITICAL",
  });
  if (auditError) logServiceError("audit permanent deletion", auditError);
}

export function toDocumentActionError(
  error: unknown,
  fallback: string,
): DocumentActionState & { status: "error" } {
  if (error instanceof DocumentServiceError) {
    return { status: "error", message: error.message };
  }
  logServiceError("unexpected service error", error);
  return { status: "error", message: fallback };
}
