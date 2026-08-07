"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { PERMISSIONS, hasPermission } from "@/modules/auth/constants/permissions";
import { requireAccessContext } from "@/modules/auth/services/access-context.service";
import { isValidCpf, normalizeBrazilPhone } from "@/utils/input-masks";
import { memberFormSteps } from "../constants/member-form-options";
import type { MemberFormData, MemberFormErrors, MemberFormStepId } from "../types/member-form.types";
import { hasValidationErrors, validateAllMemberFormSteps } from "../utils/member-form-validation";

export type MemberFormActionResult = {
  success: boolean;
  message: string;
  memberId?: string;
  memberCode?: string | null;
  updatedAt?: string;
  fieldErrors?: MemberFormErrors;
};

function validate(data: MemberFormData): MemberFormErrors {
  return validateAllMemberFormSteps(
    memberFormSteps.map((step) => step.id) as MemberFormStepId[],
    data,
  );
}

function errorMessage(error: { message?: string; code?: string }) {
  const value = error.message ?? "";
  if (value.includes("MEMBER_CONFLICT")) return "Este cadastro foi alterado por outra pessoa. Atualize a página antes de salvar novamente.";
  if (value.includes("MEMBER_CPF_INVALID") || value.includes("member_sensitive_identity_cpf_valid_chk")) return "O CPF informado é inválido.";
  if (value.includes("MEMBER_WHATSAPP_INVALID")) return "Informe o WhatsApp no formato (00) 00000-0000.";
  if (value.includes("MEMBER_CONGREGATION_INVALID")) return "A Congregação selecionada não pertence ao seu escopo de acesso.";
  if (value.includes("MEMBER_SENSITIVE_PERMISSION_DENIED")) return "Seu acesso não permite alterar CPF ou RG.";
  if (value.includes("MEMBER_PASTORAL_PERMISSION_DENIED")) return "Seu acesso não permite alterar observações pastorais.";
  if (value.includes("MEMBER_ROLE_PERMISSION_DENIED")) return "Seu acesso não permite alterar o Cargo.";
  if (error.code === "23505" && value.toLowerCase().includes("cpf")) return "Já existe um membro com este CPF.";
  if (error.code === "23505") return "Já existe um cadastro com um dos identificadores informados.";
  return "Não foi possível salvar o membro agora. Tente novamente.";
}

function securePayload(data: MemberFormData, permissions: readonly string[], includeRole = true) {
  const payload: Record<string, string | boolean> = { ...data };
  payload.whatsapp = data.whatsapp ? normalizeBrazilPhone(data.whatsapp) : "";
  payload.cpf = data.cpf ? data.cpf.replace(/\D/g, "") : "";
  if (!hasPermission(permissions, PERMISSIONS.membersManageSensitiveIdentity)) {
    delete payload.cpf;
    delete payload.rg;
    delete payload.issuing_agency;
  }
  if (!hasPermission(permissions, PERMISSIONS.membersEditPastoralNotes)) {
    delete payload.pastoral_notes;
  }
  if (!includeRole || !hasPermission(permissions, PERMISSIONS.memberRolesManage)) {
    delete payload.main_role_id;
    delete payload.role_start_date;
  }
  return payload;
}

export async function checkMemberCpfAvailabilityAction(cpf: string, memberId?: string) {
  const context = await requireAccessContext(PERMISSIONS.membersManageSensitiveIdentity);
  const normalizedCpf = cpf.replace(/\D/g, "");
  if (!isValidCpf(normalizedCpf)) {
    return { success: false as const, message: "Informe um CPF válido." };
  }

  const supabase = await createClient();
  let query = supabase
    .from("member_sensitive_identity")
    .select("member_id")
    .eq("church_id", context.church.id)
    .eq("cpf", normalizedCpf)
    .is("deleted_at", null)
    .limit(1);
  if (memberId) query = query.neq("member_id", memberId);
  const { data, error } = await query;
  if (error) return { success: false as const, message: "Não foi possível verificar o CPF agora." };
  return { success: true as const, available: (data ?? []).length === 0 };
}

export async function createMemberAction(data: MemberFormData): Promise<MemberFormActionResult> {
  const context = await requireAccessContext(PERMISSIONS.membersCreate);
  const fieldErrors = validate(data);
  if (hasValidationErrors(fieldErrors)) {
    return { success: false, message: "Revise os campos destacados antes de salvar.", fieldErrors };
  }

  const supabase = await createClient();
  const { data: result, error } = await supabase.rpc("create_member_atomic", {
    p_church_id: context.church.id,
    p_payload: securePayload(data, context.permissions),
  });
  if (error) return { success: false, message: errorMessage(error) };

  const row = Array.isArray(result) ? result[0] : result;
  revalidatePath("/membros");
  return {
    success: true,
    message: "Membro cadastrado com sucesso.",
    memberId: row?.member_id,
    memberCode: row?.member_code ?? null,
  };
}

export async function updateMemberAction(
  memberId: string,
  expectedUpdatedAt: string,
  data: MemberFormData,
): Promise<MemberFormActionResult> {
  const context = await requireAccessContext(PERMISSIONS.membersUpdate);
  const fieldErrors = validate(data);
  if (hasValidationErrors(fieldErrors)) {
    return { success: false, message: "Revise os campos destacados antes de salvar.", fieldErrors };
  }

  const supabase = await createClient();
  const { data: updatedAt, error } = await supabase.rpc("update_member_atomic", {
    p_member_id: memberId,
    p_expected_updated_at: expectedUpdatedAt,
    p_payload: securePayload(data, context.permissions, false),
  });
  if (error) return { success: false, message: errorMessage(error) };

  revalidatePath("/membros");
  revalidatePath(`/membros/${memberId}/editar`);
  return { success: true, message: "Cadastro atualizado com sucesso.", memberId, updatedAt };
}
