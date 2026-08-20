"use server";

import { revalidatePath, updateTag } from "next/cache";
import { cacheTags } from "@/lib/cache-tags";
import { PERMISSIONS } from "@/modules/auth/constants/permissions";
import { requireAccessContext } from "@/modules/auth/services/access-context.service";
import {
  archiveConfiguration,
  cancelGroup,
  cancelRegistration,
  changeDeletionState,
  changeLifecycle,
  changePaymentStatus,
  createGroup,
  createRegistration,
  deletePayment,
  deleteEventDocument,
  finalizeEventBanner,
  finalizeEventDocument,
  getEventDocumentUrl,
  getPaymentReceiptUrl,
  prepareEventBanner,
  prepareEventDocument,
  preparePaymentReceipt,
  permanentlyDeleteEvent,
  recordPayment,
  registerCheckin,
  reissueQr,
  removeEventBanner,
  reverseCheckin,
  saveEvent,
  saveItem,
  saveQuota,
  searchEventMembers,
} from "../services/event.service";
import type { ActionResult, EventMemberReference } from "../types/event.types";
import {
  cancelRegistrationSchema,
  checkinSchema,
  eventFormSchema,
  groupSchema,
  itemSchema,
  lifecycleSchema,
  paymentSchema,
  paymentStatusSchema,
  quotaSchema,
  registrationSchema,
  reverseCheckinSchema,
} from "../validations/event.schemas";

function errorResult(error: unknown, fallback: string): ActionResult {
  console.error("[events] action failed", error instanceof Error ? { name: error.name, message: error.message } : { error: String(error) });
  return { status: "error", message: error instanceof Error && error.message ? error.message : fallback };
}

async function refresh(eventId?: string) {
  const context = await requireAccessContext(PERMISSIONS.eventsView);
  updateTag(cacheTags.events(context.church.id));
  if (eventId) {
    updateTag(cacheTags.event(context.church.id, eventId));
    updateTag(cacheTags.eventRegistrations(context.church.id, eventId));
    updateTag(cacheTags.eventPayments(context.church.id, eventId));
    updateTag(cacheTags.eventCheckins(context.church.id, eventId));
    updateTag(cacheTags.eventDocuments(context.church.id, eventId));
    revalidatePath(`/eventos/${eventId}`);
  }
  revalidatePath("/eventos");
}

export async function saveEventAction(input: unknown): Promise<ActionResult<{ id: string }>> {
  const parsed = eventFormSchema.safeParse(input);
  if (!parsed.success) return { status: "error", message: "Revise os dados do evento.", fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]> };
  try {
    const id = await saveEvent(parsed.data);
    await refresh(id);
    return { status: "success", message: parsed.data.id ? "Evento atualizado com sucesso." : "Rascunho criado com sucesso.", data: { id } };
  } catch (error) {
    return errorResult(error, "Não foi possível salvar o evento.") as ActionResult<{ id: string }>;
  }
}

export async function changeEventLifecycleAction(input: unknown): Promise<ActionResult> {
  const parsed = lifecycleSchema.safeParse(input);
  if (!parsed.success) return { status: "error", message: "Ação inválida." };
  try { await changeLifecycle(parsed.data.eventId, parsed.data.action, parsed.data.reason); await refresh(parsed.data.eventId); return { status: "success", message: "Situação do evento atualizada." }; }
  catch (error) { return errorResult(error, "Não foi possível alterar o evento."); }
}

export async function changeEventDeletionStateAction(eventId: string, action: "DELETE" | "RESTORE"): Promise<ActionResult> {
  try { await changeDeletionState(eventId, action); await refresh(); return { status: "success", message: action === "DELETE" ? "Evento enviado para a lixeira." : "Evento restaurado com sucesso." }; }
  catch (error) { return errorResult(error, "Não foi possível alterar o evento."); }
}

export async function permanentlyDeleteEventAction(eventId: string): Promise<ActionResult> {
  try {
    await permanentlyDeleteEvent(eventId);
    await refresh();
    return { status: "success", message: "Evento e todos os dados vinculados foram excluídos definitivamente." };
  } catch (error) {
    return errorResult(error, "Não foi possível excluir o evento definitivamente.");
  }
}

export async function createRegistrationAction(input: unknown): Promise<ActionResult<Record<string, unknown>>> {
  const parsed = registrationSchema.safeParse(input);
  if (!parsed.success) return { status: "error", message: "Revise os dados da inscrição.", fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]> };
  try { const data = await createRegistration(parsed.data); await refresh(parsed.data.eventId); return { status: "success", message: "Inscrição criada com sucesso.", data }; }
  catch (error) { return errorResult(error, "Não foi possível criar a inscrição.") as ActionResult<Record<string, unknown>>; }
}

export async function searchEventMembersAction(query: string): Promise<ActionResult<EventMemberReference[]>> {
  if (query.trim().length < 2) return { status: "success", message: "Digite ao menos dois caracteres.", data: [] };
  try { return { status: "success", message: "Busca concluída.", data: await searchEventMembers(query) }; }
  catch (error) { return errorResult(error, "Não foi possível pesquisar membros.") as ActionResult<EventMemberReference[]>; }
}

export async function createEventGroupAction(input: unknown): Promise<ActionResult<Record<string, unknown>>> {
  const parsed = groupSchema.safeParse(input);
  if (!parsed.success) return { status: "error", message: "Revise os dados do grupo e seus participantes.", fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]> };
  try { const data = await createGroup(parsed.data); await refresh(parsed.data.eventId); return { status: "success", message: "Grupo e inscrições criados com sucesso.", data }; }
  catch (error) { return errorResult(error, "Não foi possível criar o grupo.") as ActionResult<Record<string, unknown>>; }
}

export async function cancelEventGroupAction(groupId: string, eventId: string, reason: string): Promise<ActionResult> {
  if (reason.trim().length < 3) return { status: "error", message: "Informe o motivo do cancelamento." };
  try { await cancelGroup(groupId, reason); await refresh(eventId); return { status: "success", message: "Grupo e inscrições ativas cancelados." }; }
  catch (error) { return errorResult(error, "Não foi possível cancelar o grupo."); }
}

export async function cancelRegistrationAction(input: unknown, eventId: string): Promise<ActionResult> {
  const parsed = cancelRegistrationSchema.safeParse(input);
  if (!parsed.success) return { status: "error", message: "Informe um motivo válido." };
  try { await cancelRegistration(parsed.data.registrationId, parsed.data.reason); await refresh(eventId); return { status: "success", message: "Inscrição cancelada." }; }
  catch (error) { return errorResult(error, "Não foi possível cancelar a inscrição."); }
}

const receiptTypes = new Set(["application/pdf", "image/jpeg", "image/png", "image/webp"]);
export async function preparePaymentReceiptAction(eventId: string, file: { name: string; type: string; size: number }): Promise<ActionResult<{ path: string; token: string }>> {
  if (!receiptTypes.has(file.type) || file.size <= 0 || file.size > 10 * 1024 * 1024) return { status: "error", message: "Envie um comprovante PDF, JPG, PNG ou WEBP de até 10 MB." };
  try { return { status: "success", message: "Upload preparado.", data: await preparePaymentReceipt(eventId, file.name, file.type) }; }
  catch (error) { return errorResult(error, "Não foi possível preparar o comprovante.") as ActionResult<{ path: string; token: string }>; }
}

export async function recordPaymentAction(input: unknown): Promise<ActionResult> {
  const parsed = paymentSchema.safeParse(input);
  if (!parsed.success) return { status: "error", message: "Revise os dados do pagamento.", fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]> };
  try { await recordPayment(parsed.data); await refresh(parsed.data.eventId); return { status: "success", message: "Pagamento registrado com sucesso." }; }
  catch (error) { return errorResult(error, "Não foi possível registrar o pagamento."); }
}

export async function getPaymentReceiptUrlAction(eventId: string, paymentId: string): Promise<ActionResult<{ url: string }>> {
  try { return { status: "success", message: "Link gerado.", data: { url: await getPaymentReceiptUrl(eventId, paymentId) } }; }
  catch (error) { return errorResult(error, "Não foi possível abrir o comprovante.") as ActionResult<{ url: string }>; }
}

export async function deletePaymentAction(eventId: string, paymentId: string): Promise<ActionResult> {
  try { await deletePayment(eventId, paymentId); await refresh(eventId); return { status: "success", message: "Pagamento excluído e saldo da inscrição recalculado." }; }
  catch (error) { return errorResult(error, "Não foi possível excluir o pagamento."); }
}

export async function changePaymentStatusAction(input: unknown, eventId: string): Promise<ActionResult> {
  const parsed = paymentStatusSchema.safeParse(input);
  if (!parsed.success) return { status: "error", message: "Ação de pagamento inválida." };
  try { await changePaymentStatus(parsed.data.paymentId, parsed.data.status, parsed.data.reason); await refresh(eventId); return { status: "success", message: "Pagamento atualizado com sucesso." }; }
  catch (error) { return errorResult(error, "Não foi possível atualizar o pagamento."); }
}

export async function registerCheckinAction(input: unknown): Promise<ActionResult> {
  const parsed = checkinSchema.safeParse(input);
  if (!parsed.success) return { status: "error", message: parsed.error.issues[0]?.message ?? "Dados de check-in inválidos." };
  try { await registerCheckin(parsed.data.eventId, parsed.data.registrationId, parsed.data.qrToken, parsed.data.method, parsed.data.notes); await refresh(parsed.data.eventId); return { status: "success", message: "Check-in realizado com sucesso." }; }
  catch (error) { return errorResult(error, "Não foi possível realizar o check-in."); }
}

export async function reverseCheckinAction(input: unknown, eventId: string): Promise<ActionResult> {
  const parsed = reverseCheckinSchema.safeParse(input);
  if (!parsed.success) return { status: "error", message: "Informe o motivo da reversão." };
  try { await reverseCheckin(parsed.data.checkinId, parsed.data.reason); await refresh(eventId); return { status: "success", message: "Check-in revertido." }; }
  catch (error) { return errorResult(error, "Não foi possível reverter o check-in."); }
}

export async function reissueQrAction(registrationId: string, eventId: string): Promise<ActionResult<Record<string, unknown>>> {
  try { const data = await reissueQr(registrationId); await refresh(eventId); return { status: "success", message: "Credencial QR reemitida.", data }; }
  catch (error) { return errorResult(error, "Não foi possível reemitir a credencial.") as ActionResult<Record<string, unknown>>; }
}

export async function saveEventItemAction(input: unknown): Promise<ActionResult> {
  const parsed = itemSchema.safeParse(input);
  if (!parsed.success) return { status: "error", message: "Revise os dados do item.", fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]> };
  try { await saveItem(parsed.data); await refresh(parsed.data.eventId); return { status: "success", message: "Item salvo com sucesso." }; }
  catch (error) { return errorResult(error, "Não foi possível salvar o item."); }
}

export async function saveEventQuotaAction(input: unknown): Promise<ActionResult> {
  const parsed = quotaSchema.safeParse(input);
  if (!parsed.success) return { status: "error", message: "Revise os dados da meta.", fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]> };
  try { await saveQuota(parsed.data); await refresh(parsed.data.eventId); return { status: "success", message: "Meta salva com sucesso." }; }
  catch (error) { return errorResult(error, "Não foi possível salvar a meta."); }
}

export async function archiveEventConfigurationAction(input: { table: "event_items" | "event_congregation_quotas"; id: string; eventId: string }): Promise<ActionResult> {
  try { await archiveConfiguration(input.table, input.id, input.eventId); await refresh(input.eventId); return { status: "success", message: "Registro removido com sucesso." }; }
  catch (error) { return errorResult(error, "Não foi possível remover o registro."); }
}

const allowedDocumentTypes = new Set(["application/pdf", "image/jpeg", "image/png", "image/webp", "application/msword", "application/vnd.openxmlformats-officedocument.wordprocessingml.document", "application/vnd.ms-excel", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"]);
export async function prepareEventDocumentAction(input: { eventId: string; title: string; fileName: string; mimeType: string; fileSize: number }): Promise<ActionResult<{ id: string; path: string; token: string }>> {
  if (!input.title?.trim() || !allowedDocumentTypes.has(input.mimeType) || input.fileSize <= 0 || input.fileSize > 10 * 1024 * 1024) return { status: "error", message: "Arquivo inválido. Use um formato permitido com até 10 MB." };
  try { return { status: "success", message: "Upload preparado.", data: await prepareEventDocument(input.eventId, input) }; }
  catch (error) { return errorResult(error, "Não foi possível preparar o upload.") as ActionResult<{ id: string; path: string; token: string }>; }
}

export async function finalizeEventDocumentAction(eventId: string, documentId: string): Promise<ActionResult> { try { await finalizeEventDocument(eventId, documentId); await refresh(eventId); return { status: "success", message: "Documento enviado com sucesso." }; } catch (error) { return errorResult(error, "Não foi possível confirmar o documento."); } }
export async function getEventDocumentUrlAction(eventId: string, documentId: string): Promise<ActionResult<{ url: string }>> { try { return { status: "success", message: "Link gerado.", data: { url: await getEventDocumentUrl(eventId, documentId) } }; } catch (error) { return errorResult(error, "Não foi possível abrir o documento.") as ActionResult<{ url: string }>; } }
export async function deleteEventDocumentAction(eventId: string, documentId: string): Promise<ActionResult> { try { await deleteEventDocument(eventId, documentId); await refresh(eventId); return { status: "success", message: "Documento excluído." }; } catch (error) { return errorResult(error, "Não foi possível excluir o documento."); } }
export async function prepareEventBannerAction(eventId: string, file: { name: string; type: string; size: number }): Promise<ActionResult<{ path: string; token: string; fileName: string }>> { if (!["image/jpeg", "image/png", "image/webp"].includes(file.type) || file.size <= 0 || file.size > 5 * 1024 * 1024) return { status: "error", message: "Envie uma imagem JPG, PNG ou WEBP de até 5 MB." }; try { return { status: "success", message: "Banner preparado.", data: await prepareEventBanner(eventId, file.name, file.type) }; } catch (error) { return errorResult(error, "Não foi possível preparar o banner.") as ActionResult<{ path: string; token: string; fileName: string }>; } }
export async function finalizeEventBannerAction(eventId: string, path: string): Promise<ActionResult<{ url: string }>> { try { const url = await finalizeEventBanner(eventId, path); await refresh(eventId); return { status: "success", message: "Banner atualizado.", data: { url } }; } catch (error) { return errorResult(error, "Não foi possível confirmar o banner.") as ActionResult<{ url: string }>; } }
export async function removeEventBannerAction(eventId: string): Promise<ActionResult> { try { await removeEventBanner(eventId); await refresh(eventId); return { status: "success", message: "Banner removido." }; } catch (error) { return errorResult(error, "Não foi possível remover o banner."); } }
