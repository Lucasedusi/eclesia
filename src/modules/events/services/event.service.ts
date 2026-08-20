import "server-only";

import { Buffer } from "node:buffer";
import { randomUUID } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { PERMISSIONS } from "@/modules/auth/constants/permissions";
import { requireAccessContext } from "@/modules/auth/services/access-context.service";
import type { z } from "zod";
import type {
  CheckinRow,
  EventDetail,
  EventDocumentRow,
  EventItemRow,
  EventListData,
  EventMemberReference,
  EventQuotaRow,
  EventSummary,
  EventWorkspaceData,
  GroupRow,
  PaymentRow,
  RegistrationRow,
} from "../types/event.types";
import type {
  eventFormSchema,
  eventListSchema,
  groupSchema,
  itemSchema,
  paymentSchema,
  publicRegistrationSchema,
  quotaSchema,
  registrationSchema,
} from "../validations/event.schemas";

type RecordValue = Record<string, unknown>;
type EventForm = z.infer<typeof eventFormSchema>;
type RegistrationForm = z.infer<typeof registrationSchema>;
type PublicRegistrationForm = z.infer<typeof publicRegistrationSchema>;
type GroupForm = z.infer<typeof groupSchema>;
type PaymentForm = z.infer<typeof paymentSchema>;
type ItemForm = z.infer<typeof itemSchema>;
type QuotaForm = z.infer<typeof quotaSchema>;

export class EventServiceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "EventServiceError";
  }
}

function startsWith(buffer: Buffer, signature: number[]) {
  return signature.every((byte, index) => buffer[index] === byte);
}

function validUploadContent(buffer: Buffer, mimeType: string) {
  if (mimeType === "application/pdf") return startsWith(buffer, [0x25, 0x50, 0x44, 0x46, 0x2d]);
  if (mimeType === "image/jpeg") return startsWith(buffer, [0xff, 0xd8, 0xff]);
  if (mimeType === "image/png") return startsWith(buffer, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  if (mimeType === "image/webp") return buffer.length >= 12 && buffer.subarray(0, 4).toString("ascii") === "RIFF" && buffer.subarray(8, 12).toString("ascii") === "WEBP";
  if (mimeType === "application/msword" || mimeType === "application/vnd.ms-excel") return startsWith(buffer, [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]);
  if (mimeType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document") return startsWith(buffer, [0x50, 0x4b, 0x03, 0x04]) && buffer.includes(Buffer.from("word/"));
  if (mimeType === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet") return startsWith(buffer, [0x50, 0x4b, 0x03, 0x04]) && buffer.includes(Buffer.from("xl/"));
  return false;
}

function fail(error: { message?: string; code?: string } | null, fallback: string): never {
  const message = error?.message ?? "";
  const map: Record<string, string> = {
    EVENT_NOT_FOUND: "Evento não encontrado ou indisponível.",
    EVENT_ACCESS_DENIED: "Você não possui acesso a este evento.",
    EVENT_REGISTRATION_CLOSED: "As inscrições deste evento estão encerradas.",
    EVENT_CAPACITY_FULL: "Não há vagas disponíveis.",
    EVENT_REQUIRED_ITEM_MISSING: "Selecione todos os itens obrigatórios.",
    EVENT_ITEM_STOCK_EXCEEDED: "Um dos itens não possui estoque suficiente.",
    EVENT_REGISTRATION_DUPLICATE: "Já existe uma inscrição ativa para este participante.",
    EVENT_REGISTRATION_DUPLICATE_MEMBER: "Este membro já possui inscrição ativa.",
    EVENT_CHECKIN_ALREADY_EXISTS: "Este participante já realizou check-in.",
    EVENT_CHECKIN_REGISTRATION_NOT_CONFIRMED: "Somente inscrições confirmadas podem realizar check-in.",
    EVENT_PAYMENT_EXCEEDS_BALANCE: "O pagamento ultrapassa o saldo pendente.",
    EVENT_PAYMENT_ALREADY_SETTLED: "Esta inscrição já está totalmente paga.",
    EVENT_PAYMENT_NOT_FOUND: "O pagamento não foi encontrado ou já foi excluído.",
    EVENT_TRANSITION_INVALID: "Esta transição não é permitida no estado atual.",
    EVENT_NOT_READY_TO_PUBLISH: "Complete os dados obrigatórios antes de publicar.",
    EVENT_MEMBER_NOT_AVAILABLE: "O membro selecionado não está ativo ou não pertence à igreja.",
  };
  const translated = Object.entries(map).find(([key]) => message.includes(key))?.[1];
  throw new EventServiceError(translated ?? (error?.code === "23505" ? "Já existe um registro equivalente." : fallback));
}

function value(row: RecordValue, key: string) { return row[key]; }
function text(row: RecordValue, key: string) { const item = value(row, key); return typeof item === "string" ? item : null; }
function number(row: RecordValue, key: string) { const item = Number(value(row, key) ?? 0); return Number.isFinite(item) ? item : 0; }
function bool(row: RecordValue, key: string) { return Boolean(value(row, key)); }
function nested(row: RecordValue, key: string) { const item = row[key]; return (Array.isArray(item) ? item[0] : item) as RecordValue | null | undefined; }

function toSummary(row: RecordValue, counts?: Map<string, number>): EventSummary {
  const id = String(row.id);
  return {
    id,
    name: String(row.name),
    slug: text(row, "slug"),
    publicCode: String(row.public_code),
    eventType: String(row.event_type),
    visibility: String(row.visibility),
    scope: String(row.event_scope) as EventSummary["scope"],
    status: String(row.status) as EventSummary["status"],
    startsAt: String(row.starts_at),
    endsAt: text(row, "ends_at"),
    registrationStartsAt: text(row, "registration_starts_at"),
    registrationEndsAt: text(row, "registration_ends_at"),
    location: text(row, "location_name"),
    city: text(row, "city"),
    state: text(row, "state"),
    capacity: row.capacity === null ? null : number(row, "capacity"),
    occupied: counts?.get(id) ?? 0,
    waitlist: 0,
    bannerUrl: text(row, "banner_url"),
    deletedAt: text(row, "deleted_at"),
  };
}

function toDetail(row: RecordValue, counts?: Map<string, number>): EventDetail {
  return {
    ...toSummary(row, counts),
    churchId: String(row.church_id),
    description: text(row, "description"),
    timezone: String(row.timezone),
    registrationMode: String(row.registration_mode),
    requiresPayment: bool(row, "requires_payment"),
    requiresGroupResponsible: bool(row, "requires_group_responsible"),
    requiresPastorInfo: bool(row, "requires_pastor_info"),
    requiresGenderTotals: bool(row, "requires_gender_totals"),
    regionId: text(row, "region_id"),
    congregationId: text(row, "congregation_id"),
    ministryId: text(row, "ministry_id"),
    address: text(row, "address"),
    number: text(row, "number"),
    complement: text(row, "complement"),
    district: text(row, "district"),
    zipCode: text(row, "zip_code"),
    country: String(row.country ?? "Brasil"),
    notes: text(row, "notes"),
    settings: (row.settings ?? {}) as Record<string, unknown>,
  };
}

export async function listEvents(input: z.infer<typeof eventListSchema>): Promise<EventListData> {
  const context = await requireAccessContext(PERMISSIONS.eventsView);
  const supabase = await createClient();
  const from = (input.page - 1) * input.pageSize;
  let query = supabase.from("events").select("*", { count: "exact" }).eq("church_id", context.church.id);
  query = input.status === "DELETED" ? query.not("deleted_at", "is", null) : query.is("deleted_at", null);
  if (input.search) {
    const safeSearch = input.search.replace(/[,%()]/g, "");
    query = query.or(`name.ilike.%${safeSearch}%,city.ilike.%${safeSearch}%`);
  }
  if (input.status && input.status !== "DELETED") query = query.eq("status", input.status);
  if (input.type) query = query.eq("event_type", input.type);
  const [eventResult, statsResult] = await Promise.all([
    query.order("starts_at", { ascending: false }).range(from, from + input.pageSize - 1),
    supabase.rpc("get_event_stats", { p_church_id: context.church.id }),
  ]);
  if (eventResult.error) fail(eventResult.error, "Não foi possível carregar os eventos.");
  const rows = (eventResult.data ?? []) as RecordValue[];
  const ids = rows.map((row) => String(row.id));
  const counts = new Map<string, number>();
  if (ids.length) {
    const result = await supabase.from("event_registrations").select("event_id,status").in("event_id", ids).in("status", ["PENDING", "CONFIRMED", "CHECKED_IN"]).is("deleted_at", null);
    if (result.error) fail(result.error, "Não foi possível calcular a ocupação.");
    for (const registration of (result.data ?? []) as RecordValue[]) counts.set(String(registration.event_id), (counts.get(String(registration.event_id)) ?? 0) + 1);
  }
  const stats = (statsResult.data ?? {}) as RecordValue;
  return {
    events: rows.map((row) => toSummary(row, counts)),
    total: eventResult.count ?? 0,
    page: input.page,
    pageSize: input.pageSize,
    stats: { total: number(stats, "total"), draft: number(stats, "draft"), open: number(stats, "open"), upcoming: number(stats, "upcoming"), finished: number(stats, "finished"), cancelled: number(stats, "cancelled") },
  };
}

async function getEventRow(eventId: string, permission: string = PERMISSIONS.eventsView) {
  await requireAccessContext(permission);
  const supabase = await createClient();
  const { data, error } = await supabase.from("events").select("*").eq("id", eventId).is("deleted_at", null).maybeSingle();
  if (error || !data) fail(error, "Evento não encontrado ou indisponível.");
  return { supabase, row: data as RecordValue };
}

export async function getEvent(eventId: string) { const { row } = await getEventRow(eventId); return toDetail(row); }

export async function getEventFormOptions() {
  const context = await requireAccessContext(PERMISSIONS.eventsManage);
  const supabase = await createClient();
  const [regions, congregations, ministries] = await Promise.all([
    supabase.from("regions").select("id,name").eq("church_id", context.church.id).eq("status", "ACTIVE").is("deleted_at", null).order("name"),
    supabase.from("congregations").select("id,name,region_id").eq("church_id", context.church.id).eq("status", "ACTIVE").is("deleted_at", null).order("name"),
    supabase.from("ministries").select("id,name").eq("church_id", context.church.id).eq("status", "ACTIVE").is("deleted_at", null).order("name"),
  ]);
  const failed = [regions, congregations, ministries].find((item) => item.error);
  if (failed?.error) fail(failed.error, "Não foi possível carregar as opções do formulário.");
  return { regions: regions.data ?? [], congregations: congregations.data ?? [], ministries: ministries.data ?? [] };
}

export async function getEventWorkspace(eventId: string): Promise<EventWorkspaceData> {
  const context = await requireAccessContext(PERMISSIONS.eventsView);
  const { supabase, row } = await getEventRow(eventId);
  const can = (permission: string) => context.permissions.includes(permission);
  const empty = Promise.resolve({ data: [] as unknown[], error: null });
  const [registrations, registrationItems, groups, items, goals, payments, checkins, documents, regions, congregations] = await Promise.all([
    can(PERMISSIONS.eventRegistrationsView)
      ? supabase.from("event_registrations").select("*,congregations!event_registrations_congregation_tenant_fkey(id,name,region_id,regions(name))").eq("event_id", eventId).is("deleted_at", null).order("registered_at", { ascending: false }).limit(200)
      : empty,
    can(PERMISSIONS.eventRegistrationsView)
      ? supabase.from("event_registration_items").select("event_registration_id,event_item_id,event_items!event_registration_items_event_item_id_fkey(name)").eq("event_id", eventId).is("deleted_at", null).limit(2000)
      : empty,
    can(PERMISSIONS.eventRegistrationsView) ? supabase.from("event_groups").select("*").eq("event_id", eventId).is("deleted_at", null).order("created_at", { ascending: false }).limit(100) : empty,
    supabase.from("event_items").select("*").eq("event_id", eventId).is("deleted_at", null).order("sort_order").limit(100),
    supabase.from("event_congregation_quotas").select("*,congregations!event_congregation_quotas_target_fkey(name)").eq("event_id", eventId).is("deleted_at", null).limit(500),
    can(PERMISSIONS.eventPaymentsView) ? supabase.from("event_payments").select("*").eq("event_id", eventId).is("deleted_at", null).order("created_at", { ascending: false }).limit(300) : empty,
    can(PERMISSIONS.eventCheckin) || can(PERMISSIONS.eventRegistrationsView) ? supabase.from("event_checkins").select("*,event_registrations!event_checkins_registration_tenant_fkey(registration_number,participant_name)").eq("event_id", eventId).is("deleted_at", null).order("checked_in_at", { ascending: false }).limit(200) : empty,
    can(PERMISSIONS.eventDocumentsView) ? supabase.from("event_documents").select("*").eq("event_id", eventId).eq("upload_status", "ACTIVE").is("deleted_at", null).order("created_at", { ascending: false }).limit(200) : empty,
    supabase.from("regions").select("id,name").eq("church_id", context.church.id).eq("status", "ACTIVE").is("deleted_at", null).order("name").limit(200),
    supabase.from("congregations").select("id,name,region_id,regions(name)").eq("church_id", context.church.id).eq("status", "ACTIVE").is("deleted_at", null).order("name").limit(1000),
  ]);
  const failed = [registrations, registrationItems, groups, items, goals, payments, checkins, documents, regions, congregations].find((result) => result.error);
  if (failed?.error) fail(failed.error, "Não foi possível carregar o workspace do evento.");

  const registrationRows = (registrations.data ?? []) as RecordValue[];
  const selectedItemsByRegistration = new Map<string, { ids: string[]; names: string[] }>();
  for (const selectedItem of (registrationItems.data ?? []) as RecordValue[]) {
    const registrationId = String(selectedItem.event_registration_id);
    const current = selectedItemsByRegistration.get(registrationId) ?? { ids: [], names: [] };
    current.ids.push(String(selectedItem.event_item_id));
    const selectedItemReference = nested(selectedItem, "event_items");
    if (selectedItemReference?.name) current.names.push(String(selectedItemReference.name));
    selectedItemsByRegistration.set(registrationId, current);
  }
  const activeRows = registrationRows.filter((item) => ["PENDING", "CONFIRMED", "CHECKED_IN"].includes(String(item.status)));
  const usedByCongregation = new Map<string, number>();
  for (const item of activeRows) if (item.congregation_id) usedByCongregation.set(String(item.congregation_id), (usedByCongregation.get(String(item.congregation_id)) ?? 0) + 1);
  const counts = new Map([[eventId, activeRows.length]]);

  return {
    event: toDetail(row, counts),
    permissions: context.permissions,
    registrations: registrationRows.map((item): RegistrationRow => {
      const congregation = nested(item, "congregations");
      const region = congregation ? nested(congregation, "regions") : null;
      return {
        id: String(item.id), registrationNumber: text(item, "registration_number"), memberId: text(item, "member_id"), participantName: String(item.participant_name),
        participantType: item.member_id ? "MEMBER" : "VISITOR", participantGender: text(item, "participant_gender"), participantPhone: text(item, "participant_phone"),
        congregationId: text(item, "congregation_id"), congregationName: congregation ? text(congregation, "name") : null,
        regionId: congregation ? text(congregation, "region_id") : null, regionName: region ? text(region, "name") : null,
        preferredPaymentMethod: text(item, "preferred_payment_method"), status: String(item.status), paymentStatus: String(item.payment_status),
        totalAmount: number(item, "total_amount"), paidAmount: number(item, "paid_amount"), remainingAmount: number(item, "remaining_amount"),
        registeredAt: String(item.registered_at), groupId: text(item, "event_group_id"),
        itemIds: selectedItemsByRegistration.get(String(item.id))?.ids ?? [],
        itemNames: selectedItemsByRegistration.get(String(item.id))?.names ?? [],
      };
    }),
    groups: ((groups.data ?? []) as RecordValue[]).map((item): GroupRow => ({ id: String(item.id), responsibleName: String(item.responsible_name), originChurchName: text(item, "origin_church_name"), originCity: String(item.origin_city), originState: String(item.origin_state), total: number(item, "total_registrations"), status: String(item.status) })),
    items: ((items.data ?? []) as RecordValue[]).map((item): EventItemRow => ({ id: String(item.id), name: String(item.name), description: text(item, "description"), type: String(item.item_type), price: number(item, "price"), required: bool(item, "is_required"), active: bool(item, "is_active"), availableQuantity: item.available_quantity === null ? null : number(item, "available_quantity") })),
    quotas: ((goals.data ?? []) as RecordValue[]).map((item): EventQuotaRow => ({ id: String(item.id), label: String(nested(item, "congregations")?.name ?? "Congregação"), quotaTotal: number(item, "quota_total"), used: usedByCongregation.get(String(item.congregation_id)) ?? 0, targetId: String(item.congregation_id) })),
    payments: ((payments.data ?? []) as RecordValue[]).map((item): PaymentRow => ({ id: String(item.id), paymentNumber: text(item, "payment_number"), registrationId: text(item, "event_registration_id"), groupId: text(item, "event_group_id"), method: String(item.payment_method), status: String(item.payment_status), amount: number(item, "amount"), paidAt: text(item, "paid_at"), payerName: text(item, "payer_name"), receiptFileName: text(item, "receipt_file_name"), receiptMimeType: text(item, "receipt_mime_type"), receiptFileSize: item.receipt_file_size === null ? null : number(item, "receipt_file_size"), receiptStoragePath: text(item, "receipt_storage_path") })),
    checkins: ((checkins.data ?? []) as RecordValue[]).map((item): CheckinRow => { const registration = nested(item, "event_registrations"); return { id: String(item.id), registrationId: String(item.event_registration_id), registrationNumber: registration ? text(registration, "registration_number") : null, participantName: String(registration?.participant_name ?? "Participante"), method: String(item.checkin_method), checkedInAt: text(item, "checked_in_at"), status: String(item.status) }; }),
    documents: ((documents.data ?? []) as RecordValue[]).map((item): EventDocumentRow => ({ id: String(item.id), title: String(item.title), type: String(item.document_type), fileName: String(item.file_name), mimeType: text(item, "mime_type"), fileSize: item.file_size === null ? null : number(item, "file_size"), uploadedAt: String(item.uploaded_at) })),
    references: {
      regions: ((regions.data ?? []) as RecordValue[]).map((item) => ({ id: String(item.id), name: String(item.name) })),
      congregations: ((congregations.data ?? []) as RecordValue[]).map((item) => ({ id: String(item.id), name: String(item.name), regionId: text(item, "region_id"), regionName: text(nested(item, "regions") ?? {}, "name") })),
    },
  };
}

export async function searchEventMembers(query: string): Promise<EventMemberReference[]> {
  const normalized = query.trim().replace(/[,%()]/g, " ").replace(/\s+/g, " ");
  if (normalized.length < 2) return [];
  const context = await requireAccessContext(PERMISSIONS.eventRegistrationsManage);
  if (!context.permissions.includes(PERMISSIONS.membersViewBasic)) throw new EventServiceError("Você não possui permissão para pesquisar membros.");
  const supabase = await createClient();
  const result = await supabase.from("members")
    .select("id,full_name,gender,whatsapp,congregation_id,congregations!inner(id,name,region_id,regions(name))")
    .eq("church_id", context.church.id).eq("member_status", "ACTIVE").is("deleted_at", null)
    .ilike("full_name", `%${normalized}%`).order("full_name").limit(12);
  if (result.error) fail(result.error, "Não foi possível pesquisar os membros.");
  return ((result.data ?? []) as RecordValue[]).map((item) => {
    const congregation = nested(item, "congregations") ?? {};
    const region = nested(congregation, "regions");
    return { id: String(item.id), fullName: String(item.full_name), congregationId: String(congregation.id), congregationName: String(congregation.name), regionId: text(congregation, "region_id"), regionName: region ? text(region, "name") : null, phone: text(item, "whatsapp"), gender: text(item, "gender") };
  });
}

export async function saveEvent(input: EventForm) {
  const context = await requireAccessContext(PERMISSIONS.eventsManage);
  const supabase = await createClient();
  const payload = {
    church_id: context.church.id, name: input.name, slug: input.slug || null, description: input.description || null,
    event_type: input.eventType, visibility: input.visibility, event_scope: input.eventScope,
    region_id: input.eventScope === "REGION" ? input.regionId || null : null,
    congregation_id: input.eventScope === "CONGREGATION" ? input.congregationId || null : null,
    ministry_id: input.eventScope === "MINISTRY" ? input.ministryId || null : null,
    starts_at: new Date(input.startsAt).toISOString(), ends_at: input.endsAt ? new Date(input.endsAt).toISOString() : null,
    registration_starts_at: input.registrationStartsAt ? new Date(input.registrationStartsAt).toISOString() : null,
    registration_ends_at: input.registrationEndsAt ? new Date(input.registrationEndsAt).toISOString() : null,
    timezone: input.timezone, registration_mode: input.registrationMode, capacity: input.capacity === "" ? null : input.capacity,
    allow_waitlist: false, quota_mode: "NONE", uses_registration_batches: false,
    requires_payment: input.requiresPayment, allow_installments: false, max_installments: 1,
    requires_group_responsible: input.requiresGroupResponsible, requires_pastor_info: input.requiresPastorInfo, requires_gender_totals: input.requiresGenderTotals,
    location_name: input.locationName || null, zip_code: input.zipCode || null, address: input.address || null, number: input.number || null,
    complement: input.complement || null, district: input.district || null, city: input.city || null, state: input.state.toUpperCase() || null,
    country: input.country, notes: input.notes || null, updated_by: context.profile.id,
  };
  if (input.id) {
    const { data, error } = await supabase.from("events").update(payload).eq("id", input.id).select("id").single();
    if (error) fail(error, "Não foi possível atualizar o evento.");
    return String(data.id);
  }
  const { data, error } = await supabase.from("events").insert({ ...payload, status: "DRAFT", created_by: context.profile.id }).select("id").single();
  if (error) fail(error, "Não foi possível criar o evento.");
  return String(data.id);
}

export async function changeLifecycle(eventId: string, action: string, reason: string) { await getEventRow(eventId, PERMISSIONS.eventsPublish); const supabase = await createClient(); const { error } = await supabase.rpc("change_event_lifecycle", { p_event_id: eventId, p_action: action, p_reason: reason || null }); if (error) fail(error, "Não foi possível alterar o estado do evento."); }
export async function changeDeletionState(eventId: string, action: "DELETE" | "RESTORE") { const context = await requireAccessContext(PERMISSIONS.eventsManage); const supabase = await createClient(); const { error } = await supabase.rpc("change_event_deletion_state", { p_event_id: eventId, p_action: action }); if (error) fail(error, action === "DELETE" ? "Somente rascunhos sem dependências podem ir para a lixeira." : "Não foi possível restaurar o evento."); return context.church.id; }
export async function createRegistration(input: RegistrationForm) { await getEventRow(input.eventId, PERMISSIONS.eventRegistrationsManage); const supabase = await createClient(); const { data, error } = await supabase.rpc("create_event_registration", { p_event_id: input.eventId, p_payload: { ...input, participantType: input.participantKind, registrationSource: "INTERNAL" }, p_idempotency_key: randomUUID() }); if (error) fail(error, "Não foi possível criar a inscrição."); return data as RecordValue; }
export async function createGroup(input: GroupForm) { await getEventRow(input.eventId, PERMISSIONS.eventRegistrationsManage); const supabase = await createClient(); const { data, error } = await supabase.rpc("create_event_group", { p_event_id: input.eventId, p_payload: { originChurchName: input.originChurchName, originFieldName: input.originFieldName, originCity: input.originCity, originState: input.originState, responsibleName: input.responsibleName, responsiblePhone: input.responsiblePhone, responsibleEmail: input.responsibleEmail, pastorName: input.pastorName, pastorPhone: input.pastorPhone, notes: input.notes }, p_participants: input.participants.map((participant, index) => ({ ...participant, clientKey: String(index), participantCity: input.originCity, participantState: input.originState, registrationSource: "GROUP" })), p_idempotency_key: randomUUID() }); if (error) fail(error, "Não foi possível criar o grupo."); return data as RecordValue; }
export async function cancelGroup(id: string, reason: string) { const supabase = await createClient(); const { error } = await supabase.rpc("cancel_event_group", { p_group_id: id, p_reason: reason }); if (error) fail(error, "Não foi possível cancelar o grupo."); }
export async function cancelRegistration(id: string, reason: string) { const supabase = await createClient(); const { error } = await supabase.rpc("cancel_event_registration", { p_registration_id: id, p_reason: reason }); if (error) fail(error, "Não foi possível cancelar a inscrição."); }

export async function preparePaymentReceipt(eventId: string, fileName: string, mimeType: string) {
  if (!["application/pdf", "image/jpeg", "image/png", "image/webp"].includes(mimeType)) throw new EventServiceError("Formato de comprovante inválido.");
  const { supabase, row } = await getEventRow(eventId, PERMISSIONS.eventPaymentsManage);
  const safeName = fileName.replace(/[^a-zA-Z0-9._-]/g, "_").slice(-180);
  const path = `${String(row.church_id)}/events/${eventId}/payment-receipts/${randomUUID()}/${safeName}`;
  const { data, error } = await supabase.storage.from("event-documents").createSignedUploadUrl(path);
  if (error) fail(error, "Não foi possível preparar o comprovante.");
  return { path, token: data.token };
}

export async function recordPayment(input: PaymentForm) {
  const { supabase, row } = await getEventRow(input.eventId, PERMISSIONS.eventPaymentsManage);
  const expectedPrefix = `${String(row.church_id)}/events/${input.eventId}/payment-receipts/`;
  if (input.receiptPath) {
    if (!input.receiptPath.startsWith(expectedPrefix)) throw new EventServiceError("O comprovante não pertence a este evento.");
    const downloaded = await supabase.storage.from("event-documents").download(input.receiptPath);
    if (downloaded.error || !downloaded.data) fail(downloaded.error, "Não foi possível validar o comprovante.");
    const buffer = Buffer.from(await downloaded.data.arrayBuffer());
    if (buffer.length > 10 * 1024 * 1024 || buffer.length !== input.receiptFileSize || !validUploadContent(buffer, input.receiptMimeType)) {
      await supabase.storage.from("event-documents").remove([input.receiptPath]);
      throw new EventServiceError("O conteúdo do comprovante não corresponde ao arquivo informado.");
    }
  }
  const { error } = await supabase.rpc("record_event_registration_payment", { p_event_id: input.eventId, p_registration_id: input.registrationId, p_payload: input, p_idempotency_key: randomUUID() });
  if (error) {
    if (input.receiptPath) await supabase.storage.from("event-documents").remove([input.receiptPath]);
    fail(error, "Não foi possível registrar o pagamento.");
  }
}

export async function getPaymentReceiptUrl(eventId: string, paymentId: string) {
  const { supabase } = await getEventRow(eventId, PERMISSIONS.eventPaymentsView);
  const result = await supabase.from("event_payments").select("receipt_storage_path").eq("id", paymentId).eq("event_id", eventId).is("deleted_at", null).single();
  if (result.error || !result.data.receipt_storage_path) fail(result.error, "Comprovante indisponível.");
  const signed = await supabase.storage.from("event-documents").createSignedUrl(result.data.receipt_storage_path, 60);
  if (signed.error) fail(signed.error, "Não foi possível abrir o comprovante.");
  return signed.data.signedUrl;
}

export async function changePaymentStatus(id: string, status: string, reason: string) { const supabase = await createClient(); const { error } = await supabase.rpc("change_event_payment_status", { p_payment_id: id, p_status: status, p_reason: reason || null }); if (error) fail(error, "Não foi possível alterar o pagamento."); }
export async function deletePayment(eventId: string, paymentId: string) {
  await getEventRow(eventId, PERMISSIONS.eventPaymentsManage);
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("delete_event_payment", { p_event_id: eventId, p_payment_id: paymentId });
  if (error) fail(error, "Não foi possível excluir o pagamento.");
  const receiptPath = typeof data === "string" ? data : "";
  if (receiptPath) {
    const removal = await createAdminClient().storage.from("event-documents").remove([receiptPath]);
    if (removal.error) console.error("[events] orphaned payment receipt", { eventId, paymentId, message: removal.error.message });
  }
}
export async function registerCheckin(eventId: string, registrationId: string, qrToken: string, method: string, notes: string) { await getEventRow(eventId, PERMISSIONS.eventCheckin); const supabase = await createClient(); const { error } = await supabase.rpc("register_event_checkin", { p_event_id: eventId, p_registration_id: registrationId || null, p_qr_token: qrToken || null, p_method: method, p_notes: notes || null, p_idempotency_key: randomUUID() }); if (error) fail(error, "Não foi possível realizar o check-in."); }
export async function reverseCheckin(id: string, reason: string) { const supabase = await createClient(); const { error } = await supabase.rpc("reverse_event_checkin", { p_checkin_id: id, p_reason: reason }); if (error) fail(error, "Não foi possível reverter o check-in."); }
export async function reissueQr(id: string) { const supabase = await createClient(); const { data, error } = await supabase.rpc("reissue_event_registration_qr", { p_registration_id: id }); if (error) fail(error, "Não foi possível reemitir o QR Code."); return data as RecordValue; }

export async function saveItem(input: ItemForm) { const { supabase, row } = await getEventRow(input.eventId, PERMISSIONS.eventsManage); const actor = (await requireAccessContext()).profile.id; const payload = { church_id: String(row.church_id), event_id: input.eventId, name: input.name, description: input.description || null, item_type: input.itemType, price: input.price, is_required: input.isRequired, is_active: input.isActive, allow_quantity: input.allowQuantity, min_quantity: input.minQuantity, max_quantity: input.maxQuantity === "" ? null : input.maxQuantity, available_quantity: input.availableQuantity === "" ? null : input.availableQuantity, updated_by: actor }; const result = input.id ? await supabase.from("event_items").update(payload).eq("id", input.id).eq("event_id", input.eventId) : await supabase.from("event_items").insert({ ...payload, created_by: actor }); if (result.error) fail(result.error, "Não foi possível salvar o item."); }
export async function saveQuota(input: QuotaForm) { const { supabase, row } = await getEventRow(input.eventId, PERMISSIONS.eventsManage); const actor = (await requireAccessContext()).profile.id; const payload = { church_id: String(row.church_id), event_id: input.eventId, congregation_id: input.congregationId, quota_total: input.quotaTotal, updated_by: actor }; const result = input.id ? await supabase.from("event_congregation_quotas").update(payload).eq("id", input.id).eq("event_id", input.eventId) : await supabase.from("event_congregation_quotas").insert({ ...payload, created_by: actor }); if (result.error) fail(result.error, "Não foi possível salvar a meta."); }
export async function archiveConfiguration(table: "event_items" | "event_congregation_quotas", id: string, eventId: string) {
  const context = await requireAccessContext(PERMISSIONS.eventsManage);
  await getEventRow(eventId, PERMISSIONS.eventsManage);
  const admin = createAdminClient();
  const changes: Record<string, unknown> = {
    deleted_at: new Date().toISOString(),
    deleted_by: context.profile.id,
    updated_by: context.profile.id,
  };
  if (table === "event_items") changes.is_active = false;
  const { data, error } = await admin
    .from(table)
    .update(changes)
    .eq("id", id)
    .eq("event_id", eventId)
    .eq("church_id", context.church.id)
    .is("deleted_at", null)
    .select("id")
    .maybeSingle();
  if (error || !data) fail(error, "Não foi possível remover o registro.");
}

export async function permanentlyDeleteEvent(eventId: string) {
  const context = await requireAccessContext(PERMISSIONS.eventsManage);
  const supabase = await createClient();
  const eventResult = await supabase
    .from("events")
    .select("id,church_id,name,deleted_at,banner_storage_bucket,banner_storage_path")
    .eq("id", eventId)
    .eq("church_id", context.church.id)
    .not("deleted_at", "is", null)
    .maybeSingle();
  if (eventResult.error || !eventResult.data) fail(eventResult.error, "O evento precisa estar na lixeira para ser excluído definitivamente.");

  const admin = createAdminClient();
  const [documents, receipts] = await Promise.all([
    admin.from("event_documents").select("storage_bucket,storage_path").eq("event_id", eventId),
    admin.from("event_payments").select("receipt_storage_path").eq("event_id", eventId).not("receipt_storage_path", "is", null),
  ]);
  const lookupError = documents.error ?? receipts.error;
  if (lookupError) fail(lookupError, "Não foi possível localizar os arquivos vinculados ao evento.");

  const pathsByBucket = new Map<string, Set<string>>();
  const appendPath = (bucket: string | null | undefined, path: string | null | undefined) => {
    if (!bucket || !path) return;
    const paths = pathsByBucket.get(bucket) ?? new Set<string>();
    paths.add(path);
    pathsByBucket.set(bucket, paths);
  };
  appendPath(eventResult.data.banner_storage_bucket, eventResult.data.banner_storage_path);
  for (const document of documents.data ?? []) appendPath(document.storage_bucket, document.storage_path);
  for (const receipt of receipts.data ?? []) appendPath("event-documents", receipt.receipt_storage_path);

  for (const [bucket, pathSet] of pathsByBucket) {
    const paths = [...pathSet];
    for (let offset = 0; offset < paths.length; offset += 1000) {
      const removal = await admin.storage.from(bucket).remove(paths.slice(offset, offset + 1000));
      if (removal.error) fail(removal.error, "Não foi possível remover os arquivos do evento. A exclusão foi interrompida.");
    }
  }

  const deleted = await admin
    .from("events")
    .delete()
    .eq("id", eventId)
    .eq("church_id", context.church.id)
    .not("deleted_at", "is", null)
    .select("id")
    .maybeSingle();
  if (deleted.error || !deleted.data) fail(deleted.error, "Não foi possível excluir o evento definitivamente.");
}

export async function getPublicEvent(publicCode: string, slug: string) {
  const admin = createAdminClient();
  const { data, error } = await admin.from("events").select("*").eq("public_code", publicCode).eq("slug", slug).eq("visibility", "PUBLIC").in("status", ["PUBLISHED", "REGISTRATION_OPEN", "REGISTRATION_CLOSED", "IN_PROGRESS", "FINISHED"]).is("deleted_at", null).maybeSingle();
  if (error || !data) return null;
  const event = toDetail(data as RecordValue);
  const [items, congregations] = await Promise.all([
    admin.from("event_items").select("id,name,description,item_type,price,is_required,allow_quantity,min_quantity,max_quantity,available_quantity").eq("event_id", event.id).eq("is_active", true).is("deleted_at", null).order("sort_order"),
    admin.from("congregations").select("id,name,region_id,regions(name)").eq("church_id", event.churchId).eq("status", "ACTIVE").is("deleted_at", null).order("name"),
  ]);
  return {
    event,
    items: items.data ?? [],
    congregations: ((congregations.data ?? []) as RecordValue[]).map((item) => ({ id: String(item.id), name: String(item.name), regionId: text(item, "region_id"), regionName: text(nested(item, "regions") ?? {}, "name") })),
    isRegistrationOpen: event.status === "REGISTRATION_OPEN" && (!event.registrationStartsAt || Date.now() >= Date.parse(event.registrationStartsAt)) && (!event.registrationEndsAt || Date.now() <= Date.parse(event.registrationEndsAt)),
  };
}

export async function createPublicRegistration(publicCode: string, slug: string, input: PublicRegistrationForm, idempotencyKey: string) { const publicEvent = await getPublicEvent(publicCode, slug); if (!publicEvent || publicEvent.event.id !== input.eventId) throw new EventServiceError("Evento público indisponível."); const admin = createAdminClient(); const { data, error } = await admin.rpc("create_event_registration", { p_event_id: input.eventId, p_payload: { ...input, participantType: "VISITOR", registrationSource: "PUBLIC", consentAccepted: true }, p_idempotency_key: idempotencyKey }); if (error) fail(error, "Não foi possível concluir a inscrição."); return data as RecordValue; }
export async function createPublicGroup(publicCode: string, slug: string, input: GroupForm, idempotencyKey: string) { const publicEvent = await getPublicEvent(publicCode, slug); if (!publicEvent || publicEvent.event.id !== input.eventId) throw new EventServiceError("Evento público indisponível."); const admin = createAdminClient(); const { data, error } = await admin.rpc("create_event_group", { p_event_id: input.eventId, p_payload: { originChurchName: input.originChurchName, originFieldName: input.originFieldName, originCity: input.originCity, originState: input.originState, responsibleName: input.responsibleName, responsiblePhone: input.responsiblePhone, responsibleEmail: input.responsibleEmail, pastorName: input.pastorName, pastorPhone: input.pastorPhone, notes: input.notes }, p_participants: input.participants.map((participant, index) => ({ ...participant, clientKey: String(index), participantCity: input.originCity, participantState: input.originState, registrationSource: "GROUP", consentAccepted: true, consentVersion: "2026-08" })), p_idempotency_key: idempotencyKey }); if (error) fail(error, "Não foi possível concluir a inscrição do grupo."); return data as RecordValue; }
export async function consumePublicRegistrationRateLimit(eventId: string, keyHash: string) { const admin = createAdminClient(); const { data, error } = await admin.rpc("consume_event_public_limit", { p_event_id: eventId, p_key_hash: keyHash, p_limit: 8, p_window_seconds: 600 }); if (error) fail(error, "Não foi possível validar a tentativa."); return data === true; }

export async function prepareEventDocument(eventId: string, input: { title: string; fileName: string; mimeType: string; fileSize: number }) {
  const { supabase, row } = await getEventRow(eventId, PERMISSIONS.eventDocumentsManage);
  const context = await requireAccessContext();
  const id = randomUUID();
  const safeName = input.fileName.replace(/[^a-zA-Z0-9._-]/g, "_").slice(-180);
  const path = `${String(row.church_id)}/events/${eventId}/documents/${id}/${safeName}`;
  const { error: insertError } = await supabase.from("event_documents").insert({ id, church_id: String(row.church_id), event_id: eventId, document_type: "OTHER", title: input.title, file_name: safeName, storage_bucket: "event-documents", storage_path: path, pending_storage_path: path, mime_type: input.mimeType, file_size: input.fileSize, is_sensitive: false, status: "ACTIVE", upload_status: "PENDING", pending_by: context.profile.id, pending_expires_at: new Date(Date.now() + 30 * 60_000).toISOString(), uploaded_by: context.profile.id, updated_by: context.profile.id });
  if (insertError) fail(insertError, "Não foi possível preparar o documento.");
  const { data, error } = await supabase.storage.from("event-documents").createSignedUploadUrl(path);
  if (error) fail(error, "Não foi possível preparar o upload.");
  return { id, path, token: data.token };
}

export async function prepareEventBanner(eventId: string, fileName: string, mimeType: string) { const { supabase, row } = await getEventRow(eventId, PERMISSIONS.eventsManage); const extension = mimeType === "image/png" ? "png" : mimeType === "image/webp" ? "webp" : "jpg"; const path = `${String(row.church_id)}/events/${eventId}/banner/${randomUUID()}.${extension}`; const { data, error } = await supabase.storage.from("event-public-media").createSignedUploadUrl(path); if (error) fail(error, "Não foi possível preparar o banner."); return { path, token: data.token, fileName }; }
export async function finalizeEventBanner(eventId: string, path: string) { const { supabase, row } = await getEventRow(eventId, PERMISSIONS.eventsManage); const downloaded = await supabase.storage.from("event-public-media").download(path); if (downloaded.error || !downloaded.data) fail(downloaded.error, "Não foi possível validar o banner."); const buffer = Buffer.from(await downloaded.data.arrayBuffer()); const mime = path.endsWith(".png") ? "image/png" : path.endsWith(".webp") ? "image/webp" : "image/jpeg"; if (buffer.length > 5 * 1024 * 1024 || !validUploadContent(buffer, mime)) { await supabase.storage.from("event-public-media").remove([path]); throw new EventServiceError("O conteúdo do banner não corresponde ao formato informado."); } const publicUrl = supabase.storage.from("event-public-media").getPublicUrl(path).data.publicUrl; const { error } = await supabase.from("events").update({ banner_url: publicUrl, banner_storage_bucket: "event-public-media", banner_storage_path: path }).eq("id", eventId); if (error) fail(error, "Não foi possível confirmar o banner."); const previousPath = text(row, "banner_storage_path"); if (previousPath && previousPath !== path) await supabase.storage.from("event-public-media").remove([previousPath]); return publicUrl; }
export async function removeEventBanner(eventId: string) { const { supabase, row } = await getEventRow(eventId, PERMISSIONS.eventsManage); const path = text(row, "banner_storage_path"); const result = await supabase.from("events").update({ banner_url: null, banner_storage_bucket: null, banner_storage_path: null }).eq("id", eventId); if (result.error) fail(result.error, "Não foi possível remover o banner."); if (path) await supabase.storage.from("event-public-media").remove([path]); }
export async function finalizeEventDocument(eventId: string, documentId: string) { const { supabase } = await getEventRow(eventId, PERMISSIONS.eventDocumentsManage); const documentResult = await supabase.from("event_documents").select("storage_bucket,storage_path,mime_type,file_size").eq("id", documentId).eq("event_id", eventId).eq("upload_status", "PENDING").single(); if (documentResult.error) fail(documentResult.error, "Documento pendente não encontrado."); const downloaded = await supabase.storage.from(documentResult.data.storage_bucket).download(documentResult.data.storage_path); if (downloaded.error || !downloaded.data) fail(downloaded.error, "Não foi possível validar o documento."); const buffer = Buffer.from(await downloaded.data.arrayBuffer()); if (buffer.length > 10 * 1024 * 1024 || buffer.length !== Number(documentResult.data.file_size) || !documentResult.data.mime_type || !validUploadContent(buffer, documentResult.data.mime_type)) { await supabase.storage.from(documentResult.data.storage_bucket).remove([documentResult.data.storage_path]); await supabase.from("event_documents").update({ upload_status: "FAILED" }).eq("id", documentId); throw new EventServiceError("O conteúdo do arquivo não corresponde ao formato informado."); } const { error } = await supabase.from("event_documents").update({ upload_status: "ACTIVE", pending_storage_path: null, pending_by: null, pending_expires_at: null, uploaded_at: new Date().toISOString() }).eq("id", documentId).eq("event_id", eventId).eq("upload_status", "PENDING"); if (error) fail(error, "Não foi possível confirmar o documento."); }
export async function getEventDocumentUrl(eventId: string, documentId: string) { const { supabase } = await getEventRow(eventId, PERMISSIONS.eventDocumentsView); const { data: document, error } = await supabase.from("event_documents").select("storage_bucket,storage_path").eq("id", documentId).eq("event_id", eventId).eq("upload_status", "ACTIVE").is("deleted_at", null).single(); if (error) fail(error, "Documento indisponível."); const signed = await supabase.storage.from(document.storage_bucket).createSignedUrl(document.storage_path, 60); if (signed.error) fail(signed.error, "Não foi possível abrir o documento."); return signed.data.signedUrl; }
export async function deleteEventDocument(eventId: string, documentId: string) { const { supabase } = await getEventRow(eventId, PERMISSIONS.eventDocumentsManage); const context = await requireAccessContext(); const { data, error } = await supabase.from("event_documents").update({ deleted_at: new Date().toISOString(), deleted_by: context.profile.id, updated_by: context.profile.id }).eq("id", documentId).eq("event_id", eventId).select("storage_bucket,storage_path").single(); if (error) fail(error, "Não foi possível excluir o documento."); await supabase.storage.from(data.storage_bucket).remove([data.storage_path]); }
export async function cleanupStaleEventUploads() { const admin = createAdminClient(); const { data, error } = await admin.from("event_documents").select("id,storage_bucket,storage_path").in("upload_status", ["PENDING", "FAILED"]).or(`pending_expires_at.lt.${new Date().toISOString()},upload_status.eq.FAILED`).limit(100); if (error) fail(error, "Não foi possível localizar uploads pendentes."); let removed = 0; for (const document of data ?? []) { await admin.storage.from(document.storage_bucket).remove([document.storage_path]); const deleted = await admin.from("event_documents").delete().eq("id", document.id).in("upload_status", ["PENDING", "FAILED"]); if (!deleted.error) removed += 1; } return { examined: data?.length ?? 0, removed }; }

export async function loadEventReport(eventId: string) { await requireAccessContext(PERMISSIONS.eventReportsExport); return getEventWorkspace(eventId); }
