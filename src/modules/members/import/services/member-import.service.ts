import "server-only";

import { createClient } from "@/lib/supabase/server";
import type { AuthContext } from "@/modules/auth/types/auth.types";
import { MARITAL_STATUS_IMPORT_OPTIONS } from "../constants/member-import";
import type {
  MemberImportBatch,
  MemberImportHistory,
  MemberImportItem,
  MemberImportItemsResult,
  MemberImportMaritalMapping,
  MemberImportReviewParams,
  MemberImportRoleMapping,
  MemberImportRoleOption,
  MemberImportWorkspaceData,
} from "../types/member-import.types";

// Supabase relation inference remains isolated here because the project clients
// are intentionally not parameterized with the generated Database type yet.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyRow = Record<string, any>;

function first<T>(value: T | T[] | null | undefined): T | null {
  return Array.isArray(value) ? value[0] ?? null : value ?? null;
}

function profileName(row: AnyRow | null | undefined) {
  return row?.display_name ?? row?.full_name ?? "Usuário";
}

function mapBatch(row: AnyRow, churchName: string): MemberImportBatch {
  return {
    id: row.id,
    churchId: row.church_id,
    churchName,
    congregationId: row.congregation_id,
    congregationName: first<AnyRow>(row.congregation)?.name ?? "Congregação",
    originalFilename: row.original_filename,
    worksheetName: row.worksheet_name,
    fileSizeBytes: Number(row.file_size_bytes),
    fileSha256: row.file_sha256,
    status: row.status,
    totalRows: Number(row.total_rows),
    validRows: Number(row.valid_rows),
    warningRows: Number(row.warning_rows),
    errorRows: Number(row.error_rows),
    skippedRows: Number(row.skipped_rows),
    importedRows: Number(row.imported_rows),
    settingsSnapshot: (row.settings_snapshot ?? {}) as Record<string, unknown>,
    failureMessage: row.failure_message,
    createdBy: row.created_by,
    createdByName: profileName(first<AnyRow>(row.creator)),
    validatedAt: row.validated_at,
    confirmedAt: row.confirmed_at,
    completedAt: row.completed_at,
    rolledBackAt: row.rolled_back_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapItem(row: AnyRow): MemberImportItem {
  const role = first<AnyRow>(row.role);
  const roleName = row.role_title_variant === "FEMALE"
    ? role?.female_name ?? role?.name ?? null
    : role?.name ?? null;
  return {
    id: row.id,
    rowNumber: row.row_number,
    sourceData: row.source_data,
    fullName: row.full_name,
    phoneRaw: row.phone_raw,
    whatsapp: row.whatsapp,
    birthDate: row.birth_date,
    roleRaw: row.role_raw,
    roleId: row.role_id,
    roleName,
    roleTitleVariant: row.role_title_variant,
    cpf: row.cpf,
    maritalStatusRaw: row.marital_status_raw,
    maritalStatus: row.marital_status,
    receivedDate: row.received_date,
    genderRaw: row.gender_raw,
    gender: row.gender,
    zipCode: row.zip_code,
    city: row.city,
    state: row.state,
    naturalCity: row.natural_city,
    naturalState: row.natural_state,
    fatherName: row.father_name,
    motherName: row.mother_name,
    baptismDate: row.baptism_date,
    holySpiritBaptismDate: row.holy_spirit_baptism_date,
    conversionDate: row.conversion_date,
    classification: row.classification,
    decision: row.decision,
    issues: Array.isArray(row.issues) ? row.issues : [],
    importedMemberId: row.imported_member_id,
    importedMemberCode: row.imported_member_code,
  };
}

export async function getImportOptions(context: AuthContext) {
  const supabase = await createClient();
  const [congregationResult, roleResult] = await Promise.all([
    supabase
      .from("congregations")
      .select("id, name")
      .eq("church_id", context.church.id)
      .eq("status", "ACTIVE")
      .is("deleted_at", null)
      .order("is_headquarters", { ascending: false })
      .order("display_order")
      .order("name"),
    supabase
      .from("roles")
      .select("id, name, female_name, abbreviation, female_abbreviation, display_order")
      .eq("church_id", context.church.id)
      .eq("status", "ACTIVE")
      .is("deleted_at", null)
      .order("display_order")
      .order("name"),
  ]);
  if (congregationResult.error || roleResult.error) {
    throw new Error("Não foi possível carregar as opções da importação.");
  }
  return {
    congregations: (congregationResult.data ?? []).map((row) => ({ id: row.id, name: row.name })),
    roles: (roleResult.data ?? []).map((row): MemberImportRoleOption => ({
      id: row.id,
      name: row.name,
      femaleName: row.female_name,
      abbreviation: row.abbreviation,
      femaleAbbreviation: row.female_abbreviation,
      displayOrder: row.display_order,
    })),
  };
}

export async function getMemberImportBatch(context: AuthContext, batchId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("member_import_batches")
    .select(`
      *,
      congregation:congregations!member_import_batches_congregation_same_church_fk(name),
      creator:profiles!member_import_batches_created_by_fkey(full_name, display_name)
    `)
    .eq("id", batchId)
    .eq("church_id", context.church.id)
    .is("deleted_at", null)
    .maybeSingle();
  if (error) throw new Error("Não foi possível carregar o lote.");
  return data ? mapBatch(data as unknown as AnyRow, context.church.name) : null;
}

export async function listMemberImportItems(
  context: AuthContext,
  batchId: string,
  params: MemberImportReviewParams,
): Promise<MemberImportItemsResult> {
  const supabase = await createClient();
  const page = Math.max(1, params.page || 1);
  const pageSize = [20, 50, 100].includes(params.pageSize) ? params.pageSize : 20;
  let query = supabase
    .from("member_import_items")
    .select(`
      *,
      role:roles!member_import_items_role_same_church_fk(name, female_name)
    `, { count: "exact" })
    .eq("batch_id", batchId)
    .eq("church_id", context.church.id);
  if (params.classification) query = query.eq("classification", params.classification);
  const search = params.search.trim().slice(0, 80).replace(/[(),.*%]/g, " ").replace(/\s+/g, " ");
  if (search.length >= 3) query = query.ilike("full_name", `%${search}%`);
  const from = (page - 1) * pageSize;
  const { data, count, error } = await query.order("row_number").range(from, from + pageSize - 1);
  if (error) throw new Error("Não foi possível carregar as linhas do lote.");
  const total = count ?? 0;
  return {
    items: ((data ?? []) as unknown as AnyRow[]).map(mapItem),
    total,
    page,
    pageSize,
    pageCount: Math.max(1, Math.ceil(total / pageSize)),
  };
}

async function getMemberImportMappings(context: AuthContext, batchId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("member_import_items")
    .select(`
      role_raw, role_id, marital_status_raw, marital_status,
      role:roles!member_import_items_role_same_church_fk(name, female_name)
    `)
    .eq("batch_id", batchId)
    .eq("church_id", context.church.id)
    .order("row_number")
    .limit(500);
  if (error) throw new Error("Não foi possível carregar os mapeamentos.");
  const roleMap = new Map<string, MemberImportRoleMapping>();
  const maritalMap = new Map<string, MemberImportMaritalMapping>();
  for (const rawRow of (data ?? []) as unknown as AnyRow[]) {
    const role = first<AnyRow>(rawRow.role);
    const existingRole = roleMap.get(rawRow.role_raw);
    roleMap.set(rawRow.role_raw, {
      rawValue: rawRow.role_raw,
      count: (existingRole?.count ?? 0) + 1,
      roleId: rawRow.role_id,
      roleName: role?.name ?? null,
      status: rawRow.role_id ? "RECOGNIZED" : "REQUIRES_MAPPING",
    });
    if (rawRow.marital_status_raw) {
      const existingMarital = maritalMap.get(rawRow.marital_status_raw);
      const option = MARITAL_STATUS_IMPORT_OPTIONS.find((item) => item.value === rawRow.marital_status);
      maritalMap.set(rawRow.marital_status_raw, {
        rawValue: rawRow.marital_status_raw,
        count: (existingMarital?.count ?? 0) + 1,
        value: rawRow.marital_status,
        label: option?.label ?? null,
        status: rawRow.marital_status ? "RECOGNIZED" : "REQUIRES_MAPPING",
      });
    }
  }
  return {
    roleMappings: [...roleMap.values()].sort((a, b) => a.rawValue.localeCompare(b.rawValue, "pt-BR")),
    maritalMappings: [...maritalMap.values()].sort((a, b) => a.rawValue.localeCompare(b.rawValue, "pt-BR")),
  };
}

async function getMemberImportHistory(context: AuthContext): Promise<MemberImportHistory> {
  const supabase = await createClient();
  const [listResult, statsResult] = await Promise.all([
    supabase
      .from("member_import_batches")
      .select(`
        id, created_at, original_filename, imported_rows, warning_rows, status,
        congregation:congregations!member_import_batches_congregation_same_church_fk(name),
        creator:profiles!member_import_batches_created_by_fkey(full_name, display_name)
      `)
      .eq("church_id", context.church.id)
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .limit(50),
    supabase.rpc("get_member_import_history_stats", { p_church_id: context.church.id }),
  ]);
  if (listResult.error || statsResult.error) throw new Error("Não foi possível carregar o histórico de lotes.");
  const data = listResult.data;
  const rows = (data ?? []) as unknown as AnyRow[];
  const stats = (statsResult.data ?? {}) as AnyRow;
  return {
    items: rows.map((row) => ({
      id: row.id,
      createdAt: row.created_at,
      congregationName: first<AnyRow>(row.congregation)?.name ?? "Congregação",
      originalFilename: row.original_filename,
      createdByName: profileName(first<AnyRow>(row.creator)),
      importedRows: Number(row.imported_rows),
      warningRows: Number(row.warning_rows),
      status: row.status,
    })),
    stats: {
      completed: Number(stats.completed ?? 0),
      imported: Number(stats.imported ?? 0),
      warnings: Number(stats.warnings ?? 0),
      rolledBack: Number(stats.rolled_back ?? 0),
    },
  };
}

export async function getMemberImportWorkspace(
  context: AuthContext,
  batchId?: string,
  params: MemberImportReviewParams = { page: 1, pageSize: 20, search: "", classification: "" },
): Promise<MemberImportWorkspaceData> {
  const [options, history, batch] = await Promise.all([
    getImportOptions(context),
    getMemberImportHistory(context),
    batchId ? getMemberImportBatch(context, batchId) : Promise.resolve(null),
  ]);
  if (!batch) {
    return { ...options, history, batch: null, items: null, roleMappings: [], maritalMappings: [] };
  }
  const [items, mappings] = await Promise.all([
    listMemberImportItems(context, batch.id, params),
    getMemberImportMappings(context, batch.id),
  ]);
  return { ...options, history, batch, items, ...mappings };
}

export async function getExistingCpfMembers(context: AuthContext, cpfs: string[]) {
  if (!cpfs.length) return new Map<string, { memberId: string; fullName: string | null }>();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("member_sensitive_identity")
    .select("cpf, member_id, member:members!member_sensitive_identity_member_id_fkey(full_name)")
    .eq("church_id", context.church.id)
    .in("cpf", cpfs)
    .is("deleted_at", null);
  if (error) throw new Error("Não foi possível verificar os CPFs do arquivo.");
  return new Map(((data ?? []) as unknown as AnyRow[]).map((row) => [
    row.cpf,
    { memberId: row.member_id, fullName: first<AnyRow>(row.member)?.full_name ?? null },
  ]));
}

export async function getExistingPhoneMembers(context: AuthContext, phones: string[]) {
  if (!phones.length) return new Map<string, { memberId: string; fullName: string; archived: boolean }>();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("members")
    .select("id, full_name, whatsapp, deleted_at")
    .eq("church_id", context.church.id)
    .in("whatsapp", phones)
    .limit(500);
  if (error) throw new Error("Não foi possível verificar os telefones do arquivo.");
  return new Map((data ?? []).map((row) => [
    row.whatsapp!,
    { memberId: row.id, fullName: row.full_name, archived: Boolean(row.deleted_at) },
  ]));
}

export async function getDuplicateMemberCandidates(
  context: AuthContext,
  candidates: { name_key: string; birth_date: string | null }[],
) {
  if (!candidates.length) return [];
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_member_import_duplicate_candidates", {
    p_church_id: context.church.id,
    p_candidates: candidates,
  });
  if (error) throw new Error("Não foi possível verificar possíveis duplicidades.");
  return (data ?? []) as unknown as Array<{
    candidate_key: string;
    member_id: string;
    full_name: string;
    birth_date: string | null;
    congregation_id: string;
    archived: boolean;
  }>;
}

export async function getMemberImportReportData(context: AuthContext, batchId: string) {
  const batch = await getMemberImportBatch(context, batchId);
  if (!batch) return null;
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("member_import_items")
    .select(`*, role:roles!member_import_items_role_same_church_fk(name, female_name)`)
    .eq("batch_id", batchId)
    .eq("church_id", context.church.id)
    .order("row_number")
    .limit(500);
  if (error) throw new Error("Não foi possível gerar o relatório do lote.");
  return { batch, items: ((data ?? []) as unknown as AnyRow[]).map(mapItem) };
}
