import "server-only";

import ExcelJS from "exceljs";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { PERMISSIONS } from "@/modules/auth/constants/permissions";
import { requireAccessContext } from "@/modules/auth/services/access-context.service";
import {
  PAYMENT_METHODS,
  PAYMENT_STATUSES,
  REGISTRATION_STATUSES,
  eventLabel,
} from "../constants/events";
import type {
  EventFinancialItemSource,
  EventFinancialExpenseSource,
  EventFinancialPaymentSource,
  EventFinancialRegistrationSource,
  EventFinancialReportConfig,
  EventFinancialReportPreview,
  EventCaravanReportConfig,
  EventCaravanReportPreview,
  EventCaravanReportSource,
  EventGeneralReportConfig,
  EventGeneralReportFilters,
  EventGeneralReportPreview,
  EventParticipantReportConfig,
  EventParticipantReportPreview,
  EventParticipantReportSource,
  EventReportCongregationSource,
  EventReportRegionSource,
} from "../types/event.types";
import { aggregateEventGeneralReport } from "./event-general-report";
import { createEventGeneralReportPdf } from "./event-general-report-pdf.service";
import { organizeEventParticipants } from "./event-participant-report";
import { createEventParticipantReportPdf } from "./event-participant-report-pdf.service";
import { aggregateEventFinancialReport } from "./event-financial-report";
import { createEventFinancialReportPdf } from "./event-financial-report-pdf.service";
import { organizeEventCaravans } from "./event-caravan-report";
import { createEventCaravanReportPdf } from "./event-caravan-report-pdf.service";
import { loadEventReport } from "./event.service";

type ReportType = "participants" | "financial" | "checkins" | "executive";
type RecordValue = Record<string, unknown>;
type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

type RegistrationRecord = {
  id: string;
  event_group_id: string | null;
  registration_number: string | null;
  participant_name: string;
  participant_phone: string | null;
  congregation_id: string | null;
  participant_gender: string | null;
  preferred_payment_method: string | null;
  status: string;
  payment_status: string;
  total_amount: number | string;
  paid_amount: number | string;
  remaining_amount: number | string;
  registered_at: string;
  metadata: Record<string, unknown> | null;
};

const labels: Record<ReportType, string> = {
  participants: "Participantes",
  financial: "Financeiro",
  checkins: "Presença",
  executive: "Resumo executivo",
};

const paymentMethodLabels = new Map<string, string>([
  ...PAYMENT_METHODS,
  ["NOT_APPLICABLE", "Não aplicável"] as const,
]);
export class EventReportError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "EventReportError";
  }
}

function rowsFor(type: ReportType, data: Awaited<ReturnType<typeof loadEventReport>>, status?: string) {
  if (type === "participants") {
    return data.registrations.filter((row) => !status || row.status === status).map((row) => ({
      Inscrição: row.registrationNumber,
      Participante: row.participantName,
      Tipo: row.participantType,
      Telefone: row.participantPhone,
      Regional: row.regionName,
      Congregação: row.congregationName,
      Situação: row.status,
      "Situação financeira": row.paymentStatus,
      "Valor previsto": row.totalAmount,
      "Valor recebido": row.paidAmount,
    }));
  }
  if (type === "financial") {
    return data.payments.filter((row) => !status || row.status === status).map((row) => ({
      Pagamento: row.paymentNumber,
      Pagador: row.payerName,
      Método: row.method,
      Situação: row.status,
      Valor: row.amount,
      "Pago em": row.paidAt,
    }));
  }
  if (type === "checkins") {
    return data.registrations.filter((row) => !status || row.status === status).map((row) => {
      const checkin = data.checkins.find((item) => item.registrationId === row.id && item.status === "CHECKED_IN");
      return {
        Inscrição: row.registrationNumber,
        Participante: row.participantName,
        Presença: checkin ? "Presente" : row.status === "CONFIRMED" ? "Ausente" : "Não elegível",
        Método: checkin?.method ?? "",
        "Check-in": checkin?.checkedInAt ?? "",
      };
    });
  }
  const confirmed = data.registrations.filter((row) => row.status === "CONFIRMED").length;
  const received = data.payments.filter((row) => row.status === "CONFIRMED").reduce((sum, row) => sum + row.amount, 0);
  return [
    { Indicador: "Evento", Valor: data.event.name },
    { Indicador: "Capacidade", Valor: data.event.capacity ?? "Ilimitada" },
    { Indicador: "Ocupação", Valor: data.event.occupied },
    { Indicador: "Confirmados", Valor: confirmed },
    { Indicador: "Grupos", Valor: data.groups.length },
    { Indicador: "Check-ins", Valor: data.checkins.filter((row) => row.status === "CHECKED_IN").length },
    { Indicador: "Recebido", Valor: received },
  ];
}

function csvEscape(value: unknown) {
  const text = String(value ?? "");
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export async function generateEventReport(eventId: string, type: ReportType, format: "xlsx" | "csv", status?: string) {
  const data = await loadEventReport(eventId);
  const rows = rowsFor(type, data, status);
  const columns = Object.keys(rows[0] ?? { Resultado: "Sem dados" });
  let body: Buffer;
  let contentType: string;
  let extension: string;
  if (format === "csv") {
    const content = [
      columns.join(","),
      ...rows.map((row) => columns.map((column) => csvEscape((row as Record<string, unknown>)[column])).join(",")),
    ].join("\r\n");
    body = Buffer.from(`\uFEFF${content}`, "utf8");
    contentType = "text/csv; charset=utf-8";
    extension = "csv";
  } else {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = "EKLESIA";
    const sheet = workbook.addWorksheet(labels[type], { views: [{ state: "frozen", ySplit: 1 }] });
    sheet.columns = columns.map((header) => ({ header, key: header, width: Math.min(42, Math.max(14, header.length + 3)) }));
    rows.forEach((row) => sheet.addRow(row));
    const header = sheet.getRow(1);
    header.height = 24;
    header.eachCell((cell) => {
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF415BA5" } };
      cell.font = { color: { argb: "FFFFFFFF" }, bold: true };
    });
    sheet.autoFilter = { from: { row: 1, column: 1 }, to: { row: Math.max(1, sheet.rowCount), column: columns.length } };
    const output = await workbook.xlsx.writeBuffer();
    body = Buffer.from(output);
    contentType = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
    extension = "xlsx";
  }
  const supabase = await createClient();
  await supabase.rpc("log_audit", {
    p_church_id: data.event.churchId,
    p_module: "EVENTS",
    p_action: "EXPORT_REPORT",
    p_entity_type: "EVENT",
    p_entity_id: eventId,
    p_entity_label: data.event.name,
    p_description: "Relatório de evento exportado",
    p_old_values: null,
    p_new_values: null,
    p_metadata: { report: type, format, status: status ?? null, row_count: rows.length },
    p_severity: "INFO",
  });
  return { body, contentType, fileName: `evento-${data.event.publicCode}-${type}.${extension}` };
}

function numberValue(row: RecordValue, key: string) {
  const parsed = Number(row[key] ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function textValue(row: RecordValue, key: string) {
  return typeof row[key] === "string" ? String(row[key]) : null;
}

function nestedValue(row: RecordValue, key: string) {
  const value = row[key];
  if (Array.isArray(value)) return (value[0] ?? null) as RecordValue | null;
  return value && typeof value === "object" ? value as RecordValue : null;
}

async function loadItemRegistrationIds(supabase: SupabaseServerClient, eventId: string, itemId: string) {
  const ids = new Set<string>();
  const pageSize = 1000;
  for (let from = 0; ; from += pageSize) {
    const result = await supabase
      .from("event_registration_items")
      .select("event_registration_id")
      .eq("event_id", eventId)
      .eq("event_item_id", itemId)
      .is("deleted_at", null)
      .order("id")
      .range(from, from + pageSize - 1);
    if (result.error) throw new EventReportError("Não foi possível aplicar o filtro por item.");
    for (const row of result.data ?? []) {
      if (row.event_registration_id) ids.add(String(row.event_registration_id));
    }
    if ((result.data?.length ?? 0) < pageSize) break;
  }
  return ids;
}

async function loadFilteredRegistrations(
  supabase: SupabaseServerClient,
  eventId: string,
  churchId: string,
  config: { filters: EventGeneralReportFilters },
  congregationIdsForRegion: string[],
) {
  if (config.filters.regionId && congregationIdsForRegion.length === 0) return [];
  const itemRegistrationIds = config.filters.itemId
    ? await loadItemRegistrationIds(supabase, eventId, config.filters.itemId)
    : null;
  if (itemRegistrationIds && itemRegistrationIds.size === 0) return [];

  const rows: RegistrationRecord[] = [];
  const pageSize = 1000;
  for (let from = 0; ; from += pageSize) {
    let query = supabase
      .from("event_registrations")
      .select("id,event_group_id,registration_number,participant_name,participant_phone,congregation_id,participant_gender,preferred_payment_method,status,payment_status,total_amount,paid_amount,remaining_amount,registered_at,metadata")
      .eq("event_id", eventId)
      .eq("church_id", churchId)
      .is("deleted_at", null);

    query = config.filters.registrationStatus
      ? query.eq("status", config.filters.registrationStatus)
      : query.in("status", ["PENDING", "CONFIRMED", "CHECKED_IN"]);
    if (config.filters.congregationId) query = query.eq("congregation_id", config.filters.congregationId);
    else if (config.filters.regionId) query = query.in("congregation_id", congregationIdsForRegion);
    if (config.filters.gender) query = query.eq("participant_gender", config.filters.gender);
    if (config.filters.paymentMethod) query = query.eq("preferred_payment_method", config.filters.paymentMethod);
    if (config.filters.paymentStatus) query = query.eq("payment_status", config.filters.paymentStatus);
    if (config.filters.registeredFrom) query = query.gte("registered_at", `${config.filters.registeredFrom}T00:00:00-03:00`);
    if (config.filters.registeredTo) query = query.lte("registered_at", `${config.filters.registeredTo}T23:59:59.999-03:00`);

    const result = await query.order("id").range(from, from + pageSize - 1);
    if (result.error) throw new EventReportError("Não foi possível calcular as inscrições do relatório.");
    rows.push(...((result.data ?? []) as RegistrationRecord[]));
    if ((result.data?.length ?? 0) < pageSize) break;
  }

  return rows.filter((row) => {
    const metadata = row.metadata ?? {};
    if (config.filters.roleId && metadata.participantRoleId !== config.filters.roleId) return false;
    if (itemRegistrationIds && !itemRegistrationIds.has(row.id)) return false;
    return true;
  });
}

async function loadRegistrationItemNames(
  supabase: SupabaseServerClient,
  eventId: string,
  registrationIds: Set<string>,
) {
  const namesByRegistration = new Map<string, string[]>();
  if (registrationIds.size === 0) return namesByRegistration;
  const pageSize = 1000;
  for (let from = 0; ; from += pageSize) {
    const result = await supabase
      .from("event_registration_items")
      .select("event_registration_id,event_items!event_registration_items_event_item_id_fkey(name)")
      .eq("event_id", eventId)
      .is("deleted_at", null)
      .order("id")
      .range(from, from + pageSize - 1);
    if (result.error) throw new EventReportError("Não foi possível carregar os itens dos participantes.");
    for (const source of (result.data ?? []) as RecordValue[]) {
      const registrationId = textValue(source, "event_registration_id");
      if (!registrationId || !registrationIds.has(registrationId)) continue;
      const item = nestedValue(source, "event_items");
      const itemName = item ? textValue(item, "name") : null;
      if (!itemName) continue;
      const names = namesByRegistration.get(registrationId) ?? [];
      names.push(itemName);
      namesByRegistration.set(registrationId, names);
    }
    if ((result.data?.length ?? 0) < pageSize) break;
  }
  return namesByRegistration;
}

async function loadFinancialPayments(
  supabase: SupabaseServerClient,
  eventId: string,
  churchId: string,
  paymentMethod: string,
  fromDate = "",
  toDate = "",
) {
  const rows: EventFinancialPaymentSource[] = [];
  const pageSize = 1000;
  for (let from = 0; ; from += pageSize) {
    let query = supabase
      .from("event_payments")
      .select("id,event_registration_id,event_group_id,payment_method,payment_status,amount,paid_at")
      .eq("event_id", eventId)
      .eq("church_id", churchId)
      .eq("payment_status", "CONFIRMED")
      .is("deleted_at", null);
    if (paymentMethod) query = query.eq("payment_method", paymentMethod);
    if (fromDate) query = query.gte("paid_at", `${fromDate}T00:00:00-03:00`);
    if (toDate) query = query.lte("paid_at", `${toDate}T23:59:59.999-03:00`);
    const result = await query.order("id").range(from, from + pageSize - 1);
    if (result.error) throw new EventReportError("Não foi possível calcular os pagamentos confirmados do relatório.");
    for (const row of (result.data ?? []) as RecordValue[]) {
      rows.push({
        id: String(row.id),
        registrationId: textValue(row, "event_registration_id"),
        groupId: textValue(row, "event_group_id"),
        method: String(row.payment_method),
        status: String(row.payment_status),
        amount: numberValue(row, "amount"),
        paidAt: textValue(row, "paid_at"),
      });
    }
    if ((result.data?.length ?? 0) < pageSize) break;
  }
  return rows;
}

async function loadFinancialExpenses(
  supabase: SupabaseServerClient,
  eventId: string,
  churchId: string,
  filters: EventFinancialReportConfig["expenseFilters"],
) {
  const rows: EventFinancialExpenseSource[] = [];
  const pageSize = 1000;
  for (let from = 0; ; from += pageSize) {
    let query = supabase.from("event_expenses").select("id,name,expense_date,amount,receipt_storage_path")
      .eq("event_id", eventId).eq("church_id", churchId).is("deleted_at", null);
    if (filters.name) query = query.ilike("name", `%${filters.name.replace(/[,%()]/g, " ")}%`);
    if (filters.from) query = query.gte("expense_date", filters.from);
    if (filters.to) query = query.lte("expense_date", filters.to);
    const result = await query.order("expense_date", { ascending: false }).order("id").range(from, from + pageSize - 1);
    if (result.error) throw new EventReportError("Não foi possível carregar as despesas do relatório.");
    for (const row of (result.data ?? []) as RecordValue[]) rows.push({ id: String(row.id), name: String(row.name), expenseDate: String(row.expense_date), amount: numberValue(row, "amount"), hasReceipt: Boolean(row.receipt_storage_path) });
    if ((result.data?.length ?? 0) < pageSize) break;
  }
  return rows;
}

async function loadFinancialItems(
  supabase: SupabaseServerClient,
  eventId: string,
  churchId: string,
) {
  const rows: EventFinancialItemSource[] = [];
  const pageSize = 1000;
  for (let from = 0; ; from += pageSize) {
    const result = await supabase
      .from("event_registration_items")
      .select("id,event_registration_id,event_group_id,event_item_id,item_name,quantity,total_price")
      .eq("event_id", eventId)
      .eq("church_id", churchId)
      .is("deleted_at", null)
      .order("id")
      .range(from, from + pageSize - 1);
    if (result.error) throw new EventReportError("Não foi possível calcular os itens selecionados do relatório.");
    for (const row of (result.data ?? []) as RecordValue[]) {
      rows.push({
        id: String(row.id),
        registrationId: textValue(row, "event_registration_id"),
        groupId: textValue(row, "event_group_id"),
        itemId: String(row.event_item_id),
        itemName: String(row.item_name),
        quantity: numberValue(row, "quantity"),
        expectedAmount: numberValue(row, "total_price"),
      });
    }
    if ((result.data?.length ?? 0) < pageSize) break;
  }
  return rows;
}

async function loadFinancialCaravans(supabase:SupabaseServerClient,eventId:string,churchId:string,paymentStatus:string){
  const rows:EventFinancialRegistrationSource[]=[];const pageSize=1000;
  for(let from=0;;from+=pageSize){let query=supabase.from("event_groups").select("id,payment_status,total_amount,paid_amount").eq("event_id",eventId).eq("church_id",churchId).eq("status","CONFIRMED").is("deleted_at",null);if(paymentStatus)query=query.eq("payment_status",paymentStatus);const result=await query.order("id").range(from,from+pageSize-1);if(result.error)throw new EventReportError("Não foi possível calcular as caravanas do relatório financeiro.");for(const row of (result.data??[]) as RecordValue[])rows.push({id:`caravan:${row.id}`,groupId:String(row.id),paymentStatus:String(row.payment_status),totalAmount:numberValue(row,"total_amount"),paidAmount:numberValue(row,"paid_amount"),remainingAmount:Math.max(numberValue(row,"total_amount")-numberValue(row,"paid_amount"),0)});if((result.data?.length??0)<pageSize)break;}return rows;
}

function formatShortDate(value: string) {
  return new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo" }).format(new Date(`${value}T12:00:00-03:00`));
}

function safeSlug(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 80) || "evento";
}

async function loadEventGeneralReportData(eventId: string, config: EventGeneralReportConfig): Promise<EventGeneralReportPreview> {
  const context = await requireAccessContext(PERMISSIONS.eventReportsExport);
  const supabase = await createClient();
  const eventResult = await supabase
    .from("events")
    .select("id,church_id,name,public_code")
    .eq("id", eventId)
    .eq("church_id", context.church.id)
    .is("deleted_at", null)
    .maybeSingle();
  if (eventResult.error || !eventResult.data) throw new EventReportError("Evento não encontrado ou indisponível para relatórios.");

  const [regionsResult, congregationsResult, quotasResult] = await Promise.all([
    supabase.from("regions").select("id,name,coordinator_name,display_order").eq("church_id", context.church.id).eq("status", "ACTIVE").is("deleted_at", null).limit(1000),
    supabase.from("congregations").select("id,name,region_id,pastor_name,display_order").eq("church_id", context.church.id).eq("status", "ACTIVE").is("deleted_at", null).limit(2000),
    supabase.from("event_congregation_quotas").select("congregation_id,quota_total").eq("event_id", eventId).eq("church_id", context.church.id).is("deleted_at", null).limit(2000),
  ]);
  const referenceError = regionsResult.error ?? congregationsResult.error ?? quotasResult.error;
  if (referenceError) throw new EventReportError("Não foi possível carregar a estrutura e as metas do relatório.");

  const regions: EventReportRegionSource[] = ((regionsResult.data ?? []) as RecordValue[]).map((row) => ({
    id: String(row.id),
    name: String(row.name),
    coordinatorName: textValue(row, "coordinator_name"),
    displayOrder: numberValue(row, "display_order"),
  }));
  const congregations: EventReportCongregationSource[] = ((congregationsResult.data ?? []) as RecordValue[]).map((row) => ({
    id: String(row.id),
    name: String(row.name),
    regionId: textValue(row, "region_id"),
    pastorName: textValue(row, "pastor_name"),
    displayOrder: numberValue(row, "display_order"),
  }));

  const selectedRegion = config.filters.regionId ? regions.find((region) => region.id === config.filters.regionId) : null;
  const selectedCongregation = config.filters.congregationId ? congregations.find((congregation) => congregation.id === config.filters.congregationId) : null;
  if (config.filters.regionId && !selectedRegion) throw new EventReportError("A regional selecionada não está disponível.");
  if (config.filters.congregationId && !selectedCongregation) throw new EventReportError("A congregação selecionada não está disponível.");
  if (selectedRegion && selectedCongregation && selectedCongregation.regionId !== selectedRegion.id) {
    throw new EventReportError("A congregação selecionada não pertence à regional informada.");
  }

  const congregationIdsForRegion = config.filters.regionId
    ? congregations.filter((congregation) => congregation.regionId === config.filters.regionId).map((congregation) => congregation.id)
    : [];
  const registrationRows = await loadFilteredRegistrations(supabase, eventId, context.church.id, config, congregationIdsForRegion);
  const quotas = new Map<string, number>();
  for (const row of (quotasResult.data ?? []) as RecordValue[]) {
    quotas.set(String(row.congregation_id), numberValue(row, "quota_total"));
  }

  const aggregation = aggregateEventGeneralReport({
    config,
    regions,
    congregations,
    registrations: registrationRows.map((row) => {
      const metadata = row.metadata ?? {};
      return {
        id: row.id,
        congregationId: row.congregation_id,
        roleId: typeof metadata.participantRoleId === "string" ? metadata.participantRoleId : null,
        roleName: typeof metadata.participantRoleName === "string" ? metadata.participantRoleName : null,
        gender: row.participant_gender,
      };
    }),
    quotas,
  });

  const appliedFilters: { label: string; value: string }[] = [];
  if (selectedRegion) appliedFilters.push({ label: "Regional", value: selectedRegion.name });
  if (selectedCongregation) appliedFilters.push({ label: "Congregação", value: selectedCongregation.name });
  if (config.filters.roleId) {
    const role = await createAdminClient().from("roles").select("name,female_name").eq("id", config.filters.roleId).eq("church_id", context.church.id).eq("status", "ACTIVE").is("deleted_at", null).maybeSingle();
    if (role.error || !role.data) throw new EventReportError("O cargo selecionado não está disponível.");
    const roleName = config.filters.gender === "FEMALE" ? role.data.female_name || role.data.name : role.data.name;
    appliedFilters.push({ label: "Cargo", value: roleName });
  }
  if (config.filters.gender) appliedFilters.push({ label: "Sexo", value: config.filters.gender === "FEMALE" ? "Feminino" : "Masculino" });
  if (config.filters.registrationStatus) appliedFilters.push({ label: "Situação da inscrição", value: eventLabel(REGISTRATION_STATUSES, config.filters.registrationStatus) });
  if (config.filters.paymentMethod) appliedFilters.push({ label: "Forma de pagamento", value: paymentMethodLabels.get(config.filters.paymentMethod) ?? config.filters.paymentMethod });
  if (config.filters.paymentStatus) appliedFilters.push({ label: "Situação do pagamento", value: eventLabel(PAYMENT_STATUSES, config.filters.paymentStatus) });
  if (config.filters.itemId) {
    const item = await supabase.from("event_items").select("name").eq("id", config.filters.itemId).eq("event_id", eventId).eq("church_id", context.church.id).is("deleted_at", null).maybeSingle();
    if (item.error || !item.data) throw new EventReportError("O item selecionado não está disponível.");
    appliedFilters.push({ label: "Item", value: item.data.name });
  }
  const periodLabel = config.filters.registeredFrom || config.filters.registeredTo
    ? `${config.filters.registeredFrom ? formatShortDate(config.filters.registeredFrom) : "início"} a ${config.filters.registeredTo ? formatShortDate(config.filters.registeredTo) : "hoje"}`
    : null;
  if (periodLabel) appliedFilters.push({ label: "Período de inscrição", value: periodLabel });

  return {
    event: { id: eventResult.data.id, name: eventResult.data.name, publicCode: eventResult.data.public_code },
    churchName: context.church.name,
    issuedAt: new Date().toISOString(),
    orientation: "portrait",
    totalRegistrations: aggregation.totalRegistrations,
    regionCount: aggregation.regionRows.length,
    congregationCount: aggregation.congregationRows.length,
    roleCount: aggregation.roleRows.length,
    genderCount: aggregation.genderRows.length,
    activeFilterCount: appliedFilters.length,
    periodLabel,
    appliedFilters,
    regions: aggregation.regionRows,
    congregations: aggregation.congregationRows,
    roles: aggregation.roleRows,
    genders: aggregation.genderRows,
    config,
  };
}

async function loadEventParticipantReportData(
  eventId: string,
  config: EventParticipantReportConfig,
): Promise<EventParticipantReportPreview> {
  const context = await requireAccessContext(PERMISSIONS.eventReportsExport);
  const supabase = await createClient();
  const eventResult = await supabase
    .from("events")
    .select("id,church_id,name,public_code")
    .eq("id", eventId)
    .eq("church_id", context.church.id)
    .is("deleted_at", null)
    .maybeSingle();
  if (eventResult.error || !eventResult.data) throw new EventReportError("Evento não encontrado ou indisponível para relatórios.");

  const [regionsResult, congregationsResult] = await Promise.all([
    supabase.from("regions").select("id,name,display_order").eq("church_id", context.church.id).eq("status", "ACTIVE").is("deleted_at", null).limit(1000),
    supabase.from("congregations").select("id,name,region_id,display_order").eq("church_id", context.church.id).eq("status", "ACTIVE").is("deleted_at", null).limit(2000),
  ]);
  if (regionsResult.error || congregationsResult.error) {
    throw new EventReportError("Não foi possível carregar a estrutura do relatório.");
  }

  const regions = ((regionsResult.data ?? []) as RecordValue[]).map((row) => ({
    id: String(row.id),
    name: String(row.name),
    displayOrder: numberValue(row, "display_order"),
  }));
  const congregations = ((congregationsResult.data ?? []) as RecordValue[]).map((row) => ({
    id: String(row.id),
    name: String(row.name),
    regionId: textValue(row, "region_id"),
    displayOrder: numberValue(row, "display_order"),
  }));
  const regionById = new Map(regions.map((region) => [region.id, region]));
  const congregationById = new Map(congregations.map((congregation) => [congregation.id, congregation]));

  const selectedRegion = config.filters.regionId ? regionById.get(config.filters.regionId) : null;
  const selectedCongregation = config.filters.congregationId ? congregationById.get(config.filters.congregationId) : null;
  if (config.filters.regionId && !selectedRegion) throw new EventReportError("A regional selecionada não está disponível.");
  if (config.filters.congregationId && !selectedCongregation) throw new EventReportError("A congregação selecionada não está disponível.");
  if (selectedRegion && selectedCongregation && selectedCongregation.regionId !== selectedRegion.id) {
    throw new EventReportError("A congregação selecionada não pertence à regional informada.");
  }

  const congregationIdsForRegion = config.filters.regionId
    ? congregations.filter((congregation) => congregation.regionId === config.filters.regionId).map((congregation) => congregation.id)
    : [];
  const registrationRows = await loadFilteredRegistrations(supabase, eventId, context.church.id, config, congregationIdsForRegion);
  const registrationIds = new Set(registrationRows.map((row) => row.id));
  const itemNamesByRegistration = config.columns.items
    ? await loadRegistrationItemNames(supabase, eventId, registrationIds)
    : new Map<string, string[]>();

  const sources: EventParticipantReportSource[] = registrationRows.map((row) => {
    const congregation = row.congregation_id ? congregationById.get(row.congregation_id) : null;
    const region = congregation?.regionId ? regionById.get(congregation.regionId) : null;
    const metadata = row.metadata ?? {};
    return {
      id: row.id,
      registrationNumber: row.registration_number,
      participantName: row.participant_name,
      participantGender: row.participant_gender,
      participantPhone: row.participant_phone,
      roleName: typeof metadata.participantRoleName === "string" ? metadata.participantRoleName : null,
      congregationId: congregation?.id ?? null,
      congregationName: congregation?.name ?? null,
      congregationDisplayOrder: congregation?.displayOrder ?? Number.MAX_SAFE_INTEGER,
      regionId: region?.id ?? null,
      regionName: region?.name ?? null,
      regionDisplayOrder: region?.displayOrder ?? Number.MAX_SAFE_INTEGER,
      registrationStatus: row.status,
      paymentMethod: row.preferred_payment_method,
      paymentStatus: row.payment_status,
      registeredAt: row.registered_at,
      itemNames: itemNamesByRegistration.get(row.id) ?? [],
    };
  });
  const participants = organizeEventParticipants(sources, config);

  const appliedFilters: { label: string; value: string }[] = [];
  if (selectedRegion) appliedFilters.push({ label: "Regional", value: selectedRegion.name });
  if (selectedCongregation) appliedFilters.push({ label: "Congregação", value: selectedCongregation.name });
  if (config.filters.roleId) {
    const role = await createAdminClient().from("roles").select("name,female_name").eq("id", config.filters.roleId).eq("church_id", context.church.id).eq("status", "ACTIVE").is("deleted_at", null).maybeSingle();
    if (role.error || !role.data) throw new EventReportError("O cargo selecionado não está disponível.");
    const roleName = config.filters.gender === "FEMALE" ? role.data.female_name || role.data.name : role.data.name;
    appliedFilters.push({ label: "Cargo", value: roleName });
  }
  if (config.filters.gender) appliedFilters.push({ label: "Sexo", value: config.filters.gender === "FEMALE" ? "Feminino" : "Masculino" });
  if (config.filters.registrationStatus) appliedFilters.push({ label: "Situação da inscrição", value: eventLabel(REGISTRATION_STATUSES, config.filters.registrationStatus) });
  if (config.filters.paymentMethod) appliedFilters.push({ label: "Forma de pagamento", value: paymentMethodLabels.get(config.filters.paymentMethod) ?? config.filters.paymentMethod });
  if (config.filters.paymentStatus) appliedFilters.push({ label: "Situação do pagamento", value: eventLabel(PAYMENT_STATUSES, config.filters.paymentStatus) });
  if (config.filters.itemId) {
    const item = await supabase.from("event_items").select("name").eq("id", config.filters.itemId).eq("event_id", eventId).eq("church_id", context.church.id).is("deleted_at", null).maybeSingle();
    if (item.error || !item.data) throw new EventReportError("O item selecionado não está disponível.");
    appliedFilters.push({ label: "Item", value: item.data.name });
  }
  if (config.filters.registeredFrom || config.filters.registeredTo) {
    appliedFilters.push({
      label: "Período de inscrição",
      value: `${config.filters.registeredFrom ? formatShortDate(config.filters.registeredFrom) : "início"} a ${config.filters.registeredTo ? formatShortDate(config.filters.registeredTo) : "hoje"}`,
    });
  }

  return {
    event: { id: eventResult.data.id, name: eventResult.data.name, publicCode: eventResult.data.public_code },
    churchName: context.church.name,
    issuedAt: new Date().toISOString(),
    orientation: "portrait",
    totalParticipants: participants.length,
    regionCount: new Set(participants.map((row) => row.regionId ?? "unassigned")).size,
    congregationCount: new Set(participants.map((row) => row.congregationId ?? "unassigned")).size,
    selectedColumnCount: 2 + Object.values(config.columns).filter(Boolean).length,
    activeFilterCount: appliedFilters.length,
    appliedFilters,
    participants,
    config,
  };
}

async function loadEventFinancialReportData(
  eventId: string,
  config: EventFinancialReportConfig,
): Promise<EventFinancialReportPreview> {
  const context = await requireAccessContext(PERMISSIONS.eventReportsExport);
  const supabase = await createClient();
  const eventResult = await supabase
    .from("events")
    .select("id,church_id,name,public_code")
    .eq("id", eventId)
    .eq("church_id", context.church.id)
    .is("deleted_at", null)
    .maybeSingle();
  if (eventResult.error || !eventResult.data) throw new EventReportError("Evento não encontrado ou indisponível para relatórios.");

  const [regionsResult, congregationsResult] = await Promise.all([
    supabase.from("regions").select("id,name").eq("church_id", context.church.id).eq("status", "ACTIVE").is("deleted_at", null).limit(1000),
    supabase.from("congregations").select("id,name,region_id").eq("church_id", context.church.id).eq("status", "ACTIVE").is("deleted_at", null).limit(2000),
  ]);
  if (regionsResult.error || congregationsResult.error) throw new EventReportError("Não foi possível carregar a estrutura do relatório.");
  const regions = ((regionsResult.data ?? []) as RecordValue[]).map((row) => ({ id: String(row.id), name: String(row.name) }));
  const congregations = ((congregationsResult.data ?? []) as RecordValue[]).map((row) => ({ id: String(row.id), name: String(row.name), regionId: textValue(row, "region_id") }));
  const selectedRegion = config.filters.regionId ? regions.find((region) => region.id === config.filters.regionId) : null;
  const selectedCongregation = config.filters.congregationId ? congregations.find((congregation) => congregation.id === config.filters.congregationId) : null;
  if (config.filters.regionId && !selectedRegion) throw new EventReportError("A regional selecionada não está disponível.");
  if (config.filters.congregationId && !selectedCongregation) throw new EventReportError("A congregação selecionada não está disponível.");
  if (selectedRegion && selectedCongregation && selectedCongregation.regionId !== selectedRegion.id) {
    throw new EventReportError("A congregação selecionada não pertence à regional informada.");
  }

  const congregationIdsForRegion = config.filters.regionId
    ? congregations.filter((congregation) => congregation.regionId === config.filters.regionId).map((congregation) => congregation.id)
    : [];
  const registrationConfig = { ...config, filters: { ...config.filters, paymentMethod: "", registeredFrom: "", registeredTo: "" } };
  let registrationRows = await loadFilteredRegistrations(supabase, eventId, context.church.id, registrationConfig, congregationIdsForRegion);
  const hasIndividualOnlyFilter=Boolean(config.filters.regionId||config.filters.congregationId||config.filters.roleId||config.filters.gender||config.filters.registrationStatus);
  let caravanRows=hasIndividualOnlyFilter?[]:await loadFinancialCaravans(supabase,eventId,context.church.id,config.filters.paymentStatus);
  const includeEntries = config.scope !== "EXPENSES_ONLY" || config.sections.showPaymentMethods || config.sections.showItems;
  const includeExpenses = config.scope !== "ENTRIES_ONLY" || config.sections.showExpenses;
  const allPayments = includeEntries ? await loadFinancialPayments(supabase, eventId, context.church.id, config.filters.paymentMethod, config.filters.registeredFrom, config.filters.registeredTo) : [];

  if (config.filters.paymentMethod || config.filters.registeredFrom || config.filters.registeredTo) {
    const paidRegistrationIds = new Set(allPayments.flatMap((payment) => payment.registrationId ? [payment.registrationId] : []));
    const paidGroupIds = new Set(allPayments.flatMap((payment) => payment.groupId ? [payment.groupId] : []));
    registrationRows = registrationRows.filter((registration) => (
      paidRegistrationIds.has(registration.id)
      || Boolean(registration.event_group_id && paidGroupIds.has(registration.event_group_id))
    ));
    caravanRows=caravanRows.filter((caravan)=>Boolean(caravan.groupId&&paidGroupIds.has(caravan.groupId)));
  }

  const registrationIds = new Set(registrationRows.map((registration) => registration.id));
  const groupIds = new Set(caravanRows.flatMap((caravan)=>caravan.groupId?[caravan.groupId]:[]));
  const belongsToSelection = (registrationId: string | null, groupId: string | null) => (
    Boolean(registrationId && registrationIds.has(registrationId))
    || Boolean(groupId && groupIds.has(groupId))
  );
  const payments = allPayments.filter((payment) => belongsToSelection(payment.registrationId, payment.groupId));
  const allItems = includeEntries ? await loadFinancialItems(supabase, eventId, context.church.id) : [];
  const items = allItems.filter((item) => (
    belongsToSelection(item.registrationId, item.groupId)
    && (!config.filters.itemId || item.itemId === config.filters.itemId)
  ));

  const registrations: EventFinancialRegistrationSource[] = [...registrationRows.map((registration) => ({
    id: registration.id,
    groupId: registration.event_group_id,
    paymentStatus: registration.payment_status,
    totalAmount: Number(registration.total_amount) || 0,
    paidAmount: Number(registration.paid_amount) || 0,
    remainingAmount: Number(registration.remaining_amount) || 0,
  })),...caravanRows];
  const expenses = includeExpenses ? await loadFinancialExpenses(supabase, eventId, context.church.id, {
    ...config.expenseFilters,
    from: config.filters.registeredFrom,
    to: config.filters.registeredTo,
  }) : [];
  const aggregation = aggregateEventFinancialReport({ config, registrations: includeEntries ? registrations : [], payments, items, expenses });

  const appliedFilters: { label: string; value: string }[] = [];
  if (includeEntries) {
    if (selectedRegion) appliedFilters.push({ label: "Regional", value: selectedRegion.name });
    if (selectedCongregation) appliedFilters.push({ label: "Congregação", value: selectedCongregation.name });
    if (config.filters.roleId) {
      const role = await createAdminClient().from("roles").select("name,female_name").eq("id", config.filters.roleId).eq("church_id", context.church.id).eq("status", "ACTIVE").is("deleted_at", null).maybeSingle();
      if (role.error || !role.data) throw new EventReportError("O cargo selecionado não está disponível.");
      appliedFilters.push({ label: "Cargo", value: config.filters.gender === "FEMALE" ? role.data.female_name || role.data.name : role.data.name });
    }
    if (config.filters.gender) appliedFilters.push({ label: "Sexo", value: config.filters.gender === "FEMALE" ? "Feminino" : "Masculino" });
    if (config.filters.registrationStatus) appliedFilters.push({ label: "Situação da inscrição", value: eventLabel(REGISTRATION_STATUSES, config.filters.registrationStatus) });
    if (config.filters.paymentMethod) appliedFilters.push({ label: "Forma de pagamento efetivada", value: paymentMethodLabels.get(config.filters.paymentMethod) ?? config.filters.paymentMethod });
    if (config.filters.paymentStatus) appliedFilters.push({ label: "Situação financeira", value: eventLabel(PAYMENT_STATUSES, config.filters.paymentStatus) });
    if (config.filters.itemId) {
      const item = await supabase.from("event_items").select("name").eq("id", config.filters.itemId).eq("event_id", eventId).eq("church_id", context.church.id).is("deleted_at", null).maybeSingle();
      if (item.error || !item.data) throw new EventReportError("O item selecionado não está disponível.");
      appliedFilters.push({ label: "Item", value: item.data.name });
    }
  }
  if (config.filters.registeredFrom || config.filters.registeredTo) {
    appliedFilters.push({
      label: "Período financeiro",
      value: `${config.filters.registeredFrom ? formatShortDate(config.filters.registeredFrom) : "início"} a ${config.filters.registeredTo ? formatShortDate(config.filters.registeredTo) : "hoje"}`,
    });
  }
  if (includeExpenses && config.expenseFilters.name) appliedFilters.push({ label: "Nome da despesa", value: config.expenseFilters.name });

  return {
    event: { id: eventResult.data.id, name: eventResult.data.name, publicCode: eventResult.data.public_code },
    churchName: context.church.name,
    issuedAt: new Date().toISOString(),
    orientation: "portrait",
    totalReceived: aggregation.totalReceived,
    totalExpenses: aggregation.totalExpenses,
    balance: aggregation.balance,
    expectedAmount: aggregation.expectedAmount,
    pendingAmount: aggregation.pendingAmount,
    paidRegistrationCount: aggregation.paidRegistrationCount,
    filteredRegistrationCount: includeEntries ? registrations.length : 0,
    paymentMethodCount: aggregation.paymentMethods.length,
    itemCount: aggregation.items.length,
    totalItemUnits: aggregation.totalItemUnits,
    selectedSectionCount: [config.sections.showSummary, config.sections.showPaymentMethods, config.sections.showItems, config.sections.showExpenses].filter(Boolean).length,
    activeFilterCount: appliedFilters.length,
    appliedFilters,
    paymentMethods: aggregation.paymentMethods,
    items: aggregation.items,
    expenses: aggregation.expenses,
    config,
  };
}

async function loadEventCaravanReportData(eventId:string,config:EventCaravanReportConfig):Promise<EventCaravanReportPreview>{
  const context=await requireAccessContext(PERMISSIONS.eventReportsExport);const supabase=await createClient();
  const eventResult=await supabase.from("events").select("id,church_id,name,public_code,registration_mode").eq("id",eventId).eq("church_id",context.church.id).is("deleted_at",null).maybeSingle();
  if(eventResult.error||!eventResult.data)throw new EventReportError("Evento não encontrado ou indisponível para relatórios.");
  if(eventResult.data.registration_mode!=="MIXED")throw new EventReportError("Este relatório está disponível apenas para eventos com caravanas.");
  const result=await createAdminClient().from("event_groups").select("id,origin_city,origin_state,origin_church_name,pastor_name,responsible_name,total_registrations,source,payment_status,created_at").eq("event_id",eventId).eq("church_id",context.church.id).eq("status","CONFIRMED").is("deleted_at",null).limit(5000);
  if(result.error)throw new EventReportError("Não foi possível carregar as caravanas do relatório.");
  const sources:EventCaravanReportSource[]=(result.data??[]).map((row)=>({id:String(row.id),city:String(row.origin_city),state:String(row.origin_state),originChurch:String(row.origin_church_name),pastorName:String(row.pastor_name),responsibleName:String(row.responsible_name),totalRegistrations:Number(row.total_registrations)||0,source:row.source==="PUBLIC"?"PUBLIC":"INTERNAL",paymentStatus:String(row.payment_status),registeredAt:String(row.created_at)}));
  const caravans=organizeEventCaravans(sources,config);const appliedFilters:{label:string;value:string}[]=[];
  if(config.filters.city)appliedFilters.push({label:"Cidade",value:config.filters.city});
  if(config.filters.state)appliedFilters.push({label:"UF",value:config.filters.state});
  if(config.filters.source)appliedFilters.push({label:"Origem",value:config.filters.source==="PUBLIC"?"Pública":"Interna"});
  if(config.filters.paymentStatus)appliedFilters.push({label:"Situação financeira",value:eventLabel(PAYMENT_STATUSES,config.filters.paymentStatus)});
  if(config.filters.registeredFrom||config.filters.registeredTo)appliedFilters.push({label:"Período de cadastro",value:`${config.filters.registeredFrom?formatShortDate(config.filters.registeredFrom):"início"} a ${config.filters.registeredTo?formatShortDate(config.filters.registeredTo):"hoje"}`});
  return{event:{id:eventResult.data.id,name:eventResult.data.name,publicCode:eventResult.data.public_code},churchName:context.church.name,issuedAt:new Date().toISOString(),orientation:"portrait",totalCaravans:caravans.length,totalRegistrations:caravans.reduce((sum,row)=>sum+row.totalRegistrations,0),cityCount:new Set(caravans.map((row)=>row.cityAndState)).size,selectedColumnCount:3+Object.values(config.columns).filter(Boolean).length,activeFilterCount:appliedFilters.length,appliedFilters,caravans,config};
}

export async function getEventGeneralReportPreview(eventId: string, config: EventGeneralReportConfig) {
  return loadEventGeneralReportData(eventId, config);
}

export async function getEventParticipantReportPreview(eventId: string, config: EventParticipantReportConfig) {
  return loadEventParticipantReportData(eventId, config);
}

export async function getEventFinancialReportPreview(eventId: string, config: EventFinancialReportConfig) {
  return loadEventFinancialReportData(eventId, config);
}

export async function getEventCaravanReportPreview(eventId:string,config:EventCaravanReportConfig){return loadEventCaravanReportData(eventId,config);}

export async function generateEventGeneralReport(eventId: string, config: EventGeneralReportConfig) {
  const report = await loadEventGeneralReportData(eventId, config);
  const hasStructuralZeroRows = config.sections.includeZeroCongregations && (
    (config.sections.showRegions && report.regionCount > 0)
    || (config.sections.showCongregations && report.congregationCount > 0)
  );
  if (report.totalRegistrations === 0 && !hasStructuralZeroRows) {
    throw new EventReportError("Nenhuma inscrição atende aos filtros. Para emitir um relatório zerado, habilite regionais ou congregações e mantenha a opção de congregações sem inscrições marcada.");
  }
  const body = await createEventGeneralReportPdf(report);
  const supabase = await createClient();
  await supabase.rpc("log_audit", {
    p_church_id: (await requireAccessContext(PERMISSIONS.eventReportsExport)).church.id,
    p_module: "EVENTS",
    p_action: "EXPORT_REPORT",
    p_entity_type: "EVENT",
    p_entity_id: eventId,
    p_entity_label: report.event.name,
    p_description: "Relatório geral de inscrições exportado em PDF",
    p_old_values: null,
    p_new_values: null,
    p_metadata: {
      report: "general_registrations",
      format: "pdf",
      total_registrations: report.totalRegistrations,
      active_filters: report.activeFilterCount,
      organization: config.organization,
    },
    p_severity: "INFO",
  });
  return {
    body,
    contentType: "application/pdf",
    fileName: `${safeSlug(report.event.name)}-relatorio-geral-inscricoes.pdf`,
  };
}

export async function generateEventParticipantReport(eventId: string, config: EventParticipantReportConfig) {
  const report = await loadEventParticipantReportData(eventId, config);
  if (report.totalParticipants === 0) {
    throw new EventReportError("Nenhum participante atende aos filtros selecionados.");
  }
  const body = await createEventParticipantReportPdf(report);
  const context = await requireAccessContext(PERMISSIONS.eventReportsExport);
  const supabase = await createClient();
  await supabase.rpc("log_audit", {
    p_church_id: context.church.id,
    p_module: "EVENTS",
    p_action: "EXPORT_REPORT",
    p_entity_type: "EVENT",
    p_entity_id: eventId,
    p_entity_label: report.event.name,
    p_description: "Relatório de participantes exportado em PDF",
    p_old_values: null,
    p_new_values: null,
    p_metadata: {
      report: "event_participants",
      format: "pdf",
      total_participants: report.totalParticipants,
      active_filters: report.activeFilterCount,
      selected_columns: report.selectedColumnCount,
      organization: config.organization,
    },
    p_severity: "INFO",
  });
  return {
    body,
    contentType: "application/pdf",
    fileName: `${safeSlug(report.event.name)}-relatorio-participantes.pdf`,
  };
}

export async function generateEventFinancialReport(eventId: string, config: EventFinancialReportConfig) {
  const report = await loadEventFinancialReportData(eventId, config);
  const includesEntries = config.scope !== "EXPENSES_ONLY" || config.sections.showPaymentMethods || config.sections.showItems;
  const includesExpenses = config.scope !== "ENTRIES_ONLY" || config.sections.showExpenses;
  const hasData = (
    config.sections.showSummary && ((includesEntries && (report.filteredRegistrationCount > 0 || report.totalReceived > 0)) || (includesExpenses && report.totalExpenses > 0))
  ) || (config.sections.showPaymentMethods && report.paymentMethodCount > 0)
    || (config.sections.showItems && report.itemCount > 0)
    || (config.sections.showExpenses && report.expenses.length > 0);
  if (!hasData) throw new EventReportError("Nenhum dado financeiro atende aos filtros selecionados.");
  const body = await createEventFinancialReportPdf(report);
  const context = await requireAccessContext(PERMISSIONS.eventReportsExport);
  const supabase = await createClient();
  await supabase.rpc("log_audit", {
    p_church_id: context.church.id,
    p_module: "EVENTS",
    p_action: "EXPORT_REPORT",
    p_entity_type: "EVENT",
    p_entity_id: eventId,
    p_entity_label: report.event.name,
    p_description: "Relatório financeiro do evento exportado em PDF",
    p_old_values: null,
    p_new_values: null,
    p_metadata: {
      report: "event_financial",
      format: "pdf",
      total_received: report.totalReceived,
      total_expenses: report.totalExpenses,
      balance: report.balance,
      active_filters: report.activeFilterCount,
      selected_sections: report.selectedSectionCount,
      organization: config.organization,
    },
    p_severity: "INFO",
  });
  return {
    body,
    contentType: "application/pdf",
    fileName: `${safeSlug(report.event.name)}-relatorio-financeiro.pdf`,
  };
}

export async function generateEventCaravanReport(eventId:string,config:EventCaravanReportConfig){
  const report=await loadEventCaravanReportData(eventId,config);if(!report.totalCaravans)throw new EventReportError("Nenhuma caravana atende aos filtros selecionados.");
  const body=await createEventCaravanReportPdf(report);const context=await requireAccessContext(PERMISSIONS.eventReportsExport);const supabase=await createClient();
  await supabase.rpc("log_audit",{p_church_id:context.church.id,p_module:"EVENTS",p_action:"EXPORT_REPORT",p_entity_type:"EVENT",p_entity_id:eventId,p_entity_label:report.event.name,p_description:"Relatório de caravanas exportado em PDF",p_old_values:null,p_new_values:null,p_metadata:{report:"event_caravans",format:"pdf",total_caravans:report.totalCaravans,total_registrations:report.totalRegistrations,active_filters:report.activeFilterCount,organization:config.organization},p_severity:"INFO"});
  return{body,contentType:"application/pdf",fileName:`${safeSlug(report.event.name)}-relatorio-caravanas.pdf`};
}

export function isEventReportType(value: string): value is ReportType {
  return ["participants", "financial", "checkins", "executive"].includes(value);
}
