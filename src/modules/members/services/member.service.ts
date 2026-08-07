import "server-only";

import { createClient } from "@/lib/supabase/server";
import { PERMISSIONS, hasPermission } from "@/modules/auth/constants/permissions";
import type { AuthContext } from "@/modules/auth/types/auth.types";
import { formatBrazilPhone, formatCpf } from "@/utils/input-masks";
import type { MemberFormInitialData } from "../types/member-form.types";
import type {
  MemberCapabilities,
  MemberCoreDetails,
  MemberDocumentItem,
  MemberFilters,
  MemberFinanceItem,
  MemberHistoryItem,
  MemberListItem,
  MemberListParams,
  MemberListResult,
  MemberRoleItem,
  MemberStats,
  PaginatedTab,
} from "../types/member.types";

// Supabase returns relation shapes dynamically because this project does not yet
// use generated Database generics. The casts remain isolated in this service.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyRow = Record<string, any>;

const DEFAULT_PARAMS: MemberListParams = {
  page: 1,
  pageSize: 20,
  search: "",
  congregationId: "",
  regionId: "",
  roleId: "",
  status: "",
  memberType: "",
  archived: false,
  sort: "name_asc",
};

function first<T>(value: T | T[] | null | undefined): T | null {
  return Array.isArray(value) ? value[0] ?? null : value ?? null;
}

function emptyList(params: MemberListParams): MemberListResult {
  return { items: [], total: 0, page: params.page, pageSize: params.pageSize, pageCount: 0 };
}

function safeSearch(value: string) {
  return value.trim().slice(0, 80).replace(/[(),.*%]/g, " ").replace(/\s+/g, " ");
}

export function getMemberCapabilities(context: AuthContext): MemberCapabilities {
  const can = (permission: string) => hasPermission(context.permissions, permission);
  return {
    create: can(PERMISSIONS.membersCreate),
    update: can(PERMISSIONS.membersUpdate),
    changeStatus: can(PERMISSIONS.membersChangeStatus),
    transfer: can(PERMISSIONS.membersTransfer),
    archive: can(PERMISSIONS.membersArchive),
    restore: can(PERMISSIONS.membersRestore),
    viewFull: can(PERMISSIONS.membersViewFull),
    viewSensitiveIdentity: can(PERMISSIONS.membersViewSensitiveIdentity),
    manageSensitiveIdentity: can(PERMISSIONS.membersManageSensitiveIdentity),
    viewPastoralNotes: can(PERMISSIONS.membersViewPastoralNotes),
    editPastoralNotes: can(PERMISSIONS.membersEditPastoralNotes),
    viewHistory: can(PERMISSIONS.memberHistoryView),
    createHistory: can(PERMISSIONS.memberHistoryCreate),
    viewFinance: can(PERMISSIONS.financeView),
    viewDocuments: can(PERMISSIONS.membersViewFull),
    manageDocuments: can(PERMISSIONS.membersManageDocuments),
    viewSensitiveDocuments: can(PERMISSIONS.membersViewSensitiveDocuments),
    viewRoles: can(PERMISSIONS.memberRolesView),
    manageRoles: can(PERMISSIONS.memberRolesManage),
  };
}

export function normalizeMemberListParams(value: Partial<MemberListParams>): MemberListParams {
  const pageSize = [20, 50, 100].includes(Number(value.pageSize)) ? Number(value.pageSize) as 20 | 50 | 100 : 20;
  const sorts = ["name_asc", "name_desc", "recent", "oldest", "code"];
  return {
    ...DEFAULT_PARAMS,
    ...value,
    page: Math.max(1, Number(value.page) || 1),
    pageSize,
    search: String(value.search ?? "").slice(0, 80),
    sort: sorts.includes(String(value.sort)) ? value.sort as MemberListParams["sort"] : "name_asc",
    archived: Boolean(value.archived),
  };
}

async function resolveFilteredIds(
  context: AuthContext,
  params: MemberListParams,
): Promise<string[] | null> {
  const supabase = await createClient();
  let ids: Set<string> | null = null;

  if (params.regionId) {
    const { data } = await supabase
      .from("congregations")
      .select("id")
      .eq("church_id", context.church.id)
      .eq("region_id", params.regionId)
      .is("deleted_at", null);
    const congregationIds = (data ?? []).map((row) => row.id);
    if (!congregationIds.length) return [];
    const { data: members } = await supabase
      .from("members")
      .select("id")
      .eq("church_id", context.church.id)
      .in("congregation_id", congregationIds);
    ids = new Set((members ?? []).map((row) => row.id));
  }

  if (params.roleId) {
    const { data } = await supabase
      .from("member_roles")
      .select("member_id")
      .eq("church_id", context.church.id)
      .eq("role_id", params.roleId)
      .eq("status", "ACTIVE")
      .is("deleted_at", null);
    const roleIds = new Set((data ?? []).map((row) => row.member_id));
    ids = ids ? new Set([...ids].filter((id) => roleIds.has(id))) : roleIds;
  }
  return ids ? [...ids] : null;
}

export async function listMembers(context: AuthContext, input: Partial<MemberListParams>): Promise<MemberListResult> {
  const params = normalizeMemberListParams(input);
  const supabase = await createClient();
  const filteredIds = await resolveFilteredIds(context, params);
  if (filteredIds && filteredIds.length === 0) return emptyList(params);

  let query = supabase
    .from("members")
    .select("id, member_code, full_name, gender, member_status, member_type, whatsapp, congregation_id, created_at, updated_at, deleted_at, congregations!inner(id, name, regions(name))", { count: "exact" })
    .eq("church_id", context.church.id);

  query = params.archived ? query.not("deleted_at", "is", null) : query.is("deleted_at", null);
  if (params.congregationId) query = query.eq("congregation_id", params.congregationId);
  if (params.status) query = query.eq("member_status", params.status);
  if (params.memberType) query = query.eq("member_type", params.memberType);
  if (filteredIds) query = query.in("id", filteredIds);

  const search = safeSearch(params.search);
  if (search.length >= 3) {
    const terms = [`full_name.ilike.%${search}%`, `member_code.ilike.%${search}%`];
    if (getMemberCapabilities(context).viewSensitiveIdentity && /^\d{3,}$/.test(search.replace(/\D/g, ""))) {
      const { data } = await supabase
        .from("member_sensitive_identity")
        .select("member_id")
        .eq("church_id", context.church.id)
        .ilike("cpf", `%${search.replace(/\D/g, "")}%`)
        .is("deleted_at", null)
        .limit(100);
      const sensitiveIds = (data ?? []).map((row) => row.member_id);
      if (sensitiveIds.length) terms.push(`id.in.(${sensitiveIds.join(",")})`);
    }
    query = query.or(terms.join(","));
  }

  if (params.sort === "name_desc") query = query.order("full_name", { ascending: false }).order("id");
  else if (params.sort === "recent") query = query.order("created_at", { ascending: false }).order("id");
  else if (params.sort === "oldest") query = query.order("created_at", { ascending: true }).order("id");
  else if (params.sort === "code") query = query.order("member_code", { ascending: true, nullsFirst: false }).order("full_name");
  else query = query.order("full_name", { ascending: true }).order("id");

  const from = (params.page - 1) * params.pageSize;
  const { data, count, error } = await query.range(from, from + params.pageSize - 1);
  if (error) throw new Error(`Não foi possível carregar os membros: ${error.message}`);
  const rows = (data ?? []) as unknown as AnyRow[];
  const memberIds = rows.map((row) => row.id);
  const roleMap = new Map<string, string>();
  if (memberIds.length) {
    const { data: roles } = await supabase
      .from("member_roles")
      .select("member_id, role:roles!member_roles_role_id_fkey(name, female_name)")
      .in("member_id", memberIds)
      .eq("status", "ACTIVE")
      .is("deleted_at", null);
    ((roles ?? []) as unknown as AnyRow[]).forEach((link) => {
      const role = first<AnyRow>(link.role);
      const member = rows.find((row) => row.id === link.member_id);
      if (role) roleMap.set(link.member_id, member?.gender === "FEMALE" && role.female_name ? role.female_name : role.name);
    });
  }

  const items: MemberListItem[] = rows.map((row) => {
    const congregation = first<AnyRow>(row.congregations) ?? {};
    const region = first<AnyRow>(congregation.regions);
    return {
      id: row.id,
      memberCode: row.member_code,
      fullName: row.full_name,
      gender: row.gender,
      memberStatus: row.member_status,
      memberType: row.member_type,
      whatsapp: getMemberCapabilities(context).viewFull ? row.whatsapp : null,
      congregationId: row.congregation_id,
      congregationName: congregation.name ?? "Congregação",
      regionName: region?.name ?? null,
      role: roleMap.get(row.id) ?? null,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      archived: Boolean(row.deleted_at),
    };
  });
  const total = count ?? 0;
  return { items, total, page: params.page, pageSize: params.pageSize, pageCount: Math.ceil(total / params.pageSize) };
}

export async function getMemberStats(context: AuthContext): Promise<MemberStats> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_member_stats", { p_church_id: context.church.id });
  if (error) return { total: 0, active: 0, inactive: 0, visitors: 0, archived: 0 };
  const row = (data ?? {}) as AnyRow;
  return {
    total: Number(row.total ?? 0), active: Number(row.active ?? 0), inactive: Number(row.inactive ?? 0),
    visitors: Number(row.visitors ?? 0), archived: Number(row.archived ?? 0),
  };
}

export async function getMemberFilters(context: AuthContext): Promise<MemberFilters> {
  const supabase = await createClient();
  const [congregations, regions, roles] = await Promise.all([
    supabase.from("congregations").select("id, name").eq("church_id", context.church.id).eq("status", "ACTIVE").is("deleted_at", null).order("name"),
    supabase.from("regions").select("id, name").eq("church_id", context.church.id).eq("status", "ACTIVE").is("deleted_at", null).order("name"),
    supabase.from("roles").select("id, name").eq("church_id", context.church.id).eq("status", "ACTIVE").is("deleted_at", null).order("display_order").order("name"),
  ]);
  const map = (rows: { id: string; name: string }[] | null) => (rows ?? []).map((row) => ({ value: row.id, label: row.name }));
  return { congregations: map(congregations.data), regions: map(regions.data), roles: map(roles.data) };
}

export async function getMemberEditData(context: AuthContext, memberId: string): Promise<MemberFormInitialData | null> {
  const supabase = await createClient();
  const { data: row } = await supabase.from("members").select("*").eq("id", memberId).eq("church_id", context.church.id).is("deleted_at", null).maybeSingle();
  if (!row) return null;
  const capabilities = getMemberCapabilities(context);
  const [identity, pastoral, role] = await Promise.all([
    capabilities.manageSensitiveIdentity ? supabase.from("member_sensitive_identity").select("cpf, rg, issuing_agency").eq("member_id", memberId).is("deleted_at", null).maybeSingle() : Promise.resolve({ data: null }),
    capabilities.editPastoralNotes ? supabase.from("member_pastoral_notes").select("notes").eq("member_id", memberId).is("deleted_at", null).maybeSingle() : Promise.resolve({ data: null }),
    capabilities.manageRoles ? supabase.from("member_roles").select("role_id, start_date").eq("member_id", memberId).eq("status", "ACTIVE").is("deleted_at", null).maybeSingle() : Promise.resolve({ data: null }),
  ]);
  const value = row as AnyRow;
  const text = (key: string) => String(value[key] ?? "");
  return {
    id: value.id, updated_at: value.updated_at, full_name: text("full_name"),
    gender: text("gender"), birth_date: text("birth_date"), marital_status: text("marital_status"),
    nationality: text("nationality") || "Brasileira", natural_city: text("natural_city"), natural_state: text("natural_state"),
    cpf: formatCpf(String((identity.data as AnyRow | null)?.cpf ?? "")), rg: String((identity.data as AnyRow | null)?.rg ?? ""),
    issuing_agency: String((identity.data as AnyRow | null)?.issuing_agency ?? ""), profession: text("profession"), education_level: text("education_level"),
    whatsapp: formatBrazilPhone(text("whatsapp")), email: text("email"), zip_code: text("zip_code"),
    address: text("address"), number: text("number"), complement: text("complement"), district: text("district"), city: text("city"),
    state: text("state"), country: text("country") || "Brasil", father_name: text("father_name"), mother_name: text("mother_name"),
    spouse_name: text("spouse_name"), congregation_id: text("congregation_id"), member_type: text("member_type"),
    main_role_id: String((role.data as AnyRow | null)?.role_id ?? ""), role_start_date: String((role.data as AnyRow | null)?.start_date ?? ""),
    conversion_date: text("conversion_date"), baptism_date: text("baptism_date"), baptism_church: text("baptism_church"),
    has_holy_spirit_baptism: Boolean(value.has_holy_spirit_baptism), holy_spirit_baptism_date: text("holy_spirit_baptism_date"),
    previous_church: text("previous_church"), received_by: text("received_by"), received_date: text("received_date"),
    letter_origin_church: text("letter_origin_church"), notes: text("notes"), pastoral_notes: String((pastoral.data as AnyRow | null)?.notes ?? ""),
  };
}

export async function getMemberCoreDetails(context: AuthContext, memberId: string): Promise<MemberCoreDetails | null> {
  const supabase = await createClient();
  const capabilities = getMemberCapabilities(context);
  const { data } = await supabase
    .from("members")
    .select("*, congregations!inner(name, regions(name))")
    .eq("id", memberId).eq("church_id", context.church.id).maybeSingle();
  if (!data) return null;
  const [identity, pastoral, roles] = await Promise.all([
    capabilities.viewSensitiveIdentity ? supabase.from("member_sensitive_identity").select("cpf, rg, issuing_agency").eq("member_id", memberId).is("deleted_at", null).maybeSingle() : Promise.resolve({ data: null }),
    capabilities.viewPastoralNotes ? supabase.from("member_pastoral_notes").select("notes").eq("member_id", memberId).is("deleted_at", null).maybeSingle() : Promise.resolve({ data: null }),
    capabilities.viewRoles ? supabase.from("member_roles").select("id, role_id, status, start_date, end_date, notes, role:roles!member_roles_role_id_fkey(name, female_name)").eq("member_id", memberId).is("deleted_at", null).order("status", { ascending: true }).order("start_date", { ascending: false }) : Promise.resolve({ data: [] }),
  ]);
  const row = data as unknown as AnyRow;
  const congregation = first<AnyRow>(row.congregations) ?? {};
  const region = first<AnyRow>(congregation.regions);
  const roleItems: MemberRoleItem[] = ((roles.data ?? []) as unknown as AnyRow[]).map((link) => ({
    id: link.id, roleId: link.role_id,
    name: row.gender === "FEMALE" && first<AnyRow>(link.role)?.female_name
      ? first<AnyRow>(link.role)?.female_name
      : first<AnyRow>(link.role)?.name ?? "Cargo",
    status: link.status, startDate: link.start_date, endDate: link.end_date, notes: link.notes,
  }));
  const address = [row.address, row.number, row.complement, row.district, row.city, row.state, row.zip_code].filter(Boolean).join(", ");
  return {
    id: row.id, memberCode: row.member_code, fullName: row.full_name, gender: row.gender,
    birthDate: row.birth_date, maritalStatus: row.marital_status, nationality: row.nationality, naturalCity: row.natural_city,
    naturalState: row.natural_state, profession: row.profession, educationLevel: row.education_level,
    whatsapp: capabilities.viewFull ? formatBrazilPhone(row.whatsapp ?? "") : null, email: capabilities.viewFull ? row.email : null, address: capabilities.viewFull ? address : "Informação restrita",
    fatherName: capabilities.viewFull ? row.father_name : null, motherName: capabilities.viewFull ? row.mother_name : null,
    spouseName: capabilities.viewFull ? row.spouse_name : null, congregationName: congregation.name ?? "Congregação", regionName: region?.name ?? null,
    memberStatus: row.member_status, memberType: row.member_type, conversionDate: row.conversion_date, baptismDate: row.baptism_date,
    baptismChurch: row.baptism_church, hasHolySpiritBaptism: row.has_holy_spirit_baptism, holySpiritBaptismDate: row.holy_spirit_baptism_date,
    previousChurch: row.previous_church, receivedBy: row.received_by, receivedDate: row.received_date, letterOriginChurch: row.letter_origin_church,
    notes: row.notes, pastoralNotes: (pastoral.data as AnyRow | null)?.notes ?? null, cpf: formatCpf(String((identity.data as AnyRow | null)?.cpf ?? "")) || null,
    rg: (identity.data as AnyRow | null)?.rg ?? null, issuingAgency: (identity.data as AnyRow | null)?.issuing_agency ?? null,
    roles: roleItems, createdAt: row.created_at, updatedAt: row.updated_at, archived: Boolean(row.deleted_at),
  };
}

export async function getMemberHistory(context: AuthContext, memberId: string, page = 1): Promise<PaginatedTab<MemberHistoryItem>> {
  const supabase = await createClient();
  const pageSize = 20;
  const from = (Math.max(1, page) - 1) * pageSize;
  const { data, count, error } = await supabase.from("member_history")
    .select("id, history_type, title, description, old_value, new_value, metadata, event_date, is_sensitive, created_at", { count: "exact" })
    .eq("member_id", memberId).eq("church_id", context.church.id).is("deleted_at", null)
    .order("event_date", { ascending: false }).order("created_at", { ascending: false }).range(from, from + pageSize - 1);
  if (error) throw new Error(error.message);
  const rows = (data ?? []) as unknown as AnyRow[];
  const roleIds = new Set<string>();
  const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  rows.forEach((row) => {
    if (!String(row.history_type).startsWith("ROLE_")) return;
    const metadata = (row.metadata ?? {}) as AnyRow;
    [metadata.role_id, metadata.old_role_id, metadata.new_role_id, row.old_value, row.new_value]
      .filter((value): value is string => typeof value === "string" && uuid.test(value))
      .forEach((value) => roleIds.add(value));
  });
  const roleMap = new Map<string, string>();
  if (roleIds.size) {
    const { data: roles } = await supabase.from("roles").select("id, name").in("id", [...roleIds]);
    (roles ?? []).forEach((role) => roleMap.set(role.id, role.name));
  }
  const items = rows.map((row) => {
    const metadata = (row.metadata ?? {}) as AnyRow;
    const oldRoleId = String(metadata.old_role_id ?? (uuid.test(String(row.old_value ?? "")) ? row.old_value : ""));
    const newRoleId = String(metadata.new_role_id ?? metadata.role_id ?? (uuid.test(String(row.new_value ?? "")) ? row.new_value : ""));
    const oldValue = row.history_type === "ROLE_ENDED"
      ? roleMap.get(String(metadata.role_id ?? "")) ?? row.old_value
      : roleMap.get(oldRoleId) ?? row.old_value;
    const newValue = row.history_type === "ROLE_ASSIGNED"
      ? roleMap.get(newRoleId) ?? row.new_value
      : roleMap.get(newRoleId) ?? row.new_value;
    return { id: row.id, type: row.history_type, title: row.title, description: row.description,
      oldValue, newValue, eventDate: row.event_date, sensitive: row.is_sensitive, createdAt: row.created_at };
  });
  return { items, total: count ?? 0, page, pageCount: Math.ceil((count ?? 0) / pageSize) };
}

export async function getMemberFinance(context: AuthContext, memberId: string, page = 1): Promise<PaginatedTab<MemberFinanceItem>> {
  const supabase = await createClient();
  const pageSize = 20;
  const from = (Math.max(1, page) - 1) * pageSize;
  const { data, count, error } = await supabase.from("financial_transactions")
    .select("id, transaction_number, transaction_type, description, amount, transaction_date, status, financial_categories(name), financial_payment_methods(name)", { count: "exact" })
    .eq("member_id", memberId).eq("church_id", context.church.id).is("deleted_at", null)
    .order("transaction_date", { ascending: false }).range(from, from + pageSize - 1);
  if (error) throw new Error(error.message);
  const items = ((data ?? []) as unknown as AnyRow[]).map((row) => ({ id: row.id, transactionNumber: row.transaction_number,
    transactionType: row.transaction_type, description: row.description, amount: Number(row.amount), transactionDate: row.transaction_date,
    status: row.status, category: first<AnyRow>(row.financial_categories)?.name ?? "Sem categoria",
    paymentMethod: first<AnyRow>(row.financial_payment_methods)?.name ?? null }));
  return { items, total: count ?? 0, page, pageCount: Math.ceil((count ?? 0) / pageSize) };
}

export async function getMemberDocuments(context: AuthContext, memberId: string): Promise<MemberDocumentItem[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("member_documents")
    .select("id, document_type, title, description, file_name, mime_type, file_size, is_sensitive, uploaded_at")
    .eq("member_id", memberId).eq("church_id", context.church.id).is("deleted_at", null).order("uploaded_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []).map((row) => ({ id: row.id, type: row.document_type, title: row.title, description: row.description,
    fileName: row.file_name, mimeType: row.mime_type, fileSize: row.file_size == null ? null : Number(row.file_size), sensitive: row.is_sensitive, uploadedAt: row.uploaded_at }));
}
