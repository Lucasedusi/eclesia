"use server";

import { Buffer } from "node:buffer";
import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { PERMISSIONS, hasPermission } from "@/modules/auth/constants/permissions";
import { requireAccessContext } from "@/modules/auth/services/access-context.service";
import {
  MEMBER_DOCUMENT_BUCKET,
  MEMBER_DOCUMENT_MAX_SIZE,
  MEMBER_DOCUMENT_TYPES,
} from "../constants/member-documents";
import type { MemberActionResponse } from "../types/member.types";

const FILE_TYPES: Record<string, string> = {
  pdf: "application/pdf",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
};

const documentTypeSchema = z.enum(
  MEMBER_DOCUMENT_TYPES.map(([value]) => value) as [
    (typeof MEMBER_DOCUMENT_TYPES)[number][0],
    ...(typeof MEMBER_DOCUMENT_TYPES)[number][0][],
  ],
);

const metadataSchema = z.object({
  memberId: z.uuid("Membro inválido."),
  documentId: z.uuid("Documento inválido.").optional(),
  type: documentTypeSchema,
  title: z
    .string()
    .trim()
    .min(3, "Informe um nome com pelo menos 3 caracteres.")
    .max(140, "Use no máximo 140 caracteres."),
  description: z.string().trim().max(500, "Use no máximo 500 caracteres."),
  sensitive: z.boolean(),
});

const prepareSchema = metadataSchema.extend({
  originalFileName: z.string().trim().min(1).max(255),
  fileSize: z
    .number()
    .int()
    .positive("Selecione um arquivo válido.")
    .max(MEMBER_DOCUMENT_MAX_SIZE, "O arquivo deve ter no máximo 10 MB."),
});

const finalizeSchema = prepareSchema.extend({
  uploadId: z.uuid("Envio inválido."),
  path: z.string().trim().min(1).max(700),
});

const cancelSchema = z.object({
  memberId: z.uuid("Membro inválido."),
  uploadId: z.uuid("Envio inválido."),
  path: z.string().trim().min(1).max(700),
  originalFileName: z.string().trim().min(1).max(255),
  fileSize: z.number().int().positive().max(MEMBER_DOCUMENT_MAX_SIZE),
});

type DocumentMetadata = z.infer<typeof metadataSchema>;
type DocumentPrepareInput = z.infer<typeof prepareSchema>;
type DocumentFinalizeInput = z.infer<typeof finalizeSchema>;

type DocumentRow = {
  id: string;
  member_id: string;
  document_type: string;
  title: string;
  description: string | null;
  file_name: string;
  storage_bucket: string;
  storage_path: string;
  mime_type: string | null;
  file_size: number | null;
  is_sensitive: boolean;
};

class MemberDocumentError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MemberDocumentError";
  }
}

function actionFailure(error: unknown, fallback: string): MemberActionResponse {
  if (error instanceof MemberDocumentError) {
    return { success: false, message: error.message };
  }
  console.error("[member-documents] unexpected failure", error);
  return { success: false, message: fallback };
}

function cleanOriginalFileName(name: string) {
  const baseName = name.replace(/\\/g, "/").split("/").pop() ?? "";
  return baseName.replace(/[\u0000-\u001f\u007f]/g, "").trim().slice(0, 255);
}

function validateUploadCandidate(originalName: string, fileSize: number) {
  if (!Number.isSafeInteger(fileSize) || fileSize <= 0) {
    throw new MemberDocumentError("Selecione um arquivo válido.");
  }
  if (fileSize > MEMBER_DOCUMENT_MAX_SIZE) {
    throw new MemberDocumentError("O arquivo deve ter no máximo 10 MB.");
  }

  const originalFileName = cleanOriginalFileName(originalName);
  const extension = originalFileName.split(".").pop()?.toLowerCase() ?? "";
  const mimeType = FILE_TYPES[extension];
  if (!originalFileName || !mimeType) {
    throw new MemberDocumentError(
      "Formato não permitido. Envie PDF, JPG, PNG ou WebP.",
    );
  }
  return { originalFileName, extension, mimeType };
}

function startsWith(buffer: Buffer, signature: number[]) {
  return signature.every((value, index) => buffer[index] === value);
}

function identifyBuffer(buffer: Buffer, originalName: string) {
  const candidate = validateUploadCandidate(originalName, buffer.length);
  let signatureMatches = false;

  if (candidate.extension === "pdf") {
    signatureMatches = startsWith(buffer, [0x25, 0x50, 0x44, 0x46, 0x2d]);
  } else if (["jpg", "jpeg"].includes(candidate.extension)) {
    signatureMatches = startsWith(buffer, [0xff, 0xd8, 0xff]);
  } else if (candidate.extension === "png") {
    signatureMatches = startsWith(buffer, [
      0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
    ]);
  } else if (candidate.extension === "webp") {
    signatureMatches =
      buffer.length >= 12 &&
      buffer.subarray(0, 4).toString("ascii") === "RIFF" &&
      buffer.subarray(8, 12).toString("ascii") === "WEBP";
  }

  if (!signatureMatches) {
    throw new MemberDocumentError(
      "O conteúdo do arquivo não corresponde ao formato informado.",
    );
  }

  return { ...candidate, fileSize: buffer.length };
}

function storagePath(
  churchId: string,
  memberId: string,
  uploadId: string,
  extension: string,
) {
  return `${churchId}/${memberId}/${uploadId}/${uploadId}.${extension}`;
}

async function authorizeMember(memberId: string) {
  const context = await requireAccessContext(PERMISSIONS.membersManageDocuments);
  const supabase = await createClient();
  const { data: member, error } = await supabase
    .from("members")
    .select("id")
    .eq("id", memberId)
    .eq("church_id", context.church.id)
    .is("deleted_at", null)
    .maybeSingle();

  if (error) {
    console.error("[member-documents] member authorization failed", {
      code: error.code,
      message: error.message,
    });
    throw new MemberDocumentError("Não foi possível validar o membro.");
  }
  if (!member) {
    throw new MemberDocumentError("Membro não encontrado ou fora do seu escopo.");
  }
  return { context, supabase };
}

async function getCurrentDocument(
  documentId: string,
  memberId: string,
  access: Awaited<ReturnType<typeof authorizeMember>>,
) {
  const { data, error } = await access.supabase
    .from("member_documents")
    .select(
      "id, member_id, document_type, title, description, file_name, storage_bucket, storage_path, mime_type, file_size, is_sensitive",
    )
    .eq("id", documentId)
    .eq("member_id", memberId)
    .eq("church_id", access.context.church.id)
    .is("deleted_at", null)
    .maybeSingle();

  if (error) {
    console.error("[member-documents] document lookup failed", {
      code: error.code,
      message: error.message,
    });
    throw new MemberDocumentError("Não foi possível localizar o documento.");
  }
  if (!data) throw new MemberDocumentError("Documento não encontrado.");
  return data as DocumentRow;
}

function validateSensitiveAccess(
  sensitive: boolean,
  permissions: string[],
) {
  if (
    sensitive &&
    !hasPermission(permissions, PERMISSIONS.membersViewSensitiveDocuments)
  ) {
    throw new MemberDocumentError(
      "Seu acesso não permite documentos sensíveis.",
    );
  }
}

export async function prepareMemberDocumentUploadAction(
  input: DocumentPrepareInput,
): Promise<
  MemberActionResponse<{
    uploadId: string;
    path: string;
    token: string;
    contentType: string;
  }>
> {
  const parsed = prepareSchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      message:
        parsed.error.issues[0]?.message ?? "Revise os dados do documento.",
    };
  }

  try {
    const access = await authorizeMember(parsed.data.memberId);
    validateSensitiveAccess(
      parsed.data.sensitive,
      access.context.permissions,
    );
    if (parsed.data.documentId) {
      await getCurrentDocument(
        parsed.data.documentId,
        parsed.data.memberId,
        access,
      );
    }

    const candidate = validateUploadCandidate(
      parsed.data.originalFileName,
      parsed.data.fileSize,
    );
    const uploadId = randomUUID();
    const path = storagePath(
      access.context.church.id,
      parsed.data.memberId,
      uploadId,
      candidate.extension,
    );
    const { data, error } = await access.supabase.storage
      .from(MEMBER_DOCUMENT_BUCKET)
      .createSignedUploadUrl(path, { upsert: false });

    if (error || !data) {
      console.error("[member-documents] signed upload URL failed", {
        code: error?.name,
        message: error?.message,
      });
      throw new MemberDocumentError(
        "Não foi possível preparar o envio do arquivo.",
      );
    }

    return {
      success: true,
      message: "Envio preparado.",
      data: {
        uploadId,
        path,
        token: data.token,
        contentType: candidate.mimeType,
      },
    };
  } catch (error) {
    return actionFailure(error, "Não foi possível preparar o documento.");
  }
}

export async function finalizeMemberDocumentUploadAction(
  input: DocumentFinalizeInput,
): Promise<MemberActionResponse> {
  const parsed = finalizeSchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      message:
        parsed.error.issues[0]?.message ?? "Não foi possível confirmar o envio.",
    };
  }

  let admin: ReturnType<typeof createAdminClient> | null = null;
  try {
    const access = await authorizeMember(parsed.data.memberId);
    validateSensitiveAccess(
      parsed.data.sensitive,
      access.context.permissions,
    );
    const candidate = validateUploadCandidate(
      parsed.data.originalFileName,
      parsed.data.fileSize,
    );
    const expectedPath = storagePath(
      access.context.church.id,
      parsed.data.memberId,
      parsed.data.uploadId,
      candidate.extension,
    );
    if (parsed.data.path !== expectedPath) {
      throw new MemberDocumentError("O envio preparado é inválido.");
    }
    admin = createAdminClient();
    const { data: uploadedFile, error: downloadError } = await admin.storage
      .from(MEMBER_DOCUMENT_BUCKET)
      .download(expectedPath);
    if (downloadError || !uploadedFile) {
      throw new MemberDocumentError(
        "O arquivo não foi recebido. Tente enviá-lo novamente.",
      );
    }

    const buffer = Buffer.from(await uploadedFile.arrayBuffer());
    const identity = identifyBuffer(buffer, parsed.data.originalFileName);
    const values = {
      document_type: parsed.data.type,
      title: parsed.data.title,
      description: parsed.data.description || null,
      file_name: identity.originalFileName,
      storage_bucket: MEMBER_DOCUMENT_BUCKET,
      storage_path: expectedPath,
      mime_type: identity.mimeType,
      file_size: identity.fileSize,
      is_sensitive: parsed.data.sensitive,
    };

    if (parsed.data.documentId) {
      const current = await getCurrentDocument(
        parsed.data.documentId,
        parsed.data.memberId,
        access,
      );
      const { count, error: updateError } = await access.supabase
        .from("member_documents")
        .update(values, { count: "exact" })
        .eq("id", current.id)
        .eq("member_id", parsed.data.memberId)
        .eq("church_id", access.context.church.id)
        .is("deleted_at", null);

      if (updateError || count !== 1) {
        await admin.storage.from(MEMBER_DOCUMENT_BUCKET).remove([expectedPath]);
        throw new MemberDocumentError(
          "O arquivo foi enviado, mas o documento não pôde ser atualizado.",
        );
      }

      const { error: oldFileError } = await admin.storage
        .from(current.storage_bucket)
        .remove([current.storage_path]);
      if (oldFileError) {
        await access.supabase
          .from("member_documents")
          .update({
            document_type: current.document_type,
            title: current.title,
            description: current.description,
            file_name: current.file_name,
            storage_bucket: current.storage_bucket,
            storage_path: current.storage_path,
            mime_type: current.mime_type,
            file_size: current.file_size,
            is_sensitive: current.is_sensitive,
          })
          .eq("id", current.id)
          .eq("church_id", access.context.church.id);
        await admin.storage.from(MEMBER_DOCUMENT_BUCKET).remove([expectedPath]);
        throw new MemberDocumentError(
          "A substituição foi desfeita porque o arquivo anterior não pôde ser removido.",
        );
      }
    } else {
      const { error: insertError } = await access.supabase
        .from("member_documents")
        .insert({
          id: parsed.data.uploadId,
          church_id: access.context.church.id,
          member_id: parsed.data.memberId,
          ...values,
          uploaded_by: access.context.profile.id,
        });
      if (insertError) {
        await admin.storage.from(MEMBER_DOCUMENT_BUCKET).remove([expectedPath]);
        throw new MemberDocumentError(
          "O arquivo foi removido porque o documento não pôde ser registrado.",
        );
      }
    }

    revalidatePath("/membros");
    return {
      success: true,
      message: parsed.data.documentId
        ? "Documento e arquivo atualizados."
        : "Documento enviado com sucesso.",
    };
  } catch (error) {
    if (admin && parsed.data?.path) {
      await admin.storage
        .from(MEMBER_DOCUMENT_BUCKET)
        .remove([parsed.data.path]);
    }
    return actionFailure(error, "Não foi possível confirmar o documento.");
  }
}

export async function cancelMemberDocumentUploadAction(
  input: z.infer<typeof cancelSchema>,
) {
  const parsed = cancelSchema.safeParse(input);
  if (!parsed.success) return;

  try {
    const access = await authorizeMember(parsed.data.memberId);
    const candidate = validateUploadCandidate(
      parsed.data.originalFileName,
      parsed.data.fileSize,
    );
    const expectedPath = storagePath(
      access.context.church.id,
      parsed.data.memberId,
      parsed.data.uploadId,
      candidate.extension,
    );
    if (expectedPath !== parsed.data.path) return;

    const { count } = await access.supabase
      .from("member_documents")
      .select("id", { count: "exact", head: true })
      .eq("storage_bucket", MEMBER_DOCUMENT_BUCKET)
      .eq("storage_path", expectedPath)
      .is("deleted_at", null);
    if (count) return;

    await createAdminClient().storage
      .from(MEMBER_DOCUMENT_BUCKET)
      .remove([expectedPath]);
  } catch (error) {
    console.error("[member-documents] pending upload cleanup failed", error);
  }
}

export async function updateMemberDocumentAction(
  documentId: string,
  input: DocumentMetadata,
): Promise<MemberActionResponse> {
  const parsedId = z.uuid().safeParse(documentId);
  const parsed = metadataSchema.safeParse(input);
  if (!parsedId.success || !parsed.success) {
    return { success: false, message: "Revise os dados do documento." };
  }

  try {
    const access = await authorizeMember(parsed.data.memberId);
    validateSensitiveAccess(
      parsed.data.sensitive,
      access.context.permissions,
    );
    await getCurrentDocument(documentId, parsed.data.memberId, access);
    const { count, error } = await access.supabase
      .from("member_documents")
      .update(
        {
          document_type: parsed.data.type,
          title: parsed.data.title,
          description: parsed.data.description || null,
          is_sensitive: parsed.data.sensitive,
        },
        { count: "exact" },
      )
      .eq("id", documentId)
      .eq("member_id", parsed.data.memberId)
      .eq("church_id", access.context.church.id)
      .is("deleted_at", null);
    if (error || count !== 1) {
      throw new MemberDocumentError("Não foi possível atualizar o documento.");
    }
    revalidatePath("/membros");
    return { success: true, message: "Documento atualizado." };
  } catch (error) {
    return actionFailure(error, "Não foi possível atualizar o documento.");
  }
}

export async function getMemberDocumentUrlAction(
  documentId: string,
): Promise<MemberActionResponse<{ url: string }>> {
  const context = await requireAccessContext(PERMISSIONS.membersViewFull);
  const supabase = await createClient();
  const { data: document } = await supabase
    .from("member_documents")
    .select("storage_bucket, storage_path")
    .eq("id", documentId)
    .eq("church_id", context.church.id)
    .is("deleted_at", null)
    .maybeSingle();
  if (!document) {
    return {
      success: false,
      message: "Documento não encontrado ou sem permissão de acesso.",
    };
  }
  const { data, error } = await supabase.storage
    .from(document.storage_bucket)
    .createSignedUrl(document.storage_path, 60);
  return error || !data
    ? { success: false, message: "Não foi possível abrir o documento." }
    : {
        success: true,
        message: "Link temporário criado.",
        data: { url: data.signedUrl },
      };
}

export async function deleteMemberDocumentAction(
  documentId: string,
): Promise<MemberActionResponse> {
  const context = await requireAccessContext(PERMISSIONS.membersManageDocuments);
  const supabase = await createClient();
  const { data: document } = await supabase
    .from("member_documents")
    .select("storage_bucket, storage_path, mime_type")
    .eq("id", documentId)
    .eq("church_id", context.church.id)
    .is("deleted_at", null)
    .maybeSingle();
  if (!document) return { success: false, message: "Documento não encontrado." };

  const { data: backup, error: downloadError } = await supabase.storage
    .from(document.storage_bucket)
    .download(document.storage_path);
  if (downloadError || !backup) {
    return {
      success: false,
      message: "Não foi possível preparar a exclusão com segurança.",
    };
  }
  const { error: removeError } = await supabase.storage
    .from(document.storage_bucket)
    .remove([document.storage_path]);
  if (removeError) {
    return { success: false, message: "Não foi possível remover o arquivo." };
  }

  const { count, error } = await supabase
    .from("member_documents")
    .update({ deleted_at: new Date().toISOString() }, { count: "exact" })
    .eq("id", documentId)
    .eq("church_id", context.church.id)
    .is("deleted_at", null);
  if (error || count !== 1) {
    await supabase.storage
      .from(document.storage_bucket)
      .upload(document.storage_path, backup, {
        contentType: document.mime_type ?? undefined,
        upsert: true,
      });
    return {
      success: false,
      message: "A exclusão foi desfeita porque o registro não pôde ser atualizado.",
    };
  }
  revalidatePath("/membros");
  return { success: true, message: "Documento excluído." };
}
