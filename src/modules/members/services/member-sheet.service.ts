import "server-only";

import { createClient } from "@/lib/supabase/server";
import { PERMISSIONS, hasPermission } from "@/modules/auth/constants/permissions";
import { loadChurchLogoDataUri } from "@/modules/auth/services/church-logo.service";
import type { AuthContext } from "@/modules/auth/types/auth.types";
import { formatBrazilPhone, formatCpf, formatCnpj } from "@/utils/input-masks";
import { MemberSheetError, type MemberSheetDocument, type MemberSheetOptions } from "../types/member-sheet.types";
import type { MemberStatus, PaginatedTab } from "../types/member.types";
import { formatDateOnly, formatGender, formatMaritalStatus, formatMemberHistoryValue, memberStatusLabels, receivedByLabels } from "../utils/member-formatters";
import { getMemberEvents, getMemberHistory } from "./member.service";
import { createMemberSheetPdf } from "./member-sheet-pdf.service";

// Explicit projection: internal notes, document metadata and finance are never loaded.
const MEMBER_SELECT = [
  "id", "congregation_id", "full_name", "member_code", "gender", "member_status",
  "birth_date", "marital_status", "whatsapp", "email", "address", "number", "complement", "district", "city", "state", "zip_code",
  "father_name", "mother_name", "spouse_name", "conversion_date", "baptism_date", "baptism_church",
  "has_holy_spirit_baptism", "holy_spirit_baptism_date", "received_by", "received_date", "congregations!inner(name)",
].join(", ");

type Row = Record<string, unknown>;
const value = (row: Row, key: string) => typeof row[key] === "string" ? row[key] as string : "";
function first(value: unknown): Row {
  const row = Array.isArray(value) ? value[0] : value;
  return row && typeof row === "object" ? row as Row : {};
}
const text = (value: string | null | undefined) => value?.trim() || "Não informado";
const date = (value: string) => text(formatDateOnly(value));

export async function generateMemberSheetDownload(context: AuthContext, memberId: string, options: MemberSheetOptions) {
  const document = await loadMemberSheetDocument(context, memberId, options);
  const body = await createMemberSheetPdf(document);
  try {
    const supabase = await createClient();
    const { error } = await supabase.rpc("log_audit", {
      p_church_id: context.church.id,
      p_module: "members",
      p_action: "EXPORT_MEMBER_SHEET",
      p_entity_type: "member",
      p_entity_id: memberId,
      p_description: "Emissão de ficha do membro em PDF.",
      p_metadata: {
        format: "pdf",
        include_history: options.includeHistory,
        include_events: options.includeEvents,
        history_count: document.history?.length ?? 0,
        events_count: document.events?.length ?? 0,
      },
      p_severity: "INFO",
    });
    if (error) throw error;
  } catch {
    throw new MemberSheetError("MEMBER_SHEET_AUDIT_FAILED");
  }
  return { body, fileName: document.fileName };
}

function assertPermissions(context: AuthContext, options: MemberSheetOptions) {
  const required: string[] = [PERMISSIONS.membersViewBasic, PERMISSIONS.membersViewFull, PERMISSIONS.membersExport];
  if (options.includeHistory) required.push(PERMISSIONS.memberHistoryView);
  if (options.includeEvents) required.push(PERMISSIONS.eventsView, PERMISSIONS.eventRegistrationsView);
  if (required.some((permission) => !hasPermission(context.permissions, permission))) {
    throw new MemberSheetError("MEMBER_SHEET_PERMISSION_DENIED");
  }
}

async function allPages<T extends { id: string }>(load: (page: number) => Promise<PaginatedTab<T>>): Promise<T[]> {
  const firstPage = await load(1);
  // Never silently truncate an export when the history grows beyond a safe request size.
  if (firstPage.total > 10_000) throw new MemberSheetError("MEMBER_SHEET_TOO_LARGE");
  const items = [...firstPage.items];
  for (let page = 2; page <= firstPage.pageCount; page += 1) {
    const next = await load(page);
    if (!next.items.length || next.total !== firstPage.total) throw new MemberSheetError("MEMBER_SHEET_LOAD_FAILED");
    items.push(...next.items);
  }
  if (items.length !== firstPage.total || new Set(items.map((item) => item.id)).size !== items.length) {
    throw new MemberSheetError("MEMBER_SHEET_LOAD_FAILED");
  }
  return items;
}

export async function loadMemberSheetDocument(
  context: AuthContext,
  memberId: string,
  options: MemberSheetOptions,
): Promise<MemberSheetDocument> {
  assertPermissions(context, options);
  try {
    const supabase = await createClient();
    const memberResult = await supabase.from("members").select(MEMBER_SELECT)
      .eq("id", memberId).eq("church_id", context.church.id).is("deleted_at", null).maybeSingle();
    if (memberResult.error) throw new MemberSheetError("MEMBER_SHEET_LOAD_FAILED");
    if (!memberResult.data) throw new MemberSheetError("MEMBER_SHEET_NOT_FOUND");
    const member = memberResult.data as unknown as Row;
    const scope = await supabase.rpc("can_access_member", {
      p_church_id: context.church.id, p_member_id: memberId, p_congregation_id: value(member, "congregation_id"),
    });
    if (scope.error) throw new MemberSheetError("MEMBER_SHEET_LOAD_FAILED");
    if (scope.data !== true) throw new MemberSheetError("MEMBER_SHEET_NOT_FOUND");

    const canIdentity = hasPermission(context.permissions, PERMISSIONS.membersViewSensitiveIdentity);
    const canRoles = hasPermission(context.permissions, PERMISSIONS.memberRolesView);
    const [churchResult, settingsResult, identityResult, rolesResult, history, events] = await Promise.all([
      supabase.from("churches").select("name, logo_url, address, number, district, city, state, phone, document")
        .eq("id", context.church.id).is("deleted_at", null).maybeSingle(),
      supabase.from("app_settings").select("display_church_name, logo_url")
        .eq("church_id", context.church.id).is("deleted_at", null).maybeSingle(),
      canIdentity ? supabase.from("member_sensitive_identity").select("cpf, rg, issuing_agency")
        .eq("church_id", context.church.id).eq("member_id", memberId).is("deleted_at", null).maybeSingle()
        : Promise.resolve({ data: null, error: null }),
      canRoles ? supabase.from("member_roles").select("status, title_variant, role:roles!member_roles_role_id_fkey(name, female_name)")
        .eq("church_id", context.church.id).eq("member_id", memberId).eq("status", "ACTIVE").is("deleted_at", null)
        .order("start_date", { ascending: false }).order("id", { ascending: false }).limit(1)
        : Promise.resolve({ data: [], error: null }),
      options.includeHistory ? allPages((page) => getMemberHistory(context, memberId, page, false)) : null,
      options.includeEvents ? allPages((page) => getMemberEvents(context, memberId, page)) : null,
    ]);
    if ([churchResult, settingsResult, identityResult, rolesResult].some((result) => result.error) || !churchResult.data) {
      throw new MemberSheetError("MEMBER_SHEET_LOAD_FAILED");
    }
    const church = churchResult.data as Row;
    const settings = first(settingsResult.data);
    const identity = first(identityResult.data);
    const roleLink = first(rolesResult.data);
    const role = first(roleLink.role);
    const femaleTitle = roleLink.title_variant === "FEMALE" || (roleLink.title_variant === "AUTO" && member.gender === "FEMALE");
    const memberCode = value(member, "member_code") || null;
    const logoDataUri = await loadChurchLogoDataUri(value(settings, "logo_url") || value(church, "logo_url") || context.church.logoUrl, context.church.id, supabase);
    const field = (label: string, content: string) => ({ label, value: text(content) });
    return {
      issuedAt: new Date().toISOString(),
      fileName: `ficha-membro-${(memberCode || memberId).replace(/[^A-Za-z0-9_-]/g, "").slice(0, 64) || memberId}.pdf`,
      church: {
        name: value(settings, "display_church_name").trim() || value(church, "name") || context.church.name,
        logoDataUri,
        address: ["address", "number", "district", "city", "state"].map((key) => value(church, key)).filter(Boolean).join(", "),
        phone: formatBrazilPhone(value(church, "phone")),
        document: formatCnpj(value(church, "document")),
      },
      member: {
        fullName: value(member, "full_name"), memberCode,
        role: (femaleTitle ? value(role, "female_name") : "") || value(role, "name") || null,
        congregationName: value(first(member.congregations), "name") || "Não informada",
      },
      groups: [
        { title: "Identificação e vínculo", fields: [
          field("Situação", memberStatusLabels[value(member, "member_status") as MemberStatus]),
          field("Nascimento", date(value(member, "birth_date"))),
          field("Sexo", formatGender(value(member, "gender"))),
          field("Estado civil", formatMaritalStatus(value(member, "marital_status"), value(member, "gender"))),
          field("CPF", canIdentity ? formatCpf(value(identity, "cpf")) : "Informação restrita"),
          field("RG / órgão", canIdentity ? [value(identity, "rg"), value(identity, "issuing_agency")].filter(Boolean).join(" / ") : "Informação restrita"),
        ] },
        { title: "Contato, endereço e família", fields: [
          field("WhatsApp", formatBrazilPhone(value(member, "whatsapp"))), field("E-mail", value(member, "email")),
          field("Endereço", ["address", "number", "complement", "district", "city", "state", "zip_code"].map((key) => value(member, key)).filter(Boolean).join(", ")),
          field("Pai", value(member, "father_name")), field("Mãe", value(member, "mother_name")), field("Cônjuge", value(member, "spouse_name")),
        ] },
        { title: "Histórico de fé", fields: [
          field("Conversão", date(value(member, "conversion_date"))), field("Batismo nas águas", date(value(member, "baptism_date"))),
          field("Igreja do batismo", value(member, "baptism_church")),
          field("Batismo com Espírito Santo", member.has_holy_spirit_baptism ? value(member, "holy_spirit_baptism_date") ? date(value(member, "holy_spirit_baptism_date")) : "Sim · Data não informada" : "Não informado"),
          field("Recebido por", receivedByLabels[value(member, "received_by")]), field("Data de recebimento", date(value(member, "received_date"))),
        ] },
      ],
      history: history?.filter((item) => !item.sensitive).map((item) => ({
        date: date(item.eventDate), title: item.title,
        change: [formatMemberHistoryValue(item.oldValue), formatMemberHistoryValue(item.newValue)].filter(Boolean).join(" → ") || null,
        description: item.description,
      })) ?? null,
      events: events?.map((item) => ({ name: item.name, location: item.location,
        date: new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: "America/Sao_Paulo" }).format(new Date(item.startsAt)),
      })) ?? null,
    };
  } catch (error) {
    if (error instanceof MemberSheetError) throw error;
    throw new MemberSheetError("MEMBER_SHEET_LOAD_FAILED");
  }
}
