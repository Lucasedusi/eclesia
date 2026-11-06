import "server-only";

import { createClient } from "@/lib/supabase/server";
import { PERMISSIONS, hasPermission } from "@/modules/auth/constants/permissions";
import { loadChurchLogoDataUri } from "@/modules/auth/services/church-logo.service";
import type { AuthContext } from "@/modules/auth/types/auth.types";
import { formatBrazilPhone, formatCnpj } from "@/utils/input-masks";
import { RegionReportError, type RegionReportDocument, type RegionReportOptions, type ReportRegion } from "../types/region-report.types";
import { createRegionReportPdf } from "./region-report-pdf.service";
import { createRegionReportWorkbook } from "./region-report-workbook.service";

const REGION_SELECT = "id, name, coordinator_name, coordinator_phone, description, status, display_order, created_at";
const CONGREGATION_SELECT = "id, name, pastor_name, whatsapp, phone, status";
const PAGE_SIZE = 500;
const LIMIT = 10_000;
type Client = Awaited<ReturnType<typeof createClient>>;
type Row = Record<string, unknown> & { id: string };
const value = (row: Record<string, unknown>, key: string) => typeof row[key] === "string" ? row[key].trim() : "";
const text = (input: string) => input || "Não informado";
const normalize = (input: string) => input.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("pt-BR");
const statusLabel = (status: string) => status === "ACTIVE" ? "Somente ativas" : status === "INACTIVE" ? "Somente inativas" : "Ativas e inativas";

async function allRows(load: (start: number, end: number) => PromiseLike<{ data: unknown; count: number | null; error: unknown }>): Promise<Row[]> {
  const rows: Row[] = [];
  let total: number | undefined;
  do {
    const result = await load(rows.length, rows.length + PAGE_SIZE - 1);
    if (result.error || !Array.isArray(result.data) || result.count === null) throw new RegionReportError("REGION_REPORT_LOAD_FAILED");
    if (result.count > LIMIT) throw new RegionReportError("REGION_REPORT_TOO_LARGE");
    total ??= result.count;
    if (result.count !== total || (rows.length < total && !result.data.length)) throw new RegionReportError("REGION_REPORT_LOAD_FAILED");
    rows.push(...result.data as Row[]);
    if (rows.length > total || new Set(rows.map((row) => row.id)).size !== rows.length) throw new RegionReportError("REGION_REPORT_LOAD_FAILED");
  } while (rows.length < total);
  return rows;
}

function mapRegion(row: Row): ReportRegion {
  return { id: row.id, name: value(row, "name"), coordinatorName: text(value(row, "coordinator_name")), coordinatorPhone: text(formatBrazilPhone(value(row, "coordinator_phone"))), description: value(row, "description") || null, status: value(row, "status") };
}

async function scopeRegion(client: Client, context: AuthContext): Promise<string | null> {
  const { scope, regionId, congregationId } = context.access;
  if (scope === "CHURCH") return null;
  if (scope === "REGION" && regionId) return regionId;
  if (scope === "CONGREGATION" && congregationId) {
    const result = await client.from("congregations").select("region_id")
      .eq("church_id", context.church.id).eq("id", congregationId).is("deleted_at", null).maybeSingle();
    if (result.error) throw new RegionReportError("REGION_REPORT_LOAD_FAILED");
    if (!result.data?.region_id) throw new RegionReportError("REGION_REPORT_NOT_FOUND");
    return result.data.region_id;
  }
  throw new RegionReportError("REGION_REPORT_PERMISSION_DENIED");
}

export async function loadRegionReportDocument(context: AuthContext, options: RegionReportOptions): Promise<RegionReportDocument> {
  if (![PERMISSIONS.organizationView, PERMISSIONS.regionsReportsExport].every((p) => hasPermission(context.permissions, p))) {
    throw new RegionReportError("REGION_REPORT_PERMISSION_DENIED");
  }
  try {
    const client = await createClient();
    const churchId = context.church.id;
    const scopedRegionId = await scopeRegion(client, context);
    if (options.kind === "individual" && scopedRegionId && options.regionId !== scopedRegionId) throw new RegionReportError("REGION_REPORT_NOT_FOUND");
    const regionRows = await allRows((start, end) => {
      let query = client.from("regions").select(REGION_SELECT, { count: "exact" })
        .eq("church_id", churchId).is("deleted_at", null);
      if (scopedRegionId) query = query.eq("id", scopedRegionId);
      if (options.kind === "individual") query = query.eq("id", options.regionId);
      else if (options.status !== "ALL") query = query.eq("status", options.status);
      return query.order("display_order").order("name").order("id").range(start, end);
    });
    if (options.kind === "individual" && regionRows.length !== 1) throw new RegionReportError("REGION_REPORT_NOT_FOUND");
    let filtered = regionRows;
    if (options.kind === "simplified") {
      const needle = normalize(options.search);
      filtered = regionRows.filter((row) => !needle || normalize(`${value(row, "name")} ${value(row, "coordinator_name")} ${value(row, "description")}`).includes(needle));
      filtered.sort((a, b) => {
        const name = value(a, "name").localeCompare(value(b, "name"), "pt-BR") || a.id.localeCompare(b.id);
        return options.sort === "NAME" ? name : options.sort === "CREATED" ? value(b, "created_at").localeCompare(value(a, "created_at")) || name : Number(a.display_order) - Number(b.display_order) || name;
      });
    }
    const [churchResult, settingsResult, congregations] = await Promise.all([
      client.from("churches").select("name, logo_url, address, number, district, city, state, phone, document, senior_pastor_name, senior_pastor_spouse_name").eq("id", churchId).is("deleted_at", null).maybeSingle(),
      client.from("app_settings").select("display_church_name, logo_url").eq("church_id", churchId).is("deleted_at", null).maybeSingle(),
      options.kind === "individual" ? allRows((start, end) => {
        let query = client.from("congregations").select(CONGREGATION_SELECT, { count: "exact" })
          .eq("church_id", churchId).eq("region_id", options.regionId).is("deleted_at", null);
        if (context.access.scope === "CONGREGATION") query = query.eq("id", context.access.congregationId!);
        if (options.congregationStatus !== "ALL") query = query.eq("status", options.congregationStatus);
        return query.order("display_order").order("name").order("id").range(start, end);
      }) : [],
    ]);
    if (churchResult.error || !churchResult.data || settingsResult.error) throw new RegionReportError("REGION_REPORT_LOAD_FAILED");
    const church = churchResult.data;
    const settings = settingsResult.data;
    return {
      kind: options.kind, issuedAt: new Date().toISOString(),
      church: {
        name: settings?.display_church_name?.trim() || church.name || context.church.name,
        pastorNames: [church.senior_pastor_name, church.senior_pastor_spouse_name].map((name) => name?.trim() || "").filter(Boolean),
        logoDataUri: await loadChurchLogoDataUri(settings?.logo_url || church.logo_url || context.church.logoUrl, churchId, client),
        address: [church.address, church.number, church.district, church.city, church.state].filter(Boolean).join(", "),
        phone: formatBrazilPhone(church.phone ?? ""), document: formatCnpj(church.document ?? ""),
      },
      scopeLabel: context.access.scope === "CHURCH" ? "" : "Visão restrita: somente registros autorizados para o seu acesso.",
      filters: options.kind === "simplified"
        ? [statusLabel(options.status), ...(options.search ? [`Busca: ${options.search}`] : [])]
        : [`Congregações: ${statusLabel(options.congregationStatus).toLocaleLowerCase("pt-BR")}`],
      regions: filtered.map(mapRegion), region: options.kind === "individual" ? mapRegion(regionRows[0]) : null,
      congregations: congregations.map((row) => ({ id: row.id, name: value(row, "name"), pastorName: text(value(row, "pastor_name")), contactPhone: text(formatBrazilPhone(value(row, "whatsapp") || value(row, "phone"))), status: value(row, "status") })),
    };
  } catch (error) {
    if (error instanceof RegionReportError) throw error;
    throw new RegionReportError("REGION_REPORT_LOAD_FAILED");
  }
}

export async function generateRegionReportDownload(context: AuthContext, options: RegionReportOptions) {
  const document = await loadRegionReportDocument(context, options);
  const body = options.format === "pdf" ? await createRegionReportPdf(document) : await createRegionReportWorkbook(document);
  try {
    const client = await createClient();
    const { error } = await client.rpc("log_audit", {
      p_church_id: context.church.id, p_module: "organization", p_action: "EXPORT_REGION_REPORT",
      p_entity_type: "region", p_entity_id: options.kind === "individual" ? options.regionId : undefined,
      p_description: "Emissão de relatório de regionais.",
      p_metadata: { kind: options.kind, format: options.format, region_count: document.regions.length, congregation_count: document.congregations.length, scope: context.access.scope, status: options.kind === "simplified" ? options.status : options.congregationStatus, filtered: options.kind === "simplified" && Boolean(options.search) },
      p_severity: "INFO",
    });
    if (error) throw error;
  } catch { throw new RegionReportError("REGION_REPORT_AUDIT_FAILED"); }
  return {
    body,
    contentType: options.format === "pdf" ? "application/pdf" : "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    fileName: `${options.kind === "individual" ? `ficha-regional-${options.regionId}` : "lista-regionais"}.${options.format}`,
  };
}
