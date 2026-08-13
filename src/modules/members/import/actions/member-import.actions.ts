"use server";

import { createHash } from "node:crypto";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { PERMISSIONS } from "@/modules/auth/constants/permissions";
import { requireAccessContext } from "@/modules/auth/services/access-context.service";
import {
  MEMBER_IMPORT_MAX_FILE_SIZE,
  MEMBER_IMPORT_NORMALIZATION_VERSION,
} from "../constants/member-import";
import {
  getDuplicateMemberCandidates,
  getExistingCpfMembers,
  getExistingPhoneMembers,
  getImportOptions,
  getMemberImportWorkspace,
} from "../services/member-import.service";
import {
  MemberImportParserError,
  parseMemberImportWorkbook,
} from "../services/member-import-parser.service";
import type {
  MemberImportActionResult,
  MemberImportIssue,
  MemberImportReviewParams,
  MemberImportWorkspaceData,
} from "../types/member-import.types";
import {
  createImportIssue,
  normalizeRoleKey,
} from "../utils/member-import-normalizers";
import {
  memberImportItemResolutionSchema,
  memberImportMappingSchema,
  memberImportReviewSchema,
} from "../validations/member-import.schemas";

function friendlyError(message: string) {
  const errors: Record<string, string> = {
    AUTH_REQUIRED: "Sua sessão expirou. Entre novamente para continuar.",
    IMPORT_PERMISSION_DENIED: "Seu acesso não permite importar membros.",
    IMPORT_BATCH_NOT_FOUND: "O lote não foi encontrado ou está fora do seu escopo.",
    IMPORT_BATCH_INVALID_STATUS: "Este lote não pode mais ser alterado neste estado.",
    IMPORT_CONGREGATION_INVALID: "Selecione uma Congregação ativa dentro do seu escopo.",
    IMPORT_FILE_TOO_LARGE: "O arquivo deve possuir no máximo 5 MB.",
    IMPORT_FILE_INVALID_TYPE: "Envie uma planilha no formato XLSX.",
    IMPORT_FILE_DUPLICATE: "Este arquivo já foi importado para a Congregação selecionada.",
    IMPORT_WORKSHEET_EMPTY: "A planilha não possui membros para importar.",
    IMPORT_HEADER_MISSING: "A planilha não possui os cabeçalhos obrigatórios.",
    IMPORT_ROW_LIMIT_EXCEEDED: "O lote deve possuir no máximo 500 membros.",
    IMPORT_UNRESOLVED_ERRORS: "Resolva ou pule todas as linhas com pendências antes de confirmar.",
    IMPORT_ROLE_INVALID: "Um dos Cargos selecionados não está mais disponível.",
    IMPORT_CPF_CONFLICT: "Um CPF do lote já pertence a outro membro e precisa ser pulado.",
    IMPORT_DUPLICATE_CHANGED_DURING_CONFIRMATION: "Os dados mudaram durante a confirmação. Revise novamente as duplicidades.",
    IMPORT_ROLLBACK_BLOCKED: "O lote não pode ser desfeito porque existem alterações posteriores.",
  };
  const key = Object.keys(errors).find((code) => message.includes(code));
  return key ? errors[key] : "Não foi possível concluir esta operação agora.";
}

function hasBlockingDecision(issues: MemberImportIssue[]) {
  return issues.some((issue) => !issue.resolved && (
    issue.severity === "ERROR"
    || ["MARITAL_STATUS_UNKNOWN", "POSSIBLE_DUPLICATE_NAME_BIRTH", "POSSIBLE_DUPLICATE_NAME"].includes(issue.code)
  ));
}

function classify(issues: MemberImportIssue[], roleId: string | null) {
  if (!roleId || issues.some((issue) => issue.severity === "ERROR" && !issue.resolved)) return "ERROR" as const;
  if (issues.some((issue) => issue.severity === "WARNING")) return "WARNING" as const;
  return "VALID" as const;
}

export async function prepareMemberImportAction(
  formData: FormData,
): Promise<MemberImportActionResult<MemberImportWorkspaceData>> {
  const context = await requireAccessContext(PERMISSIONS.membersImport);
  const congregationId = String(formData.get("congregationId") ?? "");
  const fileValue = formData.get("file");
  if (!congregationId) return { success: false, message: "Selecione a Congregação de destino." };
  if (!(fileValue instanceof File) || fileValue.size === 0) {
    return { success: false, message: "Selecione uma planilha XLSX para analisar." };
  }
  if (!fileValue.name.toLocaleLowerCase("pt-BR").endsWith(".xlsx")) {
    return { success: false, message: "Envie uma planilha no formato XLSX.", code: "IMPORT_FILE_INVALID_TYPE" };
  }
  if (fileValue.size > MEMBER_IMPORT_MAX_FILE_SIZE) {
    return { success: false, message: "O arquivo deve possuir no máximo 5 MB.", code: "IMPORT_FILE_TOO_LARGE" };
  }

  try {
    const options = await getImportOptions(context);
    if (!options.congregations.some((item) => item.id === congregationId)) {
      return { success: false, message: "Selecione uma Congregação ativa dentro do seu escopo." };
    }
    const buffer = Buffer.from(await fileValue.arrayBuffer());
    const fileSha256 = createHash("sha256").update(buffer).digest("hex");
    const supabase = await createClient();
    const { data: existingBatch } = await supabase
      .from("member_import_batches")
      .select("id")
      .eq("church_id", context.church.id)
      .eq("congregation_id", congregationId)
      .eq("file_sha256", fileSha256)
      .eq("status", "COMPLETED")
      .is("rolled_back_at", null)
      .is("deleted_at", null)
      .maybeSingle();
    if (existingBatch) {
      return {
        success: false,
        message: "Este arquivo já foi importado para a Congregação selecionada.",
        code: "IMPORT_FILE_DUPLICATE",
        existingBatchId: existingBatch.id,
      };
    }

    const parsed = await parseMemberImportWorkbook(buffer);
    const roleByKey = new Map<string, { id: string; variant: "DEFAULT" | "FEMALE" }>();
    for (const role of options.roles) {
      if (role.abbreviation) roleByKey.set(normalizeRoleKey(role.abbreviation), { id: role.id, variant: "DEFAULT" });
      if (role.femaleAbbreviation) roleByKey.set(normalizeRoleKey(role.femaleAbbreviation), { id: role.id, variant: "FEMALE" });
    }

    const validCpfs = [...new Set(parsed.rows.map((row) => row.cpf).filter((cpf): cpf is string => Boolean(cpf)))];
    const validPhones = [...new Set(parsed.rows.map((row) => row.whatsapp).filter((phone): phone is string => Boolean(phone)))];
    const [existingCpfs, existingPhones, duplicateCandidates] = await Promise.all([
      getExistingCpfMembers(context, validCpfs),
      getExistingPhoneMembers(context, validPhones),
      getDuplicateMemberCandidates(context, parsed.rows.map((row) => ({
        name_key: row.normalizedNameKey,
        birth_date: row.birthDate,
      }))),
    ]);
    const cpfCounts = new Map<string, number>();
    const phoneCounts = new Map<string, number>();
    const nameRows = new Map<string, typeof parsed.rows>();
    parsed.rows.forEach((row) => {
      if (row.cpf) cpfCounts.set(row.cpf, (cpfCounts.get(row.cpf) ?? 0) + 1);
      if (row.whatsapp) phoneCounts.set(row.whatsapp, (phoneCounts.get(row.whatsapp) ?? 0) + 1);
      const bucket = nameRows.get(row.normalizedNameKey) ?? [];
      bucket.push(row);
      nameRows.set(row.normalizedNameKey, bucket);
    });
    const candidateMap = new Map<string, typeof duplicateCandidates>();
    duplicateCandidates.forEach((candidate) => {
      const bucket = candidateMap.get(candidate.candidate_key) ?? [];
      bucket.push(candidate);
      candidateMap.set(candidate.candidate_key, bucket);
    });

    const items = parsed.rows.map((row) => {
      const issues = [...row.issues];
      const roleMatch = roleByKey.get(normalizeRoleKey(row.roleRaw));
      if (!roleMatch && row.roleRaw) {
        issues.push(createImportIssue("ROLE_UNKNOWN", "cargo", "ERROR", "A sigla não corresponde a um Cargo ativo do EKLESIA."));
      }
      if (row.cpf && (cpfCounts.get(row.cpf) ?? 0) > 1) {
        issues.push(createImportIssue("CPF_DUPLICATE_FILE", "cpf", "ERROR", "O mesmo CPF aparece em mais de uma linha do arquivo."));
      }
      const existingCpf = row.cpf ? existingCpfs.get(row.cpf) : null;
      if (existingCpf) {
        issues.push({
          ...createImportIssue("CPF_ALREADY_EXISTS", "cpf", "ERROR", "Este CPF já pertence a outro membro."),
          relatedMemberId: existingCpf.memberId,
          relatedMemberName: existingCpf.fullName,
        });
      }

      if (row.whatsapp && (phoneCounts.get(row.whatsapp) ?? 0) > 1) {
        issues.push({
          ...createImportIssue("PHONE_DUPLICATE_FILE", "fone", "INFO", "Este telefone aparece em mais de uma linha do arquivo."),
          resolved: true,
          resolution: "INFORMATION_ONLY",
        });
      }
      const existingPhone = row.whatsapp ? existingPhones.get(row.whatsapp) : null;
      if (existingPhone) {
        issues.push({
          ...createImportIssue("PHONE_ALREADY_EXISTS", "fone", "INFO", "Este telefone também aparece em outro cadastro; a importação não será bloqueada."),
          resolved: true,
          resolution: "INFORMATION_ONLY",
          relatedMemberId: existingPhone.memberId,
          relatedMemberName: existingPhone.fullName,
          relatedMemberArchived: existingPhone.archived,
        });
      }

      const sameFileNames = (nameRows.get(row.normalizedNameKey) ?? []).filter((candidate) => candidate.rowNumber !== row.rowNumber);
      const sameFileStrong = sameFileNames.find((candidate) => row.birthDate && candidate.birthDate === row.birthDate);
      const sameFileWeak = sameFileNames.find((candidate) => !row.birthDate || !candidate.birthDate);
      const external = candidateMap.get(row.normalizedNameKey) ?? [];
      const externalStrong = external.find((candidate) => row.birthDate && candidate.birth_date === row.birthDate);
      const externalWeak = externalStrong ?? external[0];
      if (sameFileStrong || externalStrong) {
        issues.push({
          ...createImportIssue("POSSIBLE_DUPLICATE_NAME_BIRTH", "nome", "ERROR", "Já existe uma pessoa com o mesmo nome e data de nascimento."),
          relatedMemberId: externalStrong?.member_id ?? null,
          relatedMemberName: externalStrong?.full_name ?? sameFileStrong?.fullName ?? null,
          relatedMemberArchived: externalStrong?.archived ?? false,
        });
      } else if (sameFileWeak || externalWeak) {
        issues.push({
          ...createImportIssue("POSSIBLE_DUPLICATE_NAME", "nome", "WARNING", "Existe um cadastro com o mesmo nome e a data precisa ser conferida."),
          relatedMemberId: externalWeak?.member_id ?? null,
          relatedMemberName: externalWeak?.full_name ?? sameFileWeak?.fullName ?? null,
          relatedMemberArchived: externalWeak?.archived ?? false,
        });
      }

      const classification = classify(issues, roleMatch?.id ?? null);
      const decision = hasBlockingDecision(issues) ? "PENDING" : "IMPORT";
      return {
        row_number: row.rowNumber,
        source_data: row.sourceData,
        full_name: row.fullName,
        normalized_name_key: row.normalizedNameKey,
        phone_raw: row.phoneRaw,
        whatsapp: row.whatsapp,
        birth_date: row.birthDate,
        role_raw: row.roleRaw,
        role_id: roleMatch?.id ?? null,
        role_title_variant: row.gender === "FEMALE" ? "FEMALE" : roleMatch?.variant ?? "AUTO",
        cpf: row.cpf,
        marital_status_raw: row.maritalStatusRaw,
        marital_status: row.maritalStatus,
        received_date: row.receivedDate,
        gender_raw: row.genderRaw,
        gender: row.gender,
        zip_code: row.zipCode,
        city: row.city,
        state: row.state,
        natural_city: row.naturalCity,
        natural_state: row.naturalState,
        father_name: row.fatherName,
        mother_name: row.motherName,
        baptism_date: row.baptismDate,
        holy_spirit_baptism_date: row.holySpiritBaptismDate,
        conversion_date: row.conversionDate,
        classification,
        decision,
        issues,
      };
    });

    const { data: batchId, error } = await supabase.rpc("prepare_member_import_official", {
      p_payload: {
        church_id: context.church.id,
        congregation_id: congregationId,
        original_filename: fileValue.name,
        worksheet_name: parsed.worksheetName,
        file_size_bytes: fileValue.size,
        file_sha256: fileSha256,
        normalization_version: MEMBER_IMPORT_NORMALIZATION_VERSION,
        settings_snapshot: {
          recognized_columns: parsed.recognizedColumns,
          ignored_columns: parsed.ignoredColumns,
          empty_rows: parsed.emptyRows,
        },
      },
      p_items: items,
    });
    if (error || !batchId) {
      return { success: false, message: friendlyError(error?.message ?? "IMPORT_PREPARE_FAILED") };
    }
    revalidatePath("/membros/importar");
    return {
      success: true,
      message: "Planilha analisada. Revise as validações antes de importar.",
      data: await getMemberImportWorkspace(context, String(batchId)),
    };
  } catch (error) {
    if (error instanceof MemberImportParserError) {
      return { success: false, message: error.message, code: error.code };
    }
    return { success: false, message: error instanceof Error ? friendlyError(error.message) : "Não foi possível analisar a planilha." };
  }
}

export async function getMemberImportWorkspaceAction(
  input: { batchId: string; page?: number; pageSize?: 20 | 50 | 100; search?: string; classification?: string },
): Promise<MemberImportActionResult<MemberImportWorkspaceData>> {
  const context = await requireAccessContext(PERMISSIONS.membersImport);
  const parsed = memberImportReviewSchema.safeParse({
    batchId: input.batchId,
    page: input.page ?? 1,
    pageSize: input.pageSize ?? 20,
    search: input.search ?? "",
    classification: input.classification ?? "",
  });
  if (!parsed.success) return { success: false, message: "Os filtros informados são inválidos." };
  try {
    const { batchId, ...params } = parsed.data;
    return { success: true, message: "Lote atualizado.", data: await getMemberImportWorkspace(context, batchId, params as MemberImportReviewParams) };
  } catch {
    return { success: false, message: "Não foi possível atualizar o lote." };
  }
}

export async function resolveMemberImportMappingAction(
  input: unknown,
): Promise<MemberImportActionResult<MemberImportWorkspaceData>> {
  const context = await requireAccessContext(PERMISSIONS.membersImport);
  const parsed = memberImportMappingSchema.safeParse(input);
  if (!parsed.success) return { success: false, message: "Selecione uma equivalência válida." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("resolve_member_import_mapping", {
    p_batch_id: parsed.data.batchId,
    p_kind: parsed.data.kind,
    p_raw_value: parsed.data.rawValue,
    p_value: parsed.data.value,
  });
  if (error) return { success: false, message: friendlyError(error.message) };
  revalidatePath("/membros/importar");
  return { success: true, message: "Mapeamento aplicado ao lote.", data: await getMemberImportWorkspace(context, parsed.data.batchId) };
}

export async function resolveMemberImportItemAction(
  input: unknown,
): Promise<MemberImportActionResult<MemberImportWorkspaceData>> {
  const context = await requireAccessContext(PERMISSIONS.membersImport);
  const parsed = memberImportItemResolutionSchema.safeParse(input);
  if (!parsed.success) return { success: false, message: "A decisão informada é inválida." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("resolve_member_import_official_item", {
    p_batch_id: parsed.data.batchId,
    p_item_id: parsed.data.itemId,
    p_resolution: parsed.data.resolution,
  });
  if (error) return { success: false, message: friendlyError(error.message) };
  revalidatePath("/membros/importar");
  return { success: true, message: "Decisão registrada.", data: await getMemberImportWorkspace(context, parsed.data.batchId) };
}

export async function confirmMemberImportAction(
  batchId: string,
): Promise<MemberImportActionResult<MemberImportWorkspaceData>> {
  const context = await requireAccessContext(PERMISSIONS.membersImport);
  const parsed = memberImportReviewSchema.shape.batchId.safeParse(batchId);
  if (!parsed.success) return { success: false, message: "O lote informado é inválido." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("execute_member_import", { p_batch_id: batchId });
  if (error) {
    const safeMessage = friendlyError(error.message);
    await supabase.from("member_import_batches").update({
      status: "FAILED",
      failure_code: Object.keys({
        IMPORT_UNRESOLVED_ERRORS: true,
        IMPORT_ROLE_INVALID: true,
        IMPORT_CPF_CONFLICT: true,
        IMPORT_DUPLICATE_CHANGED_DURING_CONFIRMATION: true,
      }).find((code) => error.message.includes(code)) ?? "IMPORT_EXECUTION_FAILED",
      failure_message: safeMessage,
    }).eq("id", batchId).eq("church_id", context.church.id);
    return { success: false, message: safeMessage };
  }
  revalidatePath("/membros");
  revalidatePath("/membros/importar");
  return { success: true, message: "Importação concluída com sucesso.", data: await getMemberImportWorkspace(context, batchId) };
}

export async function rollbackMemberImportAction(
  batchId: string,
): Promise<MemberImportActionResult<{ workspace: MemberImportWorkspaceData; blocked: boolean; blockers: Array<Record<string, string>> }>> {
  const context = await requireAccessContext(PERMISSIONS.membersImport);
  const parsed = memberImportReviewSchema.shape.batchId.safeParse(batchId);
  if (!parsed.success) return { success: false, message: "O lote informado é inválido." };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("rollback_member_import", { p_batch_id: batchId });
  if (error) return { success: false, message: friendlyError(error.message) };
  const result = (data ?? {}) as { blocked?: boolean; blockers?: Array<Record<string, string>> };
  revalidatePath("/membros");
  revalidatePath("/membros/importar");
  return {
    success: true,
    message: result.blocked ? "O lote possui alterações posteriores e não foi desfeito." : "Lote desfeito com segurança.",
    data: {
      workspace: await getMemberImportWorkspace(context, batchId),
      blocked: Boolean(result.blocked),
      blockers: result.blockers ?? [],
    },
  };
}

export async function cancelMemberImportAction(
  batchId: string,
): Promise<MemberImportActionResult<MemberImportWorkspaceData>> {
  const context = await requireAccessContext(PERMISSIONS.membersImport);
  const parsed = memberImportReviewSchema.shape.batchId.safeParse(batchId);
  if (!parsed.success) return { success: false, message: "O lote informado é inválido." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("cancel_member_import", { p_batch_id: batchId });
  if (error) return { success: false, message: friendlyError(error.message) };
  revalidatePath("/membros/importar");
  return { success: true, message: "Lote cancelado.", data: await getMemberImportWorkspace(context, batchId) };
}
