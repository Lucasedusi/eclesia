import { NextResponse } from "next/server";
import { PERMISSIONS } from "@/modules/auth/constants/permissions";
import { resolveAccessContext } from "@/modules/auth/services/access-context.service";
import { isCredentialMemberId } from "@/modules/members/services/member-credential.logic";
import { generateMemberCredentialDownload } from "@/modules/members/services/member-credential.service";
import { MemberCredentialError } from "@/modules/members/types/member-credential.types";

function errorResponse(status: number, message: string) {
  return NextResponse.json(
    { message },
    { status, headers: { "Cache-Control": "private, no-store" } },
  );
}

function credentialHttpError(error: unknown) {
  if (!(error instanceof MemberCredentialError)) {
    return { status: 500, message: "Não foi possível gerar a credencial agora." };
  }
  if (error.code === "MEMBER_CREDENTIAL_NOT_FOUND") {
    return {
      status: 404,
      message: "Membro não encontrado ou fora do seu escopo.",
    };
  }
  if (error.code === "MEMBER_CREDENTIAL_INELIGIBLE") {
    return {
      status: 422,
      message: "A credencial é emitida somente para membros ativos.",
    };
  }
  if (error.code === "MEMBER_CREDENTIAL_INCOMPLETE") {
    return {
      status: 422,
      message: "Preencha nome, matrícula e congregação antes de emitir a credencial.",
    };
  }
  return { status: 500, message: "Não foi possível gerar a credencial agora." };
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ memberId: string }> },
) {
  const access = await resolveAccessContext();
  if (access.status === "anonymous") {
    return errorResponse(401, "Autenticação necessária.");
  }
  if (access.status !== "ready") {
    return errorResponse(403, "Acesso não autorizado.");
  }
  if (!access.context.permissions.includes(PERMISSIONS.membersCredentialIssue)) {
    return errorResponse(403, "Acesso não autorizado.");
  }

  try {
    const { memberId } = await params;
    if (!isCredentialMemberId(memberId)) {
      return errorResponse(404, "Membro não encontrado ou fora do seu escopo.");
    }
    const result = await generateMemberCredentialDownload(
      access.context,
      memberId,
    );
    return new NextResponse(new Uint8Array(result.body), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${result.fileName}"`,
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    const { status, message } = credentialHttpError(error);
    return errorResponse(status, message);
  }
}
