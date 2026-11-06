import "server-only";

import { createClient } from "@/lib/supabase/server";
import { PERMISSIONS, hasPermission } from "@/modules/auth/constants/permissions";
import { loadChurchLogoDataUri } from "@/modules/auth/services/church-logo.service";
import type { AuthContext } from "@/modules/auth/types/auth.types";
import { formatBrazilPhone, formatCnpj } from "@/utils/input-masks";
import { CongregationReportError, type CongregationReportDocument, type CongregationReportOptions, type ReportCongregation } from "../types/congregation-report.types";
import { createCongregationReportPdf } from "./congregation-report-pdf.service";
import { createCongregationReportWorkbook } from "./congregation-report-workbook.service";

const PAGE_SIZE = 500;
const LIMIT = 10_000;
type Row = Record<string, unknown> & { id: string };
const value = (row: Record<string, unknown>, key: string) => typeof row[key] === "string" ? row[key].trim() : "";
const text = (input: string) => input || "Não informado";
const normalize = (input: string) => input.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("pt-BR");
function regionName(row: Row, churchId: string) {
  const region = row.regions as { name?: string; church_id?: string; deleted_at?: string | null } | null;
  return region?.church_id === churchId && region.deleted_at === null ? region.name?.trim() || "Regional não informada" : row.region_id ? "Regional indisponível" : "Sem regional";
}
async function allRows(load: (start: number, end: number) => PromiseLike<{ data: unknown; count: number | null; error: unknown }>): Promise<Row[]> {
  const rows: Row[] = [];
  let total: number | undefined;
  do {
    const result = await load(rows.length, rows.length + PAGE_SIZE - 1);
    if (result.error || !Array.isArray(result.data) || result.count === null) throw new CongregationReportError("CONGREGATION_REPORT_LOAD_FAILED");
    if (result.count > LIMIT) throw new CongregationReportError("CONGREGATION_REPORT_TOO_LARGE");
    total ??= result.count;
    if (result.count !== total || (rows.length < total && !result.data.length)) throw new CongregationReportError("CONGREGATION_REPORT_LOAD_FAILED");
    rows.push(...result.data as Row[]);
    if (rows.length > total || new Set(rows.map((row) => row.id)).size !== rows.length) throw new CongregationReportError("CONGREGATION_REPORT_LOAD_FAILED");
  } while (rows.length < total);
  return rows;
}

export async function loadCongregationReportDocument(context: AuthContext, options: CongregationReportOptions): Promise<CongregationReportDocument> {
  if (![PERMISSIONS.organizationView, PERMISSIONS.congregationsReportsExport].every((p) => hasPermission(context.permissions, p))) throw new CongregationReportError("CONGREGATION_REPORT_PERMISSION_DENIED");
  const { scope, regionId, congregationId } = context.access;
  if (scope !== "CHURCH" && !(scope === "REGION" && regionId) && !(scope === "CONGREGATION" && congregationId)) throw new CongregationReportError("CONGREGATION_REPORT_PERMISSION_DENIED");
  const individual = options.kind === "individual";
  const fields = individual ? { spouse: true, phone: true, address: true } : options.fields;
  try {
    const client = await createClient();
    const churchId = context.church.id;
    const columns = ["id, region_id, name, code, pastor_name, city, is_headquarters, status, display_order, created_at, regions(name, church_id, deleted_at)",
      ...(fields.spouse ? ["pastor_spouse_name"] : []), ...(fields.phone ? [individual ? "whatsapp" : "whatsapp, phone"] : []),
      ...(fields.address ? ["address, number, complement, district, state, zip_code"] : []), ...(individual ? ["notes"] : [])].join(", ");
    const rows = await allRows((start, end) => {
      let query = client.from("congregations").select(columns, { count: "exact" }).eq("church_id", churchId).is("deleted_at", null);
      if (scope === "REGION") query = query.eq("region_id", regionId!);
      if (scope === "CONGREGATION") query = query.eq("id", congregationId!);
      if (individual) query = query.eq("id", options.congregationId);
      else {
        if (options.status !== "ALL") query = query.eq("status", options.status);
        if (options.region === "NONE") query = query.is("region_id", null);
        else if (options.region !== "ALL") query = query.eq("region_id", options.region);
        if (options.congregationType !== "ALL") query = query.eq("is_headquarters", options.congregationType === "HEADQUARTERS");
      }
      return query.order("display_order").order("name").order("id").range(start, end);
    });
    if (individual && rows.length !== 1) throw new CongregationReportError("CONGREGATION_REPORT_NOT_FOUND");
    let selected = rows;
    if (!individual) {
      const needle = normalize(options.search);
      selected = rows.filter((r) => !needle || normalize(`${value(r, "name")} ${value(r, "code")} ${value(r, "pastor_name")} ${value(r, "city")} ${regionName(r, churchId)}`).includes(needle));
      selected.sort((a, b) => {
        const name = value(a, "name").localeCompare(value(b, "name"), "pt-BR") || a.id.localeCompare(b.id);
        if (options.sort === "NAME") return name;
        if (options.sort === "REGION") return (a.region_id ? regionName(a, churchId) : "zzz").localeCompare(b.region_id ? regionName(b, churchId) : "zzz", "pt-BR") || name;
        if (options.sort === "CREATED") return value(b, "created_at").localeCompare(value(a, "created_at")) || name;
        return Number(a.display_order ?? 0) - Number(b.display_order ?? 0) || name;
      });
    }
    const [churchResult, settingsResult] = await Promise.all([
      client.from("churches").select("name, logo_url, address, number, district, city, state, phone, document, senior_pastor_name, senior_pastor_spouse_name").eq("id", churchId).is("deleted_at", null).maybeSingle(),
      client.from("app_settings").select("display_church_name, logo_url").eq("church_id", churchId).is("deleted_at", null).maybeSingle(),
    ]);
    if (churchResult.error || !churchResult.data || settingsResult.error) throw new CongregationReportError("CONGREGATION_REPORT_LOAD_FAILED");
    const church = churchResult.data, settings = settingsResult.data;
    const congregations = selected.map((row): ReportCongregation => {
      const item: ReportCongregation = { id: row.id, name: value(row, "name"), regionName: regionName(row, churchId), pastorName: text(value(row, "pastor_name")) };
      if (fields.spouse) item.spouseName = text(value(row, "pastor_spouse_name"));
      if (fields.phone && !individual) item.contactPhone = text(formatBrazilPhone(value(row, "whatsapp") || value(row, "phone")));
      if (fields.address) {
        const street = [value(row, "address"), value(row, "number")].filter(Boolean).join(", ");
        const zipCode = value(row, "zip_code").replace(/^(\d{5})(\d{3})$/, "$1-$2");
        const cityState = [value(row, "city"), value(row, "state")].filter(Boolean).join(" / ");
        item.address = { street, complement: value(row, "complement"), district: value(row, "district"), city: value(row, "city"), state: value(row, "state"), zipCode,
          full: [street, value(row, "complement"), value(row, "district"), cityState, zipCode && `CEP ${zipCode}`].filter(Boolean).join(" · ") || "Não informado" };
      }
      if (individual) { item.whatsapp = text(formatBrazilPhone(value(row, "whatsapp"))); item.notes = value(row, "notes"); }
      return item;
    });
    const filters: string[] = [];
    if (!individual) {
      if (options.status !== "ALL") filters.push(options.status === "ACTIVE" ? "Somente ativas" : "Somente inativas");
      if (options.region !== "ALL") filters.push(options.region === "NONE" ? "Sem regional" : `Regional: ${rows[0] ? regionName(rows[0], churchId) : "selecionada"}`);
      if (options.congregationType !== "ALL") filters.push(options.congregationType === "HEADQUARTERS" ? "Somente sede" : "Somente congregações");
      if (options.search) filters.push(`Busca: ${options.search}`);
    }
    return { kind: options.kind, issuedAt: new Date().toISOString(), fields, filters, congregations,
      scopeLabel: scope === "CHURCH" ? "" : "Visão restrita: somente registros autorizados para o seu acesso.",
      church: { name: settings?.display_church_name?.trim() || church.name || context.church.name,
        pastorNames: [church.senior_pastor_name, church.senior_pastor_spouse_name].map((name) => name?.trim() || "").filter(Boolean),
        logoDataUri: await loadChurchLogoDataUri(settings?.logo_url || church.logo_url || context.church.logoUrl, churchId, client),
        address: [church.address, church.number, church.district, church.city, church.state].filter(Boolean).join(", "), phone: formatBrazilPhone(church.phone ?? ""), document: formatCnpj(church.document ?? "") },
    };
  } catch (error) {
    if (error instanceof CongregationReportError) throw error;
    throw new CongregationReportError("CONGREGATION_REPORT_LOAD_FAILED");
  }
}

export async function generateCongregationReportDownload(context: AuthContext, options: CongregationReportOptions) {
  const document = await loadCongregationReportDocument(context, options);
  const body = options.format === "pdf" ? await createCongregationReportPdf(document) : await createCongregationReportWorkbook(document);
  try {
    const client = await createClient();
    const { error } = await client.rpc("log_audit", { p_church_id: context.church.id, p_module: "organization", p_action: "EXPORT_CONGREGATION_REPORT", p_entity_type: "congregation",
      p_entity_id: options.kind === "individual" ? options.congregationId : undefined, p_description: "Emissão de relatório de congregações.",
      p_metadata: { kind: options.kind, format: options.format, count: document.congregations.length, scope: context.access.scope, fields: document.fields,
        filtered: options.kind === "simplified" && (Boolean(options.search) || options.status !== "ALL" || options.region !== "ALL" || options.congregationType !== "ALL") }, p_severity: "INFO" });
    if (error) throw error;
  } catch { throw new CongregationReportError("CONGREGATION_REPORT_AUDIT_FAILED"); }
  return { body, contentType: options.format === "pdf" ? "application/pdf" : "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    fileName: `${options.kind === "individual" ? `ficha-congregacao-${options.congregationId}` : "lista-congregacoes"}.${options.format}` };
}
