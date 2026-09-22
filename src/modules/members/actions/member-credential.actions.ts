"use server";

import { PERMISSIONS } from "@/modules/auth/constants/permissions";
import { requireAccessContext } from "@/modules/auth/services/access-context.service";
import { isCredentialMemberId } from "../services/member-credential.logic";
import {
  assertMemberCredentialAccessible,
  loadMemberCredentialPreview,
} from "../services/member-credential.service";
import { revokeMemberCredentialToken } from "../services/member-credential-token.service";
import { MemberCredentialError } from "../types/member-credential.types";

const credentialMessages = {
  MEMBER_CREDENTIAL_NOT_FOUND: "Membro não encontrado ou fora do seu escopo.",
  MEMBER_CREDENTIAL_INELIGIBLE:
    "A credencial é emitida somente para membros ativos.",
  MEMBER_CREDENTIAL_INCOMPLETE:
    "Preencha nome, matrícula e congregação antes de emitir a credencial.",
} as const;

function credentialMessage(error: unknown) {
  if (
    error instanceof MemberCredentialError &&
    error.code in credentialMessages
  ) {
    return credentialMessages[
      error.code as keyof typeof credentialMessages
    ];
  }
  return "Não foi possível preparar a credencial agora.";
}

export async function getMemberCredentialPreviewAction(memberId: string) {
  const context = await requireAccessContext(
    PERMISSIONS.membersCredentialIssue,
  );
  if (!isCredentialMemberId(memberId)) {
    return {
      success: false as const,
      message: credentialMessages.MEMBER_CREDENTIAL_NOT_FOUND,
    };
  }
  try {
    return {
      success: true as const,
      data: await loadMemberCredentialPreview(context, memberId),
    };
  } catch (error) {
    return { success: false as const, message: credentialMessage(error) };
  }
}

export async function revokeMemberCredentialAction(memberId: string) {
  const context = await requireAccessContext(
    PERMISSIONS.membersCredentialIssue,
  );
  if (!isCredentialMemberId(memberId)) {
    return { success: false as const, message: credentialMessages.MEMBER_CREDENTIAL_NOT_FOUND };
  }
  try {
    await assertMemberCredentialAccessible(context, memberId);
    await revokeMemberCredentialToken(context, memberId);
    return { success: true as const };
  } catch {
    return {
      success: false as const,
      message: "Não foi possível revogar a credencial agora.",
    };
  }
}
