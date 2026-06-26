"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { memberFormSteps } from "../constants/member-form-options";
import {
  generateNextMemberCode,
  updateNextMemberCodeNumber,
} from "../services/member-code.service";
import type {
  MemberFormData,
  MemberFormErrors,
  MemberFormStepId,
} from "../types/member-form.types";
import { getFriendlyMemberCreateError } from "../utils/member-action-errors";
import {
  hasValidationErrors,
  validateAllMemberFormSteps,
} from "../utils/member-form-validation";

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

type CreateMemberSuccess = {
  success: true;
  message: string;
  memberId: string;
  memberCode: string | null;
  warningMessage?: string;
};

type CreateMemberFailure = {
  success: false;
  message: string;
  fieldErrors?: MemberFormErrors;
};

export type CreateMemberActionResult =
  | CreateMemberSuccess
  | CreateMemberFailure;

function blankToNull(value?: string | null) {
  const normalizedValue = value?.trim() ?? "";
  return normalizedValue.length > 0 ? normalizedValue : null;
}

function dateToNull(value?: string | null) {
  return blankToNull(value);
}

function normalizeRequiredText(value: string, fallback: string) {
  const normalizedValue = value.trim();
  return normalizedValue.length > 0 ? normalizedValue : fallback;
}

function getTodayISODate() {
  return new Date().toISOString().slice(0, 10);
}

async function getEntityNameById(
  supabase: SupabaseServerClient,
  table: "roles" | "ministries",
  id: string,
) {
  if (!id) return null;

  const { data, error } = await supabase
    .from(table)
    .select("name")
    .eq("id", id)
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error(`Erro ao buscar nome em ${table}:`, error.message);
    return null;
  }

  return data?.name ?? null;
}

function buildMemberPayload(
  formData: MemberFormData,
  memberCode: string | null,
  mainRoleName: string | null,
  ministryName: string | null,
) {
  return {
    church_id: formData.church_id,
    congregation_id: formData.congregation_id,
    photo_url: blankToNull(formData.photo_url),
    full_name: formData.full_name.trim(),
    preferred_name: blankToNull(formData.preferred_name),
    gender: blankToNull(formData.gender),
    birth_date: dateToNull(formData.birth_date),
    marital_status: blankToNull(formData.marital_status),
    wedding_date: dateToNull(formData.wedding_date),
    nationality: blankToNull(formData.nationality) ?? "Brasileira",
    natural_city: blankToNull(formData.natural_city),
    natural_state: blankToNull(formData.natural_state),
    cpf: blankToNull(formData.cpf),
    rg: blankToNull(formData.rg),
    issuing_agency: blankToNull(formData.issuing_agency),
    profession: blankToNull(formData.profession),
    education_level: blankToNull(formData.education_level),
    physical_file_number: blankToNull(formData.physical_file_number),
    phone: blankToNull(formData.phone),
    whatsapp: blankToNull(formData.whatsapp),
    email: blankToNull(formData.email),
    zip_code: blankToNull(formData.zip_code),
    address: blankToNull(formData.address),
    number: blankToNull(formData.number),
    complement: blankToNull(formData.complement),
    district: blankToNull(formData.district),
    city: blankToNull(formData.city),
    state: blankToNull(formData.state),
    country: normalizeRequiredText(formData.country, "Brasil"),
    father_name: blankToNull(formData.father_name),
    mother_name: blankToNull(formData.mother_name),
    spouse_name: blankToNull(formData.spouse_name),
    guardian_name: blankToNull(formData.guardian_name),
    guardian_phone: blankToNull(formData.guardian_phone),
    member_code: memberCode,
    member_status: normalizeRequiredText(formData.member_status, "ACTIVE"),
    member_type: normalizeRequiredText(formData.member_type, "MEMBER"),
    joined_at: dateToNull(formData.joined_at),
    conversion_date: dateToNull(formData.conversion_date),
    baptism_date: dateToNull(formData.baptism_date),
    baptism_church: blankToNull(formData.baptism_church),
    child_presentation_date: dateToNull(formData.child_presentation_date),
    has_holy_spirit_baptism: Boolean(formData.has_holy_spirit_baptism),
    holy_spirit_baptism_date: dateToNull(formData.holy_spirit_baptism_date),
    previous_church: blankToNull(formData.previous_church),
    received_by: blankToNull(formData.received_by),
    received_date: dateToNull(formData.received_date),
    letter_origin_church: blankToNull(formData.letter_origin_church),
    letter_destination_church: blankToNull(formData.letter_destination_church),
    transfer_date: dateToNull(formData.transfer_date),
    inactive_reason: blankToNull(formData.inactive_reason),
    main_role: mainRoleName,
    ministry: ministryName,
    is_public_worker: Boolean(formData.is_public_worker),
    is_active_in_ministry: Boolean(formData.is_active_in_ministry),
    can_receive_notifications: Boolean(formData.can_receive_notifications),
    notes: blankToNull(formData.notes),
    pastoral_notes: blankToNull(formData.pastoral_notes),
  };
}

async function createMemberRoleLink(
  supabase: SupabaseServerClient,
  formData: MemberFormData,
  memberId: string,
) {
  if (!formData.main_role_id) return null;

  const { error } = await supabase.from("member_roles").insert({
    church_id: formData.church_id,
    member_id: memberId,
    role_id: formData.main_role_id,
    congregation_id: blankToNull(formData.congregation_id),
    is_primary: true,
    status: "ACTIVE",
    start_date: dateToNull(formData.joined_at || formData.received_date),
  });

  return error;
}

async function createMemberMinistryLink(
  supabase: SupabaseServerClient,
  formData: MemberFormData,
  memberId: string,
) {
  if (!formData.ministry_id) return null;

  const { error } = await supabase.from("member_ministries").insert({
    church_id: formData.church_id,
    member_id: memberId,
    ministry_id: formData.ministry_id,
    congregation_id: blankToNull(formData.congregation_id),
    is_leader: false,
    is_primary: true,
    status: "ACTIVE",
    start_date: dateToNull(formData.joined_at || formData.received_date),
  });

  return error;
}

async function createInitialMemberHistory(
  supabase: SupabaseServerClient,
  formData: MemberFormData,
  memberId: string,
) {
  const eventDate =
    dateToNull(formData.received_date) ??
    dateToNull(formData.joined_at) ??
    getTodayISODate();

  const { error } = await supabase.from("member_history").insert({
    church_id: formData.church_id,
    member_id: memberId,
    congregation_id: blankToNull(formData.congregation_id),
    history_type: "MEMBER_RECEIVED",
    title: "Cadastro inicial do membro",
    description: "Registro criado automaticamente no cadastro inicial.",
    event_date: eventDate,
    is_sensitive: false,
  });

  return error;
}

function buildWarningMessage(warnings: string[]) {
  if (warnings.length === 0) return undefined;
  return warnings.join(" ");
}

export async function createMemberAction(
  formData: MemberFormData,
): Promise<CreateMemberActionResult> {
  const allStepIds = memberFormSteps.map(
    (step) => step.id,
  ) as MemberFormStepId[];
  const fieldErrors = validateAllMemberFormSteps(allStepIds, formData);

  if (hasValidationErrors(fieldErrors)) {
    return {
      success: false,
      message: "Revise os campos obrigatórios antes de salvar.",
      fieldErrors,
    };
  }

  try {
    const supabase = await createClient();
    const generatedCode = await generateNextMemberCode(
      supabase,
      formData.church_id,
    );

    const [mainRoleName, ministryName] = await Promise.all([
      getEntityNameById(supabase, "roles", formData.main_role_id),
      getEntityNameById(supabase, "ministries", formData.ministry_id),
    ]);

    const memberPayload = buildMemberPayload(
      formData,
      generatedCode.memberCode,
      mainRoleName,
      ministryName,
    );

    const { data: createdMember, error: memberError } = await supabase
      .from("members")
      .insert(memberPayload)
      .select("id, member_code")
      .single();

    if (memberError) {
      return {
        success: false,
        message: getFriendlyMemberCreateError(memberError),
      };
    }

    const warnings: string[] = [];

    const codeUpdateError = await updateNextMemberCodeNumber(
      supabase,
      generatedCode.settingsId,
      generatedCode.nextNumberToSave,
    );

    if (codeUpdateError) {
      console.error(
        "Erro ao atualizar próximo número do código do membro:",
        codeUpdateError.message,
      );
      warnings.push(
        "O membro foi salvo, mas não foi possível atualizar a sequência automática de códigos.",
      );
    }

    const [roleLinkError, ministryLinkError, historyError] = await Promise.all([
      createMemberRoleLink(supabase, formData, createdMember.id),
      createMemberMinistryLink(supabase, formData, createdMember.id),
      createInitialMemberHistory(supabase, formData, createdMember.id),
    ]);

    if (roleLinkError) {
      console.error("Erro ao vincular cargo do membro:", roleLinkError.message);
      warnings.push(
        "O cadastro foi salvo, mas o vínculo com o cargo não foi criado.",
      );
    }

    if (ministryLinkError) {
      console.error(
        "Erro ao vincular ministério do membro:",
        ministryLinkError.message,
      );
      warnings.push(
        "O cadastro foi salvo, mas o vínculo com o ministério não foi criado.",
      );
    }

    if (historyError) {
      console.error(
        "Erro ao criar histórico inicial do membro:",
        historyError.message,
      );
      warnings.push(
        "O cadastro foi salvo, mas o histórico inicial não foi criado.",
      );
    }

    revalidatePath("/membros");
    revalidatePath("/membros/novo");

    return {
      success: true,
      message: generatedCode.memberCode
        ? `Membro cadastrado com sucesso. Código gerado: ${generatedCode.memberCode}.`
        : "Membro cadastrado com sucesso.",
      memberId: createdMember.id,
      memberCode: createdMember.member_code ?? generatedCode.memberCode,
      warningMessage: buildWarningMessage(warnings),
    };
  } catch (error) {
    console.error("Falha inesperada ao cadastrar membro:", error);

    return {
      success: false,
      message:
        error instanceof Error
          ? error.message
          : "Não foi possível salvar agora. Tente novamente.",
    };
  }
}
