import "server-only";

import { Buffer } from "node:buffer";
import { createHash, randomUUID } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { PERMISSIONS } from "@/modules/auth/constants/permissions";
import { requireAccessContext } from "@/modules/auth/services/access-context.service";
import type { z } from "zod";
import type {
  CheckinRow,
  EventDetail,
  EventDocumentRow,
  EventExpenseRow,
  EventItemRow,
  EventListData,
  EventMemberReference,
  EventQuotaRow,
  EventRegistrationFieldRow,
  EventSummary,
  EventWorkspaceData,
  GroupRow,
  PaymentRow,
  RegistrationRow,
} from "../types/event.types";
import type {
  eventFormSchema,
  caravanPaymentSchema,
  eventListSchema,
  groupSchema,
  itemSchema,
  paymentSchema,
  expenseSchema,
  publicRegistrationSchema,
  publicCaravanSchema,
  publicCaravanDraftSchema,
  quotaSchema,
  registrationSchema,
  updateRegistrationSchema,
} from "../validations/event.schemas";
import { buildRegistrationPaymentPayload, retryPublicCaravanStorageRead } from "../utils/payment-payload";

type RecordValue = Record<string, unknown>;
type EventForm = z.infer<typeof eventFormSchema>;
type RegistrationForm = z.infer<typeof registrationSchema>;
type PublicRegistrationForm = z.infer<typeof publicRegistrationSchema>;
type GroupForm = z.infer<typeof groupSchema>;
type CaravanPaymentForm = z.infer<typeof caravanPaymentSchema>;
type PublicCaravanForm = z.infer<typeof publicCaravanSchema>;
type PublicCaravanDraftForm = z.infer<typeof publicCaravanDraftSchema>;
type PaymentForm = z.infer<typeof paymentSchema>;
type ExpenseForm = z.infer<typeof expenseSchema>;
type UpdateRegistrationForm = z.infer<typeof updateRegistrationSchema>;
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
    EVENT_REGISTRATION_DUPLICATE_DOCUMENT: "Já existe uma inscrição ativa com este documento.",
    EVENT_CHECKIN_ALREADY_EXISTS: "Este participante já realizou check-in.",
    EVENT_CHECKIN_REGISTRATION_NOT_CONFIRMED: "Somente inscrições confirmadas podem realizar check-in.",
    EVENT_PAYMENT_EXCEEDS_BALANCE: "O pagamento ultrapassa o saldo pendente.",
    EVENT_PAYMENT_ALREADY_SETTLED: "Esta inscrição já está totalmente paga.",
    EVENT_PAYMENT_NOT_FOUND: "O pagamento não foi encontrado ou já foi excluído.",
    EVENT_TRANSITION_INVALID: "Esta transição não é permitida no estado atual.",
    EVENT_REGISTRATIONS_MUST_BE_CLOSED: "Encerre manualmente as inscrições antes de finalizar ou cancelar o evento.",
    EVENT_REGISTRATION_STATE_INVALID: "As inscrições só podem ser abertas em eventos publicados ou em andamento.",
    EVENT_NOT_READY_TO_PUBLISH: "Complete os dados obrigatórios antes de publicar.",
    EVENT_MEMBER_NOT_AVAILABLE: "O membro selecionado não está ativo ou não pertence à igreja.",
    EVENT_REGISTRATION_CONFLICT: "Esta inscrição foi alterada por outra pessoa. Recarregue a página e tente novamente.",
    EVENT_REGISTRATION_READ_ONLY: "Inscrições canceladas não podem ser editadas.",
    EVENT_TOTAL_BELOW_CONFIRMED_PAYMENTS: "O novo total não pode ser menor que o valor já pago.",
    EVENT_REQUIRED_FIELD_MISSING: "Preencha todos os campos obrigatórios do formulário.",
    EVENT_CUSTOM_FIELDS_INVALID: "As respostas personalizadas enviadas são inválidas.",
    EVENT_CUSTOM_FIELD_NOT_AVAILABLE: "O formulário foi alterado. Recarregue a página e tente novamente.",
    EVENT_CUSTOM_FIELD_VALUE_INVALID: "Revise o valor informado em um dos campos personalizados.",
    EVENT_ITEM_QUANTITY_INVALID: "Revise as quantidades dos itens selecionados.",
    EVENT_FIELD_STRUCTURE_LOCKED: "A chave e o tipo do campo não podem ser alterados após as primeiras inscrições.",
    EVENT_FIELD_HAS_ANSWERS: "Este campo possui respostas e deve ser apenas desativado.",
    EVENT_NEW_FIELD_MUST_BE_OPTIONAL: "Novos campos devem ser opcionais quando o evento já possui inscrições.",
    EVENT_CUSTOM_FIELD_LIMIT: "O formulário aceita no máximo 20 campos personalizados ativos.",
    EVENT_CARAVAN_REGISTRATION_DISABLED: "Este evento não aceita caravanas.",
    EVENT_CARAVAN_TOTALS_INVALID: "O total deve ser igual à soma de masculino e feminino.",
    EVENT_CARAVAN_FIELDS_REQUIRED: "Preencha todos os dados obrigatórios da caravana.",
    EVENT_CARAVAN_MAIN_ITEM_INVALID: "O item principal deve acompanhar a quantidade de participantes.",
    EVENT_CARAVAN_MAIN_ITEM_REQUIRED: "Configure o item principal da caravana antes de receber inscrições.",
    EVENT_CARAVAN_NOT_FOUND: "A caravana não foi encontrada ou já foi cancelada.",
    EVENT_CARAVAN_TOTAL_BELOW_PAID: "O novo total não pode ser menor que o valor já pago.",
    EVENT_CONCURRENT_UPDATE: "Esta caravana foi alterada por outra pessoa. Recarregue a página e tente novamente.",
    EVENT_REQUIRED_ITEMS_MISSING: "Selecione todos os itens obrigatórios.",
    EVENT_ITEMS_DUPLICATED: "Um item foi selecionado mais de uma vez.",
    EVENT_CHECKOUT_NOT_FOUND: "A sessão da inscrição expirou. Revise os dados e tente novamente.",
    EVENT_CHECKOUT_EXPIRED: "A sessão da inscrição expirou. Revise os dados e tente novamente.",
  };
  const translated = Object.entries(map).find(([key]) => message.includes(key))?.[1];
  throw new EventServiceError(translated ?? (error?.code === "23505" ? "Já existe um registro equivalente." : fallback));
}

function value(row: RecordValue, key: string) { return row[key]; }
function text(row: RecordValue, key: string) { const item = value(row, key); return typeof item === "string" ? item : null; }
function number(row: RecordValue, key: string) { const item = Number(value(row, key) ?? 0); return Number.isFinite(item) ? item : 0; }
function bool(row: RecordValue, key: string) { return Boolean(value(row, key)); }
function nested(row: RecordValue, key: string) { const item = row[key]; return (Array.isArray(item) ? item[0] : item) as RecordValue | null | undefined; }
function roleDisplayName(role: RecordValue, gender?: string | null) {
  return gender === "FEMALE" ? text(role, "female_name") ?? String(role.name) : String(role.name);
}

function toRegistrationField(row: RecordValue): EventRegistrationFieldRow {
  return {
    id: String(row.id), key: String(row.field_key), kind: String(row.field_kind) as EventRegistrationFieldRow["kind"],
    label: String(row.label), helpText: text(row, "help_text"), type: String(row.field_type) as EventRegistrationFieldRow["type"],
    visibility: String(row.visibility) as EventRegistrationFieldRow["visibility"],
    options: Array.isArray(row.options) ? row.options.map(String) : [], sortOrder: number(row, "sort_order"),
    active: bool(row, "is_active"), systemLocked: bool(row, "system_locked"),
  };
}

export async function resolveEventRoleSnapshot(churchId: string, roleId: string | null | undefined, gender?: string | null) {
  if (!roleId) return null;
  const result = await createAdminClient().from("roles").select("id,name,female_name").eq("id", roleId).eq("church_id", churchId).eq("status", "ACTIVE").is("deleted_at", null).maybeSingle();
  if (result.error || !result.data) throw new EventServiceError("O cargo selecionado não está disponível.");
  const role = result.data as RecordValue;
  return { id: String(role.id), name: roleDisplayName(role, gender) };
}

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
    registrationStatus: String(row.registration_status ?? "CLOSED") as EventSummary["registrationStatus"],
    registrationsOpenedAt: text(row, "registrations_opened_at"),
    registrationsClosedAt: text(row, "registrations_closed_at"),
    startsAt: String(row.starts_at),
    endsAt: text(row, "ends_at"),
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
    hasRegistrations: false,
    churchId: String(row.church_id),
    description: text(row, "description"),
    timezone: String(row.timezone),
    registrationMode: String(row.registration_mode) === "GROUP" ? "MIXED" : String(row.registration_mode),
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
    paymentSettings: {
      allowParticipantList: true, caravanRegistrationItemId: "", pixEnabled: false, pixKey: "", pixHolderName: "",
      pixQrUrl: null, cashEnabled: false, whatsappNumber: "", paymentInstructions: "",
    },
    registrationFields: [],
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
  if (input.status === "OPEN") query = query.eq("registration_status", "OPEN");
  else if (input.status && !["ALL", "DELETED"].includes(input.status)) query = query.eq("status", input.status);
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
    const [individuals, caravans] = await Promise.all([
      supabase.from("event_registrations").select("event_id,status").in("event_id", ids).is("event_group_id", null).in("status", ["PENDING", "CONFIRMED", "CHECKED_IN"]).is("deleted_at", null),
      supabase.from("event_groups").select("event_id,total_registrations").in("event_id", ids).eq("status", "CONFIRMED").is("deleted_at", null),
    ]);
    if (individuals.error || caravans.error) fail(individuals.error ?? caravans.error, "Não foi possível calcular a ocupação.");
    for (const registration of (individuals.data ?? []) as RecordValue[]) counts.set(String(registration.event_id), (counts.get(String(registration.event_id)) ?? 0) + 1);
    for (const caravan of (caravans.data ?? []) as RecordValue[]) counts.set(String(caravan.event_id), (counts.get(String(caravan.event_id)) ?? 0) + number(caravan, "total_registrations"));
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

async function loadAllEventExpenses(supabase: Awaited<ReturnType<typeof createClient>>, eventId: string) {
  const data: RecordValue[] = [];
  const pageSize = 1000;
  for (let from = 0; ; from += pageSize) {
    const result = await supabase.from("event_expenses").select("*").eq("event_id", eventId).is("deleted_at", null)
      .order("expense_date", { ascending: false }).order("created_at", { ascending: false }).range(from, from + pageSize - 1);
    if (result.error) return { data: null, error: result.error };
    data.push(...((result.data ?? []) as RecordValue[]));
    if ((result.data?.length ?? 0) < pageSize) return { data, error: null };
  }
}

export async function getEvent(eventId: string) {
  const { row, supabase } = await getEventRow(eventId);
  const [fields, registrations, paymentSettings] = await Promise.all([
    supabase.from("event_registration_fields").select("*").eq("event_id", eventId).is("deleted_at", null).order("sort_order").order("id"),
    supabase.from("event_registrations").select("id", { count: "exact", head: true }).eq("event_id", eventId),
    supabase.from("event_payment_settings").select("*").eq("event_id", eventId).is("deleted_at", null).maybeSingle(),
  ]);
  if (fields.error || registrations.error || paymentSettings.error) fail(fields.error ?? registrations.error ?? paymentSettings.error, "Não foi possível carregar o formulário de inscrição.");
  const detail = toDetail(row);
  const setting = paymentSettings.data as RecordValue | null;
  return { ...detail, hasRegistrations: (registrations.count ?? 0) > 0, registrationFields: ((fields.data ?? []) as RecordValue[]).map(toRegistrationField), paymentSettings: setting ? {
    allowParticipantList: bool(setting,"allow_participant_list"), caravanRegistrationItemId: text(setting,"caravan_registration_item_id") ?? "",
    pixEnabled: bool(setting,"pix_enabled"), pixKey: text(setting,"pix_key") ?? "", pixHolderName: text(setting,"pix_holder_name") ?? "",
    pixQrUrl: text(setting,"pix_qr_storage_path") ? createAdminClient().storage.from(text(setting,"pix_qr_storage_bucket") ?? "event-public-media").getPublicUrl(String(setting.pix_qr_storage_path)).data.publicUrl : null,
    cashEnabled: bool(setting,"cash_enabled"), whatsappNumber: text(setting,"whatsapp_number") ?? "", paymentInstructions: text(setting,"payment_instructions") ?? "",
  } : detail.paymentSettings };
}

export async function getEventFormOptions(eventId?: string) {
  const context = await requireAccessContext(PERMISSIONS.eventsManage);
  const supabase = await createClient();
  const [regions, congregations, ministries, items] = await Promise.all([
    supabase.from("regions").select("id,name").eq("church_id", context.church.id).eq("status", "ACTIVE").is("deleted_at", null).order("name"),
    supabase.from("congregations").select("id,name,region_id").eq("church_id", context.church.id).eq("status", "ACTIVE").is("deleted_at", null).order("name"),
    supabase.from("ministries").select("id,name").eq("church_id", context.church.id).eq("status", "ACTIVE").is("deleted_at", null).order("name"),
    eventId ? supabase.from("event_items").select("id,name,item_type,price").eq("event_id",eventId).eq("is_active",true).is("deleted_at",null).order("sort_order") : Promise.resolve({data:[],error:null}),
  ]);
  const failed = [regions, congregations, ministries, items].find((item) => item.error);
  if (failed?.error) fail(failed.error, "Não foi possível carregar as opções do formulário.");
  return { regions: regions.data ?? [], congregations: congregations.data ?? [], ministries: ministries.data ?? [], items: items.data ?? [] };
}

export async function getEventWorkspace(eventId: string): Promise<EventWorkspaceData> {
  const context = await requireAccessContext(PERMISSIONS.eventsView);
  const { supabase, row } = await getEventRow(eventId);
  const can = (permission: string) => context.permissions.includes(permission);
  const empty = Promise.resolve({ data: [] as unknown[], error: null });
  const [registrations, registrationItems, registrationFieldValues, groups, items, goals, payments, checkins, documents, expenses, registrationFields, regions, congregations, roles, paymentSettings] = await Promise.all([
    can(PERMISSIONS.eventRegistrationsView)
      ? supabase.from("event_registrations").select("*,congregations!event_registrations_congregation_tenant_fkey(id,name,region_id,regions(name))").eq("event_id", eventId).is("deleted_at", null).order("registered_at", { ascending: false }).limit(200)
      : empty,
    can(PERMISSIONS.eventRegistrationsView) || can(PERMISSIONS.eventGroupsView)
      ? supabase.from("event_registration_items").select("id,event_registration_id,event_group_id,event_item_id,item_name,quantity,unit_price,total_price,event_items!event_registration_items_event_item_id_fkey(name)").eq("event_id", eventId).is("deleted_at", null).limit(2000)
      : empty,
    can(PERMISSIONS.eventRegistrationsView)
      ? supabase.from("event_registration_field_values").select("event_registration_id,field_key_snapshot,value").eq("event_id", eventId).is("deleted_at", null).limit(4000)
      : empty,
    can(PERMISSIONS.eventGroupsView) ? supabase.from("event_groups").select("*").eq("event_id", eventId).is("deleted_at", null).order("created_at", { ascending: false }).limit(500) : empty,
    supabase.from("event_items").select("*").eq("event_id", eventId).is("deleted_at", null).order("sort_order").limit(100),
    supabase.from("event_congregation_quotas").select("*,congregations!event_congregation_quotas_target_fkey(name)").eq("event_id", eventId).is("deleted_at", null).limit(500),
    can(PERMISSIONS.eventPaymentsView) ? supabase.from("event_payments").select("*").eq("event_id", eventId).is("deleted_at", null).order("created_at", { ascending: false }).limit(300) : empty,
    can(PERMISSIONS.eventCheckin) || can(PERMISSIONS.eventRegistrationsView) ? supabase.from("event_checkins").select("*,event_registrations!event_checkins_registration_tenant_fkey(registration_number,participant_name)").eq("event_id", eventId).is("deleted_at", null).order("checked_in_at", { ascending: false }).limit(200) : empty,
    can(PERMISSIONS.eventDocumentsView) ? supabase.from("event_documents").select("*").eq("event_id", eventId).eq("upload_status", "ACTIVE").is("deleted_at", null).order("created_at", { ascending: false }).limit(200) : empty,
    can(PERMISSIONS.eventExpensesView) ? loadAllEventExpenses(supabase, eventId) : empty,
    supabase.from("event_registration_fields").select("*").eq("event_id", eventId).is("deleted_at", null).order("sort_order").order("id").limit(100),
    supabase.from("regions").select("id,name").eq("church_id", context.church.id).eq("status", "ACTIVE").is("deleted_at", null).order("name").limit(200),
    supabase.from("congregations").select("id,name,region_id,regions(name)").eq("church_id", context.church.id).eq("status", "ACTIVE").is("deleted_at", null).order("name").limit(1000),
    createAdminClient().from("roles").select("id,name,female_name").eq("church_id", context.church.id).eq("status", "ACTIVE").is("deleted_at", null).order("display_order").order("name").limit(500),
    supabase.from("event_payment_settings").select("*").eq("event_id",eventId).is("deleted_at",null).maybeSingle(),
  ]);
  const failed = [registrations, registrationItems, registrationFieldValues, groups, items, goals, payments, checkins, documents, expenses, registrationFields, regions, congregations, roles, paymentSettings].find((result) => result.error);
  if (failed?.error) fail(failed.error, "Não foi possível carregar o workspace do evento.");

  const registrationRows = (registrations.data ?? []) as RecordValue[];
  const selectedItemsByRegistration = new Map<string, { ids: string[]; names: string[]; quantities: Record<string, number> }>();
  const selectedItemsByGroup = new Map<string, GroupRow["items"]>();
  for (const selectedItem of (registrationItems.data ?? []) as RecordValue[]) {
    const registrationId = text(selectedItem,"event_registration_id");
    const groupId = text(selectedItem,"event_group_id");
    if (registrationId) {
      const current = selectedItemsByRegistration.get(registrationId) ?? { ids: [], names: [], quantities: {} };
      current.ids.push(String(selectedItem.event_item_id));
      current.quantities[String(selectedItem.event_item_id)] = number(selectedItem, "quantity");
      const selectedItemReference = nested(selectedItem, "event_items");
      if (selectedItemReference?.name) current.names.push(String(selectedItemReference.name));
      selectedItemsByRegistration.set(registrationId, current);
    }
    if (groupId) {
      const current = selectedItemsByGroup.get(groupId) ?? [];
      current.push({ id:String(selectedItem.id), itemId:String(selectedItem.event_item_id), name:String(selectedItem.item_name), quantity:number(selectedItem,"quantity"), unitPrice:number(selectedItem,"unit_price"), totalPrice:number(selectedItem,"total_price") });
      selectedItemsByGroup.set(groupId,current);
    }
  }
  const customValuesByRegistration = new Map<string, Record<string, unknown>>();
  for (const fieldValue of (registrationFieldValues.data ?? []) as RecordValue[]) {
    const registrationId = String(fieldValue.event_registration_id);
    const current = customValuesByRegistration.get(registrationId) ?? {};
    current[String(fieldValue.field_key_snapshot)] = fieldValue.value;
    customValuesByRegistration.set(registrationId, current);
  }
  const activeRows = registrationRows.filter((item) => ["PENDING", "CONFIRMED", "CHECKED_IN"].includes(String(item.status)));
  const usedByCongregation = new Map<string, number>();
  for (const item of activeRows) if (item.congregation_id) usedByCongregation.set(String(item.congregation_id), (usedByCongregation.get(String(item.congregation_id)) ?? 0) + 1);
  const activeGroupParticipants = ((groups.data ?? []) as RecordValue[]).filter((item)=>item.status==="CONFIRMED").reduce((sum,item)=>sum+number(item,"total_registrations"),0);
  const counts = new Map([[eventId, activeRows.filter((item)=>!item.event_group_id).length+activeGroupParticipants]]);
  const documentRows = (documents.data ?? []) as RecordValue[];
  const participantLists = new Map(documentRows.filter((item)=>item.document_type==="CARAVAN_PARTICIPANT_LIST" && item.event_group_id).map((item)=>[String(item.event_group_id),item]));
  const setting = paymentSettings.data as RecordValue | null;
  const baseDetail = toDetail(row,counts);

  return {
    event: { ...baseDetail, hasRegistrations: registrationRows.length > 0 || ((groups.data ?? []).length > 0), registrationFields: ((registrationFields.data ?? []) as RecordValue[]).map(toRegistrationField), paymentSettings: setting ? {
      allowParticipantList:bool(setting,"allow_participant_list"),caravanRegistrationItemId:text(setting,"caravan_registration_item_id")??"",pixEnabled:bool(setting,"pix_enabled"),pixKey:text(setting,"pix_key")??"",pixHolderName:text(setting,"pix_holder_name")??"",
      pixQrUrl:text(setting,"pix_qr_storage_path")?createAdminClient().storage.from(text(setting,"pix_qr_storage_bucket")??"event-public-media").getPublicUrl(String(setting.pix_qr_storage_path)).data.publicUrl:null,cashEnabled:bool(setting,"cash_enabled"),whatsappNumber:text(setting,"whatsapp_number")??"",paymentInstructions:text(setting,"payment_instructions")??"",
    }:baseDetail.paymentSettings },
    permissions: context.permissions,
    registrations: registrationRows.map((item): RegistrationRow => {
      const congregation = nested(item, "congregations");
      const region = congregation ? nested(congregation, "regions") : null;
      const metadata = (item.metadata ?? {}) as RecordValue;
      return {
        id: String(item.id), registrationNumber: text(item, "registration_number"), memberId: text(item, "member_id"), participantName: String(item.participant_name),
        participantType: item.member_id ? "MEMBER" : "VISITOR", participantGender: text(item, "participant_gender"), participantPhone: text(item, "participant_phone"),
        participantEmail: text(item, "participant_email"), participantDocument: text(item, "participant_document"), participantBirthDate: text(item, "participant_birth_date"),
        participantCity: text(item, "participant_city"), participantState: text(item, "participant_state"), responsibleName: text(item, "responsible_name"), responsiblePhone: text(item, "responsible_phone"),
        participantRoleId: text(metadata, "participantRoleId"), participantRoleName: text(metadata, "participantRoleName"),
        congregationId: text(item, "congregation_id"), congregationName: congregation ? text(congregation, "name") : null,
        regionId: congregation ? text(congregation, "region_id") : null, regionName: region ? text(region, "name") : null,
        preferredPaymentMethod: text(item, "preferred_payment_method"), status: String(item.status), paymentStatus: String(item.payment_status),
        totalAmount: number(item, "total_amount"), paidAmount: number(item, "paid_amount"), remainingAmount: number(item, "remaining_amount"),
        registeredAt: String(item.registered_at), updatedAt: String(item.updated_at), groupId: text(item, "event_group_id"),
        itemIds: selectedItemsByRegistration.get(String(item.id))?.ids ?? [],
        itemNames: selectedItemsByRegistration.get(String(item.id))?.names ?? [],
        itemQuantities: selectedItemsByRegistration.get(String(item.id))?.quantities ?? {},
        customFieldValues: customValuesByRegistration.get(String(item.id)) ?? {},
      };
    }),
    groups: ((groups.data ?? []) as RecordValue[]).map((item): GroupRow => { const list=participantLists.get(String(item.id)); return { id:String(item.id),groupNumber:String(item.group_number??"Caravana"),source:String(item.source??"INTERNAL") as GroupRow["source"],responsibleName:String(item.responsible_name),responsiblePhone:String(item.responsible_phone??""),responsibleEmail:text(item,"responsible_email"),originChurchName:String(item.origin_church_name??""),originCity:String(item.origin_city),originState:String(item.origin_state),pastorName:String(item.pastor_name??""),pastorPhone:text(item,"pastor_phone"),total:number(item,"total_registrations"),maleCount:number(item,"male_count"),femaleCount:number(item,"female_count"),unspecifiedCount:number(item,"unspecified_count"),totalAmount:number(item,"total_amount"),paidAmount:number(item,"paid_amount"),remainingAmount:Math.max(number(item,"total_amount")-number(item,"paid_amount"),0),paymentStatus:String(item.payment_status??"PENDING"),status:String(item.status),notes:text(item,"notes"),createdAt:String(item.created_at),updatedAt:String(item.updated_at),items:selectedItemsByGroup.get(String(item.id))??[],listDocumentId:list?String(list.id):null,listFileName:list?String(list.file_name):null }; }),
    items: ((items.data ?? []) as RecordValue[]).map((item): EventItemRow => ({ id: String(item.id), name: String(item.name), description: text(item, "description"), type: String(item.item_type), price: number(item, "price"), required: bool(item, "is_required"), active: bool(item, "is_active"), allowQuantity: bool(item, "allow_quantity"), minQuantity: number(item, "min_quantity") || 1, maxQuantity: item.max_quantity === null ? null : number(item, "max_quantity"), availableQuantity: item.available_quantity === null ? null : number(item, "available_quantity") })),
    quotas: ((goals.data ?? []) as RecordValue[]).map((item): EventQuotaRow => ({ id: String(item.id), label: String(nested(item, "congregations")?.name ?? "Congregação"), quotaTotal: number(item, "quota_total"), used: usedByCongregation.get(String(item.congregation_id)) ?? 0, targetId: String(item.congregation_id) })),
    payments: ((payments.data ?? []) as RecordValue[]).map((item): PaymentRow => {const metadata=(item.metadata??{}) as RecordValue;return { id: String(item.id), paymentNumber: text(item, "payment_number"), registrationId: text(item, "event_registration_id"), groupId: text(item, "event_group_id"), method: String(item.payment_method), status: String(item.payment_status), amount: number(item, "amount"), paidAt: text(item, "paid_at"), payerName: text(item, "payer_name"), receiptFileName: text(item, "receipt_file_name"), receiptMimeType: text(item, "receipt_mime_type"), receiptFileSize: item.receipt_file_size === null ? null : number(item, "receipt_file_size"), receiptStoragePath: text(item, "receipt_storage_path"),source:metadata.source==="PUBLIC"?"PUBLIC":"INTERNAL",notes:text(item,"notes"),createdAt:String(item.created_at),confirmedBy:text(item,"confirmed_by") };}),
    checkins: ((checkins.data ?? []) as RecordValue[]).map((item): CheckinRow => { const registration = nested(item, "event_registrations"); return { id: String(item.id), registrationId: String(item.event_registration_id), registrationNumber: registration ? text(registration, "registration_number") : null, participantName: String(registration?.participant_name ?? "Participante"), method: String(item.checkin_method), checkedInAt: text(item, "checked_in_at"), status: String(item.status) }; }),
    documents: documentRows.map((item): EventDocumentRow => ({ id:String(item.id),groupId:text(item,"event_group_id"),paymentId:text(item,"event_payment_id"),title:String(item.title),type:String(item.document_type),fileName:String(item.file_name),mimeType:text(item,"mime_type"),fileSize:item.file_size===null?null:number(item,"file_size"),uploadedAt:String(item.uploaded_at) })),
    expenses: ((expenses.data ?? []) as RecordValue[]).map((item): EventExpenseRow => ({ id: String(item.id), name: String(item.name), expenseDate: String(item.expense_date), amount: number(item, "amount"), receiptFileName: text(item, "receipt_file_name"), receiptMimeType: text(item, "receipt_mime_type"), receiptFileSize: item.receipt_file_size === null ? null : number(item, "receipt_file_size"), receiptStoragePath: text(item, "receipt_storage_path"), uploadStatus: String(item.upload_status) as EventExpenseRow["uploadStatus"], createdAt: String(item.created_at), updatedAt: String(item.updated_at) })),
    registrationFields: ((registrationFields.data ?? []) as RecordValue[]).map(toRegistrationField),
    references: {
      regions: ((regions.data ?? []) as RecordValue[]).map((item) => ({ id: String(item.id), name: String(item.name) })),
      congregations: ((congregations.data ?? []) as RecordValue[]).map((item) => ({ id: String(item.id), name: String(item.name), regionId: text(item, "region_id"), regionName: text(nested(item, "regions") ?? {}, "name") })),
      roles: ((roles.data ?? []) as RecordValue[]).map((item) => ({ id: String(item.id), name: String(item.name), femaleName: text(item, "female_name") })),
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
    .select("id,full_name,gender,whatsapp,congregation_id,congregations!inner(id,name,region_id,regions(name)),active_roles:member_roles!member_roles_member_id_fkey(role_id,status,deleted_at,role:roles!member_roles_role_id_fkey(name,female_name))")
    .eq("church_id", context.church.id).eq("member_status", "ACTIVE").is("deleted_at", null)
    .ilike("full_name", `%${normalized}%`).order("full_name").limit(12);
  if (result.error) fail(result.error, "Não foi possível pesquisar os membros.");
  return ((result.data ?? []) as RecordValue[]).map((item) => {
    const congregation = nested(item, "congregations") ?? {};
    const region = nested(congregation, "regions");
    const roleLink = ((item.active_roles ?? []) as RecordValue[]).find((link) => link.status === "ACTIVE" && !link.deleted_at);
    const role = roleLink ? nested(roleLink, "role") : null;
    return { id: String(item.id), fullName: String(item.full_name), congregationId: String(congregation.id), congregationName: String(congregation.name), regionId: text(congregation, "region_id"), regionName: region ? text(region, "name") : null, phone: text(item, "whatsapp"), gender: text(item, "gender"), roleId: roleLink ? text(roleLink, "role_id") : null, roleName: role ? roleDisplayName(role, text(item, "gender")) : null };
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
    timezone: input.timezone, registration_mode: input.registrationMode, capacity: input.capacity === "" ? null : input.capacity,
    allow_waitlist: false, quota_mode: "NONE", uses_registration_batches: false,
    requires_payment: input.requiresPayment, allow_installments: false, max_installments: 1,
    requires_group_responsible: input.requiresGroupResponsible, requires_pastor_info: input.requiresPastorInfo, requires_gender_totals: input.requiresGenderTotals,
    location_name: input.locationName || null, zip_code: input.zipCode || null, address: input.address || null, number: input.number || null,
    complement: input.complement || null, district: input.district || null, city: input.city || null, state: input.state.toUpperCase() || null,
    country: input.country, notes: input.notes || null, updated_by: context.profile.id,
  };
  let eventId: string;
  if (input.id) {
    const { data, error } = await supabase.from("events").update(payload).eq("id", input.id).select("id").single();
    if (error) fail(error, "Não foi possível atualizar o evento.");
    eventId = String(data.id);
  } else {
    const { data, error } = await supabase.from("events").insert({ ...payload, status: "DRAFT", registration_status: "CLOSED", created_by: context.profile.id }).select("id").single();
    if (error) fail(error, "Não foi possível criar o evento.");
    eventId = String(data.id);
  }

  if (input.registrationFields.length) {
    const currentResult = await supabase.from("event_registration_fields").select("id,field_key,field_kind").eq("event_id", eventId).is("deleted_at", null);
    if (currentResult.error) fail(currentResult.error, "Não foi possível carregar a configuração do formulário.");
    const currentByKey = new Map(((currentResult.data ?? []) as RecordValue[]).map((field) => [String(field.field_key), field]));
    const receivedCustomKeys = new Set(input.registrationFields.filter((field) => field.kind === "CUSTOM").map((field) => field.key));
    for (const field of input.registrationFields) {
      const existing = currentByKey.get(field.key);
      const fieldPayload = {
        church_id: context.church.id, event_id: eventId, field_key: field.key, field_kind: field.kind,
        label: field.label, help_text: field.helpText || null, field_type: field.type, visibility: field.visibility,
        options: field.options, sort_order: field.sortOrder, is_active: field.active && field.visibility !== "HIDDEN",
        system_locked: field.systemLocked, updated_by: context.profile.id,
      };
      const result = existing
        ? await supabase.from("event_registration_fields").update(fieldPayload).eq("id", String(existing.id)).eq("event_id", eventId)
        : await supabase.from("event_registration_fields").insert({ ...fieldPayload, created_by: context.profile.id });
      if (result.error) fail(result.error, `Não foi possível salvar o campo “${field.label}”.`);
    }
    const omittedCustomIds = ((currentResult.data ?? []) as RecordValue[])
      .filter((field) => field.field_kind === "CUSTOM" && !receivedCustomKeys.has(String(field.field_key)))
      .map((field) => String(field.id));
    if (omittedCustomIds.length) {
      const archived = await supabase.from("event_registration_fields").update({ is_active: false, visibility: "HIDDEN", updated_by: context.profile.id }).in("id", omittedCustomIds).eq("event_id", eventId);
      if (archived.error) fail(archived.error, "Não foi possível desativar os campos removidos.");
    }
  }
  const caravanSettings = input.caravanSettings;
  const settingsResult = await supabase.from("event_payment_settings").upsert({
    church_id: context.church.id, event_id: eventId,
    allow_participant_list: input.registrationMode === "MIXED" && caravanSettings.allowParticipantList,
    caravan_registration_item_id: input.registrationMode === "MIXED" && caravanSettings.caravanRegistrationItemId ? caravanSettings.caravanRegistrationItemId : null,
    pix_enabled: input.registrationMode === "MIXED" && caravanSettings.pixEnabled,
    pix_key: input.registrationMode === "MIXED" && caravanSettings.pixEnabled ? caravanSettings.pixKey : null,
    pix_holder_name: input.registrationMode === "MIXED" && caravanSettings.pixEnabled ? caravanSettings.pixHolderName : null,
    cash_enabled: input.registrationMode === "MIXED" && caravanSettings.cashEnabled,
    whatsapp_number: input.registrationMode === "MIXED" ? caravanSettings.whatsappNumber || null : null,
    payment_instructions: input.registrationMode === "MIXED" ? caravanSettings.paymentInstructions || null : null,
    created_by: context.profile.id,
    updated_by: context.profile.id,
  }, { onConflict: "event_id" });
  if (settingsResult.error) fail(settingsResult.error, "Não foi possível salvar a configuração de caravanas.");
  return eventId;
}

export async function changeLifecycle(eventId: string, action: string, reason: string) { await getEventRow(eventId, PERMISSIONS.eventsPublish); const supabase = await createClient(); const { error } = await supabase.rpc("change_event_lifecycle", { p_event_id: eventId, p_action: action, p_reason: reason || null }); if (error) fail(error, "Não foi possível alterar o estado do evento."); }
export async function changeDeletionState(eventId: string, action: "DELETE" | "RESTORE") { const context = await requireAccessContext(PERMISSIONS.eventsManage); const supabase = await createClient(); const { error } = await supabase.rpc("change_event_deletion_state", { p_event_id: eventId, p_action: action }); if (error) fail(error, action === "DELETE" ? "Somente rascunhos sem dependências podem ir para a lixeira." : "Não foi possível restaurar o evento."); return context.church.id; }
export async function createRegistration(input: RegistrationForm) { const { row } = await getEventRow(input.eventId, PERMISSIONS.eventRegistrationsManage); const role = await resolveEventRoleSnapshot(String(row.church_id), input.participantRoleId, input.participantGender); const supabase = await createClient(); const { data, error } = await supabase.rpc("create_event_registration_v3", { p_event_id: input.eventId, p_payload: { ...input, participantType: input.participantKind, registrationSource: "INTERNAL", metadata: role ? { participantRoleId: role.id, participantRoleName: role.name } : {} }, p_idempotency_key: randomUUID() }); if (error) fail(error, "Não foi possível criar a inscrição."); return data as RecordValue; }

export async function updateRegistration(input: UpdateRegistrationForm) {
  const { row, supabase } = await getEventRow(input.eventId, PERMISSIONS.eventRegistrationsManage);
  const role = await resolveEventRoleSnapshot(String(row.church_id), input.participantRoleId, input.participantGender || null);
  const { data, error } = await supabase.rpc("update_event_registration", {
    p_event_id: input.eventId, p_registration_id: input.registrationId, p_expected_updated_at: input.expectedUpdatedAt,
    p_payload: { ...input, participantRoleName: role?.name ?? "" },
  });
  if (error) fail(error, "Não foi possível atualizar a inscrição.");
  return data as RecordValue;
}
export async function createGroup(input: GroupForm) {
  const { supabase } = await getEventRow(input.eventId, PERMISSIONS.eventGroupsManage);
  const rpc = input.groupId ? "update_event_caravan" : "create_event_caravan";
  const args = input.groupId ? {
    p_event_id:input.eventId,p_group_id:input.groupId,p_expected_updated_at:input.expectedUpdatedAt,
    p_payload:input,p_items:input.items,
  } : { p_event_id:input.eventId,p_payload:input,p_items:input.items,p_idempotency_key:randomUUID() };
  const { data,error } = await supabase.rpc(rpc,args);
  if (error) fail(error,input.groupId?"Não foi possível atualizar a caravana.":"Não foi possível criar a caravana.");
  return data as RecordValue;
}
export async function cancelGroup(eventId:string,id:string,reason:string) { const {supabase}=await getEventRow(eventId,PERMISSIONS.eventGroupsManage);const {error}=await supabase.rpc("cancel_event_caravan",{p_event_id:eventId,p_group_id:id,p_reason:reason});if(error)fail(error,"Não foi possível cancelar a caravana."); }
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
  const { error } = await supabase.rpc("record_event_registration_payment", {
    p_event_id: input.eventId,
    p_registration_id: input.registrationId,
    p_payload: buildRegistrationPaymentPayload(input),
    p_idempotency_key: randomUUID(),
  });
  if (error) {
    if (input.receiptPath) await supabase.storage.from("event-documents").remove([input.receiptPath]);
    fail(error, "Não foi possível registrar o pagamento.");
  }
}

export async function recordCaravanPayment(input:CaravanPaymentForm) {
  const {supabase,row}=await getEventRow(input.eventId,PERMISSIONS.eventPaymentsManage);
  const expectedPrefix=`${String(row.church_id)}/events/${input.eventId}/payment-receipts/`;
  if(input.receiptPath){
    if(!input.receiptPath.startsWith(expectedPrefix))throw new EventServiceError("O comprovante não pertence a este evento.");
    const downloaded=await supabase.storage.from("event-documents").download(input.receiptPath);
    if(downloaded.error||!downloaded.data)fail(downloaded.error,"Não foi possível validar o comprovante.");
    const buffer=Buffer.from(await downloaded.data.arrayBuffer());
    if(buffer.length>10*1024*1024||buffer.length!==input.receiptFileSize||!validUploadContent(buffer,input.receiptMimeType)){await supabase.storage.from("event-documents").remove([input.receiptPath]);throw new EventServiceError("O conteúdo do comprovante não corresponde ao arquivo informado.");}
  }
  const receipt=input.receiptPath?{receiptPath:input.receiptPath,receiptFileName:input.receiptFileName,receiptMimeType:input.receiptMimeType,receiptFileSize:input.receiptFileSize}:{};
  const {error}=await supabase.rpc("record_event_caravan_payment",{p_event_id:input.eventId,p_group_id:input.groupId,p_payload:{eventId:input.eventId,groupId:input.groupId,amount:input.amount,paymentMethod:input.paymentMethod,notes:input.notes,paymentStatus:"CONFIRMED",...receipt},p_idempotency_key:randomUUID()});
  if(error){if(input.receiptPath)await supabase.storage.from("event-documents").remove([input.receiptPath]);fail(error,"Não foi possível registrar o pagamento da caravana.");}
}

export async function approveCaravanPayment(eventId:string,paymentId:string,status:"CONFIRMED"|"FAILED",reason:string,amount:number){
  await getEventRow(eventId,PERMISSIONS.eventPaymentsApprove);
  const supabase=await createClient();
  const {error}=await supabase.rpc("review_event_caravan_payment",{p_payment_id:paymentId,p_status:status,p_amount:amount,p_reason:reason||null});
  if(error)fail(error,"Não foi possível analisar o pagamento.");
}

export async function approveRegistrationPayment(eventId: string, registrationId: string) {
  const { supabase } = await getEventRow(eventId, PERMISSIONS.eventPaymentsManage);
  const registrationResult = await supabase
    .from("event_registrations")
    .select("id,remaining_amount,status")
    .eq("id", registrationId)
    .eq("event_id", eventId)
    .is("deleted_at", null)
    .maybeSingle();
  if (registrationResult.error || !registrationResult.data) fail(registrationResult.error, "Inscrição não encontrada.");
  if (["CANCELLED", "EXPIRED"].includes(registrationResult.data.status)) throw new EventServiceError("Esta inscrição não permite aprovação de pagamento.");

  const remainingAmount = Number(registrationResult.data.remaining_amount);
  if (!Number.isFinite(remainingAmount) || remainingAmount <= 0) throw new EventServiceError("Esta inscrição já está totalmente paga.");

  const pendingResult = await supabase
    .from("event_payments")
    .select("id,amount")
    .eq("event_id", eventId)
    .eq("event_registration_id", registrationId)
    .eq("payment_status", "PENDING")
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (pendingResult.error) fail(pendingResult.error, "Não foi possível consultar o pagamento pendente.");

  if (pendingResult.data) {
    const pendingAmount = Number(pendingResult.data.amount);
    if (!Number.isFinite(pendingAmount) || pendingAmount <= 0 || pendingAmount > remainingAmount) {
      throw new EventServiceError("O pagamento pendente não corresponde ao valor restante. Revise o histórico antes de aprovar.");
    }
    const approved = await supabase.rpc("change_event_payment_status", { p_payment_id: pendingResult.data.id, p_status: "CONFIRMED", p_reason: null });
    if (approved.error) fail(approved.error, "Não foi possível confirmar o pagamento pendente.");
    return;
  }

  const recorded = await supabase.rpc("record_event_registration_payment", {
    p_event_id: eventId,
    p_registration_id: registrationId,
    p_payload: buildRegistrationPaymentPayload({ amount: remainingAmount }),
    p_idempotency_key: randomUUID(),
  });
  if (recorded.error) fail(recorded.error, "Não foi possível registrar a aprovação manual.");
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
  const [documents, receipts, expenseReceipts] = await Promise.all([
    admin.from("event_documents").select("storage_bucket,storage_path").eq("event_id", eventId),
    admin.from("event_payments").select("receipt_storage_path").eq("event_id", eventId).not("receipt_storage_path", "is", null),
    admin.from("event_expenses").select("receipt_storage_bucket,receipt_storage_path").eq("event_id", eventId).not("receipt_storage_path", "is", null),
  ]);
  const lookupError = documents.error ?? receipts.error ?? expenseReceipts.error;
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
  for (const receipt of expenseReceipts.data ?? []) appendPath(receipt.receipt_storage_bucket ?? "event-documents", receipt.receipt_storage_path);

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
  const { data, error } = await admin.from("events").select("*").eq("public_code", publicCode).eq("slug", slug).eq("visibility", "PUBLIC").in("status", ["PUBLISHED", "IN_PROGRESS", "FINISHED"]).is("deleted_at", null).maybeSingle();
  if (error || !data) return null;
  const event = toDetail(data as RecordValue);
  const [items, congregations, roles, fields, paymentSettings, caravanCounts, individualCounts] = await Promise.all([
    admin.from("event_items").select("id,name,description,item_type,price,is_required,allow_quantity,min_quantity,max_quantity,available_quantity").eq("event_id", event.id).eq("is_active", true).is("deleted_at", null).order("sort_order"),
    admin.from("congregations").select("id,name,region_id,regions(name)").eq("church_id", event.churchId).eq("status", "ACTIVE").is("deleted_at", null).order("name"),
    admin.from("roles").select("id,name,female_name").eq("church_id", event.churchId).eq("status", "ACTIVE").is("deleted_at", null).order("display_order").order("name"),
    admin.from("event_registration_fields").select("*").eq("event_id", event.id).eq("is_active", true).neq("visibility", "HIDDEN").is("deleted_at", null).order("sort_order").order("id"),
    admin.from("event_payment_settings").select("*").eq("event_id",event.id).is("deleted_at",null).maybeSingle(),
    admin.from("event_groups").select("total_registrations").eq("event_id",event.id).eq("status","CONFIRMED").is("deleted_at",null),
    admin.from("event_registrations").select("id",{count:"exact",head:true}).eq("event_id",event.id).is("event_group_id",null).in("status",["PENDING","CONFIRMED","CHECKED_IN"]).is("deleted_at",null),
  ]);
  const setting=paymentSettings.data as RecordValue|null;
  const occupied=(individualCounts.count??0)+((caravanCounts.data??[]) as RecordValue[]).reduce((sum,item)=>sum+number(item,"total_registrations"),0);
  return {
    event:{...event,occupied,paymentSettings:setting?{allowParticipantList:bool(setting,"allow_participant_list"),caravanRegistrationItemId:text(setting,"caravan_registration_item_id")??"",pixEnabled:bool(setting,"pix_enabled"),pixKey:text(setting,"pix_key")??"",pixHolderName:text(setting,"pix_holder_name")??"",pixQrUrl:text(setting,"pix_qr_storage_path")?admin.storage.from(text(setting,"pix_qr_storage_bucket")??"event-public-media").getPublicUrl(String(setting.pix_qr_storage_path)).data.publicUrl:null,cashEnabled:bool(setting,"cash_enabled"),whatsappNumber:text(setting,"whatsapp_number")??"",paymentInstructions:text(setting,"payment_instructions")??""}:event.paymentSettings},
    items: ((items.data ?? []) as RecordValue[]).sort((first, second) => Number(second.item_type === "REGISTRATION") - Number(first.item_type === "REGISTRATION")),
    congregations: ((congregations.data ?? []) as RecordValue[]).map((item) => ({ id: String(item.id), name: String(item.name), regionId: text(item, "region_id"), regionName: text(nested(item, "regions") ?? {}, "name") })),
    roles: ((roles.data ?? []) as RecordValue[]).map((item) => ({ id: String(item.id), name: String(item.name), femaleName: text(item, "female_name") })),
    fields: ((fields.data ?? []) as RecordValue[]).map(toRegistrationField),
    isRegistrationOpen: event.registrationStatus === "OPEN" && ["PUBLISHED", "IN_PROGRESS"].includes(event.status),
  };
}

export async function createPublicRegistration(publicCode: string, slug: string, input: PublicRegistrationForm, idempotencyKey: string) { const publicEvent = await getPublicEvent(publicCode, slug); if (!publicEvent || publicEvent.event.id !== input.eventId) throw new EventServiceError("Evento público indisponível."); const role = await resolveEventRoleSnapshot(publicEvent.event.churchId, input.participantRoleId, input.participantGender); const admin = createAdminClient(); const { data, error } = await admin.rpc("create_event_registration_v3", { p_event_id: input.eventId, p_payload: { ...input, participantType: "VISITOR", registrationSource: "PUBLIC", consentAccepted: true, metadata: role ? { participantRoleId: role.id, participantRoleName: role.name } : {} }, p_idempotency_key: idempotencyKey }); if (error) fail(error, "Não foi possível concluir a inscrição."); return data as RecordValue; }
export async function createPublicGroup(publicCode: string, slug: string, input: GroupForm, idempotencyKey: string) {
  const publicEvent = await getPublicEvent(publicCode, slug);
  if (!publicEvent || publicEvent.event.id !== input.eventId) throw new EventServiceError("Evento público indisponível.");
  const admin = createAdminClient();
  const {data,error}=await admin.rpc("create_event_caravan",{p_event_id:input.eventId,p_payload:{...input,metadata:{publicCode,slug}},p_items:input.items,p_idempotency_key:idempotencyKey});
  if(error)fail(error,"Não foi possível concluir a inscrição da caravana.");
  return data as RecordValue;
}

const caravanListTypes=new Set(["application/pdf","image/jpeg","image/png","application/vnd.openxmlformats-officedocument.spreadsheetml.sheet","application/vnd.openxmlformats-officedocument.wordprocessingml.document"]);
const caravanReceiptTypes=new Set(["application/pdf","image/jpeg","image/png","image/webp"]);

export async function preparePublicCaravanUpload(publicCode:string,slug:string,input:{sessionKey:string;kind:"list"|"receipt";fileName:string;mimeType:string;fileSize:number}){
  const publicEvent=await getPublicEvent(publicCode,slug);
  if(!publicEvent||publicEvent.event.registrationMode!=="MIXED"||!publicEvent.isRegistrationOpen)throw new EventServiceError("Inscrição pública de caravana indisponível.");
  const allowed=input.kind==="list"?caravanListTypes:caravanReceiptTypes;
  if(!allowed.has(input.mimeType)||input.fileSize<=0||input.fileSize>10*1024*1024)throw new EventServiceError("Arquivo inválido. Use um formato permitido com até 10 MB.");
  if(input.kind==="list"&&!publicEvent.event.paymentSettings.allowParticipantList)throw new EventServiceError("Este evento não recebe lista de participantes.");
  const safeSession=input.sessionKey.replace(/[^A-Za-z0-9_-]/g,"").slice(0,80);if(safeSession.length<20)throw new EventServiceError("Sessão de envio inválida.");
  const safeName=input.fileName.replace(/[^a-zA-Z0-9._-]/g,"_").slice(-180);
  const path=`${publicEvent.event.churchId}/events/${publicEvent.event.id}/public-caravans/${safeSession}/${input.kind}/${randomUUID()}/${safeName}`;
  const admin=createAdminClient();const {data,error}=await admin.storage.from("event-documents").createSignedUploadUrl(path);
  if(error)fail(error,"Não foi possível preparar o arquivo.");return{path,token:data.token};
}

export async function upsertPublicCaravanCheckout(publicCode:string,slug:string,input:PublicCaravanDraftForm){
  const publicEvent=await getPublicEvent(publicCode,slug);
  if(!publicEvent||publicEvent.event.id!==input.eventId||publicEvent.event.registrationMode!=="MIXED"||!publicEvent.isRegistrationOpen)throw new EventServiceError("Inscrição pública de caravana indisponível.");
  const admin=createAdminClient();
  const validation=await admin.rpc("validate_event_caravan_draft",{p_event_id:input.eventId,p_payload:input,p_items:input.items});
  if(validation.error)fail(validation.error,"Revise os dados, itens e vagas da caravana.");
  const sessionHash=createHash("sha256").update(input.sessionKey).digest("hex");
  const existing=await admin.from("event_public_checkouts").select("id,status").eq("event_id",input.eventId).eq("access_token_hash",sessionHash).maybeSingle();
  if(existing.error)fail(existing.error,"Não foi possível preparar a inscrição.");
  if(existing.data?.status==="COMPLETED")throw new EventServiceError("Esta caravana já foi concluída.");
  const expiresAt=new Date(Date.now()+2*60*60_000).toISOString();
  const payload={church_id:publicEvent.event.churchId,event_id:input.eventId,registration_id:null,group_id:null,access_token_hash:sessionHash,status:"DRAFT",checkout_type:"CARAVAN",payment_method:"NOT_APPLICABLE",expires_at:expiresAt,completed_at:null,idempotency_key:`caravan-draft:${sessionHash}`,draft_payload:input,updated_at:new Date().toISOString()};
  const persisted=existing.data
    ?await admin.from("event_public_checkouts").update(payload).eq("id",existing.data.id).neq("status","COMPLETED")
    :await admin.from("event_public_checkouts").insert(payload);
  if(persisted.error)fail(persisted.error,"Não foi possível salvar temporariamente a inscrição.");
  return{checkoutSaved:true,totalAmount:Number((validation.data as RecordValue)?.totalAmount??0),expiresAt};
}

async function validatePublicCaravanFile(admin:ReturnType<typeof createAdminClient>,path:string,mimeType:string,fileSize:number,allowed:Set<string>){
  if(!allowed.has(mimeType)||fileSize<=0||fileSize>10*1024*1024)throw new EventServiceError("Arquivo inválido.");
  const downloaded=await retryPublicCaravanStorageRead(()=>admin.storage.from("event-documents").download(path));if(downloaded.error||!downloaded.data)fail(downloaded.error,"Não foi possível validar o arquivo enviado. Aguarde alguns segundos e tente novamente.");
  const buffer=Buffer.from(await downloaded.data.arrayBuffer());if(buffer.length!==fileSize||!validUploadContent(buffer,mimeType)){await admin.storage.from("event-documents").remove([path]);throw new EventServiceError("O conteúdo do arquivo não corresponde ao formato informado.");}
}

export async function completePublicCaravan(publicCode:string,slug:string,input:PublicCaravanForm,idempotencyKey:string){
  const publicEvent=await getPublicEvent(publicCode,slug);if(!publicEvent||publicEvent.event.id!==input.eventId||!publicEvent.isRegistrationOpen)throw new EventServiceError("Inscrição pública de caravana indisponível.");
  const prefix=`${publicEvent.event.churchId}/events/${input.eventId}/public-caravans/${input.sessionKey}/`;
  if(input.listPath&&!input.listPath.startsWith(prefix))throw new EventServiceError("A lista não pertence a este evento.");
  if(input.paymentReceiptPath&&!input.paymentReceiptPath.startsWith(prefix))throw new EventServiceError("O comprovante não pertence a este evento.");
  if(input.listPath&&!publicEvent.event.paymentSettings.allowParticipantList)throw new EventServiceError("Este evento não recebe lista de participantes.");
  if(input.paymentMethod==="PIX"&&!publicEvent.event.paymentSettings.pixEnabled)throw new EventServiceError("O Pix não está habilitado neste evento.");
  if(input.paymentMethod==="CASH"&&!publicEvent.event.paymentSettings.cashEnabled)throw new EventServiceError("O pagamento em dinheiro não está habilitado neste evento.");
  const admin=createAdminClient();
  if(input.listPath)await validatePublicCaravanFile(admin,input.listPath,input.listMimeType,input.listFileSize,caravanListTypes);
  if(input.paymentReceiptPath)await validatePublicCaravanFile(admin,input.paymentReceiptPath,input.paymentReceiptMimeType,input.paymentReceiptFileSize,caravanReceiptTypes);
  const sessionHash=createHash("sha256").update(input.sessionKey).digest("hex");
  const completed=await admin.rpc("complete_event_public_caravan",{p_event_id:input.eventId,p_payload:input,p_items:input.items,p_idempotency_key:idempotencyKey,p_session_token_hash:sessionHash});
  if(completed.error){
    const internalCode=completed.error.message.match(/EVENT_[A-Z_]+/)?.[0]??"UNMAPPED_DATABASE_ERROR";
    console.error("[events] public caravan completion failed",{eventId:input.eventId,code:completed.error.code,internalCode,paymentMethod:input.paymentMethod,hasReceipt:Boolean(input.paymentReceiptPath),hasList:Boolean(input.listPath)});
    fail(completed.error,"Não foi possível concluir a inscrição da caravana.");
  }
  return{...(completed.data as RecordValue),accessToken:input.sessionKey};
}
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

export async function prepareCaravanParticipantList(eventId:string,groupId:string,input:{fileName:string;mimeType:string;fileSize:number}){
  const {supabase,row}=await getEventRow(eventId,PERMISSIONS.eventGroupsManage);const context=await requireAccessContext();
  if(!caravanListTypes.has(input.mimeType)||input.fileSize<=0||input.fileSize>10*1024*1024)throw new EventServiceError("Envie PDF, JPG, PNG, XLSX ou DOCX de até 10 MB.");
  const group=await supabase.from("event_groups").select("id").eq("id",groupId).eq("event_id",eventId).eq("status","CONFIRMED").is("deleted_at",null).maybeSingle();if(group.error||!group.data)fail(group.error,"Caravana não encontrada.");
  const id=randomUUID();const safeName=input.fileName.replace(/[^a-zA-Z0-9._-]/g,"_").slice(-180);const path=`${String(row.church_id)}/events/${eventId}/caravans/${groupId}/participant-list/${id}/${safeName}`;
  const inserted=await supabase.from("event_documents").insert({id,church_id:String(row.church_id),event_id:eventId,event_group_id:groupId,document_type:"CARAVAN_PARTICIPANT_LIST",title:"Lista de participantes da caravana",file_name:safeName,storage_bucket:"event-documents",storage_path:path,pending_storage_path:path,mime_type:input.mimeType,file_size:input.fileSize,is_sensitive:true,status:"ACTIVE",upload_status:"PENDING",pending_by:context.profile.id,pending_expires_at:new Date(Date.now()+30*60_000).toISOString(),uploaded_by:context.profile.id,updated_by:context.profile.id});if(inserted.error)fail(inserted.error,"Não foi possível preparar a lista.");
  const signed=await supabase.storage.from("event-documents").createSignedUploadUrl(path);if(signed.error)fail(signed.error,"Não foi possível preparar a lista.");return{id,path,token:signed.data.token};
}

export async function prepareEventBanner(eventId: string, fileName: string, mimeType: string) { const { supabase, row } = await getEventRow(eventId, PERMISSIONS.eventsManage); const extension = mimeType === "image/png" ? "png" : mimeType === "image/webp" ? "webp" : "jpg"; const path = `${String(row.church_id)}/events/${eventId}/banner/${randomUUID()}.${extension}`; const { data, error } = await supabase.storage.from("event-public-media").createSignedUploadUrl(path); if (error) fail(error, "Não foi possível preparar o banner."); return { path, token: data.token, fileName }; }
export async function finalizeEventBanner(eventId: string, path: string) { const { supabase, row } = await getEventRow(eventId, PERMISSIONS.eventsManage); const downloaded = await supabase.storage.from("event-public-media").download(path); if (downloaded.error || !downloaded.data) fail(downloaded.error, "Não foi possível validar o banner."); const buffer = Buffer.from(await downloaded.data.arrayBuffer()); const mime = path.endsWith(".png") ? "image/png" : path.endsWith(".webp") ? "image/webp" : "image/jpeg"; if (buffer.length > 5 * 1024 * 1024 || !validUploadContent(buffer, mime)) { await supabase.storage.from("event-public-media").remove([path]); throw new EventServiceError("O conteúdo do banner não corresponde ao formato informado."); } const publicUrl = supabase.storage.from("event-public-media").getPublicUrl(path).data.publicUrl; const { error } = await supabase.from("events").update({ banner_url: publicUrl, banner_storage_bucket: "event-public-media", banner_storage_path: path }).eq("id", eventId); if (error) fail(error, "Não foi possível confirmar o banner."); const previousPath = text(row, "banner_storage_path"); if (previousPath && previousPath !== path) await supabase.storage.from("event-public-media").remove([previousPath]); return publicUrl; }
export async function removeEventBanner(eventId: string) { const { supabase, row } = await getEventRow(eventId, PERMISSIONS.eventsManage); const path = text(row, "banner_storage_path"); const result = await supabase.from("events").update({ banner_url: null, banner_storage_bucket: null, banner_storage_path: null }).eq("id", eventId); if (result.error) fail(result.error, "Não foi possível remover o banner."); if (path) await supabase.storage.from("event-public-media").remove([path]); }
export async function prepareEventPixQr(eventId:string,fileName:string,mimeType:string){
  const {supabase,row}=await getEventRow(eventId,PERMISSIONS.eventsManage);const extension=mimeType==="image/png"?"png":mimeType==="image/webp"?"webp":"jpg";const path=`${String(row.church_id)}/events/${eventId}/caravan-pix/${randomUUID()}.${extension}`;const signed=await supabase.storage.from("event-public-media").createSignedUploadUrl(path);if(signed.error)fail(signed.error,"Não foi possível preparar o QR Code Pix.");return{path,token:signed.data.token,fileName};
}
export async function finalizeEventPixQr(eventId:string,path:string,fileName:string){
  const {supabase,row}=await getEventRow(eventId,PERMISSIONS.eventsManage);const prefix=`${String(row.church_id)}/events/${eventId}/caravan-pix/`;if(!path.startsWith(prefix))throw new EventServiceError("O QR Code não pertence a este evento.");const downloaded=await supabase.storage.from("event-public-media").download(path);if(downloaded.error||!downloaded.data)fail(downloaded.error,"Não foi possível validar o QR Code Pix.");const buffer=Buffer.from(await downloaded.data.arrayBuffer());const mime=path.endsWith(".png")?"image/png":path.endsWith(".webp")?"image/webp":"image/jpeg";if(buffer.length>2*1024*1024||!validUploadContent(buffer,mime)){await supabase.storage.from("event-public-media").remove([path]);throw new EventServiceError("Envie um QR Code JPG, PNG ou WEBP válido de até 2 MB.");}const current=await supabase.from("event_payment_settings").select("pix_qr_storage_bucket,pix_qr_storage_path").eq("event_id",eventId).is("deleted_at",null).single();if(current.error)fail(current.error,"Salve a configuração de caravanas antes do QR Code.");const updated=await supabase.from("event_payment_settings").update({pix_qr_storage_bucket:"event-public-media",pix_qr_storage_path:path,pix_qr_file_name:fileName}).eq("event_id",eventId);if(updated.error)fail(updated.error,"Não foi possível vincular o QR Code Pix.");if(current.data.pix_qr_storage_path&&current.data.pix_qr_storage_path!==path)await supabase.storage.from(current.data.pix_qr_storage_bucket??"event-public-media").remove([current.data.pix_qr_storage_path]);return supabase.storage.from("event-public-media").getPublicUrl(path).data.publicUrl;
}
export async function removeEventPixQr(eventId:string){
  const {supabase}=await getEventRow(eventId,PERMISSIONS.eventsManage);const current=await supabase.from("event_payment_settings").select("pix_qr_storage_bucket,pix_qr_storage_path").eq("event_id",eventId).is("deleted_at",null).single();if(current.error)fail(current.error,"QR Code Pix não encontrado.");const updated=await supabase.from("event_payment_settings").update({pix_qr_storage_bucket:null,pix_qr_storage_path:null,pix_qr_file_name:null}).eq("event_id",eventId);if(updated.error)fail(updated.error,"Não foi possível remover o QR Code Pix.");if(current.data.pix_qr_storage_path)await supabase.storage.from(current.data.pix_qr_storage_bucket??"event-public-media").remove([current.data.pix_qr_storage_path]);
}
export async function finalizeEventDocument(eventId: string, documentId: string) {
  const supabase = await createClient();
  const documentResult = await supabase.from("event_documents")
    .select("storage_bucket,storage_path,mime_type,file_size,event_group_id,document_type")
    .eq("id", documentId).eq("event_id", eventId).eq("upload_status", "PENDING").single();
  if (documentResult.error) fail(documentResult.error, "Documento pendente não encontrado.");
  const downloaded = await supabase.storage.from(documentResult.data.storage_bucket).download(documentResult.data.storage_path);
  if (downloaded.error || !downloaded.data) fail(downloaded.error, "Não foi possível validar o documento.");
  const buffer = Buffer.from(await downloaded.data.arrayBuffer());
  if (buffer.length > 10 * 1024 * 1024 || buffer.length !== Number(documentResult.data.file_size) || !documentResult.data.mime_type || !validUploadContent(buffer, documentResult.data.mime_type)) {
    await supabase.storage.from(documentResult.data.storage_bucket).remove([documentResult.data.storage_path]);
    await supabase.from("event_documents").update({ upload_status: "FAILED" }).eq("id", documentId);
    throw new EventServiceError("O conteúdo do arquivo não corresponde ao formato informado.");
  }
  const { error } = await supabase.from("event_documents").update({ upload_status: "ACTIVE", pending_storage_path: null, pending_by: null, pending_expires_at: null, uploaded_at: new Date().toISOString() }).eq("id", documentId).eq("event_id", eventId).eq("upload_status", "PENDING");
  if (error) fail(error, "Não foi possível confirmar o documento.");

  // A lista anterior só é arquivada depois de a substituta ter sido enviada e
  // validada. Assim, uma falha de rede nunca deixa a caravana sem documento.
  if (documentResult.data.document_type === "CARAVAN_PARTICIPANT_LIST" && documentResult.data.event_group_id) {
    const previous = await supabase.from("event_documents").select("id,storage_bucket,storage_path")
      .eq("event_id", eventId).eq("event_group_id", documentResult.data.event_group_id)
      .eq("document_type", "CARAVAN_PARTICIPANT_LIST").eq("upload_status", "ACTIVE")
      .neq("id", documentId).is("deleted_at", null);
    if (previous.error) fail(previous.error, "A nova lista foi salva, mas não foi possível localizar a anterior.");
    for (const prior of previous.data ?? []) {
      const archived = await supabase.from("event_documents").update({ deleted_at: new Date().toISOString() }).eq("id", prior.id).is("deleted_at", null);
      if (archived.error) fail(archived.error, "A nova lista foi salva, mas não foi possível arquivar a anterior.");
      await supabase.storage.from(prior.storage_bucket).remove([prior.storage_path]);
    }
  }
}
export async function getEventDocumentUrl(eventId: string, documentId: string) { const supabase = await createClient(); const { data: document, error } = await supabase.from("event_documents").select("storage_bucket,storage_path").eq("id", documentId).eq("event_id", eventId).eq("upload_status", "ACTIVE").is("deleted_at", null).single(); if (error) fail(error, "Documento indisponível."); const signed = await supabase.storage.from(document.storage_bucket).createSignedUrl(document.storage_path, 60); if (signed.error) fail(signed.error, "Não foi possível abrir o documento."); return signed.data.signedUrl; }
export async function deleteEventDocument(eventId: string, documentId: string) {
  const { row } = await getEventRow(eventId, PERMISSIONS.eventDocumentsManage);
  const context = await requireAccessContext();
  const admin = createAdminClient();
  const churchId = String(row.church_id);
  const documentResult = await admin
    .from("event_documents")
    .select("storage_bucket,storage_path")
    .eq("id", documentId)
    .eq("event_id", eventId)
    .eq("church_id", churchId)
    .eq("upload_status", "ACTIVE")
    .is("deleted_at", null)
    .single();
  if (documentResult.error) fail(documentResult.error, "Documento não encontrado ou já excluído.");

  const deletedAt = new Date().toISOString();
  const archiveResult = await admin
    .from("event_documents")
    .update({ deleted_at: deletedAt, deleted_by: context.profile.id, updated_by: context.profile.id })
    .eq("id", documentId)
    .eq("event_id", eventId)
    .eq("church_id", churchId)
    .is("deleted_at", null)
    .select("id")
    .single();
  if (archiveResult.error) fail(archiveResult.error, "Não foi possível excluir o documento.");

  const storageResult = await admin.storage
    .from(documentResult.data.storage_bucket)
    .remove([documentResult.data.storage_path]);
  if (storageResult.error) {
    await admin
      .from("event_documents")
      .update({ deleted_at: null, deleted_by: null, updated_by: context.profile.id })
      .eq("id", documentId)
      .eq("event_id", eventId)
      .eq("church_id", churchId)
      .eq("deleted_at", deletedAt);
    fail(storageResult.error, "Não foi possível excluir o arquivo do documento.");
  }
}

export async function prepareEventExpenseReceipt(eventId: string, fileName: string, mimeType: string) {
  if (!["application/pdf", "image/jpeg", "image/png", "image/webp"].includes(mimeType)) throw new EventServiceError("Formato de comprovante inválido.");
  const { supabase, row } = await getEventRow(eventId, PERMISSIONS.eventExpensesManage);
  const safeName = fileName.replace(/[^a-zA-Z0-9._-]/g, "_").slice(-180);
  const path = `${String(row.church_id)}/events/${eventId}/expenses/${randomUUID()}/${safeName}`;
  const signed = await supabase.storage.from("event-documents").createSignedUploadUrl(path);
  if (signed.error) fail(signed.error, "Não foi possível preparar o comprovante da despesa.");
  return { path, token: signed.data.token };
}

export async function discardPreparedEventExpenseReceipt(eventId: string, path: string) {
  const { supabase, row } = await getEventRow(eventId, PERMISSIONS.eventExpensesManage);
  const expectedPrefix = `${String(row.church_id)}/events/${eventId}/expenses/`;
  if (!path.startsWith(expectedPrefix)) return;
  await supabase.storage.from("event-documents").remove([path]);
}

export async function saveEventExpense(input: ExpenseForm) {
  const context = await requireAccessContext(PERMISSIONS.eventExpensesManage);
  const { supabase, row } = await getEventRow(input.eventId, PERMISSIONS.eventExpensesManage);
  const expectedPrefix = `${String(row.church_id)}/events/${input.eventId}/expenses/`;
  let previousPath: string | null = null;
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
  const receiptPayload = input.receiptPath ? {
    receipt_storage_bucket: "event-documents", receipt_storage_path: input.receiptPath,
    receipt_file_name: input.receiptFileName, receipt_mime_type: input.receiptMimeType,
    receipt_file_size: input.receiptFileSize, upload_status: "ACTIVE",
  } : {};
  if (input.id) {
    const current = await supabase.from("event_expenses").select("receipt_storage_path,updated_at").eq("id", input.id).eq("event_id", input.eventId).is("deleted_at", null).single();
    if (current.error) fail(current.error, "Despesa não encontrada.");
    if (input.expectedUpdatedAt && current.data.updated_at !== input.expectedUpdatedAt) throw new EventServiceError("Esta despesa foi alterada por outra pessoa. Recarregue a página.");
    previousPath = current.data.receipt_storage_path;
    const updated = await supabase.from("event_expenses").update({ name: input.name, expense_date: input.expenseDate, amount: input.amount, ...receiptPayload, updated_by: context.profile.id }).eq("id", input.id).eq("event_id", input.eventId).is("deleted_at", null).select("id").single();
    if (updated.error) {
      if (input.receiptPath) await supabase.storage.from("event-documents").remove([input.receiptPath]);
      fail(updated.error, "Não foi possível atualizar a despesa.");
    }
  } else {
    const inserted = await supabase.from("event_expenses").insert({ church_id: context.church.id, event_id: input.eventId, name: input.name, expense_date: input.expenseDate, amount: input.amount, ...receiptPayload, created_by: context.profile.id, updated_by: context.profile.id }).select("id").single();
    if (inserted.error) {
      if (input.receiptPath) await supabase.storage.from("event-documents").remove([input.receiptPath]);
      fail(inserted.error, "Não foi possível cadastrar a despesa.");
    }
  }
  if (previousPath && input.receiptPath && previousPath !== input.receiptPath) {
    await createAdminClient().storage.from("event-documents").remove([previousPath]);
  }
}

export async function getEventExpenseReceiptUrl(eventId: string, expenseId: string) {
  const { supabase } = await getEventRow(eventId, PERMISSIONS.eventExpensesView);
  const expense = await supabase.from("event_expenses").select("receipt_storage_bucket,receipt_storage_path").eq("id", expenseId).eq("event_id", eventId).eq("upload_status", "ACTIVE").is("deleted_at", null).single();
  if (expense.error || !expense.data.receipt_storage_path) fail(expense.error, "Comprovante indisponível.");
  const signed = await supabase.storage.from(expense.data.receipt_storage_bucket ?? "event-documents").createSignedUrl(expense.data.receipt_storage_path, 60);
  if (signed.error) fail(signed.error, "Não foi possível abrir o comprovante.");
  return signed.data.signedUrl;
}

export async function deleteEventExpense(eventId: string, expenseId: string) {
  const { row } = await getEventRow(eventId, PERMISSIONS.eventExpensesManage);
  const context = await requireAccessContext();
  const admin = createAdminClient();
  const current = await admin.from("event_expenses").select("receipt_storage_bucket,receipt_storage_path").eq("id", expenseId).eq("event_id", eventId).eq("church_id", String(row.church_id)).is("deleted_at", null).single();
  if (current.error) fail(current.error, "Despesa não encontrada ou já excluída.");
  const deletedAt = new Date().toISOString();
  const archived = await admin.from("event_expenses").update({ deleted_at: deletedAt, deleted_by: context.profile.id, updated_by: context.profile.id }).eq("id", expenseId).eq("event_id", eventId).eq("church_id", String(row.church_id)).is("deleted_at", null).select("id").single();
  if (archived.error) fail(archived.error, "Não foi possível excluir a despesa.");
  if (current.data.receipt_storage_path) {
    const removed = await admin.storage.from(current.data.receipt_storage_bucket ?? "event-documents").remove([current.data.receipt_storage_path]);
    if (removed.error) {
      await admin.from("event_expenses").update({ deleted_at: null, deleted_by: null, updated_by: context.profile.id }).eq("id", expenseId).eq("deleted_at", deletedAt);
      fail(removed.error, "Não foi possível excluir o comprovante da despesa.");
    }
  }
}
export async function cleanupStaleEventUploads() { const admin = createAdminClient(); const { data, error } = await admin.from("event_documents").select("id,storage_bucket,storage_path").in("upload_status", ["PENDING", "FAILED"]).or(`pending_expires_at.lt.${new Date().toISOString()},upload_status.eq.FAILED`).limit(100); if (error) fail(error, "Não foi possível localizar uploads pendentes."); let removed = 0; for (const document of data ?? []) { await admin.storage.from(document.storage_bucket).remove([document.storage_path]); const deleted = await admin.from("event_documents").delete().eq("id", document.id).in("upload_status", ["PENDING", "FAILED"]); if (!deleted.error) removed += 1; } return { examined: data?.length ?? 0, removed }; }

export async function loadEventReport(eventId: string) { await requireAccessContext(PERMISSIONS.eventReportsExport); return getEventWorkspace(eventId); }
