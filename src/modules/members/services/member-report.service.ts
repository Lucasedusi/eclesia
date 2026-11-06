import "server-only";

import { createClient } from "@/lib/supabase/server";
import { PERMISSIONS, hasPermission } from "@/modules/auth/constants/permissions";
import { loadChurchLogoDataUri } from "@/modules/auth/services/church-logo.service";
import type { AuthContext } from "@/modules/auth/types/auth.types";
import { formatBrazilPhone, formatBrazilZipCode, formatCnpj, formatCpf } from "@/utils/input-masks";
import { canUseMemberReportField, getMemberReportColumns, type MemberReportFieldKey } from "../constants/member-report-fields";
import { MemberReportError, type MemberReportDocument, type MemberReportOptions } from "../types/member-report.types";
import { formatDateOnly, formatGender, formatMaritalStatus, memberStatusLabels, memberTypeLabels, receivedByLabels } from "../utils/member-formatters";
import { createMemberReportPdf } from "./member-report-pdf.service";
import { createMemberReportWorkbook } from "./member-report-workbook.service";

const PAGE_SIZE = 500, LIMIT = 10_000;
type Row = Record<string, unknown>;
const value = (row: Row, key: string) => typeof row[key] === "string" ? row[key].trim() : "";
const first = (input: unknown): Row => (Array.isArray(input) ? input[0] : input) as Row ?? {};
const cleanSearch = (text: string) => text.trim().replace(/[(),.*%]/g, "").replace(/\s+/g, " ");
const lower = (text: string) => text.toLocaleLowerCase("pt-BR");
const addressKeys = ["address", "number", "complement", "district", "city", "state", "zip_code", "country"];
const computed = new Set(["congregation", "region", "role", "role_start_date", "cpf", "rg", "issuing_agency", "full_address", "natural_origin"]);

async function allRows(load: (start: number, end: number) => PromiseLike<{ data: unknown; count: number | null; error: unknown }>) {
  const rows: Row[] = [], ids = new Set<string>();
  let total: number | undefined;
  do {
    const result = await load(rows.length, rows.length + PAGE_SIZE - 1);
    if (result.error || !Array.isArray(result.data) || result.count === null) throw new MemberReportError("MEMBER_REPORT_LOAD_FAILED");
    if (result.count > LIMIT) throw new MemberReportError("MEMBER_REPORT_TOO_LARGE");
    total ??= result.count;
    if (result.count !== total || (rows.length < total && !result.data.length)) throw new MemberReportError("MEMBER_REPORT_LOAD_FAILED");
    for (const row of result.data as Row[]) {
      const id = value(row, "id");
      if (!id || ids.has(id)) throw new MemberReportError("MEMBER_REPORT_LOAD_FAILED");
      ids.add(id); rows.push(row);
    }
    if (rows.length > total) throw new MemberReportError("MEMBER_REPORT_LOAD_FAILED");
  } while (rows.length < total);
  return rows;
}

export async function loadMemberReportDocument(context: AuthContext, options: MemberReportOptions): Promise<MemberReportDocument> {
  const permitted = (p: string) => hasPermission(context.permissions, p);
  const deny = () => { throw new MemberReportError("MEMBER_REPORT_PERMISSION_DENIED"); };
  if (![PERMISSIONS.membersExport, PERMISSIONS.membersViewBasic, PERMISSIONS.membersViewFull].every(permitted)) deny();
  const { scope, regionId, congregationId, ministryId } = context.access;
  const access = { viewRoles: permitted(PERMISSIONS.memberRolesView), viewSensitiveIdentity: permitted(PERMISSIONS.membersViewSensitiveIdentity) };
  const filters = options.filters;
  if (filters.archived && !permitted(PERMISSIONS.membersRestore)) deny();
  if (filters.roleId && !access.viewRoles) deny();
  if (scope !== "CHURCH" && !(scope === "REGION" && regionId) && !(scope === "CONGREGATION" && congregationId) && !(scope === "MINISTRY" && ministryId && permitted(PERMISSIONS.ministriesView))) deny();
  const columns = getMemberReportColumns(options, access);
  if (options.kind === "custom" && columns.some((field) => !canUseMemberReportField(field, access))) deny();
  const keys = new Set<MemberReportFieldKey>(columns.map((f) => f.key));
  const search = cleanSearch(filters.search);
  const digits = search.replace(/\D/g, "");
  const searchCpf = search.length >= 3 && digits.length >= 3 && access.viewSensitiveIdentity;
  const identityKeys = ["cpf", "rg", "issuing_agency"].filter((key) => keys.has(key as MemberReportFieldKey));
  if (searchCpf && !identityKeys.includes("cpf")) identityKeys.push("cpf");
  const withRoles = access.viewRoles && (keys.has("role") || keys.has("role_start_date") || Boolean(filters.roleId));
  const fields = new Set(["id", "church_id", "congregation_id", "deleted_at", "member_code", "full_name"]);
  for (const key of keys) if (!computed.has(key)) fields.add(key);
  if (keys.has("full_address")) addressKeys.forEach((key) => fields.add(key));
  if (keys.has("natural_origin")) { fields.add("natural_city"); fields.add("natural_state"); }
  if (withRoles || keys.has("marital_status")) fields.add("gender");
  // A ministry member may be readable while their congregation is hidden by RLS.
  // Only regional constraints require the congregation to filter the parent row.
  const constrainRegion = scope === "REGION" || Boolean(filters.regionId);
  if (constrainRegion && !permitted(PERMISSIONS.organizationView)) deny();
  const projection = [...fields,
    `congregations${constrainRegion ? "!inner" : ""}(id,church_id,name,region_id,deleted_at${keys.has("region") ? ",regions(name,church_id,deleted_at)" : ""})`,
    ...(withRoles ? [`active_roles:member_roles!member_roles_member_id_fkey(id,church_id,role_id,status,deleted_at,start_date,title_variant,roles!member_roles_role_id_fkey(name,female_name,church_id,deleted_at))`] : []),
    ...(filters.roleId ? ["role_filter:member_roles!member_roles_member_id_fkey!inner(role_id)"] : []),
    ...(identityKeys.length ? [`identity:member_sensitive_identity!member_sensitive_identity_member_id_fkey(church_id,member_id,deleted_at,${identityKeys.join(",")})`] : []),
    ...(scope === "MINISTRY" ? ["ministry_scope:member_ministries!member_ministries_member_id_fkey!inner(member_id)"] : []),
  ].join(",");
  try {
    const client = await createClient(), churchId = context.church.id;
    const rows = await allRows((start, end) => {
      let query = client.from("members").select(projection, { count: "exact" }).eq("church_id", churchId)
        .eq("congregations.church_id", churchId).is("congregations.deleted_at", null);
      query = filters.archived ? query.not("deleted_at", "is", null) : query.is("deleted_at", null);
      if (scope === "REGION") query = query.eq("congregations.region_id", regionId!);
      if (scope === "CONGREGATION") query = query.eq("congregation_id", congregationId!);
      if (scope === "MINISTRY") query = query.eq("ministry_scope.church_id", churchId).eq("ministry_scope.ministry_id", ministryId!).eq("ministry_scope.status", "ACTIVE").is("ministry_scope.deleted_at", null);
      if (filters.congregationId) query = query.eq("congregation_id", filters.congregationId);
      if (filters.regionId) query = query.eq("congregations.region_id", filters.regionId);
      if (filters.status) query = query.eq("member_status", filters.status);
      if (filters.memberType) query = query.eq("member_type", filters.memberType);
      if (filters.importBatchId) query = query.eq("source_import_batch_id", filters.importBatchId);
      if (filters.roleId) query = query.eq("role_filter.church_id", churchId).eq("role_filter.role_id", filters.roleId).eq("role_filter.status", "ACTIVE").is("role_filter.deleted_at", null);
      if (withRoles) query = query.eq("active_roles.church_id", churchId).eq("active_roles.status", "ACTIVE").is("active_roles.deleted_at", null);
      if (identityKeys.length) query = query.eq("identity.church_id", churchId).is("identity.deleted_at", null);
      const sort = filters.sort;
      query = sort === "recent" || sort === "oldest" ? query.order("created_at", { ascending: sort === "oldest" }) : sort === "code" ? query.order("member_code") : query.order("full_name", { ascending: sort !== "name_desc" });
      return query.order("id").range(start, end);
    });
    function identityOf(row: Row) {
      const identity = first(row.identity);
      return identity.church_id === churchId && identity.member_id === row.id && identity.deleted_at === null ? identity : {};
    }
    const selected = search.length < 3 ? rows : rows.filter((row) => lower(value(row, "full_name")).includes(lower(search)) || lower(value(row, "member_code")).includes(lower(search)) || (searchCpf && value(identityOf(row), "cpf").replace(/\D/g, "").includes(digits)));
    const reportRows = selected.map((row) => {
      const congregation = first(row.congregations), region = first(congregation.regions), identity = identityOf(row);
      const roles = (Array.isArray(row.active_roles) ? row.active_roles as Row[] : []).filter((link) => {
        const role = first(link.roles);
        return link.church_id === churchId && link.status === "ACTIVE" && link.deleted_at === null && role.church_id === churchId && role.deleted_at === null;
      }).sort((a, b) => value(b, "start_date").localeCompare(value(a, "start_date")) || value(a, "id").localeCompare(value(b, "id")));
      const link = roles[0] ?? {}, role = first(link.roles);
      const female = link.title_variant === "FEMALE" || (link.title_variant === "AUTO" && row.gender === "FEMALE");
      function format(key: MemberReportFieldKey) {
        if (key === "congregation") return congregation.church_id === churchId && congregation.deleted_at === null ? value(congregation, "name") : "Informação indisponível";
        if (key === "region") return region.church_id === churchId && region.deleted_at === null ? value(region, "name") : "";
        if (key === "role") return !access.viewRoles ? "Informação restrita" : (female && value(role, "female_name")) || value(role, "name");
        if (key === "role_start_date") return formatDateOnly(value(link, "start_date"));
        if (key === "cpf") return formatCpf(value(identity, key));
        if (key === "rg" || key === "issuing_agency") return value(identity, key);
        if (key === "whatsapp") return formatBrazilPhone(value(row, key));
        if (key === "zip_code") return formatBrazilZipCode(value(row, key));
        if (key === "gender") return formatGender(value(row, key));
        if (key === "marital_status") return formatMaritalStatus(value(row, key), value(row, "gender"));
        if (key === "member_status") return memberStatusLabels[value(row, key) as keyof typeof memberStatusLabels] || "";
        if (key === "member_type") return memberTypeLabels[value(row, key) as keyof typeof memberTypeLabels] || "";
        if (key === "received_by") return receivedByLabels[value(row, key)] || value(row, key);
        if (key === "has_holy_spirit_baptism") return row[key] === true ? "Sim" : row[key] === false ? "Não" : "";
        if (key === "natural_origin") return [value(row, "natural_city"), value(row, "natural_state")].filter(Boolean).join(" / ");
        if (key === "full_address") return [[value(row, "address"), value(row, "number")].filter(Boolean).join(", "), value(row, "complement"), value(row, "district"), [value(row, "city"), value(row, "state")].filter(Boolean).join(" / "), formatBrazilZipCode(value(row, "zip_code")), value(row, "country")].filter(Boolean).join(" · ");
        return value(row, key);
      }
      const values: MemberReportDocument["rows"][number]["values"] = {};
      for (const column of columns) {
        const text = format(column.key);
        values[column.key] = column.format === "date" && column.key !== "role_start_date" ? formatDateOnly(text) : text;
      }
      return { id: value(row, "id"), values };
    });
    const [churchResult, settingsResult] = await Promise.all([
      client.from("churches").select("name,logo_url,address,number,district,city,state,phone,document,senior_pastor_name,senior_pastor_spouse_name").eq("id", churchId).is("deleted_at", null).maybeSingle(),
      client.from("app_settings").select("display_church_name,logo_url").eq("church_id", churchId).is("deleted_at", null).maybeSingle(),
    ]);
    if (churchResult.error || !churchResult.data || settingsResult.error) throw new MemberReportError("MEMBER_REPORT_LOAD_FAILED");
    const church = churchResult.data, settings = settingsResult.data;
    const labels = [filters.archived ? "Membros arquivados" : "Membros não arquivados"];
    if (search.length >= 3) labels.push("Busca aplicada");
    if (filters.regionId) labels.push("Regional selecionada");
    if (filters.congregationId) labels.push("Congregação selecionada");
    if (filters.roleId) labels.push("Cargo selecionado");
    if (filters.status) labels.push(`Situação: ${memberStatusLabels[filters.status]}`);
    if (filters.memberType) labels.push(`Tipo: ${memberTypeLabels[filters.memberType]}`);
    if (filters.importBatchId) labels.push("Lote de importação selecionado");
    return { kind: options.kind, issuedAt: new Date().toISOString(), rows: reportRows, columns, filters: labels,
      scopeLabel: scope === "CHURCH" ? "" : "Visão restrita: somente membros autorizados para o seu acesso.",
      church: { name: settings?.display_church_name?.trim() || church.name || context.church.name,
        pastorNames: [church.senior_pastor_name, church.senior_pastor_spouse_name].map((name) => name?.trim() || "").filter(Boolean),
        logoDataUri: await loadChurchLogoDataUri(settings?.logo_url || church.logo_url || context.church.logoUrl, churchId, client),
        address: [church.address, church.number, church.district, church.city, church.state].filter(Boolean).join(", "), phone: formatBrazilPhone(church.phone ?? ""), document: formatCnpj(church.document ?? "") },
    };
  } catch (error) {
    if (error instanceof MemberReportError) throw error;
    throw new MemberReportError("MEMBER_REPORT_LOAD_FAILED");
  }
}

export async function generateMemberReportDownload(context: AuthContext, options: MemberReportOptions) {
  const document = await loadMemberReportDocument(context, options);
  const body = options.format === "pdf" ? await createMemberReportPdf(document) : await createMemberReportWorkbook(document);
  try {
    const client = await createClient();
    const { error } = await client.rpc("log_audit", { p_church_id: context.church.id, p_module: "members", p_action: "EXPORT_MEMBER_REPORT", p_entity_type: "member", p_description: "Emissão de listagem de membros.",
      p_metadata: { kind: options.kind, format: options.format, count: document.rows.length, scope: context.access.scope, fields: document.columns.map((c) => c.key), archived: options.filters.archived,
        filtered: Object.entries(options.filters).some(([key, val]) => key !== "sort" && Boolean(val)) }, p_severity: "INFO" });
    if (error) throw error;
  } catch { throw new MemberReportError("MEMBER_REPORT_AUDIT_FAILED"); }
  const names = { simplified: "simplificada", complete: "completa", custom: "personalizada" };
  return { body, contentType: options.format === "pdf" ? "application/pdf" : "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", fileName: `lista-membros-${names[options.kind]}.${options.format}` };
}
