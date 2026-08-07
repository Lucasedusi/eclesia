"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { PERMISSIONS, hasPermission } from "@/modules/auth/constants/permissions";
import { requireAccessContext } from "@/modules/auth/services/access-context.service";
import {
  getMemberCoreDetails,
  getMemberDocuments,
  getMemberFinance,
  getMemberHistory,
  listMembers,
} from "../services/member.service";
import type {
  MemberActionResponse,
  MemberLifecycleInput,
  MemberListParams,
} from "../types/member.types";

function friendlyError(message: string) {
  if (message.includes("MEMBER_PERMISSION_DENIED")) return "Seu acesso não permite realizar esta operação.";
  if (message.includes("MEMBER_REASON_REQUIRED")) return "Informe o motivo desta movimentação.";
  if (message.includes("MEMBER_DESTINATION_REQUIRED")) return "Informe a igreja de destino.";
  if (message.includes("MEMBER_CONGREGATION_INVALID")) return "Selecione uma Congregação válida dentro do seu escopo.";
  if (message.includes("MEMBER_EVENT_DATE_INVALID")) return "Informe uma data válida que não esteja no futuro.";
  if (message.includes("MEMBER_NOT_FOUND")) return "Membro não encontrado ou fora do seu escopo.";
  return "Não foi possível concluir a operação agora.";
}

export async function listMembersAction(params: Partial<MemberListParams>) {
  const context = await requireAccessContext(PERMISSIONS.membersViewBasic);
  try {
    return { success: true as const, data: await listMembers(context, params) };
  } catch (error) {
    console.error("Erro ao listar membros:", error);
    return { success: false as const, message: "Não foi possível atualizar a listagem." };
  }
}

export async function getMemberDetailsAction(memberId: string) {
  const context = await requireAccessContext(PERMISSIONS.membersViewBasic);
  const data = await getMemberCoreDetails(context, memberId);
  return data ? { success: true as const, data } : { success: false as const, message: "Membro não encontrado." };
}

export async function getMemberHistoryAction(memberId: string, page = 1) {
  const context = await requireAccessContext(PERMISSIONS.memberHistoryView);
  try {
    return { success: true as const, data: await getMemberHistory(context, memberId, page) };
  } catch {
    return { success: false as const, message: "Não foi possível carregar o histórico." };
  }
}

export async function getMemberFinanceAction(memberId: string, page = 1) {
  const context = await requireAccessContext(PERMISSIONS.financeView);
  try {
    return { success: true as const, data: await getMemberFinance(context, memberId, page) };
  } catch {
    return { success: false as const, message: "Não foi possível carregar os lançamentos financeiros." };
  }
}

export async function getMemberDocumentsAction(memberId: string) {
  const context = await requireAccessContext(PERMISSIONS.membersViewFull);
  try {
    return { success: true as const, data: await getMemberDocuments(context, memberId) };
  } catch {
    return { success: false as const, message: "Não foi possível carregar os documentos." };
  }
}

export async function changeMemberLifecycleAction(input: MemberLifecycleInput): Promise<MemberActionResponse> {
  const context = await requireAccessContext(PERMISSIONS.membersViewBasic);
  const allowed =
    (["MOVE_CONGREGATION", "TRANSFER"] as string[]).includes(input.action)
      ? hasPermission(context.permissions, PERMISSIONS.membersTransfer)
      : input.action === "ARCHIVE"
        ? hasPermission(context.permissions, PERMISSIONS.membersArchive)
        : input.action === "RESTORE"
          ? hasPermission(context.permissions, PERMISSIONS.membersRestore)
          : hasPermission(context.permissions, PERMISSIONS.membersChangeStatus);
  if (!allowed) return { success: false, message: "Seu acesso não permite esta movimentação." };

  const supabase = await createClient();
  const { error } = await supabase.rpc("change_member_lifecycle", {
    p_member_id: input.memberId,
    p_action: input.action,
    p_event_date: input.eventDate || new Date().toISOString().slice(0, 10),
    p_reason: input.reason.trim() || null,
    p_target_congregation_id: input.targetCongregationId || null,
    p_destination_church: input.destinationChurch?.trim() || null,
    p_end_roles: input.endRoles ?? true,
    p_sensitive: input.action === "DISCIPLINE",
  });
  if (error) return { success: false, message: friendlyError(error.message) };
  revalidatePath("/membros");
  return { success: true, message: "Movimentação registrada no histórico do membro." };
}

export async function addMemberHistoryNoteAction(input: {
  memberId: string;
  title: string;
  description: string;
  eventDate: string;
  sensitive: boolean;
}): Promise<MemberActionResponse> {
  const context = await requireAccessContext(PERMISSIONS.memberHistoryCreate);
  if (!input.title.trim() || !input.eventDate) return { success: false, message: "Informe o título e a data do evento." };
  if (input.sensitive && !hasPermission(context.permissions, "member_history.view_sensitive")) {
    return { success: false, message: "Seu acesso não permite criar eventos sensíveis." };
  }
  const supabase = await createClient();
  const { data: member } = await supabase.from("members").select("congregation_id").eq("id", input.memberId).eq("church_id", context.church.id).maybeSingle();
  if (!member) return { success: false, message: "Membro não encontrado." };
  const { error } = await supabase.from("member_history").insert({
    church_id: context.church.id,
    member_id: input.memberId,
    congregation_id: member.congregation_id,
    history_type: "GENERAL_NOTE",
    title: input.title.trim(),
    description: input.description.trim() || null,
    event_date: input.eventDate,
    is_sensitive: input.sensitive,
    created_by: context.profile.id,
  });
  if (error) return { success: false, message: "Não foi possível registrar o evento." };
  return { success: true, message: "Evento adicionado ao histórico." };
}

export async function manageMemberRoleAction(input: {
  memberId: string;
  operation: "SET";
  roleId?: string;
  startDate?: string;
  notes?: string;
}): Promise<MemberActionResponse> {
  await requireAccessContext(PERMISSIONS.memberRolesManage);
  const supabase = await createClient();
  const { error } = await supabase.rpc("manage_member_role", {
    p_member_id: input.memberId,
    p_operation: input.operation,
    p_role_id: input.roleId || null,
    p_link_id: null,
    p_start_date: input.startDate || null,
    p_end_date: null,
    p_notes: input.notes?.trim() || null,
    p_is_primary: true,
  });
  if (error) return { success: false, message: friendlyError(error.message) };
  revalidatePath("/membros");
  return { success: true, message: "Cargo do membro atualizado." };
}
