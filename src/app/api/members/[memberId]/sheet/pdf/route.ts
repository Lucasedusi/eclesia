import { NextResponse } from "next/server";
import { z } from "zod";
import { PERMISSIONS, hasPermission } from "@/modules/auth/constants/permissions";
import { resolveAccessContext } from "@/modules/auth/services/access-context.service";
import { PublicRequestBodyError, readBoundedJsonBody } from "@/modules/events/utils/public-request";
import { generateMemberSheetDownload } from "@/modules/members/services/member-sheet.service";
import { MemberSheetError } from "@/modules/members/types/member-sheet.types";
import { memberSheetOptionsSchema } from "@/modules/members/validations/member-sheet.schemas";

const privateHeaders = { "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" };
function failure(message: string, status: number) {
  return NextResponse.json({ message }, { status, headers: privateHeaders });
}

export async function POST(request: Request, { params }: { params: Promise<{ memberId: string }> }) {
  try {
    const access = await resolveAccessContext();
    if (access.status !== "ready") return failure("Entre novamente para gerar a ficha.", access.status === "anonymous" ? 401 : 403);
    const required = [PERMISSIONS.membersViewBasic, PERMISSIONS.membersViewFull, PERMISSIONS.membersExport];
    if (required.some((permission) => !hasPermission(access.context.permissions, permission))) {
      return failure("Seu acesso não permite exportar esta ficha.", 403);
    }
    const origin = request.headers.get("origin");
    if ((origin && origin !== new URL(request.url).origin) || request.headers.get("sec-fetch-site") === "cross-site") {
      return failure("Origem da solicitação inválida.", 403);
    }
    const { memberId } = await params;
    if (!z.uuid().safeParse(memberId).success) return failure("Membro não encontrado ou fora do seu escopo.", 404);
    const input = memberSheetOptionsSchema.safeParse(await readBoundedJsonBody(request, 4096));
    if (!input.success) return failure("Opções da ficha inválidas.", 400);
    const result = await generateMemberSheetDownload(access.context, memberId, input.data);
    return new NextResponse(Buffer.from(result.body), {
      headers: { ...privateHeaders, "Content-Type": "application/pdf", "Content-Disposition": `attachment; filename="${result.fileName}"` },
    });
  } catch (error) {
    if (error instanceof PublicRequestBodyError) return failure(error.message, error.status);
    if (error instanceof MemberSheetError) {
      if (error.code === "MEMBER_SHEET_PERMISSION_DENIED") return failure("Seu acesso não permite incluir estas informações.", 403);
      if (error.code === "MEMBER_SHEET_NOT_FOUND") return failure("Membro não encontrado ou fora do seu escopo.", 404);
      if (error.code === "MEMBER_SHEET_TOO_LARGE") return failure("Esta seção ultrapassa o limite de 10.000 registros por ficha. Gere a ficha sem essa seção.", 422);
    }
    return failure("Não foi possível gerar a ficha agora. Tente novamente.", 500);
  }
}
