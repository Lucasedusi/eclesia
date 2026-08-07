"use server";

import { createClient } from "@/lib/supabase/server";
import { PERMISSIONS, hasPermission } from "@/modules/auth/constants/permissions";
import { requireAccessContext } from "@/modules/auth/services/access-context.service";
import type { MemberActionResponse } from "../types/member.types";

const BUCKET = "member-documents";
const MAX_BYTES = 10 * 1024 * 1024;
const ALLOWED_MIME = new Set(["application/pdf", "image/jpeg", "image/png", "image/webp"]);
const ALLOWED_TYPES = new Set(["PHOTO", "CPF", "RG", "BIRTH_CERTIFICATE", "MARRIAGE_CERTIFICATE", "TRANSFER_LETTER", "ADDRESS_PROOF", "BAPTISM_CERTIFICATE", "MEMBERSHIP_FORM", "OTHER"]);

function safeName(name: string) {
  const parts = name.split(".");
  const extension = parts.length > 1 ? `.${parts.pop()!.toLowerCase().replace(/[^a-z0-9]/g, "")}` : "";
  const base = parts.join(".").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9_-]/g, "-").replace(/-+/g, "-").slice(0, 80) || "arquivo";
  return `${base}${extension}`;
}

function getFile(formData: FormData) {
  const value = formData.get("file");
  return value instanceof File && value.size > 0 ? value : null;
}

function validateFile(file: File | null) {
  if (!file) return "Selecione um arquivo.";
  if (file.size > MAX_BYTES) return "O arquivo deve ter no máximo 10 MB.";
  if (!ALLOWED_MIME.has(file.type)) return "Envie um PDF, JPG, PNG ou WebP.";
  return null;
}

export async function uploadMemberDocumentAction(memberId: string, formData: FormData): Promise<MemberActionResponse> {
  const context = await requireAccessContext(PERMISSIONS.membersManageDocuments);
  const file = getFile(formData);
  const fileError = validateFile(file);
  if (fileError || !file) return { success: false, message: fileError ?? "Arquivo inválido." };
  const type = String(formData.get("type") ?? "OTHER");
  const title = String(formData.get("title") ?? "").trim();
  const sensitive = formData.get("sensitive") === "true";
  if (!ALLOWED_TYPES.has(type) || !title) return { success: false, message: "Informe o tipo e o título do documento." };
  if (sensitive && !hasPermission(context.permissions, PERMISSIONS.membersViewSensitiveDocuments)) {
    return { success: false, message: "Seu acesso não permite documentos sensíveis." };
  }

  const supabase = await createClient();
  const id = crypto.randomUUID();
  const path = `${context.church.id}/${memberId}/${id}/${safeName(file.name)}`;
  const { error: uploadError } = await supabase.storage.from(BUCKET).upload(path, file, { contentType: file.type, upsert: false });
  if (uploadError) return { success: false, message: "Não foi possível enviar o arquivo." };
  const { error } = await supabase.from("member_documents").insert({
    id, church_id: context.church.id, member_id: memberId, document_type: type, title,
    description: String(formData.get("description") ?? "").trim() || null,
    file_name: file.name, storage_bucket: BUCKET, storage_path: path, mime_type: file.type,
    file_size: file.size, is_sensitive: sensitive, uploaded_by: context.profile.id,
  });
  if (error) {
    await supabase.storage.from(BUCKET).remove([path]);
    return { success: false, message: "O arquivo foi removido porque não foi possível registrar o documento." };
  }
  return { success: true, message: "Documento enviado com sucesso." };
}

export async function updateMemberDocumentAction(documentId: string, formData: FormData): Promise<MemberActionResponse> {
  const context = await requireAccessContext(PERMISSIONS.membersManageDocuments);
  const supabase = await createClient();
  const { data: current } = await supabase.from("member_documents").select("*").eq("id", documentId).eq("church_id", context.church.id).is("deleted_at", null).maybeSingle();
  if (!current) return { success: false, message: "Documento não encontrado." };
  const type = String(formData.get("type") ?? current.document_type);
  const title = String(formData.get("title") ?? current.title).trim();
  const sensitive = formData.get("sensitive") === "true";
  if (!ALLOWED_TYPES.has(type) || !title) return { success: false, message: "Informe o tipo e o título." };
  if (sensitive && !hasPermission(context.permissions, PERMISSIONS.membersViewSensitiveDocuments)) return { success: false, message: "Seu acesso não permite documentos sensíveis." };

  const file = getFile(formData);
  let newPath = current.storage_path;
  let newFileName = current.file_name;
  let newMime = current.mime_type;
  let newSize = current.file_size;
  if (file) {
    const fileError = validateFile(file);
    if (fileError) return { success: false, message: fileError };
    newPath = `${context.church.id}/${current.member_id}/${documentId}/${safeName(file.name)}`;
    const { error: uploadError } = await supabase.storage.from(BUCKET).upload(newPath, file, { contentType: file.type, upsert: newPath === current.storage_path });
    if (uploadError) return { success: false, message: "Não foi possível enviar o novo arquivo." };
    newFileName = file.name; newMime = file.type; newSize = file.size;
  }
  const { error } = await supabase.from("member_documents").update({
    document_type: type, title, description: String(formData.get("description") ?? "").trim() || null,
    is_sensitive: sensitive, storage_path: newPath, file_name: newFileName, mime_type: newMime, file_size: newSize,
  }).eq("id", documentId);
  if (error) {
    if (file && newPath !== current.storage_path) await supabase.storage.from(BUCKET).remove([newPath]);
    return { success: false, message: "Não foi possível atualizar o documento." };
  }
  if (file && newPath !== current.storage_path) await supabase.storage.from(BUCKET).remove([current.storage_path]);
  return { success: true, message: "Documento atualizado." };
}

export async function getMemberDocumentUrlAction(documentId: string): Promise<MemberActionResponse<{ url: string }>> {
  const context = await requireAccessContext(PERMISSIONS.membersViewFull);
  const supabase = await createClient();
  const { data: document } = await supabase.from("member_documents").select("storage_bucket, storage_path").eq("id", documentId).eq("church_id", context.church.id).is("deleted_at", null).maybeSingle();
  if (!document) return { success: false, message: "Documento não encontrado ou sem permissão de acesso." };
  const { data, error } = await supabase.storage.from(document.storage_bucket).createSignedUrl(document.storage_path, 60);
  return error || !data ? { success: false, message: "Não foi possível abrir o documento." } : { success: true, message: "Link temporário criado.", data: { url: data.signedUrl } };
}

export async function deleteMemberDocumentAction(documentId: string): Promise<MemberActionResponse> {
  const context = await requireAccessContext(PERMISSIONS.membersManageDocuments);
  const supabase = await createClient();
  const { data: document } = await supabase.from("member_documents").select("storage_bucket, storage_path, mime_type").eq("id", documentId).eq("church_id", context.church.id).is("deleted_at", null).maybeSingle();
  if (!document) return { success: false, message: "Documento não encontrado." };
  const { data: backup, error: downloadError } = await supabase.storage.from(document.storage_bucket).download(document.storage_path);
  if (downloadError || !backup) return { success: false, message: "Não foi possível preparar a exclusão com segurança." };
  const { error: removeError } = await supabase.storage.from(document.storage_bucket).remove([document.storage_path]);
  if (removeError) return { success: false, message: "Não foi possível remover o arquivo." };
  const { error } = await supabase.from("member_documents").update({ deleted_at: new Date().toISOString() }).eq("id", documentId);
  if (error) {
    await supabase.storage.from(document.storage_bucket).upload(document.storage_path, backup, { contentType: document.mime_type ?? undefined, upsert: true });
    return { success: false, message: "A exclusão foi desfeita porque o registro não pôde ser atualizado." };
  }
  return { success: true, message: "Documento excluído." };
}
