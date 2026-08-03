import "server-only";

import { Buffer } from "node:buffer";
import { randomUUID } from "node:crypto";
import { createClient } from "@/lib/supabase/server";
import { PERMISSIONS } from "@/modules/auth/constants/permissions";
import { requireAccessContext } from "@/modules/auth/services/access-context.service";
import {
  CONGREGATION_DOCUMENT_BUCKET,
  CONGREGATION_DOCUMENT_MAX_SIZE,
} from "../constants/congregation-documents";
import type {
  CongregationDocumentCategory,
  CongregationDocumentItem,
} from "../types/organization.types";

type DocumentRow = {
  id: string;
  church_id: string;
  congregation_id: string;
  title: string;
  category: CongregationDocumentCategory;
  original_file_name: string;
  storage_bucket: string;
  storage_path: string;
  mime_type: string;
  file_size: number;
  upload_status: "PENDING" | "ACTIVE";
  uploaded_by: string;
  uploaded_at: string;
  updated_at: string;
};

type DocumentMetadata = {
  congregationId: string;
  title: string;
  category: CongregationDocumentCategory;
};

type FileIdentity = {
  mimeType: string;
  extension: string;
  originalFileName: string;
  buffer: Buffer;
};

const FILE_TYPES: Record<string, string> = {
  pdf: "application/pdf",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  doc: "application/msword",
  docx:
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
};

const PENDING_UPLOAD_TTL_MS = 2 * 60 * 60 * 1000;

export class CongregationDocumentServiceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CongregationDocumentServiceError";
  }
}

function logServiceError(
  action: string,
  error: { code?: string; message?: string } | unknown,
) {
  const detail =
    error && typeof error === "object"
      ? {
          code: "code" in error ? String(error.code ?? "") : undefined,
          message:
            "message" in error ? String(error.message ?? "") : undefined,
        }
      : { message: String(error) };

  console.error(`[congregation-documents] ${action} failed`, detail);
}

function startsWith(buffer: Buffer, signature: number[]) {
  return signature.every((value, index) => buffer[index] === value);
}

function hasZipEntry(buffer: Buffer, entry: string) {
  return buffer.includes(Buffer.from(entry, "utf8"));
}

function cleanOriginalFileName(name: string) {
  const baseName = name.replace(/\\/g, "/").split("/").pop() ?? "";
  return baseName.replace(/[\u0000-\u001f\u007f]/g, "").trim().slice(0, 255);
}

function validateUploadCandidate(originalName: string, fileSize: number) {
  if (!Number.isSafeInteger(fileSize) || fileSize <= 0) {
    throw new CongregationDocumentServiceError("Selecione um arquivo válido.");
  }

  if (fileSize > CONGREGATION_DOCUMENT_MAX_SIZE) {
    throw new CongregationDocumentServiceError(
      "O arquivo deve ter no máximo 10 MB.",
    );
  }

  const originalFileName = cleanOriginalFileName(originalName);
  const extension = originalFileName.split(".").pop()?.toLowerCase() ?? "";
  const mimeType = FILE_TYPES[extension];

  if (!originalFileName || !mimeType) {
    throw new CongregationDocumentServiceError(
      "Formato não permitido. Envie PDF, JPG, PNG, WEBP, DOC ou DOCX.",
    );
  }

  return { originalFileName, extension, mimeType };
}

function identifyBuffer(buffer: Buffer, originalName: string): FileIdentity {
  const candidate = validateUploadCandidate(originalName, buffer.length);
  const { extension, mimeType, originalFileName } = candidate;
  let signatureMatches = false;

  if (extension === "pdf") {
    signatureMatches = startsWith(buffer, [0x25, 0x50, 0x44, 0x46, 0x2d]);
  } else if (["jpg", "jpeg"].includes(extension)) {
    signatureMatches = startsWith(buffer, [0xff, 0xd8, 0xff]);
  } else if (extension === "png") {
    signatureMatches = startsWith(buffer, [
      0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
    ]);
  } else if (extension === "webp") {
    signatureMatches =
      buffer.length >= 12 &&
      buffer.subarray(0, 4).toString("ascii") === "RIFF" &&
      buffer.subarray(8, 12).toString("ascii") === "WEBP";
  } else if (extension === "doc") {
    signatureMatches = startsWith(buffer, [
      0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1,
    ]);
  } else if (extension === "docx") {
    signatureMatches =
      startsWith(buffer, [0x50, 0x4b, 0x03, 0x04]) &&
      hasZipEntry(buffer, "[Content_Types].xml") &&
      hasZipEntry(buffer, "word/");
  }

  if (!signatureMatches) {
    throw new CongregationDocumentServiceError(
      "O conteúdo do arquivo não corresponde ao formato informado.",
    );
  }

  return { mimeType, extension, originalFileName, buffer };
}

function mapDocument(row: DocumentRow): CongregationDocumentItem {
  return {
    id: row.id,
    title: row.title,
    category: row.category,
    originalFileName: row.original_file_name,
    mimeType: row.mime_type,
    fileSize: Number(row.file_size),
    uploadedAt: row.uploaded_at,
    updatedAt: row.updated_at,
  };
}

async function authorizeCongregation(congregationId: string, permission: string) {
  const context = await requireAccessContext(PERMISSIONS.organizationView);
  const authorized =
    context.access.role === "ADMIN" &&
    context.access.scope === "CHURCH" &&
    context.permissions.includes(permission);

  if (!authorized) {
    throw new CongregationDocumentServiceError(
      "Esta ação é exclusiva de Administradores.",
    );
  }

  const supabase = await createClient();
  const { data: congregation, error } = await supabase
    .from("congregations")
    .select("id, name")
    .eq("id", congregationId)
    .eq("church_id", context.church.id)
    .is("deleted_at", null)
    .maybeSingle();

  if (error) {
    logServiceError("authorize congregation", error);
    throw new CongregationDocumentServiceError(
      "Não foi possível validar a Congregação.",
    );
  }

  if (!congregation) {
    throw new CongregationDocumentServiceError("Congregação não encontrada.");
  }

  return { context, supabase };
}

async function getDocument(
  id: string,
  congregationId: string,
  permission: string,
  status: "PENDING" | "ACTIVE",
) {
  const access = await authorizeCongregation(congregationId, permission);
  const { data, error } = await access.supabase
    .from("congregation_documents")
    .select(
      "id, church_id, congregation_id, title, category, original_file_name, storage_bucket, storage_path, mime_type, file_size, upload_status, uploaded_by, uploaded_at, updated_at",
    )
    .eq("id", id)
    .eq("church_id", access.context.church.id)
    .eq("congregation_id", congregationId)
    .eq("upload_status", status)
    .is("deleted_at", null)
    .maybeSingle();

  if (error) {
    logServiceError("load document", error);
    throw new CongregationDocumentServiceError(
      "Não foi possível localizar o documento.",
    );
  }

  if (!data) {
    throw new CongregationDocumentServiceError("Documento não encontrado.");
  }

  return { ...access, document: data as DocumentRow };
}

async function discardPendingDocument(
  access: Awaited<ReturnType<typeof authorizeCongregation>>,
  document: DocumentRow,
) {
  const { error: removeError } = await access.supabase.storage
    .from(document.storage_bucket)
    .remove([document.storage_path]);

  if (removeError) {
    logServiceError("discard pending file", removeError);
    return false;
  }

  const { error: archiveError } = await access.supabase
    .from("congregation_documents")
    .update({
      deleted_at: new Date().toISOString(),
      deleted_by: access.context.profile.id,
    })
    .eq("id", document.id)
    .eq("church_id", access.context.church.id)
    .eq("upload_status", "PENDING")
    .is("deleted_at", null);

  if (archiveError) {
    logServiceError("discard pending metadata", archiveError);
    return false;
  }

  return true;
}

async function cleanupStalePendingDocuments(
  access: Awaited<ReturnType<typeof authorizeCongregation>>,
  congregationId: string,
) {
  const cutoff = new Date(Date.now() - PENDING_UPLOAD_TTL_MS).toISOString();
  const { data, error } = await access.supabase
    .from("congregation_documents")
    .select(
      "id, church_id, congregation_id, title, category, original_file_name, storage_bucket, storage_path, mime_type, file_size, upload_status, uploaded_by, uploaded_at, updated_at",
    )
    .eq("church_id", access.context.church.id)
    .eq("congregation_id", congregationId)
    .eq("upload_status", "PENDING")
    .is("deleted_at", null)
    .lt("uploaded_at", cutoff);

  if (error) {
    logServiceError("find stale uploads", error);
    return;
  }

  for (const document of (data ?? []) as DocumentRow[]) {
    await discardPendingDocument(access, document);
  }
}

export async function listCongregationDocuments(
  congregationId: string,
): Promise<CongregationDocumentItem[]> {
  const access = await authorizeCongregation(
    congregationId,
    PERMISSIONS.congregationDocumentsView,
  );

  if (
    access.context.permissions.includes(
      PERMISSIONS.congregationDocumentsManage,
    )
  ) {
    await cleanupStalePendingDocuments(access, congregationId);
  }

  const { data, error } = await access.supabase
    .from("congregation_documents")
    .select(
      "id, church_id, congregation_id, title, category, original_file_name, storage_bucket, storage_path, mime_type, file_size, upload_status, uploaded_by, uploaded_at, updated_at",
    )
    .eq("church_id", access.context.church.id)
    .eq("congregation_id", congregationId)
    .eq("upload_status", "ACTIVE")
    .is("deleted_at", null)
    .order("uploaded_at", { ascending: false })
    .order("id", { ascending: false });

  if (error) {
    logServiceError("list documents", error);
    throw new CongregationDocumentServiceError(
      "Não foi possível carregar os documentos.",
    );
  }

  return ((data ?? []) as DocumentRow[]).map(mapDocument);
}

export async function prepareCongregationDocumentUpload(
  metadata: DocumentMetadata,
  originalName: string,
  fileSize: number,
) {
  const access = await authorizeCongregation(
    metadata.congregationId,
    PERMISSIONS.congregationDocumentsManage,
  );
  const candidate = validateUploadCandidate(originalName, fileSize);
  const documentId = randomUUID();
  const storagePath = [
    access.context.church.id,
    metadata.congregationId,
    documentId,
    `${documentId}.${candidate.extension}`,
  ].join("/");

  const { error: insertError } = await access.supabase
    .from("congregation_documents")
    .insert({
      id: documentId,
      church_id: access.context.church.id,
      congregation_id: metadata.congregationId,
      title: metadata.title,
      category: metadata.category,
      original_file_name: candidate.originalFileName,
      storage_bucket: CONGREGATION_DOCUMENT_BUCKET,
      storage_path: storagePath,
      mime_type: candidate.mimeType,
      file_size: fileSize,
      upload_status: "PENDING",
      uploaded_by: access.context.profile.id,
    });

  if (insertError) {
    logServiceError("prepare metadata", insertError);
    throw new CongregationDocumentServiceError(
      "Não foi possível preparar o envio do documento.",
    );
  }

  const pendingDocument: DocumentRow = {
    id: documentId,
    church_id: access.context.church.id,
    congregation_id: metadata.congregationId,
    title: metadata.title,
    category: metadata.category,
    original_file_name: candidate.originalFileName,
    storage_bucket: CONGREGATION_DOCUMENT_BUCKET,
    storage_path: storagePath,
    mime_type: candidate.mimeType,
    file_size: fileSize,
    upload_status: "PENDING",
    uploaded_by: access.context.profile.id,
    uploaded_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
  const { data, error: signedUrlError } = await access.supabase.storage
    .from(CONGREGATION_DOCUMENT_BUCKET)
    .createSignedUploadUrl(storagePath, { upsert: false });

  if (signedUrlError || !data) {
    logServiceError("create signed upload URL", signedUrlError);
    await discardPendingDocument(access, pendingDocument);
    throw new CongregationDocumentServiceError(
      "Não foi possível preparar o envio do arquivo.",
    );
  }

  return {
    documentId,
    path: storagePath,
    token: data.token,
    contentType: candidate.mimeType,
  };
}

export async function finalizeCongregationDocumentUpload(
  id: string,
  congregationId: string,
) {
  const access = await getDocument(
    id,
    congregationId,
    PERMISSIONS.congregationDocumentsManage,
    "PENDING",
  );
  const { data, error: downloadError } = await access.supabase.storage
    .from(access.document.storage_bucket)
    .download(access.document.storage_path);

  if (downloadError || !data) {
    logServiceError("validate uploaded file", downloadError);
    await discardPendingDocument(access, access.document);
    throw new CongregationDocumentServiceError(
      "O arquivo não foi recebido. Tente enviá-lo novamente.",
    );
  }

  let identity: FileIdentity;
  try {
    const buffer = Buffer.from(await data.arrayBuffer());
    identity = identifyBuffer(buffer, access.document.original_file_name);
  } catch (error) {
    await discardPendingDocument(access, access.document);
    throw error;
  }

  const { count, error: updateError } = await access.supabase
    .from("congregation_documents")
    .update(
      {
        mime_type: identity.mimeType,
        file_size: identity.buffer.length,
        upload_status: "ACTIVE",
      },
      { count: "exact" },
    )
    .eq("id", id)
    .eq("church_id", access.context.church.id)
    .eq("congregation_id", congregationId)
    .eq("upload_status", "PENDING")
    .is("deleted_at", null);

  if (updateError || count !== 1) {
    logServiceError("activate uploaded document", updateError);
    await discardPendingDocument(access, access.document);
    throw new CongregationDocumentServiceError(
      "O arquivo foi enviado, mas não pôde ser confirmado.",
    );
  }
}

export async function cancelCongregationDocumentUpload(
  id: string,
  congregationId: string,
) {
  try {
    const access = await getDocument(
      id,
      congregationId,
      PERMISSIONS.congregationDocumentsManage,
      "PENDING",
    );
    await discardPendingDocument(access, access.document);
  } catch (error) {
    logServiceError("cancel prepared upload", error);
  }
}

export async function updateCongregationDocument(input: {
  id: string;
  congregationId: string;
  title: string;
  category: CongregationDocumentCategory;
}) {
  const { context, supabase } = await getDocument(
    input.id,
    input.congregationId,
    PERMISSIONS.congregationDocumentsManage,
    "ACTIVE",
  );
  const { count, error } = await supabase
    .from("congregation_documents")
    .update(
      { title: input.title, category: input.category },
      { count: "exact" },
    )
    .eq("id", input.id)
    .eq("church_id", context.church.id)
    .eq("congregation_id", input.congregationId)
    .eq("upload_status", "ACTIVE")
    .is("deleted_at", null);

  if (error) {
    logServiceError("update metadata", error);
    throw new CongregationDocumentServiceError(
      "Não foi possível atualizar o documento.",
    );
  }

  if (count !== 1) {
    throw new CongregationDocumentServiceError("Documento não encontrado.");
  }
}

export async function archiveCongregationDocument(
  id: string,
  congregationId: string,
) {
  const { context, supabase, document } = await getDocument(
    id,
    congregationId,
    PERMISSIONS.congregationDocumentsManage,
    "ACTIVE",
  );

  const { data: backup, error: backupError } = await supabase.storage
    .from(document.storage_bucket)
    .download(document.storage_path);

  if (backupError || !backup) {
    logServiceError("prepare document deletion", backupError);
    throw new CongregationDocumentServiceError(
      "Não foi possível preparar a exclusão do arquivo.",
    );
  }

  const { error: removeError } = await supabase.storage
    .from(document.storage_bucket)
    .remove([document.storage_path]);

  if (removeError) {
    logServiceError("delete file", removeError);
    throw new CongregationDocumentServiceError(
      "Não foi possível excluir o arquivo.",
    );
  }

  const { count, error: archiveError } = await supabase
    .from("congregation_documents")
    .update(
      {
        deleted_at: new Date().toISOString(),
        deleted_by: context.profile.id,
      },
      { count: "exact" },
    )
    .eq("id", id)
    .eq("church_id", context.church.id)
    .eq("congregation_id", congregationId)
    .eq("upload_status", "ACTIVE")
    .is("deleted_at", null);

  if (archiveError || count !== 1) {
    logServiceError("archive metadata", archiveError);
    const backupBuffer = Buffer.from(await backup.arrayBuffer());
    const { error: restoreError } = await supabase.storage
      .from(document.storage_bucket)
      .upload(document.storage_path, backupBuffer, {
        contentType: document.mime_type,
        cacheControl: "3600",
        upsert: false,
      });

    if (restoreError) {
      logServiceError("restore file after archive failure", restoreError);
    }

    throw new CongregationDocumentServiceError(
      "Não foi possível concluir a exclusão do documento.",
    );
  }
}

export async function createCongregationDocumentUrl(
  id: string,
  congregationId: string,
  download: boolean,
) {
  const { supabase, document } = await getDocument(
    id,
    congregationId,
    PERMISSIONS.congregationDocumentsView,
    "ACTIVE",
  );
  const { data, error } = await supabase.storage
    .from(document.storage_bucket)
    .createSignedUrl(document.storage_path, 60, {
      download: download ? document.original_file_name : false,
    });

  if (error || !data) {
    logServiceError("create signed URL", error);
    throw new CongregationDocumentServiceError(
      "Não foi possível abrir o documento.",
    );
  }

  return data.signedUrl;
}
